import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';
import type { PublicMonth } from './public-month-link';
import { publicEventForMonth } from './public-event-link';

/** Same-month ordinary public events in day/manual order. */
export function publicEventNavigation(events: PublicScheduleEvent[], view: PublicMonth, matches: (event: PublicScheduleEvent) => boolean) {
  const seen = new Set<string>();
  return events.flatMap(event => {
    const found = publicEventForMonth([event], event.id, view);
    if (!found || seen.has(event.id) || !matches(event)) return [];
    seen.add(event.id);
    return [found];
  }).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.event.sortOrder - b.event.sortOrder);
}
