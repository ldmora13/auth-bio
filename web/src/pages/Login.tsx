import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import type { BiometricMethod } from '../shared/biometricMethods';

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
  const navigate = useNavigate();
  const [documentType, setDocumentType] = useState<DocumentType | ''>('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState(initialFieldErrors);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

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
  };

  const handleDocumentNumberChange = (value: string) => {
    const nextValue = value.replace(/[^0-9]/g, '');
    setDocumentNumber(nextValue);
    updateFieldError('documentNumber', nextValue);
    setFormError('');
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

    try {
      const { data } = await api.post<{ user: ClientProfile; sessionId?: string }>('/auth/client-verify', {
        documentType,
        documentNumber: documentNumber.trim(),
      });

      if (data.sessionId) {
        localStorage.setItem('clientSessionId', data.sessionId);
      }
      localStorage.setItem('clientDocumentType', documentType);
      localStorage.setItem('clientDocumentNumber', documentNumber.trim());

      navigate('/home', {
        replace: true,
        state: {
          profile: data.user,
          documentType,
          documentNumber: documentNumber.trim(),
        },
      });
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'No encontramos un cliente con esos datos. Revisa e intenta otra vez.'
        : 'No encontramos un cliente con esos datos. Revisa e intenta otra vez.';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acceso para clientes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Verifique sus datos</h1>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8">
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
        </div>
      </section>
    </main>
  );
}
