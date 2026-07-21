import { Request, Response } from 'express';
import Employee from '../models/Employee';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import { sendEmail, welcomeEmailHtml } from '../utils/email';

const generateEmployeeCode = async (): Promise<string> => {
  const count = await Employee.countDocuments();
  return `EMP${String(count + 1).padStart(3, '0')}`;
};

export const getAllEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { department, status, search, page = 1, limit = 1000 } = req.query;
    const filter: any = {};

    // Dept managers (req.user.department set) are auto-scoped to their own
    // department unless an explicit `department` filter is passed (e.g. by the
    // main manager, whose department is empty and who can filter by any dept).
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;

    // `department` may arrive as a department NAME (frontend convention) or an
    // ObjectId — resolve names before filtering the ObjectId-ref `department` path.
    if (deptNameFilter) {
      if (/^[0-9a-fA-F]{24}$/.test(deptNameFilter)) {
        filter.department = deptNameFilter;
      } else {
        const DeptModel = (await import('../models/Department')).default;
        const deptDoc = await DeptModel.findOne({ name: deptNameFilter });
        filter.department = deptDoc ? deptDoc._id : { $in: [] };
      }
    }
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate('department', 'name code')
        .populate('reportingTo', 'firstName lastName')
        .populate('user', 'role')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Employee.countDocuments(filter),
    ]);

    // Flatten the populated user's role onto the employee object so the frontend can
    // filter by role (e.g. "Manager Attendance" employee-select) without a second lookup.
    const withRole = employees.map((e: any) => {
      const obj = e.toObject();
      obj.role = obj.user?.role;
      return obj;
    });

    res.status(200).json({
      success: true,
      data: withRole,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('department', 'name code')
      .populate('reportingTo', 'firstName lastName designation')
      .populate('user', 'email role lastLogin');

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }
    res.status(200).json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, department, designation, joiningDate,
      salary, reportingTo, workLocation, employmentType, role = 'employee', employeeCode: requestedCode } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already registered.' });
      return;
    }

    // Admin can set the Employee ID directly (used as a login identifier alongside
    // email) — validate it's unique before creating anything. Falls back to
    // auto-generation only if the admin leaves it blank.
    let employeeCode: string;
    if (requestedCode && String(requestedCode).trim()) {
      employeeCode = String(requestedCode).trim().toUpperCase();
      const codeTaken = await Employee.findOne({ employeeCode });
      if (codeTaken) {
        res.status(400).json({ success: false, message: `Employee ID "${employeeCode}" is already in use.` });
        return;
      }
    } else {
      employeeCode = await generateEmployeeCode();
    }

    // `department` arrives as a NAME (frontend convention, e.g. "Engineering"), but
    // Employee.department is an ObjectId ref — resolve it before saving, same pattern
    // used across the other controllers (attendance/tasks/daily-reports).
    let deptObjectId: any = undefined;
    let deptName = '';
    if (department) {
      const DeptModel = (await import('../models/Department')).default;
      const deptDoc = /^[0-9a-fA-F]{24}$/.test(department)
        ? await DeptModel.findById(department)
        : await DeptModel.findOne({ name: department });
      if (deptDoc) { deptObjectId = deptDoc._id; deptName = deptDoc.name; }
    }

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const user = await User.create({
      name: `${firstName} ${lastName}`, email, password: tempPassword, role,
      // Dept managers are scoped to their department name; a manager created with no
      // department is a "main manager" with all-department access (existing convention).
      department: role === 'manager' ? deptName : '',
    });

    const employee = await Employee.create({
      employeeCode, user: user._id, firstName, lastName, email, phone,
      department: deptObjectId, designation, joiningDate: joiningDate || new Date(),
      salary, reportingTo, workLocation, employmentType,
    });

    user.employeeId = employee._id;
    await user.save({ validateBeforeSave: false });

    let emailSent = false;
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to ZetaQ EMS — Your Account Details',
        html: welcomeEmailHtml(`${firstName} ${lastName}`, role, tempPassword),
      });
      emailSent = true;
    } catch (_) { /* SMTP may not be configured — credentials are still returned below */ }

    res.status(201).json({
      success: true,
      data: employee,
      // Only an admin sees this response — safe to return so they can hand the new
      // hire their login details even when the welcome email couldn't be delivered.
      credentials: { email, employeeCode, tempPassword },
      message: emailSent ? 'Employee created and welcome email sent.' : 'Employee created. Welcome email could not be sent — share the credentials shown below manually.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    }).populate('department', 'name code').populate('reportingTo', 'firstName lastName');

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    // Employee.status is the HR record's status, but login is gated on User.isActive —
    // keep them in sync so deactivating/reactivating an employee here actually blocks
    // or restores their ability to log in (previously these two flags could drift apart).
    if (req.body.status && employee.user) {
      await User.findByIdAndUpdate(employee.user, { isActive: req.body.status === 'active' });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }
    await User.findByIdAndUpdate(employee.user, { isActive: false });
    await Employee.findByIdAndUpdate(req.params.id, { status: 'inactive' });
    res.status(200).json({ success: true, message: 'Employee deactivated.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id })
      .populate('department', 'name code')
      .populate('reportingTo', 'firstName lastName designation')
      .populate('user', 'name email role department');

    // Return null data (not 404) so frontend shows empty profile gracefully
    res.status(200).json({ success: true, data: employee || null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = ['phone', 'address', 'emergencyContact', 'avatar',
      'firstName', 'lastName', 'designation', 'gender', 'dateOfBirth', 'bloodGroup',
      'skills', 'bio', 'workLocation', 'bankDetails', 'preferences'];
    const updates: any = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    // Deep-merge preferences so partial saves (e.g. only notifications) don't erase other keys
    if (updates.preferences) {
      const existing = await Employee.findOne({ user: req.user?._id }).select('preferences').lean();
      const merged = { ...(existing?.preferences || {}), ...updates.preferences };
      // Also merge nested sub-objects (notifications, privacy, ui)
      for (const sub of ['notifications', 'privacy', 'ui']) {
        if (updates.preferences[sub] && (existing as any)?.preferences?.[sub]) {
          (merged as any)[sub] = { ...(existing as any).preferences[sub], ...updates.preferences[sub] };
        }
      }
      updates.preferences = merged;
    }

    let employee = await Employee.findOneAndUpdate({ user: req.user?._id }, updates, {
      new: true, runValidators: false,
    }).populate('department', 'name code').populate('user', 'name email role department');

    // Create profile if it doesn't exist yet (shouldn't happen after register fix, but safety net)
    if (!employee && req.user) {
      const user = req.user;
      const [firstName, ...rest] = (user.name || 'User').split(' ');
      const empCode = await generateEmployeeCode();
      employee = await Employee.create({
        employeeCode: empCode,
        user: user._id,
        firstName: updates.firstName || firstName,
        lastName: updates.lastName || (rest.join(' ') || '-'),
        email: user.email,
        designation: updates.designation || 'Employee',
        joiningDate: new Date(),
        ...updates,
      });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const filter: any = {};
    if (managerDept) {
      const DeptModel = (await import('../models/Department')).default;
      const deptDoc = await DeptModel.findOne({ name: managerDept });
      filter.department = deptDoc ? deptDoc._id : { $in: [] };
    }

    const [total, active, inactive] = await Promise.all([
      Employee.countDocuments(filter),
      Employee.countDocuments({ ...filter, status: 'active' }),
      Employee.countDocuments({ ...filter, status: 'inactive' }),
    ]);

    const byDept = await Employee.aggregate([
      { $match: { status: 'active', ...filter } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      { $project: { name: '$dept.name', count: 1 } },
    ]);

    res.status(200).json({ success: true, data: { total, active, inactive, byDepartment: byDept } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
