import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "./companion-curious-completion-144";

export type TidyPrimaryFrame157 = {
  at: number; scene: string; serial: string; beat: string; state: string; play: string; pose: number;
  x: number; y: number; platform: string; visible: boolean; decoded: boolean;
  sourcePaint: boolean; cell: CuriousTextureCellMeasurement | null;
  toys: { id: string; carried: boolean; held: boolean; x: number; y: number }[];
};
const actual = (f: TidyPrimaryFrame157) => f.visible && f.decoded && f.sourcePaint && curiousTextureCellMatches(f.pose,f.cell);
const row = (f: TidyPrimaryFrame157, rows: number[]) => rows.some(value=>companionSpriteMetadata.rows[value]?.includes(f.pose));
/** A complete alternate physical chore earns a separately named primary
 * observation. This never renames an X recipe to catalog-major or certifies
 * literal T01. Missing final grooming or borrowed ownership cannot pass. */
export function completedTidyReturnGoal157(frames: readonly TidyPrimaryFrame157[], id: string | undefined, box: {x:number;y:number}) {
  if(!id||frames.some((f,i)=>!Number.isFinite(f.at)||i>0&&f.at<=frames[i-1].at))return [];
  const recipe="X-T-return-time",witnesses:{id:string;serial:string;samePhysicalId:string;catalogMajor:false;role:"equivalent-physical-primary"}[]=[];
  for(const serial of new Set(frames.filter(f=>f.scene===recipe&&f.serial).map(f=>f.serial))){
    const run=frames.filter(f=>f.scene===recipe&&f.serial===serial);
    if(run.some((f,i)=>i>0&&Number(f.beat)<Number(run[i-1].beat)))continue;
    const carried=run.filter(f=>f.beat==="0"&&actual(f)&&f.toys.some(toy=>toy.id===id&&toy.carried&&!toy.held));
    const last=carried.at(-1),object=last?.toys.find(toy=>toy.id===id);
    if(carried.length<2||!last||!object||Math.hypot(object.x-box.x,object.y-box.y)>=20)continue;
    const gone=frames.find(f=>f.at>last.at&&f.at-last.at<=1000&&actual(f)&&!f.toys.some(toy=>toy.id===id));
    if(!gone)continue;
    const walk=run.filter(f=>f.beat==="1"&&actual(f)&&/^companion-home-floor(?:-[1-9]\d*)?$/.test(f.platform)
      &&(f.state==="walk"&&row(f,[2,20])||f.state==="jump"&&row(f,[3,4,5,6,7])));
    if(walk.length<2||walk[0].at<=last.at||!walk.some(f=>Math.hypot(f.x-walk[0].x,f.y-walk[0].y)>8))continue;
    const groom=run.filter(f=>f.beat==="2"&&actual(f)&&f.state==="play"&&f.play==="groom"
      &&row(f,COMPANION_PLAY_TIMING.groom.beats.map(value=>value.row)));
    if(groom.length<3||groom[0].at<=walk.at(-1)!.at||gone.at>groom[0].at||new Set(groom.map(f=>f.pose)).size<2
      ||groom.at(-1)!.at-groom[0].at<companionPlayDuration("groom")*.8-80
      ||groom.some((f,i)=>i>0&&f.at-groom[i-1].at>160))continue;
    const ended=groom.at(-1)!;
    const following=frames.filter(f=>f.at>ended.at&&f.at-ended.at<=10000&&f.scene!==recipe&&actual(f)&&f.state!=="idle");
    if(!following.some((f,i)=>i>0&&f.at-following[i-1].at<=160))continue;
    witnesses.push({id:recipe,serial,samePhysicalId:id,catalogMajor:false,role:"equivalent-physical-primary"});
  }
  return witnesses;
}
