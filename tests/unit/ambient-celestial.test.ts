import {describe,it,expect} from 'vitest';
import {galacticEquatorial,horizon,julianDate,precess,projectSky,siderealDegrees,starColor} from '../../components/shared/ambient/world/celestial';
import {visibleStars,moonSkyWash} from '../../components/shared/ambient/world/starfield';
import {CLOUD_GENERA,cloudItems,cloudPool,cloudGroups,cloudAir,cloudDeformation,cloudVapor,cloudPartEvolution} from '../../components/shared/ambient/world/cloud-field';

describe('Seoul star map',()=>{
  it('uses KST and preserves midnight continuity',()=>{
    expect(julianDate({y:2000,m:1,d:1,hour:21})).toBe(2451545);
    expect(julianDate({y:2026,m:1,d:1,hour:24})).toBe(julianDate({y:2026,m:1,d:2,hour:0}));
    expect(siderealDegrees(2451545)).toBeCloseTo((280.460625+126.978)%360,3);
    // USNO API 2026-01-01 12:00 UT1, Seoul: LMST 03:12:31.5999.
    expect(siderealDegrees(julianDate({y:2026,m:1,d:1,hour:21}))).toBeCloseTo((3+12/60+31.5999/3600)*15,3);
  });
  it('puts the celestial north pole at Seoul latitude at all sidereal hours',()=>{
    for(const lst of [0,90,180,270]){const p=horizon(0,90,lst);expect(p.alt).toBeCloseTo(37.5665,5);expect(Math.min(p.az,360-p.az)).toBeLessThan(.001);}
  });
  it('precesses J2000 and maps the galactic centre to Sagittarius',()=>{
    const p=precess(123,42,2451545);expect(p.ra).toBeCloseTo(123,8);expect(p.dec).toBeCloseTo(42,8);
    const gc=galacticEquatorial(0,0);expect(gc.ra).toBeCloseTo(266.405,2);expect(gc.dec).toBeCloseTo(-28.936,2);
  });
  it('keeps Polaris in the northern window and out of the southern one',()=>{
    for(const m of [1,4,7,10])for(const hour of [0,6,12,18]){
      const date={y:2026,m,d:15,hour};
      const polaris=visibleStars(date,1400,270,'north').find(s=>s.id===11767);
      expect(polaris).toBeDefined();expect(polaris!.alt).toBeGreaterThan(36.5);expect(polaris!.alt).toBeLessThan(38.6);
      expect(visibleStars(date,1400,270,'south').some(s=>s.id===11767)).toBe(false);
    }
  });
  it('shows winter Orion in the south rather than pinning it all year',()=>{
    const winter=visibleStars({y:2026,m:1,d:15,hour:21},1400,270,'south');
    const summer=visibleStars({y:2026,m:7,d:15,hour:21},1400,270,'south');
    expect(winter.some(s=>s.name==='Betelgeuse')).toBe(true);
    expect(summer.some(s=>s.name==='Betelgeuse')).toBe(false);
    expect(winter.every(s=>s.alt>=0&&s.x>=0&&s.x<=1400&&s.y>=0&&s.y<=270)).toBe(true);
  });
  it('clips below-horizon points and supports both sides of north',()=>{
    expect(projectSky(0,-1,1400,270,'north')).toBeNull();
    expect(projectSky(359,38,1400,270,'north')!.x).toBeLessThan(700);
    expect(projectSky(1,38,1400,270,'north')!.x).toBeGreaterThan(700);
    expect(starColor(-.2)).not.toBe(starColor(1.5));
  });
  it('does not wash out the galaxy when the moon is below the horizon',()=>{
    expect(moonSkyWash(1,-20)).toBe(0);
    expect(moonSkyWash(1,0)).toBe(0);
    expect(moonSkyWash(1,6)).toBeCloseTo(.5);
    expect(moonSkyWash(1,40)).toBe(1);
    expect(moonSkyWash(0,40)).toBe(0);
  });
});

