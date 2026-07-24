import { Prisma, DocumentType, BiometricMethod, Role } from '@prisma/client';
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
    biometricMethods?: BiometricMethod[];
    biometricEnrollmentRequired?: boolean;
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
            biometricMethods: data.biometricMethods ?? [],
            biometricEnrollmentRequired: data.biometricEnrollmentRequired ?? false,
            biometricEnrollmentCompletedAt: data.biometricEnrollmentRequired ? null : undefined,
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
            if (data.biometricMethods !== undefined) allowedFields.biometricMethods = data.biometricMethods;

            return this.userRepository.update(id, allowedFields);
        }

        return this.userRepository.update(id, data);
    }

    async resetBiometricEnrollment(id: string, requester?: { role: Role; empresaId?: string | null }): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (currentUser.role !== 'CLIENT') {
            throw new AppError('Only clients can require biometric re-enrollment', 400);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.empresaId !== requester.empresaId) {
                throw new AppError('Forbidden', 403);
            }
        }

        return this.userRepository.update(id, {
            biometricEnrollmentRequired: true,
            biometricEnrollmentCompletedAt: null,
            biometricEnrollmentRequestedAt: new Date(),
        });
    }

    async completeBiometricEnrollment(id: string, completedMethods: BiometricMethod[]): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (currentUser.role !== 'CLIENT') {
            throw new AppError('Only clients can complete biometric enrollment', 400);
        }

        const assignedMethods = [...currentUser.biometricMethods].sort();
        const receivedMethods = [...completedMethods].sort();
        const sameMethods = assignedMethods.length === receivedMethods.length && assignedMethods.every((method, index) => method === receivedMethods[index]);

        if (!sameMethods) {
            throw new AppError('Biometric methods do not match the assigned enrollment plan', 400);
        }

        return this.userRepository.update(id, {
            biometricEnrollmentRequired: false,
            biometricEnrollmentCompletedAt: new Date(),
            biometricEnrollmentRequestedAt: null,
        });
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
