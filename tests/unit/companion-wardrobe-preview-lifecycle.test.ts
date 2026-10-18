import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  nodes: [] as unknown[], ref: 0, effects: [] as Array<() => void | (() => void)>,
  ready: new Set<string>(), requests: [] as string[], releases: new Map<string, (ready: boolean) => void>(),
  observers: [] as Array<() => void>, reduced: false,
  image: { naturalWidth: 1536, naturalHeight: 384 },
  paint: vi.fn(), clear: vi.fn(),
}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(),
  useRef: () => ({ current: harness.nodes[harness.ref++] }),
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock("@/lib/ui/viewer-companion/accessory", () => ({ createCompanionAccessoryPainter: () => ({ paint: harness.paint, clear: harness.clear }) }));
vi.mock("@/lib/ui/viewer-companion/sprite-quality", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/ui/viewer-companion/sprite-quality")>(),
  peekDecodedCompanionSprite: (src: string) => harness.ready.has(src) ? harness.image : undefined,
  decodeCompanionSprite: (src: string) => { harness.requests.push(src); return new Promise<boolean>(resolve => harness.releases.set(src, ready => { if (ready) harness.ready.add(src); resolve(ready); })); },
}));

type Host = { isConnected: boolean; dataset: Record<string, string>; style: Record<string, string>; removeAttribute: (name: string) => void };
let doc: EventTarget & { hidden: boolean }, host: Host, draws: ReturnType<typeof vi.fn>, cleanup: (() => void) | undefined;
let rafs: Map<number, FrameRequestCallback>, nextRaf: number;
const settle = async () => { for (let turn = 0; turn < 12; turn++) await Promise.resolve(); };
async function mount(enabled = true, warm = true, accessory: "beret" | null = "beret") {
  // Vitest's JSX transform uses the classic factory; Next supplies its own
  // automatic JSX runtime in production. This changes only the unit harness.
  vi.stubGlobal("React", await import("react"));
  const sprites = await import("@/lib/ui/viewer-companion/sprite-quality");
  if (warm) for (const row of [0, 30]) for (const src of sprites.companionSpriteSources(row)) harness.ready.add(src);
  harness.ref = 0; harness.effects = [];
  const { CompanionWardrobePreview } = await import("@/components/shared/companion-wardrobe-preview");
  CompanionWardrobePreview({ accessory, behaviors: ["groom"], enabled });
  cleanup = harness.effects[0]() || undefined;
  await vi.dynamicImportSettled();
  await settle();
}
function frame(now: number) {
  const [id, callback] = rafs.entries().next().value!;
  rafs.delete(id); callback(now);
}
beforeEach(() => {
  vi.useFakeTimers(); harness.ready.clear(); harness.requests = []; harness.releases.clear(); harness.observers = []; harness.reduced = false; harness.paint.mockClear(); harness.clear.mockClear();
  draws = vi.fn(); rafs = new Map(); nextRaf = 0;
  const node = (): Host => ({ isConnected: true, dataset: {}, style: {}, removeAttribute(name) { if (name === "data-preview-ready") delete this.dataset.previewReady; } });
  host = node();
  harness.nodes = [host, { width: 192, height: 192, getContext: () => ({ clearRect: vi.fn(), drawImage: draws }) }, node(), node(), node(), node(), node()];
  doc = Object.assign(new EventTarget(), { hidden: false, documentElement: { dataset: { gfx: "full" }, hasAttribute: (name: string) => name === "data-reduce-motion" && harness.reduced } });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { const id = ++nextRaf; rafs.set(id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { rafs.delete(id); });
  vi.stubGlobal("MutationObserver", class { constructor(callback: () => void) { harness.observers.push(callback); } observe() {} disconnect() {} });
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("actual preview effect cancellation in a unit DOM harness", () => {
  it("cancels a scheduled frame on hidden, ignores a late callback and resumes a fresh clip", async () => {
    await mount(); expect(rafs.size).toBe(1); frame(100);
    expect(host.dataset.previewRow).toBe("30");
    const stale = [...rafs.values()][0], count = draws.mock.calls.length;
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange")); await settle();
    expect(rafs.size).toBe(0); stale(200); vi.advanceTimersByTime(10000);
    expect(draws).toHaveBeenCalledTimes(count); expect(vi.getTimerCount()).toBe(0);
    doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange")); await settle();
    expect(rafs.size).toBe(1); expect(host.dataset.previewRow).toBe("0");
  });
  it("cancels the real rest timeout without starting a hidden replay", async () => {
    await mount(); frame(3000); await settle();
    expect(host.dataset.previewRow).toBe("0"); expect(rafs.size).toBe(0); expect(vi.getTimerCount()).toBe(1);
    const count = draws.mock.calls.length;
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange")); await settle();
    expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(10000); await settle();
    expect(draws).toHaveBeenCalledTimes(count); expect(rafs.size).toBe(0);
  });
  it("reduces to neutral and removes all frame/rest work on unmount", async () => {
    await mount(); frame(100);
    harness.reduced = true; harness.observers[0](); await settle();
    expect(host.dataset.previewRow).toBe("0"); expect(rafs.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    harness.reduced = false; harness.observers[0](); await settle();
    const stale = [...rafs.values()][0]; cleanup!(); cleanup = undefined;
    const count = draws.mock.calls.length; stale(300); vi.advanceTimersByTime(10000);
    expect(draws).toHaveBeenCalledTimes(count); expect(rafs.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    expect(host.dataset.previewReady).toBeUndefined();
  });
  it("shows a static base portrait while OFF without a frame or rest loop", async () => {
    await mount(false);
    expect(harness.requests).toEqual([]); expect(draws).toHaveBeenCalledTimes(1); expect(host.dataset.previewRow).toBe("0"); expect(rafs.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it("paints an undecorated portrait without allocating an attachment painter", async () => {
    await mount(false, true, null);
    expect(draws).toHaveBeenCalledTimes(1); expect(harness.paint).not.toHaveBeenCalled(); expect(host.dataset.previewAccessory).toBe("none");
  });
  it("rejects late shared decode completion after becoming hidden", async () => {
    await mount(true, false); expect(harness.requests).toHaveLength(1);
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
    harness.releases.get(harness.requests[0])!(true); await settle();
    expect(draws).not.toHaveBeenCalled(); expect(rafs.size).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(host.dataset.previewReady).toBeUndefined();
  });
});
