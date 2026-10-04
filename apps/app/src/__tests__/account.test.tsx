import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import {
  renderAsync as render,
  screen,
  fireEventAsync as fireEvent,
} from '@testing-library/react-native';
import Account from '../../app/(app)/account';
import { PublicInfo } from '../features/legal/PublicInfo';
import { ApiError } from '@topout/shared';

const mockDelete = jest.fn<(password: string) => Promise<void>>();
jest.mock('../lib/providers', () => ({
  useSession: () => ({ logout: jest.fn(), deleteAccount: mockDelete }),
}));
jest.mock('expo-router', () => ({ Link: ({ children }: any) => <>{children}</> }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
});

test('account deletion requires a password and explicit confirmation; cancellation never deletes', async () => {
  await render(<Account />);
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Current password'), 'StrongPassword123!');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  expect(mockDelete).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(mockDelete).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Current password').props.value).toBe('');
  await fireEvent.changeText(screen.getByLabelText('Current password'), 'StrongPassword123!');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));
  expect(mockDelete).toHaveBeenCalledWith('StrongPassword123!');
});

test('a rejected deletion shows the error and allows another attempt', async () => {
  mockDelete.mockRejectedValueOnce(new ApiError(400, 'Your password could not be verified.'));
  await render(<Account />);
  await fireEvent.changeText(screen.getByLabelText('Current password'), 'wrong');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));
  expect(await screen.findByText('Your password could not be verified.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Permanently delete account' })).not.toBeDisabled();
});

test('public privacy and support pages can render without a session', async () => {
  const result = await render(<PublicInfo privacy />);
  expect(screen.getByRole('header', { name: 'Privacy policy' })).toBeTruthy();
  expect(screen.getByText(/configured retention period of 14\s+days/)).toBeTruthy();
  expect(screen.queryByText(/no configured database backup job/)).toBeNull();
  expect(screen.getByText(/jack.hoffsten@hotmail.se/)).toBeTruthy();
  await result.rerenderAsync(<PublicInfo />);
  expect(screen.getByRole('button', { name: 'Email support' })).toBeTruthy();
});
