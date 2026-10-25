import { render, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { Text, Pressable, AccessibilityInfo } from 'react-native';
import { SaveStatus } from '../ui/components/SaveStatus';
import { ThemeProvider, useAppColorScheme, useThemePreference } from '../ui/ThemeProvider';
import { readTheme, writeTheme } from '../ui/themeStorage';

jest.mock('../ui/themeStorage', () => ({ readTheme: jest.fn(), writeTheme: jest.fn() }));
jest.mock('../ui/colorScheme', () => ({ usePreferredColorScheme: () => 'dark' }));
function Preview() {
  const scheme = useAppColorScheme();
  const { setPreference, feedback, saveError } = useThemePreference();
  return (
    <>
      <Text>{scheme}</Text>
      <SaveStatus feedback={feedback} />
      {!!saveError && <Text>{saveError}</Text>}
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

test('appearance reports a failed write and permits retrying the same selection', async () => {
  jest.mocked(writeTheme).mockRejectedValueOnce(new Error('Disk unavailable'));
  render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Light' }));
  await screen.findByText(/Could not save appearance on this device/);
  expect(screen.queryByText('Appearance: Saved')).toBeNull();
  expect(screen.getByText('light')).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Light' }));
  await screen.findByText('Appearance: Saved');
  expect(screen.queryByText(/Could not save appearance on this device/)).toBeNull();
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Appearance: Saved');
});

test('an earlier appearance write cannot report success while a newer selection is pending', async () => {
  let first!: () => void;
  let second!: () => void;
  jest
    .mocked(writeTheme)
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          first = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          second = resolve;
        }),
    );
  render(
    <ThemeProvider>
      <Preview />
    </ThemeProvider>,
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Light' }));
  await screen.findByText('Appearance: Saving…');
  await fireEventAsync.press(screen.getByRole('button', { name: 'System' }));
  first();
  await waitFor(() => expect(writeTheme).toHaveBeenLastCalledWith('system'));
  expect(screen.getByText('Appearance: Saving…')).toBeTruthy();
  expect(screen.queryByText('Appearance: Saved')).toBeNull();
  second();
  await screen.findByText('Appearance: Saved');
});
