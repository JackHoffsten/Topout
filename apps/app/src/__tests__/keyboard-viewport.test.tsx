import React from 'react';
import { Text } from 'react-native';
import { test, expect } from '@jest/globals';
import { renderAsync, screen, act } from '@testing-library/react-native';
import { KeyboardViewport } from '../ui/KeyboardViewport.web';

test('follows keyboard viewport height and panning, restores on dismissal, and ignores pinch zoom', async () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const browserProperties = ['addEventListener', 'removeEventListener', 'innerHeight'] as const;
  const originals = browserProperties.map((name) => Object.getOwnPropertyDescriptor(window, name));
  Object.defineProperties(window, {
    addEventListener: { configurable: true, value: () => {} },
    removeEventListener: { configurable: true, value: () => {} },
    innerHeight: { configurable: true, value: 844 },
  });
  const listeners = new Map<string, () => void>();
  const viewport = {
    height: 844,
    offsetTop: 0,
    scale: 1,
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  try {
    const { unmountAsync } = await renderAsync(
      <KeyboardViewport>
        <Text>Form</Text>
      </KeyboardViewport>,
    );
    const shell = () => screen.UNSAFE_getByType('div' as any).props.style;
    expect(shell()).toMatchObject({ position: 'fixed', top: 0, height: 844 });
    await act(async () => {
      viewport.height = 360;
      viewport.offsetTop = 170;
      listeners.get('resize')!();
    });
    expect(shell()).toMatchObject({ top: 170, height: 360 });
    await act(async () => {
      viewport.offsetTop = 210;
      listeners.get('scroll')!();
    });
    expect(shell().top).toBe(210);
    await act(async () => {
      viewport.height = 844;
      viewport.offsetTop = 0;
      listeners.get('resize')!();
    });
    expect(shell()).toMatchObject({ top: 0, height: 844 });
    await act(async () => {
      viewport.scale = 2;
      viewport.height = 422;
      viewport.offsetTop = 120;
      listeners.get('resize')!();
    });
    expect(shell()).toMatchObject({ top: 0, height: window.innerHeight });
    await unmountAsync();
    expect(listeners.size).toBe(0);
  } finally {
    browserProperties.forEach((name, index) => {
      const descriptor = originals[index];
      if (descriptor) Object.defineProperty(window, name, descriptor);
      else Reflect.deleteProperty(window, name);
    });
    if (original) Object.defineProperty(window, 'visualViewport', original);
    else Reflect.deleteProperty(window, 'visualViewport');
  }
});
