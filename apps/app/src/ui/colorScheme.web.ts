import { useSyncExternalStore } from 'react';

const query =
  typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)');
const subscribe = (listener: () => void) => {
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
};
const snapshot = () => (query?.matches ? 'dark' : 'light');
// Read the media query again during render, including after background-tab suspension.
export function usePreferredColorScheme() {
  return useSyncExternalStore(subscribe, snapshot, () => 'light');
}
