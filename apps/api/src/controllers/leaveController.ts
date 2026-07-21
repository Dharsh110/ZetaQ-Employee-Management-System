import { Request, Response } from 'express';
import Leave from '../models/Leave';
import Employee from '../models/Employee';
import Attendance from '../models/Attendance';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leaveType, fromDate, toDate, reason } = req.body;
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) {
      res.status(400).json({ success: false, message: 'From date cannot be after to date.' });
      return;
    }

    const overlap = await Leave.findOne({
      employee: employee._id,
      status: { $in: ['pending', 'approved'] },
      $or: [{ fromDate: { $lte: to }, toDate: { $gte: from } }],
    });

    if (overlap) {
      res.status(400).json({ success: false, message: 'You already have a leave request for these dates.' });
      return;
    }

    const diffTime = Math.abs(to.getTime() - from.getTime());
    const totalDays = leaveType === 'half_day' ? 0.5 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leave = await Leave.create({
      employee: employee._id,
      leaveType, fromDate: from, toDate: to, totalDays, reason,
    });

    try {
      const populatedEmp = await Employee.findById(employee._id).populate('department', 'name');
      const deptName = (populatedEmp?.department as any)?.name || '';
      const recipients = await User.find({
        $or: [
          { role: 'admin' },
          { role: 'manager', $or: [{ department: '' }, { department: { $exists: false } }, { department: null }] },
          ...(deptName ? [{ role: 'manager', department: deptName }] : []),
        ],
      }).select('_id role');
      for (const r of recipients) {
        await createNotification(
          r._id.toString(), r.role, 'leave',
          'New leave request', `${employee.firstName} ${employee.lastName} applied for ${leaveType} leave (${totalDays} day${totalDays === 1 ? '' : 's'})`,
          r.role === 'admin' ? '/admin/leaves' : '/manager/leaves', deptName || undefined
        );
      }
    } catch { /* notification failure should not block leave application */ }

    res.status(201).json({ success: true, data: leave, message: 'Leave application submitted.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const leaves = await Leave.find({ employee: employee._id })
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    const summary = {
      casual: leaves.filter((l) => l.leaveType === 'casual' && l.status === 'approved').reduce((s, l) => s + l.totalDays, 0),
      sick: leaves.filter((l) => l.leaveType === 'sick' && l.status === 'approved').reduce((s, l) => s + l.totalDays, 0),
      earned: leaves.filter((l) => l.leaveType === 'earned' && l.status === 'approved').reduce((s, l) => s + l.totalDays, 0),
    };

    res.status(200).json({ success: true, data: leaves, summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, department, leaveType, page = 1, limit = 100 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (leaveType) filter.leaveType = leaveType;

    // `department` here is a department NAME (as sent by the frontend), not an
    // ObjectId — resolve it before filtering Employee.department (which is a ref).
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;
    if (deptNameFilter) {
      const Department = (await import('../models/Department')).default;
      const deptDoc = await Department.findOne({ name: deptNameFilter });
      const emps = deptDoc ? await Employee.find({ department: deptDoc._id }).select('_id') : [];
      filter.employee = { $in: emps.map((e) => e._id) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [leaves, total] = await Promise.all([
      Leave.find(filter)
        .populate({ path: 'employee', select: 'firstName lastName employeeCode avatar department', populate: { path: 'department', select: 'name' } })
        .populate('approvedBy', 'name')
        .skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      Leave.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true, data: leaves,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLeaveStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, rejectionReason } = req.body;
    const leave = await Leave.findById(req.params.id).populate('employee');

    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave request not found.' });
      return;
    }

    leave.status = status;
    leave.approvedBy = req.user?._id as any;
    leave.approvedAt = new Date();
    if (rejectionReason) leave.rejectionReason = rejectionReason;
    await leave.save();

    if (status === 'approved') {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      const current = new Date(from);
      while (current <= to) {
        const d = new Date(current);
        d.setUTCHours(0, 0, 0, 0);
        await Attendance.findOneAndUpdate(
          { employee: leave.employee._id, date: d },
          { status: 'leave', markedBy: req.user?._id },
          { upsert: true }
        );
        current.setDate(current.getDate() + 1);
      }
    }

    try {
      const empUserId = (leave.employee as any)?.user;
      if (empUserId) {
        await createNotification(
          empUserId.toString(), 'employee', 'leave',
          `Leave ${status}`, `Your ${leave.leaveType} leave request was ${status}${rejectionReason ? `: ${rejectionReason}` : '.'}`,
          '/employee/leaves'
        );
      }
    } catch { /* notification failure should not block leave status update */ }

    res.status(200).json({ success: true, data: leave, message: `Leave ${status}.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id });
    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave not found.' });
      return;
    }
    if (leave.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Only pending leaves can be cancelled.' });
      return;
    }
    leave.status = 'cancelled';
    await leave.save();
    res.status(200).json({ success: true, message: 'Leave cancelled.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
