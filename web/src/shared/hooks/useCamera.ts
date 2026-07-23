import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "../biometricTypes";

interface UseCameraOptions {
  /** Restricciones de video. Por defecto pide cámara frontal. */
  constraints?: MediaTrackConstraints;
  /** Si es false, el hook no solicita la cámara automáticamente. */
  autoStart?: boolean;
}

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorMessage: string | null;
  /** Vuelve a pedir permiso (por ejemplo tras una denegación). */
  requestCamera: () => Promise<void>;
  /** Corta el stream manualmente sin esperar al desmontaje. */
  stopCamera: () => void;
}

/**
 * Encapsula el ciclo de vida de getUserMedia: solicitud de permiso,
 * asignación al <video>, y liberación del stream al desmontar o al
 * cambiar de simulador, para evitar dejar la cámara encendida.
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { constraints, autoStart = true } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const requestCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      setErrorMessage("Este navegador no permite acceder a la cámara.");
      return;
    }

    setStatus("requesting");
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", ...constraints },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          /* Reproducción automática puede requerir interacción; se ignora. */
        });
      }
      setStatus("ready");
    } catch (err) {
      const domError = err as DOMException;
      if (domError?.name === "NotAllowedError" || domError?.name === "PermissionDeniedError") {
        setStatus("denied");
        setErrorMessage("Acceso a la cámara denegado. Habilítalo en los permisos del navegador.");
      } else if (domError?.name === "NotFoundError" || domError?.name === "OverconstrainedError") {
        setStatus("unavailable");
        setErrorMessage("No se encontró una cámara disponible en este dispositivo.");
      } else {
        setStatus("unavailable");
        setErrorMessage("No se pudo iniciar la cámara. Inténtalo de nuevo.");
      }
    }
  }, [constraints]);

  useEffect(() => {
    if (autoStart) {
      requestCamera();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, status, errorMessage, requestCamera, stopCamera };
}
