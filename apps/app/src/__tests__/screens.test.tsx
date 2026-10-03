import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import {
  renderAsync as render,
  screen,
  fireEventAsync as fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { AuthScreen } from '../features/auth/AuthScreen';
import { Shell } from '../ui/Shell';
import { Text } from 'react-native';

const mockLogin = jest.fn<(...args: any[]) => Promise<void>>();
const mockRegister = jest.fn();
let mockDesktop = false;

jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: { login: mockLogin, register: mockRegister }, status: 'anonymous' }),
}));

jest.mock('../lib/session', () => ({ broadcastLogout: jest.fn() }));

jest.mock('../ui/theme', () => {
  const actual = jest.requireActual<Record<string, unknown>>('../ui/theme');
  return { ...actual, useDesktop: () => mockDesktop };
});

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  usePathname: () => '/exercises',
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDesktop = false;
});

test('registration validates input before calling the server', async () => {
  await render(<AuthScreen register />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await screen.findByText('Enter your name.');
  expect(mockRegister).not.toHaveBeenCalled();
});

test('login submits valid credentials and shows server failure', async () => {
  mockLogin.mockRejectedValue(new Error('offline'));
  await render(<AuthScreen />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'a@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Password1');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith({ email: 'a@example.com', password: 'Password1' }),
  );
  await screen.findByText('Could not connect. Check your connection and try again.');
});

test('navigation adapts from phone tabs to desktop sidebar', async () => {
  const rendered = await render(
    <Shell>
      <Text>Content</Text>
    </Shell>,
  );
  expect(screen.getByTestId('phone-navigation')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Progress' })).toBeTruthy();
  mockDesktop = true;
  await rendered.rerenderAsync(
    <Shell>
      <Text>Content</Text>
    </Shell>,
  );
  expect(screen.getByTestId('desktop-navigation')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Progress' })).toBeTruthy();
});
