import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import api from '../lib/api';
import { FingerprintSimulator } from "../components/verification/Finger";
import { FacialSimulator } from "../components/verification/Facial";
import { IrisSimulator } from "../components/verification/Iris";
import { getBiometricMethodLabel, normalizeBiometricMethods, type BiometricMethod } from "../shared/biometricMethods";

type VerificationLocationState = {
  biometricMethods?: BiometricMethod[] | null;
  biometricEnrollmentRequired?: boolean;
};

const biometricComponentMap = {
  DACTILAR: FingerprintSimulator,
  FACIAL: FacialSimulator,
  OCULAR: IrisSimulator,
} as const;

export default function Verification() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as VerificationLocationState | null;
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
    () => normalizeBiometricMethods(state?.biometricMethods ?? storedMethods ?? ['DACTILAR']),
    [state?.biometricMethods, storedMethods]
  );
  const enrollmentRequired = state?.biometricEnrollmentRequired ?? localStorage.getItem('clientBiometricEnrollmentRequired') === 'true';

  const [currentMethodIndex, setCurrentMethodIndex] = useState(0);
  const [completedMethods, setCompletedMethods] = useState<BiometricMethod[]>([]);
  const [enrollmentDone, setEnrollmentDone] = useState(false);

  useEffect(() => {
    setCurrentMethodIndex(0);
    setCompletedMethods([]);
    setEnrollmentDone(false);
  }, [biometricMethods]);

  const activeMethod = biometricMethods[currentMethodIndex];
  const BiometricComponent = activeMethod ? biometricComponentMap[activeMethod] : null;

  const handleComplete = async (result: { success: boolean; durationMs: number }) => {
    if (!result.success || !activeMethod) {
      return;
    }

    const nextCompleted = normalizeBiometricMethods([...completedMethods, activeMethod]);
    setCompletedMethods(nextCompleted);

    if (currentMethodIndex + 1 < biometricMethods.length) {
      setCurrentMethodIndex((current) => current + 1);
      return;
    }

    try {
      await api.post('/auth/biometric-enrollment/complete', {
        completedMethods: biometricMethods,
      });
      setEnrollmentDone(true);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'No se pudo completar el registro biométrico.'
        : 'No se pudo completar el registro biométrico.';
      console.error(message);
    } finally {
      // Intentionally left blank: completion either succeeds and advances,
      // or keeps the user on the current biometric screen for retry.
    }
  };

  if (enrollmentDone) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95)_0%,rgba(226,232,240,0.9)_38%,rgba(241,245,249,1)_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-10">
        <section className="mx-auto flex min-h-[80vh] w-full max-w-4xl items-center justify-center">
          <div className="w-full rounded-4xl border border-emerald-200 bg-white/90 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Registro completado
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Su verificación biométrica fue registrada correctamente
            </h1>
            <p className="mt-3 text-base text-slate-600">
              Puede cerrar esta pantalla y continuar con el acceso normal a la plataforma.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
                onClick={() => navigate('/', { replace: true })}
              >
                Volver al inicio
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
        <header className="space-y-4 text-center lg:text-left">
          <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur">
            Verificación biométrica
          </span>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Confirme su identidad
            </h1>
            <p className="mx-auto max-w-xl text-sm text-slate-500 lg:mx-0">
              {enrollmentRequired
                ? 'Debe completar todos los métodos biométricos asignados antes de continuar.'
                : 'Complete los métodos asignados para validar su acceso.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
            {biometricMethods.map((method) => (
              <span key={method} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${completedMethods.includes(method) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {getBiometricMethodLabel(method)}
              </span>
            ))}
          </div>
        </header>

        <div className="flex min-h-155 items-center justify-center rounded-4xl border border-slate-200 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8">
          {BiometricComponent ? (
            <div className="flex w-full justify-center">
              <BiometricComponent onComplete={handleComplete} />
            </div>
          ) : (
            <div className="max-w-md rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
              No se encontró un tipo biométrico válido para este cliente. Contacte al asesor.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
