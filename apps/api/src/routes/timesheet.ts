import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  saveDraft, getMyTimesheets, submitTimesheet, resubmitTimesheet,
  getAllTimesheets, approveTimesheet, rejectTimesheet, getTimesheetSummary,
} from '../controllers/timesheetController';

const router = Router();
router.use(protect);

// Employee
router.post('/', saveDraft);
router.get('/my', getMyTimesheets);
router.put('/:id/submit', submitTimesheet);
router.put('/:id/resubmit', resubmitTimesheet);

// Manager / Admin
router.get('/', authorize('admin', 'manager'), getAllTimesheets);
router.get('/summary', authorize('admin', 'manager'), getTimesheetSummary);
router.put('/:id/approve', authorize('admin', 'manager'), approveTimesheet);
router.put('/:id/reject', authorize('admin', 'manager'), rejectTimesheet);

export default router;
