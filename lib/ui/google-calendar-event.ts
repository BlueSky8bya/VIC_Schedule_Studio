import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';
import { PRODUCT_TIMEZONE } from '@/lib/domain/schedule-types';
import { addDays, getEventDateKey, splitEventTitleOutline } from '@/lib/calendar/month';

const validDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
const compactInstant = (value: number) => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');

/** Google owns account/sign-in and final Save. Only the already public DTO enters this URL. */
export function googleCalendarEventHref(event: PublicScheduleEvent): string | null {
  if (event.visibilityScope !== 'public' || String(event.status) === 'draft' || event.teaser || event.isSupport || !event.publicTitle.trim()) return null;
  const start = getEventDateKey(event), last = event.endDateKey ?? start;
  if (!validDateKey(start) || !validDateKey(last) || last < start) return null;
  let dates: string;
  // Missing duration must not invent a finish time. Calendar dates are inclusive in VIC,
  // whereas an all-day Google event ends at the following exclusive calendar date.
  if (event.isAllDay || !event.endsAt) {
    const exclusiveEnd = addDays(last,1);
    if (!validDateKey(exclusiveEnd)) return null;
    dates = start.replaceAll('-','') + '/' + exclusiveEnd.replaceAll('-','');
  }
  else {
    if (![event.startsAt,event.endsAt].every(value => /(?:Z|[+-]\d{2}:\d{2})$/.test(value))) return null;
    if (!validDateKey(event.endsAt.slice(0,10))) return null;
    const from = Date.parse(event.startsAt), to = Date.parse(event.endsAt);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
    dates = compactInstant(from) + '/' + compactInstant(to);
  }
  const url = new URL('https://calendar.google.com/calendar/r/eventedit');
  url.searchParams.set('action','TEMPLATE');
  // Match the calendar's first-line title and subtopic outline. Google flattens
  // newlines in its title input, so put every remaining line in the description.
  const { main, subs } = splitEventTitleOutline(event.publicTitle.replace(/\r\n?/g,'\n').trim());
  const outline = subs.map(({text,depth}) => '  '.repeat(depth) + (/^(?:[-*•·]\s|\d+[.)]\s)/.test(text) ? text : '• ' + text)).join('\n');
  const details = [outline,event.publicDescription?.trim()].filter(Boolean).join('\n\n');
  url.searchParams.set('text',main.trim());
  url.searchParams.set('dates',dates);
  url.searchParams.set('stz',PRODUCT_TIMEZONE);
  url.searchParams.set('etz',PRODUCT_TIMEZONE);
  if (details) url.searchParams.set('details',details);
  return url.href;
}
