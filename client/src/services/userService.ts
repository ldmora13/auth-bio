import api from '../lib/api';
import type { DocumentType, User } from '../types/auth';

export interface CreateUserData {
    email: string;
    password?: string;
    name: string;
    address: string;
    documentType: DocumentType;
    documentNumber: string;
    role: 'CLIENT' | 'ADVISOR';
    company?: string;
    biometricType?: 'OCULAR' | 'FACIAL' | 'DACTILAR';
}

export const UserService = {
    getAll: async (role?: 'CLIENT' | 'ADMIN' | 'ADVISOR') => {
        const params = role ? { role } : {};
        const { data } = await api.get<{ users: User[] }>('/users', { params });
        return data.users;
    },

    create: async (userData: CreateUserData) => {
        const { data } = await api.post<{ user: User }>('/users', userData);
        return data.user;
    },

    update: async (id: string, updates: Partial<Pick<User, 'name' | 'role' | 'address' | 'documentType' | 'documentNumber' | 'company' | 'biometricType'>>) => {
        const { data } = await api.patch<{ user: User }>(`/users/${id}`, updates);
        return data.user;
    },

    loginAs: async (userId: string) => {
        const { data } = await api.post<{ user: User }>(`/users/${userId}/login-as`);
        return data.user;
    },
};