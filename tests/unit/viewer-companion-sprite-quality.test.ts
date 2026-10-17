import { describe, expect, it, vi } from "vitest";
import { companionSpriteMetadata, companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import sprites from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
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
      expect(selected.src).toMatch(/^\/companion\/hd\/victamin-action-[0-9]{2}-big-eyes-v1\.webp$/);
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
  it("appends the throw without changing the original twenty HD or twelve play row IDs", () => {
    expect(companionSpriteMetadata.rows.slice(0, 20)).toEqual(sprites.rows);
    for (let row = 20; row < 32; row++) expect(companionSpriteMetadata.rows[row]).toEqual(Array.from({ length: 16 }, (_, column) => sprites.frames.length + (row - 20) * 16 + column));
    expect(companionSpriteMetadata.rows[32]).toEqual(Array.from({ length: 16 }, (_, column) => sprites.frames.length + 192 + column));
    expect(companionSpriteSources(32)).toEqual([play.atlases[12].src]);
    expect(play.atlases[12].src).toBe("/companion/hd/victamin-play-32-throw-big-eyes-v1.webp");
  });
});

describe("bounded decoded reference lifetime", () => {
  function imageFixture() {
    const images: PreparedImage[] = [], held = new Set<string>(), release = new Map<string, () => void>();
    class PreparedImage {
      private source = "";
      srcWrites = 0;
      isConnected = false;
      parentElement: HTMLElement | null = null;
      constructor() { images.push(this); }
      get src() { return this.source; }
      set src(value: string) { this.source = value; this.srcWrites++; }
      async decode() {
        if (held.has(this.src)) await new Promise<void>(resolve => { release.set(this.src, resolve); });
      }
    }
    vi.stubGlobal("Image", PreparedImage);
    const connect = (image: HTMLImageElement, owner: HTMLElement) => {
      const prepared = image as unknown as PreparedImage;
      prepared.isConnected = true; prepared.parentElement = owner;
    };
    return { images, held, release, connect };
  }

  it("presents the exact prepared Image without a second source assignment or stealing a live owner", async () => {
    vi.resetModules();
    const fixture = imageFixture(), owner = {} as HTMLElement, foreignOwner = {} as HTMLElement;
    try {
      const { acquireDecodedCompanionSprite: acquire, decodeCompanionSprite: decode } = await import("@/lib/ui/viewer-companion/sprite-quality");
      fixture.held.add("body");
      const ready = decode("body");
      expect(acquire("body", owner)).toBeUndefined();
      fixture.release.get("body")!(); expect(await ready).toBe(true);
      const image = acquire("body", owner)!;
      expect(image).toBe(fixture.images[0]); expect(fixture.images[0].srcWrites).toBe(1);
      fixture.connect(image, owner);
      expect(acquire("body", owner)).toBe(image);
      expect(acquire("body", foreignOwner)).toBeUndefined();
      expect(image.parentElement).toBe(owner);
      fixture.images[0].isConnected = false;
      expect(acquire("body", foreignOwner)).toBe(image);
      expect(fixture.images).toHaveLength(1); expect(fixture.images[0].srcWrites).toBe(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it("pins a displayed node while evicting only an unowned packet within the three-image budget", async () => {
    vi.resetModules();
    const fixture = imageFixture(), owner = {} as HTMLElement;
    try {
      const { acquireDecodedCompanionSprite: acquire, decodeCompanionSprite: decode, isCompanionSpriteDecoded: retained } = await import("@/lib/ui/viewer-companion/sprite-quality");
      await decode("display"); fixture.connect(acquire("display", owner)!, owner);
      await decode("old"); await decode("next"); await decode("fourth");
      expect(retained("display")).toBe(true); expect(acquire("display", owner)).toBe(fixture.images[0]);
      expect(retained("old")).toBe(false);
      expect(["display", "old", "next", "fourth"].filter(retained)).toHaveLength(3);
    } finally { vi.unstubAllGlobals(); }
  });

  it("yields when all three nodes are connected and permits a later retry after release", async () => {
    vi.resetModules();
    const fixture = imageFixture();
    try {
      const { acquireDecodedCompanionSprite: acquire, canDecodeCompanionSprite: capacity, decodeCompanionSprite: decode, isCompanionSpriteDecoded: retained } = await import("@/lib/ui/viewer-companion/sprite-quality");
      for (const src of ["one", "two", "three"]) {
        const owner = {} as HTMLElement;
        await decode(src); fixture.connect(acquire(src, owner)!, owner);
      }
      expect(capacity("fourth")).toBe(false);
      expect(await decode("fourth")).toBe(false); expect(await decode("fourth")).toBe(false);
      expect(fixture.images).toHaveLength(3);
      expect(["one", "two", "three"].every(retained)).toBe(true);
      fixture.images[0].isConnected = false;
      expect(capacity("fourth")).toBe(true); expect(await decode("fourth")).toBe(true);
      expect(retained("one")).toBe(false);
      expect(["two", "three", "fourth"].every(retained)).toBe(true);
      expect(fixture.images).toHaveLength(4);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not evict connected nodes if ownership fills the budget during an in-flight decode", async () => {
    vi.resetModules();
    const fixture = imageFixture();
    try {
      const { acquireDecodedCompanionSprite: acquire, decodeCompanionSprite: decode, isCompanionSpriteDecoded: retained } = await import("@/lib/ui/viewer-companion/sprite-quality");
      for (const src of ["one", "two", "three"]) await decode(src);
      fixture.held.add("late");
      const pending = decode("late");
      for (const src of ["one", "two", "three"]) {
        const owner = {} as HTMLElement;
        fixture.connect(acquire(src, owner)!, owner);
      }
      fixture.release.get("late")!(); expect(await pending).toBe(false);
      expect(retained("late")).toBe(false); expect(["one", "two", "three"].every(retained)).toBe(true);
      fixture.images[0].isConnected = false; fixture.held.delete("late");
      expect(await decode("late")).toBe(true);
      expect(["one", "two", "three", "late"].filter(retained)).toHaveLength(3);
      expect(fixture.images).toHaveLength(5);
    } finally { vi.unstubAllGlobals(); }
  });

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
