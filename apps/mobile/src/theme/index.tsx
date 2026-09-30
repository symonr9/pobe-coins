import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { DEFAULT_THEME, MOTION, RADIUS, SPACE, THEMES, type Palette, type ThemeName } from '@pobe/core';
import { usePrefs } from '@/lib/prefs-context';

export const FONTS = {
  display: 'PlusJakartaSans_700Bold',
  displayHeavy: 'PlusJakartaSans_800ExtraBold',
  displaySemi: 'PlusJakartaSans_700Bold',
  body: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyHeavy: 'PlusJakartaSans_800ExtraBold',
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
    () => ({
      name: themeName,
      dark,
      c: THEMES[themeName][dark ? 'dark' : 'light'],
      fonts: FONTS,
      radius: RADIUS,
      space: SPACE,
      motion: MOTION,
    }),
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
