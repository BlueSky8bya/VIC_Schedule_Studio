import catalog from './star-catalog.json';
import { galacticEquatorial, horizon, julianDate, precess, projectSky, siderealDegrees, starColor, type SkyBearing, type SkyDate } from './celestial';
import { rng } from '../scenes/util';

type CatalogRow = [number, number, number, number, number|null, string, number, number];
export type VisibleStar = { id:number; name:string; x:number; y:number; alt:number; az:number; mag:number; color:string; phase:number };
type StarMap = { stars:VisibleStar[]; milky:HTMLCanvasElement|null };
const cache = new Map<string,StarMap>();
const rows = catalog as CatalogRow[];

/** Scattered moonlight depends on altitude, not whether the camera sees it. */
export function moonSkyWash(lit:number,altitude:number){
  const u=Math.max(0,Math.min(1,altitude/12));
  return lit*u*u*(3-2*u);
}

export function visibleStars(date:SkyDate,w:number,h:number,bearing:SkyBearing) {
  const jd=julianDate(date), lst=siderealDegrees(jd), years=(jd-2451545)/365.25;
  const out:VisibleStar[]=[];
  for(const [id,ra,dec,mag,bv,name,pmra,pmdec] of rows){
    const eq=precess(ra*15+pmra*years/(3600000*Math.max(.001,Math.cos(dec*Math.PI/180))),dec+pmdec*years/3600000,jd);
    const hor=horizon(eq.ra,eq.dec,lst), xy=projectSky(hor.az,hor.alt,w,h,bearing);
    if(xy)out.push({id,name,...xy,...hor,mag,color:starColor(bv),phase:(id*.754877666%1)*Math.PI*2});
  }
  return out;
}

function bakeMilky(date:SkyDate,w:number,h:number,bearing:SkyBearing) {
  if(h<70)return null;
  const scale=Math.max(1,Math.sqrt(w*h/(500*1024)));
  const c=document.createElement('canvas');c.width=Math.ceil(w/scale);c.height=Math.ceil(h/scale);
  const g=c.getContext('2d')!,rand=rng(31991),jd=julianDate(date),lst=siderealDegrees(jd);
  const pinpoints:{x:number;y:number;alpha:number}[]=[];
  // Fixed faint background stars in galactic coordinates, not enlarged glow dots.
  for(let i=0;i<24000;i++){
    const l=rand()*360,b=(rand()+rand()+rand()-1.5)*14,grain=rand();
    const eq0=galacticEquatorial(l,b),eq=precess(eq0.ra,eq0.dec,jd),hor=horizon(eq.ra,eq.dec,lst);
    const xy=projectSky(hor.az,hor.alt,w,h,bearing);if(!xy||hor.alt<3)continue;
    const core=Math.exp(-Math.pow(Math.min(l,360-l)/32,2));
    // Broad star clouds broken by an uneven dark dust lane, not a flat stripe.
    const dust=.22+.78*(1-Math.exp(-Math.pow((b-1.8*Math.sin(l*.055))/1.6,2)));
    const knots=.55+.45*Math.pow(Math.sin(l*.091)+.35*Math.sin(l*.27),2);
    const alpha=(.07+.08*grain)*(1+core*.8)*dust*knots*Math.min(1,hor.alt/12);
    g.fillStyle=`rgb(${core>.3?'225 217 227':'190 209 239'} / ${Math.min(.3,alpha).toFixed(3)})`;
    const x=Math.floor(xy.x/scale),y=Math.floor(xy.y/scale);
    g.fillRect(x,y,1,1);
    if(grain>.42)pinpoints.push({x,y,alpha:Math.min(.85,(.24+grain*.52)*dust*Math.min(1,hor.alt/12))});
  }
  // A subdued broad glow sits behind sharp one-pixel stars. Blur never touches
  // the stars themselves; both are baked once into the bounded minute cache.
  const soft=document.createElement('canvas');soft.width=c.width;soft.height=c.height;
  const sg=soft.getContext('2d')!;sg.filter='blur(5px)';sg.globalAlpha=.6;sg.drawImage(c,0,0);
  sg.filter='none';sg.globalAlpha=1;
  for(const p of pinpoints){sg.fillStyle=`rgb(215 225 245 / ${p.alpha.toFixed(3)})`;sg.fillRect(p.x,p.y,1,1);}
  c.width=c.height=1;
  return soft;
}

export function drawStarfield(g:CanvasRenderingContext2D,date:SkyDate,w:number,h:number,bearing:SkyBearing,t:number,lit:number,load:number) {
  // One minute of world time, no dependence on random scene seed or animation t.
  const minute=Math.floor(date.hour*60), fixed={...date,hour:minute/60};
  const key=`${date.y}:${date.m}:${date.d}:${minute}:${w}:${h}:${bearing}`;
  let map=cache.get(key);
  if(!map){
    map={stars:visibleStars(fixed,w,h,bearing),milky:null};cache.set(key,map);
    while(cache.size>4){const first=cache.keys().next().value!;const old=cache.get(first)!;if(old.milky)old.milky.width=old.milky.height=1;cache.delete(first);}
  }
  if(!map.milky&&load>=.35)map.milky=bakeMilky(fixed,w,h,bearing);
  const moonK=1-.28*lit;
  g.save();g.imageSmoothingEnabled=false;
  if(map.milky&&load>=.35){g.globalAlpha*=1-.65*lit;g.drawImage(map.milky,0,0,w,h);}
  g.restore();
  const limit=load<.35?4.8:6;
  for(const s of map.stars){
    if(s.mag>limit)continue;
    const brightness=Math.max(.38,Math.min(1,1.12-(s.mag+1.5)*.09));
    const twinkle=s.mag<2.5&&load>=.35?.9+.1*Math.sin(t*(.5+Math.max(0,25-s.alt)*.01)+s.phase):1;
    const a=brightness*twinkle*moonK*Math.min(1,s.alt/8);
    const size=s.mag<.6?3:s.mag<2.5?2:1, x=Math.round(s.x),y=Math.round(s.y);
    g.fillStyle=`rgb(${s.color} / ${a.toFixed(3)})`;g.fillRect(x,y,size,size);
    if(s.mag<1.5){g.fillStyle=`rgb(${s.color} / ${(a*.18).toFixed(3)})`;g.fillRect(x-1,y,size+2,1);g.fillRect(x,y-1,1,size+2);}
  }
}
