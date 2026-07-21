import { Router } from 'express';
import authRoutes from './auth';
import employeeRoutes from './employee';
import attendanceRoutes from './attendance';
import leaveRoutes from './leave';
import taskRoutes from './task';
import payrollRoutes from './payroll';
import departmentRoutes from './department';
import calendarRoutes from './calendar';
import reportRoutes from './reports';
import dailyReportRoutes from './dailyReport';
import messageRoutes from './message';
import notificationRoutes from './notification';
import uploadRoutes from './upload';
import timesheetRoutes from './timesheet';

const router = Router();

router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/tasks', taskRoutes);
router.use('/payroll', payrollRoutes);
router.use('/departments', departmentRoutes);
router.use('/calendar', calendarRoutes);
router.use('/reports', reportRoutes);
router.use('/daily-reports', dailyReportRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/uploads', uploadRoutes);
router.use('/timesheets', timesheetRoutes);

export default router;
