import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

type Fit = { requestedScale: number; scale: number; safetyCapped: boolean; offset: { x: number; y: number }; protectedBounds: { left: number; top: number; right: number; bottom: number } };
let proof: {
  absent: boolean; scales: number[]; unchanged: boolean; invalid: boolean[];
  ordinary: Fit; withMarks: Fit; oversized: Fit; tilted: Fit;
  bodyWidth: number; otherWidth: number; tiltedBodyWidth: number;
  retainedGeometry: { orange: number; white: number; red: number; sourceUnchanged: boolean; uniformScale: number };
};

beforeAll(() => {
  // Geometry/provenance fixtures only. Never paints, repairs or approves a
  // mascot; no generated bitmap, packet or repository file is written.
  const program = `
    import { createFamilyBodyRegistration, fitFamilyBodyScale, prepareFamilyKey } from './scripts/prepare-companion-eye-style.mjs';
    const ids = ['clean', 'mood', 'play', 'ear', 'recovery', 'throw', 'audience'];
    const families = {}, sources = {};
    ids.forEach((id, index) => {
      const width = 200 + index * 40, sha256 = String(index + 1).repeat(64);
      families[id] = { key: 0, sourceSha256: sha256, bodyBounds: { left: 30, top: 80, right: 30 + width, bottom: 220 } };
      sources[id] = { record: { sha256 }, keys: [{ record: { body: { left: 20, top: 20, right: 40 + width, bottom: 230 } } }] };
    });
    const profile = { version: 1, mode: 'family-body-isotropic', bodyWidth: 120, audienceBodyWidth: 180, families };
    const before = JSON.stringify([profile, sources]);
    const registration = createFamilyBodyRegistration(profile, sources);
    const key = { body: { left: 20, top: 20, right: 220, bottom: 200 }, alpha: { left: 20, top: 20, right: 220, bottom: 200, width: 200, height: 180 } };
    const withMarks = { ...key, alpha: { left: 10, top: 10, right: 230, bottom: 200, width: 220, height: 190 } };
    const oversized = { ...key, alpha: { left: -80, top: -90, right: 320, bottom: 235, width: 400, height: 325 } };
    const rig = { sx: 1.01, sy: .99, tilt: .12, sway: 2, ears: [{ x: -1, y: 1 }, { x: 2, y: -1 }] };
    const scale = registration.families.clean.requestedScale;
    const ordinary = fitFamilyBodyScale(key, scale), marked = fitFamilyBodyScale(withMarks, scale), capped = fitFamilyBodyScale(oversized, scale), tilted = fitFamilyBodyScale(key, scale, rig);
    const rgba = Buffer.alloc(256 * 256 * 4);
    const rectangle = (left, top, right, bottom, color) => { for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) rgba.set(color, (y * 256 + x) * 4); };
    rectangle(70, 130, 190, 230, [255,255,255,255]); rectangle(90, 50, 110, 130, [255,140,0,255]); rectangle(220, 170, 230, 180, [255,0,0,255]);
    const original = Buffer.from(rgba), pixels = { rgba, width:256, height:256, body:{left:70,top:50,right:190,bottom:230}, alpha:{left:70,top:50,right:230,bottom:230,width:160,height:180} };
    const prepared = await prepareFamilyKey(pixels, fitFamilyBodyScale(pixels, scale));
    const retainedGeometry = {orange:0,white:0,red:0,sourceUnchanged:original.equals(rgba),uniformScale:prepared.uniformScale};
    for (let i = 0; i < prepared.data.length; i += 4) if (prepared.data[i+3] > 200) { const [r,g,b] = prepared.data.subarray(i,i+3); if (r > 240 && g > 240 && b > 240) retainedGeometry.white++; if (r > 240 && g > 110 && g < 165 && b < 20) retainedGeometry.orange++; if (r > 240 && g < 20 && b < 20) retainedGeometry.red++; }
    const rejects = change => { const p = structuredClone(profile); change(p); try { createFamilyBodyRegistration(p, sources); return false; } catch { return true; } };
    console.log(JSON.stringify({ absent: createFamilyBodyRegistration(undefined, {}) === undefined,
      scales: ids.map(id => registration.families[id].requestedScale), unchanged: before === JSON.stringify([profile, sources]),
      invalid: [rejects(p => { delete p.families.ear; }), rejects(p => { p.families.clean.sourceSha256 = 'f'.repeat(64); }), rejects(p => { p.families.clean.key = 1; }), rejects(p => { p.families.clean.bodyBounds.left = 0; }), rejects(p => { p.families.clean.bodyBounds.right = 30; }), rejects(p => { p.bodyWidth = 1000; }), rejects(p => { p.families.clean.bodyBounds.right = 31; })],
      ordinary, withMarks: marked, oversized: capped, tilted,
      bodyWidth: (key.body.right - key.body.left) * ordinary.scale, otherWidth: 170 * ordinary.scale, tiltedBodyWidth: (key.body.right - key.body.left) * tilted.scale,
      retainedGeometry,
    }));
  `;
  proof = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", program], { cwd: process.cwd(), encoding: "utf8" }));
});

