import api from '../lib/api';

export interface BiometricRequestLogItem {
    id: string;
    emailSentAt: string;
    emailStatusCode: number | null;
    emailStatusMessage: string | null;
    resendEmailId: string | null;
    biometricMethods: string[];
    status: 'COMPLETED' | 'PENDING';
    client: { id: string; name: string; email: string; companyName: string | null };
    requestedBy: { id: string; name: string; email: string } | null;
}

export const BiometricRequestService = {
    getAll: async () => {
        const { data } = await api.get<{ requests: BiometricRequestLogItem[] }>('/biometric-requests');
        return data.requests;
    },
};