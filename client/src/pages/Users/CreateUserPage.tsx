import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserService, type CreateUserData } from '../../services/userService';
import type { DocumentType } from '../../types/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { canCreateAdvisor, canAccessUsersPage } from '../../lib/roles';
import { toast } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

export default function CreateUserPage() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = (location.state ?? {}) as { role?: 'CLIENT' | 'ADVISOR'; empresaId?: string };

    const [formData, setFormData] = useState<CreateUserData>({
        email: '',
        name: '',
        address: '',
        documentType: 'CC',
        documentNumber: '',
        role: locationState.role ?? 'CLIENT',
        empresaId: locationState.empresaId,
    });
    const [companies, setCompanies] = useState<{ id: string; nombre: string }[]>([]);

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof CreateUserData, string>>>({});

    useEffect(() => {
        if (!currentUser || !canAccessUsersPage(currentUser.role)) {
            navigate('/login');
            return;
        }

        void UserService.getCompanies().then(setCompanies).catch(() => setCompanies([]));
    }, [currentUser, navigate]);

    if (!currentUser || !canAccessUsersPage(currentUser.role)) {
        return null;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'documentType' ? value as DocumentType : value,
        }));
        // Clear error for this field
        if (errors[name as keyof CreateUserData]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof CreateUserData, string>> = {};

        if (!formData.email) newErrors.email = 'Email is required';
        if (formData.role === 'ADVISOR' && (!formData.password || formData.password.length < 6)) {
            newErrors.password = 'Temporary password is required for advisors (min 6 characters)';
        }
        if (!formData.name) newErrors.name = 'Name is required';
        if (!formData.address) newErrors.address = 'Address is required';
        if (!formData.documentNumber) newErrors.documentNumber = 'Document number is required';
        if (formData.role === 'CLIENT' && currentUser?.role === 'ADMIN' && !formData.empresaId) newErrors.empresaId = 'Company is required for clients';
        if (formData.role === 'ADVISOR' && currentUser?.role === 'ADMIN' && !formData.empresaId) newErrors.empresaId = 'Company is required for advisors';
        if (formData.role === 'CLIENT' && !formData.biometricType) newErrors.biometricType = 'Biometric type is required for clients';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            const payload: CreateUserData = formData.role === 'CLIENT'
                ? {
                    ...formData,
                    password: undefined,
                }
                : formData;

            await UserService.create(payload);
            toast.success('User created successfully!');
            navigate('/users');
        } catch (error: unknown) {
            const message: string =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
                    ? (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create user'
                    : 'Failed to create user';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <Link to="/users" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to users
            </Link>

            <div className="glass rounded-3xl p-8 shadow-xl">
                <h1 className="text-3xl font-bold text-white mb-6">
                    Create New User
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Basic Info */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            className="w-1/2 px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        >
                            {canCreateAdvisor(currentUser.role) && <option value="ADVISOR">Advisor</option>}
                            <option value="CLIENT">Client</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter full name"
                                error={errors.name}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                            <Input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter email"
                                error={errors.email}
                            />
                        </div>
                        {formData.role === 'ADVISOR' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Company</label>
                                <select
                                    name="empresaId"
                                    value={formData.empresaId || ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, empresaId: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="">Select company</option>
                                    {companies.map((company) => (
                                        <option key={company.id} value={company.id}>{company.nombre}</option>
                                    ))}
                                </select>
                                {errors.empresaId && <p className="text-red-400 text-sm mt-1">{errors.empresaId}</p>}
                            </div>
                        )}

                        {formData.role === 'ADVISOR' && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Temporary Password</label>
                                <Input
                                    type="password"
                                    name="password"
                                    value={formData.password || ''}
                                    onChange={handleChange}
                                    placeholder="Set temporary password (min 6 characters)"
                                    error={errors.password}
                                />
                                <p className="text-xs text-slate-400 mt-1">The advisor will receive this password by email and should change it on first login.</p>
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Address</label>
                            <Input
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Enter physical address"
                                error={errors.address}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Document Type</label>
                            <select
                                name="documentType"
                                value={formData.documentType}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                <option value="CC">CC</option>
                                <option value="PASSPORT">Passport</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Document Number</label>
                            <Input
                                name="documentNumber"
                                value={formData.documentNumber}
                                onChange={handleChange}
                                placeholder="Enter document number"
                                error={errors.documentNumber}
                            />
                        </div>
                    </div>

                    {/* Conditional Fields */}
                    {formData.role === 'CLIENT' && currentUser?.role === 'ADMIN' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Company</label>
                            <select
                                name="empresaId"
                                value={formData.empresaId || ''}
                                onChange={(e) => setFormData((prev) => ({ ...prev, empresaId: e.target.value }))}
                                className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                <option value="">Select company</option>
                                {companies.map((company) => (
                                    <option key={company.id} value={company.id}>{company.nombre}</option>
                                ))}
                            </select>
                            {errors.empresaId && <p className="text-red-400 text-sm mt-1">{errors.empresaId}</p>}
                        </div>
                    )}

                    {formData.role === 'CLIENT' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Biometric Type</label>
                            <select
                                name="biometricType"
                                value={formData.biometricType || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                <option value="">Select biometric type</option>
                                <option value="OCULAR">Ocular</option>
                                <option value="FACIAL">Facial</option>
                                <option value="DACTILAR">Fingerprint</option>
                            </select>
                            {errors.biometricType && <p className="text-red-400 text-sm mt-1">{errors.biometricType}</p>}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="submit"
                            disabled={loading}
                            isLoading={loading}
                            className="w-full"
                        >
                            Create User
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
