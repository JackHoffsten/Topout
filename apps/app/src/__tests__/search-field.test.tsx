import React from 'react';
import { jest, test, expect, afterEach } from '@jest/globals';
import { fireEventAsync, renderAsync, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { SearchField } from '../ui/components/SearchField';

let mockDesktop = false;
jest.mock('../ui/theme', () => ({
  ...jest.requireActual<typeof import('../ui/theme')>('../ui/theme'),
  useDesktop: () => mockDesktop,
}));
afterEach(() => {
  jest.restoreAllMocks();
  mockDesktop = false;
});

test('mobile search forwards focus and query changes and cleans up keyboard handling', async () => {
  const remove = jest.fn();
  const subscription = Keyboard.addListener('keyboardDidShow', () => {});
  subscription.remove();
  subscription.remove = remove;
  const listen = jest.spyOn(Keyboard, 'addListener').mockReturnValue(subscription);
  const focus = jest.fn();
  const blur = jest.fn();
  const change = jest.fn();
  await renderAsync(
    <SearchField
      label="Search exercises"
      scrollRef={{ current: null }}
      onFocus={focus}
      onBlur={blur}
      onChangeText={change}
    />,
  );
  const input = screen.getByLabelText('Search exercises');
  await fireEventAsync(input, 'focus', { nativeEvent: {} });
  expect(focus).toHaveBeenCalledTimes(1);
  expect(listen).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
  await fireEventAsync.changeText(input, 'squat');
  expect(change).toHaveBeenCalledWith('squat');
  await fireEventAsync(input, 'blur', { nativeEvent: {} });
  expect(blur).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalled();
});

test('desktop search does not attach mobile keyboard scrolling', async () => {
  mockDesktop = true;
  const listen = jest.spyOn(Keyboard, 'addListener');
  await renderAsync(<SearchField label="Search templates" scrollRef={{ current: null }} />);
  await fireEventAsync(screen.getByLabelText('Search templates'), 'focus', { nativeEvent: {} });
  expect(listen).not.toHaveBeenCalled();
});
