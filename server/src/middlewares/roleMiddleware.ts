import { Request, Response, NextFunction } from 'express';
import { canListUsersForStaff, canCreateUsers } from '../utils/roles';

/** Only ADMIN — user update, impersonation. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
};

/** ADMIN or ADVISOR — GET /users for listing users. */
export const requireAdminOrAdvisor = (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!canListUsersForStaff(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Admin or Advisor access required' });
    }

    next();
};

/** ADMIN or ADVISOR — can create users. */
export const requireCanCreateUsers = (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!canCreateUsers(user.role)) {
        return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    next();
};
