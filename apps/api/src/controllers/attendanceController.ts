import { Request, Response } from 'express';
import Attendance from '../models/Attendance';
import Employee from '../models/Employee';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

const getOrCreateEmployee = async (userId: any, userName?: string, userEmail?: string) => {
  let employee = await Employee.findOne({ user: userId });
  if (!employee) {
    const [firstName, ...rest] = (userName || userEmail || 'User').trim().split(' ');
    const count = await Employee.countDocuments();
    employee = await Employee.create({
      employeeCode: `EMP${String(count + 1).padStart(3, '0')}`,
      user: userId,
      firstName, lastName: rest.join(' ') || '-',
      email: userEmail || '',
      designation: 'Employee',
      joiningDate: new Date(),
      phone: '', workLocation: 'HQ',
    });
    // Keep User.employeeId in sync with the newly-created Employee — mirrors the
    // backfill authController.login already does — so role-filtered attendance
    // queries (e.g. admin's Manager Attendance tab) can find this record immediately.
    await User.findByIdAndUpdate(userId, { employeeId: employee._id });
  }
  return employee;
};

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await getOrCreateEmployee(req.user?._id, req.user?.name, req.user?.email);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const existing = await Attendance.findOne({ employee: employee._id, date: today });

    if (existing?.checkIn) {
      res.status(400).json({ success: false, message: 'Already checked in today.' });
      return;
    }

    const attendance = existing
      ? await Attendance.findByIdAndUpdate(existing._id, { checkIn: new Date(), status: 'present' }, { new: true })
      : await Attendance.create({
          employee: employee._id,
          date: today,
          checkIn: new Date(),
          status: 'present',
          markedBy: req.user?._id,
        });

    if (attendance?.isLate) {
      try {
        const emp = await Employee.findById(employee._id).populate('department', 'name');
        const deptName = (emp?.department as any)?.name || '';
        const notifyUsers: { _id: any; role: string }[] = await User.find({
          $or: [
            { role: 'admin' },
            { role: 'manager', $or: [{ department: '' }, { department: { $exists: false } }, { department: null }] },
            ...(deptName ? [{ role: 'manager', department: deptName }] : []),
          ],
        }).select('_id role');
        for (const u of notifyUsers) {
          await createNotification(
            u._id.toString(), u.role, 'attendance',
            'Late check-in', `${employee.firstName} ${employee.lastName} checked in late.`, u.role === 'admin' ? '/admin/attendance' : '/manager/attendance'
          );
        }
      } catch { /* notification failure should not block check-in */ }
    }

    res.status(200).json({ success: true, data: attendance, message: 'Check-in recorded.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await getOrCreateEmployee(req.user?._id, req.user?.name, req.user?.email);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const attendance = await Attendance.findOne({ employee: employee._id, date: today });

    if (!attendance?.checkIn) {
      res.status(400).json({ success: false, message: 'No check-in found for today.' });
      return;
    }
    if (attendance.checkOut) {
      res.status(400).json({ success: false, message: 'Already checked out today.' });
      return;
    }

    attendance.checkOut = new Date();
    await attendance.save();

    res.status(200).json({ success: true, data: attendance, message: 'Check-out recorded.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await getOrCreateEmployee(req.user?._id, req.user?.name, req.user?.email);

    const { month, year } = req.query;
    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const records = await Attendance.find({
      employee: employee._id,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    const summary = {
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      late: records.filter((r) => r.isLate).length,
      leave: records.filter((r) => r.status === 'leave').length,
      totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0),
    };

    res.status(200).json({ success: true, data: records, summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTodayAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Accepts an optional ?date=YYYY-MM-DD so the same raw-record (non-aggregated) shape
    // can back an exact single-day filter, not just "today" — defaults to today when absent.
    const { date, role } = req.query;
    const day = date ? new Date(date as string) : new Date();
    day.setUTCHours(0, 0, 0, 0);

    const attFilter: any = { date: day };
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    if (managerDept) {
      const Department = (await import('../models/Department')).default;
      const deptDoc = await Department.findOne({ name: managerDept });
      if (deptDoc) {
        const emps = await Employee.find({ department: deptDoc._id }).select('_id');
        attFilter.employee = { $in: emps.map((e: any) => e._id) };
      }
    }
    // "Manager Attendance" view: role isn't stored on Employee, only on the linked
    // User, so resolve it via User.role before filtering the Employee-keyed Attendance collection.
    if (role) {
      const roleUsers = await User.find({ role }).select('employeeId');
      const roleEmpIds = roleUsers.map((u: any) => u.employeeId).filter(Boolean);
      attFilter.employee = attFilter.employee
        ? { $in: (attFilter.employee.$in as any[]).filter((id: any) => roleEmpIds.some((r: any) => String(r) === String(id))) }
        : { $in: roleEmpIds };
    }

    const records = await Attendance.find(attFilter)
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeCode avatar department',
        populate: { path: 'department', select: 'name' },
      })
      .sort({ checkIn: 1 });

    // Official Work Hours: sourced only from the APPROVED timesheet for the same
    // employee+date (never from clock-in/out) — kept as a separate figure per the spec.
    const Timesheet = (await import('../models/Timesheet')).default;
    const approvedTimesheets = await Timesheet.find({
      employee: { $in: records.map((r: any) => r.employee?._id).filter(Boolean) },
      date: day,
      status: 'approved',
    }).select('employee totalMinutes');
    const officialByEmployee = new Map(approvedTimesheets.map((t: any) => [String(t.employee), t.totalMinutes]));
    const recordsWithOfficialHours = records.map((r: any) => {
      const obj = r.toObject();
      obj.officialWorkMinutes = officialByEmployee.get(String(r.employee?._id)) ?? null;
      return obj;
    });

    const totalEmployees = await Employee.countDocuments({ status: 'active' });
    const present = records.filter((r) => r.status === 'present').length;
    const late = records.filter((r) => r.isLate).length;
    const onLeave = records.filter((r) => r.status === 'leave').length;
    const absent = totalEmployees - present - onLeave;

    res.status(200).json({
      success: true,
      data: recordsWithOfficialHours,
      summary: { totalEmployees, present, absent: Math.max(0, absent), late, onLeave },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMonthlyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, department, role } = req.query;
    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const matchStage: any = { date: { $gte: start, $lte: end } };

    // `department` here is a department NAME (as sent by the frontend), not an
    // ObjectId — resolve it before filtering Employee.department (which is a ref).
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;
    let employeeIds: any[] | null = null;
    if (deptNameFilter) {
      const DeptModel = (await import('../models/Department')).default;
      const deptDoc = await DeptModel.findOne({ name: deptNameFilter });
      const emps = deptDoc ? await Employee.find({ department: deptDoc._id }).select('_id') : [];
      employeeIds = emps.map((e: any) => e._id);
    }
    // "Manager Attendance" view: role isn't stored on Employee, only on the linked
    // User, so resolve it via User.role and intersect with any department filter above.
    if (role) {
      const roleUsers = await User.find({ role }).select('employeeId');
      const roleEmpIds = roleUsers.map((u: any) => u.employeeId).filter(Boolean);
      employeeIds = employeeIds ? employeeIds.filter((id) => roleEmpIds.some((r: any) => String(r) === String(id))) : roleEmpIds;
    }
    if (employeeIds) matchStage.employee = { $in: employeeIds };

    const report = await Attendance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$employee',
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'half_day'] }, 1, 0] } },
          late: { $sum: { $cond: ['$isLate', 1, 0] } },
          totalHours: { $sum: '$totalHours' },
          overtimeHours: { $sum: '$overtimeHours' },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $lookup: {
          from: 'departments',
          localField: 'employee.department',
          foreignField: '_id',
          as: 'deptInfo',
        },
      },
      { $addFields: { 'employee.department': { $arrayElemAt: ['$deptInfo', 0] } } },
      // Official Work Hours: summed only from APPROVED timesheets for the same
      // employee within this date range — a separate figure from clock-based totalHours.
      {
        $lookup: {
          from: 'timesheets',
          let: { empId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$employee', '$$empId'] }, { $eq: ['$status', 'approved'] }, { $gte: ['$date', start] }, { $lte: ['$date', end] }] } } },
            { $group: { _id: null, total: { $sum: '$totalMinutes' } } },
          ],
          as: 'officialWork',
        },
      },
      { $addFields: { officialWorkMinutes: { $ifNull: [{ $arrayElemAt: ['$officialWork.total', 0] }, 0] } } },
      { $project: { deptInfo: 0, officialWork: 0 } },
    ]);

    res.status(200).json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Flat list of individual daily attendance records (not the per-employee monthly
// aggregate from getMonthlyReport) — used by report pages that need real dates,
// check-in/out times, and per-day rows to drive Today/Week/Month/Year filtering.
export const getAllAttendanceRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { department, role, from, to, limit = 1000 } = req.query;
    const filter: any = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from as string);
      if (to) filter.date.$lte = new Date(to as string);
    }

    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;
    let employeeIds: any[] | null = null;
    if (deptNameFilter) {
      const DeptModel = (await import('../models/Department')).default;
      const deptDoc = await DeptModel.findOne({ name: deptNameFilter });
      const emps = deptDoc ? await Employee.find({ department: deptDoc._id }).select('_id') : [];
      employeeIds = emps.map((e: any) => e._id);
    }
    if (role) {
      const roleUsers = await User.find({ role }).select('employeeId');
      const roleEmpIds = roleUsers.map((u: any) => u.employeeId).filter(Boolean);
      employeeIds = employeeIds ? employeeIds.filter((id) => roleEmpIds.some((r: any) => String(r) === String(id))) : roleEmpIds;
    }
    if (employeeIds) filter.employee = { $in: employeeIds };

    // .lean() skips hydrating full Mongoose documents — this endpoint can return
    // up to `limit` populated records for a read-only report table, so avoiding
    // that overhead measurably cuts response time for the larger result sets.
    const records = await Attendance.find(filter)
      .populate({ path: 'employee', select: 'firstName lastName employeeCode department', populate: { path: 'department', select: 'name' } })
      .sort({ date: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: d },
      { status, checkIn, checkOut, notes, markedBy: req.user?._id },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: attendance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
