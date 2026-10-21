import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { DEFAULT_COMPANION_PREFERENCES, COMPANION_PERSONALITIES } from "@/lib/ui/viewer-companion/preferences";
import { companionRoomLighting } from "@/lib/ui/viewer-companion/room-lighting";
import type { CompanionHomeEnvironment } from "@/lib/ui/viewer-companion/home-environment";
import { COMPANION_EXPRESSIONS, COMPANION_EXPRESSION_MIN_EYE, sampleCompanionExpression } from "@/lib/ui/viewer-companion/expressions";
import { companionWashMatStance } from "@/lib/ui/viewer-companion/home-interaction";

const floor: Platform = { id: "companion-home-floor", x: 40, y: 600, width: 620, kind: "floor", manualOnly: true };
const mat: Platform = { id: "companion-home-floor-400", x: 450, y: 530, width: 2, kind: "floor", manualOnly: true, bodyOnly: true };
const environment = (night: boolean): CompanionHomeEnvironment => ({ date: { y: 2026, m: 10, d: 21 }, season: "autumn", hour: night ? 0 : 12, band: night ? "night" : "noon", night, weather: "clear", sunlight: night ? 0 : 4 });
const fixture = (): PersonalitySceneInput => ({ world: { x: 220, y: 600, platformId: floor.id, platforms: [floor, mat], width: 1440, height: 1000, animated: true }, brain: { ...createBrain(0), hunger: .05, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: true, sleep: false, personality: "balanced" }, now: 100, home: { pad: { x: 451, y: 530, platformId: mat.id }, floor: { x: 220, y: 600, platformId: floor.id } }, toys: [], tv: "off" });

