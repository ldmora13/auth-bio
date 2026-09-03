import { Prisma } from '@prisma/client';
import { db } from '../lib/db';
import { AppError } from '../utils/AppError';

export type CompanyAuditLog = Prisma.AuditLogGetPayload<{
    include: {
        user: {
            select: {
                id: true;
                name: true;
                email: true;
                role: true;
            };
        };
    };
}>;

export type CompanyWithAdvisors = Prisma.EmpresaGetPayload<{
    include: {
        users: {
            where: { role: 'ADVISOR' };
            select: {
                id: true;
                email: true;
                name: true;
                role: true;
                empresaId: true;
                createdAt: true;
                createdById: true;
            };
        };
    };
}>;

export type CompanyDetail = Prisma.EmpresaGetPayload<{
    include: {
        users: {
            select: {
                id: true;
                email: true;
                name: true;
                role: true;
                empresaId: true;
                createdAt: true;
                createdById: true;
                documentType: true;
                documentNumber: true;
                address: true;
                phone: true;
                birthDate: true;
                age: true;
                profilePhotoUrl: true;
            };
        };
    };
}>;

export class CompanyRepository {
    async findAll(): Promise<CompanyDetail[]> {
        return db.empresa.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        empresaId: true,
                        createdAt: true,
                        createdById: true,
                        documentType: true,
                        documentNumber: true,
                        address: true,
                        phone: true,
                        birthDate: true,
                        age: true,
                        profilePhotoUrl: true,
                        caseNumber: true,
                        processNumber: true,
                        formId: true,
                        nativeCountry: true,
                        sex: true,
                        validFrom: true,
                        cardExpires: true,
                        migratoryStatus: true,
                        receivedDate: true,
                        deadline: true,
                    },
                },
            },
        });
    }

    async findById(id: string): Promise<CompanyWithAdvisors | null> {
        return db.empresa.findUnique({
            where: { id },
            include: {
                users: {
                    where: { role: 'ADVISOR' },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        empresaId: true,
                        createdAt: true,
                        createdById: true,
                    },
                },
            },
        });
    }

    async findDetailById(id: string): Promise<CompanyDetail | null> {
        return db.empresa.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        empresaId: true,
                        createdAt: true,
                        createdById: true,
                        documentType: true,
                        documentNumber: true,
                        address: true,
                        phone: true,
                        birthDate: true,
                        age: true,
                        profilePhotoUrl: true,
                        caseNumber: true,
                        processNumber: true,
                        formId: true,
                        nativeCountry: true,
                        sex: true,
                        validFrom: true,
                        cardExpires: true,
                        migratoryStatus: true,
                        receivedDate: true,
                        deadline: true,
                    },
                },
            },
        });
    }

    async findByName(nombre: string) {
        return db.empresa.findUnique({ where: { nombre } });
    }

    async findByNit(nit: string) {
        return db.empresa.findUnique({ where: { nit } });
    }

    async create(data: { nombre: string; nit: string; logoUrl?: string | null; description?: string | null }): Promise<CompanyWithAdvisors> {
        return db.empresa.create({
            data: {
                nombre: data.nombre,
                nit: data.nit,
                logoUrl: data.logoUrl ?? null,
                description: data.description ?? null,
            },
            include: {
                users: {
                    where: { role: 'ADVISOR' },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        empresaId: true,
                        createdAt: true,
                        createdById: true,
                    },
                },
            },
        });
    }

    async update(id: string, data: { nombre?: string; nit?: string; logoUrl?: string | null; description?: string }): Promise<CompanyWithAdvisors | null> {
        return db.empresa.update({
            where: { id },
            data,
            include: {
                users: {
                    where: { role: 'ADVISOR' },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        empresaId: true,
                        createdAt: true,
                        createdById: true,
                    },
                },
            },
        });
    }

    async delete(id: string) {
        return db.empresa.delete({ where: { id } });
    }

    async listAvailableAdvisors() {
        return db.user.findMany({
            where: {
                role: 'ADVISOR',
                empresaId: null,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                empresaId: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async assignAdvisor(companyId: string, advisorId: string) {
        return db.$transaction(async (tx) => {
            const advisor = await tx.user.findUnique({ where: { id: advisorId } });
            const company = await tx.empresa.findUnique({ where: { id: companyId } });

            if (!company) {
                throw new AppError('Company not found', 404);
            }

            if (!advisor || advisor.role !== 'ADVISOR') {
                return null;
            }

            if (advisor.empresaId && advisor.empresaId !== companyId) {
                throw new AppError('Advisor is already assigned to another company', 400);
            }

            if (advisor.empresaId === companyId) {
                return tx.user.update({
                    where: { id: advisorId },
                    data: { empresaId: companyId },
                    include: { empresa: true },
                });
            }

            return tx.user.update({
                where: { id: advisorId },
                data: { empresaId: companyId },
                include: { empresa: true },
            });
        });
    }

    async unassignAdvisor(companyId: string, advisorId: string) {
        return db.$transaction(async (tx) => {
            const advisor = await tx.user.findUnique({ where: { id: advisorId } });
            const company = await tx.empresa.findUnique({ where: { id: companyId } });

            if (!company) {
                throw new AppError('Company not found', 404);
            }

            if (!advisor || advisor.role !== 'ADVISOR' || advisor.empresaId !== companyId) {
                return null;
            }

            return tx.user.update({
                where: { id: advisorId },
                data: { empresaId: null },
                include: { empresa: true },
            });
        });
    }

    async listAuditLogs(companyId: string): Promise<CompanyAuditLog[]> {
        return db.auditLog.findMany({
            where: {
                entity: 'Company',
                entityId: companyId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
}