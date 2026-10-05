import { render, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { Text, Pressable } from 'react-native';
import { ThemeProvider, useAppColorScheme, useThemePreference } from '../ui/ThemeProvider';
import { readTheme, writeTheme } from '../ui/themeStorage';

jest.mock('../ui/themeStorage', () => ({ readTheme: jest.fn(), writeTheme: jest.fn() }));
jest.mock('../ui/colorScheme', () => ({ usePreferredColorScheme: () => 'dark' }));
function Preview() {
  const scheme = useAppColorScheme();
  const { setPreference } = useThemePreference();
  return (
    <>
      <Text>{scheme}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Light"
        onPress={() => setPreference('light')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="System"
        onPress={() => setPreference('system')}
      />
    </>
  );
}
beforeEach(() => {
  jest.mocked(readTheme).mockReset().mockResolvedValue(null);
  jest.mocked(writeTheme).mockReset().mockResolvedValue(undefined);
});
test('follows the system, switches immediately, and persists selections', async () => {
  render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  expect(screen.getByText('dark')).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Light' }));
  expect(screen.getByText('light')).toBeTruthy();
  await waitFor(() => expect(writeTheme).toHaveBeenCalledWith('light'));
  await fireEventAsync.press(screen.getByRole('button', { name: 'System' }));
  expect(screen.getByText('dark')).toBeTruthy();
  await waitFor(() => expect(writeTheme).toHaveBeenLastCalledWith('system'));
});
test('restores the saved appearance', async () => {
  jest.mocked(readTheme).mockResolvedValue('light');
  render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  await screen.findByText('light');
});
test('unavailable storage does not prevent switching', async () => {
  jest.mocked(readTheme).mockRejectedValue(new Error('Unavailable'));
  jest.mocked(writeTheme).mockRejectedValue(new Error('Unavailable'));
  render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Light' }));
  expect(screen.getByText('light')).toBeTruthy();
});
