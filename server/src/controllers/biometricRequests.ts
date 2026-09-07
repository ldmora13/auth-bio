import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { BiometricRequestLogService } from '../services/BiometricRequestLogService';

const biometricRequestLogService = new BiometricRequestLogService();

export const getBiometricRequests = catchAsync(async (req: Request, res: Response) => {
    const requests = await biometricRequestLogService.list();
    res.json({ requests });
});