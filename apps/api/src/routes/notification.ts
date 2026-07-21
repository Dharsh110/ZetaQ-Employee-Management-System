import { Router } from 'express';
import { protect } from '../middleware/auth';
import { getMyNotifications, markAsRead, markAllRead, deleteNotification } from '../controllers/notificationController';

const router = Router();
router.use(protect);

router.get('/',              getMyNotifications);
router.put('/read-all',      markAllRead);
router.put('/:id/read',      markAsRead);
router.delete('/:id',        deleteNotification);

export default router;
