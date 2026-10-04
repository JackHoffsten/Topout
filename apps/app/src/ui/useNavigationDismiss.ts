import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export function useNavigationDismiss(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [open, close]);
}
