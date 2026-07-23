import axios from 'axios';
import { useEffect, useState } from 'react';
import api from '../lib/api';

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
  biometricType?: 'OCULAR' | 'FACIAL' | 'DACTILAR' | null;
  createdAt: string;
  updatedAt: string;
};

const documentOptions: Array<{ value: DocumentType; label: string }> = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'DNI', label: 'Documento nacional de identidad' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro documento válido' },
];

const initialFieldErrors = {
  documentType: '',
  documentNumber: '',
};

const stripSpaces = (value: string) => value.replace(/\s+/g, '');

export default function Login() {
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState(initialFieldErrors);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (profile) {
      const firstAction = document.getElementById('confirm-data');
      firstAction?.focus();
    }
  }, [profile]);

  const canSubmit = documentType !== '' && stripSpaces(documentNumber).length > 0 && !loading;

  const validateField = (name: 'documentType' | 'documentNumber', value: string) => {
    if (name === 'documentType') {
      return value ? '' : 'Seleccione el tipo de documento.';
    }

    if (!value.trim()) {
      return 'Escriba el número de documento.';
    }

    if (!/^[0-9]+$/.test(value.trim())) {
      return 'Use solo números en este campo.';
    }

    return '';
  };

  const updateFieldError = (name: 'documentType' | 'documentNumber', value: string) => {
    setFieldErrors((current) => ({ ...current, [name]: validateField(name, value) }));
  };

  const handleDocumentTypeChange = (value: string) => {
    const nextValue = value as DocumentType | '';
    setDocumentType(nextValue);
    updateFieldError('documentType', nextValue);
    setFormError('');
    setConfirmed(false);
  };

  const handleDocumentNumberChange = (value: string) => {
    const nextValue = value.replace(/[^0-9]/g, '');
    setDocumentNumber(nextValue);
    updateFieldError('documentNumber', nextValue);
    setFormError('');
    setConfirmed(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = {
      documentType: validateField('documentType', documentType),
      documentNumber: validateField('documentNumber', documentNumber),
    };

    setFieldErrors(nextErrors);

    if (nextErrors.documentType || nextErrors.documentNumber) {
      return;
    }

    setLoading(true);
    setFormError('');
    setConfirmed(false);

    try {
      const { data } = await api.post<{ user: ClientProfile }>('/auth/client-verify', {
        documentType,
        documentNumber: documentNumber.trim(),
      });

      setProfile(data.user);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'No encontramos un cliente con esos datos. Revisa e intenta otra vez.'
        : 'No encontramos un cliente con esos datos. Revisa e intenta otra vez.';
      setProfile(null);
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    setConfirmed(true);
  };

  const handleBack = () => {
    setProfile(null);
    setFormError('');
    setConfirmed(false);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acceso para clientes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Verifique sus datos</h1>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
          {!profile ? (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="documentType" className="block text-sm font-semibold text-slate-800">
                  Tipo de documento
                </label>
                <select
                  id="documentType"
                  value={documentType}
                  onChange={(event) => handleDocumentTypeChange(event.target.value)}
                  onBlur={(event) => updateFieldError('documentType', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.documentType)}
                  aria-describedby={fieldErrors.documentType ? 'documentType-error' : undefined}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                >
                  <option value="">Seleccione una opción</option>
                  {documentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.documentType ? (
                  <p className="text-sm font-medium text-red-700" id="documentType-error" role="alert">
                    {fieldErrors.documentType}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="documentNumber" className="block text-sm font-semibold text-slate-800">
                  Número de documento
                </label>
                <input
                  id="documentNumber"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={documentNumber}
                  onChange={(event) => handleDocumentNumberChange(event.target.value)}
                  onBlur={(event) => updateFieldError('documentNumber', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.documentNumber)}
                  aria-describedby={fieldErrors.documentNumber ? 'documentNumber-error' : undefined}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-200"
                />
                {fieldErrors.documentNumber ? (
                  <p className="text-sm font-medium text-red-700" id="documentNumber-error" role="alert">
                    {fieldErrors.documentNumber}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800" role="alert">
                  {formError}
                </p>
              ) : null}

              <button
                className="inline-flex h-12 min-w-40 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={!canSubmit}
              >
                {loading ? 'Buscando...' : 'Ingresar'}
              </button>
            </form>
          ) : (
            <section className="space-y-6" aria-live="polite">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800" role="status">
                Encontramos su información. Revísela con calma.
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
                  <dd className="mt-1 text-base font-medium text-slate-900">{profile.biometricType || 'No registrada'}</dd>
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

              {confirmed ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800" role="status">
                  Gracias. Sus datos quedaron confirmados.
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  id="confirm-data"
                  className="inline-flex h-12 min-w-44 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
                  type="button"
                  onClick={handleConfirm}
                >
                  Verificar mis datos
                </button>
                <button
                  className="inline-flex h-12 min-w-36 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
                  type="button"
                  onClick={handleBack}
                >
                  Volver
                </button>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
