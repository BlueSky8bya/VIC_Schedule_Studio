import type { SeasonKey } from '../registry';
import type { Weather } from './weather';
import { rng } from '../scenes/util';
import { CloudAtlas, cloudAspect } from '../art/cloud-atlas';
import { cloudLobeShape } from './cloud-shape';
import { detachedCloudIslands, wispLife } from './cloud-islands';
import { scopedDepthTier } from './depth-render';

/** WMO morphology informs the group, not a live weather forecast. */
export const CLOUD_GENERA = ['cirrus','cirrocumulus','cirrostratus','altocumulus','altostratus','stratus','stratocumulus','nimbostratus','cumulus','cumulonimbus'] as const;
export type CloudGenus = typeof CLOUD_GENERA[number];
export type CloudItem = {genus:CloudGenus;variant:number;x:number;y:number;width:number;height:number;alpha:number;flip:boolean};
type Field = {season:SeasonKey;weather:Weather;seed:number;w:number;floor:number};
type Family = 'wisps'|'fair'|'middle'|'rolling'|'rain'|'storm';
export type CloudGroup = {born:number;id:string;family:Family;x:number;y:number;width:number;height:number;alpha:number;parts:CloudItem[]};
const fields = new WeakMap<HTMLCanvasElement,Field>();
const atlas = new CloudAtlas();
export const cloudArtVersion=()=>atlas.version;
const families:Record<Family,CloudGenus[]> = {
  wisps:['cirrus','cirrostratus','cirrocumulus'],
  fair:['cumulus'],middle:['altocumulus','altostratus'],
  rolling:['stratocumulus','stratus'],rain:['nimbostratus','stratus'],
  storm:['cumulonimbus','cumulus','stratocumulus'],
};
/** Independent aloft wind, with overlapping ranges across surface weather.
 * Height shear and condensation/evaporation are an artistic model, not a forecast. */
export function cloudAir(seed:number,family:string,weather:Weather){
  const high=family==='wisps'||family==='middle';
  const r=rng(seed*127+(high?331:887)),strength=.2+r()*.8;
  return {strength,speed:2+strength*9+(high?2:0)+(weather==='wind'?2:0),shear:.3+r()*.7,phase:r()*Math.PI*2};
}
export function cloudDeformation(seed:number,family:string,weather:Weather,t:number,v:number){
  const air=cloudAir(seed,family,weather),phase=air.phase+t*(.018+air.strength*.018);
  return {
    x:(Math.sin(phase+v*3.4)*.035+Math.sin(phase*.61+v*7.1)*.012)*air.shear,
    opacity:.74+.26*Math.sin(phase*.73+v*2.3)**2,
    stretch:1+Math.sin(phase*.81)*.035*air.strength,
  };
}
export function cloudVapor(weather:Weather,t:number,phase:number){
  // Moisture cycles act separately from wind. Thin banks can dissolve fully;
  // an overcast deck keeps a persistent core rather than clearing all at once.
  const u=Math.max(0,Math.min(1,(Math.cos(t*.015+phase)+.3)/1.3));
  const fade=u*u*(3-2*u);
  return weather==='clear'||weather==='wind'?fade:.72+.28*fade;
}
export function cloudPool(weather:Weather,season:SeasonKey):CloudGenus[] {
  if(weather==='clear')return season==='autumn'?families.wisps:['cirrus','cumulus'];
  if(weather==='wind')return [...families.wisps,...families.middle];
  if(weather==='rain')return season==='summer'?[...families.rain,...families.storm]:families.rain;
  if(weather==='snow')return [...families.rain,...families.rolling];
  if(weather==='fog')return ['stratus'];
  return [...families.middle,...families.rolling];
}
function familyOf(field:Field):Family {
  const r=rng(field.seed*63+991)();
  if(field.weather==='clear')return field.season==='autumn'||r<.18?'wisps':'fair';
  if(field.weather==='wind')return r<.7?'wisps':'middle';
  if(field.weather==='rain')return field.season==='summer'&&r<.3?'storm':'rain';
  if(field.weather==='snow')return 'rain';
  return r<.28?'middle':'rolling';
}

