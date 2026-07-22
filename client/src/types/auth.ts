export type DocumentType = 'CC' | 'DNI' | 'PASSPORT' | 'OTHER';

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'CLIENT' | 'ADMIN' | 'ADVISOR';
    address?: string;
    documentType?: DocumentType;
    documentNumber?: string;
    company?: string;
    biometricType?: 'OCULAR' | 'FACIAL' | 'DACTILAR';
    createdAt: string;
    updatedAt: string;
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
