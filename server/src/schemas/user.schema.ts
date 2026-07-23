import { z } from 'zod';
import { registry } from '../lib/openApi';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const createUserSchema = registry.register('CreateUser', z.object({
    body: z.object({
        email: z.string().email('Invalid email address').openapi({ example: 'newuser@example.com' }),
        password: z.string().min(6, 'Password must be at least 6 characters').optional().openapi({ example: 'TempPass123' }),
        name: z.string().min(1, 'Name is required').openapi({ example: 'Jane Doe' }),
        address: z.string().min(1, 'Address is required').openapi({ example: '123 Main St, Anytown, USA' }),
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).openapi({ example: 'CC' }),
        documentNumber: z.string().min(1, 'Document number is required').openapi({ example: '12345678' }),
        role: z.enum(['ADVISOR', 'CLIENT']).openapi({ example: 'CLIENT' }),
        // Conditional fields
        company: z.string().min(1, 'Company is required for advisors').optional(),
        biometricType: z.enum(['OCULAR', 'FACIAL', 'DACTILAR']).optional(),
    }).refine((data) => {
        if (data.role === 'ADVISOR' && !data.company) {
            return false;
        }
        return true;
    }, {
        message: 'Company is required for advisors',
        path: ['company'],
    }).refine((data) => {
        if (data.role === 'CLIENT' && !data.biometricType) {
            return false;
        }
        return true;
    }, {
        message: 'Biometric type is required for clients',
        path: ['biometricType'],
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
    }),
}));

export const updateUserSchema = registry.register('UpdateUser', z.object({
    body: z.object({
        name: z.string().min(1, 'Name is required').optional().openapi({ example: 'Jane Updated' }),
        role: z.enum(['ADMIN', 'ADVISOR', 'CLIENT']).optional().openapi({ example: 'ADVISOR' }),
        address: z.string().min(1, 'Address is required').optional().openapi({ example: '123 Main St, Anytown, USA' }),
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).optional().openapi({ example: 'CC' }),
        documentNumber: z.string().min(1, 'Document number is required').optional().openapi({ example: '12345678' }),
        company: z.string().min(1, 'Company is required for advisors').optional(),
        biometricType: z.enum(['OCULAR', 'FACIAL', 'DACTILAR']).optional(),
    }),
    params: z.object({
        id: z.string().openapi({ example: 'cm6...' }),
    }),
}));

export const getUsersSchema = registry.register('GetUsers', z.object({
    query: z.object({
        role: z.enum(['ADMIN', 'ADVISOR', 'CLIENT']).optional(),
    }),
}));

export const clientVerificationSchema = registry.register('ClientVerification', z.object({
    body: z.object({
        documentType: z.enum(['CC', 'DNI', 'PASSPORT', 'OTHER']).openapi({ example: 'CC' }),
        documentNumber: z.string().trim().regex(/^[0-9]+$/, 'Document number must contain only numbers').min(1, 'Document number is required').openapi({ example: '12345678' }),
    }),
}));
