import { Response } from 'express';
import Timesheet from '../models/Timesheet';
import Employee from '../models/Employee';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

const dayStart = (d: string | Date): Date => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

// Turns a timesheet's entries into a short human-readable summary for notifications,
// e.g. "2 tasks (Authentication Module, Dashboard Development) — 3.0h" — so notifications
// carry real content instead of just a generic "submitted a timesheet" message.
const summarizeEntries = (entries: { task: string; timeSpentMinutes: number }[]): string => {
  const taskNames = entries.map((e) => e.task).join(', ');
  const hours = (entries.reduce((s, e) => s + (e.timeSpentMinutes || 0), 0) / 60).toFixed(1);
  const truncated = taskNames.length > 80 ? `${taskNames.slice(0, 77)}...` : taskNames;
  return `${entries.length} task${entries.length !== 1 ? 's' : ''} (${truncated}) — ${hours}h`;
};

// Employee creates/updates their draft timesheet for a date. One document per
// employee per day — repeated calls upsert the same doc while it's still editable.
export const saveDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, entries } = req.body;
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) { res.status(404).json({ success: false, message: 'Employee not found.' }); return; }

    const day = dayStart(date);
    let timesheet = await Timesheet.findOne({ employee: employee._id, date: day });

    if (timesheet && !['draft', 'rejected'].includes(timesheet.status)) {
      res.status(400).json({ success: false, message: `Timesheet is ${timesheet.status.replace('_', ' ')} and can no longer be edited.` });
      return;
    }

    if (!timesheet) {
      timesheet = new Timesheet({
        employee: employee._id, date: day, entries: entries || [], status: 'draft',
        auditTrail: [{ action: 'created', by: req.user?._id, at: new Date() }],
      });
    } else {
      timesheet.entries = entries || [];
      timesheet.auditTrail.push({ action: 'updated', by: req.user?._id as any, at: new Date() });
    }
    await timesheet.save();

    res.status(200).json({ success: true, data: timesheet });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTimesheets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) { res.status(404).json({ success: false, message: 'Employee not found.' }); return; }

    const { from, to } = req.query;
    const filter: any = { employee: employee._id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = dayStart(from as string);
      if (to) filter.date.$lte = dayStart(to as string);
    }

    const timesheets = await Timesheet.find(filter).populate('approvedBy', 'name').sort({ date: -1 });
    res.status(200).json({ success: true, data: timesheets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id }).populate('department', 'name');
    if (!employee) { res.status(404).json({ success: false, message: 'Employee not found.' }); return; }

    const timesheet = await Timesheet.findOne({ _id: req.params.id, employee: employee._id });
    if (!timesheet) { res.status(404).json({ success: false, message: 'Timesheet not found.' }); return; }
    if (timesheet.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Only a draft timesheet can be submitted.' });
      return;
    }
    if (!timesheet.entries.length) {
      res.status(400).json({ success: false, message: 'Add at least one task entry before submitting.' });
      return;
    }

    timesheet.status = 'pending_approval';
    timesheet.submittedAt = new Date();
    timesheet.auditTrail.push({ action: 'submitted', by: req.user?._id as any, at: new Date() });
    await timesheet.save();

    const entrySummary = summarizeEntries(timesheet.entries);
    await notifyManagers(employee, `New timesheet submitted`, `${employee.firstName} ${employee.lastName} submitted a timesheet for ${timesheet.date.toISOString().slice(0, 10)}: ${entrySummary}.`);
    await createNotification(
      String(req.user?._id), 'employee', 'timesheet',
      'Timesheet submitted', `Your timesheet for ${timesheet.date.toISOString().slice(0, 10)} was submitted for approval: ${entrySummary}.`,
      '/employee/timesheet'
    );

    res.status(200).json({ success: true, data: timesheet, message: 'Timesheet submitted for approval.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resubmitTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) { res.status(404).json({ success: false, message: 'Employee not found.' }); return; }

    const timesheet = await Timesheet.findOne({ _id: req.params.id, employee: employee._id });
    if (!timesheet) { res.status(404).json({ success: false, message: 'Timesheet not found.' }); return; }
    if (timesheet.status !== 'rejected') {
      res.status(400).json({ success: false, message: 'Only a rejected timesheet can be resubmitted.' });
      return;
    }

    const { entries } = req.body;
    if (Array.isArray(entries)) timesheet.entries = entries;
    timesheet.status = 'pending_approval';
    timesheet.submittedAt = new Date();
    timesheet.rejectionReason = undefined;
    timesheet.auditTrail.push({ action: 'resubmitted', by: req.user?._id as any, at: new Date() });
    await timesheet.save();

    await notifyManagers(employee, `Timesheet resubmitted`, `${employee.firstName} ${employee.lastName} resubmitted their timesheet for ${timesheet.date.toISOString().slice(0, 10)}: ${summarizeEntries(timesheet.entries)}.`);

    res.status(200).json({ success: true, data: timesheet, message: 'Timesheet resubmitted for approval.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function notifyManagers(employee: any, title: string, message: string) {
  try {
    const deptName = (employee.department as any)?.name || '';
    // Recipients: every admin, every Main Manager (department is empty/missing — they
    // have all-department oversight), and the specific department's own manager if the
    // employee has a department. Using $or (not a duplicate `role` key, which would
    // silently collapse to just the last clause) so all three groups are actually included.
    const recipients = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'manager', $or: [{ department: '' }, { department: { $exists: false } }, { department: null }] },
        ...(deptName ? [{ role: 'manager', department: deptName }] : []),
      ],
    }).select('_id role');
    for (const r of recipients) {
      await createNotification(r._id.toString(), r.role, 'timesheet', title, message, r.role === 'admin' ? '/admin/timesheets' : '/manager/timesheet-approvals', deptName || undefined);
    }
  } catch { /* notification failure should not block the workflow */ }
}

