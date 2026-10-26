import {describe,expect,it} from 'vitest';
import {countSearchKinds,filterSearchKind} from '@/lib/search/result-kind';
import {groupSearchHits} from '@/lib/search/group';
import {adjacentRecordMonth,groupRecordDates,isRecordMonth,recordMonthEvents} from '@/lib/insights/public-record';
import {samplePublicScheduleData} from '@/lib/schedules/sample-public-data';
import type {BroadcastTag,PublicSearchHit,PublicScheduleEvent} from '@/lib/domain/schedule-types';

describe('returned search kinds',()=>{
 const hits:PublicSearchHit[]=[{kind:'event',eventId:'public-event',dateKey:'2026-06-16',title:'public schedule',snippet:'',score:1,popularity:0,exact:true},{kind:'vod',titleNo:123,dateKey:'2026-06-16',title:'public recording',snippet:'',durationMs:3600000,score:1,popularity:0,exact:true},{kind:'chapter',titleNo:123,sec:120,dateKey:'2026-06-16',title:'public chapter',snippet:'public recording',durationMs:3600000,score:1,popularity:0,exact:true}];
 it('counts original hits once and retains the VOD context for chapter-only results',()=>{
  expect(countSearchKinds(hits)).toEqual({all:3,event:1,vod:1,chapter:1});
  const chapters=filterSearchKind(hits,'chapter'),group=groupSearchHits(chapters)[0];
  expect(chapters).toHaveLength(1);expect(group.events).toHaveLength(0);expect(group.vods[0].title).toBe('public recording');expect(group.vods[0].chapters[0].sec).toBe(120);expect(group.vods[0].matched).toBe(false);
 });
 it('does not invent missing-kind hits, mutate source order, or claim complete retrieval beyond the returned set',()=>{
  const bounded=Array.from({length:200},(_,i)=>({...hits[0],eventId:`public-${i}`}));
  expect(countSearchKinds(bounded)).toEqual({all:200,event:200,vod:0,chapter:0});expect(filterSearchKind(bounded,'chapter')).toEqual([]);expect(filterSearchKind(hits,'all')).toEqual(hits);expect(hits.map(h=>h.kind)).toEqual(['event','vod','chapter']);
 });
 it('does not include chapter rows when only explicitly matched VOD hits are chosen',()=>{const groups=groupSearchHits(filterSearchKind(hits,'vod'));expect(groups[0].vods[0].allChapters).toEqual([]);expect(filterSearchKind(hits,'event').every(h=>h.kind==='event')).toBe(true);});
});
describe('public record month and exact count semantics',()=>{
 const tag=(id:string,name:string,parentId:string|null=null)=>({...samplePublicScheduleData.tags[0],id,displayName:name,parentId}) as BroadcastTag;
 const tags=[tag('content','종겜'),tag('rest','휴뱅'),tag('rest-child','정기휴방','rest')];
 const event=(id:string,date:string,extra:Partial<PublicScheduleEvent>={}):PublicScheduleEvent=>({...samplePublicScheduleData.events[0],id,startsAt:`${date}T20:00:00+09:00`,publicTitle:id,tagIds:['content'],primaryTagIds:['content'],isSupport:false,...extra});
 it('keeps event counts separate from unique dates and excludes support/rest with the original ancestry rule',()=>{
  const source=[event('a','2026-06-01'),event('b','2026-06-01'),event('c','2026-06-02'),event('rest-a','2026-06-03',{tagIds:['rest-child']}),event('rest-b','2026-06-03',{tagIds:['rest']}),event('support','2026-06-04',{isSupport:true}),event('other-month','2026-05-01')];
  const rows=recordMonthEvents(source,tags,{year:2026,month:6});expect(rows.content.map(e=>e.id)).toEqual(['a','b','c']);expect(groupRecordDates(rows.content).map(d=>[d.dateKey,d.events.length])).toEqual([['2026-06-01',2],['2026-06-02',1]]);expect(rows.rest).toHaveLength(2);expect(groupRecordDates(rows.rest)).toHaveLength(1);expect(source[0].id).toBe('a');
 });
 it('keeps only the original sanitized stub instead of resolving hidden data for a drilldown',()=>{
  const stub=event('opaque-public-stub','2026-06-02',{teaser:true,publicTitle:'???',tagIds:[],primaryTagIds:[]});const rows=recordMonthEvents([stub],tags,{year:2026,month:6});expect(rows.content).toEqual([stub]);expect(rows.content[0]).toBe(stub);
 });
 it('uses the public broadcast year bounds with December/January rollover',()=>{
  expect(adjacentRecordMonth({year:2001,month:1},-1)).toBeNull();expect(adjacentRecordMonth({year:9999,month:12},1)).toBeNull();expect(adjacentRecordMonth({year:2026,month:1},-1)).toEqual({year:2025,month:12});expect(adjacentRecordMonth({year:2026,month:12},1)).toEqual({year:2027,month:1});expect(isRecordMonth({year:1000,month:1})).toBe(false);expect(adjacentRecordMonth({year:2001,month:0},1)).toBeNull();
 });
});
