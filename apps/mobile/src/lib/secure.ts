/**
 * Small secret storage: Keychain/Keystore on native (expo-secure-store, ~2 KB per value),
 * localStorage on web. Every call is wrapped so a blocked store never crashes the app.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const web = Platform.OS === 'web';

export async function getSecret(key: string): Promise<string | null> {
  try {
    if (web) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn('Could not save', key, err);
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    if (web) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}
