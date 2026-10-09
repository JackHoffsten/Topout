import { displayDate } from '../lib/dates';
import { test, expect } from '@jest/globals';

test.each([
  ['2026-10-07', 'Today'],
  ['2026-10-06', 'Yesterday'],
  ['2026-10-08', 'Tomorrow'],
  ['2026-10-05', '2026-10-05'],
])('labels %s as %s', (date, expected) => {
  expect(displayDate(date, undefined, new Date(2026, 9, 7, 23, 59))).toBe(expected);
});

test('handles month, year and daylight-saving boundaries as local calendar days', () => {
  expect(displayDate('2025-12-31', undefined, new Date(2026, 0, 1))).toBe('Yesterday');
  expect(displayDate('2026-01-01', undefined, new Date(2025, 11, 31))).toBe('Tomorrow');
  expect(displayDate('2026-03-28', undefined, new Date(2026, 2, 29, 23))).toBe('Yesterday');
  expect(displayDate(new Date(2026, 9, 25), undefined, new Date(2026, 9, 24))).toBe('Tomorrow');
});
