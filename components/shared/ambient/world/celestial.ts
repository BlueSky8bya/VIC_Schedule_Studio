import { SITE } from './sun';

const R = Math.PI / 180;
const wrap = (x: number) => ((x % 360) + 360) % 360;
export const SKY_BEARINGS = { north: 0, east: 90, south: 180, west: 270 } as const;
export type SkyBearing = keyof typeof SKY_BEARINGS;
export const DEFAULT_SKY_BEARING: SkyBearing = 'south';
export type SkyDate = { y: number; m: number; d: number; hour: number };
export function julianDate(d: SkyDate) {
  return (Date.UTC(d.y, d.m - 1, d.d) + (d.hour - SITE.tz) * 3600000) / 86400000 + 2440587.5;
}

/** USNO approximate GMST, using UTC as UT1 (subsecond distinction omitted). */
export function siderealDegrees(jd: number) {
  const jd0 = Math.floor(jd - .5) + .5, days = jd0 - 2451545;
  const hours = (jd - jd0) * 24, centuries = (jd - 2451545) / 36525;
  return wrap(15 * (6.697375 + .065709824279 * days + 1.0027379 * hours + .0000258 * centuries * centuries) + SITE.lon);
}

/** J2000 → mean equator of date. IAU 1976 polynomials adapted from ERFA
 * prec76 (NumFOCUS, BSD-3-Clause); public/ambient/licenses/erfa.txt. */
export function precess(ra: number, dec: number, jd: number) {
  const t = (jd - 2451545) / 36525, sec = R / 3600;
  const zeta = (2306.2181 * t + .30188 * t*t + .017998 * t*t*t) * sec;
  const z = (2306.2181 * t + 1.09468 * t*t + .018203 * t*t*t) * sec;
  const theta = (2004.3109 * t - .42665 * t*t - .041833 * t*t*t) * sec;
  const a = ra * R + zeta, d = dec * R;
  const A = Math.cos(d) * Math.sin(a);
  const B = Math.cos(theta) * Math.cos(d) * Math.cos(a) - Math.sin(theta) * Math.sin(d);
  const C = Math.sin(theta) * Math.cos(d) * Math.cos(a) + Math.cos(theta) * Math.sin(d);
  return { ra: wrap((Math.atan2(A, B) + z) / R), dec: Math.asin(Math.max(-1, Math.min(1, C))) / R };
}

/** USNO equatorial → horizon; azimuth clockwise from true north. */
export function horizon(ra: number, dec: number, lst: number) {
  const H = (lst - ra) * R, d = dec * R, lat = SITE.lat * R;
  const alt = Math.asin(Math.max(-1, Math.min(1, Math.cos(H)*Math.cos(d)*Math.cos(lat) + Math.sin(d)*Math.sin(lat)))) / R;
  const az = wrap(Math.atan2(-Math.sin(H)*Math.cos(d), Math.sin(d)*Math.cos(lat)-Math.cos(d)*Math.sin(lat)*Math.cos(H)) / R);
  return { alt, az };
}

/** Panoramic angular window. Wide screens reveal more azimuth, never stretch
 * point sprites. Vertical span keeps the existing sky/ground composition. */
export function projectSky(az: number, alt: number, w: number, h: number, bearing: SkyBearing = DEFAULT_SKY_BEARING) {
  const span = Math.max(80, Math.min(220, 160 * (w / Math.max(1,h)) / (1400/270)));
  const delta = ((az - SKY_BEARINGS[bearing] + 540) % 360) - 180;
  if (alt < 0 || alt > 90 || Math.abs(delta) > span / 2) return null;
  return { x: w * (.5 + delta/span), y: (h - 8) * (1-alt/90) + 4 };
}

/** Standard ICRS→Galactic matrix, transposed for galactic to equatorial.
 * Galactic equator is the physical Milky Way plane, not a seasonal screen tilt. */
export function galacticEquatorial(l: number, b: number) {
  const x=Math.cos(b*R)*Math.cos(l*R), y=Math.cos(b*R)*Math.sin(l*R), z=Math.sin(b*R);
  const X=-.0548755604*x+.4941094279*y-.867666149*z;
  const Y=-.8734370902*x-.44482963*y-.1980763734*z;
  const Z=-.4838350155*x+.7469822445*y+.4559837762*z;
  return {ra:wrap(Math.atan2(Y,X)/R),dec:Math.asin(Z)/R};
}

/** B–V tint kept deliberately subtle, especially for faint naked-eye stars. */
export function starColor(bv: number | null) {
  if (bv === null) return '238 241 247';
  if (bv < .0) return '192 215 255';
  if (bv < .35) return '221 234 255';
  if (bv < .8) return '250 245 224';
  if (bv < 1.3) return '255 224 187';
  return '255 198 169';
}
