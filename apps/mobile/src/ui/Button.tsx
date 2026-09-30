import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Pressy } from './Pressy';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
  full,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  kind?: Kind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const palette: Record<Kind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: t.c.primary, fg: t.c.onPrimary },
    secondary: { bg: t.c.secondary, fg: t.c.onSecondary },
    soft: { bg: t.c.surfaceAlt, fg: t.c.ink },
    ghost: { bg: 'transparent', fg: t.c.accent, border: t.c.line },
    danger: { bg: 'transparent', fg: t.c.danger, border: t.c.line },
  };
  const p = palette[kind];
  return (
    <Pressy
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        styles.base,
        small ? styles.small : styles.normal,
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 2 : 0 },
        kind === 'primary' || kind === 'secondary'
          ? { shadowColor: t.c.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }
          : null,
        full && { alignSelf: 'stretch' },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={p.fg} size="small" /> : icon ? <Icon name={icon} color={p.fg} size={small ? 18 : 20} /> : null}
        <Text variant={small ? 'smallBold' : 'title'} color={p.fg} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  normal: { minHeight: 50, paddingHorizontal: 22, paddingVertical: 12 },
  small: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
