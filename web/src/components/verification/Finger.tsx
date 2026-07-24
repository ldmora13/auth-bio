import { useCallback, useEffect, useRef, useState } from "react";
import type { BaseBiometricProps, BiometricPhase } from "../../shared/biometricTypes";
import type { BiometricMethod } from "../../shared/biometricMethods";
import styles from "./Finger.module.css";

const SCAN_DURATION_MS = 1250;
const RESULT_HOLD_MS = 1200;
const ADVANCE_DELAY_MS = 540;
const RIDGE_RADII = [38, 32, 26, 20, 14, 9] as const;

type FingerKey = "thumb" | "index" | "middle" | "ring" | "pinky";

type FingerStep = {
  method: BiometricMethod;
  hand: "left" | "right";
  finger: FingerKey;
  label: string;
};

const FINGER_SEQUENCE: FingerStep[] = [
  { method: "DACTILAR", hand: "left", finger: "thumb", label: "Pulgar izquierdo" },
  { method: "DACTILAR", hand: "left", finger: "ring", label: "Índice izquierdo" },
  { method: "DACTILAR", hand: "left", finger: "middle", label: "Medio izquierdo" },
  { method: "DACTILAR", hand: "left", finger: "index", label: "Anular izquierdo" },
  { method: "DACTILAR", hand: "left", finger: "pinky", label: "Meñique izquierdo" },
  
  { method: "DACTILAR", hand: "right", finger: "thumb", label: "Pulgar derechoo" },
  { method: "DACTILAR", hand: "right", finger: "ring", label: "Anular derecho" },
  { method: "DACTILAR", hand: "right", finger: "middle", label: "Medio derecho" },
  { method: "DACTILAR", hand: "right", finger: "index", label: "Índice derecho" },
  { method: "DACTILAR", hand: "right", finger: "pinky", label: "Meñique derecho" },
];

const HANDS = {
  left: {
    eyebrow: "Mano izquierda",
    fingers: FINGER_SEQUENCE.slice(0, 5),
  },
  right: {
    eyebrow: "Mano derecha",
    fingers: FINGER_SEQUENCE.slice(5),
  },
} as const;

const STATUS_COPY: Record<BiometricPhase, { title: string; sub: string }> = {
  idle: {
    title: "Selecciona el dedo activo",
    sub: "Los 10 rectángulos deben completarse en orden",
  },
  scanning: {
    title: "Leyendo huella…",
    sub: "Mantén el dedo sobre la zona resaltada",
  },
  success: {
    title: "Huella verificada",
    sub: "Dedo completado correctamente",
  },
  error: {
    title: "No se pudo leer la huella",
    sub: "Repite el mismo dedo hasta validarlo",
  },
};

export type FingerprintSimulatorProps = BaseBiometricProps;

