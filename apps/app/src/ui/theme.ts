import { useWindowDimensions } from 'react-native';
import { usePreferredColorScheme } from './colorScheme';
export const tokens = {
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 10, md: 18, lg: 28 },
  type: { small: 13, body: 16, title: 30, hero: 48 },
  elevation: {
    shadowColor: '#102c22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
};
export const light = {
  bg: '#F6F5F0',
  surface: '#FFFFFF',
  ink: '#183A2C',
  muted: '#6B756C',
  line: '#E2E6DC',
  primary: '#204C38',
  onPrimary: '#FFFFFF',
  soft: '#EAF0E6',
  accent: '#B85838',
  error: '#A52B29',
  errorBg: '#FCEEE9',
  focus: '#B85838',
};
export const dark = {
  bg: '#121C17',
  surface: '#1C2A22',
  ink: '#ECF2E7',
  muted: '#ADB9AD',
  line: '#35453A',
  primary: '#B7D5A5',
  onPrimary: '#183023',
  soft: '#2B3C30',
  accent: '#EBA37E',
  error: '#FFA8A3',
  errorBg: '#402B28',
  focus: '#EBA37E',
};
export function useTheme() {
  return usePreferredColorScheme() === 'dark' ? dark : light;
}
export function useDesktop() {
  return useWindowDimensions().width >= 900;
}
