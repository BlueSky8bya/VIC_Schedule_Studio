import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import type { QaFrame, QaMeasuredRect } from "../../../scripts/companion-qa/trace-checks.mjs";

export const CURIOUS_COMPLETION_SCOPE = Object.freeze({
  supported: ["D143-C"],
  unsupported: ["D143-P","D143-A","D143-S","D143-T","D143-M","D143-G","D143-H","D143-B"],
  limitation: "Only measured C outside/sniff/outside/stretch attempts are supported. Other ideas remain deferred; registration/model passing is separate from native completion. Public DOM guards are observed projections, not private brain access.",
});
export type CuriousTextureCellMeasurement = {
  currentPath: string | null; connectedToSprite: boolean;
  naturalWidth: number; naturalHeight: number;
  textureWidth: number; textureHeight: number; spriteWidth: number; spriteHeight: number;
  textureLeft: number; textureTop: number;
  textureMatrix: number[] | null; spriteMatrix: number[] | null;
  spriteClipPath: string; textureClipPath: string;
};
export type CuriousCompletionSnapshot = {
  version: 2; source: boolean; body: QaMeasuredRect | null;
  cell: CuriousTextureCellMeasurement | null;
  day: { rect: QaMeasuredRect; footY: number } | null;
  guards: {
    preferencesObserved: boolean; jumpAllowed: boolean;
    foodGoalAbsent: boolean; feedIntentAbsent: boolean; episodeInactive: boolean; handsFree: boolean;
  };
};
export type CuriousCompletionFrame = QaFrame & {
  scene: string; beat: string; platform: string; pose: number; play: string;
  curiousCompletion?: CuriousCompletionSnapshot;
};
export type CuriousCompletionWitness = {
  id: "D143-C"; major: false; observer: "curious-native-v3";
  startedAt: number; finalBeat: 3; finalBeatAt: number; subsequentAt: number; completedAt: number;
  arrivals: [{platform:string;at:number},{platform:string;at:number}];
};
const rect = (r:QaMeasuredRect|null|undefined):r is QaMeasuredRect => Boolean(r && [r.x,r.y,r.width,r.height].every(Number.isFinite) && r.width>0 && r.height>0);
const distance = (a:CuriousCompletionFrame,b:CuriousCompletionFrame) => Math.hypot(a.x-b.x,a.y-b.y);
const sameRect = (a:QaMeasuredRect,b:QaMeasuredRect) => (Object.keys(a) as (keyof QaMeasuredRect)[]).every(key=>Math.abs(a[key]-b[key])<=1);
const close = (a:number,b:number,tolerance=.05) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<=tolerance;
function translation(matrix:number[]|null|undefined,x:number,y:number) {
  // DOMMatrix column-major local CSS coordinates. Ancestor scales/bounding
  // boxes do not enter this calculation; the renderer uses pure translations.
  return Array.isArray(matrix) && matrix.length===16 && Array.from({length:16},(_,i)=>matrix[i]).every(Number.isFinite) && matrix.every((value,i)=>{
    const expected=i===12?x:i===13?y:[0,5,10,15].includes(i)?1:0;
    return close(value,expected,(i===12||i===13) ? .05 : .000001);
  });
}
function clipValues(value:string) {
  const inner=/^inset\(([^)]+)\)$/.exec(value)?.[1].trim().split(/\s+/);
  if(!inner || inner.length<1 || inner.length>4 || !inner.every(token=>/^-?\d*\.?\d+%$/.test(token)))return;
  const numbers=inner.map(Number.parseFloat);
  if(!numbers.every(Number.isFinite))return;
  return numbers.length===1?[numbers[0],numbers[0],numbers[0],numbers[0]]:numbers.length===2?[numbers[0],numbers[1],numbers[0],numbers[1]]
    :numbers.length===3?[numbers[0],numbers[1],numbers[2],numbers[1]]:numbers;
}
/** Verify raw computed local CSS measurements against metadata independently.
 * Canvas/data-pose/source URI alone never authenticate the painted cell. */
