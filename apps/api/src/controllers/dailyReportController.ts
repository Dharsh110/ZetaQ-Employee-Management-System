import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import DailyReport from '../models/DailyReport';
import Employee from '../models/Employee';

export const createReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { empCode, empName, department, date, taskTitle, description, achievements, challenges, nextPlan, mood, hoursWorked, status, recipients, link, files } = req.body;

    // Auto-resolve department from Employee record if not provided
    let deptName = department || '';
    let resolvedEmpCode = empCode || 'EMP000';
    if (!deptName || resolvedEmpCode === 'EMP000') {
      try {
        const emp = await Employee.findOne({ user: req.user?._id }).populate('department', 'name');
        if (!deptName) deptName = (emp?.department as any)?.name || '';
        if (resolvedEmpCode === 'EMP000') resolvedEmpCode = emp?.employeeCode || 'EMP000';
      } catch {}
    }

    const report = await DailyReport.create({
      employee: req.user?._id,
      empCode: resolvedEmpCode,
      empName: empName || req.user?.name,
      department: deptName,
      date,
      taskTitle,
      description,
      achievements,
      challenges,
      nextPlan,
      mood: mood || 'good',
      hoursWorked,
      status,
      recipients: recipients || ['manager'],
      link,
      files: files || [],
    });
    res.status(201).json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reports = await DailyReport.find({ employee: req.user?._id }).sort({ date: -1 }).limit(50);
    res.json({ success: true, reports });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dept, date, empCode } = req.query;
    const filter: any = {};
    if (dept)    filter.department = dept;
    if (date)    filter.date = date;
    if (empCode) filter.empCode = empCode;

    // Scoped manager: only see reports from their department
    const managerDept = req.user?.role === 'manager' ? (req.user as any).department : '';
    if (managerDept && !dept) {
      filter.department = managerDept;
    }

    const reports = await DailyReport.find(filter).sort({ date: -1 }).limit(200);
    res.json({ success: true, reports });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await DailyReport.findOneAndUpdate(
      { _id: req.params.id, employee: req.user?._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!report) { res.status(404).json({ success: false, message: 'Report not found' }); return; }
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await DailyReport.findOneAndDelete({ _id: req.params.id, employee: req.user?._id });
    if (!report) { res.status(404).json({ success: false, message: 'Report not found' }); return; }
    res.json({ success: true, message: 'Report deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addReportComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      res.status(400).json({ success: false, message: 'Comment text is required.' });
      return;
    }
    // $push via findByIdAndUpdate (rather than fetch + mutate + .save()) so we
    // don't trigger full-document required-field validation on legacy reports
    // that predate stricter schema fields — we're only appending a comment.
    const report = await DailyReport.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: {
            author: req.user?._id,
            authorName: req.user?.name || '',
            authorRole: req.user?.role || '',
            text: String(text).trim(),
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
    if (!report) { res.status(404).json({ success: false, message: 'Report not found' }); return; }

    res.status(201).json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
