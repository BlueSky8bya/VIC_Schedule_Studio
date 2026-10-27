/** KST wall-clock parts only; these helpers never shift a date/timezone. */
export function parseTimePart(draft: string, max: number): number | null {
  return /^\d{1,2}$/.test(draft) && Number(draft) <= max ? Number(draft) : null;
}
export function timePartComplete(draft: string, max: number): boolean {
  return /^\d{2}$/.test(draft) && parseTimePart(draft, max) !== null;
}
