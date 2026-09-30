import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';

export type Variant = 'hero' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodyBold' | 'small' | 'smallBold' | 'label' | 'number';

interface Props extends TextProps {
  variant?: Variant;
  color?: 'ink' | 'soft' | 'accent' | 'onPrimary' | 'onSecondary' | 'success' | 'warning' | 'danger' | string;
  center?: boolean;
}

export function Text({ variant = 'body', color = 'ink', center, style, ...rest }: Props) {
  const t = useTheme();
  const colors: Record<string, string> = {
    ink: t.c.ink,
    soft: t.c.inkSoft,
    accent: t.c.accent,
    onPrimary: t.c.onPrimary,
    onSecondary: t.c.onSecondary,
    success: t.c.success,
    warning: t.c.warning,
    danger: t.c.danger,
  };
  const variants: Record<Variant, TextStyle> = {
    hero: { fontFamily: t.fonts.displayHeavy, fontSize: 46, lineHeight: 50, letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
    h1: { fontFamily: t.fonts.displayHeavy, fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
    h2: { fontFamily: t.fonts.display, fontSize: 23, lineHeight: 29, letterSpacing: -0.5 },
    h3: { fontFamily: t.fonts.display, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
    title: { fontFamily: t.fonts.bodyBold, fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
    body: { fontFamily: t.fonts.body, fontSize: 16, lineHeight: 24 },
    bodyBold: { fontFamily: t.fonts.bodyBold, fontSize: 16, lineHeight: 24, letterSpacing: -0.1 },
    small: { fontFamily: t.fonts.body, fontSize: 14, lineHeight: 20 },
    smallBold: { fontFamily: t.fonts.bodySemi, fontSize: 14, lineHeight: 20 },
    label: { fontFamily: t.fonts.bodyBold, fontSize: 11.5, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase' },
    number: { fontFamily: t.fonts.displayHeavy, fontSize: 18, lineHeight: 22, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  };

  return (
    <RNText
      {...rest}
      style={[variants[variant], { color: colors[color] ?? color }, center && { textAlign: 'center' }, style]}
      maxFontSizeMultiplier={1.6}
    />
  );
}
