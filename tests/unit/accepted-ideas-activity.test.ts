import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { describeTarget } from '@/lib/activity/labels';
import type { ActivityVisit, UsageRow } from '@/lib/activity/query';

const state=vi.hoisted(()=>({values:[] as unknown[]}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useEffect:()=>{},useRef:(initial:unknown)=>({current:initial}),useState:(initial:unknown)=>[state.values.length?state.values.shift():typeof initial==='function'?(initial as ()=>unknown)():initial,()=>{}]}));
vi.mock('@/lib/analytics/guard',()=>({skipAnalyticsClient:()=>false}));
vi.mock('@/lib/activity/query',()=>({getActivityDayAction:vi.fn(),getActivityUsageAction:vi.fn()}));
vi.mock('@/components/developer/scroll-position',()=>({ScrollPosition:()=>null}));
vi.mock('@/components/developer/insights-dashboard',()=>({deviceLabel:()=>'데스크톱',fmtDur:()=>'1초',hhmm:()=>'00:00',roleColor:()=>'#000'}));
afterEach(()=>{state.values=[];vi.unstubAllGlobals();vi.restoreAllMocks();});

it('renders current and retired control history safely in both developer views',async()=>{
  vi.stubGlobal('React',await import('react'));
  const {ActivityUsage}=await import('@/components/developer/activity-usage'),{ActivityTimeline}=await import('@/components/developer/activity-timeline');
  const targets=['dtp-time-input#hour','dtp-time-input#minute','bp-recent-color','bp-width','bp-layer-rename','detail-tags-toggle','vod-part-select','vod-tab','vod-timeline-current','text-style-reset','text-size-reset','agenda-support-follow-view','add-google-calendar','editor-tags-clear','share-public-event','copy-app-link','theme-mode-select#dark','vod-timeline-find','vod-timeline-find-clear','insights-tab','settings-tab#motion','detail-previous-event','detail-next-event','search-kind#all','search-kind#event','search-kind#vod','search-kind#chapter','record-month#previous','record-month#next','record-summary#content','record-summary#days','record-summary#rest','record-event-open'];
  const rows:UsageRow[]=targets.map(target=>({kind:'ui.click',label:'누름',target,total:1,roles:{developer:1},auto:false}));
  const at=Date.parse('2026-10-24T15:00:00Z');
  const visit:ActivityVisit={key:'synthetic-visit',account:'계정 #1',role:'developer',device:'desktop',startMs:at,endMs:at+2000,items:targets.map((target,i)=>({t:at+i*1000,kind:'ui.click',label:'누름',target,targetLabel:null,source:'client',meta:null,durMs:null}))};
  state.values=[30,rows,null,false,true,'all','all','all',true,true,false,false,{since:'2026-09-26',until:'2026-10-25'}];
  const usage=renderToStaticMarkup(createElement(ActivityUsage,{anchor:'2026-10-25'}));
  state.values=[[visit],[],null,false,new Set([visit.key]),null,true,false,at];
  const timeline=renderToStaticMarkup(createElement(ActivityTimeline,{dateKey:'2026-10-25'}));
  for(const target of targets){const label=describeTarget('ui.click',target).name;expect(usage).toContain(label);expect(timeline).toContain(label);}
  const retired=usage.match(/<ul class="usage-list" data-retired="1">([\s\S]*?)<\/ul>/)?.[1];
  expect(retired).toBeTruthy();
  for(const target of ['vod-tab','text-size-reset','share-public-event','detail-previous-event','detail-next-event']){
    expect(describeTarget('ui.click',target).retired).toBe(true);
    expect(retired).toContain(describeTarget('ui.click',target).name);
  }
  for(const target of ['vod-timeline-current','text-style-reset','record-event-open','copy-app-link','search-kind#event'])expect(describeTarget('ui.click',target).retired).not.toBe(true);
  expect(usage+timeline).not.toContain('이름 미등록');expect(usage+timeline).not.toMatch(/evt-001|access_token|secret/);
});

