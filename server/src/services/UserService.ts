import { User, Prisma, DocumentType, BiometricType, Role } from '@prisma/client';
import { UserRepository } from '../repositories/UserRepository';
import { AppError } from '../utils/AppError';
import { hash } from '@node-rs/argon2';

type CreateUserInput = Omit<Prisma.UserCreateInput, 'password'> & {
    password?: string;
    createdById?: string;
};

export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = new UserRepository();
    }

    async createUser(data: CreateUserInput): Promise<User> {
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
        const createData: Prisma.UserCreateInput = {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            address: data.address,
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            role: data.role,
            company: data.company,
            biometricType: data.biometricType,
        };

        if (data.createdById) {
            createData.createdBy = {
                connect: { id: data.createdById },
            };
        }

        return this.userRepository.create(createData);
    }

    async getUsers(role?: Role): Promise<User[]> {
        const where: Prisma.UserWhereInput = role ? { role } : {};
        return this.userRepository.findAll(where);
    }

    async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
        return this.userRepository.update(id, data);
    }
}
