import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "./companion-curious-completion-144";
import { nativeHomeControlContactBefore, type NativeHomeControlFrame } from "./companion-home-contact-156";
import type { OwnedRestPreparationFrame } from "./companion-owned-rest-preparation";

export type BeforeBedRestFrame157 = OwnedRestPreparationFrame & {
  pose: number; play: string; command: string; sourcePaint: boolean;
  cell: CuriousTextureCellMeasurement | null;
  toys: { id: string; carried: boolean; held: boolean; x: number; y: number }[];
  restControl?: NativeHomeControlFrame["control"];
};
export type BeforeBedRestWitness157 = {
  recipe: "S03"; serial: string; beat: "1"; first: number; after: number;
  returnedToyId: string; lastCarriedAt: number; absentAt: number;
  changedAt: number; contactAt: number; measuredPull: number; maxGapMs: number;
  resumedAt: number; sofaPreparationAt: number; actualCellSamples: number;
};
const floor = (id: string) => /^companion-home-floor(?:-\d+)?$/.test(id) && id !== "companion-home-floor-400";
const finite = (...values: number[]) => values.every(Number.isFinite);
const source = (frame: BeforeBedRestFrame157 | undefined): frame is BeforeBedRestFrame157 => Boolean(frame
  && frame.visible && frame.decoded && frame.sourcePaint && frame.activity.source && !frame.activity.manual
  && finite(frame.at, frame.x, frame.y) && curiousTextureCellMatches(frame.pose, frame.cell));
const movement = (frame: BeforeBedRestFrame157) => source(frame) && (frame.state === "walk"
  ? [2,20].some(row => companionSpriteMetadata.rows[row].includes(frame.pose))
  : frame.state === "jump" && [3,4,5,6].some(row => companionSpriteMetadata.rows[row].includes(frame.pose)));
const cozy = (frame: BeforeBedRestFrame157) => source(frame) && frame.state === "play" && frame.play === "cozy-nest"
  && [35,36,40].some(row => companionSpriteMetadata.rows[row].includes(frame.pose));
const atSofa = (frame: BeforeBedRestFrame157) => frame.platform === "companion-home" && frame.homeSofa?.visible === true
  && finite(frame.homeSofa.left, frame.homeSofa.right, frame.homeSofa.top) && frame.homeSofa.right > frame.homeSofa.left
  && frame.x >= frame.homeSofa.left && frame.x <= frame.homeSofa.right && Math.abs(frame.y-frame.homeSofa.top) <= 3;

/** A renderer-owned prerequisite for the CURRENT go-sofa command, before any
 * bedding pose. Its only credit is retaining that same actual attempt across
 * an authenticated lamp trip. Original return/cozy/full sleep/next-action
 * requirements are evaluated separately and receive no pose/duration credit. */
