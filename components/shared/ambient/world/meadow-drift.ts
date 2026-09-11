import { drawMeadowImage } from "./meadow-softness";
import type { Frame } from '../scene-engine';
import { rng, clamp } from '../scenes/util';
import { anchorToSurface } from './depth-render';
import { meadowActivityAlpha, meadowActivityTop, meadowSize, meadowSpeed } from './meadow-activity';

type Kind = 'spring' | 'summer' | 'winter';
type Mote = { x:number; y:number; vx:number; vy:number; a:number; ph:number; size:number; age:number; variant:number; retire:number };

/** Individual, graspable seasonal wind material. No click-created bursts. */
export class MeadowDrift {
  private motes:Mote[]=[];
  private held:Mote|null=null;
  private rand:()=>number;
  private initialized=false;
  private next=0;
  private sprites:HTMLCanvasElement[]=[];
  constructor(private kind:Kind, seed:number) { this.rand=rng(seed+51931); }
  private spawn(f:Frame, initial=false) {
    const r=this.rand, top=meadowActivityTop(f.h);
    this.motes.push({x:initial?r()*f.w:f.windDir>0?-18:f.w+18,
      y:top+(f.h-top)*(.015+r()*.94),vx:0,vy:0,a:r()*Math.PI*2,ph:r()*Math.PI*2,
      size:this.kind==='spring'?5+r()*4:this.kind==='summer'?6+r()*4:4+r()*3,age:initial?3:0,variant:Math.floor(r()*3),retire:0});
  }
  step(f:Frame) {
    const target=Math.min(72,Math.round((14+36*f.load)*Math.min(1.6,f.w*f.h/1204000)));
    if(!this.initialized){for(let i=0;i<target;i++)this.spawn(f,true);this.initialized=true;}
    if(f.dt<=0)return;
    if(!f.p.down)this.held=null;
    if(this.motes.length<target&&f.t>=this.next){this.spawn(f);this.next=f.t+1.2+this.rand()*2.4;}
    for(let i=this.motes.length-1;i>=0;i--){
      const m=this.motes[i];m.age+=f.dt;
      if(i>=target && m!==this.held)m.retire=Math.min(1,m.retire+f.dt/2);
      if(m.retire>=1){this.motes.splice(i,1);continue;}
      if(m===this.held){
        const k=1-Math.exp(-18*f.dt);
        m.x+=(f.p.x-m.x)*k;m.y+=(f.p.y-m.y)*k;
        m.vx=clamp(f.p.vx*.35,-180,180);m.vy=clamp(f.p.vy*.35,-120,120);
      }else{
        const wind=f.windDir*(5+f.light.wind*35);
        const k=1-Math.exp(-1.1*f.dt);
        m.vx+=(wind+Math.sin(f.t*.53+m.ph)*4-m.vx)*k;
        m.vy+=(Math.cos(f.t*.7+m.ph)*4+(this.kind==='winter'?2:0)-m.vy)*k;
        const speed=meadowSpeed(m.y,f.h);
        m.x+=m.vx*f.dt*speed;m.y+=m.vy*f.dt*speed;
      }
      m.a+=Math.sin(f.t*.6+m.ph)*f.dt*.45;
      if(m.y<meadowActivityTop(f.h)-m.size||m.y>f.h+24||m.x< -60||m.x>f.w+60){
        if(m===this.held)this.held=null;this.motes.splice(i,1);
      }
    }
  }
  private bake() {
    if(this.sprites.length)return;
    for(let i=0;i<3;i++){
      const c=document.createElement('canvas');c.width=c.height=40;
      const g=c.getContext('2d')!;g.translate(20,20);
      if(this.kind==='spring'){
        g.fillStyle=['#ffd9e3','#f7c3d4','#fff0ed'][i];
        g.beginPath();g.moveTo(0,12);g.bezierCurveTo(-16,0,-8,-14,0,-8);g.bezierCurveTo(9,-16,15,1,0,12);g.fill();
      }else if(this.kind==='summer'){
        g.strokeStyle='#f4f1d7';g.lineWidth=1.1;g.beginPath();g.moveTo(0,12);g.lineTo(0,-2);g.stroke();
        for(let j=0;j<9;j++){const a=Math.PI+(j/8)*Math.PI;g.beginPath();g.moveTo(0,-2);g.lineTo(Math.cos(a)*13,-2+Math.sin(a)*10);g.stroke();}
        g.fillStyle='#ac9768';g.fillRect(-1,10,2,4);
      }else{
        g.strokeStyle=['#fffafa','#e7f4ff','#f5fcff'][i];g.lineWidth=1.5;
        for(let j=0;j<6;j++){g.save();g.rotate(j*Math.PI/3);g.beginPath();g.moveTo(0,0);g.lineTo(0,-13);g.moveTo(-4,-8);g.lineTo(0,-5);g.lineTo(4,-8);g.stroke();g.restore();}
      }
      this.sprites.push(c);
    }
  }
  draw(g:CanvasRenderingContext2D,f:Frame){
    this.bake();
    for(let i=0;i<this.motes.length;i++){
      const m=this.motes[i],size=m.size*meadowSize(m.y,f.h),alpha=meadowActivityAlpha(m.y-size,f.h)*Math.min(1,m.age/2)*(1-m.retire);
      if(alpha<=0)continue;
      g.save();anchorToSurface(g,m.y);g.globalAlpha*=alpha*.9;g.translate(m.x,m.y);g.rotate(m.a);
      g.scale(.7+.3*Math.abs(Math.cos(f.t*.6+m.ph)),1);
      g.imageSmoothingEnabled=true;
      drawMeadowImage(g,this.sprites[m.variant],-size,-size,size*2,size*2,m.y,f.h);g.restore();
    }
  }
  pointerDown(f:Frame,onBackground:boolean){
    if(!onBackground||f.load<.15)return false;
    let best:Mote|null=null,dist=Infinity;
    for(const m of this.motes){const size=m.size*meadowSize(m.y,f.h),d=Math.hypot(f.p.x-m.x,f.p.y-m.y);if(meadowActivityAlpha(m.y-size,f.h)>.12&&d<Math.max(7,size*1.5)&&d<dist){best=m;dist=d;}}
    this.held=best;return !!best;
  }
  pointerUp(){this.held=null;}
  debug(){return {kind:this.kind,held:!!this.held,motes:this.motes.map(m=>[m.x,m.y])};}
  dispose(){for(const c of this.sprites)c.width=c.height=1;this.sprites=[];this.motes=[];this.held=null;}
}
