import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { describeTarget } from '@/lib/activity/labels';
import type { ActivityVisit, UsageRow } from '@/lib/activity/query';

const state=vi.hoisted(()=>({values:[] as unknown[]}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useEffect:()=>{},useState:(initial:unknown)=>[state.values.length?state.values.shift():typeof initial==='function'?(initial as ()=>unknown)():initial,()=>{}]}));
vi.mock('@/lib/activity/query',()=>({getActivityDayAction:vi.fn(),getActivityUsageAction:vi.fn()}));
vi.mock('@/components/developer/scroll-position',()=>({ScrollPosition:()=>null}));
vi.mock('@/components/developer/insights-dashboard',()=>({deviceLabel:()=>'데스크톱',fmtDur:()=>'1초',hhmm:()=>'00:00',roleColor:()=>'#000'}));
afterEach(()=>{state.values=[];vi.unstubAllGlobals();});

it('renders adopted controls by the same safe fixed labels in timeline and least-used features',async()=>{
  vi.stubGlobal('React',await import('react'));
  const {ActivityUsage}=await import('@/components/developer/activity-usage'),{ActivityTimeline}=await import('@/components/developer/activity-timeline');
  const targets=['share-public-event','copy-app-link','theme-mode-select#dark'];
  const rows:UsageRow[]=targets.map(target=>({kind:'ui.click',label:'누름',target,total:1,roles:{developer:1},auto:false}));
  const at=Date.parse('2026-10-24T15:00:00Z');
  const visit:ActivityVisit={key:'synthetic-visit',account:'계정 #1',role:'developer',device:'desktop',startMs:at,endMs:at+2000,items:targets.map((target,i)=>({t:at+i*1000,kind:'ui.click',label:'누름',target,targetLabel:null,source:'client',meta:null,durMs:null}))};
  state.values=[30,rows,null,false,false,'all','all','all',true,false,false,false,{since:'2026-09-26',until:'2026-10-25'}];
  const usage=renderToStaticMarkup(createElement(ActivityUsage,{anchor:'2026-10-25'}));
  state.values=[[visit],[],null,false,new Set([visit.key]),null,true,false,at];
  const timeline=renderToStaticMarkup(createElement(ActivityTimeline,{dateKey:'2026-10-25'}));
  for(const target of targets){const label=describeTarget('ui.click',target).name;expect(usage).toContain(label);expect(timeline).toContain(label);}
  expect(usage+timeline).not.toContain('이름 미등록');expect(usage+timeline).not.toMatch(/evt-001|access_token|secret/);
});
