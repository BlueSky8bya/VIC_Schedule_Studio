import { COMPANION_PERSONALITY_SCENES, type SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { curiousTextureCellMatches } from "./companion-curious-completion-144";
import type { QaObservation } from "./companion-qa";
import { inspectTrace } from "../../../scripts/companion-qa/trace-checks.mjs";
import type { NumberedFloor157Admission } from "./companion-numbered-floor-157";

export type Daily157Prelude = { toyIds: string[]; foodIds: string[]; foodKinds?: string[]; box?: { x: number; y: number; width: number; height: number }; petted?: boolean; roomFloor?: NumberedFloor157Admission };
export type Daily157Witness = { id: string; serial: string; observer: "daily157-native-v1"; startedAt: number; finalBeat: number; finalBeatAt: number; subsequentAt: number; completedAt: number; nextState: string; preludes: string[] };
const source = (f: QaObservation) => f.visible && f.decoded && f.enabled === true && f.sourceClipMeasured === true
  && f.curiousCompletion.source === true && curiousTextureCellMatches(f.pose, f.curiousCompletion.cell);
const row = (f: QaObservation, rows: number[]) => rows.some(value => companionSpriteMetadata.rows[value]?.includes(f.pose));
const moving = (f: QaObservation) => source(f) && (f.state === "walk" && row(f, [2, 20]) || f.state === "jump" && row(f, [3, 4, 5, 6, 7]));
const outside = (f: QaObservation) => Boolean(f.platform && !/^companion-home(?:$|-)/.test(f.platform));
const distance = (a: QaObservation, b: QaObservation) => Math.hypot(a.x-b.x, a.y-b.y);
function pose(step: SceneBeat, f: QaObservation) {
  if (step.kind !== "pose" || !source(f)) return false;
  if (["look", "sniff", "stretch", "shake"].includes(step.pose)) return f.state === step.pose && row(f, ({ look: [1, 26], sniff: [1], stretch: [16], shake: [17] } as Record<string, number[]>)[step.pose]);
  return f.state === "play" && f.play === step.pose && COMPANION_PLAY_TIMING[step.pose as keyof typeof COMPANION_PLAY_TIMING].beats.some(beat => row(f, [beat.row]));
}
function duration(step: SceneBeat) {
  if (step.kind !== "pose") return 0;
  return ["look", "sniff", "stretch", "shake"].includes(step.pose) ? step.ms ?? 900 : companionPlayDuration(step.pose as keyof typeof COMPANION_PLAY_TIMING);
}
function finitePose(step: SceneBeat, frames: QaObservation[]) {
  const actual = frames.filter(f => pose(step, f));
  if (actual.length < 3 || new Set(actual.map(f => f.pose)).size < 2 || actual.at(-1)!.at-actual[0].at < duration(step)*.8-80) return false;
  return actual.slice(1).every((f, i) => f.at > actual[i].at && f.at-actual[i].at <= 180);
}
const toy = (f: QaObservation, id: string) => f.toyPlay?.toys.find(value => value.id === id);
/** Reuse the existing >=500ms body/pad/tool-relative-motion proof. A wash
 * label, source row or a brush being visible alone never admits aftercare. */
export const daily157WashPrelude = (frames: readonly QaObservation[]) => inspectTrace([...frames]).washProgressFrames > 0;
/** One contiguous decoded home sleep segment in the latest actual sleep
 * bout. Distinct owners, short historical naps, controls and observation
 * gaps cannot be accumulated into a fictitious three-second rest. */
export function daily157RestPrelude(frames: readonly QaObservation[]) {
  let wasSleeping=false,owner="",segment:QaObservation[]=[],latest:{start:number;end:number;owner:string}|undefined;
  for(const f of frames){
    if(f.state!=="sleep"){wasSleeping=false;segment=[];continue;}
    const current=JSON.stringify([f.scene,f.serial,f.beat,f.platform,f.humanEpoch,f.layoutEpoch]);
    if(!wasSleeping||current!==owner){owner=current;segment=[];latest=undefined;}
    wasSleeping=true;
    if(!source(f)||f.personality!=="homebody"||!f.scene||!f.serial||!/^companion-home(?:$|-)/.test(f.platform)
      ||f.owned||f.blocked||!row(f,[10,11,12,35,36,40])){segment=[];continue;}
    const previous=segment.at(-1);
    if(previous&&(f.at<=previous.at||f.at-previous.at>180))segment=[];
    segment.push(f);
    if(segment.length>=10&&f.at-segment[0].at>=3000)latest={start:segment[0].at,end:f.at,owner};
  }
  return Boolean(latest&&frames.at(-1)&&frames.at(-1)!.at-latest.end<=15000);
}
function actualReturns(frames: QaObservation[], initial: Daily157Prelude) {
  const box = initial.box; if (!box || !initial.toyIds.length) return false;
  return initial.toyIds.every(id => {
    const carried = frames.filter(f => source(f) && toy(f,id)?.carried && toy(f,id)?.visible && toy(f,id)?.decoded);
    const last = carried.at(-1), rect = last && toy(last,id)?.rect;
    return carried.length >= 2 && Boolean(last && rect && Math.hypot(rect.x+rect.width/2-box.x-box.width/2, rect.y+rect.height-box.y-box.height/2) < 25
      && frames.some(f => f.at > last.at && f.at-last.at <= 1000 && !toy(f,id)));
  });
}
/** Actual scene projections, decoded immutable cells and physical objects.
 * Source recipes and labels alone earn nothing. Preserve the complete raw
 * frames; a witness is one same-serial final+next sequence, not all outcomes. */
export function completedDailyIdeas157(frames: readonly QaObservation[], id: string, initial: Daily157Prelude): Daily157Witness[] {
  const recipe = COMPANION_PERSONALITY_SCENES.find(value => value.id === id);
  if (!recipe || !id.startsWith("D157-") || frames.length < 3) return [];
  const ordered = [...frames];
  if (ordered.some((f,i) => !Number.isFinite(f.at) || i>0 && f.at<=ordered[i-1].at)) return [];
  const serials = [...new Set(ordered.filter(f => f.scene===id && f.serial).map(f => f.serial))];
  for (const serial of serials) {
    const attempt = ordered.filter(f => f.scene===id && f.serial===serial), first = attempt[0];
    if (!first || attempt.some(f => f.personality!==recipe.personality)) continue;
    let last = -1, valid = true;
    for (let beat=0; beat<recipe.steps.length; beat++) {
      const step=recipe.steps[beat], actual=attempt.filter(f => Number(f.beat)===beat);
      if (actual.some(f => f.at<last)) { valid=false; break; }
      if (step.kind==="pose") {
        if (!finitePose(step,actual)) {valid=false;break;}
      } else if (step.kind==="go") {
        const previous=ordered.filter(f => f.at<=(actual[0]?.at??first.at) && source(f)).at(-1);
        const walks=actual.filter(moving);
        const placeOnly=step.target==="outside" && Boolean(previous&&outside(previous));
        const requiredDistance = id==="D157-M"&&step.target==="toy" ? 12 : 24;
        if (!placeOnly && (!previous || walks.length<2 || !walks.some(f=>distance(f,previous)>=requiredDistance))) {valid=false;break;}
        if (["D157-C","D157-S","D157-B"].includes(id)&&step.target==="local-floor") {
          const roomWalks=walks.filter(f=>/^companion-home-floor(?:-[1-9]\d*)?$/.test(f.platform)&&f.platform!=="companion-home-floor-400");
          if(!roomWalks.some((f,index)=>roomWalks.slice(0,index).some(start=>start.platform===f.platform&&distance(f,start)>=24))){valid=false;break;}
        }
        const arrival=attempt.find(f=>Number(f.beat)>beat&&source(f));
        if (step.target==="outside" && !actual.some(f=>source(f)&&outside(f)) && !(arrival&&outside(arrival)) && !placeOnly) {valid=false;break;}
      } else if (step.kind==="food") {
        if (step.mode==="inspect") { if (actual.filter(source).length<2) {valid=false;break;} }
        else if (step.mode==="eat") {
          const eating=actual.filter(f=>source(f)&&f.state==="eat"&&row(f,[1,9]));
          const after=ordered.filter(f=>f.at>(eating.at(-1)?.at??Infinity));
          if (eating.length<3 || !initial.foodIds.some(food=>eating.some(f=>f.items?.split("|")[0].split(",").includes(food)) && after.some(f=>!f.items?.split("|")[0].split(",").includes(food)))) {valid=false;break;}
        }
      } else if (step.kind==="toy" && step.mode==="nudge") {
        const one=initial.toyIds[0], before=ordered.find(f=>source(f)&&toy(f,one)?.visible), initialRect=before&&toy(before,one)?.rect;
        const physical=attempt.filter(f=>toy(f,one)?.visible && toy(f,one)?.decoded && !toy(f,one)?.held);
        if (initial.toyIds.length!==1 || !initialRect || !physical.some(f=>toy(f,one)?.falling)
          || !physical.some(f=>Math.hypot(toy(f,one)!.rect!.x-initialRect.x,toy(f,one)!.rect!.y-initialRect.y)>=12)) {valid=false;break;}
      }
      if (actual.length) last=actual.at(-1)!.at;
    }
    if (!valid) continue;
    const lastBeat=recipe.steps.length-1, terminal=attempt.filter(f=>Number(f.beat)===lastBeat&&source(f)), ended=terminal.at(-1);
    if (!ended) continue;
    const after=ordered.filter(f=>f.at>ended.at && f.scene!==id);
    const next=after.find((f,index)=>moving(f) && after.slice(0,index).some(previous=>source(previous)&&distance(f,previous)>=24));
    if (!next || next.at-ended.at>10000) continue;
    const preludes: string[]=[];
    if(initial.roomFloor)preludes.push(`measured-floor:${initial.roomFloor.admission}:${initial.roomFloor.platform}`);
    const before=ordered.filter(f=>f.at<first.at);
    if (id==="D157-P") {
      const firstPlace=attempt.filter(f=>Number(f.beat)===1&&source(f)&&outside(f)).at(-1)?.platform;
      const secondPlace=terminal[0]?.platform;
      if (!firstPlace||!secondPlace||firstPlace===secondPlace) continue;
    }
    if (id==="D157-A") {if(!initial.petted || !before.some(f=>source(f)&&["petted","play"].includes(f.state)))continue;preludes.push("actual-trusted-petting");}
    if (id==="D157-T") {if(initial.toyIds.length!==4||!actualReturns(before,initial)||!daily157WashPrelude(before))continue;preludes.push("same-four-actual-returns","actual-wash");}
    if (id==="D157-B") {if(!actualReturns(before,initial))continue;preludes.push("same-actual-return");}
    if (id==="D157-H") {if(!daily157RestPrelude(before))continue;preludes.push("one-contiguous-home-rest-before-floor-work");}
    const food=initial.foodIds[0];
    if (id==="D157-G" && food) {
      const reaction=ordered.filter(f=>source(f)&&f.at>=first.at&&f.at<ended.at&&f.foodAftertaste&&row(f,[23]));
      if (initial.foodKinds?.some(kind=>["cricket-pepero","blue-marshmallow-tteokguk","herb-avocado-milk","mint-choco-brisket-stew","durian"].includes(kind))
        && (reaction.length<3||reaction.at(-1)!.at-reaction[0].at<1200)) continue;
      if(reaction.length)preludes.push(`actual-finite-aftertaste:${reaction[0].foodAftertaste}`);
    }
    return [{id,serial,observer:"daily157-native-v1",startedAt:first.at,finalBeat:lastBeat,finalBeatAt:terminal[0].at,subsequentAt:next.at,completedAt:ended.at,nextState:next.state,preludes}];
  }
  return [];
}
