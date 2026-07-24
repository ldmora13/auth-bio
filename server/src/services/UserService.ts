import { Prisma, DocumentType, BiometricType, Role } from '@prisma/client';
import { UserRepository, UserWithEmpresa } from '../repositories/UserRepository';
import { AppError } from '../utils/AppError';
import { hash } from '@node-rs/argon2';

type CreateUserInput = {
    email: string;
    password?: string;
    name: string;
    address?: string | null;
    documentType?: DocumentType | null;
    documentNumber?: string | null;
    role: Role;
    empresaId?: string | null;
    biometricType?: BiometricType | null;
    createdById?: string;
};

export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    async createUser(data: CreateUserInput): Promise<UserWithEmpresa> {
        const existingUser = await this.userRepository.findByEmail(data.email);
        if (existingUser) {
            throw new AppError('User with this email already exists', 400);
        }

        const hashedPassword = data.password
            ? await hash(data.password, {
                memoryCost: 19456,
                timeCost: 2,
                outputLen: 32,
                parallelism: 1,
            })
            : null;

        // Prepare data for Prisma, handle createdById
        const createData: Prisma.UserUncheckedCreateInput = {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            address: data.address,
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            role: data.role,
            empresaId: data.empresaId ?? null,
            biometricType: data.biometricType,
            createdById: data.createdById ?? null,
        };

        return this.userRepository.create(createData);
    }

    async getUsers(role?: Role, requester?: { role: Role; empresaId?: string | null }): Promise<UserWithEmpresa[]> {
        const where: Prisma.UserWhereInput = {};

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId) {
                throw new AppError('Advisor is not assigned to a company', 403);
            }

            if (role && role !== 'CLIENT') {
                throw new AppError('Advisors can only list clients from their company', 403);
            }

            where.role = 'CLIENT';
            where.empresaId = requester.empresaId;
            return this.userRepository.findAll(where);
        }

        if (role) {
            where.role = role;
        }

        return this.userRepository.findAll(where);
    }

    async getUserById(id: string, requester?: { role: Role; empresaId?: string | null }): Promise<UserWithEmpresa> {
        const user = await this.userRepository.findById(id);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || user.role !== 'CLIENT' || user.empresaId !== requester.empresaId) {
                throw new AppError('Forbidden', 403);
            }
        }

        return user;
    }

    async findClientByDocument(documentType: DocumentType, documentNumber: string): Promise<UserWithEmpresa | null> {
        return this.userRepository.findByDocument(documentType, documentNumber);
    }

    async updateUser(
        id: string,
        data: Prisma.UserUpdateInput,
        requester?: { role: Role; empresaId?: string | null }
    ): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.role !== 'CLIENT' || currentUser.empresaId !== requester.empresaId) {
                throw new AppError('Forbidden', 403);
            }

            const allowedFields: Prisma.UserUpdateInput = {};
            if (data.name !== undefined) allowedFields.name = data.name;
            if (data.address !== undefined) allowedFields.address = data.address;
            if (data.documentType !== undefined) allowedFields.documentType = data.documentType;
            if (data.documentNumber !== undefined) allowedFields.documentNumber = data.documentNumber;
            if (data.biometricType !== undefined) allowedFields.biometricType = data.biometricType;

            return this.userRepository.update(id, allowedFields);
        }

        return this.userRepository.update(id, data);
    }

    async deleteUser(id: string, requester?: { role: Role; empresaId?: string | null }): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.role !== 'CLIENT' || currentUser.empresaId !== requester.empresaId) {
                throw new AppError('Forbidden', 403);
            }
        }

        return this.userRepository.delete(id);
    }
}
