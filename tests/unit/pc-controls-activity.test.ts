import {afterEach,expect,it,vi} from 'vitest';
import {ACT,describeTarget} from '@/lib/activity/labels';
vi.mock('@/lib/analytics/guard',()=>({skipAnalyticsClient:()=>false}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
it('captures manual date/period activation once and displays fixed names in the shared developer catalog',async()=>{
 vi.useFakeTimers();const handlers=new Map<string,(e:unknown)=>void>(),fetcher=vi.fn().mockResolvedValue({ok:true});
 vi.stubGlobal('fetch',fetcher);vi.stubGlobal('document',{addEventListener:(name:string,fn:(e:unknown)=>void)=>handlers.set(name,fn),visibilityState:'visible'});vi.stubGlobal('window',{addEventListener:()=>{},setTimeout,clearTimeout,sessionStorage:{getItem:()=>null}});
 const logger=await import('@/lib/activity/client');logger.startClickTracking();
 for(const target of ['bp-date-select','search-month#filter','search-month#all']){
  const element={hasAttribute:(name:string)=>name==='data-activity-manual',getAttribute:(name:string)=>name==='data-act'?target:null,matches:()=>false};
  handlers.get('click')!({target:{closest:()=>element}}); // delegated pointer/keyboard click is suppressed
  logger.logActivity('ui.click',{target}); // one committed click, Enter/Space, or select change
 }
 await vi.advanceTimersByTimeAsync(15000);const events=fetcher.mock.calls.flatMap(([,init])=>JSON.parse(init.body).events);
 expect(events.map((event:{target:string})=>event.target)).toEqual(['bp-date-select','search-month#filter','search-month#all']);
 expect(events.every((event:{meta:unknown})=>event.meta===null)).toBe(true);
 for(const target of ['bp-date-select','search-month#filter','search-month#all']){expect(describeTarget('ui.click',target).name).not.toContain('이름 미등록');expect(ACT[target.split('#')[0]]).toBeDefined();}
 expect(describeTarget('ui.click','search-month#filter').name).toContain('연월 좁히기');
});
