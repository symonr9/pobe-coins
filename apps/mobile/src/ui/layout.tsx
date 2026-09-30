import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Full screen: themed background, safe areas, centered column (max 720 on web/tablets). */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  footer,
  topInset = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  topInset?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={[styles.column, padded && styles.padded, { paddingTop: (topInset ? insets.top : 0) + (padded ? 12 : 0) }]}>{children}</View>
  );
  return (
    <View style={[styles.fill, { backgroundColor: t.c.bg }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.c.accent} /> : undefined}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: t.c.bg, borderTopColor: t.c.line }]}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tint ? t.c.surfaceAlt : t.c.surface, borderColor: t.c.line, shadowColor: t.c.shadow },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, gap = 12, style, wrap, ...rest }: ViewProps & { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Stack({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label" color="soft">
          {title}
        </Text>
        {action}
      </Row>
      {children}
    </View>
  );
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 },
  padded: { paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, alignItems: 'center' },
});
