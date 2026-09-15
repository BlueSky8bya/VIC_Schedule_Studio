import {describe,it,expect} from 'vitest';
import {pointerBreeze} from '../../components/shared/ambient/world/pointer-breeze';
import type {Frame} from '../../components/shared/ambient/scene-engine';
const frame=()=>({dt:.016,h:900,load:1,p:{x:400,y:780,inside:true,vx:1200,vy:0}} as Frame);
describe('shared seasonal pointer breeze',()=>{
 it('pushes nearby material and leaves distant material alone',()=>{
  const f=frame(),near={x:440,y:780,vx:0,vy:0},far={x:800,y:780,vx:0,vy:0};
  expect(pointerBreeze(near,f,25)).toBeGreaterThan(0);expect(near.vx).toBeGreaterThan(0);
  expect(pointerBreeze(far,f,25)).toBe(0);expect(far.vx).toBe(0);
 });
 it('does not move material when frozen, outside or stationary',()=>{
  for(const mode of ['frozen','outside','stationary']){
   const f=frame(),body={x:440,y:780,vx:0,vy:0};
   if(mode==='frozen')f.dt=0;if(mode==='outside')f.p.inside=false;if(mode==='stationary')f.p.vx=0;
   expect(pointerBreeze(body,f,25)).toBe(0);expect(body.vx).toBe(0);
  }
 });
});
