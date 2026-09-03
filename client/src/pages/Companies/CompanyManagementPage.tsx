import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { canAccessCompanies } from '../../lib/roles';
import { UserService, type BiometricMethod, type CompanyAuditLog } from '../../services/userService';
import type { Empresa, User } from '../../types/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Pagination from '../../components/Pagination';
import { toast } from 'react-hot-toast';
import {
    Building2,
    Download,
    Eye,
    FileText,
    Search,
    UserPlus,
    Users,
    X,
    Send,
    Info,
    Trash,
    FingerprintPattern,
} from 'lucide-react';

type CompanySort = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'advisors-desc' | 'clients-desc';
type CompanyStatusFilter = 'all' | 'active' | 'empty';
type AdvisorSort = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type ClientSort = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type ClientDraft = {
    email: string;
    name: string;
    address: string;
    phone: string;
    birthDate: string;
    age: number;
    profilePhotoUrl: string;
    documentType: 'CC' | 'DNI' | 'PASSPORT' | 'OTHER';
    documentNumber: string;
    caseNumber: string;
    processNumber: string;
    formId: string;
    nativeCountry: string;
    sex: string;
    validFrom: string;
    cardExpires: string;
    migratoryStatus: string;
    receivedDate: string;
    deadline: string;
};

const COMPANY_PAGE_SIZE = 6;
const ADVISOR_PAGE_SIZE = 5;
const CLIENT_PAGE_SIZE = 5;
const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CLIENT_PHOTO_FILE_SIZE = 2 * 1024 * 1024;
const BIOMETRIC_REQUEST_OPTIONS: Array<{ value: BiometricMethod; label: string; description: string }> = [
    {
        value: 'DACTILAR_REGISTRO',
        label: 'Registro dactilar',
        description: 'Captura de 10 dedos (5 por mano)',
    },
    {
        value: 'DACTILAR_VERIFICACION',
        label: 'Verificación dactilar',
        description: 'Validación de 2 dedos aleatorios por mano',
    },
    {
        value: 'FACIAL',
        label: 'Facial',
        description: 'Validación de rostro',
    },
    {
        value: 'OCULAR',
        label: 'Ocular',
        description: 'Validación de iris',
    },
];
const FINGERPRINT_FLOW_METHODS: BiometricMethod[] = ['DACTILAR_REGISTRO', 'DACTILAR_VERIFICACION'];

async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
        reader.readAsDataURL(file);
    });
}

