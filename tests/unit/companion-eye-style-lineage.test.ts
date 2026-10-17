import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

type Slot = { index: number; family: string; key: number; live: boolean };
type Result = { slots: Slot[]; rows: number[][]; liveSlots: number; activeLiveSlots: number; compatibilityOnlySlots: number[]; liveKeys: string[]; deadSlots: number[] };
let proof: { map: Result; inputsUnchanged: boolean; invalidHd: boolean; missingFlight: boolean; badRow: boolean; invalidPlayKey: boolean; separateMarkAlpha: number; faceRigid: boolean };

beforeAll(() => {
  // Exercise the exported mechanical map without reading/painting any native
  // bitmap or writing generated output. Keep .mjs out of the Next TS graph.
  const program = `
    import fs from 'node:fs';
    import { createEyeStyleMap, bakeEyeStyleKey } from './scripts/prepare-companion-eye-style.mjs';
    const json = name => JSON.parse(fs.readFileSync(name, 'utf8'));
    const base = json('lib/ui/viewer-companion/hd-motion-sprite.json');
    const play = json('lib/ui/viewer-companion/play-motion-sprite.json');
    const receipts = {
      hd: json('art-src/빅타민/동행/작업회차/20261015-전동작고해상도/파생기록.json'),
      play: json('art-src/빅타민/동행/작업회차/20261016-덤벙놀이/패킹파생기록.json'),
      ear: json('art-src/빅타민/동행/작업회차/20261016-귀두개교정/패킹파생기록.json'),
      recovery: json('art-src/빅타민/동행/작업회차/20261017-어지럼회복/패킹파생기록.json'),
      throw: json('art-src/빅타민/동행/작업회차/20261017-관성비행/패킹파생기록.json'),
    };
    const before = JSON.stringify([base, play, receipts]);
    const map = createEyeStyleMap(base, play, receipts);
    // Minimal geometry-only RGBA fixture: a rectangle and a separate square.
    // This is not character artwork and never reads/rewrites a native asset.
    const rgba = Buffer.alloc(32 * 32 * 4);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) rgba.set([255,255,255,255], (y * 32 + x) * 4);
    for (let y = 5; y < 8; y++) for (let x = 2; x < 5; x++) rgba.set([255,0,0,255], (y * 32 + x) * 4);
    const baked = bakeEyeStyleKey({ rgba, width:32, height:32, body:{ left:8,top:8,right:24,bottom:24,width:16,height:16 }, visible:{left:2,top:5,right:24,bottom:24,width:22,height:19}, face:{ featureBounds:{left:12,top:14,right:20,bottom:17}, protected:{left:0,top:0,right:32,bottom:32}, fade:1 } }, { sx:1,sy:1,tilt:0,sway:0,ears:[{x:0,y:0},{x:0,y:0}] }, 4);
    const rejects = change => { const copy = structuredClone({ base, play, receipts }); change(copy); try { createEyeStyleMap(copy.base, copy.play, copy.receipts); return false; } catch { return true; } };
    console.log(JSON.stringify({ map, inputsUnchanged: before === JSON.stringify([base, play, receipts]), separateMarkAlpha:baked.data[(112 * 192 + 60) * 4 + 3], faceRigid:baked.faceProtection.minimumRigidWeight === 1 && baked.faceProtection.maximumFeatureDeviation === 0,
      invalidHd: rejects(x => { x.receipts.hd.cells[0].rig.sourceId = 'old-rgb-fallback'; }),
      missingFlight: rejects(x => { x.play.frames.pop(); }),
      badRow: rejects(x => { x.play.rows[12][0] = 208; }),
      invalidPlayKey: rejects(x => { x.receipts.play.packets[0].nativeIndicesByColumn[0] = 36; }),
    }));
  `;
  proof = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", program], { cwd: process.cwd(), encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }));
});

describe("new-eye whole-source lineage", () => {
  it("retains the complete512-slot/33-row topology including legacy dead slots", () => {
    expect(proof.map.slots).toHaveLength(512); expect(proof.map.rows).toHaveLength(33);
    expect(proof.map.liveSlots).toBe(451); expect(proof.map.liveKeys).toHaveLength(71);
    expect(proof.map.activeLiveSlots).toBe(450); expect(proof.map.compatibilityOnlySlots).toEqual([127]);
    expect(proof.map.deadSlots).toHaveLength(61); expect(proof.inputsUnchanged).toBe(true);
    expect(new Set(proof.map.slots.map(slot => slot.index)).size).toBe(512);
  });

  it("routes the four selective ear replacements to their complete corrected keys", () => {
    for (const [index, key] of [[331, 0], [376, 1], [422, 2], [432, 3]]) {
      expect(proof.map.slots[index]).toMatchObject({ family: "ear", key });
    }
    expect(proof.map.slots[330]).toMatchObject({ family: "play", key: 9 });
    expect(proof.map.slots[439]).toMatchObject({ family: "ear", key: 3 });
    expect(proof.map.slots[440]).toMatchObject({ family: "play", key: 28 });
  });

  it("keeps newer recovery and airborne keys after the older ear-correction lineage", () => {
    for (let column = 0; column < 16; column++) {
      expect(proof.map.slots[352 + column]).toMatchObject({ family: "recovery", key: Math.floor(column / 4) });
      expect(proof.map.slots[496 + column]).toMatchObject({ family: "throw", key: Math.floor(column / 4), live: true });
    }
    expect(proof.map.rows[32]).toEqual(Array.from({ length: 16 }, (_, i) => 496 + i));
  });

  it("fails closed on fallback sources, missing newer slots or invalid source references", () => {
    expect(proof.invalidHd).toBe(true); expect(proof.missingFlight).toBe(true);
    expect(proof.badRow).toBe(true); expect(proof.invalidPlayKey).toBe(true);
  });

  it("retains a separate authored mark beyond bodyBCR plus4 without independently warping the face", () => {
    expect(proof.separateMarkAlpha).toBe(255); expect(proof.faceRigid).toBe(true);
  });
});