export function curiousTextureCellMatches(pose:number,cell:CuriousTextureCellMeasurement|null|undefined) {
  const frame=Number.isInteger(pose)&&pose>=0?companionSpriteMetadata.frames[pose]:undefined;
  const atlas=frame&&companionSpriteMetadata.atlases[frame.atlas],grid=companionSpriteMetadata.grid,rows=companionSpriteMetadata.gridRows;
  if(!frame||!atlas||!cell||cell.connectedToSprite!==true||cell.currentPath!==atlas.src
    || ![cell.naturalWidth,cell.naturalHeight,cell.textureWidth,cell.textureHeight,cell.spriteWidth,cell.spriteHeight,cell.textureLeft,cell.textureTop].every(Number.isFinite)
    || cell.spriteWidth<=0||cell.spriteHeight<=0||cell.naturalWidth!==atlas.width||cell.naturalHeight!==atlas.height
    || !close(cell.textureWidth,cell.spriteWidth*grid)||!close(cell.textureHeight,cell.spriteHeight*rows)
    || !close(cell.spriteWidth,cell.spriteHeight)||!close(cell.textureLeft,0)||!close(cell.textureTop,0)||cell.textureClipPath!=="none")return false;
  const clip=clipValues(cell.spriteClipPath);
  return Boolean(clip && clip.every((value,i)=>close(value,frame.clip[i]/80*100,.002))
    && translation(cell.textureMatrix,-(frame.index%grid)*cell.spriteWidth,-Math.floor(frame.index/grid)*cell.spriteHeight)
    && translation(cell.spriteMatrix,frame.x/80*cell.spriteWidth,frame.y/80*cell.spriteHeight));
}
function observed(f:CuriousCompletionFrame) {
  const c=f.curiousCompletion,g=c?.guards;
  return f.visible===true && f.decoded===true && f.enabled===true && f.roam===true && f.eligible===true && f.blocked===false && f.owned===false
    && f.personality==="curious" && c?.version===2 && c.source===true && f.sourceClipMeasured===true && rect(c.body) && curiousTextureCellMatches(f.pose,c.cell)
    && Number.isInteger(f.pose) && f.pose>=0 && [f.at,f.x,f.y,f.hunger,f.energy].every(Number.isFinite)
    && f.hunger!>=0 && f.hunger!<.78 && f.energy!>.18 && f.energy!<=1
    && Number.isSafeInteger(f.humanEpoch) && f.humanEpoch!>=0 && Number.isSafeInteger(f.layoutEpoch) && f.layoutEpoch!>=0
    && typeof f.carried==="string" && f.carried==="" && typeof f.goal==="string" && f.goal===""
    && g?.preferencesObserved===true && typeof g.jumpAllowed==="boolean" && g.foodGoalAbsent===true && g.feedIntentAbsent===true && g.episodeInactive===true && g.handsFree===true
    && Math.abs(c.body.x+c.body.width/2-f.x)<=.5 && Math.abs(c.body.y+c.body.height-f.y)<=.5;
}
const row = (f:CuriousCompletionFrame,rows:readonly number[]) => rows.some(r=>companionSpriteMetadata.rows[r]?.includes(f.pose));
function actionSource(f:CuriousCompletionFrame) {
  if(!observed(f))return false;
  if(f.state==="play")return Boolean(COMPANION_PLAY_TIMING[f.play as keyof typeof COMPANION_PLAY_TIMING]?.beats.some(beat=>row(f,[beat.row])));
  const rows:Record<string,number[]>={idle:[0],look:[1,26],sniff:[1],stretch:[16],shake:[17],walk:[2,20],jump:[3,4,5,6,7]};
  return row(f,rows[f.state]??[]);
}
function supported(f:CuriousCompletionFrame) {
  const day=f.curiousCompletion?.day;
  return Boolean(observed(f) && /^date-\d+-floor$/.test(f.platform) && day && rect(day.rect) && Number.isFinite(day.footY)
    && Math.abs(day.footY-(day.rect.y+day.rect.height-3))<=.5 && Math.abs(f.y-day.footY)<=3
    && f.x>=day.rect.x+1 && f.x<=day.rect.x+day.rect.width-1);
}
const settled = (a:CuriousCompletionFrame,b:CuriousCompletionFrame) => supported(a) && supported(b) && actionSource(a) && actionSource(b)
  && !["walk","jump"].includes(a.state) && !["walk","jump"].includes(b.state)
  && a.platform===b.platform && sameRect(a.curiousCompletion!.day!.rect,b.curiousCompletion!.day!.rect)
  && distance(a,b)<=2 && b.at-a.at>=80 && b.at-a.at<=250;
