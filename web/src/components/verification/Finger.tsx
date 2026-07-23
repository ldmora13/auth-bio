import { useCallback, useEffect, useRef, useState } from "react";
import type { BaseBiometricProps, BiometricPhase } from "../../shared/biometricTypes";
import styles from "./Finger.module.css";

/** Duración total del gesto simulado, en milisegundos. */
const SCAN_DURATION_MS = 1600;
/** Cuánto se mantiene visible el resultado antes de permitir reintentar. */
const RESULT_HOLD_MS = 1800;
/** Radios de los cuatro anillos que emulan las crestas de la huella. */
const RIDGE_RADII = [14, 22, 30, 38] as const;

const STATUS_COPY: Record<BiometricPhase, { title: string; sub: string }> = {
  idle: {
    title: "Coloca tu dedo en el lector",
    sub: "Mantén el cursor (o el dedo) sobre el panel para iniciar",
  },
  scanning: {
    title: "Leyendo huella…",
    sub: "No retires el contacto hasta que termine la lectura",
  },
  success: {
    title: "Huella verificada",
    sub: "Identidad confirmada correctamente",
  },
  error: {
    title: "No se pudo leer la huella",
    sub: "Vuelve a intentarlo, centrando bien el dedo",
  },
};

export interface FingerprintSimulatorProps extends BaseBiometricProps {}

export function FingerprintSimulator({
  onComplete,
  successRate = 0.85,
  disabled = false,
}: FingerprintSimulatorProps) {
  const [phase, setPhase] = useState<BiometricPhase>("idle");
  const [progress, setProgress] = useState(0);

  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const resultTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (resultTimeoutRef.current !== null) {
      window.clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const cancelScan = useCallback(() => {
    if (phase !== "scanning") return;
    clearTimers();
    setProgress(0);
    setPhase("idle");
  }, [phase, clearTimers]);

  const startScan = useCallback(() => {
    if (disabled || phase === "scanning" || phase === "success") return;

    setPhase("scanning");
    setProgress(0);
    startedAtRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAtRef.current;
      const pct = Math.min(100, (elapsed / SCAN_DURATION_MS) * 100);
      setProgress(pct);

      if (pct >= 100) {
        const success = Math.random() < successRate;
        const durationMs = Math.round(elapsed);
        setPhase(success ? "success" : "error");
        onComplete({ success, durationMs });

        if (!success) {
          resultTimeoutRef.current = window.setTimeout(() => {
            setPhase("idle");
            setProgress(0);
          }, RESULT_HOLD_MS);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, phase, successRate, onComplete]);

  const handleRetry = useCallback(() => {
    clearTimers();
    setProgress(0);
    setPhase("idle");
  }, [clearTimers]);

  const copy = STATUS_COPY[phase];
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={styles.card} data-phase={phase}>
      <span className={styles.eyebrow}>Verificación · Huella</span>

      <div
        className={styles.pad}
        data-phase={phase}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Panel de lectura de huella dactilar"
        onMouseEnter={startScan}
        onMouseLeave={cancelScan}
        onTouchStart={(e) => {
          e.preventDefault();
          startScan();
        }}
        onTouchEnd={cancelScan}
        onTouchCancel={cancelScan}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startScan();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") cancelScan();
        }}
      >
        <svg className={styles.progressRing} viewBox="0 0 96 96" aria-hidden="true">
          <circle className={styles.progressTrack} cx="48" cy="48" r="44" />
          <circle
            className={styles.progressValue}
            cx="48"
            cy="48"
            r="44"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>

        <svg className={styles.ridges} viewBox="0 0 96 96" aria-hidden="true">
          {RIDGE_RADII.map((r, i) => {
            const threshold = ((i + 1) / RIDGE_RADII.length) * 100;
            const lit =
              phase === "success" ||
              phase === "error" ||
              (phase === "scanning" && progress >= threshold - 100 / RIDGE_RADII.length / 2);
            return (
              <path
                key={r}
                className={`${styles.ridgePath} ${lit ? styles.ridgeLit : ""}`}
                d={`M 48 ${48 - r} A ${r} ${r} 0 1 1 ${48 - r * 0.94} ${48 - r * 0.34}`}
              />
            );
          })}
        </svg>
      </div>

      <div className={styles.status} role="status" aria-live="polite">
        <p className={styles.statusTitle}>{copy.title}</p>
        <p className={styles.statusSub}>{copy.sub}</p>
      </div>

      {phase === "error" && (
        <button type="button" className={styles.retry} onClick={handleRetry}>
          Reintentar ahora
        </button>
      )}
    </div>
  );
}
