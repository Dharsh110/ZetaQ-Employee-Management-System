import { Router, Response } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import Attendance from '../models/Attendance';
import Leave from '../models/Leave';
import Task from '../models/Task';
import Payroll from '../models/Payroll';

const router = Router();
router.use(protect);

// GET /api/v1/reports/summary?type=attendance&period=month
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { type = 'attendance', period = 'month' } = req.query;
    const { start, end } = getPeriodDates(String(period));

    let data: any[] = [];
    let summary: any = {};

    if (type === 'attendance') {
      const records = await Attendance.find({ date: { $gte: start, $lte: end } })
        .populate('employee', 'firstName lastName employeeCode');
      const byEmp: Record<string, any> = {};
      records.forEach(r => {
        const emp = r.employee as any;
        if (!emp) return;
        if (!byEmp[emp._id]) byEmp[emp._id] = { employee: emp, present: 0, absent: 0, late: 0, totalHours: 0, days: 0 };
        const s = byEmp[emp._id];
        if (r.status === 'present') s.present++;
        if (r.status === 'absent') s.absent++;
        if (r.isLate) s.late++;
        s.totalHours += r.totalHours || 0;
        s.days++;
      });
      data = Object.values(byEmp).map((s: any) => ({
        ...s,
        avgHours: s.days > 0 ? s.totalHours / s.days : 0,
        attendancePercent: s.days > 0 ? (s.present / s.days) * 100 : 0,
      }));
      const totalPresent = data.reduce((a, d) => a + d.present, 0);
      const totalAbsent = data.reduce((a, d) => a + d.absent, 0);
      summary = { totalEmployees: data.length, totalPresent, totalAbsent };
    }

    if (type === 'leave') {
      const leaves = await Leave.find({ fromDate: { $gte: start, $lte: end } })
        .populate('employee', 'firstName lastName employeeCode');
      data = leaves.map(l => l.toObject());
      summary = {
        total: leaves.length,
        approved: leaves.filter(l => l.status === 'approved').length,
        pending: leaves.filter(l => l.status === 'pending').length,
        rejected: leaves.filter(l => l.status === 'rejected').length,
      };
    }

    if (type === 'payroll') {
      const payrolls = await Payroll.find({ payPeriodStart: { $gte: start, $lte: end } })
        .populate('employee', 'firstName lastName employeeCode');
      data = payrolls.map(p => p.toObject());
      const totalNet = payrolls.reduce((a, p) => a + (p.netSalary || 0), 0);
      summary = { totalPayrolls: payrolls.length, totalNetSalary: totalNet };
    }

    if (type === 'task') {
      const tasks = await Task.find({ dueDate: { $gte: start, $lte: end } })
        .populate('assignedTo', 'firstName lastName');
      data = tasks.map(t => t.toObject());
      summary = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        overdue: tasks.filter(t => t.status === 'overdue').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
      };
    }

    res.json({ success: true, data, summary });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/v1/reports/download (placeholder — returns 501)
router.get('/download', async (_req, res) => {
  res.status(501).json({ success: false, message: 'Download endpoint requires xlsx/pdf library setup on the backend.' });
});

function getPeriodDates(period: string): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }

  return { start, end };
}

export default router;
