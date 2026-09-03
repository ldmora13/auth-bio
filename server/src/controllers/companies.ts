import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { CompanyService } from '../services/CompanyService';
import { AuditLogService } from '../services/AuditLogService';

const companyService = new CompanyService();

export const getCompanies = catchAsync(async (req: Request, res: Response) => {
    const companies = await companyService.listCompanies();

    res.json({
        companies: companies.map((company) => ({
            id: company.id,
            nombre: company.nombre,
            nit: company.nit,
            logoUrl: company.logoUrl,
            description: company.description,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
            advisors: company.users.filter((user) => user.role === 'ADVISOR'),
            clients: company.users.filter((user) => user.role === 'CLIENT'),
            advisorCount: company.users.filter((user) => user.role === 'ADVISOR').length,
            clientCount: company.users.filter((user) => user.role === 'CLIENT').length,
        })),
    });
});

export const getCompany = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = res.locals.user;

    if (currentUser.role === 'ADVISOR' && currentUser.empresaId !== id) {
        throw new AppError('Forbidden', 403);
    }

    const company = await companyService.getCompany(id);

    const advisors = company.users.filter((user) => user.role === 'ADVISOR');
    const clients = company.users.filter((user) => {
        if (user.role !== 'CLIENT') {
            return false;
        }

        if (currentUser.role === 'ADVISOR') {
            return user.createdById === currentUser.id;
        }

        return true;
    });

    res.json({
        company: {
            id: company.id,
            nombre: company.nombre,
            nit: company.nit,
            logoUrl: company.logoUrl,
            description: company.description,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
            advisors,
            clients,
            advisorCount: advisors.length,
            clientCount: clients.length,
        },
    });
});

export const getCompanyAuditLogs = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const currentUser = res.locals.user;

    if (currentUser.role === 'ADVISOR' && currentUser.empresaId !== id) {
        throw new AppError('Forbidden', 403);
    }

    const logs = await companyService.listAuditLogs(id);

    res.json({
        auditLogs: logs.map((log) => ({
            id: log.id,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            details: log.details,
            createdAt: log.createdAt,
            user: log.user,
        })),
    });
});

export const createCompany = catchAsync(async (req: Request, res: Response) => {
    const { nombre, nit, logoUrl, description } = req.body;

    if (!nombre?.trim()) {
        throw new AppError('Company name is required', 400);
    }

    if (!nit?.trim()) {
        throw new AppError('Company NIT is required', 400);
    }

    const company = await companyService.createCompany({
        nombre: nombre.trim(),
        nit: nit.trim(),
        logoUrl: logoUrl?.trim(),
        description: description?.trim(),
    });

    await AuditLogService.log({
        action: 'CREATE',
        entity: 'Company',
        entityId: company.id,
        userId: res.locals.user?.id,
        details: { nombre: company.nombre },
    });

    res.status(201).json({
        company: {
            id: company.id,
            nombre: company.nombre,
            nit: company.nit,
            logoUrl: company.logoUrl,
            description: company.description,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
            advisors: company.users.filter((user) => user.role === 'ADVISOR'),
            clients: company.users.filter((user) => user.role === 'CLIENT'),
            advisorCount: company.users.filter((user) => user.role === 'ADVISOR').length,
            clientCount: company.users.filter((user) => user.role === 'CLIENT').length,
        },
    });
});

export const getAvailableAdvisors = catchAsync(async (req: Request, res: Response) => {
    const advisors = await companyService.getAvailableAdvisors();
    res.json({ advisors });
});

export const assignAdvisor = catchAsync(async (req: Request, res: Response) => {
    const { id, advisorId } = req.params;
    const advisor = await companyService.assignAdvisor(id, advisorId);

    await AuditLogService.log({
        action: 'ASSIGN_ADVISOR',
        entity: 'Company',
        entityId: id,
        userId: res.locals.user?.id,
        details: { advisorId },
    });

    res.json({ advisor });
});

export const unassignAdvisor = catchAsync(async (req: Request, res: Response) => {
    const { id, advisorId } = req.params;
    const advisor = await companyService.unassignAdvisor(id, advisorId);

    await AuditLogService.log({
        action: 'UNASSIGN_ADVISOR',
        entity: 'Company',
        entityId: id,
        userId: res.locals.user?.id,
        details: { advisorId },
    });

    res.json({ advisor });
});

export const updateCompany = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const company = await companyService.updateCompany(id, req.body);

    await AuditLogService.log({
        action: 'UPDATE',
        entity: 'Company',
        entityId: company.id,
        userId: res.locals.user?.id,
        details: { fields: Object.keys(req.body) },
    });

    res.json({ company });
});

export const deleteCompany = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    await companyService.deleteCompany(id);

    await AuditLogService.log({
        action: 'DELETE',
        entity: 'Company',
        entityId: id,
        userId: res.locals.user?.id,
    });

    res.status(204).send();
});