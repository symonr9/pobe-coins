/**
 * Pastel design tokens. Pastels are used for surfaces and fills; text always uses the
 * theme's deep "ink" tones so it passes WCAG AA (4.5:1) on every surface.
 * Checked by theme.test.ts.
 */

export type ThemeName = 'pink' | 'blue' | 'purple' | 'yellow' | 'green';
export type ColorMode = 'light' | 'dark';

export interface Palette {
  /** App background. */
  bg: string;
  /** Cards and sheets. */
  surface: string;
  /** Tinted panels, chips, input fills. */
  surfaceAlt: string;
  /** Signature pastel: primary buttons, selected tabs, progress fills. */
  primary: string;
  /** Text/icons placed on `primary`. */
  onPrimary: string;
  /** Deeper tone of the hue for links, focus rings, active icons. */
  accent: string;
  /** Second pastel used for secondary chips and illustrations. */
  secondary: string;
  onSecondary: string;
  ink: string;
  inkSoft: string;
  line: string;
  success: string;
  warning: string;
  danger: string;
  /** Soft shadow color. */
  shadow: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  light: Palette;
  dark: Palette;
}

const shared = {
  light: { success: '#1A6B40', warning: '#8A5A00', danger: '#B3261E', shadow: 'rgba(80, 40, 60, 0.12)' },
  dark: { success: '#8FDCB0', warning: '#F4CF7A', danger: '#FFB4AB', shadow: 'rgba(0, 0, 0, 0.45)' },
};