describe("new-run canonical family registration", () => {
  it("leaves historical manifests on their original packing path and pins every new-family body", () => {
    expect(proof.absent).toBe(true); expect(proof.unchanged).toBe(true);
    expect(proof.scales).toEqual([120 / 200, 120 / 240, 120 / 280, 120 / 320, 120 / 360, 120 / 400, 180 / 440]);
    expect(proof.invalid).toEqual(Array(7).fill(true));
  });

  it("preserves relative authored body/ear dimensions without historical key envelopes or effect-based rescaling", () => {
    expect(proof.ordinary.requestedScale).toBe(.6); expect(proof.ordinary.scale).toBe(.6);
    expect(proof.withMarks.scale).toBe(proof.ordinary.scale); expect(proof.withMarks.safetyCapped).toBe(false);
    expect(proof.bodyWidth).toBe(120); expect(proof.otherWidth / proof.bodyWidth).toBe(170 / 200);
  });

  it("caps the entire oversized pose uniformly while retaining every alpha-bound region", () => {
    const fit = proof.oversized, bounds = fit.protectedBounds;
    expect(fit.safetyCapped).toBe(true); expect(fit.scale).toBeGreaterThan(0); expect(fit.scale).toBeLessThan(fit.requestedScale);
    expect(bounds.left).toBeGreaterThanOrEqual(5); expect(bounds.top).toBeGreaterThanOrEqual(5);
    expect(bounds.right).toBeLessThanOrEqual(187); expect(bounds.bottom).toBeLessThanOrEqual(187);
    expect(bounds.right - bounds.left).toBeLessThanOrEqual(145); expect(bounds.bottom - bounds.top).toBeLessThanOrEqual(157);
    expect((bounds.right - bounds.left - 4) / (bounds.bottom - bounds.top - 4)).toBeCloseTo(400 / 325, 9);
  });

  it("translates a tilted whole pose into padding instead of shrinking it to satisfy an old bottom anchor", () => {
    expect(proof.tilted.safetyCapped).toBe(false); expect(proof.tilted.scale).toBe(.6);
    expect(proof.tilted.offset.y).toBeLessThan(0); expect(proof.tiltedBodyWidth).toBe(proof.bodyWidth);
    expect(proof.tilted.protectedBounds.bottom).toBeCloseTo(187, 9);
  });

  it("packs the connected shape and detached mark together without changing the source pixels", () => {
    expect(proof.retainedGeometry.sourceUnchanged).toBe(true); expect(proof.retainedGeometry.uniformScale).toBe(.6);
    expect(proof.retainedGeometry.white).toBeGreaterThan(4000); expect(proof.retainedGeometry.orange).toBeGreaterThan(450); expect(proof.retainedGeometry.red).toBeGreaterThan(20);
  });
});
