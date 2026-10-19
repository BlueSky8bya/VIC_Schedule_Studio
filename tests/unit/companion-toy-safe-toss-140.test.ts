import { describe, expect, it } from "vitest";
import { type Platform } from "@/lib/ui/viewer-companion/brain";
import { accessibleCompanionToys, createCompanionToys, findCompanionToyRoute } from "@/lib/ui/viewer-companion/toys";

const home: Platform = { id: "companion-home-floor", x: 20, y: 559, width: 220, kind: "floor", manualOnly: true };
const contact: Platform = { ...home, id: "companion-home-floor-food", x: 23, width: 220 };
const ground: Platform = { id: "viewport-floor", x: 0, y: 1080, width: 1200, kind: "floor" };
const bounds = { width: 1200, height: 1100 };

function fixture(parity = 1, supports: readonly Platform[] = [home, ground]) {
  const model = createCompanionToys(() => 0); model.sync(supports, bounds, 0, supports.some(p => p.id === home.id) ? [contact] : []);
  const ids = Array.from({ length: parity }, () => model.spawn({ x: 120, y: 450, platformId: contact.id }, 0)!);
  for (let now = 16; now <= 1800; now += 16) model.tick(now);
  const id = ids.at(-1)!, actual = model.items().find(toy => toy.id === id)!;
  expect(actual.platformId).toBe(contact.id); expect(model.pick(id, actual)).toBe(true);
  return { model, id, ids };
}

