import { Router } from 'express';
import { generatePayroll, getAllPayroll, getMyPayslips, processPayment } from '../controllers/payrollController';
import { protect, authorize } from '../middleware/auth';

const router = Router();
router.use(protect);

router.get('/my', getMyPayslips);
router.get('/', authorize('admin'), getAllPayroll);
router.post('/generate', authorize('admin'), generatePayroll);
router.put('/:id/pay', authorize('admin'), processPayment);

export default router;