/** A coherent bank has one flight clock. Its structure changes only offscreen. */
export function cloudGroups(field:Field,t:number):CloudGroup[] {
  const {w,floor,weather,seed}=field;
  if(weather==='fog'||floor<32)return [];
  const clear=weather==='clear',family=familyOf(field),high=family==='wisps';
  const dense=weather==='cloud'||weather==='rain'||weather==='snow';
  const lanes=Math.min(8,Math.max(1,Math.round((clear?1:weather==='wind'?4:8)*w/1400)));
  const groups:CloudGroup[]=[];
  for(let lane=0;lane<lanes;lane++){
    const r=rng(seed*31+lane*713+1009);
    const drift=r();
    const speed=cloudAir(seed,family,weather).speed*(dense?1:.9+drift*.2);
    // Larger than the complete group half-width, including its detached fringes.
    const margin=floor*4.4+64,gap=w*(clear?2.3:weather==='wind'?.25:.03),span=w+margin*2+gap;
    // Spread banks across the entire transit instead of independent rolls that
    // can leave all overcast banks offscreen at once. Uneven local gaps remain.
    const phase=clear?r():(lane+.15+r()*.7)/lanes;
    const distance=t*speed+phase*span,cycle=Math.floor(distance/span),x=w+margin-(distance-cycle*span);
    const q=rng(seed*71+lane*1319+cycle*19937+17),count=clear?1:3+Math.floor(q()*3);
    const size=floor*(clear?.4:weather==='rain'?1.25:weather==='snow'?1.15:weather==='cloud'?1.1:high?.65:.85)*(.75+q()*.45);
    const baseVariant=Math.floor(q()*3),parts:CloudItem[]=[];
    let cursor=0;
    for(let j=0;j<count;j++){
      const pool=families[family];
      // A storm's tower anchors the bank; smaller low fragments join its base.
      const genus=family==='storm'?(j===0?'cumulonimbus':j===1?'cumulus':'stratocumulus')
        :family==='wisps'?(j===0?'cirrus':j===1?'cirrostratus':'cirrocumulus')
        :pool[j===0?0:Math.floor(q()*pool.length)];
      const variant=(baseVariant+j)%3,partWidth=size*(j===0?1:.58+q()*.5);
      const partHeight=partWidth/cloudAspect(genus,variant);
      // Neighbouring outlines overlap, with uneven baseline and width.
      const y=-partHeight/2+(q()-.5)*size*.1;
      parts.push({genus,variant,x:cursor+partWidth/2,y,width:partWidth,height:partHeight,alpha:1,flip:q()<.5});
      cursor+=partWidth*(high?.42:.48+q()*.15);
    }
    const left=Math.min(...parts.map(p=>p.x-p.width/2)),right=Math.max(...parts.map(p=>p.x+p.width/2));
    const top=Math.min(...parts.map(p=>p.y-p.height/2)),bottom=Math.max(...parts.map(p=>p.y+p.height/2));
    const fit=Math.min(1,(floor-20)/(bottom-top)),width=(right-left)*fit,height=(bottom-top)*fit;
    for(const p of parts){p.x=(p.x-(left+right)/2)*fit;p.y=(p.y-(top+bottom)/2)*fit;p.width*=fit;p.height*=fit;}
    const free=Math.max(0,floor-height-20);
    const y=10+height/2+free*(high?.03+q()*.2:dense?.05+((lane%3)+q()*.65)/3*.9:.2+q()*.5);
    const envelope=width*.72+floor*.25+32;
    if(x+envelope<0||x-envelope>w)continue;
    const born=cycle===0?0:(cycle*span-phase*span+margin-envelope)/speed;
    groups.push({born,id:`${seed}:${lane}:${cycle}:${weather}:${family}:${floor}`,family,x,y,width,height,alpha:high?.42:family==='rain'?.77:.82,parts});
  }
  return groups;
}

/** Flat diagnostic view; rendering composites a bank before applying its opacity. */
export function cloudItems(field:Field,t:number):CloudItem[] {
  return cloudGroups(field,t).flatMap(group=>group.parts.map(p=>({...p,x:group.x+p.x,y:group.y+p.y,alpha:group.alpha})));
}
export function makeCloudField(season:SeasonKey,weather:Weather,w:number,floor:number,seed:number) {
  const far=document.createElement('canvas'),near=document.createElement('canvas');far.width=far.height=near.width=near.height=1;
  fields.set(far,{season,weather,w,floor,seed});return {far,near};
}

