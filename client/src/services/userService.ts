import api from '../lib/api';
import type { BiometricMethod, DocumentType, Empresa, User } from '../types/auth';

export type { BiometricMethod } from '../types/auth';

export interface CreateUserData {
    email: string;
    password?: string;
    name: string;
    address: string;
    phone?: string;
    birthDate?: string;
    age?: number;
    profilePhotoUrl?: string;
    documentType: DocumentType;
    documentNumber: string;
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
    role: 'CLIENT' | 'ADVISOR';
    empresaId?: string;
    biometricMethods?: Array<'OCULAR' | 'FACIAL' | 'DACTILAR' | 'DACTILAR_REGISTRO' | 'DACTILAR_VERIFICACION'>;
}

export interface CreateCompanyData {
    nombre: string;
    nit: string;
    logoUrl: string;
    description: string;
    emailFromName: string;
    emailFromAddress: string;
}

export type UpdateCompanyData = Partial<CreateCompanyData>;

export interface CompanyListResponse {
    companies: Empresa[];
}

export interface CompanyDetailResponse {
    company: Empresa;
}

export interface CompanyAuditLog {
    id: number;
    action: string;
    entity: string;
    entityId: string;
    details: string | null;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
        role: 'CLIENT' | 'ADMIN' | 'ADVISOR';
    } | null;
}

export interface AvailableAdvisor {
    id: string;
    email: string;
    name: string;
    role: 'ADVISOR';
    empresaId: string | null;
    createdAt: string;
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

    update: async (id: string, updates: Partial<Pick<User, 'name' | 'role' | 'address' | 'phone' | 'birthDate' | 'age' | 'profilePhotoUrl' | 'documentType' | 'documentNumber' | 'caseNumber' | 'processNumber' | 'formId' | 'nativeCountry' | 'sex' | 'validFrom' | 'cardExpires' | 'migratoryStatus' | 'receivedDate' | 'deadline' | 'empresaId'>>) => {
        const { data } = await api.patch<{ user: User }>(`/users/${id}`, updates);
        return data.user;
    },

    requestBiometricEnrollment: async (id: string, biometricMethods: BiometricMethod[]) => {
        const { data } = await api.post<{ user: User }>(`/users/${id}/biometric-request`, { biometricMethods });
        return data.user;
    },

    remove: async (id: string) => {
        const { data } = await api.delete<{ user: User }>(`/users/${id}`);
        return data.user;
    },

    getCompanies: async () => {
        const { data } = await api.get<CompanyListResponse>('/companies');
        return data.companies;
    },

    getCompany: async (companyId: string) => {
        const { data } = await api.get<CompanyDetailResponse>(`/companies/${companyId}`);
        return data.company;
    },

    getCompanyAuditLogs: async (companyId: string) => {
        const { data } = await api.get<{ auditLogs: CompanyAuditLog[] }>(`/companies/${companyId}/audit-logs`);
        return data.auditLogs;
    },

    createCompany: async (companyData: CreateCompanyData) => {
        const { data } = await api.post<{ company: Empresa }>('/companies', companyData);
        return data.company;
    },

    updateCompany: async (companyId: string, companyData: UpdateCompanyData) => {
        const { data } = await api.patch<{ company: Empresa }>(`/companies/${companyId}`, companyData);
        return data.company;
    },

    deleteCompany: async (companyId: string) => {
        await api.delete(`/companies/${companyId}`);
    },

    getAvailableAdvisors: async () => {
        const { data } = await api.get<{ advisors: AvailableAdvisor[] }>('/companies/available-advisors');
        return data.advisors;
    },

    assignAdvisor: async (companyId: string, advisorId: string) => {
        const { data } = await api.patch<{ advisor: User }>(`/companies/${companyId}/advisors/${advisorId}`);
        return data.advisor;
    },

    unassignAdvisor: async (companyId: string, advisorId: string) => {
        const { data } = await api.delete<{ advisor: User }>(`/companies/${companyId}/advisors/${advisorId}`);
        return data.advisor;
    },

    loginAs: async (userId: string) => {
        const { data } = await api.post<{ user: User }>(`/users/${userId}/login-as`);
        return data.user;
    },

};
