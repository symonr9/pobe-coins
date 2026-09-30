import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { DEFAULT_THEME, MOTION, RADIUS, SPACE, THEMES, type Palette, type ThemeName } from '@pobe/core';
import { usePrefs } from '@/lib/prefs-context';

export const FONTS = {
  display: 'Baloo2_700Bold',
  displayHeavy: 'Baloo2_800ExtraBold',
  displaySemi: 'Baloo2_600SemiBold',
  body: 'Nunito_500Medium',
  bodySemi: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyHeavy: 'Nunito_800ExtraBold',
} as const;

export interface AppTheme {
  name: ThemeName;
  dark: boolean;
  c: Palette;
  fonts: typeof FONTS;
  radius: typeof RADIUS;
  space: typeof SPACE;
  motion: typeof MOTION;
}

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ name, children }: { name?: ThemeName; children: ReactNode }) {
  const scheme = useColorScheme();
  const { prefs } = usePrefs();
  const dark = prefs.mode === 'system' ? scheme === 'dark' : prefs.mode === 'dark';
  const themeName = name && THEMES[name] ? name : DEFAULT_THEME;
  const value = useMemo<AppTheme>(
    () => ({ name: themeName, dark, c: THEMES[themeName][dark ? 'dark' : 'light'], fonts: FONTS, radius: RADIUS, space: SPACE, motion: MOTION }),
    [themeName, dark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme outside ThemeProvider');
  return t;
}

/** Memoized styles from the theme: const s = useStyles((t) => ({ box: { backgroundColor: t.c.surface } })) */
export function useStyles<T>(factory: (t: AppTheme) => T): T {
  const t = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(t), [t]);
}
