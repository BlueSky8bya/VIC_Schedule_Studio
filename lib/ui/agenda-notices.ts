import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";
import { getEventDateKey, getAdjacentMonth, hasSupportDateRange } from "@/lib/calendar/month";

/** Explicit presentation fields only. Never pass a studio event into public UI. */
export type AgendaNotice = {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: "period" | "up";
  url?: string;
};
export type AgendaNoticeGroup = { start: string; end: string; notices: AgendaNotice[] };

export function createAgendaNotices(events: readonly Pick<PublicScheduleEvent, "id" | "startsAt" | "endDateKey" | "isSupport" | "publicTitle" | "teaser" | "supportKind" | "supportUrl">[], year: number, month: number): AgendaNotice[] {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = getAdjacentMonth(year, month, 1);
  const nextStart = `${next.year}-${String(next.month).padStart(2, "0")}-01`;
  return events.flatMap(event => {
    if (!event.isSupport || !event.publicTitle || event.teaser) return [];
    const eventStart = getEventDateKey(event), end = event.endDateKey ?? eventStart;
    if (eventStart >= nextStart || end < start) return [];
    let url: string | undefined;
    try { const parsed = new URL(event.supportUrl ?? ""); if (["https:", "http:"].includes(parsed.protocol)) url = parsed.href; } catch { /* An optional invalid link stays absent. */ }
    return [{ id: event.id, title: event.publicTitle, start: eventStart, end, kind: event.supportKind === "period" ? "period" as const : "up" as const, url }];
  }).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id));
}

/** Separate unrelated parts of the month so an old notice does not fill the dock forever. */
export function groupAgendaNotices(notices: readonly AgendaNotice[]): AgendaNoticeGroup[] {
  const groups: AgendaNoticeGroup[] = [];
  for (const notice of [...notices].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))) {
    const last = groups[groups.length - 1];
    if (last && notice.start <= last.end) { last.notices.push(notice); if (notice.end > last.end) last.end = notice.end; }
    else groups.push({ start: notice.start, end: notice.end, notices: [notice] });
  }
  return groups;
}

export function agendaNoticeGroupAt(groups: readonly AgendaNoticeGroup[], date: string): AgendaNoticeGroup | undefined {
  return groups.find(group => group.start <= date && group.end >= date)
    ?? [...groups].reverse().find(group => group.start <= date) ?? groups[0];
}
export function noticeIsActive(notice: AgendaNotice, date: string): boolean { return notice.start <= date && date <= notice.end; }

/** A collapsed empty-date row is explicitly a range, so include each intersecting notice. */
export function agendaNoticesInRange(notices: readonly AgendaNotice[], date: string, endDate = date): AgendaNotice[] {
  return notices.filter(notice => notice.start <= endDate && date <= notice.end);
}

/** Actual simultaneous stacks, not the union of a transitively connected month-long chain.
 * A maximum can only grow at a notice start. Collapsed date ranges add their own union. */
export function agendaNoticeStacks(notices: readonly AgendaNotice[], ranges: readonly { date: string; endDate?: string }[] = []): AgendaNotice[][] {
  const seen = new Set<string>();
  const contexts: { date: string; endDate?: string }[] = [...new Set(notices.map(notice => notice.start))].map(date => ({ date }));
  return [...contexts, ...ranges].flatMap(range => {
      const active = agendaNoticesInRange(notices, range.date, range.endDate);
      const key = active.map(notice => notice.id).join("|");
      if (!active.length || seen.has(key)) return [];
      seen.add(key); return [active];
    });
}
export function noticeRangeText(notice: AgendaNotice): string {
  const short = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
  return hasSupportDateRange(notice.start, notice.end) ? `${short(notice.start)}–${short(notice.end)}` : "";
}
