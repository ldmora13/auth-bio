export type DocumentType = 'CC' | 'DNI' | 'PASSPORT' | 'OTHER';

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'CLIENT' | 'ADMIN' | 'ADVISOR';
    address?: string;
    documentType?: DocumentType;
    documentNumber?: string;
    empresaId?: string | null;
    empresa?: {
        id: string;
        nombre: string;
    } | null;
    biometricType?: 'OCULAR' | 'FACIAL' | 'DACTILAR';
    createdAt: string;
    updatedAt: string;
}

export interface Empresa {
    id: string;
    nombre: string;
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