it('captures each fixed record/search control once through the real collector with a local fake transport',async()=>{
  vi.useFakeTimers();
  try{
    const handlers=new Map<string,(e:unknown)=>void>(),transport=vi.fn().mockResolvedValue({ok:true});
    vi.stubGlobal('fetch',transport);vi.stubGlobal('document',{addEventListener:(name:string,handler:(e:unknown)=>void)=>handlers.set(name,handler),visibilityState:'visible'});
    vi.stubGlobal('window',{addEventListener:()=>{},setTimeout,clearTimeout,sessionStorage:{getItem:()=>null}});
    const {startClickTracking,logActivity}=await import('@/lib/activity/client');startClickTracking();
    const targets=['dtp-time-input#hour','dtp-time-input#minute','bp-recent-color','bp-width','detail-tags-toggle','vod-timeline-current','text-style-reset','agenda-support-follow-view','add-google-calendar','editor-tags-clear','search-kind#all','search-kind#event','search-kind#vod','search-kind#chapter','record-month#previous','record-month#next','record-summary#content','record-summary#days','record-summary#rest','record-event-open'];
    for(const target of targets){const [action,opt]=target.split('#');const element={tagName:'BUTTON',hasAttribute:()=>false,matches:()=>false,getAttribute:(name:string)=>name==='data-act'?action:name==='data-act-opt'?opt??null:null};handlers.get('click')!({target:{closest:()=>element}});}
    handlers.get('click')!({target:{closest:()=>({tagName:'BUTTON',hasAttribute:(name:string)=>name==='data-activity-manual',getAttribute:()=> 'vod-part-select'})}});
    logActivity('ui.click',{target:'bp-layer-rename'});
    await vi.advanceTimersByTimeAsync(15000);const captured=transport.mock.calls.flatMap(([,init])=>JSON.parse(init.body).events);
    expect(captured.map(e=>e.target)).toEqual([...targets,'bp-layer-rename']);expect(captured.every(e=>e.kind==='ui.click'&&e.meta==null)).toBe(true);expect(JSON.stringify(captured)).not.toMatch(/evt-|2026-06|갈틱|email|secret/);
  }finally{vi.useRealTimers();}
});

it('commits a part selection once without recording video identity or title',async()=>{
  vi.stubGlobal('React',await import('react'));
  const activity=await import('@/lib/activity/client'),record=vi.spyOn(activity,'logActivity').mockImplementation(()=>{});
  const {VodPartPicker,commitVodPartSelection}=await import('@/components/poster/day-vod-window');
  const vods=[{titleNo:42,title:'합성 첫 영상',durationMs:600000},{titleNo:43,title:'합성 다른 영상',durationMs:600000}],selectPart=vi.fn();
  expect(VodPartPicker({vods:[vods[0]],selected:vods[0],onSelect:selectPart})).toBeNull();
  commitVodPartSelection(vods,42,42,selectPart);commitVodPartSelection(vods,42,999,selectPart);expect(record).not.toHaveBeenCalled();
  commitVodPartSelection(vods,42,43,selectPart);
  expect(selectPart).toHaveBeenCalledExactlyOnceWith(43);expect(record).toHaveBeenCalledExactlyOnceWith('ui.click',{target:'vod-part-select'});
  expect(JSON.stringify(record.mock.calls)).not.toMatch(/42|43|합성|title|count/);
});


it('commits direct time controls once and records only their fixed identity',async()=>{
  vi.stubGlobal('React',await import('react'));
  const activity=await import('@/lib/activity/client'),record=vi.spyOn(activity,'logActivity').mockImplementation(()=>{});
  const {TimePartInput}=await import('@/components/studio/datetime-picker');
  const change=vi.fn(),preventDefault=vi.fn(),stopPropagation=vi.fn();
  for(const [part,max,next] of [['hour',23,21],['minute',59,37]] as const){
    state.values=[String(next)];
    const control=TimePartInput({value:0,max,part,onChange:change});
    control.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},preventDefault,stopPropagation});
    control.props.onBlur();
    expect(change).toHaveBeenLastCalledWith(next);
  }
  expect(change).toHaveBeenCalledTimes(2);
  expect(record.mock.calls).toEqual([['ui.click',{target:'dtp-time-input#hour'}],['ui.click',{target:'dtp-time-input#minute'}]]);
  expect(JSON.stringify(record.mock.calls)).not.toMatch(/21|37|meta|title|date/);
  for(const draft of ['', '99', 'ab']){
    state.values=[draft];
    const control=TimePartInput({value:0,max:23,part:'hour',onChange:change});
    control.props.onBlur();
  }
  state.values=['12'];
  const control=TimePartInput({value:0,max:23,part:'hour',onChange:change});
  control.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:true},preventDefault,stopPropagation});
  state.values=['12'];
  TimePartInput({value:0,max:23,part:'hour',onChange:change,cancelBlur:{current:true}}).props.onBlur();
  expect(change).toHaveBeenCalledTimes(2);expect(record).toHaveBeenCalledTimes(2);
  state.values=['21'];
  const initial=TimePartInput({value:21,max:23,part:'hour',onChange:change,hasSelection:false});
  initial.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},preventDefault,stopPropagation}); initial.props.onBlur();
  expect(change).toHaveBeenCalledTimes(3);expect(change).toHaveBeenLastCalledWith(21);expect(record).toHaveBeenCalledTimes(3);
});
