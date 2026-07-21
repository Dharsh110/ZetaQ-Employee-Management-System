import { Router } from 'express';
import { protect } from '../middleware/auth';
import { sendMessage, getMessages, markRead, deleteMessage } from '../controllers/messageController';

const router = Router();
router.use(protect);

router.post('/',           sendMessage);
router.get('/',            getMessages);
router.put('/:id/read',    markRead);
router.delete('/:id',      deleteMessage);

export default router;
