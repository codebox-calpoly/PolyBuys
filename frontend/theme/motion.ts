import { Easing } from 'react-native';

/** Shared motion config for entrance and transition animations */
export const motion = {
  duration: 320,
  delayPerItem: 45,
  maxStaggerDelay: 240,
  distance: 16,
  easing: Easing.out(Easing.cubic),
} as const;
