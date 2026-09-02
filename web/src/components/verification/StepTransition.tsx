import { useEffect, useState } from "react";
import { getBiometricMethodLabel, type BiometricMethod } from "../../shared/biometricMethods";

interface StepTransitionProps {
  nextMethod: BiometricMethod;
  onContinue: () => void;
  autoAdvanceSeconds?: number;
}

export function StepTransition({ nextMethod, onContinue, autoAdvanceSeconds = 10 }: StepTransitionProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoAdvanceSeconds);

  useEffect(() => {
    setSecondsLeft(autoAdvanceSeconds);
    if (autoAdvanceSeconds <= 0) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [autoAdvanceSeconds, nextMethod]);

  useEffect(() => {
    if (autoAdvanceSeconds > 0 && secondsLeft === 0) {
      onContinue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const nextLabel = getBiometricMethodLabel(nextMethod);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/95 px-4 py-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-lg rounded-4xl border border-emerald-200 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          You have completed this step!
        </h1>
        <p className="mt-3 text-base text-slate-700">
            Now proceeding to {nextLabel.toLowerCase() === 'verificación facial' ? 'Facial verification' : 'visual verification'}.
        </p>

        <button
          type="button"
          className="mt-8 inline-flex h-12 min-w-48 items-center justify-center rounded-xl bg-slate-900 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
          onClick={onContinue}
        >
          Continue {autoAdvanceSeconds > 0 && secondsLeft > 0 ? ` (${secondsLeft})` : ""}
        </button>
      </div>
    </div>
  );
}