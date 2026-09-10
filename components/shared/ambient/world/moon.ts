// Adapted from SunCalc 1.9.0 (c) Vladimir Agafonkin, BSD-2-Clause.
// See docs/ambient/SUNCALC_LICENSE.txt and ROUND-24 for accuracy evidence.
import { horizon, julianDate, siderealDegrees, type SkyDate } from './celestial';
const rad = Math.PI / 180;
const e = 23.4397 * rad;
const ra = (l:number,b:number)=>Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));
const dec = (l:number,b:number)=>Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));

/** Geocentric illuminated phase, including the viewed date's fractional KST
 * hour. An astronomical approximation, not a Korean lunar-calendar converter. */
export function moonPhase(y:number,m:number,d:number,hour=12):number {
  const days=(Date.UTC(y,m-1,d)+(hour-9)*3600000)/86400000+2440587.5-2451545;
  const M=rad*(357.5291+.98560028*days);
  const sl=M+rad*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M))+rad*102.9372+Math.PI;
  const L=rad*(218.316+13.176396*days), mm=rad*(134.963+13.064993*days), F=rad*(93.272+13.229350*days);
  const ml=L+rad*6.289*Math.sin(mm),mb=rad*5.128*Math.sin(F),distance=385001-20905*Math.cos(mm);
  const sr=ra(sl,0),sd=dec(sl,0),mr=ra(ml,mb),md=dec(ml,mb);
  const phi=Math.acos(Math.max(-1,Math.min(1,Math.sin(sd)*Math.sin(md)+Math.cos(sd)*Math.cos(md)*Math.cos(sr-mr))));
  const inc=Math.atan2(149598000*Math.sin(phi),distance-149598000*Math.cos(phi));
  const angle=Math.atan2(Math.cos(sd)*Math.sin(sr-mr),Math.sin(sd)*Math.cos(md)-Math.cos(sd)*Math.sin(md)*Math.cos(sr-mr));
  return .5+.5*inc*(angle<0?-1:1)/Math.PI;
}

export const moonLit=(phase:number)=>(1-Math.cos(phase*Math.PI*2))/2;

/** Same low-order lunar coordinates as the illumination model. Geocentric,
 * no refraction/parallax correction; sufficient for the panoramic background. */
export function moonPosition(date:SkyDate) {
  const jd=julianDate(date),days=jd-2451545;
  const L=rad*(218.316+13.176396*days),M=rad*(134.963+13.064993*days),F=rad*(93.272+13.229350*days);
  const l=L+rad*6.289*Math.sin(M),b=rad*5.128*Math.sin(F);
  return horizon(ra(l,b)/rad,dec(l,b)/rad,siderealDegrees(jd));
}

/** Unit sphere lit from the right while waxing and left while waning. */
export function moonPixelLit(x:number,y:number,phase:number):boolean {
  const z2=1-x*x-y*y;
  return z2>=0 && x*Math.sin(phase*Math.PI*2)-Math.sqrt(z2)*Math.cos(phase*Math.PI*2)>0;
}