function coherent(trace:readonly CuriousCompletionFrame[]) {
  const first=trace[0];
  return trace.length>1 && trace.every((f,i)=>observed(f) && f.humanEpoch===first.humanEpoch && f.layoutEpoch===first.layoutEpoch
    //500px/s is a conservative witness cap, not a claimed universal product
    // maximum. Unknown/faster motion is deferred, never labelled a runtime bug.
    && (!i || f.at>trace[i-1].at && f.at-trace[i-1].at<=250 && distance(f,trace[i-1])<=(f.at-trace[i-1].at)*.5+2));
}
function travelled(stage:readonly CuriousCompletionFrame[],origin:CuriousCompletionFrame,arrival:readonly CuriousCompletionFrame[]) {
  const motion=stage.filter(f=>["walk","jump"].includes(f.state));
  if(motion.length<3 || motion.some(f=>!actionSource(f) || f.lifePurpose!=="authored" || f.state==="jump" && f.curiousCompletion!.guards.jumpAllowed!==true)
    || motion.at(-1)!.at-motion[0].at<100 || new Set(motion.map(f=>f.pose)).size<2
    || new Set(motion.map(f=>`${f.x.toFixed(1)},${f.y.toFixed(1)}`)).size<3)return false;
  // Motion itself, not a later landing coordinate, must prove displacement.
  if(Math.max(...motion.map(f=>distance(f,motion[0])))<8 || distance(origin,arrival[0])<8)return false;
  const jumping=motion.filter(f=>f.state==="jump");
  if(jumping.length && (jumping.length<3 || Math.max(...jumping.map(f=>f.y))-Math.min(...jumping.map(f=>f.y))<8
    || new Set(jumping.flatMap(f=>[3,4,5,6,7].filter(r=>row(f,[r])))).size<3))return false;
  const last=motion.at(-1)!;
  return arrival[0].at>last.at && arrival[0].at-last.at<=250 && distance(last,arrival[0])<=(arrival[0].at-last.at)*.5+2
    && coherent([origin,...stage,...arrival.filter(f=>f.at>stage.at(-1)!.at)]);
}
function played(stage:readonly CuriousCompletionFrame[],state:"sniff"|"stretch",sourceRow:number) {
  const packet=companionSpriteMetadata.rows[sourceRow],duration=900,minSpan=duration*.8-80;
  let run:CuriousCompletionFrame[]=[];
  for(const f of stage){
    const good=f.state===state && f.command==="pose" && f.lifePurpose==="authored" && actionSource(f) && row(f,[sourceRow]) && supported(f);
    if(!good || run.length && (f.at<=run.at(-1)!.at || f.at-run.at(-1)!.at>250))run=[];
    if(!good)continue;
    run.push(f);
    const columns=run.map(x=>packet.indexOf(x.pose)),first=columns[0],last=columns.at(-1)!;
    const ordered=columns.every((column,i)=>!i || column>=columns[i-1] && column-columns[i-1] <= (run[i].at-run[i-1].at)/duration*packet.length+2);
    if(!ordered){run=[f];continue;}
    // A frozen or alternating pair of row members is not the finite packet.
    if(run.length>=4 && run.at(-1)!.at-run[0].at>=minSpan && new Set(columns).size>=Math.min(4,packet.length)
      && first<=Math.floor((packet.length-1)*.2) && last>=Math.ceil((packet.length-1)*.8)
      && last-first>=Math.floor((packet.length-1)*.7))return true;
  }
  return false;
}
function literalRecipeUnchanged() {
  const r=COMPANION_PERSONALITY_SCENES.find(value=>value.id==="D143-C");
  return r?.personality==="curious" && r.major===false && r.triggers.length===1 && r.triggers[0]==="free" && !r.propShow && !r.toyScope && !r.foodScope
    && r.steps.length===4 && r.steps.every((step,i)=>!step.optional && !step.audience && (i===0||i===2
    ? step.kind==="go" && step.target==="outside" : step.kind==="pose" && step.pose===(i===1?"sniff":"stretch") && step.ms===undefined));
}

