import { Router } from 'express';
import { createTask, getAllTasks, getMyTasks, updateTask, submitTaskUpdate, addComment, deleteTask } from '../controllers/taskController';
import { protect, authorize } from '../middleware/auth';

const router = Router();
router.use(protect);

router.get('/my', getMyTasks);
router.put('/:id/submit', submitTaskUpdate);
router.post('/:id/comments', addComment);
router.get('/', authorize('admin', 'manager'), getAllTasks);
router.post('/', authorize('admin', 'manager'), createTask);
router.put('/:id', authorize('admin', 'manager'), updateTask);
router.delete('/:id', authorize('admin'), deleteTask);

export default router;
