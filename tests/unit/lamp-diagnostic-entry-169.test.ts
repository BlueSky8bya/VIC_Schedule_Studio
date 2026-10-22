import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({actor:{isAuthenticated:true,role:'owner',email:'SENSITIVE_CANARY_169'},redirect:vi.fn((target:string)=>{throw new Error('REDIRECT:'+target);}),schedule:vi.fn(async()=>({}))}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined}),headers:async()=>({get:()=>''})}));
vi.mock('next/navigation',()=>({redirect:mocks.redirect}));
vi.mock('@/lib/auth/actor',()=>({resolveCurrentActor:async()=>mocks.actor}));
vi.mock('@/lib/schedules/public-loader',()=>({getPublicSchedule:mocks.schedule}));
vi.mock('@/lib/schedules/heart-actions',()=>({toggleEventHeartAction:vi.fn()}));
vi.mock('@/lib/auth/config',()=>({isSupabaseConfigured:()=>true}));
vi.mock('@/components/poster/public-poster',()=>({PublicPoster:()=>null}));
vi.mock('@/components/auth/in-app-browser-notice',()=>({InAppBrowserNotice:()=>null}));
vi.mock('@/lib/perf/perf',()=>({timed:(_name:string,run:()=>unknown)=>run()}));
import HomePage from '@/app/page';
type Entry=(props:{searchParams:Promise<Record<string,string|string[]|undefined>>})=>Promise<unknown>;
const open=HomePage as Entry;
describe('169 authenticated diagnostic entry keeps the existing fixed role destination',()=>{
  beforeEach(()=>{mocks.actor.role='owner';mocks.redirect.mockClear();mocks.schedule.mockClear();});
  it.each(['owner','developer'])('preserves only the explicit diagnostic opt-in for %s',async role=>{
    mocks.actor.role=role;
    await expect(open({searchParams:Promise.resolve({lampTrace:'1',next:'https://external.invalid/',identity:'SENSITIVE_CANARY_169'})})).rejects.toThrow('REDIRECT:/studio?lampTrace=1');
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith('/studio?lampTrace=1');expect(mocks.schedule).toHaveBeenCalledOnce();
  });
  it.each([{}, {lampTrace:'0'}, {lampTrace:['1']}, {lampTrace:'https://external.invalid/'}])('keeps ordinary or invalid inputs on the ordinary studio destination',async search=>{
    await expect(open({searchParams:Promise.resolve(search)})).rejects.toThrow('REDIRECT:/studio');expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith('/studio');
  });
});
