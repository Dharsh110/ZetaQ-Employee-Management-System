import { Router } from 'express';
import { login, getMe, forgotPassword, resetPassword, changePassword, logout /*, googleCallback */ } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

// Public self-registration is intentionally not exposed — accounts are provisioned
// by an admin (see POST /employees) and log in with the credentials they're given.
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/logout', protect, logout);

// Google OAuth temporarily disabled — uncomment to re-enable (frontend sends { googleId, email, name })
// router.post('/google', googleCallback);

export default router;
