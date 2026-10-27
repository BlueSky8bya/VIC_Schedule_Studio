import { expect, it } from 'vitest';
import { rememberCustomColor } from '@/lib/broadcast/recent-colors';
import { mouseInkCursor, mousePenFootprint } from '@/lib/broadcast/mouse-cursor';
it('retains five exact confirmed colors, promotes duplicates and rejects non-colors',()=>{
 let colors:string[]=[];
 for(const color of ['#23695f','#c56885','#112233','#223344','#334455','#445566'])colors=rememberCustomColor(colors,color);
 expect(colors).toEqual(['#445566','#334455','#223344','#112233','#c56885']);
 expect(rememberCustomColor(colors,'#C56885')).toEqual(['#c56885','#445566','#334455','#223344','#112233']);
 expect(rememberCustomColor(colors,'url(secret)')).toEqual(colors);
});
it('native cursor follows actual ink diameter, bounds its image and keeps the hotspot at the footprint center',()=>{
 for(const pressure of [0.3,0.8,1])expect(Math.abs(mousePenFootprint(18,pressure)-18*(0.45+pressure*0.85))).toBeLessThanOrEqual(.125);
 for(const width of [2,18,63,96]){
   const cursor=mouseInkCursor('pen',width,'#c56885');
   const svg=decodeURIComponent(cursor.split('data:image/svg+xml,')[1].split('")')[0]);
   const center=Math.max(22,Math.ceil(width/2)+2);
   expect(svg).toContain(`r='${width/2}'`);expect(svg).toContain(`cx='${center}' cy='${center}'`);
   expect(cursor).toContain(`") ${center} ${center}, crosshair`);expect(center*2).toBeLessThanOrEqual(128);
 }
 expect(mouseInkCursor('hl',63,'#ffffff')).not.toBe(mouseInkCursor('pen',18,'#ffffff'));
 expect(mouseInkCursor('pen',NaN,'url(secret)')).not.toContain('secret');
});
