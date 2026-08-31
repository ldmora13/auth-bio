import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import api from '../lib/api';
import { FingerprintSimulator } from "../components/verification/Finger";
import { FacialSimulator } from "../components/verification/Facial";
import { IrisSimulator } from "../components/verification/Iris";
import { normalizeBiometricMethods, type BiometricMethod } from "../shared/biometricMethods";
import type { BiometricResult, FingerSelection } from "../shared/biometricTypes";

type VerificationLocationState = {
  biometricMethods?: BiometricMethod[] | null;
  biometricEnrollmentRequired?: boolean;
  clientId?: string;
  documentType?: string;
  documentNumber?: string;
};

const biometricComponentMap = {
  DACTILAR: FingerprintSimulator,
  DACTILAR_REGISTRO: FingerprintSimulator,
  DACTILAR_VERIFICACION: FingerprintSimulator,
  FACIAL: FacialSimulator,
  OCULAR: IrisSimulator,
} as const;

const SuccessIcon = () => (
  <div className="mx-auto bg-green-50 rounded-full h-20 w-20 flex items-center justify-center">
    <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

const biometricMethodValues: BiometricMethod[] = ['DACTILAR', 'DACTILAR_REGISTRO', 'DACTILAR_VERIFICACION', 'FACIAL', 'OCULAR'];

export default function Verification() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as VerificationLocationState | null;
  const documentType = state?.documentType ?? localStorage.getItem('clientDocumentType') ?? undefined;
  const documentNumber = state?.documentNumber ?? localStorage.getItem('clientDocumentNumber') ?? undefined;
  const clientId = state?.clientId ?? localStorage.getItem('clientId') ?? undefined;
  const queryMethods = useMemo(() => {
  const methodsParam = new URLSearchParams(location.search).get('methods');

    if (!methodsParam) {
      return null;
    }

    const parsedMethods = methodsParam
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is BiometricMethod => biometricMethodValues.includes(value as BiometricMethod));

    return parsedMethods.length > 0 ? normalizeBiometricMethods(parsedMethods) : null;
  }, [location.search]);

  const storedMethods = useMemo(() => {
    const raw = localStorage.getItem('clientBiometricMethods');
    if (!raw) return null;

    try {
      return normalizeBiometricMethods(JSON.parse(raw) as BiometricMethod[]);
    } catch {
      return null;
    }
  }, []);

  const biometricMethods = useMemo(
    () => normalizeBiometricMethods(queryMethods ?? state?.biometricMethods ?? storedMethods ?? ['DACTILAR_REGISTRO']),
    [queryMethods, state?.biometricMethods, storedMethods]
  );

  const [currentMethodIndex, setCurrentMethodIndex] = useState(0);
  const [completedMethods, setCompletedMethods] = useState<BiometricMethod[]>([]);
  const [selectedFingers, setSelectedFingers] = useState<FingerSelection[]>([]);
  const [enrollmentDone, setEnrollmentDone] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    setCurrentMethodIndex(0);
    setCompletedMethods([]);
    setSelectedFingers([]);
    setEnrollmentDone(false);
  }, [biometricMethods]);

  const activeMethod = biometricMethods[currentMethodIndex];
  const BiometricComponent = activeMethod ? biometricComponentMap[activeMethod] : null;
  const fingerprintFlowMode = activeMethod === 'DACTILAR_VERIFICACION' ? 'quick-verification' : 'full-enrollment';

  const handleComplete = async (result: BiometricResult) => {
    if (!result.success || !activeMethod || isSubmittingRef.current) {
      return;
    }

    const nextCompleted = normalizeBiometricMethods([...completedMethods, activeMethod]);
    setCompletedMethods(nextCompleted);
    const nextSelectedFingers = result.selectedFingers?.length ? result.selectedFingers : selectedFingers;
    setSelectedFingers(nextSelectedFingers);

    if (currentMethodIndex + 1 < biometricMethods.length) {
      setCurrentMethodIndex((current) => current + 1);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      await api.post('/auth/biometric-enrollment/complete', {
        completedMethods: biometricMethods,
        documentType,
        documentNumber,
        clientId,
        selectedFingers: nextSelectedFingers,
      });

      setEnrollmentDone(true);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'No se pudo completar el registro biométrico.'
        : 'No se pudo completar el registro biométrico.';

      if (status === 401 && documentType && documentNumber) {
        try {
          const { data } = await api.post<{ sessionId?: string }>('/auth/client-verify', {
            documentType,
            documentNumber,
          });

          if (data.sessionId) {
            localStorage.setItem('clientSessionId', data.sessionId);
          }

          await api.post('/auth/biometric-enrollment/complete', {
            completedMethods: biometricMethods,
            documentType,
            documentNumber,
            clientId,
            selectedFingers: nextSelectedFingers,
          });

          setEnrollmentDone(true);
          return;
        } catch (retryError) {
          const retryMessage = axios.isAxiosError(retryError)
            ? retryError.response?.data?.error || 'No se pudo completar el registro biométrico.'
            : 'No se pudo completar el registro biométrico.';
          setSubmissionError(retryMessage);
          console.error(retryMessage);
          return;
        }
      }

      setSubmissionError(message);
      console.error(message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (enrollmentDone) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95)_0%,rgba(226,232,240,0.9)_38%,rgba(241,245,249,1)_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-10">
        <section className="mx-auto flex min-h-[80vh] w-full max-w-4xl items-center justify-center">
          <div className="w-full rounded-4xl border border-emerald-200 bg-white/90 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
            <SuccessIcon />
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Process completed successfully!
            </h1>
            <p className="mt-3 text-lg text-slate-700">
              Your biometric enrollment has been completed successfully
            </p>
            <div className="mt-6 mx-auto max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left">
              <p className="text-base font-semibold text-slate-800">📧 Check your email</p>
              <p className="mt-1 text-sm text-slate-600">
                In the next few minutes, you will receive an email with your verification certificate.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
                onClick={() => navigate('/')}
              >
                Exit
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95)_0%,rgba(226,232,240,0.9)_38%,rgba(241,245,249,1)_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-10">
      <section className="mx-auto grid w-full max-w-6xl gap-8">
          {submissionError ? (
            <div className="max-w-2xl rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-red-800 shadow-sm">
              {submissionError}
            </div>
          ) : null}
          {BiometricComponent ? (
            <div className="flex w-full justify-center">
              {activeMethod === 'DACTILAR' || activeMethod === 'DACTILAR_REGISTRO' || activeMethod === 'DACTILAR_VERIFICACION' ? (
                <FingerprintSimulator onComplete={handleComplete} flowMode={fingerprintFlowMode} disabled={isSubmitting} />
              ) : (
                <BiometricComponent onComplete={handleComplete} disabled={isSubmitting} />
              )}
            </div>
          ) : (
            <div className="max-w-md rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
              No se encontró un tipo biométrico válido para este cliente. Contacte al asesor.
            </div>
          )}
      </section>
    </main>
  );
}
