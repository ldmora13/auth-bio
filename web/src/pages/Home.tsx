import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { getBiometricMethodLabel, resolveBiometricMethods, type BiometricMethod } from '../shared/biometricMethods';
import GovernmentHeader from '../components/GovernmentHeader';

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
                const { data } = await api.get<{ user: ClientProfile }>(`/auth/client/${clientId}`, {
                    timeout: 15000,
                });

                if (isActive) {
                    setProfile(data.user);
                }
            } catch (error: unknown) {
                if (!isActive) {
                    return;
                }

                const message = axios.isAxiosError(error)
                    ? error.code === 'ECONNABORTED' || error.message?.includes('timeout')
                        ? 'The request took too long and the client information is not available right now.'
                        : error.response?.data?.error || 'We could not retrieve the client information.'
                    : 'We could not retrieve the client information.';
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
            <main className="min-h-screen bg-[#f3f7f9] text-[#005288]"><GovernmentHeader compact />
                <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8"><div className="border-b-4 border-[#003e67] bg-white p-8 shadow-[0_10px_30px_rgba(0,62,103,0.08)]">
                    {loadingProfile ? (
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#b8cfdd] border-t-[#003e67]" aria-hidden="true" />
                            <h1 className="mt-6 text-2xl font-bold text-[#005288]">Loading client information</h1>
                            <p className="mt-3 font-sans text-sm text-[#31566d]">Please wait while we verify the client data.</p>
                                <p className="mt-3 font-sans text-sm text-[#31566d]">Please wait while we verify the client data.</p>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold text-[#005288]">No client information available</h1>
                                <h1 className="text-2xl font-bold text-[#005288]">No client information available</h1>
                                <p className="mt-3 font-sans text-sm text-[#31566d]">
                                {profileError || 'Return to the home page to verify a document.'}
                            </p>
                            <button
                                type="button"
                                className="mt-6 inline-flex h-12 items-center justify-center rounded-sm bg-[#003e67] px-5 font-sans text-base font-bold text-white shadow-sm transition hover:bg-[#005288]"
                                onClick={() => navigate('/', { replace: true })}
                            >
                                Back to home
                            </button>
                        </>
                    )}
                </div></section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#f3f7f9] text-[#005288]"><GovernmentHeader compact />
            <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="border-b-4 border-[#003e67] bg-white px-6 py-7 shadow-[0_10px_30px_rgba(0,62,103,0.08)] sm:px-10">
                    <h1 className="text-3xl font-bold tracking-tight text-[#005288] sm:text-4xl">Verify your data</h1>
                    <p className="mt-3 font-sans text-base text-[#31566d]">Review your information before starting biometric verification.</p>
                </div>

                <div className="bg-white px-6 py-7 sm:px-10 sm:py-9">
                    <section className="space-y-6" aria-live="polite">
                        <div className="flex items-center justify-center">
                            {profile.profilePhotoUrl ? (
                                <img
                                    src={profile.profilePhotoUrl}
                                    alt="Profile photo"
                                    className="h-50 w-auto rounded-sm border border-[#b8cfdd] object-cover shadow-sm"
                                />
                            ) : null}
                        </div>

                        <dl className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Full name</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{profile.name}</dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Full name</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{profile.name}</dd>
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Document type</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{profile.documentType || 'No registrado'}</dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Document number</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{profile.documentNumber || 'No registrado'}</dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Address</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{profile.address || 'No registrada'}</dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Email Address</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{profile.email}</dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Biometric Methods to verify</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">
                                    {resolveBiometricMethods(profile).map(getBiometricMethodLabel).join(' · ')}
                                </dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Registration Status</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">
                                    {profile.biometricEnrollmentRequired ? 'Pendiente de completar' : 'Completado'}
                                </dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Registration Date</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{new Date(profile.createdAt).toLocaleDateString('es-CO')}</dd>
                            </div>
                            <div className="rounded-sm border border-[#b8cfdd] bg-[#eef5f8] px-4 py-4">
                                <dt className="font-sans text-sm font-bold text-[#003e67]">Last Update</dt>
                                <dd className="mt-1 font-sans text-base font-medium text-[#005288]">{new Date(profile.updatedAt).toLocaleDateString('es-CO')}</dd>
                            </div>
                        </dl>

                        <span className="block font-sans text-sm font-bold text-[#003e67]">
                            If the information is correct, click the button below to verify your data. Otherwise, please contact the company that provided you with this link.
                        </span>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                id="confirm-data"
                                className="inline-flex h-12 min-w-44 items-center justify-center rounded-sm bg-[#003e67] px-5 font-sans text-base font-bold text-white shadow-sm transition hover:bg-[#005288] focus:outline-none focus:ring-4 focus:ring-[#b8cfdd]"
                                type="button"
                                onClick={handleConfirm}
                            >
                                Verify my data
                            </button>
                        </div>
                    </section>
                </div>
            </section>
        </main>
    );
}