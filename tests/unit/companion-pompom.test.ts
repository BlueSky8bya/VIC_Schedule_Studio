import { describe, expect, it } from "vitest";
import sharp from "sharp";
import edition from "@/lib/ui/viewer-companion/appearance-edition.json";
import { companionPompomProtectedY } from "@/lib/ui/viewer-companion/ear-painter";
import { sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";
import { sampleCompanionAccessoryMotion, COMPANION_ACCESSORY_MOTION_MS } from "@/lib/ui/viewer-companion/accessory-motion";
import { COMPANION_ACCESSORIES } from "@/lib/ui/viewer-companion/accessory-catalog";
import type { CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { sampleCompanionRadioReaction, COMPANION_RADIO_REACTION_MS } from "@/lib/ui/viewer-companion/radio-reaction";
import { sampleCompanionPreview, companionPreviewDuration } from "@/lib/ui/viewer-companion/wardrobe-preview";
import { sampleCompanionPremiereTravel } from "@/lib/ui/viewer-companion/premiere-travel";
import { companionPompomPlayHeight, createCompanionPompomFlight, sampleCompanionPompom, warpCompanionPompom } from "@/lib/ui/viewer-companion/pompom";

describe("pompom airborne material", () => {
  it("scales ascent/apex/descent response to both tiny and tall hops", () => {
    expect(sampleCompanionPompom(-450, 40, 40)).toBeLessThan(-.2);
    expect(sampleCompanionPompom(450, 40, 40)).toBeCloseTo(.2);
    expect(sampleCompanionPompom(-35, 3, 5)).toBeLessThan(-.005);
    expect(sampleCompanionPompom(35, 3, 5)).toBeGreaterThan(.005);
    for (const speed of [-3, 0, 3]) expect(sampleCompanionPompom(speed, 5, 5)).toBe(0);
    expect(sampleCompanionPompom(450, 0, 40)).toBe(0);
  });
  it("resets on contact, quiet/held state, a new action and a suspended clock", () => {
    const sampler = createCompanionPompomFlight();
    const input = { now: 0, y: 100, height: 0, token: "hop", active: true };
    expect(sampler.sample(input)).toBeUndefined();
    expect(sampler.sample({ ...input, now: 20, y: 90, height: 10 })).toBeLessThan(-.2);
    expect(sampler.sample({ ...input, now: 40, y: 90, height: 10 })).toBe(0);
    expect(sampler.sample({ ...input, now: 60, y: 95, height: 5 })).toBeGreaterThan(.1);
    expect(sampler.sample({ ...input, now: 80 })).toBeUndefined();
    expect(sampler.sample({ ...input, now: 100, y: 90, height: 10, quiet: true })).toBeUndefined();
    expect(sampler.sample({ ...input, now: 120, y: 90, height: 10, active: false })).toBeUndefined();
    expect(sampler.sample({ ...input, now: 140, y: 90, height: 10 })).toBe(0);
    expect(sampler.sample({ ...input, now: 400, y: 95, height: 5 })).toBe(0);
    expect(sampler.sample({ ...input, now: 420, y: 80, height: 20, token: "new" })).toBe(0);
    expect(input).toEqual({ now: 0, y: 100, height: 0, token: "hop", active: true });
  });
  it("applies to every authored play hop and keeps grounded gestures quiet", () => {
    for (const kind of Object.keys(COMPANION_PLAY_TIMING) as CompanionPlay[]) {
      const sampler = createCompanionPompomFlight(), amounts: number[] = []; let lifted = false;
      const duration = COMPANION_PLAY_TIMING[kind].duration;
      for (let now = 0; now <= duration + 20; now += 16) {
        const pose = sampleCompanionPlay(kind, now / duration), height = companionPompomPlayHeight(kind, pose);
        lifted ||= height > .5;
        const amount = sampler.sample({ now, y: pose.lift, height, token: kind, active: height > 0 });
        if (amount !== undefined) amounts.push(amount);
      }
      if (lifted) { expect(Math.min(...amounts), kind).toBeLessThan(0); expect(Math.max(...amounts), kind).toBeGreaterThan(0); }
    }
    for (const kind of ["ask-petting", "lean-nuzzle", "cozy-nest", "doze-curl", "odd-food-reaction"])
      expect(companionPompomPlayHeight(kind, { lift: -1.4, beat: "play" })).toBe(0);
    expect(companionPompomPlayHeight(undefined, { lift: -4, beat: "play" }, "music")).toBe(4);
    expect(companionPompomPlayHeight(undefined, { lift: -1.4, beat: "play" }, "cube-turn")).toBe(0);
  });
  it("covers repeated cheers, wardrobe pounce/tumble, all hat hops, music and premiere arcs", () => {
    const observe = (name: string, duration: number, pose: (age: number) => { y: number; height: number }) => {
      const flight = createCompanionPompomFlight(), values: number[] = []; let lifted = false;
      for (let now = 0; now <= duration + 16; now += 16) {
        const p = pose(now); lifted ||= p.height > .5;
        const value = flight.sample({ ...p, now, token: name, active: p.height > 0 });
        if (value !== undefined) values.push(value);
      }
      if (lifted) { expect(Math.min(...values), name).toBeLessThan(0); expect(Math.max(...values), name).toBeGreaterThan(0); }
    };
    for (const id of Object.keys(COMPANION_ACCESSORIES) as CompanionAccessoryId[]) observe(id, COMPANION_ACCESSORY_MOTION_MS, age => {
      const p = sampleCompanionAccessoryMotion(id, age); return { y: -p.bodyLift, height: p.bodyLift };
    });
    for (const id of ["cheer-rehearsal", "pounce", "tumble"] as const) observe("preview-" + id, companionPreviewDuration(id), age => {
      const p = sampleCompanionPreview(id, age); return { y: p.lift, height: companionPompomPlayHeight(id, p) };
    });
    observe("music-bounce", COMPANION_RADIO_REACTION_MS, age => {
      const p = sampleCompanionRadioReaction("bounce", age, 120); return { y: p.bob, height: Math.max(0, -p.bob) };
    });
    for (const returning of [false, true]) observe("premiere-" + returning, 1000, age => {
      const p = sampleCompanionPremiereTravel({ x: 100, y: 400, scale: 1 }, { x: 300, y: 400, scale: 1 }, Math.min(1, age / 1000), 92, returning);
      return { y: p.y, height: p.lift };
    });
  });
  it("preserves protected face RGBA and apparent alpha area on every registered body cell", async () => {
    const indices = edition.frames.map(frame => frame.physicalIndex);
    const packets = new Map<number, Buffer>();
    for (const index of indices) {
      const frame = edition.frames.find(frame => frame.physicalIndex === index)!;
      if (!packets.has(frame.atlas)) packets.set(frame.atlas, await sharp("public" + edition.packets[frame.atlas].src).ensureAlpha().raw().toBuffer());
      const packet = edition.packets[frame.atlas], pixels = packets.get(frame.atlas)!, part = frame.parts[0], source = new Uint8ClampedArray(192 * 192 * 4);
      for (let y = 0; y < part.source.height; y++) {
        const from = ((part.source.y + y) * packet.width + part.source.x) * 4;
        source.set(pixels.subarray(from, from + part.source.width * 4), ((part.top + y) * 192 + part.left) * 4);
      }
      const protectedY = Math.min(192, companionPompomProtectedY(index));
      const area = (data: Uint8ClampedArray) => { let sum = 0; for (let i = 3; i < data.length; i += 4) sum += data[i] / 255; return sum; };
      for (const gain of [-.22, -.1, .1, .2]) {
        const warped = warpCompanionPompom(source, 192, 192, protectedY, part.bottom + 1, frame.material.pivot.x * 2.4, gain);
        expect(Buffer.from(warped.buffer, 0, protectedY * 192 * 4).equals(Buffer.from(source.buffer, 0, protectedY * 192 * 4)), `protected face ${index}`).toBe(true);
        expect(Math.abs(area(warped) / area(source) - 1), `area ${index}/${gain}`).toBeLessThan(.01);
        expect(warped.filter((_, i) => i % 4 === 3).slice(-192).every(alpha => alpha === 0), `bottom clip ${index}`).toBe(true);
      }
      expect(warpCompanionPompom(source, 192, 192, protectedY, part.bottom + 1, 96, 0)).toBe(source);
    }
  });
});
