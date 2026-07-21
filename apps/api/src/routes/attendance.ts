import { Router } from 'express';
import { checkIn, checkOut, getMyAttendance, getTodayAttendance, getMonthlyReport, getAllAttendanceRecords, markAttendance } from '../controllers/attendanceController';
import { protect, authorize } from '../middleware/auth';

const router = Router();
router.use(protect);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/my', getMyAttendance);
router.get('/today', authorize('admin', 'manager'), getTodayAttendance);
router.get('/monthly-report', authorize('admin', 'manager'), getMonthlyReport);
router.get('/records', authorize('admin', 'manager'), getAllAttendanceRecords);
router.post('/mark', authorize('admin', 'manager'), markAttendance);

export default router;
