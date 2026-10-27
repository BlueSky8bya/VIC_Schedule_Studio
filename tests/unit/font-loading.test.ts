import {afterEach,expect,it,vi} from 'vitest';
import {loadUiFont} from '@/lib/ui/font-loading';
const option={id:'test',label:'시험',kind:'둥근' as const,stack:'"Declared", sans-serif'};
const face={family:'Declared',status:'loaded'};
function setup(load=vi.fn().mockResolvedValue([face])){vi.stubGlobal('document',{documentElement:{},fonts:{load}});vi.stubGlobal('getComputedStyle',()=>({getPropertyValue:()=> '"Declared"'}));return load;}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('requires actual loaded faces for both requested weights, never a fallback or empty match',async()=>{
 const load=setup();await expect(loadUiFont(option)).resolves.toBeUndefined();expect(load.mock.calls.map(c=>c[0])).toEqual(['400 24px "Declared"','700 24px "Declared"']);
 for(const value of [[],[{family:'Fallback',status:'loaded'}],[{family:'Declared',status:'error'}]]){load.mockResolvedValue(value);await expect(loadUiFont(option)).rejects.toThrow('font-not-loaded');}
});
it('keeps network rejection and stale completion out of success',async()=>{
 setup(vi.fn().mockRejectedValue(Error('503')));await expect(loadUiFont(option)).rejects.toThrow('503');
 setup();await expect(loadUiFont(option,{isCurrent:()=>false})).rejects.toThrow('font-not-loaded');
});
it('bounds pending downloads and does not need a request for base',async()=>{
 vi.useFakeTimers();const load=setup(vi.fn(()=>new Promise(()=>{})));const task=expect(loadUiFont(option,{timeoutMs:50})).rejects.toThrow('font-load-timeout');await vi.advanceTimersByTimeAsync(50);await task;
 await loadUiFont({...option,stack:''});expect(load).toHaveBeenCalledTimes(2);
});
it('recovers using loaded replacements without re-reading poisoned CSS error faces',async()=>{
 const family='RetryDeclared',original={family,status:'error',weight:'400',style:'normal',stretch:'normal',unicodeRange:'U+0-10FFFF',display:'swap'};
 class Rule {style={fontFamily:family,getPropertyValue:(key:string)=>({'font-weight':'400','unicode-range':'U+0-10FFFF',src:'url("https://example.invalid/declared.woff2")'}[key]??'')};}
 class Face {family:string;status='unloaded';constructor(name:string){this.family=name;}async load(){this.status='loaded';return this;}}
 let resolve!:()=>void;const late={...original,status:'loading',loaded:new Promise<void>(r=>{resolve=r;})};
 const members=new Set<unknown>([original,late]),load=vi.fn().mockRejectedValue(Error('poisoned original CSS face'));
 vi.stubGlobal('CSSFontFaceRule',Rule);vi.stubGlobal('FontFace',Face);vi.stubGlobal('getComputedStyle',()=>({getPropertyValue:()=>''}));
 vi.stubGlobal('document',{documentElement:{},styleSheets:[{cssRules:[new Rule()]}],fonts:{[Symbol.iterator]:()=>members.values(),load,add:(f:unknown)=>members.add(f),has:(f:unknown)=>members.has(f)}});
 const opt={...option,stack:`"${family}", sans-serif`};let finished=false;const retry=loadUiFont(opt,{retry:true}).then(()=>{finished=true;});await Promise.resolve();await Promise.resolve();expect(finished).toBe(false);late.status='loaded';resolve();await retry;await loadUiFont(opt);
 expect(load).not.toHaveBeenCalled();expect([...members].some(f=>(f as Face).status==='loaded')).toBe(true);
});
