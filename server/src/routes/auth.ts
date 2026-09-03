import { Router } from 'express';
import { login, logout, getMe, changePassword, verifyClientData, completeBiometricEnrollment, getClientById, accessBiometricEnrollment, startBiometricEnrollmentAttempt } from '../controllers/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import { clientVerificationSchema, completeBiometricEnrollmentSchema, biometricEnrollmentTokenSchema, startBiometricEnrollmentAttemptSchema } from '../schemas/user.schema';
import { verifyAuth } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', validateRequest(loginSchema), login);
router.post('/client-verify', validateRequest(clientVerificationSchema), verifyClientData);
router.get('/client/:id', getClientById);
router.get('/biometric-enrollment/access/:token', validateRequest(biometricEnrollmentTokenSchema), accessBiometricEnrollment);
router.post('/biometric-enrollment/attempt', validateRequest(startBiometricEnrollmentAttemptSchema), startBiometricEnrollmentAttempt);
router.post('/biometric-enrollment/complete', validateRequest(completeBiometricEnrollmentSchema), completeBiometricEnrollment);
router.post('/logout', logout);
router.get('/me', getMe);

router.patch('/change-password', verifyAuth, validateRequest(changePasswordSchema), changePassword);

export default router;
