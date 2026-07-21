import { Request, Response } from 'express';
import crypto from 'crypto';
import Department, { IDepartment } from '../models/Department';
import Employee from '../models/Employee';
import User from '../models/User';

export const getAllDepartments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.find().populate('head', 'firstName lastName');
    const counts = await Employee.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.count]));
    const withCount = departments.map((dept) => ({ ...dept.toObject(), employeeCount: countMap.get(String(dept._id)) || 0 }));
    res.status(200).json({ success: true, data: withCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Managers get an "MGR###" employee code, distinct from the "EMP###" codes regular
// employees use — mirrors the existing convention (Deepak Iyer = MGR002, the main
// manager = MGR027). Loops on collision since the count-based number isn't strictly
// sequential against pre-existing manager codes.
const generateManagerCode = async (): Promise<string> => {
  let n = (await Employee.countDocuments({ employeeCode: /^MGR/ })) + 1;
  let code = `MGR${String(n).padStart(3, '0')}`;
  while (await Employee.findOne({ employeeCode: code })) {
    n += 1;
    code = `MGR${String(n).padStart(3, '0')}`;
  }
  return code;
};

// Setting a department's `head` to an employee who isn't already a manager promotes
// them in place: their single User account gains role='manager', is scoped to this
// department, and (if a new login email is supplied) that email replaces their old
// one as their only login going forward. Returns fresh credentials only when a real
// promotion happened — reassigning an existing manager to a new department needs none.
const promoteToHead = async (
  dept: IDepartment,
  employeeId: string,
  newEmail?: string
): Promise<{ email: string; employeeCode: string; tempPassword: string } | undefined> => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error('Selected department head employee not found.');

  const user = await User.findById(employee.user);
  if (!user) throw new Error('No account linked to the selected employee.');

  let credentials: { email: string; employeeCode: string; tempPassword: string } | undefined;

  if (user.role !== 'manager') {
    if (newEmail) {
      const emailTaken = await User.findOne({ email: newEmail.toLowerCase(), _id: { $ne: user._id } });
      if (emailTaken) throw new Error(`Email "${newEmail}" is already in use.`);
    }
    const tempPassword = crypto.randomBytes(6).toString('hex');
    user.role = 'manager';
    user.department = dept.name;
    if (newEmail) user.email = newEmail.toLowerCase();
    user.password = tempPassword;
    await user.save();

    employee.department = dept._id as any;
    employee.employeeCode = await generateManagerCode();
    if (newEmail) employee.email = newEmail.toLowerCase();
    await employee.save();

    credentials = { email: user.email, employeeCode: employee.employeeCode, tempPassword };
  } else {
    // Already a manager — this is a reassignment, not a promotion. No new credentials,
    // but still move their HR record to the new department for consistency.
    user.department = dept.name;
    await user.save();
    employee.department = dept._id as any;
    await employee.save();
  }

  // Clear this person as head of any OTHER department they may have previously headed.
  await Department.updateMany({ head: employee._id, _id: { $ne: dept._id } }, { $unset: { head: '' } });

  dept.head = employee._id as any;
  await dept.save();

  return credentials;
};

export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { head, headEmail, ...deptFields } = req.body;
    const dept = await Department.create(deptFields);

    let credentials;
    if (head) {
      try {
        credentials = await promoteToHead(dept, head, headEmail);
      } catch (err: any) {
        // The department itself was created successfully — surface the head-assignment
        // failure without rolling back the department, so the admin can retry just that.
        res.status(201).json({ success: true, data: dept, headError: err.message });
        return;
      }
    }

    res.status(201).json({ success: true, data: dept, credentials });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { head, headEmail, ...deptFields } = req.body;
    const existing = await Department.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }

    Object.assign(existing, deptFields);

    let credentials;
    if (head !== undefined) {
      if (head === '') {
        existing.head = undefined;
      } else {
        // Always run this (not just when `head` differs from the current value) —
        // a department can already have this employee set as a purely decorative
        // head from before this feature existed, in which case they still need to
        // actually be promoted even though the stored `head` id isn't changing.
        try {
          credentials = await promoteToHead(existing, head, headEmail);
        } catch (err: any) {
          res.status(400).json({ success: false, message: err.message });
          return;
        }
      }
    }

    await existing.save();
    res.status(200).json({ success: true, data: existing, credentials });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const empCount = await Employee.countDocuments({ department: req.params.id, status: 'active' });
    if (empCount > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete department with active employees. Reassign or deactivate them first.' });
      return;
    }
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Department deleted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
