export type AgendaReadingDate = { date: string; endDate?: string };
export type AgendaReadingRow = AgendaReadingDate & { top: number; bottom: number };

/** A fixed reading line gives short days the same opportunity as tall days.
 * This is a screen position, never an estimate of eye gaze. */
export function agendaReadingAnchor(top: number, bottom: number): number {
  return top + Math.min(64, (bottom - top) / 2);
}

export function anchoredAgendaDate(rows: readonly AgendaReadingRow[], top: number, bottom: number): AgendaReadingDate | undefined {
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
  const anchor = agendaReadingAnchor(top, bottom);
  let nearest = Infinity, selected: AgendaReadingRow | undefined;
  for (const row of rows) {
    const visible = Math.max(0, Math.min(bottom, row.bottom) - Math.max(top, row.top));
    if (!visible) continue;
    const distance = Math.max(row.top - anchor, anchor - row.bottom, 0);
    if (distance < nearest) { nearest = distance; selected = row; }
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
