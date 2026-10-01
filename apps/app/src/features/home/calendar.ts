// Calendar dates are local dates, never UTC instants.
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count =
    Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from(
    { length: count },
    (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index),
  );
}
