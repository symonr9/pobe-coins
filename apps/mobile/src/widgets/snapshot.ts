import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, type ThemeName } from '@pobe/core';
import type { WidgetSnapshot } from '@/api/types';

const KEY = 'pobe.widget';

export async function saveSnapshot(s: WidgetSnapshot) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined);
}

export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export function widgetColors(theme: string) {
  const p = (THEMES[theme as ThemeName] ?? THEMES.pink).light;
  return { bg: p.primary, ink: p.onPrimary, soft: p.onPrimary, card: p.surface };
}