export function FingerprintSimulator({
  onComplete,
  successRate = 0.85,
  disabled = false,
}: FingerprintSimulatorProps) {
  const [phase, setPhase] = useState<BiometricPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [activeFingerIndex, setActiveFingerIndex] = useState(0);
  const [completedFingerIndices, setCompletedFingerIndices] = useState<number[]>([]);

  const rafRef = useRef<number | null>(null);
  const scanStartedAtRef = useRef(0);
  const totalStartedAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const phaseRef = useRef<BiometricPhase>("idle");
  const activeFingerIndexRef = useRef(0);
  const hoverIntentRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    activeFingerIndexRef.current = activeFingerIndex;
  }, [activeFingerIndex]);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const resetCurrentStep = useCallback(() => {
    clearTimers();
    setProgress(0);
    setPhase("idle");
  }, [clearTimers]);

  const advanceStep = useCallback(() => {
    const currentIndex = activeFingerIndexRef.current;
    const nextIndex = currentIndex + 1;

    setCompletedFingerIndices((current) => (current.includes(currentIndex) ? current : [...current, currentIndex]));

    if (nextIndex >= FINGER_SEQUENCE.length) {
      const durationMs = totalStartedAtRef.current
        ? Math.round(performance.now() - totalStartedAtRef.current)
        : Math.round(SCAN_DURATION_MS);
      setPhase("success");
      setProgress(100);
      onComplete({ success: true, durationMs });
      return;
    }

    setActiveFingerIndex(nextIndex);
    setPhase("idle");
    setProgress(0);
  }, [onComplete]);

  const startScan = useCallback(() => {
    if (disabled || phaseRef.current === "scanning" || phaseRef.current === "success") return;

    clearTimers();
    setPhase("scanning");
    setProgress(0);

    if (totalStartedAtRef.current === null) {
      totalStartedAtRef.current = performance.now();
    }
    scanStartedAtRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - scanStartedAtRef.current;
      const pct = Math.min(100, (elapsed / SCAN_DURATION_MS) * 100);
      setProgress(pct);

      if (pct >= 100) {
        const success = Math.random() < successRate;
        setPhase(success ? "success" : "error");
        if (success) {
          timeoutRef.current = window.setTimeout(() => {
            advanceStep();
          }, ADVANCE_DELAY_MS);
        } else {
          timeoutRef.current = window.setTimeout(() => {
            resetCurrentStep();
          }, RESULT_HOLD_MS);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [advanceStep, clearTimers, disabled, resetCurrentStep, successRate]);

  useEffect(() => {
    if (phase !== "idle" || disabled) return;
    if (!hoverIntentRef.current) return;
    if (activeFingerIndex >= FINGER_SEQUENCE.length) return;

    startScan();
  }, [activeFingerIndex, disabled, phase, startScan]);

  const cancelScan = useCallback(() => {
    hoverIntentRef.current = false;

    if (phaseRef.current !== "scanning") {
      return;
    }

    clearTimers();
    setProgress(0);
    setPhase("idle");
  }, [clearTimers]);

  const activeStep = FINGER_SEQUENCE[activeFingerIndex];
  const copy = STATUS_COPY[phase];
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={styles.card} data-phase={phase}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Verificación · Huellas</span>
          <h2 className={styles.title}>Registro de 10 huellas dactilares</h2>
          <p className={styles.description}>
            Ambas manos deben registrarse en orden. El dedo activo se resalta arriba y el lector inferior completa la lectura al pasar el cursor.
          </p>
        </div>
        <div className={styles.pill}>
          {activeFingerIndex + 1}/{FINGER_SEQUENCE.length}
        </div>
      </div>

      <div className={styles.handsGrid} aria-label="Ambas manos con zonas de huella">
        {(["left", "right"] as const).map((hand) => (
          <HandPanel
            key={hand}
            hand={hand}
            activeFingerIndex={activeFingerIndex}
            completedFingerIndices={completedFingerIndices}
            disabled={disabled}
          />
        ))}
      </div>

      <div className={styles.readerPanel}>
        <div className={styles.readerMeta}>
          <span className={styles.focusLabel}>Dedo actual</span>
          <strong className={styles.readerFinger}>{activeStep.label}</strong>
          <p className={styles.readerHint}>
            Pasa el cursor por el lector para completar este dedo y avanzar al siguiente.
          </p>
        </div>

        <div
          className={styles.pad}
          data-phase={phase}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Panel de lectura de huella dactilar"
          onMouseEnter={() => {
            hoverIntentRef.current = true;
            startScan();
          }}
          onMouseLeave={cancelScan}
          onTouchStart={(event) => {
            event.preventDefault();
            hoverIntentRef.current = true;
            startScan();
          }}
          onTouchEnd={cancelScan}
          onTouchCancel={cancelScan}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              hoverIntentRef.current = true;
              startScan();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              cancelScan();
            }
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
            {RIDGE_RADII.map((radius, index) => {
              const threshold = ((index + 1) / RIDGE_RADII.length) * 100;
              const lit =
                phase === "success" ||
                phase === "error" ||
                (phase === "scanning" && progress >= threshold - 100 / RIDGE_RADII.length / 2);

              return (
                <path
                  key={radius}
                  className={`${styles.ridgePath} ${lit ? styles.ridgeLit : ""}`}
                  d={`M 48 ${48 - radius} A ${radius} ${radius} 0 1 1 ${48 - radius * 0.94} ${48 - radius * 0.34}`}
                />
              );
            })}
          </svg>
        </div>

        <div className={styles.status} role="status" aria-live="polite">
          <p className={styles.statusTitle}>{copy.title}</p>
          <p className={styles.statusSub}>{copy.sub}</p>
        </div>
      </div>

      {phase === "error" && (
        <button type="button" className={styles.retry} onClick={resetCurrentStep}>
          Reintentar este dedo
        </button>
      )}
    </div>
  );
}

function HandPanel({
  hand,
  activeFingerIndex,
  completedFingerIndices,
  disabled,
}: {
  hand: "left" | "right";
  activeFingerIndex: number;
  completedFingerIndices: number[];
  disabled: boolean;
}) {
  const handSteps = HANDS[hand].fingers;

  return (
    <section className={styles.handCard} aria-label={HANDS[hand].eyebrow}>
      <div className={styles.handHeader}>
        <span className={styles.handEyebrow}>{HANDS[hand].eyebrow}</span>
        <span className={styles.handSub}>Pulgar a meñique</span>
      </div>

      <div className={styles.handCanvas}>
        <div className={styles.palm} aria-hidden="true" />
        {handSteps.map((step, index) => {
          const stepIndex = hand === "left" ? index : index + 5;
          const isActive = stepIndex === activeFingerIndex;
          const isCompleted = completedFingerIndices.includes(stepIndex);

          return (
            <div
              key={step.label}
              className={`${styles.fingerSlot} ${isActive ? styles.fingerActive : ""} ${isCompleted ? styles.fingerCompleted : ""}`}
              data-position={step.finger}
              data-side={hand}
              data-active={isActive}
              data-completed={isCompleted}
              data-disabled={disabled}
              aria-hidden="true"
            >
              <span className={styles.fingerNumber}>{stepIndex + 1}</span>
              <span className={styles.fingerLabel}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}