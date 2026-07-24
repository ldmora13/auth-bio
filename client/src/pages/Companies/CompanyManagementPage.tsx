import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, Menu, Transition } from '@headlessui/react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { canAccessCompanies } from '../../lib/roles';
import { UserService, type CompanyAuditLog } from '../../services/userService';
import type { Empresa, User } from '../../types/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Pagination from '../../components/Pagination';
import { toast } from 'react-hot-toast';
import {
    Building2,
    CalendarDays,
    CheckCircle2,
    Download,
    Eye,
    FileText,
    Filter,
    MoreHorizontal,
    Printer,
    Search,
    ShieldCheck,
    Trash2,
    UserPlus,
    Users,
    X,
} from 'lucide-react';

type CompanySort = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'advisors-desc' | 'clients-desc';
type CompanyStatusFilter = 'all' | 'active' | 'empty';
type ClientSort = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type ClientDraft = {
    name: string;
    address: string;
    documentType: 'CC' | 'DNI' | 'PASSPORT' | 'OTHER';
    documentNumber: string;
};

const COMPANY_PAGE_SIZE = 6;
const CLIENT_PAGE_SIZE = 5;

function formatDate(value?: string) {
    if (!value) return 'N/D';
    return new Date(value).toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getCompanyActivity(company: Empresa) {
    const total = (company.advisorCount ?? company.advisors?.length ?? 0) + (company.clientCount ?? company.clients?.length ?? 0);
    return total > 0 ? 'Activa' : 'Vacía';
}

function downloadCsv(filename: string, rows: string[][]) {
    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function safeParseDetails(details: string | null) {
    if (!details) return null;
    try {
        return JSON.parse(details) as Record<string, unknown>;
    } catch {
        return { raw: details };
    }
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = error as { response?: { data?: { error?: string } } };
        if (typeof response.response?.data?.error === 'string') {
            return response.response.data.error;
        }
    }

    return fallback;
}

export default function CompanyManagementPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const params = useParams<{ id?: string }>();
    const routeCompanyId = params.id;
    const isAdmin = user?.role === 'ADMIN';
    const isAdvisor = user?.role === 'ADVISOR';

    const [companies, setCompanies] = useState<Empresa[]>([]);
    const [availableAdvisors, setAvailableAdvisors] = useState<User[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [newCompanyName, setNewCompanyName] = useState('');
    const [companyNameError, setCompanyNameError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [companySort, setCompanySort] = useState<CompanySort>('newest');
    const [companyStatusFilter, setCompanyStatusFilter] = useState<CompanyStatusFilter>('all');
    const [companyPage, setCompanyPage] = useState(1);

    const [companyDetail, setCompanyDetail] = useState<Empresa | null>(null);
    const [companyAuditLogs, setCompanyAuditLogs] = useState<CompanyAuditLog[]>([]);
    const [companyAuditLogsError, setCompanyAuditLogsError] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [modalCompany, setModalCompany] = useState<Empresa | null>(null);
    const [modalAuditLogs, setModalAuditLogs] = useState<CompanyAuditLog[]>([]);
    const [modalAuditLogsError, setModalAuditLogsError] = useState<string | null>(null);

    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [clientSaving, setClientSaving] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [clientSort, setClientSort] = useState<ClientSort>('newest');
    const [clientPage, setClientPage] = useState(1);
    const [clientDraft, setClientDraft] = useState<ClientDraft>({
        name: '',
        address: '',
        documentType: 'CC',
        documentNumber: '',
    });
    const [clientErrors, setClientErrors] = useState<Partial<Record<'name' | 'address' | 'documentNumber', string>>>({});

    useEffect(() => {
        if (!user || !canAccessCompanies(user.role)) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate, user]);

    const loadData = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError(null);
        setCompanyAuditLogsError(null);

        try {
            if (isAdmin && !routeCompanyId) {
                const [companiesResponse, advisorsResponse] = await Promise.all([
                    UserService.getCompanies(),
                    UserService.getAvailableAdvisors(),
                ]);

                setCompanies(companiesResponse);
                setAvailableAdvisors(advisorsResponse as unknown as User[]);
                setSelectedCompanyId((current) => current || companiesResponse[0]?.id || '');
                setCompanyDetail(null);
                setCompanyAuditLogs([]);
            } else {
                const companyId = routeCompanyId ?? user.empresa?.id;
                if (!companyId) {
                    throw new Error('No company available');
                }

                const companyResponse = await UserService.getCompany(companyId);
                let auditLogs: CompanyAuditLog[] = [];

                try {
                    auditLogs = await UserService.getCompanyAuditLogs(companyId);
                    setCompanyAuditLogsError(null);
                } catch (auditError) {
                    auditLogs = [];
                    setCompanyAuditLogsError(getErrorMessage(auditError, 'No se pudo cargar el historial de auditoría'));
                }

                setCompanyDetail(companyResponse);
                setCompanyAuditLogs(auditLogs);
                setSelectedCompanyId(companyId);
            }
        } catch (fetchError) {
            const message = fetchError instanceof Error ? fetchError.message : 'No se pudo cargar la información';
            setError(message);
            toast.error('No se pudo cargar la información de empresas');
        } finally {
            setLoading(false);
        }
    }, [isAdmin, routeCompanyId, user]);

    const loadCompanyDetail = useCallback(async (companyId: string) => {
        setLoadingDetail(true);
        setModalAuditLogsError(null);
        try {
            const companyResponse = await UserService.getCompany(companyId);
            let auditLogs: CompanyAuditLog[] = [];

            try {
                auditLogs = await UserService.getCompanyAuditLogs(companyId);
                setModalAuditLogsError(null);
            } catch (auditError) {
                auditLogs = [];
                setModalAuditLogsError(getErrorMessage(auditError, 'No se pudo cargar el historial de auditoría'));
            }

            setModalCompany(companyResponse);
            setModalAuditLogs(auditLogs);
            setIsDetailModalOpen(true);
        } catch {
            toast.error('No se pudo cargar el detalle de la empresa');
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => {
        if (!user) return;

        if (isAdvisor && !user.empresa?.id) {
            setError('No tienes una empresa asignada todavía.');
            setLoading(false);
            return;
        }

        void loadData();
    }, [loadData, isAdvisor, user]);

    useEffect(() => {
        if (!companyDetail) {
            setCompanyAuditLogsError(null);
        }
    }, [companyDetail]);

    useEffect(() => {
        if (!selectedCompanyId && companies.length > 0 && !routeCompanyId) {
            setSelectedCompanyId(companies[0].id);
        }
    }, [companies, routeCompanyId, selectedCompanyId]);

    useEffect(() => {
        setCompanyPage(1);
    }, [searchTerm, companySort, companyStatusFilter]);

    useEffect(() => {
        setClientPage(1);
    }, [clientSearch, clientSort, companyDetail?.id]);

    function validateCompanyName(name: string) {
        if (!name.trim()) {
            setCompanyNameError('El nombre de la empresa es obligatorio');
            return false;
        }

        setCompanyNameError('');
        return true;
    }

    async function handleCreateCompany(e: React.FormEvent) {
        e.preventDefault();
        if (!validateCompanyName(newCompanyName)) return;

        try {
            await UserService.createCompany(newCompanyName.trim());
            setNewCompanyName('');
            toast.success('Empresa creada');
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo crear la empresa'));
        }
    }

    async function handleAssignAdvisor(advisorId: string) {
        if (!selectedCompanyId) return;

        try {
            await UserService.assignAdvisor(selectedCompanyId, advisorId);
            toast.success('Advisor asignado');
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo asignar el advisor')); 
        }
    }

    async function handleUnassignAdvisor(advisorId: string) {
        if (!selectedCompanyId) return;

        try {
            await UserService.unassignAdvisor(selectedCompanyId, advisorId);
            toast.success('Advisor desvinculado');
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo desvincular el advisor'));
        }
    }

    function openClientEditor(client: User) {
        setSelectedClient(client);
        setClientDraft({
            name: client.name ?? '',
            address: client.address ?? '',
            documentType: client.documentType ?? 'CC',
            documentNumber: client.documentNumber ?? '',
        });
        setClientErrors({});
        setClientModalOpen(true);
    }

    function validateClientDraft(draft: ClientDraft) {
        const nextErrors: Partial<Record<'name' | 'address' | 'documentNumber', string>> = {};

        if (!draft.name.trim()) nextErrors.name = 'El nombre es obligatorio';
        if (!draft.address.trim()) nextErrors.address = 'La dirección es obligatoria';
        if (!draft.documentNumber.trim()) nextErrors.documentNumber = 'El documento es obligatorio';

        setClientErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function updateClientDraft(field: keyof ClientDraft, value: string) {
        setClientDraft((current) => ({ ...current, [field]: value }));

        if (field === 'name' || field === 'address' || field === 'documentNumber') {
            setClientErrors((current) => ({ ...current, [field]: undefined }));
        }
    }

    async function handleSaveClient() {
        if (!selectedClient || !validateClientDraft(clientDraft)) return;

        setClientSaving(true);
        try {
            await UserService.update(selectedClient.id, {
                name: clientDraft.name.trim(),
                address: clientDraft.address.trim(),
                documentType: clientDraft.documentType,
                documentNumber: clientDraft.documentNumber.trim(),
            });

            toast.success('Cliente actualizado');
            setClientModalOpen(false);
            setSelectedClient(null);
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo actualizar el cliente'));
        } finally {
            setClientSaving(false);
        }
    }

    async function handleDeleteClient(clientId: string) {
        if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return;

        try {
            await UserService.remove(clientId);
            toast.success('Cliente eliminado');
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo eliminar el cliente'));
        }
    }

    function openCompanyModal(company: Empresa) {
        void loadCompanyDetail(company.id);
    }

    const currentCompany = useMemo(() => {
        if (routeCompanyId || isAdvisor) return companyDetail;
        return companies.find((company) => company.id === selectedCompanyId) ?? companies[0] ?? null;
    }, [companyDetail, companies, isAdvisor, routeCompanyId, selectedCompanyId]);

    const filteredCompanies = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return companies
            .filter((company) => {
                const active = getCompanyActivity(company) === 'Activa';
                const matchesSearch = !term || company.nombre.toLowerCase().includes(term);
                const matchesStatus =
                    companyStatusFilter === 'all'
                        ? true
                        : companyStatusFilter === 'active'
                            ? active
                            : !active;

                return matchesSearch && matchesStatus;
            })
            .sort((left, right) => {
                switch (companySort) {
                    case 'name-asc':
                        return left.nombre.localeCompare(right.nombre);
                    case 'name-desc':
                        return right.nombre.localeCompare(left.nombre);
                    case 'oldest':
                        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
                    case 'advisors-desc':
                        return (right.advisorCount ?? 0) - (left.advisorCount ?? 0);
                    case 'clients-desc':
                        return (right.clientCount ?? 0) - (left.clientCount ?? 0);
                    case 'newest':
                    default:
                        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
                }
            });
    }, [companies, companySort, companyStatusFilter, searchTerm]);

    const totalCompanyPages = Math.max(1, Math.ceil(filteredCompanies.length / COMPANY_PAGE_SIZE));
    const paginatedCompanies = filteredCompanies.slice((companyPage - 1) * COMPANY_PAGE_SIZE, companyPage * COMPANY_PAGE_SIZE);

    const visibleClients = useMemo(() => {
        const companyClients = currentCompany?.clients ?? [];
        const term = clientSearch.trim().toLowerCase();

        return companyClients
            .filter((client) => {
                if (!term) return true;
                return [client.name, client.email, client.documentNumber ?? '', client.documentType ?? '']
                    .join(' ')
                    .toLowerCase()
                    .includes(term);
            })
            .sort((left, right) => {
                switch (clientSort) {
                    case 'name-asc':
                        return left.name.localeCompare(right.name);
                    case 'name-desc':
                        return right.name.localeCompare(left.name);
                    case 'oldest':
                        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
                    case 'newest':
                    default:
                        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
                }
            });
    }, [clientSearch, clientSort, currentCompany]);

    const totalClientPages = Math.max(1, Math.ceil(visibleClients.length / CLIENT_PAGE_SIZE));
    const paginatedClients = visibleClients.slice((clientPage - 1) * CLIENT_PAGE_SIZE, clientPage * CLIENT_PAGE_SIZE);

    if (!user || !canAccessCompanies(user.role)) {
        return null;
    }

    if (loading && !currentCompany && !companies.length) {
        return (
            <Layout>
                <div className="flex min-h-[60vh] items-center justify-center text-slate-300">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
                        Cargando empresas...
                    </div>
                </div>
            </Layout>
        );
    }

    if (error && !currentCompany && !isAdmin) {
        return (
            <Layout>
                <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-100">
                    <h1 className="text-2xl font-semibold">Gestión de empresas</h1>
                    <p className="mt-2 text-sm text-red-100/80">{error}</p>
                    <Button className="mt-4 w-auto" onClick={() => navigate('/dashboard')}>
                        Volver al dashboard
                    </Button>
                </div>
            </Layout>
        );
    }

    const companyCards = (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-end">
                <div className="flex-1">
                    <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-400">Buscar empresa</label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Nombre de empresa"
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="min-w-40">
                    <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-400">Estado</label>
                    <select
                        value={companyStatusFilter}
                        onChange={(e) => setCompanyStatusFilter(e.target.value as CompanyStatusFilter)}
                        className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    >
                        <option value="all">Todas</option>
                        <option value="active">Activas</option>
                        <option value="empty">Vacías</option>
                    </select>
                </div>

                <div className="min-w-44">
                    <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-400">Ordenar</label>
                    <select
                        value={companySort}
                        onChange={(e) => setCompanySort(e.target.value as CompanySort)}
                        className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    >
                        <option value="newest">Más recientes</option>
                        <option value="oldest">Más antiguas</option>
                        <option value="name-asc">Nombre A-Z</option>
                        <option value="name-desc">Nombre Z-A</option>
                        <option value="advisors-desc">Más advisors</option>
                        <option value="clients-desc">Más clientes</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paginatedCompanies.map((company) => {
                    const isSelected = selectedCompanyId === company.id;
                    const activity = getCompanyActivity(company);

                    return (
                        <article
                            key={company.id}
                            className={`group rounded-3xl border p-5 transition-all ${isSelected ? 'border-teal-500/40 bg-teal-500/10' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}
                        >
                            <button type="button" onClick={() => setSelectedCompanyId(company.id)} className="w-full text-left">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-300">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-semibold text-white">{company.nombre}</h2>
                                                <p className="text-xs text-slate-400">Creada {formatDate(company.createdAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activity === 'Activa' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-300'}`}>
                                        {activity}
                                    </span>
                                </div>

                                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-300">
                                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Advisors</p>
                                        <p className="mt-1 text-xl font-semibold text-white">{company.advisorCount ?? company.advisors?.length ?? 0}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Clientes</p>
                                        <p className="mt-1 text-xl font-semibold text-white">{company.clientCount ?? company.clients?.length ?? 0}</p>
                                    </div>
                                </div>
                            </button>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button variant="outline" className="h-10 w-auto px-3 text-xs" onClick={() => openCompanyModal(company)} isLoading={loadingDetail}>
                                    <Eye className="h-4 w-4" />
                                    Previsualizar
                                </Button>
                                <Button variant="outline" className="h-10 w-auto px-3 text-xs" onClick={() => navigate(`/companies/${company.id}`)}>
                                    <FileText className="h-4 w-4" />
                                    Detalles
                                </Button>
                            </div>
                        </article>
                    );
                })}
            </div>

            <Pagination currentPage={companyPage} totalPages={totalCompanyPages} onPageChange={setCompanyPage} />
        </div>
    );

    const detailSection = currentCompany ? (
        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-teal-300/80">{isAdvisor ? 'Tu empresa' : 'Detalle de empresa'}</p>
                    <h2 className="mt-2 text-3xl font-semibold text-white">{currentCompany.nombre}</h2>
                    <p className="mt-2 text-sm text-slate-400">Creada {formatDate(currentCompany.createdAt)} · Actualizada {formatDate(currentCompany.updatedAt)}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">{getCompanyActivity(currentCompany)}</span>
                        <span className="rounded-full bg-slate-500/10 px-3 py-1 text-slate-300">{currentCompany.advisorCount ?? currentCompany.advisors?.length ?? 0} advisors</span>
                        <span className="rounded-full bg-slate-500/10 px-3 py-1 text-slate-300">{currentCompany.clientCount ?? currentCompany.clients?.length ?? 0} clientes</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="w-auto px-4" onClick={() => downloadCsv(`${currentCompany.nombre}-empresa.csv`, [
                        ['Nombre', 'Advisors', 'Clientes', 'Creada', 'Actualizada'],
                        [currentCompany.nombre, String(currentCompany.advisorCount ?? currentCompany.advisors?.length ?? 0), String(currentCompany.clientCount ?? currentCompany.clients?.length ?? 0), formatDate(currentCompany.createdAt), formatDate(currentCompany.updatedAt)],
                    ])}>
                        <Download className="h-4 w-4" />
                        Exportar CSV
                    </Button>
                    <Button variant="outline" className="w-auto px-4" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        PDF / imprimir
                    </Button>
                    {isAdmin && !routeCompanyId && (
                        <Button className="w-auto px-4" onClick={() => navigate('/users/create', { state: { role: 'CLIENT', empresaId: currentCompany.id } })}>
                            <UserPlus className="h-4 w-4" />
                            Añadir cliente
                        </Button>
                    )}
                    {!isAdmin && (
                        <Button className="w-auto px-4" onClick={() => navigate('/users/create', { state: { role: 'CLIENT', empresaId: currentCompany.id } })}>
                            <UserPlus className="h-4 w-4" />
                            Nuevo cliente
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <CalendarDays className="h-4 w-4" />
                        Última modificación
                    </div>
                    <p className="mt-2 text-lg font-semibold text-white">{formatDate(currentCompany.updatedAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <ShieldCheck className="h-4 w-4" />
                        Estado operativo
                    </div>
                    <p className="mt-2 text-lg font-semibold text-white">{getCompanyActivity(currentCompany)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Users className="h-4 w-4" />
                        Cobertura
                    </div>
                    <p className="mt-2 text-lg font-semibold text-white">{(currentCompany.advisorCount ?? currentCompany.advisors?.length ?? 0) + (currentCompany.clientCount ?? currentCompany.clients?.length ?? 0)} perfiles activos</p>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                    <section className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-teal-300" />
                        <h3 className="text-lg font-semibold text-white">Advisors vinculados</h3>
                    </div>
                    <div className="space-y-3">
                        {(currentCompany.advisors || []).map((advisor) => (
                            <div key={advisor.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="font-medium text-white">{advisor.name}</p>
                                        <p className="text-sm text-slate-400">{advisor.email}</p>
                                    </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-slate-500">Vinculado desde {formatDate(advisor.createdAt)}</div>
                                            {isAdmin && (
                                                <Button variant="outline" className="h-9 w-auto px-3 text-xs" onClick={() => handleUnassignAdvisor(advisor.id)}>
                                                    Quitar
                                                </Button>
                                            )}
                                        </div>
                                </div>
                            </div>
                        ))}
                        {(currentCompany.advisors || []).length === 0 && <p className="text-sm text-slate-500">No hay advisors vinculados.</p>}
                    </div>

                    {isAdmin && !routeCompanyId && (
                        <div className="space-y-2 border-t border-white/10 pt-4">
                            <p className="text-sm text-slate-400">Advisors disponibles</p>
                            <div className="max-h-72 space-y-2 overflow-auto pr-1">
                                {availableAdvisors.map((advisor) => (
                                    <div key={advisor.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                        <div>
                                            <p className="font-medium text-white">{advisor.name}</p>
                                            <p className="text-xs text-slate-400">{advisor.email}</p>
                                        </div>
                                        <Button variant="outline" className="h-9 w-auto px-3 text-xs" onClick={() => handleAssignAdvisor(advisor.id)}>
                                            <UserPlus className="h-4 w-4" />
                                            Asignar
                                        </Button>
                                    </div>
                                ))}
                                {availableAdvisors.length === 0 && <p className="text-sm text-slate-500">No hay advisors libres para asignar.</p>}
                            </div>
                        </div>
                    )}
                </section>

                <section className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-teal-300" />
                            <h3 className="text-lg font-semibold text-white">Clientes</h3>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="h-9 w-auto px-3 text-xs" onClick={() => downloadCsv(`${currentCompany.nombre}-clientes.csv`, [
                                ['Nombre', 'Email', 'Documento', 'Tipo documento', 'Biometría', 'Creado'],
                                ...(currentCompany.clients || []).map((client) => [client.name, client.email, client.documentNumber ?? '', client.documentType ?? '', 'N/D', formatDate(client.createdAt)]),
                            ])}>
                                <Download className="h-4 w-4" />
                                Exportar
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Buscar cliente" className="pl-10" />
                            </div>
                        </div>
                        <div className="min-w-44">
                            <select
                                value={clientSort}
                                onChange={(e) => setClientSort(e.target.value as ClientSort)}
                                className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="newest">Más recientes</option>
                                <option value="oldest">Más antiguos</option>
                                <option value="name-asc">Nombre A-Z</option>
                                <option value="name-desc">Nombre Z-A</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {paginatedClients.map((client) => (
                            <div key={client.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="font-medium text-white">{client.name}</p>
                                        <p className="text-sm text-slate-400">{client.email}</p>
                                        <p className="mt-1 text-xs text-slate-500">{client.documentType ?? 'N/D'} · {client.documentNumber ?? 'N/D'}</p>
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">Alta {formatDate(client.createdAt)}</p>
                                    </div>

                                    <Menu as="div" className="relative inline-block text-left">
                                        <Menu.Button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                                            <MoreHorizontal className="h-4 w-4" />
                                            Acciones
                                        </Menu.Button>
                                        <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                            <Menu.Items className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-2xl border border-white/10 bg-[#111827] p-2 shadow-2xl focus:outline-none">
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => openClientEditor(client)}
                                                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${active ? 'bg-white/10 text-white' : 'text-slate-300'}`}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Ver detalles
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => openClientEditor(client)}
                                                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${active ? 'bg-white/10 text-white' : 'text-slate-300'}`}
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                            Editar información
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => toast('Registro de seguimiento pendiente de integración')}
                                                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${active ? 'bg-white/10 text-white' : 'text-slate-300'}`}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            Registrar seguimiento
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => toast('Cambio de estado pendiente de integración')}
                                                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${active ? 'bg-white/10 text-white' : 'text-slate-300'}`}
                                                        >
                                                            <Filter className="h-4 w-4" />
                                                            Cambiar estado
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteClient(client.id)}
                                                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${active ? 'bg-red-500/10 text-red-300' : 'text-red-300'}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Eliminar cliente
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </Menu.Items>
                                        </Transition>
                                    </Menu>
                                </div>
                            </div>
                        ))}

                        {paginatedClients.length === 0 && <p className="text-sm text-slate-500">No hay clientes que coincidan con los filtros.</p>}
                    </div>

                    <Pagination currentPage={clientPage} totalPages={totalClientPages} onPageChange={setClientPage} />
                </section>
            </div>

            <section className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-5">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-teal-300" />
                    <h3 className="text-lg font-semibold text-white">Historial de cambios</h3>
                </div>
                {companyAuditLogsError && <p className="text-sm text-amber-300">{companyAuditLogsError}</p>}
                <div className="space-y-3">
                    {companyAuditLogs.map((log) => (
                        <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="font-medium text-white">{log.action}</p>
                                <p className="text-xs text-slate-500">{formatDate(log.createdAt)}</p>
                            </div>
                            <p className="mt-1 text-slate-400">{log.user ? `${log.user.name} · ${log.user.email}` : 'Sistema'}</p>
                            {safeParseDetails(log.details) && (
                                <pre className="mt-2 overflow-auto rounded-xl bg-black/20 p-3 text-xs text-slate-400">{JSON.stringify(safeParseDetails(log.details), null, 2)}</pre>
                            )}
                        </div>
                    ))}
                    {companyAuditLogs.length === 0 && <p className="text-sm text-slate-500">Todavía no hay cambios registrados.</p>}
                </div>
            </section>
        </div>
    ) : null;

    return (
        <Layout>
            <div className="space-y-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-teal-300/80">
                            <Building2 className="h-4 w-4" />
                            Gestión de empresas
                        </div>
                        <h1 className="text-4xl font-bold text-white">{isAdmin ? 'Administración de empresas' : 'Mi empresa'}</h1>
                        <p className="max-w-3xl text-sm text-slate-400">
                            {isAdmin
                                ? 'Filtra, ordena y revisa empresas con acceso rápido al detalle, historial y acciones de vínculo.'
                                : 'Accede únicamente a la información de tu empresa y administra los clientes autorizados por tu rol.'}
                        </p>
                    </div>

                    {isAdmin && !routeCompanyId && (
                        <div className="w-full max-w-xl rounded-3xl border border-teal-500/20 bg-white/5 p-5 shadow-xl shadow-black/10">
                            <form onSubmit={handleCreateCompany} className="space-y-3">
                                <Input
                                    value={newCompanyName}
                                    onChange={(e) => {
                                        setNewCompanyName(e.target.value);
                                        if (companyNameError) validateCompanyName(e.target.value);
                                    }}
                                    placeholder="Nombre de empresa"
                                    label="Nueva empresa"
                                    error={companyNameError}
                                />
                                <Button type="submit">Crear empresa</Button>
                            </form>
                        </div>
                    )}
                </div>

                {loading && !currentCompany && <div className="text-slate-400">Cargando información...</div>}

                {!routeCompanyId && isAdmin && (
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Empresas</p>
                            <p className="mt-2 text-3xl font-semibold text-white">{filteredCompanies.length}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Advisors libres</p>
                            <p className="mt-2 text-3xl font-semibold text-white">{availableAdvisors.length}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Página</p>
                            <p className="mt-2 text-3xl font-semibold text-white">{companyPage}</p>
                        </div>
                    </div>
                )}

                {!routeCompanyId && isAdmin ? (
                    <div>{companyCards}</div>
                ) : (
                    detailSection
                )}
            </div>

            <Transition appear show={isDetailModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsDetailModalOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
                                    <div className="mb-4 flex items-start justify-between gap-4">
                                        <div>
                                            <Dialog.Title className="text-2xl font-semibold text-white">{modalCompany?.nombre ?? 'Detalle de empresa'}</Dialog.Title>
                                            <p className="mt-1 text-sm text-slate-400">Información completa y historial de cambios.</p>
                                        </div>
                                        <button onClick={() => setIsDetailModalOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {modalCompany && (
                                        <div className="space-y-4">
                                            <div className="grid gap-3 md:grid-cols-3">
                                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Advisors</p>
                                                    <p className="mt-1 text-2xl font-semibold text-white">{modalCompany.advisorCount ?? modalCompany.advisors?.length ?? 0}</p>
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Clientes</p>
                                                    <p className="mt-1 text-2xl font-semibold text-white">{modalCompany.clientCount ?? modalCompany.clients?.length ?? 0}</p>
                                                </div>
                                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</p>
                                                    <p className="mt-1 text-2xl font-semibold text-white">{getCompanyActivity(modalCompany)}</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <p className="text-sm text-slate-400">Advisors</p>
                                                    <div className="mt-3 space-y-2">
                                                        {(modalCompany.advisors || []).map((advisor) => (
                                                            <div key={advisor.id} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                                                                <p className="font-medium text-white">{advisor.name}</p>
                                                                <p className="text-xs text-slate-400">{advisor.email}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                                <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                    <p className="text-sm text-slate-400">Clientes</p>
                                                    <div className="mt-3 space-y-2">
                                                        {(modalCompany.clients || []).map((client) => (
                                                            <div key={client.id} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                                                                <p className="font-medium text-white">{client.name}</p>
                                                                <p className="text-xs text-slate-400">{client.email}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </section>
                                            </div>

                                            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-sm text-slate-400">Historial de cambios</p>
                                                {modalAuditLogsError && <p className="mt-2 text-sm text-amber-300">{modalAuditLogsError}</p>}
                                                <div className="mt-3 space-y-2">
                                                    {modalAuditLogs.map((log) => (
                                                        <div key={log.id} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                                                            <p className="font-medium text-white">{log.action}</p>
                                                            <p className="text-xs text-slate-500">{formatDate(log.createdAt)} · {log.user ? log.user.name : 'Sistema'}</p>
                                                        </div>
                                                    ))}
                                                    {modalAuditLogs.length === 0 && <p className="text-sm text-slate-500">Sin registros todavía.</p>}
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={clientModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setClientModalOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <div>
                                            <Dialog.Title className="text-2xl font-semibold text-white">{selectedClient?.name ?? 'Cliente'}</Dialog.Title>
                                            <p className="mt-1 text-sm text-slate-400">Edición rápida con validación en tiempo real.</p>
                                        </div>
                                        <button onClick={() => setClientModalOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Nombre</label>
                                            <Input value={clientDraft.name} onChange={(e) => updateClientDraft('name', e.target.value)} error={clientErrors.name} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Documento</label>
                                            <Input value={clientDraft.documentNumber} onChange={(e) => updateClientDraft('documentNumber', e.target.value)} error={clientErrors.documentNumber} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Dirección</label>
                                            <Input value={clientDraft.address} onChange={(e) => updateClientDraft('address', e.target.value)} error={clientErrors.address} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Tipo de documento</label>
                                            <select
                                                value={clientDraft.documentType}
                                                onChange={(e) => updateClientDraft('documentType', e.target.value)}
                                                className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                            >
                                                <option value="CC">CC</option>
                                                <option value="DNI">DNI</option>
                                                <option value="PASSPORT">Pasaporte</option>
                                                <option value="OTHER">Otro</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                                        <Button variant="outline" className="sm:w-auto" onClick={() => setClientModalOpen(false)}>
                                            Cancelar
                                        </Button>
                                        <Button className="sm:w-auto" onClick={() => void handleSaveClient()} isLoading={clientSaving}>
                                            Guardar cambios
                                        </Button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </Layout>
    );
}