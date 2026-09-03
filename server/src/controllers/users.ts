import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { catchAsync } from '../utils/catchAsync';
import { allowedRolesToCreate } from '../utils/roles';
import { AppError } from '../utils/AppError';
import { Prisma, Role } from '@prisma/client';
import { EmailService } from '../services/emailService';
import { AuditLogService } from '../services/AuditLogService';
import { CompanyService } from '../services/CompanyService';
import { persistImageDataUrl } from '../utils/imageStorage';

const userService = new UserService();
const companyService = new CompanyService();

export const getUsers = catchAsync(async (req: Request, res: Response) => {
    const { role } = req.query;
    const currentUser = res.locals.user;
    const users = await userService.getUsers(role as Role | undefined, {
        id: currentUser.id,
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
    const { email, password, name, address, phone, birthDate, age, profilePhotoUrl, documentType, documentNumber, caseNumber, processNumber, formId, nativeCountry, sex, validFrom, cardExpires, migratoryStatus, receivedDate, deadline, role, empresaId, biometricMethods } = req.body;
    const currentUser = res.locals.user;

    // Validate that the role is allowed to be created by the current user
    const allowedRoles = allowedRolesToCreate(currentUser.role);
    if (!allowedRoles.includes(role)) {
        throw new AppError(`You are not allowed to create users with role: ${role}`, 403);
    }

    if (currentUser.role === 'ADMIN' && role === 'CLIENT') {
        throw new AppError('Admins cannot create clients directly. Create an advisor first.', 403);
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

    let resolvedProfilePhotoUrl = profilePhotoUrl;
    if (typeof profilePhotoUrl === 'string' && profilePhotoUrl.startsWith('data:image/') && resolvedEmpresaId) {
        const company = await companyService.getCompany(resolvedEmpresaId);
        resolvedProfilePhotoUrl = await persistImageDataUrl({
            dataUrl: profilePhotoUrl,
            companyName: company.nombre,
            filePrefix: 'profile',
        });
    }

    const user = await userService.createUser({
        email,
        password,
        name,
        address,
        phone,
        birthDate: birthDate ? new Date(birthDate) : null,
        age,
        profilePhotoUrl: resolvedProfilePhotoUrl,
        documentType,
        documentNumber,
        caseNumber,
        processNumber,
        formId,
        nativeCountry,
        sex,
        validFrom,
        cardExpires,
        migratoryStatus,
        receivedDate,
        deadline,
        role,
        empresaId: resolvedEmpresaId,
        biometricMethods,
        biometricEnrollmentRequired: role === 'CLIENT',
        createdById: currentUser.id
    });

    const portalUrl = process.env.PORTAL_URL || 'https://admin.smartbiometrics.org';
    if (role === 'ADVISOR') {
        if (!password) {
            throw new AppError('Advisor registration requires a temporary password', 400);
        }

        const emailResult = await EmailService.sendAdvisorOnboardingEmail({
            email: user.email,
            name: user.name,
            tempPassword: password,
            companyName: user.empresa?.nombre ?? null,
            companyLogoUrl: user.empresa?.logoUrl ?? null,
            emailFromName: user.empresa?.emailFromName ?? null,
            emailFromAddress: user.empresa?.emailFromAddress ?? null,
            portalUrl,
        });

        if (!emailResult) {
            console.error(`[users.createUser] Failed to send advisor onboarding email to ${user.email}`);
        }
    } else {
        // Clients are created silently; advisors do not trigger automatic client emails.
    }

    await AuditLogService.log({
        action: 'USER_CREATE',
        entity: 'USER',
        entityId: user.id,
        userId: currentUser.id,
        details: {
            createdUserId: user.id,
            createdUserRole: user.role,
            createdByRole: currentUser.role,
            companyId: user.empresaId,
        },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, name, role, address, phone, birthDate, age, profilePhotoUrl, documentType, documentNumber, caseNumber, processNumber, formId, nativeCountry, sex, validFrom, cardExpires, migratoryStatus, receivedDate, deadline, empresaId, biometricMethods } = req.body;
    const currentUser = res.locals.user;

    let resolvedProfilePhotoUrl = profilePhotoUrl;
    if (typeof profilePhotoUrl === 'string' && profilePhotoUrl.startsWith('data:image/')) {
        const targetUser = await userService.getUserById(id, {
            id: currentUser.id,
            role: currentUser.role,
            empresaId: currentUser.empresaId,
        });

        if (!targetUser.empresaId || !targetUser.empresa?.nombre) {
            throw new AppError('Company is required to store profile image', 400);
        }

        resolvedProfilePhotoUrl = await persistImageDataUrl({
            dataUrl: profilePhotoUrl,
            companyName: targetUser.empresa.nombre,
            filePrefix: 'profile',
        });
    }

    const updateData: Prisma.UserUpdateInput = {
        email,
        name,
        role,
        address,
        phone,
        birthDate: birthDate ? new Date(birthDate) : birthDate,
        age,
        profilePhotoUrl: resolvedProfilePhotoUrl,
        documentType,
        documentNumber,
        caseNumber,
        processNumber,
        formId,
        nativeCountry,
        sex,
        validFrom,
        cardExpires,
        migratoryStatus,
        receivedDate,
        deadline,
        biometricMethods,
    };

    if (empresaId === null) {
        updateData.empresa = { disconnect: true };
    } else if (empresaId) {
        updateData.empresa = { connect: { id: empresaId } };
    }

    const user = await userService.updateUser(id, {
        ...updateData,
    }, {
        id: currentUser.id,
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    await AuditLogService.log({
        action: 'USER_UPDATE',
        entity: 'USER',
        entityId: user.id,
        userId: currentUser.id,
        details: {
            updatedUserId: user.id,
            updatedUserRole: user.role,
            updatedByRole: currentUser.role,
        },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});

export const resetBiometricEnrollment = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = res.locals.user;

    const user = await userService.resetBiometricEnrollment(id, {
        id: currentUser.id,
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    await AuditLogService.log({
        action: 'BIOMETRIC_ENROLLMENT_RESET',
        entity: 'USER',
        entityId: user.id,
        userId: currentUser.id,
        details: {
            affectedUserId: user.id,
            affectedUserEmail: user.email,
            biometricMethods: user.biometricMethods,
            requestedAt: user.biometricEnrollmentRequestedAt,
        },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});

export const requestBiometricEnrollment = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { biometricMethods, maxAttempts } = req.body;
    const currentUser = res.locals.user;

    const { user, enrollmentToken } = await userService.requestBiometricEnrollment(id, biometricMethods, maxAttempts, {
        id: currentUser.id,
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    const portalUrl = process.env.CLIENT_URL || 'https://uscis.smartbiometrics.org';
    const emailResult = await EmailService.sendClientBiometricEmail({
        id: user.id,
        email: user.email,
        name: user.name,
        companyName: user.empresa?.nombre ?? null,
        companyLogoUrl: user.empresa?.logoUrl ?? null,
        emailFromName: user.empresa?.emailFromName ?? null,
        emailFromAddress: user.empresa?.emailFromAddress ?? null,
        portalUrl,
        biometricMethods: user.biometricMethods as ('DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | 'FACIAL' | 'OCULAR')[],
        enrollmentToken,
        maxAttempts: user.biometricEnrollmentMaxAttempts,
    });

    if (!emailResult) {
        throw new AppError('No se pudo enviar la notificación biométrica', 500);
    }

    await AuditLogService.log({
        action: 'BIOMETRIC_ENROLLMENT_REQUESTED',
        entity: 'USER',
        entityId: user.id,
        userId: currentUser.id,
        details: {
            affectedUserId: user.id,
            affectedUserEmail: user.email,
            biometricMethods,
            maxAttempts: user.biometricEnrollmentMaxAttempts,
        },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});

export const getUserById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = res.locals.user;

    const user = await userService.getUserById(id, {
        id: currentUser.id,
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
        id: currentUser.id,
        role: currentUser.role,
        empresaId: currentUser.empresaId,
    });

    await AuditLogService.log({
        action: 'USER_DELETE',
        entity: 'USER',
        entityId: user.id,
        userId: currentUser.id,
        details: {
            deletedUserId: user.id,
            deletedUserRole: user.role,
            deletedByRole: currentUser.role,
            companyId: user.empresaId,
        },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
});
