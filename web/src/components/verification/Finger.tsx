import { useCallback, useEffect, useRef, useState } from "react";
import handImage from "../../assets/hand.png";
import type { BaseBiometricProps, BiometricPhase, BiometricResult } from "../../shared/biometricTypes";
import type { BiometricMethod } from "../../shared/biometricMethods";
import styles from "./Finger.module.css";

const SCAN_DURATION_MS = 1700;
const RESULT_HOLD_MS = 450;
const HAND_FADE_MS = 280;
const MAX_AUTO_RETRIES = 1;
const RIDGE_RADII = [38, 32, 26, 20, 14, 9] as const;

type FingerKey = "thumb" | "index" | "middle" | "ring" | "pinky";

type FingerStep = {
  method: BiometricMethod;
  hand: "left" | "right";
  finger: FingerKey;
  label: string;
  short: string;
};

const FINGER_SEQUENCE: FingerStep[] = [
  { method: "DACTILAR", hand: "left", finger: "thumb", label: "Pulgar izquierdo", short: "Pulgar" },
  { method: "DACTILAR", hand: "left", finger: "index", label: "Índice izquierdo", short: "Índice" },
  { method: "DACTILAR", hand: "left", finger: "middle", label: "Medio izquierdo", short: "Medio" },
  { method: "DACTILAR", hand: "left", finger: "ring", label: "Anular izquierdo", short: "Anular" },
  { method: "DACTILAR", hand: "left", finger: "pinky", label: "Meñique izquierdo", short: "Meñique" },
  { method: "DACTILAR", hand: "right", finger: "thumb", label: "Pulgar derecho", short: "Pulgar" },
  { method: "DACTILAR", hand: "right", finger: "index", label: "Índice derecho", short: "Índice" },
  { method: "DACTILAR", hand: "right", finger: "middle", label: "Medio derecho", short: "Medio" },
  { method: "DACTILAR", hand: "right", finger: "ring", label: "Anular derecho", short: "Anular" },
  { method: "DACTILAR", hand: "right", finger: "pinky", label: "Meñique derecho", short: "Meñique" },
];

const STATUS_COPY: Record<BiometricPhase | "remove" | "switching", { title: string; sub: string }> = {
  idle: {
    title: "Coloca el dedo en el lector",
    sub: "Mantén el dedo sobre el panel.",
  },
  scanning: {
    title: "Leyendo huella…",
    sub: "Mantén la posición. No muevas el dedo.",
  },
  success: {
    title: "Huella registrada correctamente",
    sub: "Quita el dedo del lector para continuar con el siguiente.",
  },
  error: {
    title: "No se pudo leer la huella",
    sub: "Quita el dedo y vuelve a colocarlo para reintentar.",
  },
  remove: {
    title: "Retira el dedo del lector",
    sub: "Una vez retirado, se preparará el siguiente dedo.",
  },
  switching: {
    title: "Cambiando de mano…",
    sub: "Preparando la siguiente mano. Por favor espera.",
  },
};

export type FingerprintSimulatorProps = BaseBiometricProps;

