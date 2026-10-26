export type AgendaReadingDate = { date: string; endDate?: string };
export type AgendaReadingRow = AgendaReadingDate & { top: number; bottom: number };

/** A transparent screen heuristic, never an estimate of eye gaze. Ties prefer the upper row. */
export function mostVisibleAgendaDate(rows: readonly AgendaReadingRow[], top: number, bottom: number): AgendaReadingDate | undefined {
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
  let largest = 0, selected: AgendaReadingRow | undefined;
  for (const row of rows) {
    const visible = Math.max(0, Math.min(bottom, row.bottom) - Math.max(top, row.top));
    if (visible > largest) { largest = visible; selected = row; }
  }
  return selected ? { date: selected.date, ...(selected.endDate && selected.endDate !== selected.date ? { endDate: selected.endDate } : {}) } : undefined;
}

export function sameAgendaReadingDate(a: AgendaReadingDate, b: AgendaReadingDate): boolean {
  return a.date === b.date && a.endDate === b.endDate;
}

export function agendaReadingLabel(reading: AgendaReadingDate): string {
  const day = Number(reading.date.slice(8, 10));
  return reading.endDate ? `${day}–${Number(reading.endDate.slice(8, 10))}일` : `${day}일`;
}
