import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCamera } from "../../shared/hooks/useCamera";
import { CameraStage } from "../../shared/ui/CameraStage";
import type { BaseBiometricProps } from "../../shared/biometricTypes";
import styles from "./Iris.module.css";

const ALIGN_DURATION_MS = 1000;
const SCAN_DURATION_MS = 1700;
const RESULT_HOLD_MS = 1800;

type IrisPhase = "aligning" | "scanning" | "success" | "error";

export interface IrisSimulatorProps extends BaseBiometricProps {}

export function IrisSimulator({
  onComplete,
  successRate = 0.85,
  disabled = false,
}: IrisSimulatorProps) {
  const { videoRef, status: cameraStatus, errorMessage, requestCamera, stopCamera } = useCamera();
  const maskId = useId().replace(/:/g, "");
  const clipId = useId().replace(/:/g, "");

  const [phase, setPhase] = useState<IrisPhase>("aligning");
  const [progress, setProgress] = useState(0);
  const [canContinue, setCanContinue] = useState(false);
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

  const handleContinue = useCallback(() => {
    if (!resultRef.current) return;

    onComplete(resultRef.current);
  }, [onComplete]);

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
            setCanContinue(true);
          } else {
            resultRef.current = null;
          }

          if (!success) {
            const retryTimeout = window.setTimeout(() => {
              setPhase("aligning");
              setProgress(0);
            }, RESULT_HOLD_MS);
            timeoutsRef.current.push(retryTimeout);
          }
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, ALIGN_DURATION_MS);

    timeoutsRef.current.push(alignTimeout);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStatus, disabled]);

  const handleManualRetry = useCallback(() => {
    clearAll();
    setPhase("aligning");
    setProgress(0);
    setCanContinue(false);
    resultRef.current = null;
    setFrozenFrameSrc(null);
  }, [clearAll]);

  const locked = phase === "scanning" || phase === "success" || phase === "error";
  const { title, sub, tone } = getCopy(cameraStatus, phase);

  return (
    <div className={styles.flow}>
      <CameraStage
        eyebrow="Verificación · Ojos"
        cameraStatus={cameraStatus}
        errorMessage={errorMessage}
        videoRef={videoRef}
        frozenFrameSrc={frozenFrameSrc}
        onRequestCamera={requestCamera}
        statusTitle={title}
        statusSub={sub}
        statusTone={tone}
        showRetry={cameraStatus === "ready" && phase === "error"}
        onRetry={handleManualRetry}
        overlay={
          <svg className={styles.overlaySvg} viewBox="0 0 220 120" aria-hidden="true">
            <defs>
              <mask id={maskId}>
                <rect width="220" height="120" fill="white" />
                <ellipse cx="58" cy="60" rx="38" ry="22" fill="black" />
                <ellipse cx="162" cy="60" rx="38" ry="22" fill="black" />
              </mask>
              <clipPath id={clipId}>
                <rect x="10" y="20" width="200" height="80" />
              </clipPath>
            </defs>

            <rect width="220" height="120" fill="rgba(15, 23, 42, 0.68)" mask={`url(#${maskId})`} />
            <line className={styles.bridge} x1="98" y1="60" x2="122" y2="60" />

            {/* Ojo izquierdo */}
            <EyeGuide cx={58} locked={locked} />
            {/* Ojo derecho */}
            <EyeGuide cx={162} locked={locked} />

            {phase === "scanning" && (
              <g clipPath={`url(#${clipId})`}>
                <g className={styles.sweepGroup}>
                  <line className={styles.sweepLine} x1="110" y1="15" x2="110" y2="105" />
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
        <button type="button" className={styles.continue} onClick={handleContinue}>
          Continuar
        </button>
      )}
    </div>
  );
}

function EyeGuide({ cx, locked }: { cx: number; locked: boolean }) {
  return (
    <g>
      <ellipse
        className={styles.eyeOutline}
        data-locked={locked}
        cx={cx}
        cy={60}
        rx={38}
        ry={22}
      />
      <circle className={styles.iris} data-locked={locked} cx={cx} cy={60} r={14} />
      {/* Marcadores de alineación en las cuatro esquinas de cada guía ocular */}
      <circle className={styles.marker} data-locked={locked} cx={cx - 38} cy={60} r={2.4} />
      <circle className={styles.marker} data-locked={locked} cx={cx + 38} cy={60} r={2.4} />
      <circle className={styles.marker} data-locked={locked} cx={cx} cy={38} r={2.4} />
      <circle className={styles.marker} data-locked={locked} cx={cx} cy={82} r={2.4} />
    </g>
  );
}

function getCopy(
  cameraStatus: ReturnType<typeof useCamera>["status"],
  phase: IrisPhase
): { title: string; sub: string; tone: "neutral" | "scan" | "ok" | "err" } {
  if (cameraStatus === "requesting") {
    return {
      title: "Solicitando cámara…",
      sub: "Acepta el permiso para continuar",
      tone: "neutral",
    };
  }
  if (cameraStatus === "denied" || cameraStatus === "unavailable") {
    return {
      title: "Cámara no disponible",
      sub: "Revisa los permisos e inténtalo de nuevo",
      tone: "err",
    };
  }
  switch (phase) {
    case "aligning":
      return {
        title: "Alinea ambos ojos con las guías",
        sub: "Acércate hasta que los círculos coincidan con tus ojos",
        tone: "neutral",
      };
    case "scanning":
      return {
        title: "Escaneando iris…",
        sub: "Mantén los ojos abiertos y quietos",
        tone: "scan",
      };
    case "success":
      return {
        title: "Iris verificado",
        sub: "Identidad confirmada correctamente. Pulsa continuar para seguir.",
        tone: "ok",
      };
    case "error":
      return {
        title: "No se pudo verificar el iris",
        sub: "Acércate más y evita reflejos de luz",
        tone: "err",
      };
  }
}
