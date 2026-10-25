import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { usePreferredColorScheme } from './colorScheme';
import { readTheme, writeTheme } from './themeStorage';
import { useSaveFeedback, type SaveFeedback } from './saveFeedback';

export type ThemePreference = 'system' | 'light' | 'dark';
const ThemeContext = createContext({
  preference: 'system' as ThemePreference,
  setPreference: (_value: ThemePreference) => {},
  feedback: undefined as SaveFeedback | undefined,
  saveError: undefined as string | undefined,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setValue] = useState<ThemePreference>('system');
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());
  const { feedback, run } = useSaveFeedback('Appearance');
  const [saveError, setSaveError] = useState<string>();
  useEffect(() => {
    let active = true;
    void readTheme()
      .then((value) => {
        if (
          active &&
          !changed.current &&
          (value === 'light' || value === 'dark' || value === 'system')
        ) {
          setValue(value);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const setPreference = (value: ThemePreference) => {
    changed.current = true;
    setValue(value);
    setSaveError(undefined);
    const write = writes.current.then(() => writeTheme(value));
    writes.current = write.catch(() => {});
    void run(() => write).catch(() => {
      // A later queued preference owns the visible outcome.
      if (writes.current === queued)
        setSaveError(
          'Could not save appearance on this device. Choose the appearance again to retry.',
        );
    });
    const queued = writes.current;
  };
  return (
    <ThemeContext.Provider value={{ preference, setPreference, feedback, saveError }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemePreference = () => useContext(ThemeContext);
export function useAppColorScheme() {
  const system = usePreferredColorScheme();
  const { preference } = useThemePreference();
  return preference === 'system' ? (system ?? 'light') : preference;
}
