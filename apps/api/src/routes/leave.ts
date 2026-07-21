import { Router } from 'express';
import { applyLeave, getMyLeaves, getAllLeaves, updateLeaveStatus, cancelLeave } from '../controllers/leaveController';
import { protect, authorize } from '../middleware/auth';

const router = Router();
router.use(protect);

router.post('/', applyLeave);
router.get('/my', getMyLeaves);
router.delete('/:id/cancel', cancelLeave);
router.get('/', authorize('admin', 'manager'), getAllLeaves);
router.put('/:id/status', authorize('admin', 'manager'), updateLeaveStatus);

export default router;
