import { useCallback, useEffect, useRef, useState } from "react";
import handImage from "../../assets/hand.png";
import type { BaseBiometricProps, BiometricPhase, BiometricResult } from "../../shared/biometricTypes";
import styles from "./Finger.module.css";

const SCAN_DURATION_MS = 1700;
const RESULT_HOLD_MS = 2000;
const HAND_FADE_MS = 280;
const RIDGE_RADII = [38, 32, 26, 20, 14, 9] as const;
const HAND_COMPLETE_HOLD_MS = 5000;

type FingerKey = "thumb" | "index" | "middle" | "ring" | "pinky";

type FingerFlowMode = "full-enrollment" | "quick-verification";

type FingerStep = {
  hand: "left" | "right";
  finger: FingerKey;
  label: string;
  short: string;
};

const FULL_FINGER_SEQUENCE: FingerStep[] = [
  { hand: "left", finger: "thumb", label: "Left thumb", short: "Thumb" },
  { hand: "left", finger: "index", label: "Left index", short: "Index" },
  { hand: "left", finger: "middle", label: "Left middle", short: "Middle" },
  { hand: "left", finger: "ring", label: "Left ring", short: "Ring" },
  { hand: "left", finger: "pinky", label: "Left pinky", short: "Pinky" },
  { hand: "right", finger: "thumb", label: "Right thumb", short: "Thumb" },
  { hand: "right", finger: "index", label: "Right index", short: "Index" },
  { hand: "right", finger: "middle", label: "Right middle", short: "Middle" },
  { hand: "right", finger: "ring", label: "Right ring", short: "Ring" },
  { hand: "right", finger: "pinky", label: "Right pinky", short: "Pinky" },
];

const STATUS_COPY_ENROLLMENT: Record<BiometricPhase | "remove" | "switching", { title: string; sub: string }> = {
  idle: {
    title: "Place your finger on the reader",
    sub: "Keep your finger on the panel.",
  },
  scanning: {
    title: "Reading fingerprint",
    sub: "Keep your finger in position",
  },
  success: {
    title: "Fingerprint registered successfully",
    sub: "Remove your finger from the reader to continue with the next.",
  },
  error: {
    title: "Fingerprint could not be registered",
    sub: "Remove your finger from the reader and try again.",
  },
  remove: {
    title: "Remove your finger from the reader",
    sub: "Once removed, the next finger will be prepared.",
  },
  switching: {
    title: "Switching hands",
    sub: "Preparing the next hand. Please wait.",
  },
};

const STATUS_COPY_VERIFICATION: Record<BiometricPhase | "remove" | "switching", { title: string; sub: string }> = {
  idle: {
    title: "Place your finger to verify",
    sub: "You must validate 2 random fingers per hand.",
  },
  scanning: {
    title: "Validating fingerprint…",
    sub: "Keep the position. Do not move the finger.",
  },
  success: {
    title: "Fingerprint validated successfully",
    sub: "Remove your finger from the reader to continue with the next.",
  },
  error: {
    title: "Fingerprint could not be validated",
    sub: "Remove your finger and place it again to retry.",
  },
  remove: {
    title: "Remove your finger from the reader",
    sub: "Once removed, the next finger will be prepared.",
  },
  switching: {
    title: "Switching hands…",
    sub: "Preparing the next hand. Please wait.",
  },
};

function shuffleFingerKeys(values: FingerKey[]) {
  const clone = [...values];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = clone[index];
    clone[index] = clone[randomIndex];
    clone[randomIndex] = current;
  }

  return clone;
}

function buildVerificationSequence(): FingerStep[] {
  const leftCandidates = shuffleFingerKeys(["thumb", "index", "middle", "ring", "pinky"]).slice(0, 2);
  const rightCandidates = shuffleFingerKeys(["thumb", "index", "middle", "ring", "pinky"]).slice(0, 2);

  return [
    ...leftCandidates.map((finger) => {
      const fullStep = FULL_FINGER_SEQUENCE.find((step) => step.hand === "left" && step.finger === finger)!;
      return fullStep;
    }),
    ...rightCandidates.map((finger) => {
      const fullStep = FULL_FINGER_SEQUENCE.find((step) => step.hand === "right" && step.finger === finger)!;
      return fullStep;
    }),
  ];
}

