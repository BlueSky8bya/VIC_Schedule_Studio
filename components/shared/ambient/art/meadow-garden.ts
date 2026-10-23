import type { SeasonKey } from '../registry';
import type { Frame } from '../scene-engine';
import { withSurfaceDepth } from '../world/depth-render';

export type MeadowPlant = 'clover' | 'daisy' | 'violet' | 'fern' | 'yarrow' | 'seed' | 'grass';
type Plant = { x:number; y:number; depth:number; size:number; kind:MeadowPlant; angle:number; phase:number; live:boolean };
const species:Record<SeasonKey,readonly MeadowPlant[]> = {
  spring:['clover','clover','daisy','violet','fern','grass'],
  summer:['clover','fern','fern','daisy','yarrow','grass','seed'],
  autumn:['clover','grass','seed','seed','yarrow','fern'],
  winter:['grass','seed','seed'],
};
const palettes:Record<SeasonKey,{leaf:string;lit:string;dark:string;flower:string;heart:string;stem:string}> = {
  spring:{leaf:'#6c9270',lit:'#abc395',dark:'#4b7459',flower:'#f0e4e0',heart:'#c6ad69',stem:'#73905c'},
  summer:{leaf:'#4c7864',lit:'#88a77b',dark:'#365e51',flower:'#e5e6cd',heart:'#bdad73',stem:'#73865a'},
  autumn:{leaf:'#81836a',lit:'#b8aa84',dark:'#65694e',flower:'#c7a2a1',heart:'#947c5c',stem:'#9a8968'},
  winter:{leaf:'#8a9993',lit:'#e3e9e4',dark:'#71817f',flower:'#e6e9e7',heart:'#a4aaa0',stem:'#a5aaa0'},
};

/** Fixed ecological patches, with an open walking corridor. No uniform confetti
 * scatter, flowers on snow, or plants floating above the actual .35 horizon. */
export function meadowGardenLayout(w:number,h:number,season:SeasonKey):Plant[] {
  if(w<1||h<1)return [];
  let seed=0x5f3759df+season.charCodeAt(0)*7919;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const patches=Math.max(5,Math.min(15,Math.round(w*h/155000)));
  const plants:Plant[]=[];
  for(let cluster=0;cluster<patches;cluster++){
    const side=cluster%2===0;
    const cx=side?.035+random()*.29:.675+random()*.29;
    const cv=.3+random()*.64;
    const count=season==='winter'?3+Math.floor(random()*3):8+Math.floor(random()*7);
    for(let i=0;i<count;i++){
      const u=Math.max(.015,Math.min(.985,cx+(random()-.5)*.115));
      const v=Math.max(.25,Math.min(.96,cv+(random()-.5)*.14));
      const depth=v*v*(3-2*v);
      const kind=species[season][Math.floor(random()*species[season].length)];
      plants.push({x:u*w,y:(.35+.65*v)*h,depth:v,size:(6+depth*17)*(0.72+random()*.5)*Math.min(1.3,h/900),kind,angle:(random()-.5)*.45,phase:random()*Math.PI*2,live:(kind==='seed'||kind==='grass')&&v>.67});
    }
  }
  return plants.sort((a,b)=>a.y-b.y);
}

/** Original, resolution-independent plant artwork. Supersampled once into a
 * small atlas; no downloaded assets or per-frame path construction. */
