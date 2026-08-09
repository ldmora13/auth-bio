import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStats } from '../features/dashboard/hooks/useStats';
import { motion } from 'framer-motion';

function StatCard({ title, value, helper }: { title: string; value: string | number; helper?: string }) {
    return (
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
        </article>
    );
}

// ————— MAIN DASHBOARD —————
export default function Dashboard() {
    const { user } = useAuth();
    const { stats, isLoading, isError } = useStats();
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    if (isError) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <p className="text-slate-400">Error al cargar el dashboard</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-linear-to-r from-teal-400 to-teal-300">
                        {t('dashboard.welcome')}
                    </h1>
                    <p className="text-slate-400 mt-1">
                        {user?.name} · {user?.role}
                        {user?.role === 'ADVISOR' && user?.empresa?.nombre && (
                            <span className="ml-2 px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full text-sm">
                                {user.empresa.nombre}
                            </span>
                        )}
                    </p>
                </motion.div>

                {stats?.role === 'ADMIN' && stats.totals && (
                    <>
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                        >
                            <StatCard title="Empresas activas" value={`${stats.totals.activationRate}%`} helper={`${stats.totals.totalCompanies} empresas`} />
                            <StatCard title="Biometria global" value={`${stats.totals.globalBiometricCompletionRate}%`} helper={`${stats.totals.totalClients} clientes`} />
                            <StatCard title="Asesores totales" value={stats.totals.totalAdvisors} helper="En toda la plataforma" />
                            <StatCard title="Clientes totales" value={stats.totals.totalClients} />
                            <StatCard title="Procesos clave" value={`${stats.totals.keyProcessCompletionRate}%`} helper="Promedio por empresa" />
                        </motion.section>

                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="rounded-3xl border border-white/10 bg-white/5 p-6"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Rendimiento por empresa</h2>
                                    <p className="text-sm text-slate-400">Clientes, advisors y finalizacion biometrica.</p>
                                </div>
                                <Link
                                    to="/companies"
                                    className="inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/20"
                                >
                                    Ver empresas
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                            <div className="mt-6 space-y-4">
                                {(stats.companyBreakdown ?? []).map((company) => (
                                    <div key={company.companyId} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-white">{company.companyName}</p>
                                            <span className="text-sm text-teal-300">{company.completionRate}% completado</span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                                            <div className="h-full rounded-full bg-linear-to-r from-teal-500 to-cyan-400" style={{ width: `${Math.max(company.completionRate, 4)}%` }} />
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                                            <span className="inline-flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {company.clients} clientes</span>
                                            <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> {company.advisors} advisors</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    </>
                )}

                {stats?.role === 'ADVISOR' && (
                    <>
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="grid gap-4 md:grid-cols-3"
                        >
                            <StatCard title="Tus clientes" value={stats.ownClientsTotal ?? 0} />
                            <StatCard title="Completado biometrico" value={`${stats.ownClientCompletionRate ?? 0}%`} />
                            <StatCard title="Pendientes" value={stats.pendingProcesses ?? 0} helper="Procesos por completar" />
                        </motion.section>

                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="rounded-3xl border border-white/10 bg-white/5 p-6"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Actividad semanal</h2>
                                    <p className="text-sm text-slate-400">Clientes creados en los ultimos 7 dias.</p>
                                </div>
                                <TrendingUp className="h-6 w-6 text-teal-300" />
                            </div>
                            <div className="mt-6 grid grid-cols-7 gap-2">
                                {(stats.weeklyClientActivity ?? []).map((day) => (
                                    <div key={day.day} className="rounded-xl border border-white/10 bg-black/10 p-2 text-center">
                                        <div className="mx-auto h-20 w-3 rounded-full bg-slate-800">
                                            <div
                                                className="mt-auto h-full rounded-full bg-teal-400"
                                                style={{ height: `${Math.max(day.createdCount * 20, day.createdCount > 0 ? 20 : 4)}%` }}
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-400">{day.day}</p>
                                        <p className="text-sm font-semibold text-white">{day.createdCount}</p>
                                    </div>
                                ))}
                            </div>
                            <Link
                                to={user?.empresa?.id ? `/companies/${user.empresa.id}` : '/companies'}
                                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/20"
                            >
                                Gestionar mis clientes
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </motion.section>
                    </>
                )}

                {!stats && (
                    <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-amber-100">
                        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Sin datos disponibles aun.</div>
                    </div>
                )}
            </div>
        </Layout>
    );
}