import{describe,it,expect}from'vitest';
import{createCompanionToys}from'@/lib/ui/viewer-companion/toys';
import type{Platform}from'@/lib/ui/viewer-companion/brain';
const bounds={width:1000,height:700};
const span=(id:string,x:number,width:number,y=682):Platform=>({id,x,y,width,kind:'floor'});
function settled(support=span('viewport-floor',20,400)){
 const model=createCompanionToys(()=>0);model.sync([support],bounds,0);const id=model.spawn({x:210,y:100},0)!;
 model.grab(id);model.drag(id,{x:210,y:600});model.drop(id,1,{x:0,y:0});for(let at=17;at<1800;at+=16)model.tick(at);
 expect(model.items()[0]).toMatchObject({id,x:210,y:682,platformId:support.id});return{model,id};
}
describe('viewport toy coordinates across scrolling safe-floor fragments',()=>{
 it('keeps screen x through repeated expansion and contraction of the same floor span',()=>{
  const{model,id}=settled();for(let i=0;i<12;i++){model.sync([span('viewport-floor',20,i%2?400:960)],bounds,2000+i);expect(model.items()[0]).toMatchObject({id,x:210,y:682,platformId:'viewport-floor'});}
 });
 it('follows the actual containing fragment when scroll renumbers intervals, including disappearance of its old id',()=>{
  const{model,id}=settled();model.sync([span('viewport-floor',500,480),span('viewport-floor-1',20,400)],bounds,2000);expect(model.items()[0]).toMatchObject({id,x:210,platformId:'viewport-floor-1'});
  model.sync([span('viewport-floor',20,960)],bounds,2100);expect(model.items()[0]).toMatchObject({id,x:210,platformId:'viewport-floor'});
 });
 it('uses only the closest safe landing when an obstacle or narrower viewport actually covers the old x',()=>{
  const{model,id}=settled();model.sync([span('viewport-floor',20,120),span('viewport-floor-1',300,680)],bounds,2000);expect(model.items()[0]).toMatchObject({id,x:131,platformId:'viewport-floor'});
  model.sync([span('viewport-floor',20,960,582)],{width:1000,height:600},2100);expect(model.items()[0]).toMatchObject({id,x:131,y:582});
  model.sync([span('viewport-floor',20,80,482)],{width:120,height:500},2200);expect(model.items()[0]).toMatchObject({id,x:91,y:482});
 });
 it('preserves the existing source-relative rule for home and calendar supports',()=>{
  for(const id of ['companion-home-floor-food','date-1-floor']){const{model}=settled(span(id,20,400));const before=model.items()[0];model.sync([span(id,100,600,500)],bounds,2000);expect(model.items()[0].x).toBeCloseTo(100+before.fraction!*600);expect(model.items()[0].y).toBe(500);}
 });
 it('does not rebind a toy held by the person during a geometry refresh',()=>{
  const{model,id}=settled();model.grab(id);model.drag(id,{x:250,y:300});model.sync([span('viewport-floor',20,960)],bounds,2000);expect(model.items()[0]).toMatchObject({id,x:250,y:300,held:true,platformId:undefined});
 });
});