function playPhaseSound(phase: BiometricPhase) {
  if (phase !== "success" && phase !== "error") return;

  if (phase === "error" && typeof navigator.vibrate === "function") {
    navigator.vibrate([150, 80, 150]);
  }

  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return;

  const audioContext = new AudioContextConstructor();

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  const now = audioContext.currentTime;

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.connect(audioContext.destination);

  const playTone = ({
    frequency,
    duration,
    volume = 0.12,
    type = "sine",
    delay = 0,
    pitchEnd,
  }: {
    frequency: number;
    duration: number;
    volume?: number;
    type?: OscillatorType;
    delay?: number;
    pitchEnd?: number;
  }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const start = now + delay;
    const end = start + duration;

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(frequency, start);

    if (pitchEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(
        pitchEnd,
        end
      );
    }

    // Ataque extremadamente corto y suave
    gain.gain.setValueAtTime(0.0001, start);

    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + 0.015
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      end
    );

    oscillator.connect(gain);
    gain.connect(masterGain);

    oscillator.start(start);
    oscillator.stop(end);
    };

    if (phase === "success") {

    playTone({
      frequency: 659.25, // E5
      duration: 0.20,
      volume: 0.09,
      type: "sine",
      pitchEnd: 676,
    });

    playTone({
      frequency: 830.61, // G#5
      duration: 0.22,
      volume: 0.075,
      type: "sine",
      delay: 0.055,
      pitchEnd: 850,
    });

    playTone({
      frequency: 987.77, // B5
      duration: 0.30,
      volume: 0.065,
      type: "sine",
      delay: 0.11,
      pitchEnd: 1000,
    });

    } else {
      playTone({
        frequency: 392.0, // G4
        duration: 0.18,
        volume: 0.09,
        type: "triangle",
        pitchEnd: 375,
      });

      playTone({
        frequency: 261.63, // C4
        duration: 0.26,
        volume: 0.075,
        type: "triangle",
        delay: 0.10,
        pitchEnd: 245,
      });
    }

    // Fade out general
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(
      1,
      now + 0.01
    );

    masterGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (phase === "success" ? 0.48 : 0.38)
    );

    const totalDuration = phase === "success" ? 0.55 : 0.45;

    window.setTimeout(() => {
      void audioContext.close();
    }, totalDuration * 1000);
  }

export type FingerprintSimulatorProps = BaseBiometricProps & {
  flowMode?: FingerFlowMode;
};

