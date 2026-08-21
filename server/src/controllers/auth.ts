import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { catchAsync } from '../utils/catchAsync';
import { lucia } from '../lib/auth';
import { AuditLogService } from '../services/AuditLogService';
import { db } from '../lib/db';
import { verify, hash } from '@node-rs/argon2';
import { AppError } from '../utils/AppError';
import { UserService } from '../services/UserService';
import { EmailService } from '../services/emailService';

const authService = new AuthService();
const userService = new UserService();

const maskDocumentNumber = (documentNumber: string) => {
    const trimmed = documentNumber.trim();
    if (trimmed.length <= 4) {
        return trimmed;
    }

    return `${'*'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
};

export const signup = catchAsync(async (req: Request, res: Response) => {
    const { email, password, name, role } = req.body;

    const { user, sessionCookie } = await authService.signup({
        email,
        password,
        name,
        role
    });

    res.setHeader("Set-Cookie", sessionCookie.serialize());
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
});

export const login = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const { user, sessionCookie } = await authService.login({ email, password });

    await AuditLogService.log({
        action: 'LOGIN',
        entity: 'USER',
        entityId: user.id,
        userId: user.id
    });

    res.setHeader("Set-Cookie", sessionCookie.serialize());
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
});

export const verifyClientData = catchAsync(async (req: Request, res: Response) => {
    const { documentType, documentNumber } = req.body;
    const normalizedDocumentNumber = documentNumber.trim();
    const maskedDocumentNumber = maskDocumentNumber(normalizedDocumentNumber);

    const user = await userService.findClientByDocument(documentType, normalizedDocumentNumber);

    if (!user) {
        await AuditLogService.log({
            action: 'CLIENT_DATA_VERIFICATION_FAILED',
            entity: 'DOCUMENT',
            entityId: `${documentType}:${maskedDocumentNumber}`,
            userId: null,
            details: {
                documentType,
                documentNumber: maskedDocumentNumber,
                outcome: 'NOT_FOUND',
            },
        });

        throw new AppError('No encontramos un cliente con esos datos. Revisa el tipo y el número de documento.', 404);
    }

    const { password: _, ...userWithoutPassword } = user;

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    res.setHeader('Set-Cookie', sessionCookie.serialize());

    await AuditLogService.log({
        action: 'CLIENT_DATA_VERIFICATION_SUCCESS',
        entity: 'USER',
        entityId: user.id,
        userId: user.id,
        details: {
            documentType,
            documentNumber: maskedDocumentNumber,
            outcome: 'MATCHED',
        },
    });

    res.status(200).json({ user: userWithoutPassword });
});

export const getClientById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    if (user.role !== 'CLIENT') {
        throw new AppError('Client not found', 404);
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
});

export const completeBiometricEnrollment = catchAsync(async (req: Request, res: Response) => {
    const { completedMethods, documentType, documentNumber, clientId } = req.body;
    const bearerSessionId = lucia.readBearerToken(req.headers.authorization ?? "");
    const cookieSessionId = req.cookies.auth_session as string | undefined;

    let currentUserId: string | null = null;
    let resolvedVia: 'bearer' | 'document' | 'clientId' | 'cookie' | null = null;

    if (bearerSessionId) {
        const { session, user } = await lucia.validateSession(bearerSessionId);
        if (session && user?.role === 'CLIENT') {
            currentUserId = user.id;
            resolvedVia = 'bearer';
        }
    }

    if (!currentUserId && documentType && documentNumber) {
        const normalizedDocumentNumber = documentNumber.trim();
        const user = await userService.findClientByDocument(documentType, normalizedDocumentNumber);
        if (user) {
            currentUserId = user.id;
            resolvedVia = 'document';
        }
    }

    if (!currentUserId && clientId) {
        const user = await userService.getUserById(clientId).catch(() => null);
        if (user && user.role === 'CLIENT') {
            currentUserId = user.id;
            resolvedVia = 'clientId';
        }
    }

    if (!currentUserId && cookieSessionId) {
        const { session, user } = await lucia.validateSession(cookieSessionId);
        if (session && user?.role === 'CLIENT') {
            currentUserId = user.id;
            resolvedVia = 'cookie';
        } else if (session && user && user.role !== 'CLIENT') {
            console.warn(
                `[completeBiometricEnrollment] Cookie de sesión pertenece a rol=${user.role} userId=${user.id}; ignorada para este endpoint de cliente.`
            );
        }
    }

    if (currentUserId && clientId && resolvedVia !== 'clientId' && currentUserId !== clientId) {
        throw new AppError('Session/client identity mismatch', 409);
    }

    if (!currentUserId) {
        throw new AppError('Unauthorized', 401);
    }

    const user = await userService.completeBiometricEnrollment(currentUserId, completedMethods);

    await AuditLogService.log({
        action: 'BIOMETRIC_ENROLLMENT_COMPLETED',
        entity: 'USER',
        entityId: user.id,
        userId: user.id,
        details: {
            completedMethods: user.biometricMethods,
            completedAt: user.biometricEnrollmentCompletedAt,
            resolvedVia, // trazabilidad para auditoría futura
        },
    });

    const emailResult = await EmailService.sendBiometricEnrollmentCompletedEmail({
        email: user.email,
        name: user.name,
        companyName: user.empresa?.nombre ?? null,
        biometricMethods: user.biometricMethods as ('DACTILAR' | 'FACIAL' | 'OCULAR')[],
        completedAt: user.biometricEnrollmentCompletedAt,
    });

    if (!emailResult) {
        console.warn(`[completeBiometricEnrollment] No se pudo enviar la confirmación a ${user.email}`);
    }

    const { password: __, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
    const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");

    if (!sessionId) {
        res.status(200).send();
        return;
    }

    const sessionCookie = await authService.logout(sessionId);
    res.setHeader("Set-Cookie", sessionCookie.serialize());
    res.status(200).send();
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
    const cookieHeader = req.headers.cookie ?? "";
    const sessionId = lucia.readSessionCookie(cookieHeader);

    if (!sessionId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { session, user } = await authService.validateSession(sessionId);

    if (!session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        res.setHeader("Set-Cookie", sessionCookie.serialize());
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    if (session.fresh) {
        const sessionCookie = lucia.createSessionCookie(session.id);
        res.setHeader("Set-Cookie", sessionCookie.serialize());
    }

    const fullUser = await db.user.findUnique({
        where: { id: user.id },
        include: { empresa: true }
    });

    if (!fullUser) {
        const sessionCookie = lucia.createBlankSessionCookie();
        res.setHeader("Set-Cookie", sessionCookie.serialize());
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { password: _, ...userWithoutPassword } = fullUser as any;
    res.status(200).json({ user: userWithoutPassword });
});

// Endpoint para cambio de contraseña
export const changePassword = catchAsync(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const user = res.locals.user;

    if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
        throw new AppError('New password must be at least 8 characters', 400);
    }

    if (!/[A-Z]/.test(newPassword)) {
        throw new AppError('New password must contain at least one uppercase letter', 400);
    }

    if (!/[0-9]/.test(newPassword)) {
        throw new AppError('New password must contain at least one number', 400);
    }

    // Obtener el usuario completo (con contraseña) desde la DB
    const fullUser = await db.user.findUnique({ where: { id: user.id } });
    if (!fullUser) {
        throw new AppError('User not found', 404);
    }

    if (!fullUser.password) {
        throw new AppError('This account does not have a local password configured', 400);
    }

    // Verificar contraseña actual
    const validPassword = await verify(fullUser.password, currentPassword);
    if (!validPassword) {
        throw new AppError('Current password is incorrect', 400);
    }

    // No permitir la misma contraseña
    const samePassword = await verify(fullUser.password, newPassword);
    if (samePassword) {
        throw new AppError('New password must be different from current password', 400);
    }

    const hashedPassword = await hash(newPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });

    await db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
    });

    // Invalidar todas las sesiones del usuario (seguridad)
    await lucia.invalidateUserSessions(user.id);

    // Crear nueva sesión para que no se cierre la sesión actual
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    res.setHeader("Set-Cookie", sessionCookie.serialize());

    await AuditLogService.log({
        action: 'CHANGE_PASSWORD',
        entity: 'USER',
        entityId: user.id,
        userId: user.id
    });

    res.status(200).json({ message: 'Password changed successfully' });
});