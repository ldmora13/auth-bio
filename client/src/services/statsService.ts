import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export interface UserStats {
    totalUsers: number;
}

export interface DashboardStats {
    role: 'ADMIN' | 'ADVISOR';
    totals?: {
        totalCompanies: number;
        totalAdvisors: number;
        totalClients: number;
        globalBiometricCompletionRate: number;
        activationRate: number;
        keyProcessCompletionRate: number;
    };
    companyBreakdown?: Array<{
        companyId: string;
        companyName: string;
        advisors: number;
        clients: number;
        completionRate: number;
    }>;
    companyId?: string | null;
    ownClientCompletionRate?: number;
    weeklyClientActivity?: Array<{ day: string; createdCount: number }>;
    pendingProcesses?: number;
    ownClientsTotal?: number;
}

export const statsService = {
    getUserStats: async (): Promise<UserStats> => {
        const response = await axios.get(`${API_URL}/stats/users`, {
            withCredentials: true,
        });
        return response.data.stats;
    },

    getDashboardStats: async (): Promise<DashboardStats> => {
        const response = await axios.get(`${API_URL}/stats/dashboard`, {
            withCredentials: true,
        });
        return response.data.stats;
    },
};
