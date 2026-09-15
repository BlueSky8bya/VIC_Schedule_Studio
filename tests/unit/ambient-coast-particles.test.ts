import {expect,it} from 'vitest';
import {createParticles} from '@/components/shared/ambient/world/particles';
import {lightOf} from '@/components/shared/ambient/world/light';

it('quiet coasts omit wind debris while retaining precipitation and fog',()=>{
 const quiet=createParticles(42,false),land=createParticles(42);
 for(const weather of ['wind','rain','snow','fog'] as const){
  const light=lightOf('noon',weather,'winter');
  quiet.step(.016,1400,860,weather,light,1,false,false);
  land.step(.016,1400,860,weather,light,1,false,false);
  expect(quiet.debug().motes).toBe(0);
  for(const key of ['drops','flakes','wisps'])expect(quiet.debug()[key]).toBe(land.debug()[key]);
  if(weather==='wind')expect(land.debug().motes).toBeGreaterThan(0);
  if(weather==='rain')expect(quiet.debug().drops).toBeGreaterThan(0);
  if(weather==='snow')expect(quiet.debug().flakes).toBeGreaterThan(0);
  if(weather==='fog')expect(quiet.debug().wisps).toBeGreaterThan(0);
 }
});
