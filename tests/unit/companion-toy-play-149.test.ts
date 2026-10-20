import { describe, expect, it } from "vitest";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, getCompanionToyArt } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_TOY_USES, companionToyPlayDuration, sampleCompanionToyPlay } from "@/lib/ui/viewer-companion/toy-play";

describe("finite use of the same real companion toy", () => {
  it("assigns every catalog identity a deliberate use and a bounded complete performance", () => {
    expect(Object.keys(COMPANION_TOY_USES).sort()).toEqual([...COMPANION_TOY_KINDS].sort());
    expect(COMPANION_TOY_KINDS).toHaveLength(84);
    expect(new Set(Object.values(COMPANION_TOY_USES)).size).toBe(15);
    for (const kind of COMPANION_TOY_KINDS) {
      expect(companionToyPlayDuration(kind), kind).toBeGreaterThanOrEqual(2400);
      expect(companionToyPlayDuration(kind), kind).toBeLessThanOrEqual(3100);
      const failures: number[] = [];
      for (let index = 0; index <= 200; index++) {
        const pose = sampleCompanionToyPlay(kind, index / 200);
        if (![pose.phase, pose.lift, pose.lean, pose.shift, pose.compression, ...Object.values(pose.toy), pose.effect.opacity, pose.effect.x, pose.effect.y, pose.effect.rotation].every(Number.isFinite)
          || ![1, 9].includes(pose.row) || pose.toy.floorMix < 0 || pose.toy.floorMix > 1 || pose.toy.scale < .94 || pose.toy.scale > 1
          || Math.abs(pose.toy.x) > 24 || Math.abs(pose.toy.y) > 30 || Math.abs(pose.lean) > 9 || pose.lift < -5 || pose.compression > .04 || pose.effect.opacity < 0 || pose.effect.opacity > 1) failures.push(index);
      }
      expect(failures, kind).toEqual([]);
    }
  });

  it("distinguishes throw, floor push, quarter turns, face inspection and one decorative foam shot", () => {
    const ball = sampleCompanionToyPlay("ball", .47), car = sampleCompanionToyPlay("toy-car", .5);
    expect(ball.toy.y).toBeLessThan(-25); expect(ball.toy.x).toBeGreaterThan(20); expect(ball.toy.floorMix).toBe(0);
    expect(car.toy.floorMix).toBeGreaterThan(.99); expect(car.toy.y).toBe(0); expect(car.toy.x).toBeGreaterThan(20);
    expect(sampleCompanionToyPlay("puzzle-cube", .32).toy.rotation).toBeGreaterThan(85);
    expect(sampleCompanionToyPlay("puzzle-cube", .69).toy.rotation).toBeLessThan(-85);
    const peek = sampleCompanionToyPlay("kaleidoscope", .4);
    expect(peek.row).toBe(1); expect(peek.toy.y).toBeLessThan(-17); expect(peek.toy.x).toBeGreaterThan(10);
    const shot = sampleCompanionToyPlay("foam-dart-blaster", .52);
    expect(shot.effect.kind).toBe("dart"); expect(shot.effect.opacity).toBeGreaterThan(.99); expect(shot.effect.x).toBeGreaterThan(38);
    expect(sampleCompanionToyPlay("foam-dart-blaster", .85).effect.opacity).toBeLessThan(1e-12);
  });

  it("returns to the same neutral grip and fully suppresses motion for quiet modes or nonfinite time", () => {
    for (const kind of COMPANION_TOY_KINDS) for (const progress of [0, 1, -1, 2, Number.NaN, Infinity, -Infinity]) {
      const pose = sampleCompanionToyPlay(kind, progress);
      expect([pose.lift, pose.lean, pose.shift, pose.compression], kind).toEqual([0, 0, 0, 0]);
      expect(pose.toy, kind).toEqual({ x: 0, y: 0, rotation: 0, scale: 1, floorMix: 0 });
      expect(pose.effect.opacity, kind).toBe(0);
    }
    for (const kind of COMPANION_TOY_KINDS) for (const p of [.1, .4, .8]) {
      expect(sampleCompanionToyPlay(kind, p, true).toy, kind).toEqual({ x: 0, y: 0, rotation: 0, scale: 1, floorMix: 0 });
      expect(sampleCompanionToyPlay(kind, p, true).effect.kind, kind).toBe("none");
      expect(sampleCompanionToyPlay(kind, p, true).phase, kind).toBe(0);
    }
  });

  it("has continuous local transforms, including a full spin's equivalent terminal angle", () => {
    for (const kind of COMPANION_TOY_KINDS) {
      let prior = sampleCompanionToyPlay(kind, 0);
      const failures: number[] = [];
      for (let index = 1; index <= 1000; index++) {
        const next = sampleCompanionToyPlay(kind, index / 1000);
        const turn = Math.abs(next.toy.rotation - prior.toy.rotation) % 360;
        if (Math.min(turn, 360 - turn) >= 2 || Math.abs(next.toy.x - prior.toy.x) >= .5 || Math.abs(next.toy.y - prior.toy.y) >= .5
          || Math.abs(next.toy.floorMix - prior.toy.floorMix) >= .02 || Math.abs(next.lean - prior.lean) >= .3) failures.push(index);
        prior = next;
      }
      expect(failures, kind).toEqual([]);
    }
  });

  it("keeps closed everyday props as taps and keeps the saved pompom/art identity when renaming its label", () => {
    for (const kind of ["matte-turbo-lighter", "ceramic-safety-cutter", "sewing-kit", "herbal-lip-balm", "airy-velvet-tint"] as const) {
      expect(COMPANION_TOY_USES[kind]).toBe("tap");
      for (const p of [.2, .4, .6, .8]) expect(sampleCompanionToyPlay(kind, p).effect.kind).toBe("none");
    }
    expect(COMPANION_TOY_NAMES["cheer-pompom"]).toBe("SBO 응원 폼폼");
    expect(getCompanionToyArt("cheer-pompom")).toBe("/companion/home/146/toy-cheer-pompom.webp");
    expect(COMPANION_TOY_USES["cheer-pompom"]).toBe("jingle");
  });
});
