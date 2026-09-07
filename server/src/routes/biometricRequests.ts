import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { requireAdmin } from '../middlewares/roleMiddleware';
import { getBiometricRequests } from '../controllers/biometricRequests';

const router = Router();

router.use(verifyAuth);
router.get('/', requireAdmin, getBiometricRequests);

export default router;