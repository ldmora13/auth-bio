import { Prisma, User, DocumentType } from '@prisma/client';
import { db } from '../lib/db';

export type UserWithEmpresa = Prisma.UserGetPayload<{ include: { empresa: true } }>;


export class UserRepository {
    async create(data: Prisma.UserUncheckedCreateInput): Promise<UserWithEmpresa> {
        return db.user.create({ data, include: { empresa: true } });
    }

    async findByDocument(documentType: DocumentType, documentNumber: string): Promise<UserWithEmpresa | null> {
        return db.user.findFirst({
            where: {
                role: 'CLIENT',
                documentType,
                documentNumber,
            },
            include: { empresa: true },
        });
    }

    async findByEmail(email: string): Promise<UserWithEmpresa | null> {
        return db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, include: { empresa: true } });
    }

    async findByEmailInCompany(email: string, empresaId: string | null): Promise<UserWithEmpresa | null> {
        return db.user.findFirst({
            where: {
                email: { equals: email, mode: 'insensitive' },
                empresaId,
            },
            include: { empresa: true },
        });
    }

    async findByEmailInCompanyExcludingId(email: string, empresaId: string | null, excludingId: string): Promise<UserWithEmpresa | null> {
        return db.user.findFirst({
            where: {
                email: { equals: email, mode: 'insensitive' },
                empresaId,
                id: { not: excludingId },
            },
            include: { empresa: true },
        });
    }

    async findByDocumentNumberInCompany(documentNumber: string, empresaId: string | null, excludingId?: string): Promise<UserWithEmpresa | null> {
        return db.user.findFirst({
            where: {
                documentNumber,
                empresaId,
                ...(excludingId ? { id: { not: excludingId } } : {}),
            },
            include: { empresa: true },
        });
    }

    async findById(id: string): Promise<UserWithEmpresa | null> {
        return db.user.findUnique({ where: { id }, include: { empresa: true } });
    }

    async findAll(where: Prisma.UserWhereInput): Promise<UserWithEmpresa[]> {
        return db.user.findMany({
            where,
            include: { empresa: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithEmpresa> {
        return db.user.update({
            where: { id },
            data,
            include: { empresa: true },
        });
    }

}
