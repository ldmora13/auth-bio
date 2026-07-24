import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { Users, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStats } from '../features/dashboard/hooks/useStats';
import { motion } from 'framer-motion';
import { canManageCompanies } from '../lib/roles';

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

                {user?.role === 'ADVISOR' && user.empresa?.nombre && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="glass rounded-3xl p-6 border border-teal-500/20 bg-teal-500/5"
                    >
                        <p className="text-xs uppercase tracking-[0.25em] text-teal-300/80">Empresa asignada</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{user.empresa.nombre}</h2>
                        <p className="mt-1 text-sm text-slate-300">Tu acceso y gestión de clientes se limitan a esta organización.</p>
                    </motion.div>
                )}

                {/* Stats Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-3xl p-8 border border-teal-500/20 shadow-xl shadow-teal-500/5"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-teal-500/10 rounded-2xl">
                                <Users className="w-8 h-8 text-teal-400" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Usuarios totales</p>
                                <h2 className="text-5xl font-bold text-white mt-1">{stats?.totalUsers || 0}</h2>
                            </div>
                        </div>
                        <Link
                            to="/users"
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 hover:border-teal-500/50 transition-all font-medium"
                        >
                            {canManageCompanies(user?.role) ? 'Gestionar usuarios' : 'Gestionar clientes'}
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </motion.div>
            </div>
        </Layout>
    );
}