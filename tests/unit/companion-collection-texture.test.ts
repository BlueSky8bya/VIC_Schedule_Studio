import { describe, expect, it, vi } from "vitest";
import { createCompanionCollectionTextureReadiness } from "@/lib/ui/viewer-companion/collection-texture";
import { createCompanionAccessoryPainter } from "@/lib/ui/viewer-companion/accessory";
import { selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

function fixture() {
  const images: Array<{ src: string; complete: boolean; naturalWidth: number; naturalHeight: number; onload: (() => void) | null; onerror: (() => void) | null; decode: ReturnType<typeof vi.fn>; removeAttribute: ReturnType<typeof vi.fn>; resolve: () => void; reject: () => void }> = [];
  const factory = vi.fn(() => {
    let resolve!: () => void, reject!: () => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = () => no(new Error("decode failed")); });
    const image = { src: "", complete: false, naturalWidth: 0, naturalHeight: 0, onload: null as (() => void) | null, onerror: null as (() => void) | null, decode: vi.fn(() => promise), removeAttribute: vi.fn(), resolve, reject };
    images.push(image); return image as unknown as HTMLImageElement;
  });
  const loaded = (index: number) => { const image = images[index]; image.complete = true; image.naturalWidth = 768; image.naturalHeight = 512; image.onload?.(); };
  return { factory, images, loaded, readiness: createCompanionCollectionTextureReadiness(factory) };
}

describe("bounded current collection texture evidence", () => {
  it("requires the actual current load and completed decode, without polling retry or whole-library preload", async () => {
    const f = fixture(); f.readiness.use(["/equipped.webp", "/gift.webp", "/not-current.webp"]);
    expect(f.factory).toHaveBeenCalledTimes(2); expect(f.readiness.ready("/equipped.webp")).toBe(false);
    for (let frame = 0; frame < 200; frame++) f.readiness.use(["/equipped.webp", "/gift.webp"]);
    expect(f.factory).toHaveBeenCalledTimes(2);
    f.loaded(0); expect(f.readiness.ready("/equipped.webp")).toBe(false);
    f.images[0].resolve(); await Promise.resolve(); expect(f.readiness.ready("/equipped.webp")).toBe(true);
    expect(f.readiness.ready("/gift.webp")).toBe(false); expect(f.readiness.ready("/not-current.webp")).toBe(false);
    f.images[1].onerror?.(); for (let frame = 0; frame < 200; frame++) f.readiness.use(["/equipped.webp", "/gift.webp"]);
    expect(f.factory).toHaveBeenCalledTimes(2); expect(f.readiness.ready("/gift.webp")).toBe(false);
  });
  it("discards late completion after equipment changes, unequip or controller disposal", async () => {
    const f = fixture(); f.readiness.use(["/old.webp"]); f.loaded(0);
    f.readiness.use(["/new.webp"]); expect(f.images[0].onload).toBeNull(); expect(f.images[0].removeAttribute).toHaveBeenCalledWith("src");
    f.images[0].resolve(); await Promise.resolve(); expect(f.readiness.ready("/old.webp")).toBe(false);
    f.loaded(1); f.readiness.clear(); f.images[1].resolve(); await Promise.resolve();
    expect(f.readiness.ready("/new.webp")).toBe(false); expect(f.images[1].onerror).toBeNull();
  });
  it("ties accessory and gift witnesses to the currently painted atlas, and rejects decode failure", async () => {
    const f = fixture(), host = () => ({ hidden: true, style: { setProperty() {} } }) as unknown as HTMLElement;
    const painter = createCompanionAccessoryPainter({ back: host(), front: host(), gift: host() }, f.readiness);
    painter.paint(selectCompanionSprite(0), "pixel-sunglasses", true);
    expect(painter.accessoryReady()).toBe(false); expect(painter.giftReady()).toBe(false); expect(f.factory).toHaveBeenCalledTimes(2);
    f.loaded(0); f.images[0].resolve(); await Promise.resolve(); expect(painter.accessoryReady()).toBe(true); expect(painter.giftReady()).toBe(false);
    f.loaded(1); f.images[1].reject(); await Promise.resolve(); await Promise.resolve(); expect(painter.giftReady()).toBe(false);
    painter.paint(selectCompanionSprite(0), null, false); expect(painter.accessoryReady()).toBe(false); expect(painter.giftReady()).toBe(false);
    painter.clear(); expect(f.images.every(image => image.onload === null && image.onerror === null)).toBe(true);
  });
});