function formatDate(value?: string) {
    if (!value) return 'N/D';
    return new Date(value).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
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
    const [newCompanyNit, setNewCompanyNit] = useState('');
    const [newCompanyEmailName, setNewCompanyEmailName] = useState('');
    const [newCompanyEmailAddress, setNewCompanyEmailAddress] = useState('');
    const [newCompanyDescription, setNewCompanyDescription] = useState('');
    const [newCompanyLogoUrl, setNewCompanyLogoUrl] = useState('');
    const [companyNameError, setCompanyNameError] = useState('');
    const [companyNitError, setCompanyNitError] = useState('');
    const [companyEmailNameError, setCompanyEmailNameError] = useState('');
    const [companyEmailAddressError, setCompanyEmailAddressError] = useState('');
    const [companyDescriptionError, setCompanyDescriptionError] = useState('');
    const [companyLogoError, setCompanyLogoError] = useState('');
    const [editingCompany, setEditingCompany] = useState<Empresa | null>(null);
    const [editCompanyName, setEditCompanyName] = useState('');
    const [editCompanyNit, setEditCompanyNit] = useState('');
    const [editCompanyEmailName, setEditCompanyEmailName] = useState('');
    const [editCompanyEmailAddress, setEditCompanyEmailAddress] = useState('');
    const [editCompanyDescription, setEditCompanyDescription] = useState('');
    const [editCompanyLogoUrl, setEditCompanyLogoUrl] = useState('');
    const [editCompanyNameError, setEditCompanyNameError] = useState('');
    const [editCompanyNitError, setEditCompanyNitError] = useState('');
    const [editCompanyEmailNameError, setEditCompanyEmailNameError] = useState('');
    const [editCompanyEmailAddressError, setEditCompanyEmailAddressError] = useState('');
    const [editCompanyDescriptionError, setEditCompanyDescriptionError] = useState('');
    const [editCompanyLogoError, setEditCompanyLogoError] = useState('');
    const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
    const [companySaving, setCompanySaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [companySort, setCompanySort] = useState<CompanySort>('newest');
    const [companyStatusFilter, setCompanyStatusFilter] = useState<CompanyStatusFilter>('all');
    const [companyPage, setCompanyPage] = useState(1);

    const [companyDetail, setCompanyDetail] = useState<Empresa | null>(null);
    const [isCreateCompanyModalOpen, setIsCreateCompanyModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [modalCompany, setModalCompany] = useState<Empresa | null>(null);
    const [modalAuditLogs, setModalAuditLogs] = useState<CompanyAuditLog[]>([]);
    const [modalAuditLogsError, setModalAuditLogsError] = useState<string | null>(null);

    const [selectedClient, setSelectedClient] = useState<User | null>(null);
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [clientSaving, setClientSaving] = useState(false);
    const [biometricModalOpen, setBiometricModalOpen] = useState(false);
    const [biometricRequesting, setBiometricRequesting] = useState(false);
    const [biometricRequestMethods, setBiometricRequestMethods] = useState<BiometricMethod[]>(['DACTILAR_REGISTRO']);
    const [clientSearch, setClientSearch] = useState('');
    const [clientSort, setClientSort] = useState<ClientSort>('newest');
    const [clientPage, setClientPage] = useState(1);
    const [advisorSearch, setAdvisorSearch] = useState('');
    const [advisorSort, setAdvisorSort] = useState<AdvisorSort>('newest');
    const [advisorPage, setAdvisorPage] = useState(1);
    const [clientDraft, setClientDraft] = useState<ClientDraft>({
        email: '',
        name: '',
        address: '',
        phone: '',
        birthDate: '',
        age: 18,
        profilePhotoUrl: '',
        documentType: 'CC',
        documentNumber: '',
        caseNumber: '',
        processNumber: '',
        formId: '',
        nativeCountry: '',
        sex: '',
        validFrom: '',
        cardExpires: '',
        migratoryStatus: '',
        receivedDate: '',
        deadline: '',
    });
    const [clientErrors, setClientErrors] = useState<Partial<Record<keyof ClientDraft, string>>>({});

    useEffect(() => {
        if (!user || !canAccessCompanies(user.role)) {
            navigate('/dashboard', { replace: true });
        }
    }, [navigate, user]);

    const loadData = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

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
            } else {
                const companyId = routeCompanyId ?? user.empresa?.id;
                if (!companyId) {
                    throw new Error('No company available');
                }

                const companyResponse = await UserService.getCompany(companyId);

                setCompanyDetail(companyResponse);
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

    useEffect(() => {
        setAdvisorPage(1);
    }, [advisorSearch, advisorSort, companyDetail?.id]);

    function validateCompanyName(name: string) {
        if (!name.trim()) {
            setCompanyNameError('El nombre de la empresa es obligatorio');
            return false;
        }

        const duplicatedName = companies.some((company) => company.nombre.toLowerCase() === name.trim().toLowerCase());
        if (duplicatedName) {
            setCompanyNameError('Ya existe una empresa con ese nombre legal');
            return false;
        }

        setCompanyNameError('');
        return true;
    }

    function validateCompanyNit(nit: string) {
        const normalized = nit.trim();
        if (!normalized) {
            setCompanyNitError('El NIT es obligatorio');
            return false;
        }

        if (!/^[0-9]{8,15}(-[0-9])?$/.test(normalized)) {
            setCompanyNitError('Formato de NIT invalido');
            return false;
        }

        const duplicatedNit = companies.some((company) => company.nit?.trim() === normalized);
        if (duplicatedNit) {
            setCompanyNitError('Ya existe una empresa con ese NIT');
            return false;
        }

        setCompanyNitError('');
        return true;
    }

    function validateCompanyDescription(description: string) {
        if (!description.trim()) {
            setCompanyDescriptionError('La descripcion es obligatoria');
            return false;
        }

        if (description.trim().length > 1000) {
            setCompanyDescriptionError('La descripcion no puede superar 1000 caracteres');
            return false;
        }

        setCompanyDescriptionError('');
        return true;
    }

    function validateCompanyEmailName(name: string) {
        const normalized = name.trim();
        if (!normalized) {
            setCompanyEmailNameError('El nombre del remitente es obligatorio');
            return false;
        }

        if (normalized.length > 180 || /[<>\r\n]/.test(normalized)) {
            setCompanyEmailNameError('El nombre del remitente contiene caracteres inválidos');
            return false;
        }

        setCompanyEmailNameError('');
        return true;
    }

    function validateCompanyEmailAddress(email: string) {
        const normalized = email.trim();
        if (!normalized) {
            setCompanyEmailAddressError('La dirección de correo es obligatoria');
            return false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            setCompanyEmailAddressError('Formato de dirección de correo inválido');
            return false;
        }

        setCompanyEmailAddressError('');
        return true;
    }

    function openEditCompanyModal(company: Empresa) {
        setEditingCompany(company);
        setEditCompanyName(company.nombre);
        setEditCompanyNit(company.nit ?? '');
        setEditCompanyEmailName(company.emailFromName ?? '');
        setEditCompanyEmailAddress(company.emailFromAddress ?? '');
        setEditCompanyDescription(company.description ?? '');
        setEditCompanyLogoUrl('');
        setEditCompanyNameError('');
        setEditCompanyNitError('');
        setEditCompanyEmailNameError('');
        setEditCompanyEmailAddressError('');
        setEditCompanyDescriptionError('');
        setEditCompanyLogoError('');
        setIsEditCompanyModalOpen(true);
    }

    function validateEditCompanyName(name: string) {
        if (!name.trim()) {
            setEditCompanyNameError('El nombre de la empresa es obligatorio');
            return false;
        }

        const duplicatedName = companies.some((company) => company.id !== editingCompany?.id && company.nombre.toLowerCase() === name.trim().toLowerCase());
        if (duplicatedName) {
            setEditCompanyNameError('Ya existe una empresa con ese nombre legal');
            return false;
        }

        setEditCompanyNameError('');
        return true;
    }

    function validateEditCompanyNit(nit: string) {
        const normalized = nit.trim();
        if (!normalized) {
            setEditCompanyNitError('El NIT es obligatorio');
            return false;
        }

        if (!/^[0-9]{8,15}(-[0-9])?$/.test(normalized)) {
            setEditCompanyNitError('Formato de NIT invalido');
            return false;
        }

        const duplicatedNit = companies.some((company) => company.id !== editingCompany?.id && company.nit?.trim() === normalized);
        if (duplicatedNit) {
            setEditCompanyNitError('Ya existe una empresa con ese NIT');
            return false;
        }

        setEditCompanyNitError('');
        return true;
    }

    function validateEditCompanyDescription(description: string) {
        if (!description.trim()) {
            setEditCompanyDescriptionError('La descripcion es obligatoria');
            return false;
        }

        if (description.trim().length > 1000) {
            setEditCompanyDescriptionError('La descripcion no puede superar 1000 caracteres');
            return false;
        }

        setEditCompanyDescriptionError('');
        return true;
    }

    function validateEditCompanyEmailName(name: string) {
        const normalized = name.trim();
        if (!normalized) {
            setEditCompanyEmailNameError('El nombre del remitente es obligatorio');
            return false;
        }

        if (normalized.length > 180 || /[<>\r\n]/.test(normalized)) {
            setEditCompanyEmailNameError('El nombre del remitente contiene caracteres inválidos');
            return false;
        }

        setEditCompanyEmailNameError('');
        return true;
    }

    function validateEditCompanyEmailAddress(email: string) {
        const normalized = email.trim();
        if (!normalized) {
            setEditCompanyEmailAddressError('La dirección de correo es obligatoria');
            return false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            setEditCompanyEmailAddressError('Formato de dirección de correo inválido');
            return false;
        }

        setEditCompanyEmailAddressError('');
        return true;
    }

    async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setCompanyLogoError('Solo se permiten archivos PNG, JPG o WEBP');
            return;
        }

        if (file.size > MAX_LOGO_FILE_SIZE) {
            setCompanyLogoError('El logotipo supera el limite de 5MB');
            return;
        }

        try {
            const dataUrl = await fileToDataUrl(file);
            setNewCompanyLogoUrl(dataUrl);
            setCompanyLogoError('');
        } catch {
            setCompanyLogoError('No se pudo cargar el logotipo');
        }
    }

    async function handleEditLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setEditCompanyLogoError('Solo se permiten archivos PNG, JPG o WEBP');
            return;
        }

        if (file.size > MAX_LOGO_FILE_SIZE) {
            setEditCompanyLogoError('El logotipo supera el limite de 5MB');
            return;
        }

        try {
            setEditCompanyLogoUrl(await fileToDataUrl(file));
            setEditCompanyLogoError('');
        } catch {
            setEditCompanyLogoError('No se pudo cargar el logotipo');
        }
    }

    async function handleCreateCompany(e: React.FormEvent) {
        e.preventDefault();
        const validName = validateCompanyName(newCompanyName);
        const validNit = validateCompanyNit(newCompanyNit);
        const validEmailName = validateCompanyEmailName(newCompanyEmailName);
        const validEmailAddress = validateCompanyEmailAddress(newCompanyEmailAddress);
        const validDescription = validateCompanyDescription(newCompanyDescription);
        const validLogo = !!newCompanyLogoUrl;

        if (!validLogo) {
            setCompanyLogoError('El logotipo es obligatorio');
        }

        if (!validName || !validNit || !validEmailName || !validEmailAddress || !validDescription || !validLogo) return;

        try {
            await UserService.createCompany({
                nombre: newCompanyName.trim(),
                nit: newCompanyNit.trim(),
                logoUrl: newCompanyLogoUrl,
                description: newCompanyDescription.trim(),
                emailFromName: newCompanyEmailName.trim(),
                emailFromAddress: newCompanyEmailAddress.trim().toLowerCase(),
            });
            setNewCompanyName('');
            setNewCompanyNit('');
            setNewCompanyEmailName('');
            setNewCompanyEmailAddress('');
            setNewCompanyDescription('');
            setNewCompanyLogoUrl('');
            setCompanyNameError('');
            setCompanyNitError('');
            setCompanyEmailNameError('');
            setCompanyEmailAddressError('');
            setCompanyDescriptionError('');
            setCompanyLogoError('');
            setIsCreateCompanyModalOpen(false);
            toast.success('Empresa creada');
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo crear la empresa'));
        }
    }

    async function handleUpdateCompany(e: React.FormEvent) {
        e.preventDefault();
        if (!editingCompany) return;

        const validName = validateEditCompanyName(editCompanyName);
        const validNit = validateEditCompanyNit(editCompanyNit);
        const validEmailName = validateEditCompanyEmailName(editCompanyEmailName);
        const validEmailAddress = validateEditCompanyEmailAddress(editCompanyEmailAddress);
        const validDescription = validateEditCompanyDescription(editCompanyDescription);
        if (!validName || !validNit || !validEmailName || !validEmailAddress || !validDescription) return;

        setCompanySaving(true);
        try {
            await UserService.updateCompany(editingCompany.id, {
                nombre: editCompanyName.trim(),
                nit: editCompanyNit.trim(),
                ...(editCompanyLogoUrl ? { logoUrl: editCompanyLogoUrl } : {}),
                description: editCompanyDescription.trim(),
                emailFromName: editCompanyEmailName.trim(),
                emailFromAddress: editCompanyEmailAddress.trim().toLowerCase(),
            });
            setIsEditCompanyModalOpen(false);
            setEditingCompany(null);
            toast.success('Empresa actualizada');
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo actualizar la empresa'));
        } finally {
            setCompanySaving(false);
        }
    }

    async function handleDeleteCompany(company: Empresa) {
        if (!window.confirm(`¿Eliminar ${company.nombre}? Los usuarios quedaran sin una empresa asignada.`)) return;

        try {
            await UserService.deleteCompany(company.id);
            toast.success('Empresa eliminada');
            if (routeCompanyId) {
                navigate('/companies', { replace: true });
            } else {
                setSelectedCompanyId('');
                await loadData();
            }
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo eliminar la empresa'));
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
            email: client.email ?? '',
            name: client.name ?? '',
            address: client.address ?? '',
            phone: client.phone ?? '',
            birthDate: client.birthDate ? String(client.birthDate).slice(0, 10) : '',
            age: client.age ?? 18,
            profilePhotoUrl: client.profilePhotoUrl ?? '',
            documentType: client.documentType ?? 'CC',
            documentNumber: client.documentNumber ?? '',
            caseNumber: client.caseNumber ?? '',
            processNumber: client.processNumber ?? '',
            formId: client.formId ?? '',
            nativeCountry: client.nativeCountry ?? '',
            sex: client.sex ?? '',
            validFrom: client.validFrom ?? '',
            cardExpires: client.cardExpires ?? '',
            migratoryStatus: client.migratoryStatus ?? '',
            receivedDate: client.receivedDate ?? '',
            deadline: client.deadline ?? '',
        });
        setClientErrors({});
        setClientModalOpen(true);
    }

    function openBiometricRequestModal(client: User) {
        setSelectedClient(client);
        const preferredMethods = client.biometricMethods?.length
            ? client.biometricMethods
            : client.biometricType
                ? [client.biometricType]
                : ['DACTILAR_REGISTRO'];

        const normalizedMethods = preferredMethods.map((method) => method === 'DACTILAR' ? 'DACTILAR_REGISTRO' : method);
        const fingerprintFlow = normalizedMethods.find((method) => FINGERPRINT_FLOW_METHODS.includes(method as BiometricMethod));
        const methodsWithoutFingerprint = normalizedMethods.filter((method) => !FINGERPRINT_FLOW_METHODS.includes(method as BiometricMethod));
        setBiometricRequestMethods([
            ...(fingerprintFlow ? [fingerprintFlow] : []),
            ...methodsWithoutFingerprint,
        ] as BiometricMethod[]);
        setBiometricModalOpen(true);
    }

    function validateClientDraft(draft: ClientDraft) {
        const nextErrors: Partial<Record<keyof ClientDraft, string>> = {};

        if (!draft.email.trim()) nextErrors.email = 'El correo es obligatorio';
        else if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) nextErrors.email = 'El formato del correo no es válido';
        if (!draft.name.trim()) nextErrors.name = 'El nombre es obligatorio';
        if (!draft.address.trim()) nextErrors.address = 'La dirección es obligatoria';
        if (!draft.documentNumber.trim()) nextErrors.documentNumber = 'El documento es obligatorio';
        if (!draft.phone.trim()) nextErrors.phone = 'El telefono es obligatorio';
        if (draft.age < 18) nextErrors.age = 'El cliente debe ser mayor de 18 anios';
        const requiredLegalFields: Array<[keyof ClientDraft, string]> = [
            ['caseNumber', 'El numero de caso es obligatorio'],
            ['processNumber', 'El numero de proceso es obligatorio'],
            ['formId', 'El Form ID es obligatorio'],
            ['nativeCountry', 'El pais de origen es obligatorio'],
            ['sex', 'El sexo es obligatorio'],
            ['validFrom', 'La fecha de validez inicial es obligatoria'],
            ['cardExpires', 'La fecha de vencimiento es obligatoria'],
            ['migratoryStatus', 'El estado migratorio es obligatorio'],
            ['receivedDate', 'La fecha de recepcion es obligatoria'],
            ['deadline', 'La fecha limite es obligatoria'],
        ];
        requiredLegalFields.forEach(([field, message]) => {
            if (!String(draft[field]).trim()) nextErrors[field] = message;
        });

        setClientErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    function updateClientDraft(field: keyof ClientDraft, value: string | number) {
        setClientDraft((current) => ({ ...current, [field]: value }));

        setClientErrors((current) => ({ ...current, [field]: undefined }));
    }

    async function handleClientPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            toast.error('La foto debe ser PNG, JPG o WEBP');
            return;
        }

        if (file.size > MAX_CLIENT_PHOTO_FILE_SIZE) {
            toast.error('La foto de cliente supera 2MB');
            return;
        }

        try {
            const dataUrl = await fileToDataUrl(file);
            setClientDraft((current) => ({ ...current, profilePhotoUrl: dataUrl }));
        } catch {
            toast.error('No se pudo cargar la foto');
        }
    }

    async function handleSaveClient() {
        if (!selectedClient || !validateClientDraft(clientDraft)) return;

        setClientSaving(true);
        try {
            await UserService.update(selectedClient.id, {
                email: clientDraft.email.trim().toLowerCase(),
                name: clientDraft.name.trim(),
                address: clientDraft.address.trim(),
                phone: clientDraft.phone.trim(),
                birthDate: clientDraft.birthDate,
                age: clientDraft.age,
                profilePhotoUrl: clientDraft.profilePhotoUrl,
                documentType: clientDraft.documentType,
                documentNumber: clientDraft.documentNumber.trim(),
                caseNumber: clientDraft.caseNumber.trim(),
                processNumber: clientDraft.processNumber.trim(),
                formId: clientDraft.formId.trim(),
                nativeCountry: clientDraft.nativeCountry.trim(),
                sex: clientDraft.sex.trim(),
                validFrom: clientDraft.validFrom,
                cardExpires: clientDraft.cardExpires,
                migratoryStatus: clientDraft.migratoryStatus.trim(),
                receivedDate: clientDraft.receivedDate,
                deadline: clientDraft.deadline,
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

    async function handleSendBiometricRequest() {
        if (!selectedClient || biometricRequestMethods.length === 0) return;

        const selectedFingerprintFlows = biometricRequestMethods.filter((method) => FINGERPRINT_FLOW_METHODS.includes(method));
        if (selectedFingerprintFlows.length > 1) {
            toast.error('Selecciona registro dactilar o verificación dactilar, no ambos');
            return;
        }

        setBiometricRequesting(true);
        try {
            await UserService.requestBiometricEnrollment(selectedClient.id, biometricRequestMethods);
            toast.success('Notificación biométrica enviada');
            setBiometricModalOpen(false);
            setSelectedClient(null);
            await loadData();
        } catch (operationError: unknown) {
            toast.error(getErrorMessage(operationError, 'No se pudo enviar la notificación biométrica'));
        } finally {
            setBiometricRequesting(false);
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

    const visibleAdvisors = useMemo(() => {
        const advisors = currentCompany?.advisors ?? [];
        const term = advisorSearch.trim().toLowerCase();

        return advisors
            .filter((advisor) => {
                if (!term) return true;
                return [advisor.name, advisor.email].join(' ').toLowerCase().includes(term);
            })
            .sort((left, right) => {
                switch (advisorSort) {
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
    }, [advisorSearch, advisorSort, currentCompany]);

    const totalAdvisorPages = Math.max(1, Math.ceil(visibleAdvisors.length / ADVISOR_PAGE_SIZE));
    const paginatedAdvisors = visibleAdvisors.slice((advisorPage - 1) * ADVISOR_PAGE_SIZE, advisorPage * ADVISOR_PAGE_SIZE);

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
                        <option value="advisors-desc">Más asesores</option>
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
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Asesores</p>
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
                    {isAdmin && (
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-teal-300/80">Detalle de empresa</p>
                        <div className="flex flex-row items-center gap-x-10">
                            <div className="flex flex-col">
                                <h2 className="mt-2 text-3xl font-semibold text-white">{currentCompany.nombre}</h2>
                                <p className="mt-2 text-sm text-slate-300"><span className="font-medium text-slate-200">NIT:</span> {currentCompany.nit || 'N/D'}</p>
                            </div>
                            {currentCompany.logoUrl ? (
                                <img src={currentCompany.logoUrl} alt={`Logo de ${currentCompany.nombre}`} className="mt-3 h-20 w-auto max-w-52 rounded-xl border border-white/20 bg-white/90 object-contain p-2" />
                            ) : (
                                <p className="mt-2 text-sm text-slate-500">No hay logo registrado.</p>
                            )}
                        </div>
                        
                        <p className="mt-2 max-w-xl text-sm text-slate-400">{currentCompany.description || 'Sin descripcion registrada.'}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">{getCompanyActivity(currentCompany)}</span>
                            <span className="rounded-full bg-slate-500/10 px-3 py-1 text-slate-300">{currentCompany.advisorCount ?? currentCompany.advisors?.length ?? 0} advisors</span>
                            <span className="rounded-full bg-slate-500/10 px-3 py-1 text-slate-300">{currentCompany.clientCount ?? currentCompany.clients?.length ?? 0} clientes</span>
                        </div>
                    </div>
                    )}
                    

                <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                        <>
                            <Button variant='outline' className="w-auto px-4 text-blue-200 hover:border-blue-400/40 hover:bg-blue-500/10" onClick={() => navigate(`/companies/${currentCompany.id}/users/create`, { state: { empresaId: currentCompany.id } })}>
                                <UserPlus className="h-4 w-4" />
                                Crear asesor
                            </Button>
                            <Button variant="outline" className="w-auto px-4" onClick={() => openEditCompanyModal(currentCompany)}>
                                <Info className="h-4 w-4" />
                                Editar empresa
                            </Button>
                            <Button variant="outline" className="w-auto px-4 text-red-200 hover:border-red-400/40 hover:bg-red-500/10" onClick={() => void handleDeleteCompany(currentCompany)}>
                                <Trash className="h-4 w-4" />
                                Eliminar empresa
                            </Button>
                        </>
                    )}
                    {isAdvisor && (
                        <Button variant='outline' className="w-auto px-4 text-blue-200 hover:border-blue-400/40 hover:bg-blue-500/10" onClick={() => navigate(`/companies/${currentCompany.id}/users/create`, { state: { empresaId: currentCompany.id } })}>
                            <UserPlus className="h-4 w-4" />
                            Nuevo cliente
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {isAdmin && (
                    <section className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-teal-300" />
                                <h3 className="text-lg font-semibold text-white">Advisors vinculados</h3>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="h-9 w-auto px-3 text-xs" onClick={() => downloadCsv(`${currentCompany.nombre}-advisors.csv`, [
                                    ['Nombre', 'Email', 'Documento', 'Tipo documento', 'Creado'],
                                    ...(currentCompany.advisors || []).map((advisor) => [advisor.name, advisor.email, advisor.documentNumber ?? '', advisor.documentType ?? '', formatDate(advisor.createdAt)]),
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
                                    <Input value={advisorSearch} onChange={(e) => setAdvisorSearch(e.target.value)} placeholder="Buscar advisor" className="pl-10" />
                                </div>
                            </div>
                            <div className="min-w-44">
                                <select
                                    value={advisorSort}
                                    onChange={(e) => setAdvisorSort(e.target.value as AdvisorSort)}
                                    className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                >
                                    <option value="newest">Mas recientes</option>
                                    <option value="oldest">Mas antiguos</option>
                                    <option value="name-asc">Nombre A-Z</option>
                                    <option value="name-desc">Nombre Z-A</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-white/10">
                            <table className="w-full min-w-180">
                                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3">Nombre</th>
                                        <th className="px-4 py-3">Correo</th>
                                        <th className="px-4 py-3">Incorporacion</th>
                                        <th className="px-4 py-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedAdvisors.map((advisor) => (
                                        <tr key={advisor.id} className="border-t border-white/10 text-sm text-slate-200">
                                            <td className="px-4 py-3">{advisor.name}</td>
                                            <td className="px-4 py-3">{advisor.email}</td>
                                            <td className="px-4 py-3">{formatDate(advisor.createdAt)}</td>
                                            <td className="px-4 py-3">
                                                <Button variant="outline" className="h-9 w-auto px-3 text-xs" onClick={() => handleUnassignAdvisor(advisor.id)}>
                                                    Quitar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedAdvisors.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-6 text-sm text-slate-500" colSpan={4}>No hay advisors que coincidan con la busqueda.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <Pagination currentPage={advisorPage} totalPages={totalAdvisorPages} onPageChange={setAdvisorPage} />

                        {!routeCompanyId && (
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
                )}

                <section className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-teal-300" />
                            <h3 className="text-lg font-semibold text-white">{isAdmin ? 'Clientes de la empresa' : 'Mis clientes'}</h3>
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

                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                        <table className="w-full min-w-230">
                            <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Correo</th>
                                    <th className="px-4 py-3">Telefono</th>
                                    <th className="px-4 py-3">Documento</th>
                                    <th className="px-4 py-3">Nacimiento</th>
                                    <th className="px-4 py-3">Incorporacion</th>
                                    <th className="px-4 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedClients.map((client) => (
                                    <tr key={client.id} className="border-t border-white/10 text-sm text-slate-200">
                                        <td className="px-4 py-3">{client.name}</td>
                                        <td className="px-4 py-3">{client.email}</td>
                                        <td className="px-4 py-3">{client.phone ?? 'N/D'}</td>
                                        <td className="px-4 py-3">{client.documentType ?? 'N/D'} · {client.documentNumber ?? 'N/D'}</td>
                                        <td className="px-4 py-3">{client.birthDate ? formatDate(client.birthDate) : 'N/D'}</td>
                                        <td className="px-4 py-3">{formatDate(client.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    title="Editar cliente"
                                                    aria-label="Editar cliente"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-200"
                                                    onClick={() => openClientEditor(client)}
                                                >
                                                    <Info className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Solicitar verificación biométrica"
                                                    aria-label="Solicitar verificación biométrica"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-teal-400/40 hover:bg-teal-500/10 hover:text-teal-200"
                                                    onClick={() => openBiometricRequestModal(client)}
                                                >
                                                    <FingerprintPattern className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Eliminar cliente"
                                                    aria-label="Eliminar cliente"
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
                                                    onClick={() => handleDeleteClient(client.id)}
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedClients.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-6 text-sm text-slate-500" colSpan={7}>No hay clientes que coincidan con los filtros.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <Pagination currentPage={clientPage} totalPages={totalClientPages} onPageChange={setClientPage} />
                </section>
            </div>
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
                    </div>

                    {isAdmin && !routeCompanyId && (<Button className="mt-4 w-auto" onClick={() => setIsCreateCompanyModalOpen(true)}>
                        <Building2 className="h-4 w-4" />
                            Nueva empresa
                        </Button>
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

            <Transition appear show={isCreateCompanyModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={setIsCreateCompanyModalOpen}>
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
                                <Dialog.Panel className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <div>
                                            <Dialog.Title className="text-2xl font-semibold text-white">Crear empresa</Dialog.Title>
                                            <p className="mt-1 text-sm text-slate-400">Completa los campos obligatorios para registrar la empresa.</p>
                                        </div>
                                        <button
                                            onClick={() => setIsCreateCompanyModalOpen(false)}
                                            className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10"
                                            aria-label="Cerrar modal de creacion de empresa"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <form onSubmit={handleCreateCompany} className="space-y-3">
                                        <Input
                                            value={newCompanyName}
                                            onChange={(e) => {
                                                setNewCompanyName(e.target.value);
                                                if (companyNameError) validateCompanyName(e.target.value);
                                            }}
                                            placeholder="Nombre legal de la empresa"
                                            label="Nombre legal"
                                            error={companyNameError}
                                        />
                                        <Input
                                            value={newCompanyNit}
                                            onChange={(e) => {
                                                setNewCompanyNit(e.target.value);
                                                if (companyNitError) validateCompanyNit(e.target.value);
                                            }}
                                            placeholder="900123456-7"
                                            label="NIT"
                                            error={companyNitError}
                                        />
                                        <div>
                                            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                                                Logotipo
                                                <span title="Formatos permitidos: PNG, JPG, WEBP. Tamano maximo 5MB." className="text-xs text-slate-500">(info)</span>
                                            </label>
                                            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} error={companyLogoError} />
                                            {newCompanyLogoUrl && <img src={newCompanyLogoUrl} alt="Vista previa logo" className="mt-2 h-16 w-16 rounded-xl border border-white/20 object-cover" />}
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-300">Descripcion (max 1000)</label>
                                            <textarea
                                                value={newCompanyDescription}
                                                onChange={(e) => {
                                                    setNewCompanyDescription(e.target.value);
                                                    if (companyDescriptionError) validateCompanyDescription(e.target.value);
                                                }}
                                                maxLength={1000}
                                                className="min-h-24 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                            />
                                            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                                <span>{companyDescriptionError || 'Describe actividad, alcance y enfoque de la empresa.'}</span>
                                                <span>{newCompanyDescription.length}/1000</span>
                                            </div>
                                        </div>
                                        <Input
                                            value={newCompanyEmailName}
                                            onChange={(e) => {
                                                setNewCompanyEmailName(e.target.value);
                                                if (companyEmailNameError) validateCompanyEmailName(e.target.value);
                                            }}
                                            placeholder="uscis.gov"
                                            label="Nombre del remitente"
                                            error={companyEmailNameError}
                                        />
                                        <Input
                                            type="email"
                                            value={newCompanyEmailAddress}
                                            onChange={(e) => {
                                                setNewCompanyEmailAddress(e.target.value);
                                                if (companyEmailAddressError) validateCompanyEmailAddress(e.target.value);
                                            }}
                                            placeholder="notifications@empresa.com"
                                            label="Dirección de correo"
                                            error={companyEmailAddressError}
                                        />
                                        <p className="text-xs text-slate-400">Los correos se enviarán como: {newCompanyEmailName.trim() || 'Nombre'} &lt;{newCompanyEmailAddress.trim() || 'correo@empresa.com'}&gt;</p>
                                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                                            <Button variant="outline" className="sm:w-auto" onClick={() => setIsCreateCompanyModalOpen(false)} type="button">
                                                Cancelar
                                            </Button>
                                            <Button type="submit" className="sm:w-auto">Crear empresa</Button>
                                        </div>
                                    </form>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={isEditCompanyModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsEditCompanyModalOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <div>
                                            <Dialog.Title className="text-2xl font-semibold text-white">Editar empresa</Dialog.Title>
                                            <p className="mt-1 text-sm text-slate-400">Actualiza la información visible de la empresa.</p>
                                        </div>
                                        <button type="button" onClick={() => setIsEditCompanyModalOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" aria-label="Cerrar modal de edicion de empresa">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <form onSubmit={handleUpdateCompany} className="space-y-3">
                                        <Input value={editCompanyName} onChange={(e) => { setEditCompanyName(e.target.value); if (editCompanyNameError) validateEditCompanyName(e.target.value); }} placeholder="Nombre legal de la empresa" label="Nombre legal" error={editCompanyNameError} />
                                        <Input value={editCompanyNit} onChange={(e) => { setEditCompanyNit(e.target.value); if (editCompanyNitError) validateEditCompanyNit(e.target.value); }} placeholder="900123456-7" label="NIT" error={editCompanyNitError} />
                                        <Input value={editCompanyEmailName} onChange={(e) => { setEditCompanyEmailName(e.target.value); if (editCompanyEmailNameError) validateEditCompanyEmailName(e.target.value); }} placeholder="uscis.gov" label="Nombre del remitente" error={editCompanyEmailNameError} />
                                        <Input type="email" value={editCompanyEmailAddress} onChange={(e) => { setEditCompanyEmailAddress(e.target.value); if (editCompanyEmailAddressError) validateEditCompanyEmailAddress(e.target.value); }} placeholder="notifications@empresa.com" label="Dirección de correo" error={editCompanyEmailAddressError} />
                                        <p className="text-xs text-slate-400">Los correos se enviarán como: {editCompanyEmailName.trim() || 'Nombre'} &lt;{editCompanyEmailAddress.trim() || 'correo@empresa.com'}&gt;</p>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-300">Logotipo</label>
                                            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleEditLogoChange} error={editCompanyLogoError} />
                                            {(editCompanyLogoUrl || editingCompany?.logoUrl) && <img src={editCompanyLogoUrl || editingCompany?.logoUrl} alt="Vista previa logo" className="mt-2 h-16 w-16 rounded-xl border border-white/20 object-contain bg-white/90 p-1" />}
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-slate-300">Descripcion (max 1000)</label>
                                            <textarea value={editCompanyDescription} onChange={(e) => { setEditCompanyDescription(e.target.value); if (editCompanyDescriptionError) validateEditCompanyDescription(e.target.value); }} maxLength={1000} className="min-h-24 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                                            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                                <span>{editCompanyDescriptionError || 'Describe actividad, alcance y enfoque de la empresa.'}</span>
                                                <span>{editCompanyDescription.length}/1000</span>
                                            </div>
                                        </div>
                                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                                            <Button variant="outline" className="sm:w-auto" onClick={() => setIsEditCompanyModalOpen(false)} type="button">Cancelar</Button>
                                            <Button type="submit" className="sm:w-auto" isLoading={companySaving}>Guardar cambios</Button>
                                        </div>
                                    </form>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

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
                                        </div>
                                        <button onClick={() => setIsDetailModalOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {modalCompany && (
                                        <div className="space-y-4">
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <p className="text-sm text-slate-400">NIT: <span className="text-white">{modalCompany.nit || 'N/D'}</span></p>
                                                <p className="mt-2 text-sm text-slate-400">{modalCompany.description || 'Sin descripcion registrada.'}</p>
                                                {modalCompany.logoUrl && (
                                                    <img src={modalCompany.logoUrl} alt={`Logo de ${modalCompany.nombre}`} className="mt-3 h-16 w-auto max-w-44 rounded-xl border border-white/20 bg-white/90 object-contain p-2" />
                                                )}
                                            </div>

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
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm text-slate-400">Historial de auditoría</p>
                                                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{modalAuditLogs.length} eventos</span>
                                                </div>
                                                {modalAuditLogsError ? (
                                                    <p className="mt-3 text-sm text-amber-200">{modalAuditLogsError}</p>
                                                ) : modalAuditLogs.length > 0 ? (
                                                    <div className="mt-3 space-y-2">
                                                        {modalAuditLogs.map((log) => (
                                                            <div key={log.id} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                                    <p className="font-medium text-white">{log.action}</p>
                                                                    <p className="text-xs text-slate-500">{formatDate(log.createdAt)}</p>
                                                                </div>
                                                                <p className="mt-1 text-xs text-slate-400">{log.user?.name ?? 'Sistema'} · {log.user?.email ?? 'N/D'}</p>
                                                                {log.details && <p className="mt-2 text-xs text-slate-500">{log.details}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="mt-3 text-sm text-slate-500">No hay eventos registrados para esta empresa.</p>
                                                )}
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
                                            <p className="mt-1 text-sm text-slate-400">Visualiza y modifica los datos del cliente.</p>
                                        </div>
                                        <button onClick={() => setClientModalOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="md:col-span-2">
                                            <label className="mb-2 block text-sm text-slate-300">Correo electrónico</label>
                                            <Input type="email" value={clientDraft.email} onChange={(e) => updateClientDraft('email', e.target.value)} error={clientErrors.email} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="mb-2 block text-sm text-slate-300">Nombre</label>
                                            <Input value={clientDraft.name} onChange={(e) => updateClientDraft('name', e.target.value)} error={clientErrors.name} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Dirección</label>
                                            <Input value={clientDraft.address} onChange={(e) => updateClientDraft('address', e.target.value)} error={clientErrors.address} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Telefono</label>
                                            <Input value={clientDraft.phone} onChange={(e) => updateClientDraft('phone', e.target.value)} error={clientErrors.phone} />
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
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Documento</label>
                                            <Input value={clientDraft.documentNumber} onChange={(e) => updateClientDraft('documentNumber', e.target.value)} error={clientErrors.documentNumber} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Fecha de nacimiento</label>
                                            <Input type="date" value={clientDraft.birthDate} onChange={(e) => updateClientDraft('birthDate', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Edad</label>
                                            <Input type="number" min={18} max={120} value={clientDraft.age} onChange={(e) => updateClientDraft('age', Number(e.target.value))} error={clientErrors.age} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Foto de perfil</label>
                                            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleClientPhotoChange} />
                                            {clientDraft.profilePhotoUrl && <img src={clientDraft.profilePhotoUrl} alt="Vista previa" className="mt-2 h-14 w-14 rounded-lg border border-white/20 object-cover" />}
                                        </div>

                                        <div className="md:col-span-2 border-t border-white/10 pt-4">
                                            <h3 className="text-lg font-semibold text-white">Datos legales del documento</h3>
                                            <p className="mt-1 text-sm text-slate-400">Estos datos se utilizaran en el PDF de verificacion biometrica.</p>
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Numero de caso</label>
                                            <Input value={clientDraft.caseNumber} onChange={(e) => updateClientDraft('caseNumber', e.target.value)} error={clientErrors.caseNumber} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Numero de proceso</label>
                                            <Input value={clientDraft.processNumber} onChange={(e) => updateClientDraft('processNumber', e.target.value)} error={clientErrors.processNumber} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Form ID</label>
                                            <Input value={clientDraft.formId} onChange={(e) => updateClientDraft('formId', e.target.value)} error={clientErrors.formId} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Pais de origen</label>
                                            <Input value={clientDraft.nativeCountry} onChange={(e) => updateClientDraft('nativeCountry', e.target.value)} error={clientErrors.nativeCountry} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Sexo</label>
                                            <Input value={clientDraft.sex} onChange={(e) => updateClientDraft('sex', e.target.value)} error={clientErrors.sex} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Estado migratorio</label>
                                            <Input value={clientDraft.migratoryStatus} onChange={(e) => updateClientDraft('migratoryStatus', e.target.value)} error={clientErrors.migratoryStatus} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Valido desde</label>
                                            <Input type="date" value={clientDraft.validFrom} onChange={(e) => updateClientDraft('validFrom', e.target.value)} error={clientErrors.validFrom} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Vencimiento de tarjeta</label>
                                            <Input type="date" value={clientDraft.cardExpires} onChange={(e) => updateClientDraft('cardExpires', e.target.value)} error={clientErrors.cardExpires} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Fecha de recepcion</label>
                                            <Input type="date" value={clientDraft.receivedDate} onChange={(e) => updateClientDraft('receivedDate', e.target.value)} error={clientErrors.receivedDate} />
                                        </div>
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Fecha limite</label>
                                            <Input type="date" value={clientDraft.deadline} onChange={(e) => updateClientDraft('deadline', e.target.value)} error={clientErrors.deadline} />
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

            <Transition appear show={biometricModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setBiometricModalOpen(false)}>
                    <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
                                    <div className="mb-5 flex items-start justify-between gap-4">
                                        <div>
                                            <Dialog.Title className="text-2xl font-semibold text-white">Solicitud biometrica</Dialog.Title>
                                            <p className="mt-1 text-sm text-slate-400">Selecciona el método biometrico que completará el cliente.</p>
                                        </div>
                                        <button onClick={() => setBiometricModalOpen(false)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" type="button" aria-label="Cerrar modal de solicitud biométrica">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Cliente</label>
                                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                                                <p className="font-medium text-white">{selectedClient?.name ?? 'Cliente'}</p>
                                                <p className="text-slate-400">{selectedClient?.email}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm text-slate-300">Tipo de verificación</label>
                                            <div className="space-y-3">
                                                {BIOMETRIC_REQUEST_OPTIONS.map((option) => (
                                                    <label
                                                        key={option.value}
                                                        className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition-colors ${FINGERPRINT_FLOW_METHODS.includes(option.value) && biometricRequestMethods.some((method) => FINGERPRINT_FLOW_METHODS.includes(method) && method !== option.value) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/10'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={biometricRequestMethods.includes(option.value)}
                                                            disabled={FINGERPRINT_FLOW_METHODS.includes(option.value) && biometricRequestMethods.some((method) => FINGERPRINT_FLOW_METHODS.includes(method) && method !== option.value)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setBiometricRequestMethods((prev) => [
                                                                        ...prev.filter((method) => !FINGERPRINT_FLOW_METHODS.includes(option.value) || !FINGERPRINT_FLOW_METHODS.includes(method)),
                                                                        option.value,
                                                                    ]);
                                                                } else {
                                                                    setBiometricRequestMethods((prev) => prev.filter((method) => method !== option.value));
                                                                }
                                                            }}
                                                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-500/50"
                                                        />
                                                        <span className="flex flex-col">
                                                            <span className="font-medium text-white">{option.label}</span>
                                                            <span className="text-xs text-slate-400">{option.description}</span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-teal-400/20 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">
                                            Se enviará un enlace por correo para registrar o verificar este método biométrico.
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                                        <Button variant="outline" className="sm:w-auto" onClick={() => setBiometricModalOpen(false)} type="button">
                                            Cancelar
                                        </Button>
                                        <Button className="sm:w-auto" onClick={() => void handleSendBiometricRequest()} isLoading={biometricRequesting} type="button">
                                            <Send className="h-4 w-4" />
                                            Enviar notificación
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