describe('weather-specific cloud variety',()=>{
  it('has overlapping surface-weather wind ranges and deterministic local evolution',()=>{
    expect(cloudVapor('clear',0,0)).toBe(1);
    expect(cloudVapor('clear',Math.PI/.015,0)).toBe(0);
    expect(cloudVapor('cloud',Math.PI/.015,0)).toBe(.72);
    const calm=Array.from({length:40},(_,s)=>cloudAir(s,'wisps','clear').speed);
    const windy=Array.from({length:40},(_,s)=>cloudAir(s,'wisps','wind').speed);
    expect(Math.max(...calm)).toBeGreaterThan(Math.min(...windy));
    const a=cloudDeformation(42,'fair','clear',0,.2);
    expect(a).toEqual(cloudDeformation(42,'fair','clear',0,.2));
    expect(a).not.toEqual(cloudDeformation(42,'fair','clear',30,.2));
    expect(a).not.toEqual(cloudDeformation(42,'fair','clear',0,.8));
    expect(Math.abs(a.x-cloudDeformation(42,'fair','clear',.016,.2).x)).toBeLessThan(.001);
  });
  it('keeps cloudy, rainy and snowy skies populated throughout long transits',()=>{
    for(const weather of ['cloud','rain','snow'] as const)for(let seed=0;seed<24;seed++){
      const field={season:'summer' as const,weather,seed,w:1400,floor:270};
      for(const t of [0,100,600,1800,3600]){
        expect(cloudGroups(field,t).length).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('covers all ten genera without storm clouds in clear weather',()=>{
    const pool=new Set(['clear','wind','cloud','rain','snow','fog'].flatMap(w=>cloudPool(w as 'clear','summer')));
    expect(CLOUD_GENERA.every(g=>pool.has(g))).toBe(true);
    expect(cloudPool('clear','summer')).not.toContain('cumulonimbus');
  });
  it('is deterministic, varied and far sparser on clear days',()=>{
    let clear=0,cloud=0;const variants=new Set();
    for(let seed=0;seed<30;seed++){
      const field={season:'summer' as const,weather:'cloud' as const,seed,w:1400,floor:270};
      const a=cloudItems(field,100);expect(a).toEqual(cloudItems(field,100));cloud+=a.length;
      clear+=cloudItems({...field,weather:'clear'},100).length;
      for(const c of a){variants.add(`${c.genus}:${c.variant}`);expect(c.y+c.height/2).toBeLessThanOrEqual(270);}
    }
    expect(clear).toBeLessThan(cloud/5);expect(variants.size).toBeGreaterThan(8);
  });
  it('does not change a visible cloud silhouette between nearby frames',()=>{
    const field={season:'summer' as const,weather:'cloud' as const,seed:42,w:1400,floor:270};
    const a=cloudItems(field,10),b=cloudItems(field,10.016);
    for(const c of a.filter(c=>c.x>300&&c.x<1100))expect(b.some(d=>d.genus===c.genus&&d.variant===c.variant&&d.y===c.y&&Math.abs(d.x-c.x)<1)).toBe(true);
  });
  it('introduces new clouds at the edge even on very tall PC screens',()=>{
    const field={season:'summer' as const,weather:'cloud' as const,seed:42,w:3840,floor:900};
    let previous=cloudItems(field,0);
    for(let t=1;t<1600;t++){
      const next=cloudItems(field,t);
      for(const c of next){
        const old=previous.find(d=>d.genus===c.genus&&d.variant===c.variant&&d.y===c.y&&d.width===c.width);
        if(!old)expect(c.x-c.width/2).toBeGreaterThan(field.w-12);
      }
      previous=next;
    }
  });
  it('keeps full natural silhouettes inside the sky and avoids repeated maximum widths',()=>{
    const widths:number[]=[];
    for(const floor of [180,270,900])for(let seed=0;seed<80;seed++){
      const items=cloudItems({season:'summer',weather:'cloud',seed,w:3840,floor},100);
      for(const c of items){
        expect(c.y-c.height/2).toBeGreaterThanOrEqual(7.99);
        expect(c.y+c.height/2).toBeLessThanOrEqual(floor-7.99);
        if(floor===270&&c.genus==='altostratus')widths.push(c.width);
      }
    }
    expect(widths.length).toBeGreaterThan(10);
    // Old clamp gave many independent sheets exactly the same width.
    expect(new Set(widths).size).toBe(widths.length);
  });
  it('keeps bank members together and never inserts high wisps into low overcast',()=>{
    for(let seed=0;seed<60;seed++){
      const f={season:'summer' as const,weather:'cloud' as const,seed,w:1400,floor:270};
      const groups=cloudGroups(f,30),next=cloudGroups(f,30.1);
      for(const group of groups){
        expect(group.parts.length).toBeGreaterThanOrEqual(3);
        expect(group.parts.every(p=>!p.genus.startsWith('cir')&&p.genus!=='cumulonimbus')).toBe(true);
        const later=next.find(g=>g.id===group.id);
        if(later){expect(later.parts).toEqual(group.parts);expect(later.y).toBe(group.y);expect(Math.abs(later.x-group.x)).toBeLessThan(2);}
      }
    }
  });
  it('never reuses a bank cache identity for a different weather composition',()=>{
    const seen=new Map<string,string>();
    for(let seed=0;seed<40;seed++)for(const weather of ['clear','wind','cloud','rain','snow'] as const){
      for(const group of cloudGroups({season:'summer',weather,seed,w:1400,floor:270},100)){
        const shape=JSON.stringify([group.width,group.height,group.parts]);
        if(seen.has(group.id))expect(seen.get(group.id)).toBe(shape);
        seen.set(group.id,shape);
      }
    }
  });
});

describe('individual cloud lifetimes',()=>{
  it('small clouds dissolve faster and neighboring parts have independent clocks',()=>{
    const small=cloudPartEvolution(42,0,50,0,.7),large=cloudPartEvolution(42,0,400,0,.7);
    expect(small.period).toBeLessThan(large.period*.5);
    const values=Array.from({length:240},(_,i)=>cloudPartEvolution(42,0,50,i/4,.7).life);
    expect(Math.min(...values)).toBeLessThan(.01);expect(Math.max(...values)).toBeGreaterThan(.99);
    expect(cloudPartEvolution(42,0,100,12,.7)).not.toEqual(cloudPartEvolution(42,1,100,12,.7));
  });
  it('motion remains continuous across recycling and changes visibly within seconds',()=>{
    for(let t=0;t<100;t+=.1){const a=cloudPartEvolution(42,0,50,t,.7),b=cloudPartEvolution(42,0,50,t+.016,.7);expect(Math.abs(a.life-b.life)).toBeLessThan(.02);}
    const a=cloudPartEvolution(42,1,300,10,.7),b=cloudPartEvolution(42,1,300,15,.7);expect(Math.abs(a.stretch-b.stretch)).toBeGreaterThan(.01);
  });
});
