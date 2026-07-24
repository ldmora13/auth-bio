export type BiometricMethod = 'DACTILAR' | 'FACIAL' | 'OCULAR';

export const BIOMETRIC_METHOD_ORDER: BiometricMethod[] = ['DACTILAR', 'FACIAL', 'OCULAR'];

export const BIOMETRIC_METHOD_LABELS: Record<BiometricMethod, string> = {
  DACTILAR: 'Huellas dactilares',
  FACIAL: 'Verificación facial',
  OCULAR: 'Verificación de iris',
};

export function normalizeBiometricMethods(methods: BiometricMethod[]) {
  return [...new Set(methods)].sort(
    (left, right) => BIOMETRIC_METHOD_ORDER.indexOf(left) - BIOMETRIC_METHOD_ORDER.indexOf(right)
  );
}

export function resolveBiometricMethods(profile?: { biometricMethods?: BiometricMethod[] | null; biometricType?: BiometricMethod | null }) {
  const methods = profile?.biometricMethods?.length
    ? profile.biometricMethods
    : profile?.biometricType
      ? [profile.biometricType]
      : [];

  return normalizeBiometricMethods(methods.length > 0 ? methods : ['DACTILAR']);
}

export function getBiometricMethodLabel(method: BiometricMethod) {
  return BIOMETRIC_METHOD_LABELS[method];
}