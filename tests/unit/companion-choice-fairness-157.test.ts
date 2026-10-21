import { describe,expect,it } from "vitest";
import { createBrain,type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector,type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES,type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const floor:Platform={id:"companion-home-floor",x:0,y:600,width:700,kind:"floor",manualOnly:true};
const care=COMPANION_PERSONALITY_SCENES.find(recipe=>recipe.id==="C07")!;
const leisure:PersonalitySceneRecipe[]=["sniff","stretch","shake"].map((pose,i)=>({id:`major-leisure-${i}`,label:"finite model walk",personality:"curious",major:true,triggers:["free"],steps:[{kind:"go",target:"local-floor"},{kind:"pose",pose:pose as "sniff"|"stretch"|"shake"}]}));
function simulate(condition="available"){
  const s:PersonalitySceneInput={world:{x:100,y:600,platformId:floor.id,platforms:[floor],width:1100,height:720,animated:true,foods:[]},
    brain:{...createBrain(0,()=>.5),hunger:.05,energy:.95},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:"curious",feeding:false},now:0,
    toys:[{id:"same-kaleidoscope",kind:"kaleidoscope",x:260,y:600,platformId:floor.id,held:false,carried:false,angle:0}],
    home:{box:{x:400,y:600,platformId:floor.id}},tv:"off"};
  if(condition==="absent")s.toys=[];
  if(condition==="held")s.toys=[{...s.toys[0],held:true}];
  if(condition==="unreachable")s.home.box={x:950,y:20,platformId:"missing"};
  const d=createCompanionPersonalityDirector([...leisure,care]),owners:string[]=[],effects:string[]=[];
  for(let tick=0;tick<90;tick++){
    const p=d.next(s);if(!p){s.now+=100;continue;}
    if(!p.meta.id.startsWith("entry-")&&owners.at(-1)!==`${p.meta.id}:${p.meta.serial}`)owners.push(`${p.meta.id}:${p.meta.serial}`);
    if(p.meta.id==="C07")return {owners,proposal:p,effects};
    if(!p.action)throw Error("A leisure model must offer its actual finite route or pose");
    s.now+=p.action.duration;
    if(["walk","jump"].includes(p.action.kind)){
      const target=p.action.target;expect(target.platformId).toBe(floor.id);expect(target.y).toBe(floor.y);
      expect(target.x).toBeGreaterThanOrEqual(floor.x);expect(target.x).toBeLessThanOrEqual(floor.x+floor.width);
      s.world={...s.world,...target};d.observeProgress({now:s.now,active:true,point:s.world});effects.push("actual-model-route");
    }
    d.complete(p.meta);s.now+=100;
  }
  return {owners,proposal:undefined,effects};
}
describe("157 feasible physical return gets a turn before repeated major leisure",()=>{
  it("selects the actual source C07 within three unowned opportunities, without any invented completion",()=>{
    const result=simulate();expect(result.proposal?.meta.id).toBe("C07");expect(result.owners.length).toBeLessThanOrEqual(3);
    expect(result.effects.length).toBeGreaterThan(0);expect(result.proposal?.meta.itemId).toBe("same-kaleidoscope");
  });
  it.each(["absent","held","unreachable"])("never forces an %s object into a fairness turn",condition=>{
    expect(simulate(condition).proposal).toBeUndefined();
  });
});
