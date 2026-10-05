import React from 'react';
import { jest, test, expect, afterEach } from '@jest/globals';
import { fireEventAsync, renderAsync, screen } from '@testing-library/react-native';
import { Keyboard, type ScrollView, type View } from 'react-native';
import { SearchField, revealSearchField } from '../ui/components/SearchField';
import { SearchFocus, searchKeyboardOffset } from '../ui/searchFocus';

let mockDesktop = false;
jest.mock('../ui/theme', () => ({
  ...jest.requireActual<typeof import('../ui/theme')>('../ui/theme'),
  useDesktop: () => mockDesktop,
}));
afterEach(() => {
  jest.restoreAllMocks();
  mockDesktop = false;
});

test('mobile search forwards events without delayed keyboard scrolling or per-keystroke frames', async () => {
  const listen = jest.spyOn(Keyboard, 'addListener');
  const frames = jest.spyOn(globalThis, 'requestAnimationFrame');
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
  expect(listen).not.toHaveBeenCalled();
  frames.mockClear();
  await fireEventAsync.changeText(input, 'squat');
  expect(change).toHaveBeenCalledWith('squat');
  await fireEventAsync(input, 'blur', { nativeEvent: {} });
  expect(blur).toHaveBeenCalledTimes(1);
  expect(frames).not.toHaveBeenCalled();
});

test('desktop search does not attach mobile keyboard scrolling', async () => {
  mockDesktop = true;
  const listen = jest.spyOn(Keyboard, 'addListener');
  await renderAsync(<SearchField label="Search templates" scrollRef={{ current: null }} />);
  await fireEventAsync(screen.getByLabelText('Search templates'), 'focus', { nativeEvent: {} });
  expect(listen).not.toHaveBeenCalled();
});

test('native search measures against the Fabric component ref and scrolls to its top', () => {
  const content = {};
  const getInnerViewNode = jest.fn(() => 123);
  const getInnerViewRef = jest.fn(() => content);
  const scrollTo = jest.fn();
  const measureLayout = jest.fn((relative: unknown, success: (x: number, y: number) => void) => {
    expect(relative).toBe(content);
    success(0, 280);
  });
  revealSearchField(
    { getInnerViewNode, getInnerViewRef, scrollTo } as unknown as ScrollView,
    { measureLayout } as unknown as View,
  );
  expect(getInnerViewNode).not.toHaveBeenCalled();
  expect(getInnerViewRef).toHaveBeenCalled();
  expect(scrollTo).toHaveBeenCalledWith({ y: 280, animated: false });
});

test('native search delegates alignment to the keyboard-aware page without manual scrolling', async () => {
  const focus = jest.fn();
  const scrollTo = jest.fn();
  await renderAsync(
    <SearchFocus.Provider value={focus}>
      <SearchField
        label="Search exercises"
        scrollRef={{ current: { scrollTo } as unknown as ScrollView }}
      />
    </SearchFocus.Provider>,
  );
  await fireEventAsync(screen.getByLabelText('Search exercises'), 'focus', { nativeEvent: {} });
  expect(focus).toHaveBeenCalledWith(70);
  expect(scrollTo).not.toHaveBeenCalled();
  await fireEventAsync(screen.getByLabelText('Search exercises'), 'blur', { nativeEvent: {} });
  expect(focus).toHaveBeenLastCalledWith(null);
});

test('search offset leaves the field at the page top above keyboards of different sizes', () => {
  expect(searchKeyboardOffset(844, 336, 120, 70)).toBe(318);
  expect(searchKeyboardOffset(844, 400, 120, 70)).toBe(254);
});
