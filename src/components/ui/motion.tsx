// Motion building blocks. Built on RN's Animated so they need no native setup and run the same on web.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle,
} from 'react-native';

// Web has no native animation module; asking for it there only logs a warning.
const native = Platform.OS !== 'web';
/** One curve for every entrance: fast start, long soft landing. */
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that sinks slightly while held, so every tap gets a physical answer. */
export function PressableScale({ style, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: native, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => { to(0.975); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}

/** Fades and lifts its children in once on mount; `index` staggers siblings into one sequence. */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) v.setValue(1);
      else Animated.timing(v, { toValue: 1, duration: 700, delay: index * 80, easing: EASE, useNativeDriver: native }).start();
    });
    return () => { cancelled = true; };
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Counts an integer (minor units) from its previous value up to `target`. Jumps straight there under reduced motion. */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const set = (n: number) => { current.current = n; setValue(n); };
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      const start = current.current;
      if (reduced || start === target) return set(target);
      const t0 = Date.now();
      const tick = () => {
        const p = Math.min(1, (Date.now() - t0) / duration);
        set(Math.round(start + (target - start) * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      tick();
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [target, duration]);
  return value;
}
