import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { catchAsync } from '../utils/catchAsync';
import { allowedRolesToCreate } from '../utils/roles';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';
import { EmailService } from '../services/emailService';

const userService = new UserService();

export const getUsers = catchAsync(async (req: Request, res: Response) => {
    const { role } = req.query;
    const users = await userService.getUsers(role as Role | undefined);

    // Scrub sensitive data usually handled by repository/service but ensuring here for safety if not handled
    const sanitizedUsers = users.map(u => {
        const { password, ...rest } = u;
        return rest;
    });

    res.json({ users: sanitizedUsers });
});

export const createUser = catchAsync(async (req: Request, res: Response) => {
    const { email, password, name, address, documentType, documentNumber, role, company, biometricType } = req.body;
    const currentUser = res.locals.user;

    // Validate that the role is allowed to be created by the current user
    const allowedRoles = allowedRolesToCreate(currentUser.role);
    if (!allowedRoles.includes(role)) {
        throw new AppError(`You are not allowed to create users with role: ${role}`, 403);
    }

    const user = await userService.createUser({
        email,
        password,
        name,
        address,
        documentType,
        documentNumber,
        role,
        company,
        biometricType,
        createdById: currentUser.id
    });

    const portalUrl = process.env.CLIENT_URL || 'https://portal.newhorizonsimmigrationlaw.org';
    if (role === 'ADVISOR') {
        if (!password || !company) {
            throw new AppError('Advisor registration requires company and temporary password', 400);
        }

        const emailResult = await EmailService.sendAdvisorOnboardingEmail({
            email: user.email,
            name: user.name,
            tempPassword: password,
            company,
            portalUrl,
        });

        if (!emailResult) {
            console.error(`[users.createUser] Failed to send advisor onboarding email to ${user.email}`);
        }
    } else if (role === 'CLIENT') {
        const emailResult = await EmailService.sendClientRegistrationNotification({
            email: user.email,
            name: user.name,
            portalUrl,
        });

        if (!emailResult) {
            console.error(`[users.createUser] Failed to send client registration email to ${user.email}`);
        }
    } else {
        throw new AppError('Invalid role for onboarding email flow', 400);
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, role, address, documentType, documentNumber, company, biometricType } = req.body;

    const user = await userService.updateUser(id, {
        name,
        role,
        address,
        documentType,
        documentNumber,
        company,
        biometricType
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});
