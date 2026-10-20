import { describe, expect, it, vi } from "vitest";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { chooseCompanionPreviewBehavior, companionPreviewDrawing, companionPreviewDuration, sampleCompanionPreview } from "@/lib/ui/viewer-companion/wardrobe-preview";

describe("isolated discovered wardrobe gestures", () => {
  it("never chooses an unknown gesture and avoids immediate repeats when possible", () => {
    expect(chooseCompanionPreviewBehavior([])).toBeNull();
    expect(chooseCompanionPreviewBehavior(["unseen", "constructor", "__proto__"])).toBeNull();
    expect(chooseCompanionPreviewBehavior(["groom", "groom"], "groom", () => .9)).toBe("groom");
    expect(chooseCompanionPreviewBehavior(["groom", "bow", "unseen"], "groom", () => .999)).toBe("bow");
    expect(chooseCompanionPreviewBehavior(["groom", "bow"], null, () => Number.NaN)).toBe("groom");
  });

  it("samples only each discovered row even when its world sequence contains other gestures", () => {
    const expected = { "ask-petting": 33, "lean-nuzzle": 34, "paper-knead": 35, "paper-nest": 36, "cheer-rehearsal": 9, "doze-curl": 40, groom: 30, bow: 29, pounce: 31, tumble: 21, dizzy: 22, stretch: 16, "odd-food-reaction": 23 };
    expect(Object.keys(expected)).toEqual([...COMPANION_BEHAVIOR_IDS]);
    for (const id of COMPANION_BEHAVIOR_IDS) {
      const duration = companionPreviewDuration(id);
      expect(duration).toBeGreaterThan(0); expect(duration).toBeLessThanOrEqual(id === "cheer-rehearsal" ? 3800 : 2800);
      for (let step = 0; step < 100; step++) expect(sampleCompanionPreview(id, duration * step / 100).row).toBe(expected[id]);
      expect(sampleCompanionPreview(id, duration).row).toBe(0);
      expect(sampleCompanionPreview(id, duration + 500).row).toBe(0);
    }
    expect(sampleCompanionPreview(null, 100).row).toBe(0);
    expect(sampleCompanionPreview("bow", Number.NaN).row).toBe(0);
  });

  it("crops the native atlas cell and applies registration once outside the canvas", () => {
    for (let index = 0; index < companionSpriteMetadata.frames.length; index++) {
      const selected = selectCompanionSprite(index), drawing = companionPreviewDrawing(selected, 1536, 384);
      expect(drawing).toMatchObject({ sourceX: selected.index % 8 * 192, sourceY: Math.floor(selected.index / 8) * 192, sourceWidth: 192, sourceHeight: 192 });
      expect(drawing.x).toBe(selected.frame.x / 80 * 100); expect(drawing.y).toBe(selected.frame.y / 80 * 100);
      expect(drawing.clip).toEqual(selected.frame.clip.map(value => value / 80 * 100));
      expect(drawing.sourceX).toBeLessThan(1536); expect(drawing.sourceY).toBeLessThan(384);
    }
  });
});

