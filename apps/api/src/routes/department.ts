import { Router } from 'express';
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', getAllDepartments); // public — needed for signup dept dropdown
router.post('/', protect, authorize('admin'), createDepartment);
router.put('/:id', protect, authorize('admin'), updateDepartment);
router.delete('/:id', protect, authorize('admin'), deleteDepartment);

export default router;
