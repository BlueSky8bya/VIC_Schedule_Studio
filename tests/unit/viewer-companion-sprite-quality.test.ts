import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { companionMotionClips, companionSpriteMetadata, companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { createCompanionMotion } from "@/lib/ui/viewer-companion/motion";
import { sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import sprites from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import living from "@/lib/ui/viewer-companion/living-motion-sprite.json";
import legacy from "@/lib/ui/viewer-companion/fluid-sprite.json";
import bodyRegistration from "../../art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json";
import expression119 from "../../art-src/빅타민/동행/작업회차/20261019-표정체적교정119/패킹파생기록.json";

describe("116 whole-pose continuity", () => {
  // Review sheet labels are one-based; the frozen packing receipt is zero-based.
  const nativeKeys = new Map(bodyRegistration.slots.map(slot => [slot.index, slot.nativeCell + 1]));
  it("keeps a sustained moving sprint side-facing without upright, closed-eye or large-eye inserts", () => {
    const motion = createCompanionMotion({ clips: companionMotionClips, rowCount: companionSpriteMetadata.rows.length, loopRows: [20] });
    const seen = new Set<number>();
    for (let step = 0; step <= 600; step++) {
      const pose = motion.sample({ row: 20, phase: 0, status: "sprint", x: 100 + step * 220 / 60, y: 300, now: step * 1000 / 60 });
      const key = nativeKeys.get(companionSpriteMetadata.rows[pose.row][pose.column])!;
      expect([33, 34, 35]).toContain(key); seen.add(key);
    }
    expect([...seen].sort()).toEqual([33, 34, 35]);
  });
  it("preserves the unsettled spiral expression across all dizzy phases without smiling key45", () => {
    const motion = createCompanionMotion({ clips: companionMotionClips, rowCount: companionSpriteMetadata.rows.length });
    const seen = new Set<number>();
    for (let step = 0; step <= 120; step++) {
      const pose = motion.sample({ row: 22, phase: step / 120, status: "play", x: 100, y: 300, now: step * 1000 / 60 });
      expect(nativeKeys.get(companionSpriteMetadata.rows[pose.row][pose.column])).toBe(44);
      seen.add(pose.column);
    }
    expect(seen.size).toBe(8);
    expect(companionMotionClips[23]).toEqual(companionSpriteMetadata.rows[23].map((_, column) => column));
  });
});

describe("one high-resolution pipeline for every companion action", () => {
  it("preserves every old phase and adds complete disappointed/sulky actions", () => {
    expect(sprites).toMatchObject({ version: 1, cell: 192, logicalCell: 80, grid: 8, gridRows: 2 });
    expect(sprites.frames).toHaveLength(304); expect(sprites.rows).toHaveLength(20);
    expect(sprites.rows.slice(0, 18)).toEqual(legacy.rows);
    expect(sprites.rows[18]).toEqual(Array.from({ length: 16 }, (_, index) => 272 + index));
    expect(sprites.rows[19]).toEqual(Array.from({ length: 16 }, (_, index) => 288 + index));
    // Keep117 rise, the119 body packets and only three120 replacements active.
    const replacements: Partial<Record<number, string>> = {
      0: "/companion/hd/vitamin-action-00-eye-contour-120-v1.webp",
      4: "/companion/hd/vitamin-action-04-tuft-117-v1.webp",
      16: "/companion/hd/vitamin-action-16-eye-contour-120-v1.webp",
    };
    const eye120 = JSON.parse(readFileSync("art-src/빅타민/동행/작업회차/20261019-눈매윤곽교정120/패킹파생기록.json", "utf8")) as typeof expression119;
    expect(eye120.packets.map(packet => packet.atlas)).toEqual([0, 16, 32]);
    for (const replacement of expression119.packets) expect(companionSpriteMetadata.atlases[replacement.atlas]).toEqual(eye120.packets.find(packet => packet.atlas === replacement.atlas)?.packet ?? replacement.packet);
    for (let index = 0; index < sprites.frames.length; index++) {
      const selected = selectCompanionSprite(index);
      expect(selected).toMatchObject({ atlas: "hd", physicalIndex: index, index: index % 16, grid: 8, gridRows: 2 });
      const atlas = Math.floor(index / 16);
      expect(selected.src).toBe(sprites.atlases[atlas].src);
      expect(selected.src).toBe(replacements[atlas] ?? `/companion/hd/vitamin-action-${String(atlas).padStart(2, "0")}-motion-115-v1.webp`);
      expect(selected.frame).toEqual(sprites.frames[index]);
    }
  });
  it("registers actual bodies in80 logical units with protected stroke margins", () => {
    for (const [index, frame] of sprites.frames.entries()) {
      expect([frame.x, frame.y, ...frame.clip].every(Number.isFinite)).toBe(true);
      expect(frame.clip.every(value => value >= 0)).toBe(true);
      expect(frame.clip[0] + frame.clip[2]).toBeLessThan(80); expect(frame.clip[1] + frame.clip[3]).toBeLessThan(80);
      // Tiny nearly transparent export pixels cannot own the actual body's
      // centre or ground contact. Clip still includes the entire authored AA.
      const body = bodyRegistration.slots[index].body;
      expect((body.left + body.right) / 2 / 2.4 + frame.x).toBeCloseTo(40, 5);
      expect(body.bottom / 2.4 + frame.y).toBeCloseTo(80, 5);
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
    for (const [index, atlas] of play.atlases.entries()) expect(atlas.src).toBe(`/companion/hd/vitamin-play-${String(index).padStart(2, "0")}-${[3, 12].includes(index) ? "expression-119" : "motion-115"}-v1.webp`);
    expect(play.atlases[12].src).toBe("/companion/hd/vitamin-play-12-expression-119-v1.webp");
  });
});

describe("registered living keys", () => {
  it("maps all eight poses to one packet without altering prior actions", () => {
    expect(companionSpriteMetadata.rows).toHaveLength(41);
    expect(living.rows).toHaveLength(8);
    expect(living.atlases[0].src).toBe("/companion/hd/vitamin-episodes-00-eye-contour-120-v1.webp");
    for (let row = 33; row < 41; row++) {
      const index = companionSpriteMetadata.rows[row][0], selected = selectCompanionSprite(index, row, 0);
      expect(companionSpriteSources(row)).toEqual([living.atlases[0].src]);
      expect(selected.index).toBe(row - 33);
      expect(selected.frame).toEqual({ ...living.frames[row - 33], atlas: sprites.atlases.length + play.atlases.length });
      expect(selected.grid).toBe(8); expect(selected.gridRows).toBe(2);
      expect(selected.src).toBe(living.atlases[0].src);
    }
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

  it("borrows live pixels without moving the owner, decoding or changing eviction order", async () => {
    vi.resetModules();
    const fixture = imageFixture(), owner = {} as HTMLElement;
    try {
      const { acquireDecodedCompanionSprite: acquire, decodeCompanionSprite: decode, peekDecodedCompanionSprite: peek } = await import("@/lib/ui/viewer-companion/sprite-quality");
      expect(peek("cold")).toBeUndefined(); expect(fixture.images).toHaveLength(0);
      await decode("live"); fixture.connect(acquire("live", owner)!, owner);
      await decode("old"); await decode("recent");
      const live = peek("live")!;
      expect(live).toBe(fixture.images[0]); expect(live.parentElement).toBe(owner);
      expect(peek("old")).toBe(fixture.images[1]);
      await decode("next");
      // A preview read is not a cache touch; the old unowned packet still goes.
      expect(peek("old")).toBeUndefined(); expect(peek("recent")).toBeDefined();
      expect(peek("live")).toBe(live); expect(live.parentElement).toBe(owner);
      expect(fixture.images).toHaveLength(4); expect(fixture.images.every(image => image.srcWrites === 1)).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });

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

  it("reprepares an evicted recovery during the same dizzy row without discarding its live spiral", async () => {
    vi.resetModules();
    const fixture = imageFixture(), owner = {} as HTMLElement;
    try {
      const { acquireDecodedCompanionSprite: acquire, decodeCompanionSprite: decode, isCompanionSpriteDecoded: retained, companionSpriteSources: sources } = await import("@/lib/ui/viewer-companion/sprite-quality");
      const timing = COMPANION_PLAY_TIMING.dizzy;
      const current = sampleCompanionPlay("dizzy", 100 / timing.duration), later = sampleCompanionPlay("dizzy", 400 / timing.duration);
      expect(current.row).toBe(22); expect(later.row).toBe(current.row);
      const spiral = sources(current.row)[0], recovery = sources(timing.beats[1].row)[0];
      await decode(spiral); const live = acquire(spiral, owner)!; fixture.connect(live, owner);
      await decode(recovery);
      await decode(sources(32)[0]); await decode(sources(6)[0]);
      // Real release/landing work can replace a warm, unowned next packet.
      expect(retained(recovery)).toBe(false); expect(retained(spiral)).toBe(true);
      expect(acquire(recovery, owner)).toBeUndefined();

      fixture.held.add(recovery);
      // A subsequent existing tick still samples row22, but its future hint
      // must be allowed to reprepare row23 before the520ms beat boundary.
      const ready = decode(recovery);
      expect(decode(recovery)).toBe(ready);
      expect(fixture.images.filter(image => image.src === recovery)).toHaveLength(2);
      expect(acquire(spiral, owner)).toBe(live); expect(live.parentElement).toBe(owner);
      expect(acquire(recovery, owner)).toBeUndefined();
      fixture.release.get(recovery)!(); expect(await ready).toBe(true);
      const next = acquire(recovery, owner)!;
      expect(next).toBe(fixture.images.at(-1)); expect(next).not.toBe(live);
      expect(fixture.images.every(image => image.srcWrites === 1)).toBe(true);
      expect([spiral, recovery, sources(32)[0], sources(6)[0]].filter(retained)).toHaveLength(3);
      const requestedRecovery = sampleCompanionPlay("dizzy", 549 / timing.duration);
      expect(requestedRecovery.row).toBe(23); expect(sources(requestedRecovery.row)[0]).toBe(recovery);
      expect(retained(recovery)).toBe(true);
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
