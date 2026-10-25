import { describe, expect, it } from 'vitest';
import { publicEventForMonth, publicEventHref, readPublicEventId } from '@/lib/ui/public-event-link';
import { publicMonthHref } from '@/lib/ui/public-month-link';
import { samplePublicScheduleData } from '@/lib/schedules/sample-public-data';
import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';
import { describeTarget } from '@/lib/activity/labels';

const view = { year: 2026, month: 6 }, event = samplePublicScheduleData.events[0];
describe('one published public event link', () => {
  it('shares only canonical origin/month/id, never preview path or arbitrary query', () => {
    expect(publicEventHref('https://example.com/studio?code=secret#private', view, event.id)).toBe('https://example.com/?month=2026-06&event=evt-001');
  });
  it.each(['?event=a&event=b', '?event=', '?event=%3Cscript%3E', '?event=a%0A', '?event=' + 'a'.repeat(129)])('rejects ambiguous or malformed ids: %s', query => {
    expect(readPublicEventId(new URL(query, 'https://example.com'))).toBeNull();
  });
  it('resolves only the published public DTO and selected month', () => {
    expect(publicEventForMonth([event], event.id, view)?.dateKey).toBe('2026-06-01');
    expect(publicEventForMonth([event], 'deleted-canary', view)).toBeNull();
    expect(publicEventForMonth([event], event.id, { year: 2026, month: 7 })).toBeNull();
  });
  it.each([{visibilityScope:'owner_private'}, {visibilityScope:'work'}, {status:'draft'}, {teaser:true}, {isSupport:true}, {publicTitle:' '}])('rejects unauthorized/unpublished canaries even if incorrectly supplied: %j', change => {
    expect(publicEventForMonth([{...event, ...change} as unknown as PublicScheduleEvent], event.id, view)).toBeNull();
  });
  it('uses an intersecting day for a month-spanning public event', () => {
    const span = {...event, startsAt:'2026-05-31T23:59:00+09:00', endDateKey:'2026-06-03'};
    expect(publicEventForMonth([span], event.id, view)?.dateKey).toBe('2026-06-01');
    expect(publicEventForMonth([span], event.id, {year:2026,month:7})).toBeNull();
  });
  it('drops a stale event when changing month but retains it for same-month restore', () => {
    const url = new URL('https://example.com/?month=2026-06&event=evt-001&keep=1');
    expect(publicMonthHref(url, view)).toContain('event=evt-001');
    expect(publicMonthHref(url, {year:2026,month:7})).toBe('/?month=2026-07&keep=1');
  });
  it('uses a fixed readable activity label shared by timeline and usage catalogue', () => {
    expect(describeTarget('ui.click','share-public-event')).toMatchObject({name:'일정 링크 복사',area:'일정'});
  });
});
