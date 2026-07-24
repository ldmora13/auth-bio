import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { catchAsync } from '../utils/catchAsync';
import { allowedRolesToCreate } from '../utils/roles';
import { AppError } from '../utils/AppError';
import { Prisma, Role } from '@prisma/client';
import { EmailService } from '../services/emailService';

const userService = new UserService();

export const getUsers = catchAsync(async (req: Request, res: Response) => {
    const { role } = req.query;
    const currentUser = res.locals.user;
    const users = await userService.getUsers(role as Role | undefined, {
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    // Scrub sensitive data usually handled by repository/service but ensuring here for safety if not handled
    const sanitizedUsers = users.map(u => {
        const { password, ...rest } = u;
        return rest;
    });

    res.json({ users: sanitizedUsers });
});

export const createUser = catchAsync(async (req: Request, res: Response) => {
    const { email, password, name, address, documentType, documentNumber, role, empresaId, biometricType } = req.body;
    const currentUser = res.locals.user;

    // Validate that the role is allowed to be created by the current user
    const allowedRoles = allowedRolesToCreate(currentUser.role);
    if (!allowedRoles.includes(role)) {
        throw new AppError(`You are not allowed to create users with role: ${role}`, 403);
    }

    let resolvedEmpresaId: string | null = empresaId ?? null;

    if (role === 'CLIENT') {
        if (currentUser.role === 'ADVISOR') {
            if (!currentUser.empresaId) {
                throw new AppError('Advisor must belong to a company to create clients', 403);
            }

            resolvedEmpresaId = currentUser.empresaId;
        } else if (currentUser.role === 'ADMIN' && !resolvedEmpresaId) {
            throw new AppError('Company is required when an admin creates a client', 400);
        }
    }

    const user = await userService.createUser({
        email,
        password,
        name,
        address,
        documentType,
        documentNumber,
        role,
        empresaId: resolvedEmpresaId,
        biometricType,
        createdById: currentUser.id
    });

    const portalUrl = process.env.CLIENT_URL || 'https://portal.newhorizonsimmigrationlaw.org';
    if (role === 'ADVISOR') {
        if (!password) {
            throw new AppError('Advisor registration requires a temporary password', 400);
        }

        const emailResult = await EmailService.sendAdvisorOnboardingEmail({
            email: user.email,
            name: user.name,
            tempPassword: password,
            companyName: user.empresa?.nombre ?? null,
            portalUrl,
        });

        if (!emailResult) {
            console.error(`[users.createUser] Failed to send advisor onboarding email to ${user.email}`);
        }
    } else {
        // Clients are created silently; advisors do not trigger automatic client emails.
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, role, address, documentType, documentNumber, empresaId, biometricType } = req.body;
    const currentUser = res.locals.user;

    const updateData: Prisma.UserUpdateInput = {
        name,
        role,
        address,
        documentType,
        documentNumber,
        biometricType,
    };

    if (empresaId === null) {
        updateData.empresa = { disconnect: true };
    } else if (empresaId) {
        updateData.empresa = { connect: { id: empresaId } };
    }

    const user = await userService.updateUser(id, {
        ...updateData,
    }, {
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});

export const getUserById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = res.locals.user;

    const user = await userService.getUserById(id, {
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = res.locals.user;

    const user = await userService.deleteUser(id, {
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});
