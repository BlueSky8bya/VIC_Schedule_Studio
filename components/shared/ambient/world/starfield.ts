import catalog from './star-catalog.json';
import { galacticEquatorial, horizon, julianDate, precess, projectSky, siderealDegrees, starColor, type SkyBearing, type SkyDate } from './celestial';
import { rng } from '../scenes/util';

type CatalogRow = [number, number, number, number, number|null, string, number, number];
export type VisibleStar = { id:number; name:string; x:number; y:number; alt:number; az:number; mag:number; color:string; phase:number };
type StarMap = { stars:VisibleStar[]; milky:HTMLCanvasElement|null };
const cache = new Map<string,StarMap>();
const rows = catalog as CatalogRow[];

/** Decorative unresolved stars, not catalog objects. Fixed galactic coordinates
 * keep this texture attached to the sky when the date or bearing changes. */
export function galacticStarClouds() {
  const rand=rng(31991), points:{l:number;b:number;grain:number;cluster:boolean;ra:number;dec:number}[]=[];
  // Construct one uniform object per point. Mapping/spreading a second 40k
  // object array caused avoidable allocation and slow first-night startup.
  const add=(l:number,b:number,grain:number,cluster:boolean)=>{
    const eq=galacticEquatorial(l,b);
    points.push({l,b,grain,cluster,ra:eq.ra,dec:eq.dec});
  };
  for(let i=0;i<34000;i++)add(rand()*360,(rand()+rand()+rand()-1.5)*17,rand(),false);
  for(let k=0;k<42;k++){
    const l=rand()*360,b=(rand()-.5)*15,spread=.35+rand()*1.5;
    for(let i=0;i<150;i++){
      const a=rand()*Math.PI*2,r=Math.sqrt(-2*Math.log(Math.max(.0001,rand())))*spread;
      add((l+Math.cos(a)*r*1.5+360)%360,b+Math.sin(a)*r,rand(),true);
    }
  }
  return points;
}
// Low-load/daytime viewers never allocate this decorative catalog. Galactic
// conversion is static and done once, not on each minute/viewport cache miss.
let starClouds:ReturnType<typeof galacticStarClouds>|null=null;

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
  const g=c.getContext('2d')!,jd=julianDate(date),lst=siderealDegrees(jd);
  const pinpoints:{x:number;y:number;alpha:number;color:string;size:number}[]=[];
  // Fixed faint background stars in galactic coordinates, not enlarged glow dots.
  for(const {l,b,grain,cluster,ra,dec} of starClouds??=galacticStarClouds()){
    const eq=precess(ra,dec,jd),hor=horizon(eq.ra,eq.dec,lst);
    const xy=projectSky(hor.az,hor.alt,w,h,bearing);if(!xy||hor.alt<3)continue;
    const core=Math.exp(-Math.pow(Math.min(l,360-l)/32,2));
    // Broad star clouds broken by an uneven dark dust lane, not a flat stripe.
    const dust=.06+.94*(1-Math.exp(-Math.pow((b-1.8*Math.sin(l*.055)-.6*Math.sin(l*.23))/(1.1+.5*Math.sin(l*.13)**2),2)));
    const knots=.4+.6*Math.pow(Math.sin(l*.091)+.35*Math.sin(l*.27),2);
    const alpha=(.08+.12*grain)*(1+core*.8)*dust*knots*Math.min(1,hor.alt/12);
    const color=grain>.88?'244 225 212':core>.3?'223 205 239':grain<.3?'176 208 250':'213 229 255';
    g.fillStyle=`rgb(${color} / ${Math.min(.36,alpha).toFixed(3)})`;
    const x=xy.x/scale,y=xy.y/scale;
    // Only the low-frequency luminous cloud uses a broad footprint. The sharp
    // stellar layer below stays subpixel, avoiding the former blurry-dot look.
    g.fillRect(x-3,y-3,6,6);
    if(grain>(cluster?.18:.5))pinpoints.push({x,y,color,size:(cluster?.65:.5)+grain*.3,alpha:Math.min(.8,(.22+grain*.53)*dust*Math.min(1,hor.alt/12))});
  }
  // A subdued broad glow sits behind sharp one-pixel stars. Blur never touches
  // the stars themselves; both are baked once into the bounded minute cache.
  const soft=document.createElement('canvas');soft.width=c.width;soft.height=c.height;
  const sg=soft.getContext('2d')!;sg.filter='blur(4px)';sg.globalAlpha=.9;sg.drawImage(c,0,0);
  sg.filter='none';sg.globalAlpha=1;
  for(const p of pinpoints){sg.fillStyle=`rgb(${p.color} / ${p.alpha.toFixed(3)})`;sg.fillRect(p.x,p.y,p.size,p.size);}
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
