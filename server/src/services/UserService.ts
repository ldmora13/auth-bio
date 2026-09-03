import { Prisma, DocumentType, BiometricMethod, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { db } from '../lib/db';
import { UserRepository, UserWithEmpresa } from '../repositories/UserRepository';
import { AppError } from '../utils/AppError';
import { hash } from '@node-rs/argon2';

type CreateUserInput = {
    email: string;
    password?: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    birthDate?: Date | null;
    age?: number | null;
    profilePhotoUrl?: string | null;
    documentType?: DocumentType | null;
    documentNumber?: string | null;
    caseNumber?: string | null;
    processNumber?: string | null;
    formId?: string | null;
    nativeCountry?: string | null;
    sex?: string | null;
    validFrom?: string | null;
    cardExpires?: string | null;
    migratoryStatus?: string | null;
    receivedDate?: string | null;
    deadline?: string | null;
    role: Role;
    empresaId?: string | null;
    biometricMethods?: BiometricMethod[];
    biometricEnrollmentRequired?: boolean;
    createdById?: string;
};

function resolvePrimaryBiometricType(methods: BiometricMethod[]): 'DACTILAR' | 'FACIAL' | 'OCULAR' {
    const firstMethod = methods[0];
    if (firstMethod === 'FACIAL' || firstMethod === 'OCULAR') {
        return firstMethod;
    }

    return 'DACTILAR';
}

const hashEnrollmentToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    async createUser(data: CreateUserInput): Promise<UserWithEmpresa> {
        const normalizedEmail = data.email.trim().toLowerCase();
        const normalizedDocumentNumber = data.documentNumber?.trim();
        const existingUser = await this.userRepository.findByEmail(normalizedEmail);
        if (existingUser) {
            throw new AppError('User with this email already exists', 400);
        }

        if (normalizedDocumentNumber && await this.userRepository.findByDocumentNumber(normalizedDocumentNumber)) {
            throw new AppError('User with this document number already exists', 400);
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
            email: normalizedEmail,
            password: hashedPassword,
            name: data.name,
            address: data.address,
            phone: data.phone,
            birthDate: data.birthDate,
            age: data.age,
            profilePhotoUrl: data.profilePhotoUrl,
            documentType: data.documentType,
            documentNumber: normalizedDocumentNumber,
            caseNumber: data.caseNumber,
            processNumber: data.processNumber,
            formId: data.formId,
            nativeCountry: data.nativeCountry,
            sex: data.sex,
            validFrom: data.validFrom,
            cardExpires: data.cardExpires,
            migratoryStatus: data.migratoryStatus,
            receivedDate: data.receivedDate,
            deadline: data.deadline,
            role: data.role,
            empresaId: data.empresaId ?? null,
            biometricMethods: data.biometricMethods ?? [],
            biometricEnrollmentRequired: data.biometricEnrollmentRequired ?? false,
            biometricEnrollmentCompletedAt: data.biometricEnrollmentRequired ? null : undefined,
            createdById: data.createdById ?? null,
        };

        return this.userRepository.create(createData);
    }

    async getUsers(role?: Role, requester?: { id: string; role: Role; empresaId?: string | null }): Promise<UserWithEmpresa[]> {
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
            where.createdById = requester.id;
            return this.userRepository.findAll(where);
        }

        if (role) {
            where.role = role;
        }

        return this.userRepository.findAll(where);
    }

    async getUserById(id: string, requester?: { id: string; role: Role; empresaId?: string | null }): Promise<UserWithEmpresa> {
        const user = await this.userRepository.findById(id);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || user.role !== 'CLIENT' || user.empresaId !== requester.empresaId || user.createdById !== requester.id) {
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
        requester?: { id: string; role: Role; empresaId?: string | null }
    ): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        const normalizedEmail = typeof data.email === 'string' ? data.email.trim().toLowerCase() : undefined;
        const normalizedDocumentNumber = typeof data.documentNumber === 'string' ? data.documentNumber.trim() : undefined;

        if (normalizedEmail && await this.userRepository.findByEmailExcludingId(normalizedEmail, id)) {
            throw new AppError('User with this email already exists', 400);
        }

        if (normalizedDocumentNumber && await this.userRepository.findByDocumentNumber(normalizedDocumentNumber, id)) {
            throw new AppError('User with this document number already exists', 400);
        }

        const normalizedData: Prisma.UserUpdateInput = {
            ...data,
            ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
            ...(normalizedDocumentNumber !== undefined ? { documentNumber: normalizedDocumentNumber } : {}),
        };

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.role !== 'CLIENT' || currentUser.empresaId !== requester.empresaId || currentUser.createdById !== requester.id) {
                throw new AppError('Forbidden', 403);
            }

            const allowedFields: Prisma.UserUpdateInput = {};
            if (data.name !== undefined) allowedFields.name = data.name;
            if (data.address !== undefined) allowedFields.address = data.address;
            if (data.phone !== undefined) allowedFields.phone = data.phone;
            if (data.birthDate !== undefined) allowedFields.birthDate = data.birthDate;
            if (data.age !== undefined) allowedFields.age = data.age;
            if (data.profilePhotoUrl !== undefined) allowedFields.profilePhotoUrl = data.profilePhotoUrl;
            if (data.documentType !== undefined) allowedFields.documentType = data.documentType;
            if (normalizedData.documentNumber !== undefined) allowedFields.documentNumber = normalizedData.documentNumber;
            if (normalizedData.email !== undefined) allowedFields.email = normalizedData.email;
            if (data.biometricMethods !== undefined) allowedFields.biometricMethods = data.biometricMethods;

            return this.userRepository.update(id, allowedFields);
        }

        return this.userRepository.update(id, normalizedData);
    }

    async resetBiometricEnrollment(id: string, requester?: { id: string; role: Role; empresaId?: string | null }): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (currentUser.role !== 'CLIENT') {
            throw new AppError('Only clients can require biometric re-enrollment', 400);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.empresaId !== requester.empresaId || currentUser.createdById !== requester.id) {
                throw new AppError('Forbidden', 403);
            }
        }

        return this.userRepository.update(id, {
            biometricEnrollmentRequired: true,
            biometricEnrollmentCompletedAt: null,
            biometricEnrollmentRequestedAt: new Date(),
        });
    }

    async requestBiometricEnrollment(
        id: string,
        biometricTypes: BiometricMethod[],
        maxAttempts: number | null | undefined,
        requester?: { id: string; role: Role; empresaId?: string | null }
    ): Promise<{ user: UserWithEmpresa; enrollmentToken: string }> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (currentUser.role !== 'CLIENT') {
            throw new AppError('Only clients can receive biometric enrollment requests', 400);
        }

        if (!biometricTypes || biometricTypes.length === 0) {
            throw new AppError('At least one biometric method is required', 400);
        }

        const uniqueMethods = [...new Set(biometricTypes)];
        const primaryType = resolvePrimaryBiometricType(uniqueMethods);
        const enrollmentToken = randomBytes(32).toString('base64url');

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.empresaId !== requester.empresaId || currentUser.createdById !== requester.id) {
                throw new AppError('Forbidden', 403);
            }
        }

        const user = await this.userRepository.update(id, {
            biometricType: primaryType,
            biometricMethods: uniqueMethods,
            biometricEnrollmentRequired: true,
            biometricEnrollmentCompletedAt: null,
            biometricEnrollmentRequestedAt: new Date(),
            biometricEnrollmentMaxAttempts: maxAttempts ?? null,
            biometricEnrollmentAttempts: 0,
            biometricEnrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
        });

        return { user, enrollmentToken };
    }

    async resolveBiometricEnrollmentToken(token: string): Promise<UserWithEmpresa> {
        const user = await db.user.findFirst({
            where: { biometricEnrollmentTokenHash: hashEnrollmentToken(token) },
            include: { empresa: true },
        });

        if (!user || !user.biometricEnrollmentRequired) {
            throw new AppError('This biometric access link is invalid or has already been used', 404);
        }

        return user;
    }

    async accessBiometricEnrollment(token: string): Promise<UserWithEmpresa> {
        const user = await this.resolveBiometricEnrollmentToken(token);

        if (user.biometricEnrollmentMaxAttempts !== null && user.biometricEnrollmentAttempts >= user.biometricEnrollmentMaxAttempts) {
            throw new AppError('The maximum number of biometric attempts for this link has been reached', 403);
        }

        return user;
    }

    async startBiometricEnrollmentAttempt(token: string): Promise<UserWithEmpresa> {
        const user = await this.accessBiometricEnrollment(token);
        const updated = await db.user.updateMany({
            where: {
                id: user.id,
                biometricEnrollmentTokenHash: hashEnrollmentToken(token),
                biometricEnrollmentAttempts: user.biometricEnrollmentAttempts,
                biometricEnrollmentRequired: true,
            },
            data: { biometricEnrollmentAttempts: { increment: 1 } },
        });

        if (updated.count !== 1) {
            throw new AppError('The biometric attempt could not be started. Please open the link again.', 409);
        }

        return this.getUserById(user.id);
    }

    async completeBiometricEnrollment(id: string, completedMethods: BiometricMethod[], enrollmentToken?: string): Promise<UserWithEmpresa> {
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

        if (currentUser.biometricEnrollmentTokenHash) {
            if (!enrollmentToken || currentUser.biometricEnrollmentTokenHash !== hashEnrollmentToken(enrollmentToken)) {
                throw new AppError('This biometric access link is no longer valid', 403);
            }
            if (currentUser.biometricEnrollmentAttempts < 1) {
                throw new AppError('Start a biometric attempt from the access link before completing the enrollment', 403);
            }
        }

        return this.userRepository.update(id, {
            biometricEnrollmentRequired: false,
            biometricEnrollmentCompletedAt: new Date(),
            biometricEnrollmentRequestedAt: null,
            biometricEnrollmentTokenHash: null,
        });
    }

    async deleteUser(id: string, requester?: { id: string; role: Role; empresaId?: string | null }): Promise<UserWithEmpresa> {
        const currentUser = await this.userRepository.findById(id);

        if (!currentUser) {
            throw new AppError('User not found', 404);
        }

        if (requester?.role === 'ADVISOR') {
            if (!requester.empresaId || currentUser.role !== 'CLIENT' || currentUser.empresaId !== requester.empresaId || currentUser.createdById !== requester.id) {
                throw new AppError('Forbidden', 403);
            }
        }

        return this.userRepository.delete(id);
    }
}
