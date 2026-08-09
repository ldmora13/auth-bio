import { Router } from 'express';
import { getUsers, createUser, updateUser, getUserById, deleteUser, resetBiometricEnrollment, requestBiometricEnrollment } from '../controllers/users';
import { loginAs } from '../controllers/loginAs';
import { verifyAuth } from '../middlewares/authMiddleware';
import { requireAdmin, requireAdminOrAdvisor, requireCanCreateUsers } from '../middlewares/roleMiddleware';
import { validateRequest } from '../middlewares/validateRequest';
import { createUserSchema, updateUserSchema, getUsersSchema, userIdParamSchema, resetBiometricEnrollmentSchema, requestBiometricEnrollmentSchema } from '../schemas/user.schema';

const router = Router();


router.use(verifyAuth);

router.get('/', requireAdminOrAdvisor, validateRequest(getUsersSchema), getUsers);

router.get('/:id', requireAdminOrAdvisor, validateRequest(userIdParamSchema), getUserById);

router.post('/', requireCanCreateUsers, validateRequest(createUserSchema), createUser);

router.patch('/:id', requireAdminOrAdvisor, validateRequest(updateUserSchema), updateUser);

router.patch('/:id/biometric-reset', requireAdminOrAdvisor, validateRequest(resetBiometricEnrollmentSchema), resetBiometricEnrollment);

router.post('/:id/biometric-request', requireAdminOrAdvisor, validateRequest(requestBiometricEnrollmentSchema), requestBiometricEnrollment);

router.delete('/:id', requireAdminOrAdvisor, validateRequest(userIdParamSchema), deleteUser);

router.post('/:userId/login-as', requireAdmin, loginAs);

export default router;