/** C-only read-only witness. Never emits notes for the eight unsupported ideas,
 * mutates frames, calls product ACKs or rewrites earlier frozen artifacts. */
export function completedCuriousDailyIdeas(trace:readonly CuriousCompletionFrame[]):CuriousCompletionWitness[] {
  if(!literalRecipeUnchanged())return [];
  for(let start=2;start<trace.length;start++){
    const first=trace[start];
    if(first.scene!=="D143-C" || first.beat!=="0" || trace[start-1].scene==="D143-C")continue;
    let end=start+1;
    while(end<trace.length && trace[end].scene==="D143-C" && Number(trace[end].beat)>=Number(trace[end-1].beat))end++;
    const attempt=trace.slice(start,end),stages=[0,1,2,3].map(beat=>attempt.filter(f=>f.beat===String(beat)));
    const before=trace.slice(start-2,start);
    if(!settled(before[0],before[1]) || stages.some(stage=>!stage.length) || attempt.some(f=>!["0","1","2","3"].includes(f.beat)
      || f.command!==(["0","2"].includes(f.beat)?"go":"pose")) || attempt.at(-1)!.at-first.at>60000 || !coherent([...before,...attempt]))continue;
    // Each arrival is independently two settled, decoded samples. Include the
    // go's actual settled tail; no following location alone invents its route.
    const arrival=(travel:readonly CuriousCompletionFrame[],next:readonly CuriousCompletionFrame[])=>{
      const lastMoving=travel.map(f=>["walk","jump"].includes(f.state)).lastIndexOf(true);
      const candidates=[...travel.slice(lastMoving+1),...next];
      for(let i=0;i<candidates.length-1;i++)if(settled(candidates[i],candidates[i+1]))return [candidates[i],candidates[i+1]];
      return [];
    };
    const a=arrival(stages[0],stages[1]),b=arrival(stages[2],stages[3]);
    if(a.length!==2 || b.length!==2 || a[0].platform===before[1].platform || b[0].platform===a[0].platform
      || sameRect(a[0].curiousCompletion!.day!.rect,b[0].curiousCompletion!.day!.rect)
      || !travelled(stages[0],before[1],a) || !travelled(stages[2],stages[1].at(-1)!,b)
      || !played(stages[1],"sniff",1) || !played(stages[3],"stretch",16))continue;
    const last=attempt.at(-1)!;
    // Stay inside supplied original observations. Two actual new source frames
    // are needed; changed labels or idle/old final pixels provide no witness.
    const tail:CuriousCompletionFrame[]=[];
    for(const f of trace.slice(end)){
      if(f.at-last.at>2000 || f.scene==="D143-C" || !coherent([...before,...attempt,...tail,f]))break;
      tail.push(f);if(tail.length<2)continue;
      const x=tail.at(-2)!,y=tail.at(-1)!;
      if(!actionSource(x)||!actionSource(y)||x.state==="idle"||y.state==="idle"||x.state!==y.state||x.play!==y.play||x.scene!==y.scene||x.beat!==y.beat
        || x.pose===y.pose && distance(x,y)<1 || x.state===last.state && x.play===last.play && x.pose===last.pose && y.pose===last.pose)continue;
      return [{id:"D143-C",major:false,observer:"curious-native-v3",startedAt:first.at,finalBeat:3,finalBeatAt:stages[3].at(-1)!.at,
        subsequentAt:x.at,completedAt:y.at,arrivals:[{platform:a[0].platform,at:a[0].at},{platform:b[0].platform,at:b[0].at}]}];
    }
  }
  return [];
}
