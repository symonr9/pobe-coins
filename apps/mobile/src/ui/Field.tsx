import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { Pressy } from './Pressy';
import { Row } from './layout';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

export const Field = forwardRef<TextInput, TextInputProps & { label: string; error?: string | null; hint?: string; right?: ReactNode }>(
  function Field({ label, error, hint, right, style, ...rest }, ref) {
    const t = useTheme();
    return (
      <View style={{ gap: 6 }}>
        <Text variant="smallBold" color="soft">
          {label}
        </Text>
        <Row gap={8}>
          <TextInput
            ref={ref}
            placeholderTextColor={t.c.inkSoft}
            accessibilityLabel={label}
            {...rest}
            style={[
              styles.input,
              {
                backgroundColor: t.c.surfaceAlt,
                color: t.c.ink,
                borderColor: error ? t.c.danger : 'transparent',
                fontFamily: t.fonts.bodySemi,
              },
              rest.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
              style,
            ]}
          />
          {right}
        </Row>
        {error ? (
          <Text variant="small" color="danger">
            {error}
          </Text>
        ) : hint ? (
          <Text variant="small" color="soft">
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressy
      onPress={onPress}
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, { backgroundColor: selected ? t.c.primary : t.c.surface, borderColor: selected ? t.c.accent : t.c.line }]}
    >
      <Row gap={6}>
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        {icon ? <Icon name={icon} size={16} color={selected ? t.c.onPrimary : t.c.ink} /> : null}
        <Text variant="smallBold" color={selected ? t.c.onPrimary : t.c.ink}>
          {label}
        </Text>
      </Row>
    </Pressy>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: t.c.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressy
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[
              styles.segmentItem,
              on && { backgroundColor: t.c.surface, shadowColor: t.c.shadow, shadowOpacity: 1, shadowRadius: 6, elevation: 1 },
            ]}
          >
            <Text variant="smallBold" color={on ? 'ink' : 'soft'} center numberOfLines={1}>
              {o.label}
            </Text>
          </Pressy>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyBold">{label}</Text>
        {hint ? (
          <Text variant="small" color="soft">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: t.c.accent, false: t.c.line }}
        thumbColor={t.c.surface}
      />
    </Row>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressy onPress={onPress} scaleTo={0.98} style={styles.listRow} disabled={!onPress && !right}>
      <Row>
        {icon ? (
          <View style={[styles.iconBubble, { backgroundColor: t.c.surfaceAlt }]}>
            <Icon name={icon} size={20} color={danger ? t.c.danger : t.c.accent} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyBold" color={danger ? 'danger' : 'ink'}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color="soft" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ?? (onPress ? <Icon name="chevron" size={18} color={t.c.inkSoft} /> : null)}
      </Row>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 2,
    minHeight: 48,
  },
  chip: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4 },
  segmentItem: { flex: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 8 },
  listRow: { paddingVertical: 10 },
  iconBubble: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