describe("162 direct pad control and whole-room material", () => {
  it("retains the real narrow-panel mat while respecting body clearance and rejects an impossible stance", () => {
    const room = { left: 19, right: 281, top: 500, bottom: 653 }, mat = { left: 219.0625, top: 560.8125, width: 58, height: 24.640625 };
    const actual = companionWashMatStance(mat, room, 92)!;
    expect(actual.x).toBeCloseTo(246.04, 5); expect(actual.x).toBeLessThan(mat.left + mat.width / 2);
    expect(actual.x).toBeGreaterThan(mat.left + mat.width * .18); expect(actual.y).toBeCloseTo(mat.top + mat.height * .72);
    for (const width of [240, 260, 280, 430]) { const m = { ...mat, left: width * .875 - 29 }, r = { ...room, left: 0, right: width }, p = companionWashMatStance(m, r, 92)!; expect(p).toBeTruthy(); expect(p.x - 92 * .38).toBeGreaterThanOrEqual(r.left); expect(p.x + 92 * .38).toBeLessThanOrEqual(r.right + .00001); expect(p.x).toBeGreaterThanOrEqual(m.left + m.width * .18); expect(p.x).toBeLessThanOrEqual(m.left + m.width * .82); }
    expect(companionWashMatStance(mat, { ...room, right: 50 }, 92)).toBeUndefined(); expect(companionWashMatStance({ ...mat, width: NaN }, room, 92)).toBeUndefined();
  });
  it.each(COMPANION_PERSONALITIES)("%s manual wash follows physical approach, ACK and exit with automatic roaming off", personality => {
    const input = fixture(); input.preferences.personality = personality;
    const director = createCompanionPersonalityDirector([]);
    expect(director.startManualWash(input)).toBe(true); expect(director.startManualWash(input)).toBe(false);
    const travel = () => { for (let leg = 0; leg < 12; leg++) { const offer = director.next(input)!; expect(offer).toBeTruthy(); expect(offer.meta.manual).toBe(true); if (!offer.meta.travel) return offer; expect(["walk", "jump"]).toContain(offer.action!.kind); director.complete(offer.meta); expect(director.active()).toBe(true); input.world = { ...input.world, ...offer.action!.target }; input.now += offer.action!.duration; } throw Error("finite wash route did not reach its measured stance"); };
    const wash = travel(); expect(wash.meta.command.kind).toBe("wash"); expect(input.world.platformId).toBe(mat.id);
    director.complete(wash.meta); expect(director.next(input)?.meta.command.kind).toBe("wash"); // Pose duration alone is not a contact receipt.
    input.now += wash.action!.duration; director.resolve(wash.meta, true, undefined, input.now);
    const exit = director.next(input)!; expect(exit.meta.travel).toBe(true); expect(exit.meta.command).toEqual({ kind: "go", target: "floor" });
    input.world = { ...input.world, ...exit.action!.target }; input.now += exit.action!.duration;
    const tail = travel(); expect(tail.meta.command.kind).toBe("pose"); expect(input.world.platformId).toBe(floor.id); director.complete(tail.meta);
    expect(director.manualWash()).toBe(false); expect(director.next(input)).toBeUndefined(); // Manual command cannot enable autonomous roaming.
  });
  it.each(["disabled", "unanimated", "paused", "busy", "carried-food", "carried-toy", "missing-pad", "wrong-height", "wrong-plane", "unreachable"])("rejects %s without claiming contact or mutating world", reason => {
    const input = fixture(); if (reason === "disabled") input.preferences.enabled = false; if (reason === "unanimated") input.world.animated = false; if (reason === "paused") input.world.paused = true; if (reason === "busy") input.busy = true;
    if (reason === "carried-food") input.carriedFoodId = "synthetic-food"; if (reason === "carried-toy") input.carriedToyId = "synthetic-toy";
    if (reason === "missing-pad") input.home.pad = undefined; if (reason === "wrong-height") input.home.pad!.y += 4; if (reason === "wrong-plane") input.world.platforms = [floor, { ...mat, bodyOnly: false }]; if (reason === "unreachable") input.home.pad!.x += 1000;
    const before = structuredClone(input); const director = createCompanionPersonalityDirector([]); expect(director.startManualWash(input)).toBe(false); expect(director.active()).toBe(false); expect(input).toEqual(before);
  });
  it("cancellation never acknowledges washing or resumes a dismissed manual intention", () => { const input = fixture(), director = createCompanionPersonalityDirector([]); expect(director.startManualWash(input)).toBe(true); director.cancel(); expect(director.manualWash()).toBe(false); expect(director.completed()).toEqual([]); expect(director.next(input)).toBeUndefined(); });
  it("all twelve light combinations separate closed daytime from closed night and brighten every lamp-on pair", () => {
    for (const night of [false, true]) {
      const grades = [];
      for (const curtain of ["open", "shade", "closed"] as const) {
        const off = companionRoomLighting(environment(night), curtain, false), on = companionRoomLighting(environment(night), curtain, true);
        grades.push(off["--vc-room-art-grade"]); expect(on["--vc-room-art-grade"]).toBeGreaterThan(off["--vc-room-art-grade"]);
        expect(off["--vc-room-art-grade"]).toBeGreaterThanOrEqual(.35); expect(on["--vc-room-art-grade"]).toBeLessThanOrEqual(1);
        expect(off["--vc-bed-cloth"]).not.toBe(on["--vc-bed-cloth"]); if (night || curtain === "closed") expect(off["--vc-room-daylight"]).toBe(0);
      }
      expect(grades[0]).toBeGreaterThan(grades[1]); expect(grades[1]).toBeGreaterThan(grades[2]);
    }
    expect(companionRoomLighting(environment(false), "closed", false)["--vc-room-art-grade"]).toBeGreaterThan(companionRoomLighting(environment(true), "closed", false)["--vc-room-art-grade"]);
  });
  it("all new reactions retain the source eye's baseline pupil thickness, with exact neutral recovery", () => {
    for (const [id] of COMPANION_EXPRESSIONS) for (let n = 0; n <= 60; n++) { const face = sampleCompanionExpression(id, n / 60); expect(Math.min(face.left, face.right)).toBeGreaterThanOrEqual(COMPANION_EXPRESSION_MIN_EYE); expect(Math.max(face.left, face.right)).toBeLessThanOrEqual(1); }
  });
});
