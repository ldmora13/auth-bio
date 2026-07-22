import { Request, Response } from 'express';
import { db } from '../lib/db';
import { catchAsync } from '../utils/catchAsync';

export const getUserStats = catchAsync(async (req: Request, res: Response) => {
    const totalUsers = await db.user.count();
    res.json({
        stats: { totalUsers }
    });
});
