/**
 * Celebrations, in proportion to the moment:
 *  - earn: coins drop in, Chubbybara hops with a line (≈1.2s)
 *  - milestone / goal / challenge: + confetti
 * With Reduce Motion on, a simple card fades in instead.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { payout, type ChubbyPose, type Purse } from '@pobe/core';
import { useTheme } from '@/theme';
import { haptic, playCoin } from '@/lib/feedback';
import { Coin } from '@/ui/Coins';
import { Text } from '@/ui/Text';
import { Chubby, Bubble } from './chubby/Chubby';

export interface Celebration {
  amount?: number;
  coins?: Purse;
  title?: string;
  line?: string;
  pose?: ChubbyPose;
  big?: boolean;
}

const Ctx = createContext<(c: Celebration) => void>(() => undefined);
export const useCelebrate = () => useContext(Ctx);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(Celebration & { key: number }) | null>(null);
  const celebrate = useCallback((c: Celebration) => {
    setCurrent({ ...c, key: Date.now() });
    if (c.amount && c.amount > 0) playCoin();
    if (c.big) haptic.heavy();
    else haptic.success();
  }, []);
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), current.big ? 2600 : 1900);
    return () => clearTimeout(timer);
  }, [current]);
  return (
    <Ctx.Provider value={celebrate}>
      {children}
      {current ? <Overlay c={current} onClose={() => setCurrent(null)} /> : null}
    </Ctx.Provider>
  );
}

function Overlay({ c, onClose }: { c: Celebration & { key: number }; onClose: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const coins = useMemo(() => {
    const purse = c.coins ?? (c.amount ? payout(Math.min(c.amount, 2000)) : {});
    const list: number[] = [];
    for (const [d, n] of Object.entries(purse)) for (let i = 0; i < Math.min(n, 6); i++) list.push(Number(d));
    return list.slice(0, 12);
  }, [c]);
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,10,15,0.18)' }]}
        onPress={onClose}
        accessibilityLabel="Dismiss celebration"
      />
      {!reduce && c.big ? <Confetti colors={[t.c.primary, t.c.secondary, '#FCE6A6', '#C4EBD2', '#DCCDF8']} /> : null}
      <View style={styles.center} pointerEvents="none">
        {!reduce ? coins.map((d, i) => <FallingCoin key={`${c.key}-${i}`} denom={d} index={i} total={coins.length} />) : null}
        <Animated.View
          entering={reduce ? FadeIn : ZoomIn.springify().damping(11)}
          style={[styles.card, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
        >
          <Chubby pose={c.pose ?? 'cheer'} size={110} bounceKey={c.key} />
          {c.amount ? (
            <Text variant="hero" color="success" center accessibilityLiveRegion="polite">
              +{c.amount}
            </Text>
          ) : null}
          {c.title ? (
            <Text variant="h3" center>
              {c.title}
            </Text>
          ) : null}
          {c.line ? <Bubble text={c.line} tail="bottom" /> : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function FallingCoin({ denom, index, total }: { denom: number; index: number; total: number }) {
  const y = useSharedValue(-260);
  const opacity = useSharedValue(0);
  const x = (index - (total - 1) / 2) * 26 + (index % 2 ? 6 : -6);
  useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 80 }));
    y.value = withDelay(index * 60, withSpring(-110 + (index % 3) * 6, { damping: 8, stiffness: 160 }));
    opacity.value = withDelay(900 + index * 40, withTiming(0, { duration: 300 }));
  }, [index, opacity, y]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: x }, { translateY: y.value }] }));
  return (
    <Animated.View style={[styles.coin, style]}>
      <Coin denom={denom} size={40} />
    </Animated.View>
  );
}

function Confetti({ colors }: { colors: string[] }) {
  const { width, height } = useWindowDimensions();
  const bits = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        i,
        x: width / 2 + (Math.random() - 0.5) * 60,
        dx: (Math.random() - 0.5) * width * 0.9,
        dy: height * (0.35 + Math.random() * 0.5),
        rot: Math.random() * 720 - 360,
        color: colors[i % colors.length]!,
        w: 6 + Math.random() * 8,
      })),
    [width, height, colors],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bits.map((b) => (
        <ConfettiBit key={b.i} {...b} startY={height * 0.45} />
      ))}
    </View>
  );
}

function ConfettiBit({
  x,
  dx,
  dy,
  rot,
  color,
  w,
  startY,
}: {
  x: number;
  dx: number;
  dy: number;
  rot: number;
  color: string;
  w: number;
  startY: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) });
  }, [p]);
  const style = useAnimatedStyle(() => {
    const up = -Math.sin(p.value * Math.PI) * 260;
    return {
      opacity: 1 - p.value * p.value,
      transform: [
        { translateX: x + dx * p.value },
        { translateY: startY + up + dy * p.value * p.value },
        { rotate: `${rot * p.value}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0, width: w, height: w * 0.55, backgroundColor: color, borderRadius: 2 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 28, borderWidth: 2, maxWidth: 340, width: '100%' },
  coin: { position: 'absolute' },
});
