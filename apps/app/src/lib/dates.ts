function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Compare calendar days in the device's timezone, including across daylight-saving changes. */
export function displayDate(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
  now = new Date(),
): string {
  const date = typeof value === 'string' ? new Date(`${value}T12:00:00`) : value;
  const key = localKey(date);
  for (const [offset, label] of [
    [0, 'Today'],
    [-1, 'Yesterday'],
    [1, 'Tomorrow'],
  ] as const) {
    const relative = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    if (key === localKey(relative)) return label;
  }
  return options
    ? date.toLocaleDateString(undefined, options)
    : typeof value === 'string'
      ? value
      : key;
}
