import { Router } from 'express';
import { login, logout, getMe, changePassword, verifyClientData } from '../controllers/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import { clientVerificationSchema } from '../schemas/user.schema';
import { verifyAuth } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', validateRequest(loginSchema), login);
router.post('/client-verify', validateRequest(clientVerificationSchema), verifyClientData);
router.post('/logout', logout);
router.get('/me', getMe);

router.patch('/change-password', verifyAuth, validateRequest(changePasswordSchema), changePassword);

export default router;