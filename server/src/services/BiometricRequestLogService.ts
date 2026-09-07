import { BiometricRequestLogRepository } from '../repositories/BiometricRequestLogRepository';

export interface BiometricRequestLogEntry {
    id: string;
    emailSentAt: Date;
    emailStatusCode: number | null;
    emailStatusMessage: string | null;
    resendEmailId: string | null;
    biometricMethods: string[];
    status: 'COMPLETED' | 'PENDING';
    client: { id: string; name: string; email: string; companyName: string | null };
    requestedBy: { id: string; name: string; email: string } | null;
}

export class BiometricRequestLogService {
    private repository: BiometricRequestLogRepository;

    constructor() {
        this.repository = new BiometricRequestLogRepository();
    }

    async log(input: {
        userId: string;
        requestedById?: string | null;
        biometricMethods: string[];
        emailStatusCode: number;
        emailStatusMessage?: string | null;
        resendEmailId?: string | null;
    }) {
        return this.repository.create(input);
    }

    async list(): Promise<BiometricRequestLogEntry[]> {
        const logs = await this.repository.findAll();

        return logs.map((log) => {
            const completedAt = log.user.biometricEnrollmentCompletedAt;
            const isCompleted = Boolean(completedAt && completedAt.getTime() >= log.emailSentAt.getTime());

            return {
                id: log.id,
                emailSentAt: log.emailSentAt,
                emailStatusCode: log.emailStatusCode,
                emailStatusMessage: log.emailStatusMessage,
                resendEmailId: log.resendEmailId,
                biometricMethods: log.biometricMethods,
                status: isCompleted ? 'COMPLETED' : 'PENDING',
                client: {
                    id: log.user.id,
                    name: log.user.name,
                    email: log.user.email,
                    companyName: log.user.empresa?.nombre ?? null,
                },
                requestedBy: log.requestedBy
                    ? { id: log.requestedBy.id, name: log.requestedBy.name, email: log.requestedBy.email }
                    : null,
            };
        });
    }
}