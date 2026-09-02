import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import type { BiometricMethod } from '../shared/biometricMethods';
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

const documentOptions: Array<{ value: DocumentType; label: string }> = [
  { value: 'CC', label: 'Citizenship card' },
  { value: 'DNI', label: 'National identity document' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'OTHER', label: 'Other valid document' },
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
      return value ? '' : 'Select the document type.';
    }

    if (!value.trim()) {
      return 'Enter the document number.';
    }

    if (!/^[0-9]+$/.test(value.trim())) {
      return 'Use only numbers in this field.';
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
        ? error.response?.data?.error || 'We could not find a client with that information. Please check and try again.'
        : 'We could not find a client with that information. Please check and try again.';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen bg-[#f3f7f9] text-[#005288]">
      <GovernmentHeader />
      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="border-b-4 border-[#003e67] bg-white px-6 py-7 shadow-[0_10px_30px_rgba(0,62,103,0.08)] sm:px-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#005288] sm:text-4xl">Verify your data</h1>
          <p className="mt-3 max-w-2xl font-sans text-base leading-7 text-[#31566d]">Enter the information exactly as it appears on your identity document.</p>
        </div>

        <div className="bg-white px-6 py-7 sm:px-10 sm:py-9">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="documentType" className="block font-sans text-sm font-bold text-[#003e67]">
                Document type
              </label>
              <select
                id="documentType"
                value={documentType}
                onChange={(event) => handleDocumentTypeChange(event.target.value)}
                onBlur={(event) => updateFieldError('documentType', event.target.value)}
                aria-invalid={Boolean(fieldErrors.documentType)}
                aria-describedby={fieldErrors.documentType ? 'documentType-error' : undefined}
                className="h-12 w-full rounded-sm border border-[#8eabbc] bg-white px-4 font-sans text-base text-[#005288] shadow-sm outline-none transition focus:border-[#003e67] focus:ring-4 focus:ring-[#b8cfdd]"
              >
                <option value="">Select an option</option>
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
              <label htmlFor="documentNumber" className="block font-sans text-sm font-bold text-[#003e67]">
                Document number
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
                className="h-12 w-full rounded-sm border border-[#8eabbc] bg-white px-4 font-sans text-base text-[#005288] shadow-sm outline-none transition focus:border-[#003e67] focus:ring-4 focus:ring-[#b8cfdd]"
              />
              {fieldErrors.documentNumber ? (
                <p className="text-sm font-medium text-red-700" id="documentNumber-error" role="alert">
                  {fieldErrors.documentNumber}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 font-sans text-base text-red-800" role="alert">
                {formError}
              </p>
            ) : null}

            <button
              className="inline-flex h-12 min-w-40 items-center justify-center rounded-sm bg-[#003e67] px-5 font-sans text-base font-bold text-white shadow-sm transition hover:bg-[#005288] focus:outline-none focus:ring-4 focus:ring-[#b8cfdd] disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={!canSubmit}
            >
              {loading ? 'Searching...' : 'Enter'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
