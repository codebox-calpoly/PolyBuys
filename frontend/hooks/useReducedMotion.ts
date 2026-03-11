import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Returns true when the user has enabled "Reduce Motion" in system settings.
 * Use to short-circuit entrance/transition animations.
 */
export function useReducedMotion(): { reduceMotion: boolean; isResolved: boolean } {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        setReduceMotion(enabled);
      } catch {
        setReduceMotion(false);
      } finally {
        setIsResolved(true);
      }
    };

    check();
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
      setIsResolved(true);
    });
    return () => subscription.remove();
  }, []);

  return { reduceMotion, isResolved };
}
