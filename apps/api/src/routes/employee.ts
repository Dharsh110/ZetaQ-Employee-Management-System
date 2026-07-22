import { Router } from 'express';
import { getAllEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, getMyProfile, updateMyProfile, getDashboardStats } from '../controllers/employeeController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.use(protect);
router.get('/me/profile', getMyProfile);
router.put('/me/profile', updateMyProfile);
router.get('/stats', authorize('admin', 'manager'), getDashboardStats);
router.get('/', authorize('admin', 'manager'), getAllEmployees);
router.get('/:id', authorize('admin', 'manager'), getEmployee);
router.post('/', authorize('admin'), createEmployee);
router.put('/:id', authorize('admin', 'manager'), updateEmployee);
router.delete('/:id', authorize('admin'), deleteEmployee);

export default router;
