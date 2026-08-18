import { z } from 'zod';
import { registry } from '../lib/openApi';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

const profilePhotoInputSchema = z.string().trim().refine((value) => {
    return value.startsWith('data:image/') || value.startsWith('/');
}, {
    message: 'Profile photo must be a valid image data URL or stored path',
});

export const createUserSchema = registry.register('CreateUser', z.object({
    body: z.object({
        email: z.string().email('Invalid email address').openapi({ example: 'newuser@example.com' }),
        password: z.string().min(6, 'Password must be at least 6 characters').optional().openapi({ example: 'TempPass123' }),
        name: z.string().min(1, 'Name is required').openapi({ example: 'Jane Doe' }),
        address: z.string().min(1, 'Address is required').openapi({ example: '123 Main St, Anytown, USA' }),
        phone: z.string().trim().regex(/^\+?[0-9\s()-]{7,20}$/, 'Phone format is invalid').optional().openapi({ example: '+57 300 123 4567' }),
        birthDate: z.string().date().optional().openapi({ example: '1990-08-25' }),
        age: z.number().int().min(18, 'Client must be at least 18 years old').max(120).optional().openapi({ example: 33 }),
        profilePhotoUrl: z.string().trim().startsWith('data:image/', 'Profile photo must be a valid image data URL').optional(),
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).openapi({ example: 'CC' }),
        documentNumber: z.string().min(1, 'Document number is required').openapi({ example: '12345678' }),
        role: z.enum(['ADVISOR', 'CLIENT']).openapi({ example: 'CLIENT' }),
        empresaId: z.string().uuid().optional().openapi({ example: 'cuid-or-uuid' }),
        biometricMethods: z.array(z.enum(['OCULAR', 'FACIAL', 'DACTILAR'])).optional(),
    }).refine((data) => {
        if (data.role === 'CLIENT' && (!data.biometricMethods || data.biometricMethods.length === 0)) {
            return false;
        }
        return true;
    }, {
        message: 'At least one biometric method is required for clients',
        path: ['biometricMethods'],
    }).refine((data) => {
        if (data.role === 'CLIENT' && !data.biometricMethods?.includes('DACTILAR')) {
            return false;
        }
        return true;
    }, {
        message: 'Fingerprint enrollment is mandatory for clients',
        path: ['biometricMethods'],
    }).refine((data) => {
        if (data.role === 'ADVISOR' && !data.password) {
            return false;
        }
        return true;
    }, {
        message: 'Password is required for advisors',
        path: ['password'],
    }).refine((data) => {
        if (data.role === 'CLIENT' && data.password) {
            return false;
        }
        return true;
    }, {
        message: 'Password must not be provided for clients',
        path: ['password'],
    }).refine((data) => {
        if (data.role === 'CLIENT' && (!data.phone || !data.birthDate || data.age == null || !data.profilePhotoUrl)) {
            return false;
        }
        return true;
    }, {
        message: 'Clients require phone, birthDate, age and profile photo',
        path: ['role'],
    }).refine((data) => {
        if (data.role === 'CLIENT' && data.profilePhotoUrl) {
            return data.profilePhotoUrl.length <= 2_800_000;
        }
        return true;
    }, {
        message: 'Profile photo exceeds the allowed size',
        path: ['profilePhotoUrl'],
    }),
}));

export const updateUserSchema = registry.register('UpdateUser', z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').optional().openapi({ example: 'Jane Updated' }),
        role: z.enum(['ADMIN', 'ADVISOR', 'CLIENT']).optional().openapi({ example: 'ADVISOR' }),
        address: z.string().min(1, 'Address is required').optional().openapi({ example: '123 Main St, Anytown, USA' }),
        phone: z.string().trim().regex(/^\+?[0-9\s()-]{7,20}$/, 'Phone format is invalid').optional(),
        birthDate: z.string().date().nullable().optional(),
        age: z.number().int().min(18).max(120).nullable().optional(),
        profilePhotoUrl: profilePhotoInputSchema.nullable().optional(),
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).optional().openapi({ example: 'CC' }),
        documentNumber: z.string().min(1, 'Document number is required').optional().openapi({ example: '12345678' }),
        empresaId: z.string().uuid().nullable().optional().openapi({ example: 'cuid-or-uuid' }),
        biometricMethods: z.array(z.enum(['OCULAR', 'FACIAL', 'DACTILAR'])).optional(),
    }),
    params: z.object({
        id: z.string().openapi({ example: 'cm6...' }),
    }),
}));

export const completeBiometricEnrollmentSchema = registry.register('CompleteBiometricEnrollment', z.object({
    body: z.object({
        completedMethods: z.array(z.enum(['OCULAR', 'FACIAL', 'DACTILAR'])).min(1, 'At least one biometric method is required'),
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).optional(),
        documentNumber: z.string().min(1).optional(),
        clientId: z.string().uuid().optional(), // NUEVO
    }),
}));

export const resetBiometricEnrollmentSchema = registry.register('ResetBiometricEnrollment', z.object({
    params: z.object({
        id: z.string().openapi({ example: 'cm6...' }),
    }),
}));

export const requestBiometricEnrollmentSchema = registry.register('RequestBiometricEnrollment', z.object({
    params: z.object({
        id: z.string().openapi({ example: 'cm6...' }),
    }),
    body: z.object({
        biometricMethods: z.array(z.enum(['OCULAR', 'FACIAL', 'DACTILAR'])).min(1, 'At least one biometric method is required'),
    }),
}));

export const getUsersSchema = registry.register('GetUsers', z.object({
    query: z.object({
        role: z.enum(['ADMIN', 'ADVISOR', 'CLIENT']).optional(),
    }),
}));

export const userIdParamSchema = registry.register('UserIdParam', z.object({
    params: z.object({
        id: z.string().openapi({ example: 'cm6...' }),
    }),
}));

export const createCompanySchema = registry.register('CreateCompany', z.object({
    body: z.object({
        nombre: z.string().min(1, 'Company legal name is required').max(180).openapi({ example: 'Alpha Consulting SAS' }),
        nit: z.string().trim().regex(/^[0-9]{8,15}(-[0-9])?$/, 'NIT format is invalid').openapi({ example: '900123456-7' }),
        logoUrl: z.string().trim().startsWith('data:image/', 'Logo must be a valid image data URL').openapi({ example: 'data:image/png;base64,...' }),
        description: z.string().trim().min(1, 'Description is required').max(1000, 'Description must be 1000 characters or fewer').openapi({ example: 'Corporate profile and business purpose.' }),
    }).refine((data) => data.logoUrl.length <= 7_000_000, {
        message: 'Logo exceeds 5MB limit',
        path: ['logoUrl'],
    }),
}));

export const assignAdvisorSchema = registry.register('AssignAdvisor', z.object({
    params: z.object({
        id: z.string().openapi({ example: 'cuid-or-uuid' }),
        advisorId: z.string().openapi({ example: 'cuid-or-uuid' }),
    }),
}));

export const unassignAdvisorSchema = registry.register('UnassignAdvisor', z.object({
    params: z.object({
        id: z.string().openapi({ example: 'cuid-or-uuid' }),
        advisorId: z.string().openapi({ example: 'cuid-or-uuid' }),
    }),
}));

export const clientVerificationSchema = registry.register('ClientVerification', z.object({
    body: z.object({
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).openapi({ example: 'CC' }),
        documentNumber: z.string().trim().regex(/^[0-9]+$/, 'Document number must contain only numbers').min(1, 'Document number is required').openapi({ example: '12345678' }),
    }),
}));
