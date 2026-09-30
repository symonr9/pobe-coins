import { type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChubbyPose } from '@pobe/core';
import { useTheme } from '@/theme';
import { Chubby, Bubble } from '@/features/chubby/Chubby';
import { Button } from './Button';
import { Icon } from './Icon';
import { Pressy } from './Pressy';
import { Row } from './layout';
import { Text } from './Text';

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: t.c.surface,
      }}
    >
      <Text variant="smallBold" color="#2A1C22" style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

/** Screen header for pushed screens. */
export function Header({ title, right, back = true }: { title: string; right?: ReactNode; back?: boolean }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
      <Row gap={6} style={{ flex: 1 }}>
        {back ? (
          <Pressy
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityLabel="Back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: t.c.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="back" size={20} />
          </Pressy>
        ) : null}
        <Text variant="h2" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityRole="header">
          {title}
        </Text>
      </Row>
      {right}
    </Row>
  );
}

export function EmptyState({
  pose = 'thinking',
  line,
  action,
}: {
  pose?: ChubbyPose;
  line: string;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
      <Chubby pose={pose} size={120} />
      <View style={{ maxWidth: 360 }}>
        <Bubble text={line} tail="bottom" />
      </View>
      {action ? <Button title={action.title} onPress={action.onPress} icon="plus" /> : null}
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 10 }} accessibilityLabel={label}>
      <ActivityIndicator color={t.c.accent} />
      <Text color="soft">{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <View style={{ alignItems: 'center', gap: 12, padding: 24 }}>
      <Chubby pose="sleepy" size={100} animate={false} />
      <Text center color="soft">
        {message}
      </Text>
      {onRetry ? <Button kind="soft" small title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

export function ProgressRing({
  progress,
  size = 72,
  stroke = 9,
  label,
  color,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
}) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? t.c.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * p} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text variant="number" style={{ fontSize: size * 0.22 }}>
          {label ?? `${Math.round(p * 100)}%`}
        </Text>
      </View>
    </View>
  );
}

/** Grouped bars: earned vs spent per week. */
export function WeekBars({
  data,
  width = 320,
  height = 150,
}: {
  data: { week: string; earned: number; spent: number }[];
  width?: number;
  height?: number;
}) {
  const t = useTheme();
  const max = Math.max(10, ...data.flatMap((d) => [d.earned, d.spent]));
  const pad = { l: 30, b: 22, t: 8 };
  const plotH = height - pad.b - pad.t;
  const slot = (width - pad.l) / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(10, slot / 3));
  const ticks = [0, Math.round(max / 2), max];
  return (
    <Svg
      width={width}
      height={height}
      accessibilityLabel={`Weekly coins: ${data.map((d) => `${d.week} earned ${d.earned}, spent ${d.spent}`).join('; ')}`}
    >
      {ticks.map((v) => {
        const y = pad.t + plotH - (v / max) * plotH;
        return (
          <G key={v}>
            <Line x1={pad.l} x2={width} y1={y} y2={y} stroke={t.c.line} strokeWidth={1} />
            <SvgText x={pad.l - 4} y={y + 4} fontSize={10} fill={t.c.inkSoft} textAnchor="end">
              {v}
            </SvgText>
          </G>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + i * slot + slot / 2;
        const he = (d.earned / max) * plotH;
        const hs = (d.spent / max) * plotH;
        return (
          <G key={d.week}>
            <Rect x={x - bw - 1} y={pad.t + plotH - he} width={bw} height={Math.max(0, he)} rx={bw / 2} fill={t.c.accent} />
            <Rect x={x + 1} y={pad.t + plotH - hs} width={bw} height={Math.max(0, hs)} rx={bw / 2} fill={t.c.secondary} />
            {i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
              <SvgText x={x} y={height - 6} fontSize={10} fill={t.c.inkSoft} textAnchor="middle">
                {d.week.slice(5).replace('-', '/')}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

/** Simple bottom sheet. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,10,15,0.35)' }} onPress={onClose} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: t.c.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          gap: 14,
          maxHeight: '85%',
        }}
      >
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: t.c.line }} />
        <Text variant="h3">{title}</Text>
        {children}
      </View>
    </Modal>
  );
}
