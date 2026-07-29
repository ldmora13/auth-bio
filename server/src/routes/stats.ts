import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { getDashboardStats, getUserStats } from '../controllers/stats';

const router = Router();

// All stats routes require authentication
router.use(verifyAuth);

router.get('/users', getUserStats);
router.get('/dashboard', getDashboardStats);

export default router;
