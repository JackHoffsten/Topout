import { createContext } from 'react';

export const SearchFocus = createContext<(height: number | null) => void>(() => {});

export function searchKeyboardOffset(
  windowHeight: number,
  keyboardHeight: number,
  pageTop: number,
  fieldHeight: number,
) {
  return Math.max(12, windowHeight - keyboardHeight - pageTop - fieldHeight);
}
