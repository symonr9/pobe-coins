/** Non-secret per-device preferences (theme mode, sounds, Face ID, analytics opt-out). */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Prefs {
  mode: 'system' | 'light' | 'dark';
  sounds: boolean;
  haptics: boolean;
  biometricSpend: boolean;
  analytics: boolean;
  seenOnboarding: boolean;
  recentLines: string[];
}

export const DEFAULT_PREFS: Prefs = {
  mode: 'system',
  sounds: true,
  haptics: true,
  biometricSpend: false,
  analytics: true,
  seenOnboarding: false,
  recentLines: [],
};

const KEY = 'pobe.prefs';

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(p: Prefs) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
