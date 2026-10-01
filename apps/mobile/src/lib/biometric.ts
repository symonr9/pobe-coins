import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export async function biometricAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Resolves true when the person confirmed (or when biometrics aren't available). */
export async function confirmWithBiometrics(reason: string): Promise<boolean> {
  if (!(await biometricAvailable())) return true;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancel', disableDeviceFallback: false });
  return r.success;
}
