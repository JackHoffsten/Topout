import React, { useState } from 'react';
import { jest, test, expect, beforeEach } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocationField } from '../ui/components/LocationField';

const mockLocations = jest.fn<(...args: any[]) => Promise<string[]>>();
jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: { listLogLocations: mockLocations } }),
}));
beforeEach(() => {
  mockLocations.mockReset();
});
function Form({ activity }: { activity: 'workout' | 'climb' }) {
  const [location, setLocation] = useState('');
  return <LocationField activity={activity} value={location} onChange={setLocation} />;
}
async function mount(activity: 'workout' | 'climb') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await renderAsync(
    <QueryClientProvider client={client}>
      <Form activity={activity} />
    </QueryClientProvider>,
  );
}
test.each(['workout', 'climb'] as const)(
  '%s location suggests matches and allows choosing or entering a new place',
  async (activity) => {
    mockLocations.mockResolvedValue(['Central Gym', 'East Gym']);
    await mount(activity);
    await fireEventAsync.changeText(screen.getByLabelText('Location (optional)'), 'cent');
    await waitFor(() => expect(mockLocations).toHaveBeenCalledWith(activity, 'cent'));
    const choice = await screen.findByRole('button', { name: 'Use location Central Gym' });
    expect(screen.queryByRole('button', { name: 'Use location East Gym' })).toBeNull();
    await fireEventAsync.press(choice);
    expect(screen.getByLabelText('Location (optional)').props.value).toBe('Central Gym');
    expect(screen.queryByRole('button', { name: 'Use location Central Gym' })).toBeNull();
    await fireEventAsync.changeText(screen.getByLabelText('Location (optional)'), 'New gym');
    expect(screen.getByLabelText('Location (optional)').props.value).toBe('New gym');
  },
);
test('suggestion failure never prevents free-text entry', async () => {
  mockLocations.mockRejectedValue(new Error('Offline'));
  await mount('climb');
  await fireEventAsync.changeText(screen.getByLabelText('Location (optional)'), 'New place');
  await screen.findByText(
    'Location suggestions could not be loaded. You can still enter a location.',
  );
  expect(screen.getByLabelText('Location (optional)').props.value).toBe('New place');
});

test.each(['workout', 'climb'] as const)(
  '%s selection is saved before input blur interrupts the press',
  async (activity) => {
    mockLocations.mockResolvedValue(['Central Gym']);
    await mount(activity);
    const input = screen.getByLabelText('Location (optional)');
    await fireEventAsync.changeText(input, 'cent');
    const choice = await screen.findByRole('button', { name: 'Use location Central Gym' });
    await fireEventAsync(choice, 'pressIn', { nativeEvent: {} });
    await fireEventAsync(input, 'blur', { nativeEvent: {} });
    expect(screen.getByLabelText('Location (optional)').props.value).toBe('Central Gym');
    expect(screen.queryByRole('button', { name: 'Use location Central Gym' })).toBeNull();
  },
);

test.each(['workout', 'climb'] as const)(
  '%s suggestions disappear on blur and return on focus',
  async (activity) => {
    mockLocations.mockResolvedValue(['Central Gym']);
    await mount(activity);
    const input = screen.getByLabelText('Location (optional)');
    await fireEventAsync.changeText(input, 'cent');
    await screen.findByRole('button', { name: 'Use location Central Gym' });
    await fireEventAsync(input, 'blur', { nativeEvent: {} });
    expect(screen.queryByRole('button', { name: 'Use location Central Gym' })).toBeNull();
    expect(input.props.value).toBe('cent');
    await fireEventAsync(input, 'focus', { nativeEvent: {} });
    await screen.findByRole('button', { name: 'Use location Central Gym' });
  },
);
