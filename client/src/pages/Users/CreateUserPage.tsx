import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { UserService, type CreateUserData } from '../../services/userService';
import { canAccessCompanies, canCreateAdvisor, canCreateClient } from '../../lib/roles';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { DocumentType } from '../../types/auth';

type FormErrors = Partial<Record<keyof CreateUserData | 'profilePhotoFile', string>>;

const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
    });
}

export default function CreateUserPage() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams<{ id?: string }>();
    const locationState = (location.state ?? {}) as { empresaId?: string };

    const routeCompanyId = params.id;
    const presetCompanyId = locationState.empresaId ?? routeCompanyId;

    const [companies, setCompanies] = useState<Array<{ id: string; nombre: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const [formData, setFormData] = useState<CreateUserData>({
        email: '',
        password: '',
        name: '',
        address: '',
        phone: '',
        birthDate: '',
        age: undefined,
        profilePhotoUrl: '',
        documentType: 'CC',
        documentNumber: '',
        role: 'CLIENT',
        empresaId: presetCompanyId,
        biometricMethods: ['DACTILAR'],
    });

    const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');

    const isAdmin = currentUser?.role === 'ADMIN';
    const isAdvisor = currentUser?.role === 'ADVISOR';

    useEffect(() => {
        if (!currentUser || !canAccessCompanies(currentUser.role)) {
            navigate('/dashboard', { replace: true });
            return;
        }

        if (isAdmin && canCreateAdvisor(currentUser.role)) {
            setFormData((prev) => ({
                ...prev,
                role: 'ADVISOR',
                biometricMethods: undefined,
                age: undefined,
                birthDate: '',
                phone: '',
                profilePhotoUrl: '',
            }));
            void UserService.getCompanies().then(setCompanies).catch(() => setCompanies([]));
        }

        if (isAdvisor && canCreateClient(currentUser.role)) {
            setFormData((prev) => ({
                ...prev,
                role: 'CLIENT',
                empresaId: currentUser.empresaId ?? presetCompanyId,
                biometricMethods: prev.biometricMethods ?? ['DACTILAR'],
            }));
        }
    }, [currentUser, isAdmin, isAdvisor, navigate, presetCompanyId]);

    const title = useMemo(() => {
        if (isAdmin) return 'Registrar nuevo advisor';
        return 'Registrar nuevo cliente';
    }, [isAdmin]);

    const canSubmit = !!currentUser && (isAdmin || isAdvisor);

    if (!canSubmit) return null;

    function setField<K extends keyof CreateUserData>(field: K, value: CreateUserData[K]) {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    }

    function validate(): boolean {
        const nextErrors: FormErrors = {};

        if (!formData.name.trim()) nextErrors.name = 'El nombre es obligatorio';
        if (!formData.email.trim()) nextErrors.email = 'El correo es obligatorio';
        if (!formData.address.trim()) nextErrors.address = 'La direccion es obligatoria';
        if (!formData.documentNumber.trim()) nextErrors.documentNumber = 'El documento es obligatorio';

        if (formData.role === 'ADVISOR') {
            if (!formData.password || formData.password.length < 6) {
                nextErrors.password = 'La clave temporal debe tener al menos 6 caracteres';
            }
            if (!formData.empresaId) {
                nextErrors.empresaId = 'Debes seleccionar una empresa';
            }
        }

        if (formData.role === 'CLIENT') {
            if (!formData.phone?.trim()) nextErrors.phone = 'El telefono es obligatorio';
            if (!formData.birthDate) nextErrors.birthDate = 'La fecha de nacimiento es obligatoria';
            if (!formData.age || Number(formData.age) < 18) nextErrors.age = 'El cliente debe ser mayor de 18 anios';
            if (!formData.profilePhotoUrl) nextErrors.profilePhotoUrl = 'La foto de perfil es obligatoria';
            if (!formData.biometricMethods?.includes('DACTILAR')) nextErrors.biometricMethods = 'Dactilar es obligatorio';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setErrors((prev) => ({ ...prev, profilePhotoFile: 'El archivo debe ser una imagen valida' }));
            return;
        }

        if (file.size > MAX_PROFILE_PHOTO_SIZE) {
            setErrors((prev) => ({ ...prev, profilePhotoFile: 'La imagen supera 2MB' }));
            return;
        }

        try {
            const dataUrl = await fileToDataUrl(file);
            setField('profilePhotoUrl', dataUrl);
            setProfilePhotoPreview(dataUrl);
            setErrors((prev) => ({ ...prev, profilePhotoFile: undefined, profilePhotoUrl: undefined }));
        } catch {
            setErrors((prev) => ({ ...prev, profilePhotoFile: 'No se pudo procesar la imagen' }));
        }
    }

    function handleBirthDateChange(value: string) {
        setField('birthDate', value);
        if (!value) return;

        const today = new Date();
        const birthDate = new Date(value);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age -= 1;
        }

        setField('age', age);
        if (age < 18) {
            setErrors((prev) => ({ ...prev, age: 'El cliente debe ser mayor de 18 anios' }));
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const payload: CreateUserData = {
                ...formData,
                address: formData.address.trim(),
                email: formData.email.trim(),
                name: formData.name.trim(),
                documentNumber: formData.documentNumber.trim(),
            };

            if (payload.role === 'ADVISOR') {
                payload.phone = undefined;
                payload.birthDate = undefined;
                payload.age = undefined;
                payload.profilePhotoUrl = undefined;
                payload.biometricMethods = undefined;
            } else {
                payload.password = undefined;
                payload.empresaId = currentUser?.empresaId ?? payload.empresaId;
                payload.biometricMethods = payload.biometricMethods ?? ['DACTILAR'];
            }

            await UserService.create(payload);
            toast.success(payload.role === 'ADVISOR' ? 'Advisor creado correctamente' : 'Cliente creado correctamente');

            const destinationCompanyId = payload.empresaId ?? currentUser?.empresaId ?? routeCompanyId;
            navigate(destinationCompanyId ? `/companies/${destinationCompanyId}` : '/companies');
        } catch (error: unknown) {
            const message =
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
                    ? (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'No se pudo crear el usuario'
                    : 'No se pudo crear el usuario';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <Link to={routeCompanyId ? `/companies/${routeCompanyId}` : '/companies'} className="mb-6 inline-flex items-center text-teal-300 hover:text-teal-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a empresas
            </Link>

            <div className="glass rounded-3xl p-8">
                <h1 className="text-3xl font-bold text-white">{title}</h1>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="hidden">
                        <label className="mb-2 block text-sm font-medium text-slate-300">Rol</label>
                        <Input value={formData.role === 'ADVISOR' ? 'ADVISOR' : 'CLIENT'} disabled />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Nombre completo</label>
                            <Input value={formData.name} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Correo electronico</label>
                            <Input type="email" value={formData.email} onChange={(e) => setField('email', e.target.value)} error={errors.email} />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Direccion</label>
                            <Input value={formData.address} onChange={(e) => setField('address', e.target.value)} error={errors.address} />
                        </div>

                        {formData.role === 'ADVISOR' && (
                            <>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Empresa</label>
                                    <select
                                        value={formData.empresaId ?? ''}
                                        onChange={(e) => setField('empresaId', e.target.value)}
                                        className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    >
                                        <option value="">Selecciona una empresa</option>
                                        {companies.map((company) => (
                                            <option key={company.id} value={company.id}>{company.nombre}</option>
                                        ))}
                                    </select>
                                    {errors.empresaId && <p className="mt-1 text-sm text-red-400">{errors.empresaId}</p>}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Clave temporal</label>
                                    <Input type="password" value={formData.password ?? ''} onChange={(e) => setField('password', e.target.value)} error={errors.password} />
                                </div>
                            </>
                        )}

                        {formData.role === 'CLIENT' && (
                            <>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Telefono</label>
                                    <Input value={formData.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} error={errors.phone} />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Fecha de nacimiento</label>
                                    <Input type="date" value={formData.birthDate ?? ''} onChange={(e) => handleBirthDateChange(e.target.value)} error={errors.birthDate} />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">Edad</label>
                                    <Input type="number" min={18} max={120} value={formData.age ?? ''} onChange={(e) => setField('age', Number(e.target.value))} error={errors.age} />
                                </div>
                                <div>
                                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                                        Foto de perfil
                                        <span title="Formatos permitidos: PNG, JPG y WEBP. Tamano maximo 2MB."><Info className="h-4 w-4 text-slate-400" /></span>
                                    </label>
                                    <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange as any} />
                                    {(errors.profilePhotoFile || errors.profilePhotoUrl) && (
                                        <p className="mt-1 text-sm text-red-400">{errors.profilePhotoFile ?? errors.profilePhotoUrl}</p>
                                    )}
                                    {profilePhotoPreview && (
                                        <img src={profilePhotoPreview} alt="Vista previa de perfil" className="mt-2 h-20 w-20 rounded-xl border border-white/20 object-cover" />
                                    )}
                                </div>
                            </>
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Tipo de documento</label>
                            <select
                                value={formData.documentType}
                                onChange={(e) => setField('documentType', e.target.value as DocumentType)}
                                className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="CC">CC</option>
                                <option value="DNI">DNI</option>
                                <option value="PASSPORT">Pasaporte</option>
                                <option value="OTHER">Otro</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Numero de documento</label>
                            <Input value={formData.documentNumber} onChange={(e) => setField('documentNumber', e.target.value)} error={errors.documentNumber} />
                        </div>
                    </div>

                    {formData.role === 'CLIENT' && (
                        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                            <label className="block text-sm font-medium text-white">Registro biometrico</label>
                            <p className="mt-1 text-xs text-slate-400">Dactilar es obligatorio. Puedes sumar reconocimiento facial u ocular.</p>
                            <div className="mt-3 space-y-2">
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-white">Dactilar</span>
                                    <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs text-teal-300">Obligatorio</span>
                                </label>
                                {(['FACIAL', 'OCULAR'] as const).map((method) => {
                                    const checked = formData.biometricMethods?.includes(method) ?? false;
                                    return (
                                        <label key={method} className="flex items-center justify-between text-sm text-slate-300">
                                            <span>{method === 'FACIAL' ? 'Facial' : 'Ocular'}</span>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    const current = formData.biometricMethods ?? ['DACTILAR'];
                                                    const next = checked ? current.filter((item) => item !== method) : [...current, method];
                                                    setField('biometricMethods', next);
                                                }}
                                                className="h-4 w-4 rounded border-white/30 bg-transparent"
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                            {errors.biometricMethods && <p className="mt-2 text-sm text-red-400">{errors.biometricMethods}</p>}
                        </div>
                    )}

                    <div className="pt-3">
                        <Button type="submit" isLoading={loading} disabled={loading}>
                            {formData.role === 'ADVISOR' ? 'Crear advisor' : 'Crear cliente'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
