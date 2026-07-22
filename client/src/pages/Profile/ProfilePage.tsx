import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout';
import UserAvatar from '../../components/UserAvatar';
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator';
import { useAuth } from '../../context/AuthContext';
import { User, Shield, Save, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { t } from 'i18next';

// ————— Personal Info Tab —————
function PersonalInfo() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: '',
    city: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Mock: show coming soon
    await new Promise(r => setTimeout(r, 800));
    toast.success('Próximamente: edición de perfil');
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Avatar column */}
      <div className="flex flex-col items-center gap-4 glass rounded-3xl p-8">
        <UserAvatar name={user?.name || ''} role={user?.role as any} size="xl" showBadge />
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">{user?.name}</h3>
          <p className="text-slate-400 text-sm">{user?.email}</p>
          <span className={clsx(
            'mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold',
            user?.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
            user?.role === 'ADVISOR' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          )}>
            {user?.role}
          </span>
        </div>
      </div>

      {/* Form column */}
      <div className="lg:col-span-2 glass rounded-3xl p-8">
        <h2 className="text-lg font-bold text-white mb-6">{t('profile.personal_info.title')}</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.personal_info.full_name')}</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.personal_info.email')}</label>
            <input
              value={user?.email}
              disabled
              className="w-full px-4 py-3 bg-black/20 border border-white/5 rounded-xl text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-600 mt-1">{t('profile.personal_info.email_cant_be_changed')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.personal_info.phone')}</label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.personal_info.city_country')}</label>
            <input
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
              placeholder="Ej: Bogotá, Colombia"
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 transition-all"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? t('profile.personal_info.saving') : t('profile.personal_info.save_changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ————— Security Tab —————
function SecurityTab() {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (form.next !== form.confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await changePassword({
        currentPassword: form.current,
        newPassword: form.next,
      });
      toast.success(t('profile.security.password_changed_success') || 'Contraseña cambiada con éxito');
      setForm({ current: '', next: '', confirm: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      const message = error.response?.data?.error || error.message || 'Error al cambiar la contraseña';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="glass rounded-3xl p-8">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-400" />
          {t('profile.security.title')}
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.security.current_password')}</label>
            <input
              type="password"
              value={form.current}
              onChange={e => setForm({ ...form, current: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.security.new_password')}</label>
            <input
              type="password"
              value={form.next}
              onChange={e => setForm({ ...form, next: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 transition-all"
            />
            <PasswordStrengthIndicator password={form.next} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">{t('profile.security.confirm_password')}</label>
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white placeholder-slate-500 transition-all"
            />
            {form.confirm && form.next !== form.confirm && (
              <p className="text-xs text-red-400 mt-1">{t('profile.security.password_mismatch')}</p>
            )}
          </div>

          <button
            onClick={handleChange}
            disabled={saving || !form.current || !form.next || !form.confirm}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {saving ? t('profile.security.saving') : t('profile.security.save_changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ————— Main ProfilePage —————
function ProfileContent() {
  const location = useLocation();

  const tabs = [
    { path: '/profile', label: t('profile.personal_info.title'), icon: User, exact: true },
    { path: '/profile/security', label: t('profile.security.title'), icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-blue-300">
          {t('profile.title')}
        </h1>
        <p className="text-slate-400 mt-1">{t('profile.description')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-black/20 rounded-2xl border border-white/10 w-fit">
        {tabs.map(tab => {
          const isActive = tab.exact
            ? location.pathname === tab.path
            : location.pathname.startsWith(tab.path) && tab.path !== '/profile';
          const isDefault = tab.exact && location.pathname === '/profile';

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                (isActive || isDefault)
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Routes>
          <Route index element={<PersonalInfo />} />
          <Route path="security" element={<SecurityTab />} />
        </Routes>
      </motion.div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Layout>
      <ProfileContent />
    </Layout>
  );
}