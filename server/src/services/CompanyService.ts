import { AppError } from '../utils/AppError';
import { CompanyRepository, CompanyAuditLog, CompanyDetail, CompanyWithAdvisors } from '../repositories/CompanyRepository';
import { persistImageDataUrl } from '../utils/imageStorage';

export class CompanyService {
    private companyRepository: CompanyRepository;

    constructor() {
        this.companyRepository = new CompanyRepository();
    }

    async listCompanies(): Promise<CompanyDetail[]> {
        return this.companyRepository.findAll();
    }

    async getCompany(companyId: string): Promise<CompanyDetail> {
        const company = await this.companyRepository.findDetailById(companyId);
        if (!company) {
            throw new AppError('Company not found', 404);
        }

        return company;
    }

    async createCompany(input: { nombre: string; nit: string; logoUrl?: string | null; description?: string | null }): Promise<CompanyWithAdvisors> {
        const { nombre, nit, logoUrl, description } = input;

        const existing = await this.companyRepository.findByName(nombre);
        if (existing) {
            throw new AppError('Company name already exists', 400);
        }

        const existingNit = await this.companyRepository.findByNit(nit);
        if (existingNit) {
            throw new AppError('Company NIT already exists', 400);
        }

        let persistedLogoUrl = logoUrl;
        if (logoUrl && logoUrl.startsWith('data:image/')) {
            persistedLogoUrl = await persistImageDataUrl({
                dataUrl: logoUrl,
                companyName: nombre,
                filePrefix: 'logo',
            });
        }

        return this.companyRepository.create({
            nombre,
            nit,
            logoUrl: persistedLogoUrl,
            description,
        });
    }

    async getAvailableAdvisors() {
        return this.companyRepository.listAvailableAdvisors();
    }

    async assignAdvisor(companyId: string, advisorId: string) {
        const result = await this.companyRepository.assignAdvisor(companyId, advisorId);
        if (!result) {
            throw new AppError('Advisor not found', 404);
        }

        return result;
    }

    async unassignAdvisor(companyId: string, advisorId: string) {
        const result = await this.companyRepository.unassignAdvisor(companyId, advisorId);
        if (!result) {
            throw new AppError('Advisor not found in this company', 404);
        }

        return result;
    }

    async listAuditLogs(companyId: string): Promise<CompanyAuditLog[]> {
        return this.companyRepository.listAuditLogs(companyId);
    }
}