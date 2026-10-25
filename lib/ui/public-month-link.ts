export type PublicMonth = { year: number; month: number };
export const PUBLIC_MONTH_BOUNDS = { min: 1000, max: 9999 };

// Four-digit years avoid Date's special handling of0..99 and unbounded input.
export function isPublicMonth(value: unknown): value is PublicMonth {
  if (!value || typeof value !== "object") return false;
  const { year, month } = value as Partial<PublicMonth>;
  return Number.isInteger(year) && year! >= PUBLIC_MONTH_BOUNDS.min && year! <= PUBLIC_MONTH_BOUNDS.max &&
    Number.isInteger(month) && month! >= 1 && month! <= 12;
}

export function parsePublicMonth(value: unknown): PublicMonth | null {
  if (typeof value !== "string" || !/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(value)) return null;
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5)) };
}

export function readPublicMonth(url: URL): PublicMonth | null {
  const values = url.searchParams.getAll("month");
  return values.length === 1 ? parsePublicMonth(values[0]) : null;
}

export function publicMonthHref(url: URL, view: PublicMonth): string | null {
  if (!isPublicMonth(view)) return null;
  const next = new URL(url);
  const previous = readPublicMonth(next);
  if (!previous || previous.year !== view.year || previous.month !== view.month) next.searchParams.delete("event");
  next.searchParams.set("month", `${view.year}-${String(view.month).padStart(2, "0")}`);
  return next.pathname + next.search + next.hash;
}