// Manager/Admin: list timesheets pending or already actioned, scoped to department.
export const getAllTimesheets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, department, employeeId, from, to, page = 1, limit = 100 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = dayStart(from as string);
      if (to) filter.date.$lte = dayStart(to as string);
    }

    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;
    let employeeFilter: any = {};
    if (deptNameFilter) {
      const Department = (await import('../models/Department')).default;
      const deptDoc = await Department.findOne({ name: deptNameFilter });
      employeeFilter.department = deptDoc ? deptDoc._id : { $in: [] };
    }
    if (employeeId) employeeFilter._id = employeeId;

    if (Object.keys(employeeFilter).length) {
      const emps = await Employee.find(employeeFilter).select('_id');
      filter.employee = { $in: emps.map((e) => e._id) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [timesheets, total] = await Promise.all([
      Timesheet.find(filter)
        .populate({ path: 'employee', select: 'firstName lastName employeeCode avatar department', populate: { path: 'department', select: 'name' } })
        .populate('approvedBy', 'name')
        .skip(skip).limit(Number(limit)).sort({ date: -1 }).lean(),
      Timesheet.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true, data: timesheets,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timesheet = await Timesheet.findById(req.params.id).populate('employee');
    if (!timesheet) { res.status(404).json({ success: false, message: 'Timesheet not found.' }); return; }
    if (timesheet.status !== 'pending_approval') {
      res.status(400).json({ success: false, message: 'Only a pending timesheet can be approved.' });
      return;
    }

    timesheet.status = 'approved';
    timesheet.approvedBy = req.user?._id as any;
    timesheet.approvedAt = new Date();
    timesheet.auditTrail.push({ action: 'approved', by: req.user?._id as any, at: new Date() });
    await timesheet.save();

    const empUserId = (timesheet.employee as any)?.user;
    if (empUserId) {
      await createNotification(
        empUserId.toString(), 'employee', 'timesheet',
        'Timesheet approved', `Your timesheet for ${timesheet.date.toISOString().slice(0, 10)} was approved: ${summarizeEntries(timesheet.entries)}. These hours now count toward your official work hours.`,
        '/employee/timesheet'
      );
    }

    res.status(200).json({ success: true, data: timesheet, message: 'Timesheet approved.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectTimesheet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ success: false, message: 'A rejection reason is required.' });
      return;
    }

    const timesheet = await Timesheet.findById(req.params.id).populate('employee');
    if (!timesheet) { res.status(404).json({ success: false, message: 'Timesheet not found.' }); return; }
    if (timesheet.status !== 'pending_approval') {
      res.status(400).json({ success: false, message: 'Only a pending timesheet can be rejected.' });
      return;
    }

    timesheet.status = 'rejected';
    timesheet.rejectionReason = String(reason).trim();
    timesheet.approvedBy = req.user?._id as any;
    timesheet.approvedAt = new Date();
    timesheet.auditTrail.push({ action: 'rejected', by: req.user?._id as any, at: new Date(), note: reason });
    await timesheet.save();

    const empUserId = (timesheet.employee as any)?.user;
    if (empUserId) {
      await createNotification(
        empUserId.toString(), 'employee', 'timesheet',
        'Timesheet rejected', `Your timesheet for ${timesheet.date.toISOString().slice(0, 10)} (${summarizeEntries(timesheet.entries)}) was rejected: ${reason}`,
        '/employee/timesheet'
      );
    }

    res.status(200).json({ success: true, data: timesheet, message: 'Timesheet rejected.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/Manager reporting: approved/pending/rejected hours + counts, with filters.
export const getTimesheetSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to, department, employeeId } = req.query;
    const filter: any = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = dayStart(from as string);
      if (to) filter.date.$lte = dayStart(to as string);
    }

    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    const deptNameFilter = (department as string) || managerDept;
    let employeeFilter: any = {};
    if (deptNameFilter) {
      const Department = (await import('../models/Department')).default;
      const deptDoc = await Department.findOne({ name: deptNameFilter });
      employeeFilter.department = deptDoc ? deptDoc._id : { $in: [] };
    }
    if (employeeId) employeeFilter._id = employeeId;
    if (Object.keys(employeeFilter).length) {
      const emps = await Employee.find(employeeFilter).select('_id');
      filter.employee = { $in: emps.map((e) => e._id) };
    }

    const timesheets = await Timesheet.find(filter)
      .populate({ path: 'employee', select: 'firstName lastName employeeCode department', populate: { path: 'department', select: 'name' } });

    const hoursOf = (list: typeof timesheets) => list.reduce((s, t) => s + t.totalMinutes / 60, 0);
    const approved = timesheets.filter((t) => t.status === 'approved');
    const pending = timesheets.filter((t) => t.status === 'pending_approval');
    const rejected = timesheets.filter((t) => t.status === 'rejected');

    res.status(200).json({
      success: true,
      summary: {
        approvedHours: Math.round(hoursOf(approved) * 100) / 100,
        pendingHours: Math.round(hoursOf(pending) * 100) / 100,
        rejectedHours: Math.round(hoursOf(rejected) * 100) / 100,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        pendingCount: pending.length,
        totalCount: timesheets.length,
      },
      data: timesheets,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
