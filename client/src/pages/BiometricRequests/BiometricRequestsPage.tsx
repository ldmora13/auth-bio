import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { BiometricRequestService, type BiometricRequestLogItem } from '../../services/biometricRequestService';
import { formatRelativeTime } from '../../lib/relativeTime';
import { Input } from '../../components/ui/Input';
import Pagination from '../../components/Pagination';
import { Search, RefreshCcw, Mail, CheckCircle2, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';

const PAGE_SIZE = 10;

function getEmailStatusLabel(code: number | null) {
    if (code === null) return 'Sin respuesta';
    if (code >= 200 && code < 300) return 'Enviado correctamente';

    const labels: Record<number, string> = {
        400: 'Solicitud inválida',
        401: 'No autenticado',
        403: 'No autorizado',
        404: 'Recurso no encontrado',
        408: 'Tiempo de espera agotado',
        429: 'Demasiadas solicitudes',
        500: 'Error interno del servidor',
        502: 'Servicio no disponible',
        503: 'Servicio temporalmente no disponible',
    };

    return labels[code] ?? 'Error al enviar';
}

function EmailStatusBadge({ code, message, sentAt }: { code: number | null; message: string | null; sentAt: string }) {
    const isSuccess = code !== null && code >= 200 && code < 300;
    const label = getEmailStatusLabel(code);
    return (
        <div className="flex flex-col gap-0.5">
            <span
                title={message ? `${label}: ${message}` : label}
                className={clsx(
                    'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                    isSuccess ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                )}
            >
                <Mail className="h-3.5 w-3.5" />
                {label} ({code ?? 'N/D'})
            </span>
            <span className="text-xs text-slate-500">{formatRelativeTime(sentAt)} ago</span>
        </div>
    );
}

function StatusBadge({ status }: { status: 'COMPLETED' | 'PENDING' }) {
    const isCompleted = status === 'COMPLETED';
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                isCompleted ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
            )}
        >
            {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {isCompleted ? 'Completado' : 'Pendiente'}
        </span>
    );
}

export default function BiometricRequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<BiometricRequestLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'COMPLETED' | 'PENDING'>('all');
    const [page, setPage] = useState(1);

    async function loadRequests() {
        setLoading(true);
        try {
            setRequests(await BiometricRequestService.getAll());
        } catch {
            toast.error('No se pudo cargar el historial de solicitudes biométricas');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadRequests();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [search, statusFilter]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return requests.filter((request) => {
            const matchesSearch = !term || [request.client.name, request.client.email, request.requestedBy?.name ?? '', request.requestedBy?.email ?? '']
                .join(' ')
                .toLowerCase()
                .includes(term);
            const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [requests, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (!user || user.role !== 'ADMIN') {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Solicitudes biométricas</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Seguimiento de correos enviados a clientes y estado de su verificación biométrica.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadRequests()}
                        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 hover:bg-white/10"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Actualizar
                    </button>
                </div>

                <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-400">Buscar</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente o asesor" className="pl-10" />
                        </div>
                    </div>
                    <div className="min-w-44">
                        <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-400">Estado</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                        >
                            <option value="all">Todos</option>
                            <option value="COMPLETED">Completado</option>
                            <option value="PENDING">Pendiente</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-240">
                        <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                            <tr>
                                <th className="px-4 py-3">Empresa</th>
                                <th className="px-4 py-3">Cliente</th>
                                <th className="px-4 py-3">Asesor</th>
                                <th className="px-4 py-3">Métodos</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>Cargando solicitudes...</td>
                                </tr>
                            )}
                            {!loading && paginated.map((request) => (
                                <tr key={request.id} className="border-t border-white/10 text-sm text-slate-200">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-white">{request.client.companyName ?? 'Sin empresa'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-white">{request.client.name}</p>
                                        <p className="text-xs text-slate-400">{request.client.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {request.requestedBy ? (
                                            <>
                                                <p className="font-medium text-white">{request.requestedBy.name}</p>
                                                <p className="text-xs text-slate-400">{request.requestedBy.email}</p>
                                            </>
                                        ) : (
                                            <span className="text-xs text-slate-500">N/D</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-300">{request.biometricMethods.join(', ')}</td>
                                    <td className="px-4 py-3">
                                        <EmailStatusBadge code={request.emailStatusCode} message={request.emailStatusMessage} sentAt={request.emailSentAt} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={request.status} />
                                    </td>
                                </tr>
                            ))}
                            {!loading && paginated.length === 0 && (
                                <tr>
                                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>No hay solicitudes que coincidan con los filtros.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
        </Layout>
    );
}