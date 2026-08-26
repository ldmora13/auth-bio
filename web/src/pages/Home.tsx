import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { getBiometricMethodLabel, resolveBiometricMethods, type BiometricMethod } from '../shared/biometricMethods';

type DocumentType = 'CC' | 'DNI' | 'PASSPORT' | 'OTHER';

type ClientProfile = {
    id: string;
    name: string;
    email: string;
    role: 'CLIENT';
    address?: string | null;
    documentType?: DocumentType | null;
    documentNumber?: string | null;
    company?: string | null;
    biometricType?: BiometricMethod | null;
    biometricMethods?: BiometricMethod[] | null;
    biometricEnrollmentRequired?: boolean;
    createdAt: string;
    updatedAt: string;
    profilePhotoUrl?: string | null;
};

type HomeLocationState = {
    profile?: ClientProfile | null;
    documentType?: string;
    documentNumber?: string;
};

export default function Home() {
    const location = useLocation();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<ClientProfile | null>((location.state as HomeLocationState | null)?.profile ?? null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState('');
    const documentType = (location.state as HomeLocationState | null)?.documentType ?? localStorage.getItem('clientDocumentType') ?? undefined;
    const documentNumber = (location.state as HomeLocationState | null)?.documentNumber ?? localStorage.getItem('clientDocumentNumber') ?? undefined;

    useEffect(() => {
        const stateProfile = (location.state as HomeLocationState | null)?.profile ?? null;

        if (stateProfile) {
            setProfile(stateProfile);
            setProfileError('');
            return;
        }

        const searchParams = new URLSearchParams(location.search);
        const clientId = searchParams.get('clientId');

        if (!clientId) {
            setProfile(null);
            setProfileError('');
            return;
        }

        let isActive = true;

        const loadClientProfile = async () => {
            setLoadingProfile(true);
            setProfileError('');

            try {
                const { data } = await api.get<{ user: ClientProfile }>(`/auth/client/${clientId}`);

                if (isActive) {
                    setProfile(data.user);
                }
            } catch (error: unknown) {
                if (!isActive) {
                    return;
                }

                const message = axios.isAxiosError(error)
                    ? error.response?.data?.error || 'No pudimos recuperar la información del cliente.'
                    : 'No pudimos recuperar la información del cliente.';
                setProfile(null);
                setProfileError(message);
            } finally {
                if (isActive) {
                    setLoadingProfile(false);
                }
            }
        };

        void loadClientProfile();

        return () => {
            isActive = false;
        };
    }, [location.search, location.state]);

    const handleConfirm = () => {
        const biometricMethods = resolveBiometricMethods(profile ?? undefined);

        localStorage.setItem('clientBiometricMethods', JSON.stringify(biometricMethods));
        localStorage.setItem('clientBiometricEnrollmentRequired', String(Boolean(profile?.biometricEnrollmentRequired)));

        if (profile?.id) localStorage.setItem('clientId', profile.id);
        if (profile?.documentType) localStorage.setItem('clientDocumentType', profile.documentType);
        if (profile?.documentNumber) localStorage.setItem('clientDocumentNumber', profile.documentNumber);

        navigate('/verification', {
            state: {
                biometricMethods,
                biometricEnrollmentRequired: profile?.biometricEnrollmentRequired ?? false,
                clientId: profile?.id,
                documentType: profile?.documentType ?? documentType,
                documentNumber: profile?.documentNumber ?? documentNumber,
            },
        });
    };

    if (!profile) {
        return (
            <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
                <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <h1 className="text-2xl font-semibold text-slate-900">
                        {loadingProfile ? 'Cargando información del cliente' : 'No hay información del cliente disponible'}
                    </h1>
                    <p className="mt-3 text-sm text-slate-600">
                        {loadingProfile
                            ? 'Estamos recuperando los datos desde el enlace compartido.'
                            : profileError || 'Regrese al inicio para verificar un documento.'}
                    </p>
                    <button
                        type="button"
                        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
                        onClick={() => navigate('/', { replace: true })}
                    >
                        Volver al inicio
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
            <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen del cliente</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Verifique sus datos</h1>
                </div>

                <div className="px-6 py-6 sm:px-8 sm:py-8">
                    <section className="space-y-6" aria-live="polite">
                        <div className="flex items-center justify-center">
                            {profile.profilePhotoUrl ? (
                                <img
                                    src={profile.profilePhotoUrl}
                                    alt="Foto de perfil"
                                    className="h-50 w-auto rounded-xl border border-slate-200 object-cover shadow-sm"
                                />
                            ) : null}
                        </div>

                        <dl className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Nombre completo</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{profile.name}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Tipo de documento</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{profile.documentType || 'No registrado'}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Número de documento</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{profile.documentNumber || 'No registrado'}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Dirección</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{profile.address || 'No registrada'}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Correo electrónico</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{profile.email}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Tipo de biometría</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">
                                    {resolveBiometricMethods(profile).map(getBiometricMethodLabel).join(' · ')}
                                </dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Estado de registro</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">
                                    {profile.biometricEnrollmentRequired ? 'Pendiente de completar' : 'Completado'}
                                </dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Fecha de registro</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{new Date(profile.createdAt).toLocaleDateString('es-CO')}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <dt className="text-sm font-semibold text-slate-700">Última actualización</dt>
                                <dd className="mt-1 text-base font-medium text-slate-900">{new Date(profile.updatedAt).toLocaleDateString('es-CO')}</dd>
                            </div>
                        </dl>

                        <span className="block text-sm font-semibold text-slate-700">
                            Si alguno de estos datos es incorrecto, por favor comuníquese con su asesor.
                        </span>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                id="confirm-data"
                                className="inline-flex h-12 min-w-44 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
                                type="button"
                                onClick={handleConfirm}
                            >
                                Verificar mis datos
                            </button>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}