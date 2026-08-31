import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCamera } from "../../shared/hooks/useCamera";
import { CameraStage } from "../../shared/ui/CameraStage";
import type { BaseBiometricProps } from "../../shared/biometricTypes";
import styles from "./Iris.module.css";

const ALIGN_DURATION_MS = 2500;
const SCAN_DURATION_MS = 1700;

type IrisPhase = "aligning" | "scanning" | "success" | "error";

export interface IrisSimulatorProps extends BaseBiometricProps {}

export function IrisSimulator({
  onComplete,
  successRate = 0.60,
  disabled = false,
}: IrisSimulatorProps) {
  const { videoRef, status: cameraStatus, errorMessage, requestCamera, stopCamera } = useCamera();
  const maskId = useId().replace(/:/g, "");
  const clipId = useId().replace(/:/g, "");

  const [phase, setPhase] = useState<IrisPhase>("aligning");
  const [progress, setProgress] = useState(0);
  const [canContinue, setCanContinue] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [frozenFrameSrc, setFrozenFrameSrc] = useState<string | null>(null);

  const timeoutsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const resultRef = useRef<{ success: boolean; durationMs: number } | null>(null);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => clearAll, [clearAll]);

  const freezeCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) return;

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFrozenFrameSrc(canvas.toDataURL("image/png"));
    stopCamera();
  }, [stopCamera, videoRef]);

  useEffect(() => {
    if (cameraStatus !== "ready" || disabled) return;

    clearAll();
    setPhase("aligning");
    setProgress(0);
    setCanContinue(false);
    resultRef.current = null;

    const alignTimeout = window.setTimeout(() => {
      setPhase("scanning");
      const start = performance.now();

      const tick = (now: number) => {
        const elapsed = now - start;
        const pct = Math.min(100, (elapsed / SCAN_DURATION_MS) * 100);
        setProgress(pct);

        if (pct >= 100) {
          const success = Math.random() < successRate;
          setPhase(success ? "success" : "error");
          if (success) {
            resultRef.current = { success: true, durationMs: Math.round(ALIGN_DURATION_MS + elapsed) };
            freezeCurrentFrame();
          } else {
            resultRef.current = { success: false, durationMs: Math.round(ALIGN_DURATION_MS + elapsed) };
          }
          setCanContinue(true);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, ALIGN_DURATION_MS);

    timeoutsRef.current.push(alignTimeout);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStatus, disabled, retryNonce]);

  const handleManualRetry = useCallback(() => {
    clearAll();
    setPhase("aligning");
    setProgress(0);
    setCanContinue(false);
    resultRef.current = null;
    setFrozenFrameSrc(null);
    setRetryNonce((current) => current + 1);
  }, [clearAll]);

  const handleContinue = useCallback(() => {
    if (disabled) return;

    if (phase === "error") {
      handleManualRetry();
      return;
    }

    if (resultRef.current) onComplete(resultRef.current);
  }, [disabled, handleManualRetry, onComplete, phase]);

  const locked = phase === "scanning" || phase === "success" || phase === "error";
  const { title, sub, tone } = getCopy(cameraStatus, phase);

  return (
    <div className={styles.flow}>
      <CameraStage
        eyebrow="Verification · Eyes"
        cameraStatus={cameraStatus}
        errorMessage={errorMessage}
        videoRef={videoRef}
        frozenFrameSrc={frozenFrameSrc}
        onRequestCamera={requestCamera}
        statusTitle={title}
        statusSub={sub}
        statusTone={tone}
        showRetry={false}
        onRetry={handleManualRetry}
        overlay={
          <svg className={styles.overlaySvg} viewBox="0 0 220 275" aria-hidden="true">
            <defs>
              <mask id={maskId}>
                <rect width="220" height="275" fill="white" />
                <rect x="40" y="109.5" width="140" height="56" rx="4" fill="black" />
              </mask>
              <clipPath id={clipId}>
                <rect x="40" y="109.5" width="140" height="56" rx="4" />
              </clipPath>
            </defs>

            <rect width="220" height="275" fill="rgba(15, 23, 42, 0.78)" mask={`url(#${maskId})`} />

            <rect className={styles.window} data-locked={locked} x="40" y="109.5" width="140" height="56" rx="4" />

            <line className={styles.bridge} x1="98" y1="137.5" x2="122" y2="137.5" />

            {phase === "scanning" && (
              <g clipPath={`url(#${clipId})`}>
                <g className={styles.sweepGroup}>
                  <line className={styles.sweepLine} x1="110" y1="101.5" x2="110" y2="173.5" />
                </g>
              </g>
            )}
          </svg>
        }
      >
        {phase === "scanning" && (
          <div className={styles.progressTrack}>
            <div className={styles.progressValue} style={{ width: `${progress}%` }} />
          </div>
        )}
      </CameraStage>

      {canContinue && (
        <button
          type="button"
          className={`${styles.continue} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
          onClick={handleContinue}
          disabled={disabled}
        >
          {disabled ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" aria-hidden="true" />
              Processing...
            </span>
          ) : phase === "error" ? "Retry" : "Continue"}
        </button>
      )}
    </div>
  );
}

function getCopy(
  cameraStatus: ReturnType<typeof useCamera>["status"],
  phase: IrisPhase
): { title: string; sub: string; tone: "neutral" | "scan" | "ok" | "err" } {
  if (cameraStatus === "requesting") {
    return {
      title: "Requesting camera access",
      sub: "Accept the permission to continue",
      tone: "neutral",
    };
  }
  if (cameraStatus === "denied" || cameraStatus === "unavailable") {
    return {
      title: "Camera access denied",
      sub: "Check the permissions and try again",
      tone: "err",
    };
  }
  switch (phase) {
    case "aligning":
      return {
        title: "Align your eyes with the circles",
        sub: "Keep your eyes open and still",
        tone: "neutral",
      };
    case "scanning":
      return {
        title: "Scanning iris…",
        sub: "Keep your eyes open and still",
        tone: "scan",
      };
    case "success":
      return {
        title: "Iris verified",
        sub: "Identity confirmed successfully. Press continue to proceed.",
        tone: "ok",
      };
    case "error":
      return {
        title: "Could not verify iris",
        sub: "Get closer and avoid light reflections. Press retry to try again.",
        tone: "err",
      };
  }
}
