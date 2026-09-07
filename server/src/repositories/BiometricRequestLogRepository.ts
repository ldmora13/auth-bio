import { db } from '../lib/db';

export class BiometricRequestLogRepository {
    async create(data: {
        userId: string;
        requestedById?: string | null;
        biometricMethods: string[];
        emailStatusCode: number;
        emailStatusMessage?: string | null;
        resendEmailId?: string | null;
    }) {
        return db.biometricRequestLog.create({
            data: {
                userId: data.userId,
                requestedById: data.requestedById ?? null,
                biometricMethods: data.biometricMethods,
                emailStatusCode: data.emailStatusCode,
                emailStatusMessage: data.emailStatusMessage ?? null,
                resendEmailId: data.resendEmailId ?? null,
            },
        });
    }

    async findAll() {
        return db.biometricRequestLog.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        empresa: {
                            select: {
                                nombre: true,
                            },
                        },
                        biometricEnrollmentRequired: true,
                        biometricEnrollmentCompletedAt: true,
                    },
                },
                requestedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { emailSentAt: 'desc' },
        });
    }
}