import { Router } from 'express';
import { uploadFile, getMyUploads, getUploadById, updateUpload, deleteUpload, getAllUploads } from '../controllers/uploadController';
import { protect, authorize } from '../middleware/auth';

const router = Router();
router.use(protect as any);

router.post('/',        uploadFile);
router.get('/my',       getMyUploads);
router.get('/:id',      getUploadById);
router.put('/:id',      updateUpload);
router.delete('/:id',   deleteUpload);
router.get('/',         authorize('admin', 'manager') as any, getAllUploads);

export default router;
