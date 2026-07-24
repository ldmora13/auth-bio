import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCamera } from "../../shared/hooks/useCamera";
import { CameraStage } from "../../shared/ui/CameraStage";
import type { BaseBiometricProps } from "../../shared/biometricTypes";
import styles from "./Facial.module.css";

const ALIGN_DURATION_MS = 1100;
const SCAN_DURATION_MS = 1500;
const RESULT_HOLD_MS = 1800;

type FacialPhase = "aligning" | "scanning" | "success" | "error";

export interface FacialSimulatorProps extends BaseBiometricProps {}

export function FacialSimulator({
  onComplete,
  successRate = 0.85,
  disabled = false,
}: FacialSimulatorProps) {
  const { videoRef, status: cameraStatus, errorMessage, requestCamera } = useCamera();
  const maskId = useId().replace(/:/g, "");
  const clipId = useId().replace(/:/g, "");

  const [phase, setPhase] = useState<FacialPhase>("aligning");
  const [progress, setProgress] = useState(0);

  const timeoutsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => clearAll, [clearAll]);

  // Cuando la cámara queda lista, corre la secuencia: alinear -> escanear -> resultado.
  useEffect(() => {
    if (cameraStatus !== "ready" || disabled) return;

    clearAll();
    setPhase("aligning");
    setProgress(0);

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
          onComplete({ success, durationMs: Math.round(ALIGN_DURATION_MS + elapsed) });

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
  }, [clearAll]);

  const locked = phase === "scanning" || phase === "success" || phase === "error";

  const { title, sub, tone } = getCopy(cameraStatus, phase);

  return (
    <CameraStage
      eyebrow="Verificación · Rostro"
      cameraStatus={cameraStatus}
      errorMessage={errorMessage}
      videoRef={videoRef}
      onRequestCamera={requestCamera}
      statusTitle={title}
      statusSub={sub}
      statusTone={tone}
      showRetry={cameraStatus === "ready" && phase === "error"}
      onRetry={handleManualRetry}
      overlay={
        <svg className={styles.overlaySvg} viewBox="0 0 200 240" aria-hidden="true">
          <defs>
            <mask id={maskId}>
              <rect width="200" height="240" fill="white" />
              <ellipse cx="100" cy="120" rx="58" ry="82" fill="black" />
            </mask>
            <clipPath id={clipId}>
              <ellipse cx="100" cy="120" rx="58" ry="82" />
            </clipPath>
          </defs>

          <rect width="200" height="240" fill="rgba(15, 23, 42, 0.68)" mask={`url(#${maskId})`} />

          <path className={styles.corner} data-locked={locked} d="M14 40 V16 H38" />
          <path className={styles.corner} data-locked={locked} d="M186 40 V16 H162" />
          <path className={styles.corner} data-locked={locked} d="M14 200 V224 H38" />
          <path className={styles.corner} data-locked={locked} d="M186 200 V224 H162" />

          <ellipse className={styles.silhouette} data-locked={locked} cx="100" cy="120" rx="58" ry="82" />

          {phase === "scanning" && (
            <g clipPath={`url(#${clipId})`}>
              <line className={styles.scanLine} x1="42" x2="158" y1="120" y2="120" />
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
  );
}

function getCopy(
  cameraStatus: ReturnType<typeof useCamera>["status"],
  phase: FacialPhase
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
        title: "Centra tu rostro en el óvalo",
        sub: "Mantén una distancia y postura estables",
        tone: "neutral",
      };
    case "scanning":
      return {
        title: "Escaneando rostro…",
        sub: "No muevas la cabeza durante la lectura",
        tone: "scan",
      };
    case "success":
      return {
        title: "Rostro verificado",
        sub: "Identidad confirmada correctamente",
        tone: "ok",
      };
    case "error":
      return {
        title: "No se pudo verificar el rostro",
        sub: "Ajusta la iluminación y vuelve a intentarlo",
        tone: "err",
      };
  }
}
