import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

export interface UserStats {
    totalUsers: number;
}

export const statsService = {
    getUserStats: async (): Promise<UserStats> => {
        const response = await axios.get(`${API_URL}/stats/users`, {
            withCredentials: true,
        });
        return response.data.stats;
    },
};
