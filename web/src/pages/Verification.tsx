import { useLocation } from "react-router-dom";
import { FingerprintSimulator } from "../components/verification/Finger";
import { FacialSimulator } from "../components/verification/Facial";
import { IrisSimulator } from "../components/verification/Iris";

type ClientBiometricType = "OCULAR" | "FACIAL" | "DACTILAR";

type VerificationLocationState = {
  biometricType?: ClientBiometricType | null;
};

const biometricComponentMap = {
  DACTILAR: FingerprintSimulator,
  FACIAL: FacialSimulator,
  OCULAR: IrisSimulator,
} as const;

export default function Verification() {
  const location = useLocation();
  const state = location.state as VerificationLocationState | null;

  const biometricType =
    state?.biometricType ?? (localStorage.getItem("clientBiometricType") as ClientBiometricType | null);

  const BiometricComponent = biometricType ? biometricComponentMap[biometricType] : null;

  const handleComplete = () => {
    // La pantalla es solo visual: no se envía ningún resultado al backend.
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95)_0%,rgba(226,232,240,0.9)_38%,rgba(241,245,249,1)_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-10">
      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
        <header className="space-y-4 text-center lg:text-left">
          <span className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur">
            Verificación biométrica
          </span>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Confirme su identidad
            </h1>
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