describe("preview preparation uses the actual bounded decoder", () => {
  it("revisits evicted clips more than twice and restores idle without stealing a pinned world node", async () => {
    vi.resetModules();
    const images: Array<{ src: string; isConnected: boolean; parentElement: HTMLElement | null }> = [];
    vi.stubGlobal("Image", class {
      src = ""; isConnected = false; parentElement: HTMLElement | null = null;
      constructor() { images.push(this); }
      async decode() {}
    });
    try {
      const sprites = await import("@/lib/ui/viewer-companion/sprite-quality");
      const { createCompanionPreviewPreparation } = await import("@/lib/ui/viewer-companion/wardrobe-preview");
      const prepare = createCompanionPreviewPreparation(), owner = {} as HTMLElement;
      const worldSrc = sprites.companionSpriteSources(1)[0];
      await sprites.decodeCompanionSprite(worldSrc);
      const world = sprites.acquireDecodedCompanionSprite(worldSrc, owner)!;
      Object.assign(world, { isConnected: true, parentElement: owner });
      const idle = sprites.companionSpriteSources(0)[0], groom = sprites.companionSpriteSources(30)[0], bow = sprites.companionSpriteSources(29)[0];
      expect(await prepare(0, () => true)).toBe(true);
      for (let loop = 0; loop < 4; loop++) {
        expect(await prepare(30, () => true)).toBe(true);
        expect(await prepare(29, () => true)).toBe(true);
        expect(sprites.peekDecodedCompanionSprite(idle)).toBeUndefined();
        expect(await prepare(0, () => true)).toBe(true);
        expect(sprites.peekDecodedCompanionSprite(idle)).toBeDefined();
        expect([worldSrc, idle, groom, bow].filter(sprites.isCompanionSpriteDecoded)).toHaveLength(3);
        expect(sprites.peekDecodedCompanionSprite(worldSrc)).toBe(world); expect(world.parentElement).toBe(owner);
      }
      expect(images.filter(image => image.src === groom)).toHaveLength(4);
      expect(images.filter(image => image.src === idle)).toHaveLength(5);
    } finally { vi.unstubAllGlobals(); }
  });

  it("caps actual failed requests and clears a previous failure after success", async () => {
    vi.resetModules();
    const attempts = new Map<string, number>(), outcomes: boolean[] = [false, true, false, true, false, false];
    vi.stubGlobal("Image", class {
      src = ""; isConnected = false;
      async decode() { attempts.set(this.src, (attempts.get(this.src) ?? 0) + 1); if (!this.src.includes("action-00")) return; if (!outcomes.shift()) throw Error("decode failure"); }
    });
    try {
      const sprites = await import("@/lib/ui/viewer-companion/sprite-quality");
      const { createCompanionPreviewPreparation } = await import("@/lib/ui/viewer-companion/wardrobe-preview");
      const prepare = createCompanionPreviewPreparation(), idle = sprites.companionSpriteSources(0)[0];
      expect(await prepare(0, () => true)).toBe(false); expect(await prepare(0, () => true)).toBe(true);
      for (const row of [1, 29, 30]) await sprites.decodeCompanionSprite(sprites.companionSpriteSources(row)[0]);
      expect(await prepare(0, () => true)).toBe(false); expect(await prepare(0, () => true)).toBe(true);
      for (const row of [1, 29, 30]) await sprites.decodeCompanionSprite(sprites.companionSpriteSources(row)[0]);
      expect(await prepare(0, () => true)).toBe(false); expect(await prepare(0, () => true)).toBe(false);
      expect(await prepare(0, () => true)).toBe(false); expect(attempts.get(idle)).toBe(6);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not decode while inactive or continue a two-packet row after cancellation", async () => {
    vi.resetModules();
    const requested: string[] = []; let release!: () => void, current = false;
    vi.stubGlobal("Image", class { src = ""; async decode() { requested.push(this.src); await new Promise<void>(resolve => { release = resolve; }); } });
    try {
      const { createCompanionPreviewPreparation } = await import("@/lib/ui/viewer-companion/wardrobe-preview");
      const prepare = createCompanionPreviewPreparation();
      expect(await prepare(12, () => current)).toBe(false); expect(requested).toEqual([]);
      current = true; const pending = prepare(12, () => current);
      expect(requested).toHaveLength(1); current = false; release();
      expect(await pending).toBe(false); expect(requested).toHaveLength(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it("renews a failed packet after another consumer decodes it successfully", async () => {
    vi.resetModules(); let idleAttempts = 0;
    vi.stubGlobal("Image", class { src = ""; isConnected = false; async decode() { if (this.src.includes("action-00") && ++idleAttempts <= 2) throw Error("decode failure"); } });
    try {
      const sprites = await import("@/lib/ui/viewer-companion/sprite-quality");
      const { createCompanionPreviewPreparation } = await import("@/lib/ui/viewer-companion/wardrobe-preview");
      const prepare = createCompanionPreviewPreparation(), idle = sprites.companionSpriteSources(0)[0];
      expect(await prepare(0, () => true)).toBe(false); expect(await prepare(0, () => true)).toBe(false);
      expect(await sprites.decodeCompanionSprite(idle)).toBe(true);
      expect(await prepare(0, () => true)).toBe(true);
      for (const row of [1, 29, 30]) await sprites.decodeCompanionSprite(sprites.companionSpriteSources(row)[0]);
      expect(sprites.peekDecodedCompanionSprite(idle)).toBeUndefined();
      expect(await prepare(0, () => true)).toBe(true); expect(idleAttempts).toBe(4);
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not spend retries while three live foreign owners temporarily occupy the cache", async () => {
    vi.resetModules(); let created = 0;
    vi.stubGlobal("Image", class { src = ""; isConnected = false; parentElement: HTMLElement | null = null; constructor() { created++; } async decode() {} });
    try {
      const sprites = await import("@/lib/ui/viewer-companion/sprite-quality");
      const { createCompanionPreviewPreparation } = await import("@/lib/ui/viewer-companion/wardrobe-preview");
      const owned: HTMLImageElement[] = [];
      for (const row of [1, 29, 30]) {
        const src = sprites.companionSpriteSources(row)[0], owner = {} as HTMLElement;
        await sprites.decodeCompanionSprite(src);
        const image = sprites.acquireDecodedCompanionSprite(src, owner)!;
        Object.assign(image, { isConnected: true, parentElement: owner }); owned.push(image);
      }
      const prepare = createCompanionPreviewPreparation();
      for (let retry = 0; retry < 4; retry++) expect(await prepare(0, () => true)).toBe(false);
      expect(created).toBe(3);
      Object.assign(owned[0], { isConnected: false, parentElement: null });
      expect(await prepare(0, () => true)).toBe(true); expect(created).toBe(4);
      expect(owned[1].isConnected).toBe(true); expect(owned[2].isConnected).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
});
