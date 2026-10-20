import { platformLandingX, type CompanionRouteStep, type CompanionWorld, type Platform } from "./brain";
import { companionOutsidePlatforms } from "./life-space";
import { findCompanionToyRoute } from "./toys";

type Point = {x:number;y:number;platformId?:string};
export type CompanionOutsideGoal = {id:string;fraction:number};
export type CompanionOutsidePlan = {target:Point & {platformId:string};goal:CompanionOutsideGoal;route:CompanionRouteStep[]};
/** Anonymous finite route facts only. No calendar/event/account identity or clock. */
export type CompanionOutsideDiagnostic = {
  stage:"candidate"|"proof"|"go"|"outside-unavailable"|"routine-admitted"|"routine-finished";
  candidates?:readonly CompanionOutsideDiagnostic[];returnRouteLength?:number|null;
  outcome?:boolean;beat?:number;reason?:"completed"|"cancelled"|"progress-timeout"|"duration-timeout"|"outside-unavailable";
  ordinal?:number;sourceKind?:Platform["kind"];targetKind?:Platform["kind"];
  source?:{x:number;y:number;width:number;manual:boolean;body:boolean};
  target?:{x:number;y:number;width:number;manual:boolean;body:boolean};
  from?:{x:number;y:number};point?:{x:number;y:number};routeLength?:number|null;firstKind?:"walk"|"jump";firstPoint?:{x:number;y:number};
  plannedGoal?:boolean;
};
export type CompanionOutsideObserver = (fact:CompanionOutsideDiagnostic)=>void;
/** Optional synthetic QA sink; default callers have no logging or side effects.
 * Sharing one returned observer across controllers keeps the whole session24.
 * A diagnostic sink cannot change a route or reject an otherwise valid action. */
export function boundedCompanionOutsideObserver(sink?:CompanionOutsideObserver):CompanionOutsideObserver|undefined {
  if(!sink)return;
  let left=24;
  return fact=>{if(left<=0)return;left--;try{sink(fact);}catch{/* Diagnostics never own behavior. */}};
}
export function companionOutsideRouteFact(stage:CompanionOutsideDiagnostic["stage"],world:CompanionWorld,target:Point|undefined,route:readonly CompanionRouteStep[]|null|undefined,ordinal?:number):CompanionOutsideDiagnostic {
  const source=world.platforms.find(plane=>plane.id===world.platformId),destination=world.platforms.find(plane=>plane.id===target?.platformId);
  const anonymous=(plane:Platform|undefined)=>plane&&[plane.x,plane.y,plane.width].every(Number.isFinite)?{x:plane.x,y:plane.y,width:plane.width,manual:Boolean(plane.manualOnly),body:Boolean(plane.bodyOnly)}:undefined;
  return {stage,ordinal,sourceKind:source?.kind,targetKind:destination?.kind,source:anonymous(source),target:anonymous(destination),
    from:[world.x,world.y].every(Number.isFinite)?{x:world.x,y:world.y}:undefined,firstPoint:route?.[0]?{x:route[0].target.x,y:route[0].target.y}:undefined,
    point:target&&[target.x,target.y].every(Number.isFinite)?{x:target.x,y:target.y}:undefined,
    routeLength:route===undefined?undefined:route===null?null:route.length,firstKind:route?.[0]?.kind};
}
/** Same bounded candidate policy and actual route used by authored outside go.
 * The normal route is proved once before optional room controls begin. */
export function planCompanionOutsideRoute(world:CompanionWorld,allowJump:boolean,visited:readonly string[]=[],options:{pointer?:boolean;returnTo?:Point;observe?:CompanionOutsideObserver}={}):CompanionOutsidePlan|undefined {
  const candidates=companionOutsidePlatforms(world,options.pointer?[]:visited,options.pointer?world.pointer:undefined,Boolean(options.pointer));
  const facts:CompanionOutsideDiagnostic[]|undefined=options.observe?[]:undefined;
  const publish=(plan:CompanionOutsidePlan|undefined)=>{if(options.observe)try{options.observe({stage:"proof",candidates:facts,routeLength:plan?.route.length??null,plannedGoal:Boolean(plan)});}catch{/* A read-only sink cannot own behavior. */}};
  for(let ordinal=0;ordinal<candidates.length;ordinal++) {
    const plane=candidates[ordinal],target={x:platformLandingX(plane,options.pointer&&world.pointer?world.pointer.x:plane.x+plane.width/2),y:plane.y,platformId:plane.id};
    const route=findCompanionToyRoute(world,target,world.platforms,allowJump,Boolean(options.returnTo));
    const back=route&&options.returnTo?findCompanionToyRoute(target,options.returnTo,world.platforms,allowJump,true):undefined;
    facts?.push({...companionOutsideRouteFact("candidate",world,target,route,ordinal),...(options.returnTo?{returnRouteLength:back?.length??null}:{})});
    if(route && (!options.returnTo||back)) {
      const plan={target,route,goal:{id:plane.id,fraction:(target.x-plane.x)/plane.width}};publish(plan);return plan;
    }
  }
  publish(undefined);
}
