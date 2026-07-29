import { Request, Response } from 'express';
import { db } from '../lib/db';
import { catchAsync } from '../utils/catchAsync';

export const getUserStats = catchAsync(async (req: Request, res: Response) => {
    const currentUser = res.locals.user;
    const totalUsers = currentUser.role === 'ADVISOR' && currentUser.empresaId
        ? await db.user.count({ where: { empresaId: currentUser.empresaId, role: 'CLIENT' } })
        : await db.user.count();
    res.json({
        stats: { totalUsers }
    });
});

export const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
    const currentUser = res.locals.user;

    if (currentUser.role === 'ADMIN') {
        const companies = await db.empresa.findMany({
            include: {
                users: {
                    select: {
                        id: true,
                        role: true,
                        createdById: true,
                        biometricEnrollmentRequired: true,
                        biometricEnrollmentCompletedAt: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalCompanies = companies.length;
        const companyBreakdown = companies.map((company) => {
            const advisors = company.users.filter((user) => user.role === 'ADVISOR').length;
            const clients = company.users.filter((user) => user.role === 'CLIENT').length;

            return {
                companyId: company.id,
                companyName: company.nombre,
                advisors,
                clients,
                completionRate: clients === 0
                    ? 0
                    : Math.round((company.users.filter((user) => user.role === 'CLIENT' && !user.biometricEnrollmentRequired).length / clients) * 100),
            };
        });

        const totalAdvisors = companyBreakdown.reduce((sum, item) => sum + item.advisors, 0);
        const totalClients = companyBreakdown.reduce((sum, item) => sum + item.clients, 0);
        const completedClients = companies
            .flatMap((company) => company.users)
            .filter((user) => user.role === 'CLIENT' && !user.biometricEnrollmentRequired).length;

        const activatedCompanies = companyBreakdown.filter((item) => item.advisors > 0 && item.clients > 0).length;
        const globalBiometricCompletionRate = totalClients === 0 ? 0 : Math.round((completedClients / totalClients) * 100);
        const activationRate = totalCompanies === 0 ? 0 : Math.round((activatedCompanies / totalCompanies) * 100);
        const keyProcessCompletionRate = totalCompanies === 0
            ? 0
            : Math.round((companyBreakdown.reduce((sum, item) => sum + item.completionRate, 0) / totalCompanies));

        res.json({
            stats: {
                role: 'ADMIN',
                totals: {
                    totalCompanies,
                    totalAdvisors,
                    totalClients,
                    globalBiometricCompletionRate,
                    activationRate,
                    keyProcessCompletionRate,
                },
                companyBreakdown,
            },
        });
        return;
    }

    const empresaId = currentUser.empresaId;
    if (!empresaId) {
        res.json({
            stats: {
                role: 'ADVISOR',
                companyId: null,
                ownClientCompletionRate: 0,
                weeklyClientActivity: [],
                pendingProcesses: 0,
                ownClientsTotal: 0,
            },
        });
        return;
    }

    const ownClients = await db.user.findMany({
        where: {
            role: 'CLIENT',
            empresaId,
            createdById: currentUser.id,
        },
        select: {
            id: true,
            createdAt: true,
            biometricEnrollmentRequired: true,
        },
    });

    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyClientActivity = Array.from({ length: 7 }).map((_, offset) => {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - offset));
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const createdCount = ownClients.filter((client) => client.createdAt >= date && client.createdAt < nextDate).length;
        return {
            day: dayNames[date.getDay()],
            createdCount,
        };
    });

    const ownClientsTotal = ownClients.length;
    const completed = ownClients.filter((client) => !client.biometricEnrollmentRequired).length;
    const pendingProcesses = ownClients.filter((client) => client.biometricEnrollmentRequired).length;

    res.json({
        stats: {
            role: 'ADVISOR',
            companyId: empresaId,
            ownClientCompletionRate: ownClientsTotal === 0 ? 0 : Math.round((completed / ownClientsTotal) * 100),
            weeklyClientActivity,
            pendingProcesses,
            ownClientsTotal,
        },
    });
});
