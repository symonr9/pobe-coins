import { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ChubbyAccessory, ChubbyPose } from '@pobe/core';
import { FONTS, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { chubbyArt } from './assets';

/** Chubbybara, gently breathing and blinking. `bounceKey` changes make him hop. */
export function Chubby({
  pose = 'idle',
  accessory = 'none',
  size = 140,
  animate = true,
  bounceKey,
}: {
  pose?: ChubbyPose;
  accessory?: ChubbyAccessory;
  size?: number;
  animate?: boolean;
  bounceKey?: unknown;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const breathe = useSharedValue(1);
  const hop = useSharedValue(0);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!animate || reduce) return;
    breathe.value = withRepeat(withTiming(1.025, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => setBlink(false), 140);
          schedule();
        },
        4000 + Math.random() * 3000,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [animate, reduce, breathe]);

  useEffect(() => {
    if (bounceKey === undefined || reduce) return;
    hop.value = withSequence(withTiming(-size * 0.12, { duration: 160 }), withSpring(0, { damping: 7, stiffness: 180 }));
  }, [bounceKey, reduce, hop, size]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { scaleX: breathe.value }, { scaleY: 1 - (breathe.value - 1) * 0.5 }],
  }));
  const art = useMemo(() => chubbyArt(pose, accessory, t.c.primary, blink), [pose, accessory, t.c.primary, blink]);

  return (
    <Animated.View
      style={[{ width: size, height: size, transformOrigin: 'bottom' }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Chubbybara the capybara"
    >
      {art.kind === 'svg' ? (
        <SvgXml xml={art.xml} width={size} height={size} />
      ) : (
        <Image source={art.source} style={{ width: size, height: size }} resizeMode="contain" />
      )}
    </Animated.View>
  );
}

/** Speech bubble next to Chubbybara. */
export function Bubble({ text, tail = 'left' }: { text: string; tail?: 'left' | 'bottom' }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.c.surface,
        borderColor: t.c.line,
        borderWidth: 1,
        borderRadius: 18,
        borderBottomLeftRadius: tail === 'left' ? 4 : 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexShrink: 1,
        shadowColor: t.c.shadow,
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <BubbleText text={text} />
    </View>
  );
}

function BubbleText({ text }: { text: string }) {
  return (
    <Text variant="body" style={{ fontFamily: FONTS.bodySemi }}>
      {text}
    </Text>
  );
}