export function FingerprintSimulator({
  onComplete,
  successRate = 0.6,
  disabled = false,
  flowMode = "full-enrollment",
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
  const lastResultRef = useRef<BiometricResult | null>(null);
  const phaseRef = useRef<BiometricPhase>("idle");
  const activeIndexRef = useRef(0);
  const retriesRef = useRef(0);
  const completedRef = useRef<number[]>([]);
  const fingerOnPadRef = useRef(false);
  const canContinueRef = useRef(false);
  const verificationSequenceRef = useRef<FingerStep[]>(buildVerificationSequence());

  const [completedHands, setCompletedHands] = useState<Set<"left" | "right">>(new Set());
  const [justCompletedHand, setJustCompletedHand] = useState<"left" | "right" | null>(null);
  const [handCountdown, setHandCountdown] = useState<number | null>(null);
  const justCompletedHandRef = useRef<"left" | "right" | null>(null);

  const fingerSequence = flowMode === "quick-verification"
    ? verificationSequenceRef.current
    : FULL_FINGER_SEQUENCE;

  useEffect(() => {
    if (phase !== phaseRef.current) {
      playPhaseSound(phase);
    }
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

  useEffect(() => {
    justCompletedHandRef.current = justCompletedHand;
  }, [justCompletedHand]);

  useEffect(() => {
    if (!justCompletedHand) return;

    const interval = window.setInterval(() => {
      setHandCountdown((current) => (current !== null && current > 1 ? current - 1 : current));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [justCompletedHand]);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    clearTimers();
    verificationSequenceRef.current = buildVerificationSequence();
    setPhase("idle");
    setProgress(0);
    setActiveIndex(0);
    setCompleted([]);
    setHandTransitioning(false);
    setCanContinue(false);
    totalStartRef.current = null;
    lastResultRef.current = null;
    retriesRef.current = 0;
    completedRef.current = [];
    fingerOnPadRef.current = false;
    canContinueRef.current = false;
    setCompletedHands(new Set());
    setJustCompletedHand(null);
  }, [clearTimers, flowMode]);

const advanceAfterFingerRemoval = useCallback(() => {
  const currentIndex = activeIndexRef.current;
  clearTimers();
  const now = performance.now();
  if (!completedRef.current.includes(currentIndex)) {
    setCompleted((prev) => (prev.includes(currentIndex) ? prev : [...prev, currentIndex]));
  }

  const nextIndex = currentIndex + 1;
  const finishedHand = fingerSequence[currentIndex].hand;

  if (nextIndex >= fingerSequence.length) {
    setCompletedHands((prev) => new Set(prev).add(finishedHand));
    const finalResult = lastResultRef.current ?? {
        success: true,
        durationMs: totalStartRef.current
          ? Math.round(now - totalStartRef.current)
          : Math.round(SCAN_DURATION_MS * fingerSequence.length),
        selectedFingers: fingerSequence.map(({ hand, finger }) => ({ hand, finger })),
      };
    setCanContinue(true);
    setPhase("success");
      const completionTimeout = window.setTimeout(() => {
        onComplete(finalResult);
      }, RESULT_HOLD_MS);
      timeoutsRef.current.push(completionTimeout);
    return;
  }

  const currentHand = finishedHand;
  const nextHand = fingerSequence[nextIndex].hand;
  const handSwitch = currentHand !== nextHand;

  lastResultRef.current = null;
  retriesRef.current = 0;
  setCanContinue(false);
  setProgress(0);

  if (handSwitch) {
    setCompletedHands((prev) => new Set(prev).add(currentHand));
    setHandCountdown(Math.ceil(HAND_COMPLETE_HOLD_MS / 1000));
    setJustCompletedHand(currentHand);
    setPhase("idle");

    const holdTimeout = window.setTimeout(() => {
      setJustCompletedHand(null);
      setHandCountdown(null);
      setHandTransitioning(true);
      const fadeOutTimeout = window.setTimeout(() => {
        setActiveIndex(nextIndex);
        const fadeInTimeout = window.setTimeout(() => {
          setHandTransitioning(false);
        }, HAND_FADE_MS);
        timeoutsRef.current.push(fadeInTimeout);
      }, HAND_FADE_MS);
      timeoutsRef.current.push(fadeOutTimeout);
    }, HAND_COMPLETE_HOLD_MS);
    timeoutsRef.current.push(holdTimeout);
  } else {
    setActiveIndex(nextIndex);
    setPhase("idle");
  }
}, [clearTimers, fingerSequence, onComplete]);

  const resetCurrentStep = useCallback(() => {
    clearTimers();
    lastResultRef.current = null;
    setCanContinue(false);
    setProgress(0);
    setPhase("idle");
  }, [clearTimers]);

  const startScan = useCallback(() => {
    if (disabled) return;
    if (phaseRef.current === "scanning" || phaseRef.current === "success") return;
    if (handTransitioning) return;
    if (justCompletedHandRef.current) return;

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
            selectedFingers: fingerSequence.map(({ hand, finger }) => ({ hand, finger })),
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
    if (disabled || handTransitioning || justCompletedHandRef.current) return;
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

  const activeStep = fingerSequence[activeIndex];
  const currentHand: "left" | "right" = activeStep.hand;

  const copySet = flowMode === "quick-verification" ? STATUS_COPY_VERIFICATION : STATUS_COPY_ENROLLMENT;
  const statusKey: keyof typeof copySet = handTransitioning
    ? "switching"
    : phase === "success" && fingerOnPadRef.current
      ? "remove"
      : phase;
  const copy = justCompletedHand
    ? {
        title: `¡Hand ${justCompletedHand === "left" ? "left" : "right"} ${flowMode === "quick-verification" ? "validated" : "completed"}!`,
        sub: `Now we will continue with your ${justCompletedHand === "left" ? "right" : "left"} hand.`,
      }
    : copySet[statusKey];

  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={styles.card} data-phase={phase}>
      <div className={styles.stageHeader}>
        <div className={styles.handStepper}>
          <span className={`${styles.handStepPill} ${completedHands.has("left") ? styles.handStepDone : currentHand === "left" ? styles.handStepActive : ""}`}>
            {completedHands.has("left") ? "✓" : "1"} Left hand
          </span>
          <span className={styles.handStepArrow}>→</span>
          <span className={`${styles.handStepPill} ${completedHands.has("right") ? styles.handStepDone : currentHand === "right" ? styles.handStepActive : ""}`}>
            {completedHands.has("right") ? "✓" : "2"} Right hand
          </span>
        </div>
        <strong className={styles.fingerLabel}>{activeStep.label}</strong>
      </div>

      <section className={styles.handCard} aria-label={currentHand === "left" ? "Left hand" : "Right hand"}>
        {justCompletedHand && (
          <div className={styles.handCompleteOverlay} role="status" aria-live="polite">
            <div className={styles.handCompleteIconWrap}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={styles.handCompleteIcon}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className={styles.handCompleteTitle}>
              Hand {justCompletedHand === "left" ? "left" : "right"} {flowMode === "quick-verification" ? "validated" : "completed"}
            </p>
            <p className={styles.handCompleteSub}>
              Now we will continue with your {justCompletedHand === "left" ? "right" : "left"} hand in {handCountdown ?? Math.ceil(HAND_COMPLETE_HOLD_MS / 1000)} seconds.
            </p>
          </div>
        )}
        {(phase === "success" || phase === "error") && (
            <div
              className={styles.resultOverlay}
              data-result={phase}
              aria-hidden="true"
            >
              <span className={styles.resultIcon}>{phase === "success" ? "✓" : "×"}</span>
            </div>
          )}
        <div
          className={`${styles.handWrapper} ${
            handTransitioning ? styles.handFadeOut : styles.handFadeIn
          }`}
          data-hand={currentHand}
        >
          <img
            src={handImage}
            alt={`Visual guide for the ${currentHand === "left" ? "left" : "right"} hand`}
            className={`${styles.handImage} ${currentHand === "left" ? styles.handMirror : ""}`}
            draggable={false}
          />

          {fingerSequence.map((step, globalIdx) => ({ step, globalIdx }))
            .filter(({ step }) => step.hand === currentHand)
            .map(({ step, globalIdx }) => {
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
                key={`${step.label}-${globalIdx}`}
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
          <span className={styles.focusLabel}>Current finger</span>
          <strong className={styles.readerFinger}>{activeStep.label}</strong>
        </div>
        <div
          className={styles.pad}
          data-phase={phase}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || handTransitioning || !!justCompletedHand}
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

    </div>
  );
}