export const THEMES: Record<ThemeName, Theme> = {
  pink: {
    name: 'pink',
    label: 'Strawberry milk',
    light: {
      bg: '#FFF5F8',
      surface: '#FFFFFF',
      surfaceAlt: '#FFE6EE',
      primary: '#F9B9CD',
      onPrimary: '#6B1D3A',
      accent: '#B83E6A',
      secondary: '#C9E4F8',
      onSecondary: '#1E4466',
      ink: '#3A2230',
      inkSoft: '#6E5462',
      line: '#F2D3DE',
      ...shared.light,
    },
    dark: {
      bg: '#1E1418',
      surface: '#2A1C22',
      surfaceAlt: '#3A2630',
      primary: '#F4A9C0',
      onPrimary: '#3A0F21',
      accent: '#FFB3CB',
      secondary: '#9CC8EA',
      onSecondary: '#0F2A42',
      ink: '#FCEBF1',
      inkSoft: '#D4B6C2',
      line: '#4A3440',
      ...shared.dark,
    },
  },
  blue: {
    name: 'blue',
    label: 'Sky puddle',
    light: {
      bg: '#F3F8FD',
      surface: '#FFFFFF',
      surfaceAlt: '#DDEEFB',
      primary: '#AAD3F4',
      onPrimary: '#143A5E',
      accent: '#2D6BA3',
      secondary: '#FBD3DF',
      onSecondary: '#6B1D3A',
      ink: '#1E2A38',
      inkSoft: '#506070',
      line: '#D2E3F2',
      ...shared.light,
    },
    dark: {
      bg: '#11171E',
      surface: '#1A232D',
      surfaceAlt: '#25323F',
      primary: '#9CCBF0',
      onPrimary: '#0C2640',
      accent: '#A8D4FA',
      secondary: '#F4B7C9',
      onSecondary: '#3A0F21',
      ink: '#E8F2FC',
      inkSoft: '#AFC2D4',
      line: '#33424F',
      ...shared.dark,
    },
  },
  purple: {
    name: 'purple',
    label: 'Lavender nap',
    light: {
      bg: '#F8F4FE',
      surface: '#FFFFFF',
      surfaceAlt: '#ECE3FB',
      primary: '#CFBCF5',
      onPrimary: '#3B2270',
      accent: '#6B45B8',
      secondary: '#FDE7A8',
      onSecondary: '#5A4104',
      ink: '#2A2238',
      inkSoft: '#5E556E',
      line: '#E1D6F3',
      ...shared.light,
    },
    dark: {
      bg: '#17131F',
      surface: '#221C2D',
      surfaceAlt: '#2F273D',
      primary: '#C4AEF0',
      onPrimary: '#241246',
      accent: '#D2BEFF',
      secondary: '#F2D98E',
      onSecondary: '#3A2A02',
      ink: '#F1EAFD',
      inkSoft: '#C0B5D3',
      line: '#3D3450',
      ...shared.dark,
    },
  },
  yellow: {
    name: 'yellow',
    label: 'Butter toast',
    light: {
      bg: '#FFFBEC',
      surface: '#FFFFFF',
      surfaceAlt: '#FFF1C4',
      primary: '#FBE08C',
      onPrimary: '#533C02',
      accent: '#8A6100',
      secondary: '#BFE7CB',
      onSecondary: '#1A4A2A',
      ink: '#332A14',
      inkSoft: '#665B40',
      line: '#F0E3B8',
      ...shared.light,
    },
    dark: {
      bg: '#1B1810',
      surface: '#262116',
      surfaceAlt: '#342D1D',
      primary: '#F2D67E',
      onPrimary: '#332400',
      accent: '#FFDB7A',
      secondary: '#9FD8B2',
      onSecondary: '#0E2E19',
      ink: '#FCF5E0',
      inkSoft: '#D2C6A4',
      line: '#453C27',
      ...shared.dark,
    },
  },
  green: {
    name: 'green',
    label: 'Matcha meadow',
    light: {
      bg: '#F3FAF4',
      surface: '#FFFFFF',
      surfaceAlt: '#DAF1E0',
      primary: '#AEE1BD',
      onPrimary: '#17472A',
      accent: '#23693F',
      secondary: '#D9CCF7',
      onSecondary: '#3B2270',
      ink: '#1E2E24',
      inkSoft: '#506357',
      line: '#D0E8D6',
      ...shared.light,
    },
    dark: {
      bg: '#111A14',
      surface: '#1A251D',
      surfaceAlt: '#253329',
      primary: '#9ED7AF',
      onPrimary: '#0A2A16',
      accent: '#A6E6BA',
      secondary: '#C8B6F2',
      onSecondary: '#241246',
      ink: '#E7F6EC',
      inkSoft: '#AEC7B6',
      line: '#324437',
      ...shared.dark,
    },
  },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
export const DEFAULT_THEME: ThemeName = 'pink';

/** Coin art colors, shared by every theme so coins are always recognizable. */
export const COIN_STYLES: Record<number, { face: string; rim: string; ink: string; name: string }> = {
  1: { face: '#F6CDB0', rim: '#C98A63', ink: '#5A3217', name: 'Peach penny' },
  5: { face: '#C4EBD2', rim: '#6FB58B', ink: '#17472A', name: 'Mint nickel' },
  10: { face: '#C6E3F8', rim: '#6FA6CF', ink: '#143A5E', name: 'Sky dime' },
  25: { face: '#DCCDF8', rim: '#9A80D6', ink: '#3B2270', name: 'Lilac quarter' },
  50: { face: '#FCE6A6', rim: '#D6AE48', ink: '#533C02', name: 'Butter half' },
  100: { face: '#FAC3D5', rim: '#D77D9C', ink: '#6B1D3A', name: 'Rose crown' },
};

/** Fallback style for custom denominations. */
export function coinStyle(denom: number) {
  return COIN_STYLES[denom] ?? { face: '#EDE4DA', rim: '#B59B82', ink: '#4A3727', name: `${denom}-coin` };
}

export const TYPE = {
  /** One family, many weights: Plus Jakarta Sans — modern, crisp, still warm. */
  display: 'PlusJakartaSans_800ExtraBold',
  displaySemi: 'PlusJakartaSans_700Bold',
  body: 'PlusJakartaSans_500Medium',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyHeavy: 'PlusJakartaSans_800ExtraBold',
  /** Web font-family stacks for the same roles. */
  web: {
    display: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    body: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
  },
  scale: { xs: 12, sm: 14, md: 16, lg: 19, xl: 23, xxl: 30, hero: 44 },
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** Motion tokens (ms / spring configs for Reanimated). */
export const MOTION = {
  tap: 120,
  micro: 200,
  sheet: 320,
  celebrate: 1200,
  stagger: 60,
  spring: { damping: 16, stiffness: 220, mass: 1 },
  bouncy: { damping: 9, stiffness: 180, mass: 0.9 },
  gentle: { damping: 20, stiffness: 120, mass: 1 },
} as const;

// ---------- contrast helpers ----------

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
