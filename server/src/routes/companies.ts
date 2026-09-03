import { Router } from 'express';
import { verifyAuth } from '../middlewares/authMiddleware';
import { requireAdmin } from '../middlewares/roleMiddleware';
import { validateRequest } from '../middlewares/validateRequest';
import { assignAdvisorSchema, createCompanySchema, unassignAdvisorSchema, updateCompanySchema } from '../schemas/user.schema';
import { assignAdvisor, createCompany, deleteCompany, getAvailableAdvisors, getCompanies, getCompany, getCompanyAuditLogs, unassignAdvisor, updateCompany } from '../controllers/companies';

const router = Router();

router.use(verifyAuth);

router.get('/', requireAdmin, getCompanies);
router.get('/available-advisors', requireAdmin, getAvailableAdvisors);
router.get('/:id/audit-logs', getCompanyAuditLogs);
router.get('/:id', getCompany);
router.post('/', requireAdmin, validateRequest(createCompanySchema), createCompany);
router.patch('/:id', requireAdmin, validateRequest(updateCompanySchema), updateCompany);
router.delete('/:id', requireAdmin, deleteCompany);
router.patch('/:id/advisors/:advisorId', requireAdmin, validateRequest(assignAdvisorSchema), assignAdvisor);
router.delete('/:id/advisors/:advisorId', requireAdmin, validateRequest(unassignAdvisorSchema), unassignAdvisor);

export default router;