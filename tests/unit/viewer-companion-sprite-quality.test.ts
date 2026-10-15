import { describe, expect, it, vi } from "vitest";
import { companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import sprites from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import legacy from "@/lib/ui/viewer-companion/fluid-sprite.json";

describe("one high-resolution pipeline for every companion action", () => {
  it("preserves every old phase and adds complete disappointed/sulky actions", () => {
    expect(sprites).toMatchObject({ version: 1, cell: 192, logicalCell: 80, grid: 8, gridRows: 2 });
    expect(sprites.frames).toHaveLength(304); expect(sprites.rows).toHaveLength(20);
    expect(sprites.rows.slice(0, 18)).toEqual(legacy.rows);
    expect(sprites.rows[18]).toEqual(Array.from({ length: 16 }, (_, index) => 272 + index));
    expect(sprites.rows[19]).toEqual(Array.from({ length: 16 }, (_, index) => 288 + index));
    for (let index = 0; index < sprites.frames.length; index++) {
      const selected = selectCompanionSprite(index);
      expect(selected).toMatchObject({ atlas: "hd", physicalIndex: index, index: index % 16, grid: 8, gridRows: 2 });
      expect(selected.src).toBe(sprites.atlases[Math.floor(index / 16)].src);
      expect(selected.src).toMatch(/^\/companion\/hd\/victamin-action-[0-9]{2}\.webp$/);
      expect(selected.frame).toEqual(sprites.frames[index]);
    }
  });
  it("registers actual bodies in80 logical units with protected stroke margins", () => {
    for (const frame of sprites.frames) {
      expect([frame.x, frame.y, ...frame.clip].every(Number.isFinite)).toBe(true);
      expect(frame.clip.every(value => value >= 0)).toBe(true);
      expect(frame.clip[0] + frame.clip[2]).toBeLessThan(80); expect(frame.clip[1] + frame.clip[3]).toBeLessThan(80);
      expect((frame.clip[3] + 2 + 80 - frame.clip[1] - 2) / 2 + frame.x).toBeCloseTo(40, 5);
      expect(80 - frame.clip[2] - 2 + frame.y).toBeCloseTo(80, 5);
      const bodyWidth = 80 - frame.clip[1] - frame.clip[3] - 4;
      expect(bodyWidth).toBeLessThanOrEqual(80 * .76); expect(bodyWidth).toBeGreaterThan(35);
    }
  });
  it("preloads just the action packet and deduplicates the two-source wake", () => {
    for (const row of [0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19]) {
      expect(companionSpriteSources(row)).toHaveLength(1);
      expect(companionSpriteSources(row)).toEqual([...new Set(sprites.rows[row].map(index => selectCompanionSprite(index).src))]);
    }
    expect(companionSpriteSources(12)).toEqual([sprites.atlases[16].src, sprites.atlases[12].src]);
    expect(sprites.atlases).toHaveLength(19);
    for (const atlas of sprites.atlases) {
      expect(atlas.width).toBe(1536); expect(atlas.height).toBe(384);
      expect(atlas.sha256).toMatch(/^[a-f0-9]{64}$/); expect(atlas.bytes).toBeGreaterThan(1000);
    }
  });
  it("fails invalid indices closed to an available HD frame without legacy fallback", () => {
    expect(selectCompanionSprite(Number.NaN)).toEqual(selectCompanionSprite(0));
    expect(selectCompanionSprite(-1, 19, 7)).toEqual(selectCompanionSprite(295));
    expect(selectCompanionSprite(999, 999, Number.NaN)).toEqual(selectCompanionSprite(0));
    expect(companionSpriteSources(Number.POSITIVE_INFINITY)).toEqual(companionSpriteSources(0));
  });
});

describe("bounded decoded reference lifetime", () => {
  it("runs at most two image decoders and releases slots after failure", async () => {
    vi.resetModules();
    const release = new Map<string, () => void>(), requested: string[] = [];
    let active = 0, maximum = 0;
    class FakeImage {
      src = "";
      async decode() {
        requested.push(this.src); active++; maximum = Math.max(maximum, active);
        try {
          await new Promise<void>(resolve => { release.set(this.src, resolve); });
          if (this.src === "fail") throw Error("decode failed");
        } finally { active--; }
      }
    }
    vi.stubGlobal("Image", FakeImage);
    try {
      const { decodeCompanionSprite } = await import("@/lib/ui/viewer-companion/sprite-quality");
      const first = decodeCompanionSprite("first"), failed = decodeCompanionSprite("fail");
      const third = decodeCompanionSprite("third"), fourth = decodeCompanionSprite("fourth");
      expect(decodeCompanionSprite("third")).toBe(third);
      expect(requested).toEqual(["first", "fail"]); expect(active).toBe(2);
      release.get("first")!(); expect(await first).toBe(true);
      expect(requested).toEqual(["first", "fail", "third"]); expect(active).toBe(2);
      release.get("fail")!(); expect(await failed).toBe(false);
      expect(requested).toEqual(["first", "fail", "third", "fourth"]); expect(active).toBe(2);
      release.get("third")!(); release.get("fourth")!();
      expect(await third).toBe(true); expect(await fourth).toBe(true);
      expect(active).toBe(0); expect(maximum).toBe(2);
    } finally { vi.unstubAllGlobals(); }
  });
  it("shares in-flight work, retries failed decode and evicts least-recently-used images", async () => {
    vi.resetModules();
    let attempts = 0, release: (() => void) | undefined;
    const decodes: string[] = [];
    class FakeImage {
      src = "";
      async decode() {
        decodes.push(this.src);
        if (this.src === "failure" && attempts++ === 0) throw Error("decode failed");
        if (this.src === "pending" && decodes.filter(src => src === "pending").length === 1) await new Promise<void>(resolve => { release = resolve; });
      }
    }
    vi.stubGlobal("Image", FakeImage);
    try {
      const { decodeCompanionSprite, isCompanionSpriteDecoded } = await import("@/lib/ui/viewer-companion/sprite-quality");
      expect(isCompanionSpriteDecoded("pending")).toBe(false);
      expect(await decodeCompanionSprite("failure")).toBe(false); expect(await decodeCompanionSprite("failure")).toBe(true);
      const a = decodeCompanionSprite("pending"), b = decodeCompanionSprite("pending");
      expect(a).toBe(b); expect(decodes.filter(src => src === "pending")).toHaveLength(1);
      expect(isCompanionSpriteDecoded("pending")).toBe(false);
      release!(); expect(await a).toBe(true); expect(isCompanionSpriteDecoded("pending")).toBe(true);
      await decodeCompanionSprite("one"); await decodeCompanionSprite("two");
      await decodeCompanionSprite("one"); // Touch one; pending is now least recent.
      await decodeCompanionSprite("three");
      expect(decodes.filter(src => src === "one")).toHaveLength(1);
      expect(isCompanionSpriteDecoded("pending")).toBe(false);
      expect(isCompanionSpriteDecoded("one")).toBe(true);
      await decodeCompanionSprite("pending");
      // A fresh actual decode verifies eviction, rather than a permanent
      // success Promise that incorrectly implies retained decoded storage.
      expect(decodes.filter(src => src === "pending")).toHaveLength(2);
      expect(isCompanionSpriteDecoded("pending")).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
});