export function FingerprintSimulator({
  onComplete,
  successRate = 0.88,
  disabled = false,
}: FingerprintSimulatorProps) {
  const [phase, setPhase] = useState<BiometricPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [handTransitioning, setHandTransitioning] = useState(false);
  const [canContinue, setCanContinue] = useState(false);

  const rafRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const scanStartRef = useRef<number>(0);
  const totalStartRef = useRef<number | null>(null);
  const lastResultRef = useRef<{ success: boolean; durationMs: number } | null>(null);
  const resultRef = useRef<BiometricResult | null>(null);
  const phaseRef = useRef<BiometricPhase>("idle");
  const activeIndexRef = useRef(0);
  const retriesRef = useRef(0);
  const completedRef = useRef<number[]>([]);
  const fingerOnPadRef = useRef(false);
  const canContinueRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);
  useEffect(() => {
    canContinueRef.current = canContinue;
  }, [canContinue]);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const advanceAfterFingerRemoval = useCallback(() => {
    const currentIndex = activeIndexRef.current;
    clearTimers();
    const now = performance.now();
    if (!completedRef.current.includes(currentIndex)) {
      setCompleted((prev) => (prev.includes(currentIndex) ? prev : [...prev, currentIndex]));
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= FINGER_SEQUENCE.length) {
      const finalResult = lastResultRef.current ?? {
          success: true,
          durationMs: totalStartRef.current
            ? Math.round(now - totalStartRef.current)
            : Math.round(SCAN_DURATION_MS * FINGER_SEQUENCE.length),
        };
      resultRef.current = finalResult;
      setCanContinue(true);
      setPhase("success");
      return;
    }

    const currentHand = FINGER_SEQUENCE[currentIndex].hand;
    const nextHand = FINGER_SEQUENCE[nextIndex].hand;
    const handSwitch = currentHand !== nextHand;

    lastResultRef.current = null;
    retriesRef.current = 0;
    resultRef.current = null;
    setCanContinue(false);
    setProgress(0);

    if (handSwitch) {
      setHandTransitioning(true);
      setPhase("idle");
      const t1 = window.setTimeout(() => {
        setActiveIndex(nextIndex);
        const t2 = window.setTimeout(() => {
          setHandTransitioning(false);
        }, HAND_FADE_MS);
        timeoutsRef.current.push(t2);
      }, HAND_FADE_MS);
      timeoutsRef.current.push(t1);
    } else {
      setActiveIndex(nextIndex);
      setPhase("idle");
    }
  }, [clearTimers, onComplete]);

  const resetCurrentStep = useCallback(() => {
    clearTimers();
    lastResultRef.current = null;
    resultRef.current = null;
    setCanContinue(false);
    setProgress(0);
    setPhase("idle");
  }, [clearTimers]);

  const handleContinue = useCallback(() => {
    if (!resultRef.current) return;

    onComplete(resultRef.current);
  }, [onComplete]);

  const startScan = useCallback(() => {
    if (disabled) return;
    if (phaseRef.current === "scanning" || phaseRef.current === "success") return;
    if (handTransitioning) return;

    clearTimers();
    if (totalStartRef.current === null) totalStartRef.current = performance.now();
    scanStartRef.current = performance.now();
    setPhase("scanning");
    setProgress(0);

    const tick = (now: number) => {
      const elapsed = now - scanStartRef.current;
      const pct = Math.min(100, (elapsed / SCAN_DURATION_MS) * 100);
      setProgress(pct);

      if (pct >= 100) {
        const pass = Math.random() < successRate;
        if (pass) {
          retriesRef.current = 0;
          lastResultRef.current = {
            success: true,
            durationMs: totalStartRef.current
              ? Math.round(now - totalStartRef.current)
              : Math.round(SCAN_DURATION_MS),
          };
          setProgress(100);
          setPhase("success");

          if (!fingerOnPadRef.current) {
            const t = window.setTimeout(() => {
              advanceAfterFingerRemoval();
            }, RESULT_HOLD_MS);
            timeoutsRef.current.push(t);
          }
          return;
        }

        retriesRef.current += 1;
        lastResultRef.current = null;
        setPhase("error");

        if (retriesRef.current > MAX_AUTO_RETRIES) {
          const t = window.setTimeout(() => {
            if (!fingerOnPadRef.current) {
              advanceAfterFingerRemoval();
            } else {
              setPhase("success");
            }
          }, RESULT_HOLD_MS);
          timeoutsRef.current.push(t);
          return;
        }

        const t = window.setTimeout(() => {
          if (!fingerOnPadRef.current) {
            resetCurrentStep();
          } else {
            setPhase("idle");
          }
        }, RESULT_HOLD_MS);
        timeoutsRef.current.push(t);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [advanceAfterFingerRemoval, disabled, handTransitioning, resetCurrentStep, successRate]);

  const handleFingerOnPad = useCallback(() => {
    if (disabled || handTransitioning) return;
    fingerOnPadRef.current = true;

    if (phaseRef.current === "idle" || phaseRef.current === "error") {
      startScan();
    }
  }, [disabled, handTransitioning, startScan]);

  const handleFingerOffPad = useCallback(() => {
    fingerOnPadRef.current = false;

    if (phaseRef.current === "success" && canContinueRef.current) {
      return;
    }

    if (phaseRef.current === "success") {
      const t = window.setTimeout(() => advanceAfterFingerRemoval(), 180);
      timeoutsRef.current.push(t);
      return;
    }

    if (phaseRef.current === "scanning") {
      clearTimers();
      setProgress(0);
      setPhase("idle");
    }
  }, [advanceAfterFingerRemoval, clearTimers]);

  const activeStep = FINGER_SEQUENCE[activeIndex];
  const currentHand: "left" | "right" = activeStep.hand;
  const handDoneCount = completed.filter((i) => FINGER_SEQUENCE[i].hand === currentHand).length;

  const statusKey: keyof typeof STATUS_COPY = handTransitioning
    ? "switching"
    : phase === "success" && fingerOnPadRef.current
      ? "remove"
      : phase;
  const copy = STATUS_COPY[statusKey];
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={styles.card} data-phase={phase}>
      <div className={styles.stageHeader}>
        <span className={styles.handLabel}>
          {currentHand === "left" ? "Mano izquierda" : "Mano derecha"} · {handDoneCount}/5
        </span>
        <strong className={styles.fingerLabel}>{activeStep.label}</strong>
      </div>

      <section className={styles.handCard} aria-label={currentHand === "left" ? "Mano izquierda" : "Mano derecha"}>
        <div
          className={`${styles.handWrapper} ${
            handTransitioning ? styles.handFadeOut : styles.handFadeIn
          }`}
          data-hand={currentHand}
        >
          <img
            src={handImage}
            alt={`Guía visual de la mano ${currentHand === "left" ? "izquierda" : "derecha"}`}
            className={`${styles.handImage} ${currentHand === "left" ? styles.handMirror : ""}`}
            draggable={false}
          />

          {FINGER_SEQUENCE.filter((s) => s.hand === currentHand).map((step) => {
            const globalIdx = FINGER_SEQUENCE.indexOf(step);
            const isActive = globalIdx === activeIndex;
            const isDone = completed.includes(globalIdx);
            const level: "idle" | "active" | "success" | "error" | "done" = isActive
              ? phase === "success"
                ? "success"
                : phase === "error"
                  ? "error"
                  : "active"
              : isDone
                ? "done"
                : "idle";

            return (
              <div
                key={step.label}
                data-finger={step.finger}
                data-level={level}
                className={styles.fingerHighlight}
              >
                <div className={styles.fingerPulse} />
                <span className={styles.fingerBadge} aria-hidden="true">
                  {isDone ? "✓" : globalIdx + 1}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {!canContinue && (
        <div className={styles.status} role="status" aria-live="polite">
          <p className={styles.statusTitle}>{copy.title}</p>
          <p className={styles.statusSub}>{copy.sub}</p>
        </div>
      )}

      <div className={styles.readerPanel}>
        <div className={styles.readerMeta}>
          <span className={styles.focusLabel}>Dedo actual</span>
          <strong className={styles.readerFinger}>{activeStep.label}</strong>
        </div>
        <div
          className={styles.pad}
          data-phase={phase}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || handTransitioning}
          aria-label="Panel de lectura de huella dactilar"
          onMouseEnter={handleFingerOnPad}
          onMouseLeave={handleFingerOffPad}
          onTouchStart={(event) => {
            event.preventDefault();
            handleFingerOnPad();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            handleFingerOffPad();
          }}
          onTouchCancel={(event) => {
            event.preventDefault();
            handleFingerOffPad();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleFingerOnPad();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleFingerOffPad();
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
                (phase === "scanning" &&
                  progress >= threshold - 100 / RIDGE_RADII.length / 2);

              return (
                <path
                  key={radius}
                  className={`${styles.ridgePath} ${lit ? styles.ridgeLit : ""}`}
                  d={`M 48 ${48 - radius} A ${radius} ${radius} 0 1 1 ${48 - radius * 0.94} ${
                    48 - radius * 0.34
                  }`}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {canContinue && (
        <button type="button" className={styles.continue} onClick={handleContinue}>
          Continuar
        </button>
      )}
    </div>
  );
}
