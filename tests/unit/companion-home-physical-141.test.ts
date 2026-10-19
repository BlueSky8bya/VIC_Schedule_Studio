import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { companionHomeOpeningContact, companionHomeResidentFloor, companionRoomBodyLight, COMPANION_WASH_SUPPORT, sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";
import { createCompanionCurtainControl } from "@/lib/ui/viewer-companion/home-curtain-control";

const mat: Platform = { id: COMPANION_WASH_SUPPORT, x: 279, y: 196, width: 2, kind: "floor", bodyOnly: true, manualOnly: true };
const back: Platform = { id: "companion-home-floor", x: 200, y: 220, width: 104, kind: "floor", manualOnly: true };
describe("141 actual room supports", () => {
  it("retains the bath mat at its own height through repeated layout deliveries", () => {
    let point = { x: 280, y: 196 };
    for (let i = 0; i < 5; i++) {
      const retained = companionHomeResidentFloor(mat.id, point, [back, mat], back.y)!;
      expect(retained).toBe(mat); point = { x: retained.x + retained.width / 2, y: retained.y };
    }
    expect(point).toEqual({ x: 280, y: 196 });
  });
  it("never substitutes a bottom floor or bin-like ledge when the mat disappears", () => {
    expect(companionHomeResidentFloor(mat.id, { x: 280, y: 196 }, [back, { ...back, id: "companion-home-floor-9", y: 202 }], back.y)).toBeUndefined();
  });
  it("ordinary floor residence never promotes a narrow body-only wash stance", () => {
    expect(companionHomeResidentFloor(back.id, { x: 280, y: 196 }, [mat, back], back.y)).toBe(back);
  });
  it("uses the moved mat geometry and rejects nonfinite deliveries", () => {
    const moved = { ...mat, x: 399, y: 229 };
    expect(companionHomeResidentFloor(mat.id, { x: 400, y: 229 }, [back, moved], back.y)).toBe(moved);
    expect(companionHomeResidentFloor(mat.id, { x: NaN, y: 196 }, [mat], back.y)).toBeUndefined();
  });
});
describe("141 physical reach and room illumination", () => {
  it("reaches a real side rim from the recorded safe stance without moving the box delivery centre", () => {
    const opening = { left: 254.171875, right: 305.484375, width: 51.3125, bottom: 442.78125 };
    const rim = companionHomeOpeningContact(opening, 212.165)!;
    expect(rim.x).toBe(opening.left + 1);
    const pose = { hand: { x: 217.4, y: 529 }, footY: 558.859, ceiling: 317.859, size: 92, jump: true, progress: .5 };
    expect(sampleCompanionHomeReach({ ...pose, contact: { x: opening.left + 4, y: opening.bottom } })?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, contact: { x: 279.8, y: 442.8 } })?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, contact: rim })?.touching).toBe(true);
    expect(companionHomeOpeningContact(opening, 400)?.x).toBeLessThan(opening.right);
    expect(companionHomeOpeningContact({ ...opening, width: 0 }, 212)).toBeUndefined();
  });
  const pose = { hand: { x: 250, y: 170 }, contact: { x: 253, y: 95 }, footY: 210, ceiling: 20, size: 76, jump: true };
  it("rises to a finite actual contact and comes back to the original support", () => {
    const contact = sampleCompanionHomeReach({ ...pose, progress: .5 })!;
    expect(contact.lift).toBeGreaterThan(0); expect(contact.touching).toBe(true);
    expect(sampleCompanionHomeReach({ ...pose, progress: 0 })?.lift).toBe(0);
    expect(sampleCompanionHomeReach({ ...pose, progress: 1 })?.lift).toBe(0);
    expect(sampleCompanionHomeReach({ ...pose, progress: 1 })?.touching).toBe(false);
  });
  it("cannot acknowledge a distant control, a ceiling collision or jumping OFF", () => {
    expect(sampleCompanionHomeReach({ ...pose, contact: { x: 450, y: 95 }, progress: .5 })?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, ceiling: 190, progress: .5 })?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, jump: false, progress: .5 })?.touching).toBe(false);
  });
  it("darkens only the real room occupant and restores outside/absent room", () => {
    const room = { left: 20, right: 330, top: 40, bottom: 250 };
    expect(companionRoomBodyLight({ x: 180, y: 210 }, room, .6)).toBe(.6);
    expect(companionRoomBodyLight({ x: 400, y: 210 }, room, .6)).toBe(1);
    expect(companionRoomBodyLight({ x: 180, y: 300 }, room, .6)).toBe(1);
    expect(companionRoomBodyLight({ x: 180, y: 210 }, undefined, .6)).toBe(1);
    expect(companionRoomBodyLight({ x: 180, y: 210 }, room, 1)).toBe(1);
  });
});
describe("141 actual curtain control lease", () => {
  it("keeps the exact manual choice until a permitted actual use changes it", () => {
    let now = 100; const curtain = createCompanionCurtainControl(() => now);
    expect(curtain.set("closed", "human")).toBe(true);
    expect(curtain.set("open", "companion")).toBe(false);
    now += 14999; expect(curtain.set("shade", "companion")).toBe(false);
    now++; expect(curtain.read()).toBe("closed");
    expect(curtain.set("shade", "companion")).toBe(true); expect(curtain.read()).toBe("shade");
  });
  it("same-value manual confirmations extend the lease and invalid input changes nothing", () => {
    let now = 100; const curtain = createCompanionCurtainControl(() => now);
    curtain.set("open"); now = 15099; curtain.set("open"); now = 15100;
    expect(curtain.set("closed", "companion")).toBe(false);
    expect(curtain.set("invalid" as "open")).toBe(false); expect(curtain.read()).toBe("open");
  });
});
