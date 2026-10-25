import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const change = () => setReduced(media.matches);
      change();
      media.addEventListener('change', change);
      return () => media.removeEventListener('change', change);
    }
    let active = true;
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((value) => {
        if (active) setReduced(!!value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
}