export function beforeBedRestPreparation157(trace: readonly BeforeBedRestFrame157[], recipe: string, opening: { x: number; y: number }) {
  const indices = new Set<number>(), witnesses: BeforeBedRestWitness157[] = [];
  if (recipe !== "S03" || !finite(opening.x, opening.y)) return { indices, witnesses };
  for (let first = 1; first < trace.length-1; first++) {
    const head = trace[first], owner = head.homeLife, before = trace[first-1];
    if (head.scene || owner?.scene !== recipe || !/^[1-9]\d*$/.test(owner.serial) || owner.beat !== "1"
      || !["nap","sleep"].includes(owner.phase) || !source(before) || before.scene !== recipe || before.serial !== owner.serial
      || before.beat !== "0" || before.command !== "toy" || !floor(before.platform) || !before.lit) continue;
    if (before.homeLife?.serial === owner.serial) continue;
    const prefix = trace.slice(0,first).filter(frame => frame.scene === recipe && frame.serial === owner.serial);
    if (!prefix.length || prefix.some(frame => Number(frame.beat) > 0 || cozy(frame) || frame.state === "sleep")) continue;
    let after = first;
    for (; after < trace.length; after++) {
      const frame = trace[after], current = frame.homeLife;
      if (frame.scene || current?.scene !== recipe || current.serial !== owner.serial || current.beat !== "1" || current.phase !== owner.phase) break;
    }
    const resumed = trace[after];
    if (!source(resumed) || resumed.scene !== recipe || resumed.serial !== owner.serial || resumed.beat !== "1"
      || resumed.command !== "go" || !["walk","jump","look"].includes(resumed.state)
      || !(floor(resumed.platform) || atSofa(resumed)) || resumed.at <= head.at || resumed.at-head.at > 30_000) continue;
    const segment = trace.slice(first,after), all = [before,...segment,resumed];
    if (!segment.length || all.some((frame,index) => !source(frame) || frame.tv !== before.tv
      || !(floor(frame.platform) || index === all.length-1 && atSofa(frame))
      || index > 0 && (frame.at <= all[index-1].at || frame.at-all[index-1].at > 160))) continue;
    const travel = segment.filter(movement);
    if (!travel.some(frame => travel.some(other => Math.hypot(frame.x-other.x,frame.y-other.y) >= 24))) continue;
    const carried = prefix.filter(frame => source(frame) && frame.beat === "0" && frame.command === "toy");
    const original = carried.flatMap(frame => frame.toys.filter(toy => toy.carried && !toy.held).map(toy => ({ frame,toy }))).reverse()
      .find(({frame,toy}) => finite(toy.x,toy.y) && Math.hypot(toy.x-opening.x,toy.y-opening.y) < 20
        && carried.filter(value => value.toys.some(item => item.id === toy.id && item.carried && !item.held)).length >= 2
        && !before.toys.some(item => item.id === toy.id) && head.at-frame.at <= 2000);
    if (!original || segment.some(frame => frame.toys.some(toy => toy.id === original.toy.id || toy.carried || toy.held))) continue;
    const absent = prefix.find(frame => frame.at > original.frame.at && !frame.toys.some(toy => toy.id === original.toy.id));
    if (!absent) continue;
    const changes = all.slice(1).flatMap((frame,index) => frame.lit !== all[index].lit ? [frame] : []);
    if (changes.length !== 1 || changes[0].lit || resumed.lit) continue;
    const changed = changes[0];
    const contacts = all.filter(frame => frame.restControl).map(frame => ({ at: frame.at,control: frame.restControl! }));
    const contact = nativeHomeControlContactBefore(contacts,changed.at,"light");
    const actualContact = contact && all.find(frame => frame.at === contact.at);
    if (!contact || !actualContact || !source(actualContact) || actualContact.homeLife?.reaching !== "light" || !actualContact.homeLife.lampTouch
      || actualContact.state !== "play" || contact.pose !== actualContact.pose || !contact.measuredPull || !actualContact.restControl?.actor.rect
      || Math.abs(actualContact.restControl.actor.rect.x+actualContact.restControl.actor.rect.width/2-actualContact.x) > 2
      || Math.abs(actualContact.restControl.actor.rect.y+actualContact.restControl.actor.rect.height-actualContact.y) > 2) continue;
    const tail = trace.slice(after).filter(frame => frame.at <= resumed.at+10_000);
    const firstCozy = tail.findIndex(frame => frame.scene === recipe && frame.serial === owner.serial && frame.beat === "2" && cozy(frame) && atSofa(frame));
    if (firstCozy < 0) continue;
    const prepare = tail.slice(0,firstCozy+1), next = tail[firstCozy+1];
    if (prepare.some((frame,index) => !source(frame) || frame.scene !== recipe || frame.serial !== owner.serial
      || !["1","2"].includes(frame.beat) || frame.homeLife || frame.lit || frame.tv !== before.tv
      || index > 0 && (frame.at <= prepare[index-1].at || frame.at-prepare[index-1].at > 160))
      || !next || !source(next) || next.scene !== recipe || next.serial !== owner.serial || next.beat !== "2"
      || !cozy(next) || !atSofa(next) || next.lit || next.at-tail[firstCozy].at <= 0 || next.at-tail[firstCozy].at > 160) continue;
    for (let index = first; index < after; index++) indices.add(index);
    witnesses.push({ recipe:"S03",serial:owner.serial,beat:"1",first,after,returnedToyId:original.toy.id,lastCarriedAt:original.frame.at,absentAt:absent.at,
      changedAt:changed.at,contactAt:contact.at,measuredPull:contact.measuredPull,maxGapMs:Math.max(...all.slice(1).map((frame,index)=>frame.at-all[index].at)),
      resumedAt:resumed.at,sofaPreparationAt:tail[firstCozy].at,actualCellSamples:new Set([...all,...prepare,next].map(frame=>frame.at)).size });
    first = after;
  }
  return { indices,witnesses };
}
