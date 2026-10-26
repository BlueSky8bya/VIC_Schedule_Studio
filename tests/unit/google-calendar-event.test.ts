import {expect,it} from 'vitest';
import type {PublicScheduleEvent} from '@/lib/domain/schedule-types';
import {googleCalendarEventHref} from '@/lib/ui/google-calendar-event';

const event=(extra:Partial<PublicScheduleEvent>={}):PublicScheduleEvent=>({id:'fixture-calendar',startsAt:'2026-10-01T00:00:00+09:00',isAllDay:true,publicTitle:'종겜 & 한글 / 테스트',status:'scheduled',visibilityScope:'public',category:'stream',tagIds:[],primaryTagIds:[],sortOrder:0,...extra});
it('uses Google’s official prefilled link, encoded public fields and KST only',()=>{
  const url=new URL(googleCalendarEventHref(event({publicDescription:'공개 설명\n다음 줄 & ?'}))!);
  expect(url.origin+url.pathname).toBe('https://calendar.google.com/calendar/r/eventedit');
  expect(url.searchParams.get('action')).toBe('TEMPLATE');expect(url.searchParams.get('text')).toBe('종겜 & 한글 / 테스트');expect(url.searchParams.get('details')).toBe('공개 설명\n다음 줄 & ?');
  expect(url.searchParams.get('dates')).toBe('20261001/20261002');expect(url.searchParams.get('stz')).toBe('Asia/Seoul');expect(url.searchParams.get('etz')).toBe('Asia/Seoul');
  expect([...url.searchParams.keys()].sort()).toEqual(['action','dates','details','etz','stz','text']);
});
it.each([['2026-12-31','2027-01-02','20261231/20270103'],['2028-02-28','2028-02-29','20280228/20280301']])('keeps inclusive calendar ranges at year/leap boundaries %s',(start,end,dates)=>{
  expect(new URL(googleCalendarEventHref(event({startsAt:start+'T00:00:00+09:00',endDateKey:end}))!).searchParams.get('dates')).toBe(dates);
});
it('preserves explicit timed instants across KST midnight',()=>{
  expect(new URL(googleCalendarEventHref(event({isAllDay:false,startsAt:'2026-10-01T23:30:00+09:00',endsAt:'2026-10-02T01:00:00+09:00'}))!).searchParams.get('dates')).toBe('20261001T143000Z/20261001T160000Z');
});
it('does not invent an end time when the schedule has no duration',()=>{
  expect(new URL(googleCalendarEventHref(event({isAllDay:false,startsAt:'2026-10-01T20:00:00+09:00'}))!).searchParams.get('dates')).toBe('20261001/20261002');
});
it.each([{teaser:true},{isSupport:true},{publicTitle:'   '},{visibilityScope:'owner_private' as 'public'},{status:'draft' as 'scheduled'},{startsAt:'2026-02-30T00:00:00+09:00'},{endDateKey:'2026-09-30'},{isAllDay:false,endsAt:'2026-10-01T00:00:00+09:00'},{isAllDay:false,endsAt:'2026-10-01T02:00:00'}])('fails closed for hidden/unsupported/invalid values %j',extra=>expect(googleCalendarEventHref(event(extra))).toBeNull());
it('never serializes unexpected private metadata, owner identity or IDs',()=>{
  const input=Object.assign(event(),{privateMeta:{privateTitle:'PRIVATE-CANARY',privateMemo:'SECRET-CANARY'},email:'OWNER-CANARY'});
  expect(googleCalendarEventHref(input)).not.toMatch(/PRIVATE|SECRET|OWNER|fixture-calendar|privateMeta|email/);
});
it('fails closed if the exclusive all-day end exceeds four-digit years',()=>expect(googleCalendarEventHref(event({startsAt:'9999-12-31T00:00:00+09:00'}))).toBeNull());
it('rejects impossible timed end dates instead of Date.parse normalization',()=>expect(googleCalendarEventHref(event({isAllDay:false,startsAt:'2026-02-28T20:00:00+09:00',endsAt:'2026-02-30T22:00:00+09:00'}))).toBeNull());

it('keeps the first title line and moves the public outline above the description',()=>{
  const url=new URL(googleCalendarEventHref(event({publicTitle:'합성 새 출발 방송!\n새 아바타·의상 공개\n  표정 소개\n함께 이야기해요',publicDescription:'방송 안내\n스포일러 없이 즐겨 주세요.'}))!);
  expect(url.searchParams.get('text')).toBe('합성 새 출발 방송!');
  expect(url.searchParams.get('details')).toBe('• 새 아바타·의상 공개\n  • 표정 소개\n• 함께 이야기해요\n\n방송 안내\n스포일러 없이 즐겨 주세요.');
});
it('formats CRLF and existing list markers without duplicating bullets',()=>{
  const url=new URL(googleCalendarEventHref(event({publicTitle:'  첫 방송  \r\n- 새 의상\r\n  • 새 표정\r\n\r\n2. 짧은 Q&A',publicDescription:'  공개 본문  '}))!);
  expect(url.searchParams.get('text')).toBe('첫 방송');
  expect(url.searchParams.get('details')).toBe('- 새 의상\n  • 새 표정\n2. 짧은 Q&A\n\n공개 본문');
});
it('does not guess a subtitle from punctuation or truncate a long single-line title',()=>{
  const title='새 기능 - 소개 / A & B: 긴 제목 '+ '가'.repeat(120);
  const url=new URL(googleCalendarEventHref(event({publicTitle:title,publicDescription:'   '}))!);
  expect(url.searchParams.get('text')).toBe(title);
  expect(url.searchParams.has('details')).toBe(false);
});
it('uses the first meaningful line after leading blank lines and retains all subtopics',()=>{
  const url=new URL(googleCalendarEventHref(event({publicTitle:'\r\n\r\n주제\r\n하위 내용\r마지막 내용'}))!);
  expect(url.searchParams.get('text')).toBe('주제');
  expect(url.searchParams.get('details')).toBe('• 하위 내용\n• 마지막 내용');
});
