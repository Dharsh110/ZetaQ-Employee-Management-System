import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { createReport, getMyReports, getAllReports, updateReport, deleteReport, addReportComment } from '../controllers/dailyReportController';

const router = Router();

router.use(protect);

router.post('/',              createReport);
router.get('/mine',           getMyReports);
router.get('/',                authorize('admin', 'manager'), getAllReports);   // admin/manager: all reports with optional filters
router.put('/:id',            updateReport);
router.delete('/:id',         deleteReport);
router.post('/:id/comments',  authorize('admin', 'manager'), addReportComment);

export default router;
