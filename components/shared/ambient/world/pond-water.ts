import type {Frame} from '../scene-engine';
import type {SeasonKey} from '../registry';
import type {HillBackdrop} from '../art/hill-backdrop';
import {rng} from '../scenes/util';
import {pondWaterAlpha,pondWaterBounds} from './pond-geometry';
import {reliefLayerCount,reliefMotion} from './terrain-perspective';
import {withReliefSurface} from './depth-render';
import {projectSky} from './celestial';
import {moonLit,moonPhase,moonPosition} from './moon';

/** Small live highlights over the authored water. Source-space bounds follow
 * the bank at any viewport, and use the terrain's own parallax. No frame buffer. */
export class PondWater {
  private time=0;
  private marks:{u:number;v:number;phase:number;size:number}[];
  private path?:Path2D;
  private key='';
  private count=0;
  constructor(seed:number,private season:SeasonKey){
    const random=rng(seed+319);
    this.marks=Array.from({length:144},()=>({u:random(),v:.43+random()*.5,phase:random()*Math.PI*2,size:.4+random()}));
  }
  step(f:Frame){if(!f.reduced&&f.depthTier!=='still'&&this.season!=='winter')this.time+=f.dt;}
  draw(g:CanvasRenderingContext2D,f:Frame,backdrop:HillBackdrop){
    if(!backdrop.ready)return;
    const distance=(x:number,y:number)=>backdrop.distance(x,y,f.w,f.h)??0;
    withReliefSurface(g,(x,y)=>reliefMotion(distance(x,y),reliefLayerCount(f.depthTier??'full')),(off,tier)=>{
      const layers=reliefLayerCount(tier);
      const point=(u:number,v:number)=>{
        const p=backdrop.screenPoint(u,v,f.w,f.h)!;
        const k=reliefMotion(distance(p.x,p.y),layers);
        return {x:p.x+off.x*k,y:p.y+off.y*k};
      };
      const key=`${f.w}:${f.h}:${off.x.toFixed(3)}:${off.y.toFixed(3)}:${tier}`;
      if(!this.path||key!==this.key){
        const path=new Path2D();
        for(let i=0;i<=64;i++){const u=i/64,p=point(u,pondWaterBounds(u).far);if(!i)path.moveTo(p.x,p.y);else path.lineTo(p.x,p.y);}
        for(let i=64;i>=0;i--){const u=i/64,p=point(u,pondWaterBounds(u).near);path.lineTo(p.x,p.y);}
        path.closePath();this.path=path;this.key=key;
      }
      g.save();g.clip(this.path);
      const frozen=this.season==='winter',wind=f.light.wind,baseAlpha=g.globalAlpha;
      const marks=frozen?0:Math.round((tier==='lite'?35:90)*Math.max(.2,f.load));this.count=marks;
      for(let i=0;i<marks;i++){
        const m=this.marks[i],v=m.v+Math.sin(this.time*.13+m.phase)*.003;
        const u=m.u+Math.sin(this.time*(.10+wind*.16)+m.phase)*(.002+wind*.006);
        const a=pondWaterAlpha(u,v);if(a<=0)continue;
        const p=point(u,v),d=distance(p.x,p.y),len=(4+24*d)*m.size;
        const pulse=.35+.65*Math.sin(this.time*(.7+wind)+m.phase)**2;
        g.globalAlpha=baseAlpha*a*pulse*(.05+.10*f.light.glint);
        g.fillStyle=i%4===0?'#285878':'#c7e7ee';
        g.fillRect(p.x-len*.5,p.y,len,Math.max(.5,.5+d));
      }
      // One light path follows the actual viewed celestial bearing/date.
      const night=f.time.band==='night'||(f.time.sun?.alt??-90)<0,date={...f.date,hour:f.time.hour??12};
      const body=night?moonPosition(date):f.time.sun;
      const lit=night?moonLit(moonPhase(date.y,date.m,date.d,date.hour)):1;
      const celestial=body?projectSky(body.az,body.alt,f.w,f.solarHorizon??backdrop.skyHorizon(f.w,f.h)??f.h*.45,f.skyBearing):null;
      const clear=f.weather.now==='clear'||f.weather.now==='wind';
      if(celestial&&clear&&lit>.04){
        const strength=(night?.18*lit:.12*f.light.glint+.16*f.light.reflect.k)*(frozen?.20:1)*Math.min(1,Math.max(0,body!.alt/8));
        for(let i=0;i<40;i++){
          const v=.45+i*.0107,p=point(.5,v);
          const sp=backdrop.sourcePoint(celestial.x,p.y,f.w,f.h)!;
          const alpha=pondWaterAlpha(sp.u,sp.v);if(!alpha)continue;
          const width=(4+i*1.9)*(1+.25*Math.sin(i*1.71+this.time*.7));
          g.globalAlpha=baseAlpha*alpha*strength*(.3+.7*Math.sin(i*2.71+this.time*.5)**2);
          g.fillStyle=night?'#d6e3f3':f.light.reflect.rgb?`rgb(${f.light.reflect.rgb})`:'#e0eeea';
          g.fillRect(celestial.x-width/2+Math.sin(i*1.13+this.time*.3)*3,p.y,width,1+i/35);
        }
      }
      g.restore();
    });
  }
  debug(){return {frozen:this.season==='winter',time:this.time,marks:this.count,framebufferBytes:0};}
  dispose(){this.path=undefined;this.marks=[];}
}
