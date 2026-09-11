import {describe,it,expect} from 'vitest';
import {withViewHorizon} from '../../components/shared/ambient/world/view';
import {meadowActivityTop,meadowActivityAlpha,meadowSize,meadowSpeed} from '../../components/shared/ambient/world/meadow-activity';
import {MeadowDrift} from '../../components/shared/ambient/world/meadow-drift';
import type {Frame} from '../../components/shared/ambient/scene-engine';
describe('meadow activity',()=>{
 it('reaches the horizon with continuous distance cues',()=>withViewHorizon(.35,()=>{
  const top=meadowActivityTop(900);expect(top).toBe(323);
  expect(meadowActivityAlpha(top-1,900)).toBe(0);
  expect(meadowActivityAlpha(900,900)).toBe(1);
  expect(meadowSize(top+30,900)).toBeLessThan(meadowSize(800,900));
  expect(meadowSpeed(top+30,900)).toBeLessThan(meadowSpeed(800,900)/3);
  expect(meadowActivityAlpha(top+.01,900)).toBeLessThan(.00001);
 }));
 it.each(['spring','summer','winter'] as const)('%s moves one grabbed piece and retires it beyond the distant boundary',kind=>withViewHorizon(.35,()=>{
  const drift=new MeadowDrift(kind,42);
  const f={w:1400,h:860,dt:0,t:0,load:1,windDir:1,light:{wind:.1},p:{x:0,y:0,down:false,inside:true,vx:0,vy:0}} as Frame;
  drift.step(f);const [x,y]=drift.debug().motes[0];
  f.p.x=x;f.p.y=y;f.p.down=true;expect(drift.pointerDown(f,true)).toBe(true);
  const before=drift.debug().motes.length;f.p.y=100;f.dt=.016;
  for(let i=0;i<90;i++){f.t+=f.dt;drift.step(f);}
  expect(drift.debug().held).toBe(false);
  expect(drift.debug().motes.length).toBeLessThanOrEqual(before);
  expect(drift.debug().motes.every(p=>p[1]>meadowActivityTop(f.h)-12)).toBe(true);
 }));
 it('retires excess motes when the available budget falls',()=>withViewHorizon(.35,()=>{
  const drift=new MeadowDrift('spring',42);
  const f={w:1400,h:860,dt:0,t:0,load:1,windDir:1,light:{wind:.1},p:{x:0,y:0,down:false,inside:true,vx:0,vy:0}} as Frame;
  drift.step(f);expect(drift.debug().motes.length).toBe(50);
  f.load=0;f.dt=.05;
  for(let i=0;i<50;i++){f.t+=f.dt;drift.step(f);}
  expect(drift.debug().motes.length).toBeLessThanOrEqual(14);
 }));

});
