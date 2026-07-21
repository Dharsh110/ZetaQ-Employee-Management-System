import { Request, Response } from 'express';
import Payroll from '../models/Payroll';
import Employee from '../models/Employee';
import Attendance from '../models/Attendance';
import { AuthRequest } from '../middleware/auth';
import { createNotification } from './notificationController';

export const generatePayroll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, month, year } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const existing = await Payroll.findOne({ employee: employeeId, month, year });
    if (existing) {
      res.status(400).json({ success: false, message: 'Payroll already generated for this period.' });
      return;
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const attendance = await Attendance.find({
      employee: employeeId,
      date: { $gte: start, $lte: end },
    });

    const presentDays = attendance.filter((a) => a.status === 'present').length;
    const leaveDays = attendance.filter((a) => a.status === 'leave').length;
    const overtimeHours = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

    const basicSalary = employee.salary || 50000;
    const hra = Math.round(basicSalary * 0.4);
    const transport = 2000;
    const medical = 1500;
    const pf = Math.round(basicSalary * 0.12);
    const tax = basicSalary > 50000 ? Math.round(basicSalary * 0.1) : 0;
    const overtimePay = Math.round((basicSalary / 26 / 8) * 1.5 * overtimeHours);

    const payroll = await Payroll.create({
      employee: employeeId,
      month, year, basicSalary,
      allowances: { hra, transport, medical, other: 0 },
      deductions: { pf, tax, other: 0 },
      presentDays, leaveDays, workingDays: 26,
      overtime: overtimeHours, overtimePay,
      processedBy: req.user?._id,
      processedAt: new Date(),
      status: 'processed',
    });

    res.status(201).json({ success: true, data: payroll });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPayroll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, status, department, page = 1, limit = 10 } = req.query;
    const filter: any = {};
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    if (status) filter.status = status;

    // `department` here is a department NAME (as sent by the frontend), not an
    // ObjectId — resolve it before filtering Employee.department (which is a ref).
    if (department) {
      const DeptModel = (await import('../models/Department')).default;
      const deptDoc = await DeptModel.findOne({ name: department as string });
      const employees = deptDoc ? await Employee.find({ department: deptDoc._id }).select('_id') : [];
      filter.employee = { $in: employees.map((e) => e._id) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [payrolls, total] = await Promise.all([
      Payroll.find(filter)
        .populate({ path: 'employee', select: 'firstName lastName employeeCode department', populate: { path: 'department', select: 'name' } })
        .skip(skip).limit(Number(limit)).sort({ year: -1, month: -1 }).lean(),
      Payroll.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true, data: payrolls,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyPayslips = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee = await Employee.findOne({ user: req.user?._id });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const payslips = await Payroll.find({ employee: employee._id }).sort({ year: -1, month: -1 });
    res.status(200).json({ success: true, data: payslips });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidAt: new Date() },
      { new: true }
    );
    if (!payroll) {
      res.status(404).json({ success: false, message: 'Payroll record not found.' });
      return;
    }

    try {
      const employee = await Employee.findById(payroll.employee);
      if (employee?.user) {
        await createNotification(
          employee.user.toString(), 'employee', 'payroll',
          'Payslip paid', `Your salary for ${payroll.month}/${payroll.year} has been paid.`,
          '/employee/payslips'
        );
      }
    } catch { /* notification failure should not block payment processing */ }

    res.status(200).json({ success: true, data: payroll, message: 'Payment processed.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
