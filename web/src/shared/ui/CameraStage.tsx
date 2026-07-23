import type { ReactNode } from "react";
import type { CameraStatus } from "../biometricTypes";
import styles from "./CameraStage.module.css";

export interface CameraStageProps {
  eyebrow: string;
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Overlay SVG/silueta dibujada sobre el video (varía por simulador). */
  overlay: ReactNode;
  onRequestCamera: () => void;
  statusTitle: string;
  statusSub: string;
  statusTone: "neutral" | "scan" | "ok" | "err";
  /** Se muestra cuando el intento falló y se puede reintentar. */
  showRetry?: boolean;
  onRetry?: () => void;
  /** Contenido adicional (p. ej. una barra de progreso) bajo el estado. */
  children?: ReactNode;
}

/**
 * Contenedor compartido por FacialSimulator e IrisSimulator: pide acceso a
 * la cámara, muestra el video en vivo (sin analizarlo ni guardarlo) y
 * superpone la silueta guía que cada simulador define.
 */
export function CameraStage({
  eyebrow,
  cameraStatus,
  errorMessage,
  videoRef,
  overlay,
  onRequestCamera,
  statusTitle,
  statusSub,
  statusTone,
  showRetry = false,
  onRetry,
  children,
}: CameraStageProps) {
  const showVideo = cameraStatus === "ready";
  const showPermissionPrompt = cameraStatus === "denied" || cameraStatus === "unavailable";

  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>{eyebrow}</span>

      <div className={styles.viewfinder}>
        {/* El video se muestra en vivo únicamente como referencia visual del
            encuadre; ningún fotograma se procesa ni se envía al backend. */}
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          muted
          style={{ visibility: showVideo ? "visible" : "hidden" }}
        />

        {showVideo && <div className={styles.overlaySlot}>{overlay}</div>}

        {cameraStatus === "requesting" && (
          <div className={styles.placeholder}>
            <CameraIcon className={styles.placeholderIcon} />
            <p className={styles.placeholderText}>Solicitando acceso a la cámara…</p>
          </div>
        )}

        {cameraStatus === "idle" && (
          <div className={styles.placeholder}>
            <CameraIcon className={styles.placeholderIcon} />
            <p className={styles.placeholderText}>La cámara aún no se ha activado</p>
          </div>
        )}

        {showPermissionPrompt && (
          <div className={styles.placeholder}>
            <CameraOffIcon className={styles.placeholderIcon} />
            <p className={styles.placeholderText}>{errorMessage}</p>
            <button type="button" className={styles.permissionButton} onClick={onRequestCamera}>
              Permitir acceso a la cámara
            </button>
          </div>
        )}
      </div>

      <div className={styles.status} role="status" aria-live="polite">
        <p className={styles.statusTitle} data-tone={statusTone}>
          {statusTitle}
        </p>
        <p className={styles.statusSub}>{statusSub}</p>
      </div>

      {children}

      {showRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Reintentar ahora
        </button>
      )}
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.1a1 1 0 0 0 .86-.49l.68-1.14A1.5 1.5 0 0 1 10.44 4.6h3.12a1.5 1.5 0 0 1 1.3.76l.68 1.15a1 1 0 0 0 .86.49h2.1A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CameraOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.1a1 1 0 0 0 .86-.49l.68-1.14A1.5 1.5 0 0 1 10.44 4.6h3.12a1.5 1.5 0 0 1 1.3.76l.68 1.15a1 1 0 0 0 .86.49h2.1A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