/** Independent life and local wind for each cloud; small clouds turn over faster. */
export function cloudPartEvolution(seed:number,index:number,width:number,t:number,strength:number){
  const r=rng(seed*277+index*1709+43),phase=r()*Math.PI*2;
  const small=Math.max(0,Math.min(1,(240-width)/200));
  const period=(60-44*small)/( .8+strength*.5);
  const cycle=t/period+phase/(Math.PI*2),age=cycle-Math.floor(cycle);
  const sm=(v:number)=>{const u=Math.max(0,Math.min(1,v));return u*u*(3-2*u);};
  const life=sm(age/.18)*(1-sm((age-.58)/.42));
  const dissolve=sm((age-.5)/.5);
  return {small,period,phase,life,age,dissolve,
    dx:Math.sin(t*(.035+small*.055)+phase)*width*(.045+small*.09)*strength,
    dy:Math.sin(t*.085+phase*1.7)*Math.min(10,width*.025),
    stretch:1+Math.sin(t*(.12+small*.12)+phase)*(.055+strength*.065)};
}

// Soft overlapping lobes, never horizontal strips or a rigid whole-bank bitmap.
type Wisp={c:HTMLCanvasElement;x:number;y:number;w:number;h:number};
type Parts={lobes:HTMLCanvasElement[];wisps:Wisp[]};
const partCache=new Map<string,Parts>();
const partCanvases=(p:Parts)=>[...p.lobes,...p.wisps.map(w=>w.c)];
function partSprites(p:CloudItem){
  if(!atlas.version)return null;
  const key=p.genus+':'+p.variant+':'+atlas.version;
  const old=partCache.get(key);if(old){partCache.delete(key);partCache.set(key,old);return old;}
  const src=atlas.get(p.genus,p.variant);if(!src)return null;
  const scale=Math.min(1,480/src.width,180/src.height),w=Math.ceil(src.width*scale)+16,h=Math.ceil(src.height*scale)+16;
  const base=document.createElement('canvas');base.width=w;base.height=h;
  const bg=base.getContext('2d')!;bg.imageSmoothingEnabled=true;bg.imageSmoothingQuality='high';
  bg.drawImage(src,8,8,w-16,h-16);
  const raw=bg.getImageData(0,0,w,h);
  const wisps:Wisp[]=[];
  for(const island of detachedCloudIslands(raw.data,w,h)){
    const c=document.createElement('canvas');c.width=island.w+12;c.height=island.h+12;
    const cg=c.getContext('2d')!,im=cg.createImageData(c.width,c.height);
    for(const i of island.pixels){const x=i%w-island.x+6,y=Math.floor(i/w)-island.y+6,k=(y*c.width+x)*4;
      im.data.set(raw.data.subarray(i*4,i*4+4),k);raw.data[i*4+3]=0;
    }
    cg.putImageData(im,0,0);
    const soft=document.createElement('canvas');soft.width=c.width;soft.height=c.height;
    const sg=soft.getContext('2d')!;sg.filter='blur(2px)';sg.drawImage(c,0,0);c.width=c.height=1;
    wisps.push({c:soft,x:(island.x+island.w/2-8)/(w-16)-.5,y:(island.y+island.h/2-8)/(h-16)-.5,w:island.w/(w-16),h:island.h/(h-16)});
  }
  bg.putImageData(raw,0,0);
  const softened=document.createElement('canvas');softened.width=w;softened.height=h;
  const sg=softened.getContext('2d')!;sg.filter='blur(2px)';sg.drawImage(base,0,0);
  bg.clearRect(0,0,w,h);bg.drawImage(softened,0,0);softened.width=softened.height=1;
  const result=Array.from({length:6},(_,i)=>{
    const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;g.drawImage(base,0,0);
    const mask=g.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      // Curved divisions have no ruler-straight outline even while separating.
      const u=x/w+Math.sin(y/h*5.3)*.06;
      const a0=Math.exp(-(((u-.12)/.25)**2)),a1=Math.exp(-(((u-.5)/.25)**2)),a2=Math.exp(-(((u-.88)/.25)**2));
      const column=i%3,row=Math.floor(i/3);
      const v=y/h+Math.sin(x/w*6.1)*.07;
      const b0=Math.exp(-(((v-.2)/.36)**2)),b1=Math.exp(-(((v-.8)/.36)**2));
      const a=(column===0?a0:column===1?a1:a2)/(a0+a1+a2)*(row===0?b0:b1)/(b0+b1),k=(y*w+x)*4;
      mask.data[k]=mask.data[k+1]=mask.data[k+2]=255;mask.data[k+3]=Math.round(a*255);
    }
    const m=document.createElement('canvas');m.width=w;m.height=h;m.getContext('2d')!.putImageData(mask,0,0);
    g.globalCompositeOperation='destination-in';g.drawImage(m,0,0);m.width=m.height=1;return c;
  });
  base.width=base.height=1;const parts={lobes:result,wisps};partCache.set(key,parts);
  while(partCache.size>20||[...partCache.values()].flatMap(partCanvases).reduce((n,c)=>n+c.width*c.height*4,0)>16*1024*1024){
    const key=partCache.keys().next().value!;for(const c of partCanvases(partCache.get(key)!))c.width=c.height=1;partCache.delete(key);
  }
  return parts;
}
export function drawCloudField(g:CanvasRenderingContext2D,far:HTMLCanvasElement,t:number) {
  const field=fields.get(far);if(!field)return false;
  g.save();g.beginPath();g.rect(0,0,field.w,field.floor);g.clip();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const tier=scopedDepthTier(g);
  for(const group of cloudGroups(field,t)){
    const air=cloudAir(field.seed,group.family,field.weather);
    const elapsed=Math.max(0,t-group.born);
    const bankSeed=field.seed+Math.round(group.y*17)+group.parts[0].variant*101;
    for(let index=0;index<group.parts.length;index++){
      const p=group.parts[index],sprites=partSprites(p);if(!sprites)continue;
      const state=cloudPartEvolution(bankSeed,index,p.width,t,air.strength);
      // Overcast retains broad cores; small peripheral clouds can disappear completely.
      const core=p.width>=100;
      const evaporation=wispLife(p.width,elapsed,state.phase/(Math.PI*2),air.strength);
      const life=core?.9+.1*state.life:evaporation.alpha;
      for(let lobe=0;lobe<6;lobe++){
        const c=sprites.lobes[lobe],column=lobe%3,row=Math.floor(lobe/3);
        const fringe=wispLife(p.width*.45,elapsed,rng(bankSeed+503+index*3+column)(),air.strength);
        const active=tier==='full';
        const shape=cloudLobeShape(t,state.phase,column,row,air.strength);
        const verticalRoom=Math.min(group.y-group.height/2,field.floor-group.y-group.height/2);
        const edgeGain=Math.max(0,Math.min(1,(verticalRoom-3)/(p.height*.65+8)));
        // Each region expands/shears about its own center; upper/lower edges
        // evolve independently, and neighboring clouds overlap as they spread.
        const px=(column-1)*p.width*.34,py=(row-.5)*p.height*.55;
        const split=active?(core?Math.sin(state.age*Math.PI)**2:evaporation.spread)*(column-1)*p.width*.08:0;
        const localDrift=active?Math.sin(t*.043+state.phase)*p.width*.08:0;
        g.save();g.translate(group.x+p.x+state.dx+localDrift,group.y+p.y);if(p.flip)g.scale(-1,1);
        if(active){
          g.translate(px+shape.x*p.width+split,py+shape.y*p.height*edgeGain);
          g.transform(shape.sx,0,shape.shear,1+(shape.sy-1)*edgeGain,0,0);
          g.translate(-px,-py);
        }
        g.globalAlpha*=group.alpha*life*(column!==1?.3+.7*fringe.alpha:1);
        g.drawImage(c,-p.width/2-8,-p.height/2-8,p.width+16,p.height+16);g.restore();
      }
      for(let j=0;j<sprites.wisps.length;j++){
        const wisp=sprites.wisps[j],width=wisp.w*p.width,height=wisp.h*p.height;
        const phase=rng(bankSeed*31+index*991+j*137)();
        const life=wispLife(width,elapsed,phase,air.strength);
        if(life.alpha<.003)continue;
        const active=tier==='full',direction=p.flip?-1:1;
        const dx=(life.age-.4)*(10+air.strength*24)+Math.sin(t*.5+phase*6)*3;
        const x=group.x+p.x+direction*wisp.x*p.width+dx;
        const y=group.y+p.y+wisp.y*p.height-Math.sin(life.age*Math.PI)*5;
        const sx=1+(active?life.spread*.8:0),sy=1-(active?life.spread*.35:0);
        g.save();g.translate(x,y);if(p.flip)g.scale(-1,1);
        g.globalAlpha*=group.alpha*life.alpha;
        g.drawImage(wisp.c,-(width+12)*sx/2,-(height+12)*sy/2,(width+12)*sx,(height+12)*sy);g.restore();
      }
    }
  }
  g.restore();return true;
}