function plantSprite(kind:MeadowPlant,season:SeasonKey) {
  const c=document.createElement('canvas');c.width=128;c.height=160;
  const g=c.getContext('2d')!;g.scale(2,2);g.translate(32,72);
  const p=palettes[season];g.lineCap='round';g.lineJoin='round';
  const stem=(x:number,y:number,width=1)=>{g.strokeStyle=p.stem;g.lineWidth=width;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(x*.35,y*.6,x,y);g.stroke();};
  const leaf=(x:number,y:number,k:number,a:number,color=p.leaf)=>{g.save();g.translate(x,y);g.rotate(a);g.scale(k,k);g.fillStyle=color;g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-7,-4,-8,-11,0,-15);g.bezierCurveTo(8,-11,7,-4,0,0);g.fill();g.restore();};
  if(kind==='clover'){
    for(let i=0;i<4;i++){const a=i*Math.PI/2+.3;const x=Math.sin(a)*7,y=-8+Math.cos(a)*4;stem(x,y,.65);g.save();g.translate(x,y);g.rotate(a);for(const sign of [-1,1]){g.fillStyle=sign<0?p.leaf:p.lit;g.beginPath();g.ellipse(sign*3,-3,4.4,5.4,sign*.35,0,Math.PI*2);g.fill();}g.restore();}
  }else if(kind==='fern'){
    stem(5,-46,1.1);
    for(let j=0;j<7;j++){const yy=-8-j*5.2,xx=5*(-yy/46)**1.5;for(const sign of [-1,1])leaf(xx,yy,.58-j*.055,sign*(.72+j*.035),j%2?p.leaf:p.lit);}
  }else if(kind==='grass'){
    for(let i=0;i<7;i++){g.strokeStyle=i%2?p.leaf:p.lit;g.lineWidth=i%3===0?1.4:.8;const x=(i-3)*3.2;g.beginPath();g.moveTo((i-3)*.5,0);g.quadraticCurveTo(x*.4,-14-i%3*3,x,-21-i%4*4);g.stroke();}
  }else if(kind==='seed'){
    for(const sign of [-1,1]){const x=sign*6,tip=-41+(sign+1)*5;stem(x,tip,1);for(let j=0;j<6;j++){g.fillStyle=season==='winter'?p.lit:p.heart;g.beginPath();g.ellipse(x+sign*(j%2?2:-1),tip+j*2,2.2,3.3,-sign*.5,0,Math.PI*2);g.fill();}}
    leaf(0,-10,.6,-.7);leaf(2,-16,.45,.65);
  }else{
    const x=kind==='yarrow'?-3:2,top=kind==='violet'?-26:-35;stem(x,top,1);leaf(0,-9,.6,-.8);leaf(1,-17,.48,.8);
    const centers=kind==='yarrow'?[[-7,top+3],[0,top],[7,top+3]]:[[x,top]];
    for(const [cx,cy] of centers){const petals=kind==='violet'?5:7;for(let j=0;j<petals;j++){const a=j*Math.PI*2/petals;g.save();g.translate(cx+Math.sin(a)*4,cy+Math.cos(a)*4);g.rotate(-a);g.fillStyle=kind==='violet'?(season==='spring'?'#b5a5c4':p.flower):p.flower;g.beginPath();g.ellipse(0,0,2.2,4.5,0,0,Math.PI*2);g.fill();g.restore();}g.fillStyle=p.heart;g.beginPath();g.arc(cx,cy,2,0,Math.PI*2);g.fill();}
  }
  return c;
}

export class MeadowGarden {
  private plants:Plant[]=[];
  private sprites=new Map<MeadowPlant,HTMLCanvasElement>();
  private width=0;
  private height=0;
  constructor(private season:SeasonKey){}
  private prepare(w:number,h:number){if(this.width===w&&this.height===h)return;this.width=w;this.height=h;this.plants=meadowGardenLayout(w,h,this.season);}
  private paint(g:CanvasRenderingContext2D,p:Plant,sway=0){
    let sprite=this.sprites.get(p.kind);if(!sprite){sprite=plantSprite(p.kind,this.season);this.sprites.set(p.kind,sprite);}
    const k=p.size/40;
    g.save();g.translate(p.x,p.y);g.rotate(p.angle+sway);g.globalAlpha*=.5+p.depth*.48;g.imageSmoothingEnabled=true;
    g.drawImage(sprite,-32*k,-72*k,64*k,80*k);g.restore();
  }
  drawGround(g:CanvasRenderingContext2D,w:number,h:number){this.prepare(w,h);for(const p of this.plants)if(!p.live)this.paint(g,p);}
  drawBreeze(g:CanvasRenderingContext2D,f:Frame){
    this.prepare(f.w,f.h);
    for(const p of this.plants)if(p.live){const sway=f.reduced?0:Math.sin(f.t*(.8+f.light.wind*.8)+p.phase+p.x*.003)*(.018+f.light.wind*.075);withSurfaceDepth(g,p.depth,()=>this.paint(g,p,sway*f.windDir));}
  }
  debug(){return {plants:this.plants.length,species:[...new Set(this.plants.map(p=>p.kind))],atlasBytes:this.sprites.size*128*160*4,sourceScale:2};}
  dispose(){for(const c of this.sprites.values())c.width=c.height=1;this.sprites.clear();this.plants=[];}
}
