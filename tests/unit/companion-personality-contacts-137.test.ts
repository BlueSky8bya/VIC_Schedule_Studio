import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { placeCompanionFood } from "@/lib/ui/viewer-companion/food";
import { createCompanionToys } from "@/lib/ui/viewer-companion/toys";
import { INITIAL_COMPANION_HOME_CURTAIN, reduceCompanionHomeCurtain } from "@/lib/ui/viewer-companion/home-curtain";
import { createCompanionHideSeek } from "@/lib/ui/viewer-companion/hide-seek";

const floor: Platform = { id: "companion-home-floor", x: 40, y: 600, width: 500, kind: "floor", manualOnly: true };
const pad: Platform = { ...floor, id: "companion-home-floor-400", x: 249, y: 460, width: 2, bodyOnly: true };
describe("137 actual body versus item contact", () => {
  it("never catches emitted or dropped toys on the body's wash stance", () => {
    for (const supports of [[pad, floor], [floor, pad]]) {
      const toys = createCompanionToys(() => 0); toys.sync(supports, { width: 1000, height: 700 }, 0);
      const id = toys.spawn({ x: 250, y: 400 }, 0)!;
      for (let at=16;at<2000;at+=16) toys.tick(at);
      expect(toys.available()[0]).toMatchObject({ id, platformId: floor.id, y: floor.y });
      expect(toys.grab(id)).toBe(true); toys.drag(id,{x:250,y:350}); toys.drop(id, 2100, { x:0, y:0 });
      for (let at=2116;at<4000;at+=16) toys.tick(at);
      expect(toys.available()[0]).toMatchObject({ id, platformId: floor.id, y: floor.y });
    }
  });
  it("keeps food below a body-only contact and on the actual receiving floor", () => {
    expect(placeCompanionFood({ id:"real-food",kind:"carrot",x:250,y:400 }, {x:250,y:400}, [pad,floor]))
      .toMatchObject({ id:"real-food",platformId:floor.id,y:floor.y });
  });
  it("applies actual authored curtain choices while preserving hidden and rest ownership", () => {
    const base = { personality: "homebody" as const, rest: "awake" as const, lookingOut: false, visible: true, blocked:false, reduced:false };
    const closed = reduceCompanionHomeCurtain(INITIAL_COMPANION_HOME_CURTAIN, {...base,intent:"closed"});
    expect(closed).toMatchObject({phase:"closed",panelScale:1,active:true});
    expect(reduceCompanionHomeCurtain(closed,{...base,visible:false,intent:"open"})).toMatchObject({phase:"closed",active:false,animate:false});
    expect(reduceCompanionHomeCurtain(closed,{...base,rest:"asleep",intent:"open"})).toMatchObject({phase:"closed",rest:"asleep"});
    expect(reduceCompanionHomeCurtain(closed,{...base,intent:"open"})).toMatchObject({phase:"open",panelScale:.08});
  });
  it("keeps personality peeks under10s without changing the legacy hide session wait", () => {
    const brief=createCompanionHideSeek(); brief.start("ordinary-card",0,1700,true);
    expect(brief.sample(700).phase).toBe("hidden"); expect(brief.sample(3100).phase).toBe("done");
    const legacy=createCompanionHideSeek(); legacy.start("ordinary-card",0,1700);
    expect(legacy.sample(3100).phase).toBe("hidden");
  });
});
