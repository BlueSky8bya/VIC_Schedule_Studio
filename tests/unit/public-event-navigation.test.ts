import { describe, expect, it } from 'vitest';
import { publicEventNavigation } from '@/lib/ui/public-event-navigation';
import { samplePublicScheduleData } from '@/lib/schedules/sample-public-data';
import type { PublicScheduleEvent } from '@/lib/domain/schedule-types';

const view = {year:2026,month:6}, seed = samplePublicScheduleData.events[0];
const event = (id:string, change:Partial<PublicScheduleEvent> = {}):PublicScheduleEvent => ({...seed,id,...change});
describe('same-month public detail navigation',()=>{
 it('uses loader-normalized KST dates, same-day manual order and stable ties without mutating the source',()=>{
  const items=[event('june2',{startsAt:'2026-06-02T00:00:00+09:00'}),event('manual2',{sortOrder:2}),event('manual1',{sortOrder:1}),event('tie',{sortOrder:1})];
  expect(publicEventNavigation(items,view,()=>true).map(x=>x.event.id)).toEqual(['manual1','tie','manual2','june2']);
  expect(items.map(x=>x.id)).toEqual(['june2','manual2','manual1','tie']);
 });
 it('deduplicates spanning events, clamps their first day to the viewed month and preserves gaps',()=>{
  const span=event('span',{startsAt:'2026-05-30T20:00:00+09:00',endDateKey:'2026-06-03'});
  expect(publicEventNavigation([span,span,event('later',{startsAt:'2026-06-25T20:00:00+09:00'})],view,()=>true).map(x=>[x.event.id,x.dateKey])).toEqual([['span','2026-06-01'],['later','2026-06-25']]);
 });
 it.each([{visibilityScope:'owner_private'},{visibilityScope:'work'},{status:'draft'},{teaser:true},{isSupport:true},{publicTitle:' '},{startsAt:'2026-07-01T20:00:00+09:00',endDateKey:undefined}])('fails closed for out-of-scope canaries %j',change=>{
  expect(publicEventNavigation([event('canary',change as Partial<PublicScheduleEvent>)],view,()=>true)).toEqual([]);
 });
 it('uses exactly the current filter instead of navigating dimmed items',()=>{
  const selected=event('selected'),other=event('other');
  expect(publicEventNavigation([selected,other],view,item=>item.id==='selected').map(x=>x.event.id)).toEqual(['selected']);
  expect(publicEventNavigation([selected,other],view,()=>false)).toEqual([]);
 });
});
