import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { usePreferredColorScheme } from './colorScheme';
import { readTheme, writeTheme } from './themeStorage';

export type ThemePreference = 'system' | 'light' | 'dark';
const ThemeContext = createContext({
  preference: 'system' as ThemePreference,
  setPreference: (_value: ThemePreference) => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setValue] = useState<ThemePreference>('system');
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void readTheme().then((value) => {
      if (active && !changed.current && (value === 'light' || value === 'dark' || value === 'system')) {
        setValue(value);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const setPreference = (value: ThemePreference) => {
    changed.current = true;
    setValue(value);
    writes.current = writes.current.then(() => writeTheme(value)).catch(() => {});
  };
  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export const useThemePreference = () => useContext(ThemeContext);
export function useAppColorScheme() {
  const system = usePreferredColorScheme();
  const { preference } = useThemePreference();
  return preference === 'system' ? system ?? 'light' : preference;
}
