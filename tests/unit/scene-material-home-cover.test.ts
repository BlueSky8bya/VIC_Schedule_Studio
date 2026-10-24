import {afterEach,describe,expect,it,vi} from 'vitest';
import {readCompanionShowcaseCovers} from '@/lib/ui/viewer-companion/showcase-session';

afterEach(()=>vi.unstubAllGlobals());
function room({compact=false,hidden=false,foreign=false,display='block',opacity='1'}={}){
 const rect={left:20,top:200,right:340,bottom:640,width:320,height:440};
 const outer={matches:()=>false,parentElement:null,closest:(selector:string)=>selector==='[aria-hidden=true]'?outer:null};
 const gate={matches:(selector:string)=>selector==='.vc-home,.vc-compact-home',parentElement:foreign?outer:null,closest:(selector:string)=>selector==='[aria-hidden=true]'?gate:null};
 const node={isConnected:true,parentElement:compact?gate:foreign?outer:null,matches:gate.matches,closest:(selector:string)=>selector==='[hidden]'?(hidden?node:null):selector==='[aria-hidden=true]'?(compact?gate:node):null,getBoundingClientRect:()=>rect};
 vi.stubGlobal('document',{querySelectorAll:()=>[node]});
 vi.stubGlobal('getComputedStyle',()=>({display,visibility:'visible',opacity}));
 return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};
}
describe('painted home coverage versus input admission',()=>{
 it.each([false,true])('retains painted home ink for material, while default admission still rejects its accessibility gate (compact=%s)',compact=>{
  const rect=room({compact});
  expect(readCompanionShowcaseCovers()).toEqual([]);
  expect(readCompanionShowcaseCovers({retainHomePaint:true})).toEqual([rect]);
 });
 it('never skips a hidden home or a foreign inaccessible ancestor',()=>{
  room({hidden:true});expect(readCompanionShowcaseCovers({retainHomePaint:true})).toEqual([]);
  room({foreign:true});expect(readCompanionShowcaseCovers({retainHomePaint:true})).toEqual([]);
  room({compact:true,foreign:true});expect(readCompanionShowcaseCovers({retainHomePaint:true})).toEqual([]);
 });
 it.each([{display:'none'},{opacity:'0'}])('rejects room ink that is not painted: %s',style=>{
  room(style);expect(readCompanionShowcaseCovers({retainHomePaint:true})).toEqual([]);
 });
});
