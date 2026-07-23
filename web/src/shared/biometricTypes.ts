/** Fases visuales por las que atraviesa cualquier simulador biométrico. */
export type BiometricPhase = "idle" | "scanning" | "success" | "error";

/** Resultado emitido cuando un simulador termina su intento. */
export interface BiometricResult {
  success: boolean;
  durationMs: number;
}

/** Props base que comparten los tres simuladores. */
export interface BaseBiometricProps {
  /** Se dispara al finalizar el intento (éxito o error). */
  onComplete: (result: BiometricResult) => void;
  /**
   * Probabilidad de éxito simulada (0–1). Por defecto 0.85.
   * Útil para forzar demostraciones de estados de error.
   */
  successRate?: number;
  /** Deshabilita la interacción (por ejemplo, mientras se envía al backend). */
  disabled?: boolean;
}

/** Estado de una fuente de cámara compartido por Facial e Iris. */
export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable";
