/**
 * Design tokens. Every palette has a clean neutral base (soft white by day, true black by night)
 * with its pastel used as the accent: primary buttons, the purse card, selected states, tints.
 * Text uses neutral inks that pass WCAG AA (4.5:1) on every surface; checked by theme.test.ts.
 */

export type ThemeName = 'pink' | 'blue' | 'purple' | 'yellow' | 'green';
export type ColorMode = 'light' | 'dark';

export interface Palette {
  /** App background (neutral). */
  bg: string;
  /** Cards. */
  surface: string;
  /** Floating things above cards: sheets, dialogs, tab bar. In dark mode, lighter = higher. */
  surfaceRaised: string;
  /** Soft tint of the theme hue: chips, input fills, highlighted rows. */
  surfaceAlt: string;
  /** Signature pastel: primary buttons, selected tabs, progress fills, the purse card. */
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
  /** Hairlines and dividers. */
  line: string;
  success: string;
  warning: string;
  danger: string;
  /** Shadow color (light mode elevation). */
  shadow: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  light: Palette;
  dark: Palette;
}

/** Neutral base shared by every palette: Apple-style grouped greys by day, OLED black by night. */
const base = {
  light: {
    bg: '#F4F4F6',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    ink: '#18181B',
    inkSoft: '#5C5C66',
    line: '#E6E6EA',
    success: '#1A6B40',
    warning: '#8A5A00',
    danger: '#B3261E',
    shadow: 'rgba(17, 17, 26, 0.08)',
  },
  dark: {
    bg: '#000000',
    surface: '#141416',
    surfaceRaised: '#1F1F23',
    ink: '#F4F4F5',
    inkSoft: '#A1A1AA',
    line: '#2A2A2F',
    success: '#8FDCB0',
    warning: '#F4CF7A',
    danger: '#FFB4AB',
    shadow: 'rgba(0, 0, 0, 0)',
  },
};

export const THEMES: Record<ThemeName, Theme> = {
  pink: {
    name: 'pink',
    label: 'Strawberry milk',
    light: {
      ...base.light,
      primary: '#F9B9CD',
      onPrimary: '#6B1D3A',
      accent: '#B83E6A',
      secondary: '#C9E4F8',
      onSecondary: '#1E4466',
      surfaceAlt: '#FCEEF3',
    },
    dark: {
      ...base.dark,
      primary: '#F4A9C0',
      onPrimary: '#3A0F21',
      accent: '#FFB3CB',
      secondary: '#9CC8EA',
      onSecondary: '#0F2A42',
      surfaceAlt: '#2A1C22',
    },
  },
  blue: {
    name: 'blue',
    label: 'Sky puddle',
    light: {
      ...base.light,
      primary: '#AAD3F4',
      onPrimary: '#143A5E',
      accent: '#2D6BA3',
      secondary: '#FBD3DF',
      onSecondary: '#6B1D3A',
      surfaceAlt: '#EAF3FC',
    },
    dark: {
      ...base.dark,
      primary: '#9CCBF0',
      onPrimary: '#0C2640',
      accent: '#A8D4FA',
      secondary: '#F4B7C9',
      onSecondary: '#3A0F21',
      surfaceAlt: '#19232D',
    },
  },
  purple: {
    name: 'purple',
    label: 'Lavender nap',
    light: {
      ...base.light,
      primary: '#CFBCF5',
      onPrimary: '#3B2270',
      accent: '#6B45B8',
      secondary: '#FDE7A8',
      onSecondary: '#5A4104',
      surfaceAlt: '#F2EDFC',
    },
    dark: {
      ...base.dark,
      primary: '#C4AEF0',
      onPrimary: '#241246',
      accent: '#D2BEFF',
      secondary: '#F2D98E',
      onSecondary: '#3A2A02',
      surfaceAlt: '#221C2D',
    },
  },
  yellow: {
    name: 'yellow',
    label: 'Butter toast',
    light: {
      ...base.light,
      primary: '#FBE08C',
      onPrimary: '#533C02',
      accent: '#8A6100',
      secondary: '#BFE7CB',
      onSecondary: '#1A4A2A',
      surfaceAlt: '#FCF5DA',
    },
    dark: {
      ...base.dark,
      primary: '#F2D67E',
      onPrimary: '#332400',
      accent: '#FFDB7A',
      secondary: '#9FD8B2',
      onSecondary: '#0E2E19',
      surfaceAlt: '#28231A',
    },
  },
  green: {
    name: 'green',
    label: 'Matcha meadow',
    light: {
      ...base.light,
      primary: '#AEE1BD',
      onPrimary: '#17472A',
      accent: '#23693F',
      secondary: '#D9CCF7',
      onSecondary: '#3B2270',
      surfaceAlt: '#E9F6EC',
    },
    dark: {
      ...base.dark,
      primary: '#9ED7AF',
      onPrimary: '#0A2A16',
      accent: '#A6E6BA',
      secondary: '#C8B6F2',
      onSecondary: '#241246',
      surfaceAlt: '#19251D',
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

/**
 * Elevation. Light mode: layered soft shadows (a tight contact shadow + a wide ambient one).
 * Dark mode: no shadows (invisible on black); higher surfaces are lighter and get a hairline.
 */
export const ELEVATION = {
  light: {
    0: 'none',
    1: '0px 1px 2px rgba(17, 17, 26, 0.04), 0px 4px 14px rgba(17, 17, 26, 0.06)',
    2: '0px 2px 4px rgba(17, 17, 26, 0.05), 0px 10px 28px rgba(17, 17, 26, 0.09)',
    3: '0px 4px 8px rgba(17, 17, 26, 0.06), 0px 20px 48px rgba(17, 17, 26, 0.14)',
  },
} as const;
export type ElevationLevel = 0 | 1 | 2 | 3;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { sm: 10, md: 14, lg: 22, pill: 999 } as const;

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
