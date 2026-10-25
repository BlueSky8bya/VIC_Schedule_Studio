import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';
import { getEventDateKey } from '@/lib/calendar/month';
import { publicMonthHref, readPublicMonth, type PublicMonth } from './public-month-link';

export function readPublicEventId(url: URL): string | null {
  const values = url.searchParams.getAll('event');
  return values.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(values[0]) ? values[0] : null;
}

export function publicEventForMonth(events: PublicScheduleEvent[], id: string, view: PublicMonth) {
  const first = `${view.year}-${String(view.month).padStart(2, '0')}-01`;
  const month = first.slice(0, 7);
  const event = events.find(item => item.id === id && item.visibilityScope === 'public' && String(item.status) !== 'draft' && !item.isSupport && !item.teaser && Boolean(item.publicTitle.trim()));
  if (!event) return null;
  const start = getEventDateKey(event), end = event.endDateKey ?? start;
  if (start.slice(0, 7) > month || end.slice(0, 7) < month) return null;
  return { event, dateKey: start < first ? first : start };
}

/** Canonical public entry: no preview path, arbitrary query, fragment or title. */
export function publicEventHref(origin: string, view: PublicMonth, id: string): string | null {
  const url = new URL('/', origin), monthHref = publicMonthHref(url, view);
  if (!monthHref) return null;
  const result = new URL(monthHref, origin);
  result.searchParams.set('event', id);
  return readPublicEventId(result) && readPublicMonth(result) ? result.href : null;
}
