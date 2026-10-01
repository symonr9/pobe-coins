import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from '@pobe/core';
import { haptic } from '@/lib/feedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that squishes on press (spring) and gives a light haptic. */
export function Pressy({
  style,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  scaleTo = 0.96,
  noHaptic,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; noHaptic?: boolean }) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      onPressIn={(e) => {
        if (!reduce) scale.value = withSpring(scaleTo, MOTION.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, MOTION.bouncy);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (!noHaptic) haptic.tap();
        onPress?.(e);
      }}
      style={[style, animated, disabled && { opacity: 0.5 }]}
    />
  );
}
