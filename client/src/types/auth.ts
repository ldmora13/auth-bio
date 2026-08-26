export type DocumentType = 'CC' | 'DNI' | 'PASSPORT' | 'OTHER';
export type BiometricMethod = 'DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION' | 'FACIAL' | 'OCULAR';

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'CLIENT' | 'ADMIN' | 'ADVISOR';
    address?: string;
    phone?: string;
    birthDate?: string;
    age?: number;
    profilePhotoUrl?: string;
    documentType?: DocumentType;
    documentNumber?: string;
    caseNumber?: string;
    processNumber?: string;
    formId?: string;
    nativeCountry?: string;
    sex?: string;
    validFrom?: string;
    cardExpires?: string;
    migratoryStatus?: string;
    receivedDate?: string;
    deadline?: string;
    biometricType?: BiometricMethod | null;
    biometricMethods?: BiometricMethod[];
    biometricEnrollmentRequired?: boolean;
    biometricEnrollmentRequestedAt?: string | null;
    biometricEnrollmentCompletedAt?: string | null;
    createdById?: string | null;
    empresaId?: string | null;
    empresa?: {
        id: string;
        nombre: string;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface Empresa {
    id: string;
    nombre: string;
    nit?: string;
    logoUrl?: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    advisorCount?: number;
    clientCount?: number;
    advisors?: User[];
    clients?: User[];
}

export interface AuthResponse {
    user: User;
}

export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

export interface ErrorResponse {
    error: string;
}
