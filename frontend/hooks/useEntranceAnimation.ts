import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { motion } from '../theme/motion';
import { useReducedMotion } from './useReducedMotion';

export function useEntranceAnimation(delay = 0, distance: number = motion.distance) {
  const { reduceMotion, isResolved } = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    if (!isResolved) {
      return;
    }

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration,
        delay,
        easing: motion.easing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.duration,
        delay,
        easing: motion.easing,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [delay, distance, isResolved, reduceMotion, opacity, translateY]);

  return useMemo(
    () => ({
      opacity,
      transform: [{ translateY }],
    }),
    [opacity, translateY]
  );
}
