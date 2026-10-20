import { platformLandingX, type CompanionAction, type CompanionBrain, type CompanionWorld } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { companionPrivateHomeSupport, companionOutsideSupport } from "./life-space";
import { planCompanionOutsideRoute, type CompanionOutsideGoal } from "./outside-route";
import { findCompanionToyRoute } from "./toys";

type Point = {x:number;y:number;platformId?:string};
type Input = {world:CompanionWorld;brain:CompanionBrain;preferences:CompanionPreferences;now:number;owned?:boolean};
/** A real departure opens a short public-life episode. It carries the next
 * destination across decisions; a proposed hop never counts as an arrival.
 * This prevents a completed outing immediately resetting to a sofa script.
 * No new clock, saved preference, object mutation or expression loop. */
export function createCompanionPublicLife() {
  let selected:CompanionPreferences["personality"]|undefined;
  let outing:{at:number;minimumMs:number;stops:number;wantedStops:number;arrivals:number;visited:string[];goal?:CompanionOutsideGoal;localX?:number}|undefined;
  const reset=(personality:CompanionPreferences["personality"])=>{if(selected!==personality){selected=personality;outing=undefined;}};
  return {
    /** The renderer calls only after an accepted active, supported movement.
     * Direct placement, scrolling and a planned endpoint never enter here. */
    arrive(action:CompanionAction,from:Point,input:Input) {
      const {world,preferences:p,now}=input;reset(p.personality);
      const plane=world.platforms.find(value=>value.id===world.platformId);
      if (!p.enabled || !p.roam || !world.animated || world.paused || !Number.isFinite(now)
        || !["walk","jump"].includes(action.kind) || !plane || !companionOutsideSupport(plane)
        || ![world.x,world.y,from.x,from.y].every(Number.isFinite) || Math.abs(world.y-plane.y)>2
        || world.x<plane.x || world.x>plane.x+plane.width || world.platformId!==action.target.platformId
        || Math.hypot(world.x-action.target.x,world.y-action.target.y)>2 || Math.hypot(world.x-from.x,world.y-from.y)<24) return;
      if (companionPrivateHomeSupport(from.platformId)) {
        // Curiosity changes how long and how many places this particular
        // outing interests the pet. This starts from a real departure, not
        // a periodic timer that orders every personality to demonstrate a run.
        const curiosity=Math.max(0,Math.min(1,input.brain.curiosity));
        const sleepy=p.personality==="sleepy";
        outing=p.personality==="homebody"||sleepy&&input.brain.energy<.62?undefined:{at:now,
          minimumMs:sleepy?5000+curiosity*3000:9000+curiosity*5000,
          stops:0,wantedStops:sleepy?1:p.personality==="curious"&&curiosity>.5?3:2,arrivals:0,visited:[plane.id]};
      } else if (outing) {
        outing.arrivals++;outing.visited=[...outing.visited.filter(id=>id!==plane.id),plane.id].slice(-8);
        if (outing.goal?.id===plane.id) {
          const x=outing.localX??platformLandingX(plane,plane.x+plane.width*outing.goal.fraction);
          if (Math.abs(world.x-x)<=2) {outing.stops++;outing.goal=undefined;outing.localX=undefined;}
        }
      }
    },
    next(input:Input):CompanionAction|undefined {
      const {world,brain,preferences:p,now}=input;reset(p.personality);
      if (!outing) return;
      if (companionPrivateHomeSupport(world.platformId)) {outing=undefined;return;}
      if (!Number.isFinite(now) || now<outing.at || now-outing.at>=24000
        || now-outing.at>=outing.minimumMs && outing.stops>=outing.wantedStops) {outing=undefined;return;}
      // A meal, rest, direct interaction and an existing physical owner can
      // interrupt freely. The episode does not cancel or forge those ACKs.
      if (input.owned || !p.enabled || !p.roam || !world.animated || world.paused
        || brain.hunger>=.65 || brain.energy<=.32 || brain.foodGoal
        || brain.intention && brain.intention.kind!=="explore" || brain.episode) return;
      const here=world.platforms.find(plane=>plane.id===world.platformId);
      if (!here || !companionOutsideSupport(here) || Math.abs(world.y-here.y)>2 || world.x<here.x || world.x>here.x+here.width) return;
      let target:Point|undefined;
      if (outing.goal) {
        const plane=world.platforms.find(value=>value.id===outing!.goal!.id);
        if (plane && companionOutsideSupport(plane)) target={x:outing.localX??platformLandingX(plane,plane.x+plane.width*outing.goal.fraction),y:plane.y,platformId:plane.id};
      }
      if (!target) {
        const social=(p.personality==="affectionate"||p.personality==="performer") && p.petting
          && (world.pointer?.stableMs??0)>=500 && (brain.affect?.frustration??0)<.62;
        const plan=planCompanionOutsideRoute(world,p.jump,outing.visited,{pointer:social});
        // Reaching the person is a meaningful alternative to more exploring.
        // Yield at this real public place so the normal social director can
        // offer its finite personal response without returning to the sofa.
        if (social && plan && !plan.route.length) {outing=undefined;return;}
        if (plan) {target=plan.target;outing.goal=plan.goal;outing.localX=undefined;}
      }
      if (!target) {
        // A calendar with one broad safe ledge still permits a real local
        // walk; no inaccessible card or synthetic landing is manufactured.
        const direction=brain.heading??1;
        const x=[direction*120,-direction*120].map(dx=>platformLandingX(here,world.x+dx)).find(x=>Math.abs(x-world.x)>=48);
        if (x===undefined) return;
        target={x,y:here.y,platformId:here.id};outing.goal={id:here.id,fraction:(x-here.x)/here.width};outing.localX=x;
      }
      const route=findCompanionToyRoute(world,target,world.platforms,p.jump),step=route?.[0];
      if (!step) {outing.goal=undefined;outing.localX=undefined;return;}
      const profile=getCompanionBehaviorProfile(p,brain.habits);
      // Actual destination changes and energy, rather than a pose timer,
      // give the walk/run rhythm. Platform transfers retain their real jump.
      const brisk=p.personality!=="sleepy" && brain.energy>.55 && (brain.affect?.frustration??0)<.62
        && (p.personality==="mischievous" || p.personality==="curious" || outing.arrivals%3!==1);
      return {...step,pace:brisk?"scoot":"amble",direction:step.target.x<world.x?-1:1,
        duration:step.kind==="jump"?900:Math.max(300,Math.abs(step.target.x-world.x)/profile.walkSpeed*1000)};
    },
  };
}
