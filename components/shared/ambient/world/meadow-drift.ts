import { pointerBreeze } from './pointer-breeze';
import { drawMeadowImage } from "./meadow-softness";
import type { Frame } from '../scene-engine';
import { rng, clamp, leafPath, leafVeins, softBlob } from '../scenes/util';
import { anchorToSurface } from './depth-render';
import { meadowActivityAlpha, meadowActivityTop, meadowSize, meadowSpeed } from './meadow-activity';

type Kind = 'spring' | 'summer' | 'winter';
type Mote = { x:number; y:number; vx:number; vy:number; a:number; ph:number; size:number; age:number; variant:number; retire:number; spin:number };

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
      size:this.kind==='spring'?16+r()*8:this.kind==='summer'?30+r()*14:28+r()*12,age:initial?3:0,variant:Math.floor(r()*6),retire:0,spin:0});
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
        const breeze=pointerBreeze(m,f,m.size);
        m.spin+=Math.sin(m.ph)*breeze*Math.min(2600,Math.hypot(f.p.vx,f.p.vy))*.012*f.dt;
        const speed=meadowSpeed(m.y,f.h);
        m.x+=m.vx*f.dt*speed;m.y+=m.vy*f.dt*speed;
      }
      m.spin*=Math.exp(-2.5*f.dt);
      m.a+=m.spin*f.dt;
      m.a+=Math.sin(f.t*.6+m.ph)*f.dt*.45;
      const margin=m.size*1.5+8;
      if(m.y<meadowActivityTop(f.h)-m.size||m.y>f.h+margin||m.x< -margin||m.x>f.w+margin){
        if(m===this.held)this.held=null;this.motes.splice(i,1);
      }
    }
  }
  private bake() {
    if(this.sprites.length)return;
    for(let i=0;i<6;i++){
      const c=document.createElement('canvas');c.width=c.height=64;
      const g=c.getContext('2d')!;g.translate(32,32);
      // Material is baked once. Separate seed keeps appearance changes from
      // changing particle placement, motion or capture hit targets.
      const r=rng(7919+i*137+(this.kind==='spring'?0:this.kind==='summer'?100:200));
      g.lineCap='round';g.lineJoin='round';
      if(this.kind==='spring'){
        g.fillStyle=['#cc8b9d','#b8a3c0','#dfb29a','#dfcc99','#b6c5d1','#c37992'][i];
        // Six distinct botanical silhouettes; blunt bases avoid arrowheads.
        g.beginPath();
        if(i===0){ // rounded cherry petal with a shallow notch
          g.moveTo(-4,20);g.bezierCurveTo(-23,8,-24,-19,-10,-23);
          g.quadraticCurveTo(-3,-25,1,-18);g.quadraticCurveTo(6,-26,14,-20);
          g.bezierCurveTo(26,-9,14,19,3,22);
        }else if(i===1){ // narrow, gently bent lilac petal
          g.moveTo(-2,24);g.bezierCurveTo(-13,16,-15,-6,-8,-22);
          g.bezierCurveTo(-1,-30,9,-19,10,-7);g.bezierCurveTo(13,8,7,21,3,24);
        }else if(i===2){ // broad cupped rose petal
          g.moveTo(-7,18);g.bezierCurveTo(-29,2,-25,-20,-9,-20);
          g.bezierCurveTo(0,-27,26,-20,25,-5);g.bezierCurveTo(21,14,5,24,-7,18);
        }else if(i===3){ // small rounded buttercup petal
          g.moveTo(-5,20);g.bezierCurveTo(-10,8,-23,-2,-18,-16);
          g.bezierCurveTo(-10,-29,14,-26,19,-14);g.bezierCurveTo(24,0,8,10,5,20);
        }else if(i===4){ // asymmetric oval with rolled side
          g.moveTo(-6,20);g.bezierCurveTo(-24,9,-16,-23,-2,-25);
          g.bezierCurveTo(14,-25,20,-8,10,9);g.quadraticCurveTo(1,24,-6,20);
        }else{ // fan petal with softly scalloped edge
          g.moveTo(-5,21);g.bezierCurveTo(-17,11,-25,-8,-20,-17);
          g.quadraticCurveTo(-17,-24,-10,-20);g.quadraticCurveTo(-3,-29,3,-22);
          g.quadraticCurveTo(15,-27,20,-17);g.bezierCurveTo(24,-5,10,19,4,22);
        }
        g.closePath();
      }else if(this.kind==='summer'){
        g.fillStyle=['#648e4f','#8eaa5c','#508465','#a7b96d','#639257','#88a45c'][i];
        leafPath(g,25,[1,0,5,3,2,4][i]);
      }else{
        // Loose aggregate of ice grains: irregular translucent lobes, not an
        // outlined six-point symbol. Pale underside keeps it legible on snow.
        g.fillStyle=i%2?'#b4c8d4':'#bdcdd6';g.beginPath();
        for(let j=0;j<36;j++){
          const a=j*Math.PI*2/36;
          const radius=13+4*Math.cos(a*(5+i%3)+i*.3)+r()*10;
          const x=Math.cos(a)*radius,y=Math.sin(a)*radius*.87;
          if(j===0)g.moveTo(x,y);else g.lineTo(x,y);
        }
        g.closePath();
      }
      g.fill();g.save();g.clip();
      const shade=g.createLinearGradient(-22,-23,18,25);
      shade.addColorStop(0,this.kind==='winter'?'rgba(255,255,250,.8)':'rgba(255,244,207,.48)');
      shade.addColorStop(.48,'rgba(255,244,220,.03)');
      shade.addColorStop(1,this.kind==='winter'?'rgba(76,106,132,.62)':'rgba(40,66,35,.36)');
      g.fillStyle=shade;g.fillRect(-32,-32,64,64);
      for(let j=0;j<7;j++)softBlob(g,(r()-.5)*40,(r()-.5)*44,4+r()*9,
        j%2?'255 242 218':this.kind==='winter'?'109 145 164':'75 77 46',.09+r()*.08);
      // Broken pigment clusters echo terrain texture without a repeated grid.
      for(let j=0;j<170;j++){
        g.fillStyle=j%3===0?'rgba(255,250,229,.18)':this.kind==='winter'?'rgba(122,155,176,.12)':'rgba(56,72,39,.10)';
        g.fillRect(Math.floor((r()-.5)*54),Math.floor((r()-.5)*54),1+Math.floor(r()*3),1+Math.floor(r()*2));
      }
      if(this.kind==='summer'){
        // A raised, bent midrib divides lit and shaded lamina, with fine
        // branching veins rather than the old evenly spaced white chevrons.
        const fold=g.createLinearGradient(-10,0,12,0);
        fold.addColorStop(0,'rgba(228,239,163,.12)');
        fold.addColorStop(.43,'rgba(240,246,181,.32)');
        fold.addColorStop(.53,'rgba(35,67,35,.24)');
        fold.addColorStop(1,'rgba(35,67,35,0)');
        g.fillStyle=fold;g.fillRect(-27,-28,54,56);
        g.strokeStyle='rgba(215,229,157,.43)';g.lineWidth=.8;
        leafVeins(g,25,[1,0,5,3,2,4][i]);
        g.strokeStyle='rgba(210,225,153,.22)';g.lineWidth=.45;
        for(let side=-1;side<=1;side+=2){
          for(let j=0;j<5;j++){
            const y=-17+j*7+r()*3,reach=7+r()*8;
            g.beginPath();g.moveTo(-1,y+5);
            g.quadraticCurveTo(side*reach*.45,y+1,side*reach,y-3);g.stroke();
          }
        }
      }else if(this.kind==='spring'){
        // Cup-shaped lighting: soft centre shadow and a curled, thin rim.
        softBlob(g,4,-4,14,'115 61 83',.23);
        softBlob(g,-9,-10,10,'255 228 207',.35);
        const curl=g.createLinearGradient(-7,0,8,0);
        curl.addColorStop(0,'rgba(255,231,211,0)');
        curl.addColorStop(.44,'rgba(255,231,211,.45)');
        curl.addColorStop(.57,'rgba(118,61,77,.20)');
        curl.addColorStop(1,'rgba(118,61,77,0)');
        g.fillStyle=curl;g.beginPath();g.moveTo(2,24);
        g.quadraticCurveTo(-10,3,2,-19);g.quadraticCurveTo(6,5,2,24);g.fill();
        g.strokeStyle='rgba(255,226,207,.16)';g.lineWidth=.5;
        for(let j=0;j<5;j++){
          g.beginPath();g.moveTo(2,23);g.quadraticCurveTo(-12+j*5,4,-16+j*8,-20+r()*5);g.stroke();
        }
      }else{
        // Overlapping frosted grains catch light separately; tiny gaps avoid
        // a solid cut-paper snowflake, without a high-contrast perimeter.
        for(let j=0;j<45;j++){
          const x=(r()-.5)*42,y=(r()-.5)*40,rad=1+r()*3;
          g.fillStyle=j%4===0?'rgba(108,140,162,.26)':'rgba(255,255,251,.62)';
          g.beginPath();g.moveTo(x-rad,y);g.lineTo(x,y-rad*.7);
          g.lineTo(x+rad,y+.4);g.lineTo(x+.3,y+rad);g.closePath();g.fill();
        }
      }
      g.restore();
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
    for(const m of this.motes){const size=m.size*meadowSize(m.y,f.h),d=Math.hypot(f.p.x-m.x,f.p.y-m.y);if(meadowActivityAlpha(m.y-size,f.h)>.12&&d<Math.max(12,size*1.2)&&d<dist){best=m;dist=d;}}
    this.held=best;return !!best;
  }
  pointerUp(){this.held=null;}
  debug(){return {kind:this.kind,held:!!this.held,motes:this.motes.map(m=>[m.x,m.y])};}
  dispose(){for(const c of this.sprites)c.width=c.height=1;this.sprites=[];this.motes=[];this.held=null;}
}
