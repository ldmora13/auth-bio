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
        return db.user.findUnique({ where: { email }, include: { empresa: true } });
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

    async delete(id: string): Promise<UserWithEmpresa> {
        return db.user.delete({
            where: { id },
            include: { empresa: true },
        });
    }
}
