import type { CompanionAction, CompanionPlay, CompanionWorld, Platform } from "./brain";
import type { CompanionPersonality } from "./preferences";
import { companionPlayDuration } from "./timing";

/** Place policy only. Routes, physical ownership and permissions stay with the
 * existing caller. No DOM, preference, identity, timer or learned state. */
export const companionPrivateHomeSupport = (id?: string) => /^companion-home(?:$|-)/.test(id ?? "");
export function companionOutsideSupport(plane: Platform) {
  return !companionPrivateHomeSupport(plane.id) && !plane.manualOnly && !plane.bodyOnly
    && !["control", "hide"].includes(plane.kind)
    && [plane.x, plane.y, plane.width, plane.x+plane.width].every(Number.isFinite) && plane.width > 0;
}
export function companionOutsidePlatforms(world: CompanionWorld, visited: readonly string[] = [], point?: {x:number;y:number}, includeCurrent=false) {
  const origin=point && [point.x,point.y].every(Number.isFinite) ? point : world;
  return world.platforms.slice(0,200).filter(plane => companionOutsideSupport(plane) && (includeCurrent || plane.id !== world.platformId))
    .sort((a,b) => Number(visited.includes(a.id))-Number(visited.includes(b.id))
      || Math.hypot(a.x+a.width/2-origin.x,a.y-origin.y)-Math.hypot(b.x+b.width/2-origin.x,b.y-origin.y)).slice(0,8);
}
export function companionAudienceAtOutside(world: CompanionWorld) {
  const plane=world.platforms.find(plane => plane.id===world.platformId);
  return Boolean(plane && !companionPrivateHomeSupport(plane.id) && !plane.bodyOnly && !["control","hide"].includes(plane.kind)
    && [world.x,world.y,plane.x,plane.y,plane.width].every(Number.isFinite) && plane.width>0
    && Math.abs(world.y-plane.y)<=2 && world.x>=plane.x && world.x<=plane.x+plane.width);
}
/** Actual outside object source. Explicit item routes may separately use a
 * user-placed ledge; this does not admit that ledge to aimless roaming. */
export function companionOutsideItem(world: CompanionWorld, point: {x:number;y:number;platformId?:string}) {
  const plane=world.platforms.find(plane=>plane.id===point.platformId);
  return Boolean(plane && !companionPrivateHomeSupport(plane.id) && !plane.bodyOnly && !["control","hide"].includes(plane.kind)
    && [point.x,point.y,plane.x,plane.y,plane.width].every(Number.isFinite) && plane.width>0
    && Math.abs(point.y-plane.y)<=2 && point.x>=plane.x && point.x<=plane.x+plane.width);
}
export const companionAudiencePlay = (play?: string) => play === "cheer-rehearsal" || play === "ask-petting" || play === "lean-nuzzle";
export const companionMayAddressAudience = (world: CompanionWorld, directPet=false) => directPet || companionAudienceAtOutside(world);

/** Immediate personal preparation, not a fictitious audience performance.
 * Stretch/sniff are real action kinds, never cast to CompanionPlay. */
export type CompanionEntryPreparation = CompanionAction & ({kind:"play";play:CompanionPlay}|{kind:"sniff"|"stretch"});
export function companionEntryPreparation(personality: CompanionPersonality, world: CompanionWorld, jump: boolean, sleep=false): CompanionEntryPreparation {
  const target={x:world.x,y:world.y,platformId:world.platformId};
  if (sleep && (personality==="sleepy" || personality==="homebody")) return {kind:"play",play:"cozy-nest",target,duration:companionPlayDuration("cozy-nest")};
  if (!sleep && personality==="sleepy") return {kind:"stretch",target,duration:900};
  if (!sleep && personality==="homebody") return {kind:"play",play:"groom",target,duration:companionPlayDuration("groom")};
  if (personality==="tidy" || personality==="affectionate") return {kind:"play",play:"groom",target,duration:companionPlayDuration("groom")};
  if (personality==="mischievous" && jump) return {kind:"play",play:"pounce",target,duration:companionPlayDuration("pounce")};
  const kind=personality==="curious" || personality==="gourmet" || personality==="mischievous" ? "sniff" : "stretch";
  return {kind,target,duration:900};
}