describe("140 autonomous toy tosses retain a physically reachable landing", () => {
  it.each([[1, 215], [2, 45]] as const)("keeps parity %s near edge %s on the same high room floor, with a real short arc and same ID", (parity, x) => {
    const { model, id, ids } = fixture(parity), actor = { x, y: home.y, platformId: home.id };
    expect(model.carry(id, { x, y: home.y - 22 })).toBe(true);
    expect(model.put(id, { ...actor, y: actor.y - 22 }, 2000, true)).toBe(true);
    expect(model.items().find(toy => toy.id === id)).toMatchObject({ id, x, y: home.y - 22, carried: false, platformId: undefined });
    expect(model.moving()).toBe(true); expect(model.stash(id)).toBe(false);
    model.tick(2100); const airborne = model.items().find(toy => toy.id === id)!;
    expect(airborne.y).toBeLessThan(home.y - 22); expect(airborne.platformId).toBeUndefined();
    expect((airborne.x - x) * (parity === 1 ? 1 : -1)).toBeGreaterThan(0);
    for (let now = 2116; now <= 2800; now += 16) model.tick(now);
    const landed = model.items().find(toy => toy.id === id)!;
    expect(landed).toMatchObject({ id, platformId: contact.id, y: home.y, held: false, carried: false, hidden: false });
    expect(landed.x).toBeGreaterThanOrEqual(contact.x + 9); expect(landed.x).toBeLessThanOrEqual(contact.x + contact.width - 9);
    expect(landed.x).toBeCloseTo(parity === 1 ? 234 : 32);
    expect(model.ids()).toEqual(ids); expect(model.moving()).toBe(false);
    const accessible = accessibleCompanionToys([landed], [home, ground])[0];
    expect(Math.hypot(accessible.x - accessible.stance!.x, accessible.y - accessible.stance!.y)).toBeLessThanOrEqual(48);
    expect(findCompanionToyRoute(actor, accessible.stance!, [home, ground], false)).not.toBeNull();
    expect(findCompanionToyRoute(accessible.stance!, { x: 190, y: home.y, platformId: home.id }, [home, ground], false)).not.toBeNull();
    expect(model.pick(id, accessible.stance!)).toBe(true);
  });

  it("uses the same analytic first contact for coarse and fine existing host ticks", () => {
    const fine = fixture(), coarse = fixture(), point = { x: 215, y: home.y - 22, platformId: home.id };
    expect(fine.model.put(fine.id, point, 2000, true)).toBe(true); expect(coarse.model.put(coarse.id, point, 2000, true)).toBe(true);
    for (let now = 2016; now <= 2800; now += 16) fine.model.tick(now);
    coarse.model.tick(2800);
    const a = fine.model.items()[0], b = coarse.model.items()[0];
    expect(a.platformId).toBe(contact.id); expect(b.platformId).toBe(contact.id); expect(b.x).toBeCloseTo(a.x); expect(b.y).toBe(a.y);
  });

  it.each([[223, 206, 234], [43, 60, 32]] as const)("nudges the same toy near edge %s along a short physical arc that remains reachable", (x, actorX, landedX) => {
    const { model, id } = fixture();
    expect(model.put(id, { x, y: home.y, platformId: contact.id }, 1900)).toBe(true);
    expect(model.nudge(id, { x: actorX, y: home.y, platformId: home.id }, 2000)).toBe(true);
    expect(model.carried()).toBeUndefined(); expect(model.moving()).toBe(true);
    model.tick(2050); expect(model.items()[0].y).toBeLessThan(home.y); expect(model.items()[0].platformId).toBeUndefined();
    model.tick(2800); const landed = model.items()[0];
    expect(landed).toMatchObject({ id, platformId: contact.id, y: home.y, hidden: false, carried: false });
    expect(landed.x).toBeCloseTo(landedX); expect(Math.abs(landed.x - x)).toBeGreaterThan(8);
    const reachable = accessibleCompanionToys([landed], [home, ground])[0];
    expect(findCompanionToyRoute({ x: actorX, y: home.y, platformId: home.id }, reachable.stance!, [home, ground], false)).not.toBeNull();
    expect(model.pick(id, reachable.stance!)).toBe(true); expect(model.ids()).toEqual([id]);
  });

  it("a constrained nudge preserves the same ID on its actual support instead of inventing a landing", () => {
    const { model, id } = fixture(); expect(model.put(id, { x: 234, y: home.y, platformId: contact.id }, 1900)).toBe(true);
    // A surface just above it prevents a complete arc onto the requested
    // support. The creature may leave it gently in place, never throw below.
    const blocker: Platform = { id: "real-low-interceptor", x: 0, y: home.y - 2, width: 1200, kind: "card" };
    model.sync([home, ground, blocker], bounds, 1950, [contact]);
    expect(model.nudge(id, { x: 215, y: home.y, platformId: home.id }, 2000)).toBe(true);
    expect(model.items()[0]).toMatchObject({ id, platformId: contact.id, x: 234, y: home.y });
    expect(model.moving()).toBe(false); expect(model.ids()).toEqual([id]);
  });

  it("carries its reserved real floor through layout translation without restarting the finite arc", () => {
    const { model, id } = fixture(), point = { x: 215, y: home.y - 22, platformId: home.id };
    expect(model.put(id, point, 2000, true)).toBe(true); model.tick(2100);
    const before = model.items()[0], movedHome = { ...home, x: home.x + 80, y: home.y + 40 }, movedContact = { ...contact, x: contact.x + 80, y: contact.y + 40 };
    model.sync([movedHome, ground], bounds, 2100, [movedContact]);
    expect(model.items()[0].x).toBeCloseTo(before.x + 80); expect(model.items()[0].y).toBeCloseTo(before.y + 40);
    model.tick(2800);
    expect(model.items()[0]).toMatchObject({ id, platformId: contact.id, y: movedContact.y }); expect(model.moving()).toBe(false);
    expect(model.items()[0].x).toBeGreaterThanOrEqual(movedContact.x + 9); expect(model.items()[0].x).toBeLessThanOrEqual(movedContact.x + movedContact.width - 9);
  });

  it("pauses a reserved autonomous flight without hidden catch-up or losing its physical target", () => {
    const { model, id } = fixture(); expect(model.put(id, { x: 215, y: home.y - 22, platformId: home.id }, 2000, true)).toBe(true);
    model.tick(2100); const before = model.items()[0]; model.pause(2100); model.tick(9000);
    expect(model.items()[0]).toEqual(before); expect(model.moving()).toBe(false);
    model.resume(9000); model.tick(9000); expect(model.items()[0]).toEqual(before);
    model.tick(9500); expect(model.items()[0]).toMatchObject({ id, platformId: contact.id, y: home.y }); expect(model.moving()).toBe(false);
  });

  it("gently places the same carried toy when another real surface intercepts every short toss", () => {
    const { model, id } = fixture(), blocker: Platform = { id: "actual-upper-card", x: 0, y: home.y - 10, width: 1200, kind: "card" };
    model.sync([home, ground, blocker], bounds, 1900, [contact]);
    expect(model.put(id, { x: 215, y: home.y - 22, platformId: home.id }, 2000, true)).toBe(true);
    expect(model.items()[0]).toMatchObject({ id, x: 215, y: home.y, platformId: home.id, carried: false });
    expect(model.moving()).toBe(false); expect(model.ids()).toEqual([id]);
  });

  it("does not invent support or a success if the carried actor's claimed source is invalid", () => {
    const { model, id } = fixture(), before = model.items();
    for (const point of [{ x: 215, y: home.y - 22, platformId: "missing-floor" }, { x: 700, y: home.y - 22, platformId: home.id }, { x: 215, y: 200, platformId: home.id }])
      expect(model.put(id, point, 2000, true)).toBe(false);
    expect(model.items()).toEqual(before); expect(model.carried()).toBe(id);
  });

  it("preserves the human throw's original free trajectory beyond the room and onto a real viewport floor", () => {
    const { model, id } = fixture(); expect(model.grab(id)).toBe(true); expect(model.drag(id, { x: 215, y: home.y - 22 })).toBe(true);
    expect(model.drop(id, 2000, { x: 160, y: -160 })).toBe(true); model.tick(2100);
    expect(model.items()[0].x).toBeCloseTo(231); expect(model.items()[0].y).toBeCloseTo(home.y - 22 - 16 + 4.5);
    for (let now = 2116; now < 4000; now += 16) model.tick(now);
    expect(model.items()[0]).toMatchObject({ id, platformId: ground.id, y: ground.y, carried: false, held: false, hidden: false });
    expect(model.items()[0].x).toBeGreaterThan(contact.x + contact.width); expect(model.ids()).toEqual([id]);
  });
});
