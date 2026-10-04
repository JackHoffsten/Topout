import { Platform, TextStyle, useWindowDimensions } from 'react-native';
import { usePreferredColorScheme } from './colorScheme';

export const webInputStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle)
    : undefined;

export const tokens = {
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 2, md: 4, lg: 6 },
  type: { small: 12, body: 14, title: 24, hero: 36 },
  font: Platform.select({
    ios: 'CascadiaMono',
    android: 'CascadiaMono',
    web: 'Consolas, CascadiaMono, Menlo, "Liberation Mono", monospace',
    default: 'CascadiaMono',
  }),
  elevation: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const light = {
  bg: '#FFFFFF',
  chrome: '#FAFAFD',
  surface: '#FAFAFD',
  input: '#FFFFFF',
  ink: '#202020',
  muted: '#606060',
  line: '#E4E5E6',
  primary: '#0069CC',
  onPrimary: '#FFFFFF',
  soft: '#EAEAEA',
  accent: '#0069CC',
  error: '#AD0707',
  errorBg: '#FDEDED',
  focus: '#0069CC',
  workoutStatus: {
    Planned: { color: '#0069CC', background: '#E7F2FF' },
    InProgress: { color: '#8A5700', background: '#FFF2D5' },
    Completed: { color: '#16733C', background: '#E4F5EA' },
  },
  syntax: {
    name: '#795E26',
    number: '#098658',
    string: '#A31515',
    keyword: '#AF00DB',
    property: '#001080',
  },
};

export const dark = {
  bg: '#121314',
  chrome: '#191A1B',
  surface: '#202122',
  input: '#191A1B',
  ink: '#BFBFBF',
  muted: '#8C8C8C',
  line: '#2A2B2C',
  primary: '#297AA0',
  onPrimary: '#FFFFFF',
  soft: '#242526',
  accent: '#48A0C7',
  error: '#F48771',
  errorBg: '#3A1D1D',
  focus: '#3994BC',
  workoutStatus: {
    Planned: { color: '#6CB6FF', background: '#182D42' },
    InProgress: { color: '#E9B949', background: '#382D18' },
    Completed: { color: '#73C991', background: '#193426' },
  },
  syntax: {
    name: '#DCDCAA',
    number: '#B5CEA8',
    string: '#CE9178',
    keyword: '#C586C0',
    property: '#9CDCFE',
  },
};

export type SyntaxKind = keyof typeof light.syntax;

export function useTheme() {
  return usePreferredColorScheme() === 'dark' ? dark : light;
}

export function useDesktop() {
  return useWindowDimensions().width >= 900;
}
