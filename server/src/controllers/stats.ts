import { Request, Response } from 'express';
import { db } from '../lib/db';
import { catchAsync } from '../utils/catchAsync';

export const getUserStats = catchAsync(async (req: Request, res: Response) => {
    const currentUser = res.locals.user;
    const totalUsers = currentUser.role === 'ADVISOR' && currentUser.empresaId
        ? await db.user.count({ where: { empresaId: currentUser.empresaId, role: 'CLIENT' } })
        : await db.user.count();
    res.json({
        stats: { totalUsers }
    });
});
