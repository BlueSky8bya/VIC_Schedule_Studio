import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {applyTextPx,setTextPxPref,textPxPref,TEXT_PX_MAX} from '@/lib/ui/edit-prefs';
describe('shared text-size preference',()=>{
 let store:Map<string,string>,styles:Map<string,string>,attrs:Map<string,boolean>;
 beforeEach(()=>{store=new Map();styles=new Map();attrs=new Map();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)},location:{pathname:'/'}});vi.stubGlobal('document',{documentElement:{dataset:{},style:{setProperty:(k:string,v:string)=>styles.set(k,v)},toggleAttribute:(k:string,v:boolean)=>attrs.set(k,v)}});});
 afterEach(()=>vi.unstubAllGlobals());
 it('saves and restores30 without copying between viewer and studio',()=>{expect(TEXT_PX_MAX).toBe(30);setTextPxPref(30,'viewer');setTextPxPref(18,'studio');expect(textPxPref('viewer')).toBe(30);expect(textPxPref('studio')).toBe(18);expect(styles.get('--cal-text')).toBe(String(18/14));});
 it.each([[29.7,29.5],[29.8,30],[31,30],[11,12],[Number.NaN,14],[Number.POSITIVE_INFINITY,14]])('normalizes %s to %s', (input,want)=>{setTextPxPref(input,'viewer');expect(textPxPref('viewer')).toBe(want);expect(attrs.get('data-large-text')).toBe(want>20);});
 it.each(['31','NaN','Infinity','11',''])('falls back for invalid saved value %s',raw=>{store.set('vic.calText',raw);expect(textPxPref('viewer')).toBe(14);});
 it('restores the common scale and large-text layout gate on reset',()=>{applyTextPx(30);expect(styles.get('--cal-text')).toBe(String(30/14));expect(attrs.get('data-large-text')).toBe(true);applyTextPx(14);expect(styles.get('--cal-text')).toBe('1');expect(attrs.get('data-large-text')).toBe(false);});
});
