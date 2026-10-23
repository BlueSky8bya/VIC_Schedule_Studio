import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import contacts from "@/lib/ui/viewer-companion/curtain-contact-anchors.json";
import { companionHomeContactAnchor } from "@/lib/ui/viewer-companion/accessory";
import { companionCurtainControlStance, companionHomeCordPoint, companionHomeCordTouches, nearestCompanionHomeCordAnchor, sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import type { PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { projectCompanionSpritePoint } from "@/lib/ui/viewer-companion/sofa-pose";

describe("wall-side curtain uses the actual handle and original body edge", () => {
  it("binds every side contact to an opaque3x3 patch in the unchanged16-frame source", async () => {
    const bytes=readFileSync("public"+contacts.source.src);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(contacts.source.sha256);
    expect(bytes.length).toBe(contacts.source.bytes);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    expect(contacts.frames.map(frame=>frame.physicalIndex)).toEqual(companionSpriteMetadata.rows[9]);
    for(const frame of contacts.frames) for(const side of ["left","right"] as const) {
      const point=frame[side], selected=selectCompanionSprite(frame.physicalIndex);
      expect(companionHomeContactAnchor(selected,true,side)).toMatchObject(point);
      expect(companionHomeContactAnchor({...selected,src:"/wrong-source.webp"},true,side)).toBeNull();
      const x=Math.round(point.x/80*192)+frame.index%8*192, y=Math.round(point.y/80*192)+Math.floor(frame.index/8)*192;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) expect(data[((y+dy)*info.width+x+dx)*4+3]).toBeGreaterThanOrEqual(250);
    }
    expect(companionHomeContactAnchor(selectCompanionSprite(0),true,"left")).toBeNull();
  });
  it("targets the tight painted knob rather than the long rope bottom or the44px button", () => {
    expect(companionHomeCordPoint({left:20,top:100,width:8,height:14})).toEqual({x:24,y:107,width:8,height:14});
    expect(companionHomeCordPoint({left:20,top:100,width:0,height:14})).toBeUndefined();
    expect(companionHomeCordPoint({left:NaN,top:100,width:8,height:14})).toBeUndefined();
    const target=companionHomeCordPoint({left:20,top:100,width:8,height:14})!;
    expect(companionHomeCordTouches({x:24,y:125.4},target,92)).toBe(false);
  });
  it("physically rises to the source-bound body edge at both facing directions and room ratios, then returns", () => {
    let checked=0;
    for(const height of [240,360,560]) for(const size of [76,92]) for(const facing of [-1,1] as const) for(const frame of contacts.frames) {
      const floor={x:62,y:height+20}, contact={x:31,y:20+height*.35,width:8,height:14}, side=facing===1?"left":"right";
      const selected=selectCompanionSprite(frame.physicalIndex), anchor=companionHomeContactAnchor(selected,true,side)!;
      const hand=projectCompanionSpritePoint({size,display:{...floor,scale:1},cell:selected.frame,facing,
        shape:{bob:0,tilt:0,scaleX:1,scaleY:1},pressure:{x:0,y:0,tilt:0,squash:0},response:{lift:0,squash:0},sway:{tilt:0,stretch:0}},anchor)!;
      const input={hand,contact,footY:floor.y,ceiling:20,size,jump:true,cord:true,horizontal:{bodyX:floor.x,left:50,right:300}};
      const reach=sampleCompanionHomeReach({...input,progress:.5})!;
      expect(reach.lift).toBeGreaterThan(0);
      expect(reach.touching,JSON.stringify({height,size,facing,index:frame.index,hand,reach})).toBe(true);
      expect(companionHomeCordTouches(reach.from,contact,size)).toBe(true);
      expect(floor.x+reach.shiftX).toBeGreaterThanOrEqual(50);
      expect(floor.y-reach.lift-size*.72).toBeGreaterThanOrEqual(20);
      expect(sampleCompanionHomeReach({...input,progress:.5,jump:false})?.touching).toBe(false);
      for(const progress of [0,1]) expect(sampleCompanionHomeReach({...input,progress})).toMatchObject({lift:0,shiftX:0,touching:false});
      checked++;
    }
    expect(checked).toBe(192);
  });
  it("reproduces native compact misses and moves the real stance inside the room before choosing a fixed opaque contact", () => {
    // Actual first-run room/knob geometry, not an invented viewport origin.
    const cases=[
      {room:{left:77,right:509},contact:{x:100.4296875,y:253.78125,width:10.796875,height:18},floorY:434.671875,oldX:100.4296875},
      {room:{left:33,right:465},contact:{x:56.4296875,y:257.78125,width:10.796875,height:18},floorY:438.671875,oldX:62},
      {room:{left:28.1875,right:580.1875},contact:{x:53.8046875,y:360.953125,width:13.796875,height:23},floorY:521.265625,oldX:62},
      {room:{left:19,right:281},contact:{x:38.6875,y:446.1640625,width:8,height:13.328125},floorY:647.1875,oldX:62},
    ];
    for(const scenario of cases){
      const size=92,plane:Platform={id:"companion-home-floor",x:50,y:scenario.floorY,width:400,kind:"floor",manualOnly:true};
      const stance=companionCurtainControlStance(scenario.contact,scenario.room,[plane],size)!;
      expect(stance.x-size*.38-3).toBeGreaterThanOrEqual(scenario.room.left);
      if(scenario.room.left===77) expect(scenario.oldX-size*.38).toBeLessThan(scenario.room.left);
      for(const frame of contacts.frames){
        const selected=selectCompanionSprite(frame.physicalIndex),display={x:stance.x,y:stance.y,scale:1},facing=scenario.contact.x<stance.x?-1 as const:1 as const;
        const project=(anchor:"top"|"left"|"right")=>projectCompanionSpritePoint({size,display,cell:selected.frame,facing,
          shape:{bob:0,tilt:0,scaleX:1,scaleY:1},pressure:{x:0,y:0,tilt:0,squash:0},response:{lift:0,squash:0},sway:{tilt:0,stretch:0}},
          companionHomeContactAnchor(selected,true,anchor==="top"?undefined:anchor)!)!;
        const candidates=(["top","left","right"] as const).map(anchor=>({anchor,point:project(anchor)}));
        const anchor=nearestCompanionHomeCordAnchor(candidates,scenario.contact)!;
        const reach=sampleCompanionHomeReach({hand:project(anchor),contact:scenario.contact,footY:stance.y,ceiling:0,size,jump:true,cord:true,progress:.5,
          horizontal:{bodyX:stance.x,left:Math.max(plane.x,scenario.room.left+size*.38),right:Math.min(plane.x+plane.width,scenario.room.right-size*.38)}})!;
        expect(reach.touching,JSON.stringify({scenario,stance,frame:frame.index,anchor,reach})).toBe(true);
        expect(companionHomeCordTouches(reach.from,scenario.contact,size)).toBe(true);
        expect(stance.x+reach.shiftX-size*.38).toBeGreaterThanOrEqual(scenario.room.left);
      }
    }
    expect(companionCurtainControlStance({x:20,y:100},{left:0,right:20},[],92)).toBeUndefined();
    expect(nearestCompanionHomeCordAnchor([{anchor:"left",point:{x:78,y:258}},{anchor:"top",point:{x:104,y:230}}],{x:100,y:254})).toBe("top");
    expect(nearestCompanionHomeCordAnchor([{anchor:"left",point:{x:NaN,y:258}}],{x:100,y:254})).toBeUndefined();
  });
  it("walks the remaining near-curtain gap before the actual hop and preserves manual control priority", () => {
    const floor:Platform={id:"companion-home-floor",x:0,y:500,width:700,kind:"floor",manualOnly:true};
    for(const offset of [-20,8,0]) for(const canCurtain of [true,false]) {
      const recipes:PersonalitySceneRecipe[]=[{id:"curtain-reach-fixture",label:"fixture",personality:"balanced",major:true,triggers:["free"],steps:[{kind:"curtain",phase:"closed"},{kind:"watch",ms:900}]}];
      const director=createCompanionPersonalityDirector(recipes,()=>.5);
      const input:PersonalitySceneInput={world:{x:100+offset,y:500,platformId:floor.id,platforms:[floor],width:1000,height:700,animated:true},
        brain:{...createBrain(0,()=>.5),energy:.9,hunger:.2},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:"balanced"},now:0,
        home:{curtain:{x:100,y:500,platformId:floor.id},contacts:{curtain:{x:82,y:260}}},toys:[],tv:"off",lightLit:true,curtainPhase:"open",canCurtain};
      const entry=director.next(input); if(entry) director.complete(entry.meta); input.now=100;
      const offered=director.next(input);
      if(!canCurtain) { expect(offered?.meta.command.kind).not.toBe("curtain"); continue; }
      expect(offered?.meta.command.kind).toBe("curtain");
      if(offset) expect(offered?.action).toMatchObject({kind:"walk",personalityScene:{travel:true}});
      else expect(offered?.action).toMatchObject({kind:"play",play:"pounce",personalityScene:{interactionContact:{x:82,y:260}}});
    }
  });
});
