import { createContext, useContext, type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ElevationLevel } from '@pobe/core';
import { elevation, useTheme } from '@/theme';
import { Text } from './Text';

/** Width at which the app switches to the desktop/tablet layout (side rail, two columns). */
export const WIDE_BREAKPOINT = 900;
export function useWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/** Set by the tab layout: how much room the side rail takes on wide screens (0 on phones). */
export const RailContext = createContext(0);

/** Full screen: themed background, safe areas, centered column (max 720 on web/tablets). */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  footer,
  topInset = true,
  wide = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  footer?: ReactNode;
  topInset?: boolean;
  /** Allow a wider column (up to 1120) for dashboards that use <Columns>. */
  wide?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const rail = useContext(RailContext);
  const isWide = useWide();
  const inner = (
    <View
      style={[
        styles.column,
        wide && { maxWidth: 1120 },
        padded && styles.padded,
        padded && isWide && { paddingHorizontal: 32 },
        { paddingTop: (topInset ? insets.top : 0) + (padded ? (isWide ? 32 : 12) : 0) },
      ]}
    >
      {children}
    </View>
  );
  return (
    <View style={[styles.fill, { backgroundColor: t.c.bg, paddingLeft: rail }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + (rail ? 40 : 110) }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.c.accent} /> : undefined}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: t.c.bg, borderTopColor: t.c.line }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  tint,
  level = 1,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Soft hue-tinted panel with no elevation (callouts, prompts). */
  tint?: boolean;
  /** 0 = flat outlined, 1 = resting card (default), 2 = hero/featured, 3 = floating. */
  level?: ElevationLevel;
}) {
  const t = useTheme();
  return <View style={[styles.card, tint ? { backgroundColor: t.c.surfaceAlt } : elevation(t, level), style]}>{children}</View>;
}

export function Row({
  children,
  gap = 12,
  style,
  wrap,
  ...rest
}: ViewProps & { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>
      {children}
    </View>
  );
}

export function Stack({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 6 }}>
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

/** Two columns on wide screens, one stacked column on phones. */
export function Columns({ left, right, gap = 20 }: { left: ReactNode; right: ReactNode; gap?: number }) {
  const isWide = useWide();
  if (!isWide) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
      <View style={{ flex: 5, gap: 16, minWidth: 0 }}>{left}</View>
      <View style={{ flex: 6, gap: 16, minWidth: 0 }}>{right}</View>
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
  card: { borderRadius: 22, padding: 18 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, alignItems: 'center' },
});
