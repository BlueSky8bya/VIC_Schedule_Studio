import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { companionCarryAnchor, companionHomeContactAnchor } from "@/lib/ui/viewer-companion/accessory";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import contacts from "@/lib/ui/viewer-companion/home-contact-anchors-157.json";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { projectCompanionSpritePoint, type CompanionSofaPoseInput } from "@/lib/ui/viewer-companion/sofa-pose";
import { sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";
import { COMPANION_JUMP_LIMITS } from "@/lib/ui/viewer-companion/brain";
const physical = { footY: 501.2659912109375, ceiling: 120, size: 92, contact: { x: 385.56298828125, y: 270.2 }, progress: .5, jump: true };
function projection(index: number, facing: -1 | 1 = 1): CompanionSofaPoseInput {
  return { size:physical.size,display:{x:physical.contact.x,y:physical.footY,scale:1},cell:selectCompanionSprite(index).frame,
    shape:{bob:0,tilt:0,scaleX:1,scaleY:1},pressure:{x:0,y:0,tilt:0,squash:0},response:{lift:0,squash:0},facing,sway:{tilt:0,stretch:0} };
}
describe("157 physical source-bound overhead body contact", () => {
  it("binds all16 actual row9 contact cells to the exact immutable source and rejects a different decoded body", () => {
    const bytes=readFileSync("public"+contacts.source.src);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(contacts.source.sha256);expect(bytes.length).toBe(contacts.source.bytes);
    expect(contacts.frames.map(frame=>frame.physicalIndex)).toEqual(companionSpriteMetadata.rows[9]);
    for(const point of contacts.frames){const selected=selectCompanionSprite(point.physicalIndex),head=companionHomeContactAnchor(selected,true)!;
      expect(head).toMatchObject({x:point.x,y:point.y});expect(head.y).toBeLessThan(companionCarryAnchor(selected)!.y);
      expect(companionHomeContactAnchor({...selected,src:"/different-body.webp"},true)).toBeNull();
      expect(companionHomeContactAnchor({...selected,index:selected.index+16},true)).toBeNull();}
    expect(companionHomeContactAnchor({...selectCompanionSprite(0),physicalIndex:-1},true)).toBeNull();
  });
  it("uses real opaque upper-head/ear pixels for every contact, with a solid3x3 source patch rather than an air point", async () => {
    const {data,info}=await sharp("public"+contacts.source.src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    expect(info.width).toBe(contacts.source.width);expect(info.height).toBe(contacts.source.height);
    for(const point of contacts.frames){const pose=anchors.frames.find(frame=>frame.physicalIndex===point.physicalIndex)!;
      expect(point.y).toBeGreaterThanOrEqual(pose.bodyBounds[1]);expect(point.y).toBeLessThan(pose.head.y);
      expect(Math.abs(point.x-pose.head.x)).toBeLessThanOrEqual(pose.chest.width*.25);
      const x=Math.round(point.x/contacts.logicalCell*contacts.textureCell)+point.index%8*contacts.textureCell;
      const y=Math.round(point.y/contacts.logicalCell*contacts.textureCell)+Math.floor(point.index/8)*contacts.textureCell;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)expect(data[((y+dy)*info.width+x+dx)*4+3],`physical${point.physicalIndex} opaque contact`).toBeGreaterThanOrEqual(250);}
  });
  it("preserves exact upper-body contact after164 while reproducing the original fixed140 chest miss", () => {
    const controlRise=COMPANION_JUMP_LIMITS.maxRise*Math.max(1,(physical.footY-physical.ceiling)/260);
    for(const point of contacts.frames)for(const facing of [-1,1] as const){const selected=selectCompanionSprite(point.physicalIndex),input=projection(point.physicalIndex,facing);
      const chest=projectCompanionSpritePoint(input,companionCarryAnchor(selected)!)!,head=projectCompanionSpritePoint(input,companionHomeContactAnchor(selected,true)!)!;
      // The released164 policy now scales only local control reach. Keep
      // the original fixed140 miss as geometry, rather than expecting the
      // repaired proportional policy to reproduce its old failure.
      const originalRise=Math.min(COMPANION_JUMP_LIMITS.maxRise,physical.footY-physical.ceiling-physical.size*.72);
      expect(Math.hypot(chest.x-physical.contact.x,chest.y-originalRise-physical.contact.y)).toBeGreaterThan(physical.size*.48);
      const proportional=sampleCompanionHomeReach({...physical,hand:chest})!;
      expect(proportional.touching).toBe(true);
      expect(proportional.lift).toBeLessThanOrEqual(controlRise);
      const reached=sampleCompanionHomeReach({...physical,hand:head})!;expect(reached.touching).toBe(true);expect(reached.lift).toBeLessThanOrEqual(controlRise);
      expect(Math.hypot(reached.from.x-physical.contact.x,reached.from.y-physical.contact.y)).toBeLessThanOrEqual(physical.size*.48);
      expect(physical.footY-reached.lift-physical.size*.72).toBeGreaterThanOrEqual(physical.ceiling);}
  });
  it("preserves actual ceiling, jumpOFF, remote-control and finite-touch guards", () => {
    for(const point of contacts.frames){const input=projection(point.physicalIndex),head=projectCompanionSpritePoint(input,companionHomeContactAnchor(selectCompanionSprite(point.physicalIndex),true)!)!;
      expect(sampleCompanionHomeReach({...physical,hand:head,jump:false})!.touching).toBe(false);
      expect(sampleCompanionHomeReach({...physical,hand:head,ceiling:440})!.touching).toBe(false);
      expect(sampleCompanionHomeReach({...physical,hand:head,contact:{x:physical.contact.x+200,y:physical.contact.y}})!.touching).toBe(false);
      expect(sampleCompanionHomeReach({...physical,hand:head,contact:{x:physical.contact.x,y:10}})!.touching).toBe(false);
      for(const progress of [0,.2,.9,1])expect(sampleCompanionHomeReach({...physical,hand:head,progress})!.touching).toBe(false);}
    expect(COMPANION_JUMP_LIMITS.maxRise).toBe(140);
  });
  it("keeps all original carried-food/toy transport anchors unchanged and source-valid fallback poses at their measured head", () => {
    const before=JSON.stringify(anchors);
    for(const pose of anchors.frames){const selected=selectCompanionSprite(pose.physicalIndex);expect(companionHomeContactAnchor(selected,false)).toEqual(companionCarryAnchor(selected));
      if(!contacts.frames.some(point=>point.physicalIndex===pose.physicalIndex))expect(companionHomeContactAnchor(selected,true)).toEqual(pose.head);}
    expect(JSON.stringify(anchors)).toBe(before);
  });
});
