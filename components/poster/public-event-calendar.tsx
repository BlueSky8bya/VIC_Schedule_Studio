import { CalendarPlus } from 'lucide-react';
import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';
import { googleCalendarEventHref } from '@/lib/ui/google-calendar-event';
import './public-event-calendar.css';

export function PublicEventCalendar({ event }: { event: PublicScheduleEvent }) {
  const href = googleCalendarEventHref(event);
  if (!href) return null;
  return <div className="public-event-calendar"><a className="button" data-act="add-google-calendar" href={href} rel="noopener noreferrer" target="_blank"><CalendarPlus aria-hidden="true" size={16} />Google 캘린더에 추가</a></div>;
}
