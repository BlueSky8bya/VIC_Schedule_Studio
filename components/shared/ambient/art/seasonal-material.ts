import { softBlob } from '../scenes/util';
import { dryGrassPath, paintDryGrassDetail } from './winter-grass';

/** Rounded petals have no stem, midrib or pointed attachment. Winter is a
 * narrow curled blade of dry grass, with the same 30px source radius as leaves. */
export function seasonalMaterialPath(g:CanvasRenderingContext2D,r:number,variant:number,winter:boolean){
 g.beginPath();
 if(winter){
  dryGrassPath(g,r,variant);return;
 }
 const shapes=[
  [-.7,-.45,.85,.75],[-.85,-.55,.65,.60],[-.65,-.8,.72,.85],[-.52,-.82,.52,.82],[-.9,-.4,.85,.55],[-.7,-.65,.8,.7],[-.68,-.52,.6,.72]
 ];
 const [left,top,right,bottom]=shapes[variant%7];
 g.moveTo(-r*.18,r*bottom);
 g.bezierCurveTo(r*left,r*bottom,r*(left-.15),r*(top+.18),r*left*.55,r*top);
 if(variant%3===0){
  g.quadraticCurveTo(-r*.12,r*(top-.15),0,r*(top+.08));
  g.quadraticCurveTo(r*.16,r*(top-.16),r*right*.55,r*top);
 }else g.bezierCurveTo(-r*.1,r*(top-.25),r*.35,r*(top-.14),r*right*.6,r*top);
 g.bezierCurveTo(r*(right+.15),r*(top+.18),r*right,r*(bottom+.15),r*.15,r*bottom);
 g.quadraticCurveTo(0,r*(bottom+.05),-r*.18,r*bottom);g.closePath();
}
export function paintSeasonalMaterial(g:CanvasRenderingContext2D,r:number,variant:number,color:string,winter:boolean){
 seasonalMaterialPath(g,r,variant,winter);g.fillStyle=color;g.fill();g.save();g.clip();
 const light=g.createLinearGradient(-r,-r,r,r);
 light.addColorStop(0,'rgba(255,247,219,.60)');light.addColorStop(.45,'rgba(255,240,221,.08)');
 light.addColorStop(1,winter?'rgba(92,69,41,.32)':'rgba(129,65,86,.24)');
 g.fillStyle=light;g.fillRect(-r*1.2,-r*1.2,r*2.4,r*2.4);
 if(winter){
  paintDryGrassDetail(g,r,variant);
 }else{
  // Soft bowl-shaped translucency, never a leaf-like central fold/vein.
  softBlob(g,r*.22,r*.18,r*.42,'139 66 93',.13);
  softBlob(g,-r*.38,-r*.25,r*.35,'255 242 220',.38);
 }
 g.restore();
}
