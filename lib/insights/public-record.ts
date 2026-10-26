import type {BroadcastTag,PublicScheduleEvent} from '@/lib/domain/schedule-types';
import type {PublicMonth} from '@/lib/ui/public-month-link';

export type PublicRecordGroup = 'content'|'days'|'rest';
export function isRecordMonth(value:PublicMonth){return Number.isInteger(value.year)&&value.year>=2001&&value.year<=9999&&Number.isInteger(value.month)&&value.month>=1&&value.month<=12;}
export function adjacentRecordMonth(value:PublicMonth,direction:-1|1):PublicMonth|null {
  if(!isRecordMonth(value))return null;
  const total=value.year*12+value.month-1+direction;
  const next={year:Math.floor(total/12),month:total%12+1};return isRecordMonth(next)?next:null;
}
export function recordMonthEvents(events:readonly PublicScheduleEvent[],tags:readonly BroadcastTag[],value:PublicMonth){
  const byId=new Map(tags.map(tag=>[tag.id,tag]));
  const rest=(event:PublicScheduleEvent)=>event.tagIds.some(id=>{let tag=byId.get(id),guard=0;while(tag?.parentId&&guard++<5)tag=byId.get(tag.parentId);return tag?.displayName==='휴뱅';});
  const ym=`${value.year}-${String(value.month).padStart(2,'0')}`;
  const month=events.filter(event=>!event.isSupport&&event.startsAt.slice(0,7)===ym).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));
  return {content:month.filter(event=>!rest(event)),rest:month.filter(rest)};
}
export function groupRecordDates(events:readonly PublicScheduleEvent[]){
  const dates=new Map<string,PublicScheduleEvent[]>();
  for(const event of events){const key=event.startsAt.slice(0,10);const list=dates.get(key)??[];list.push(event);dates.set(key,list);}
  return [...dates].map(([dateKey,items])=>({dateKey,events:items}));
}
