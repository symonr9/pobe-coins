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
    hero: { fontFamily: t.fonts.displayHeavy, fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums'] },
    h1: { fontFamily: t.fonts.display, fontSize: 32, lineHeight: 38 },
    h2: { fontFamily: t.fonts.display, fontSize: 24, lineHeight: 30 },
    h3: { fontFamily: t.fonts.displaySemi, fontSize: 20, lineHeight: 26 },
    title: { fontFamily: t.fonts.bodyHeavy, fontSize: 17, lineHeight: 23 },
    body: { fontFamily: t.fonts.body, fontSize: 16, lineHeight: 23 },
    bodyBold: { fontFamily: t.fonts.bodyBold, fontSize: 16, lineHeight: 23 },
    small: { fontFamily: t.fonts.body, fontSize: 14, lineHeight: 20 },
    smallBold: { fontFamily: t.fonts.bodyBold, fontSize: 14, lineHeight: 20 },
    label: { fontFamily: t.fonts.bodyHeavy, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
    number: { fontFamily: t.fonts.display, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
  };
  return (
    <RNText
      {...rest}
      style={[variants[variant], { color: colors[color] ?? color }, center && { textAlign: 'center' }, style]}
      maxFontSizeMultiplier={1.6}
    />
  );
}
