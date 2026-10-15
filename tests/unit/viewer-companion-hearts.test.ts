import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_HEARTS_KEY, MAX_COMPANION_HEARTS, createCompanionHearts, readCompanionHeartIds } from "@/lib/ui/viewer-companion/hearts";

describe("companion heart public-id memory", () => {
  it("ignores malformed, unsupported and unstructured data", () => {
    for (const raw of [null, "{", "[]", '{"version":2,"ids":["public-event"]}', '{"version":1,"ids":"public-event"}']) expect(readCompanionHeartIds(raw)).toEqual([]);
  });
  it("allowlists bounded public ids without importing any associated fields", () => {
    const raw = JSON.stringify({ version: 1, title: "SYNTHETIC_TITLE_CANARY", email: "synthetic@example.invalid", ids: ["public-event", "00000000-0000-4000-8000-000000000001", "has spaces", "a@b.invalid", "x".repeat(97), 1, null, { title: "canary" }] });
    expect(readCompanionHeartIds(raw)).toEqual(["public-event", "00000000-0000-4000-8000-000000000001"]);
  });
  it("deduplicates in recent order and retains at most128 ids", () => {
    const ids = Array.from({ length: 300 }, (_, index) => `public-${index}`);
    const result = readCompanionHeartIds(JSON.stringify({ version: 1, ids: [...ids, "public-220"] }));
    expect(result).toHaveLength(MAX_COMPANION_HEARTS);
    expect(new Set(result).size).toBe(MAX_COMPANION_HEARTS);
    expect(result.at(-1)).toBe("public-220");
    expect(result).not.toContain("public-0");
  });
});

const saved = (ids: string[]) => JSON.stringify({ version: 1, ids });
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.unstubAllGlobals(); });

/** Minimal geometry/storage double for adapter semantics. Actual pointer events,
 * CSS and browser observer delivery remain rendered-test responsibilities. */
function fixture(ids = ["public-a", "public-a", "public-b"], initial: string | null = null) {
  const state = { raw: initial, failReads: false, failWrites: false };
  const listeners = new Map<string, (event: StorageEvent) => void>();
  let mutation = () => {};
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { mutation = callback; }
    observe() {}
    disconnect() {}
  });
  const makeElement = () => {
    const attrs = new Map<string, string>();
    const classes = new Set<string>();
    return { attrs, classes, dataset: {} as Record<string, string>, parentElement: null as unknown,
      hidden: false, inert: false, isConnected: true, opacity: "1", textContent: "42",
      classList: { contains: (name: string) => classes.has(name) },
      getAttribute: (key: string) => attrs.get(key) ?? null,
      hasAttribute: (key: string) => attrs.has(key),
      setAttribute: vi.fn((key: string, value: string) => { attrs.set(key, value); }),
      removeAttribute: vi.fn((key: string) => { attrs.delete(key); }),
      click: vi.fn(),
    };
  };
  const root = makeElement();
  const cards = ids.map(id => { const card = makeElement(); card.dataset.eventid = id; card.parentElement = root; return card; });
  const hearts = cards.map((card, index) => {
    const heart = makeElement(); heart.parentElement = card;
    heart.attrs.set("aria-pressed", "false");
    return Object.assign(heart, { closest: () => card,
      getBoundingClientRect: () => ({ left: 20 + index * 60, top: 20, width: 20, height: 20 }) });
  });
  const storage = {
    getItem: vi.fn(() => { if (state.failReads) throw new Error("blocked"); return state.raw; }),
    setItem: vi.fn((_key: string, raw: string) => { if (state.failWrites) throw new Error("quota"); state.raw = raw; }),
  };
  const win = { innerWidth: 1440, innerHeight: 1000, localStorage: storage,
    getComputedStyle: (element: ReturnType<typeof makeElement>) => ({ display: "block", visibility: "visible", opacity: element.opacity }),
    addEventListener: (type: string, listener: (event: StorageEvent) => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  const domRoot = Object.assign(root, { ownerDocument: { defaultView: win }, querySelectorAll: () => hearts,
    contains: (node: unknown) => node === root || cards.some(card => card === node) || hearts.some(heart => heart === node) });
  const adapter = createCompanionHearts(domRoot as unknown as HTMLElement);
  cleanups.push(adapter.dispose);
  return { state, storage, cards, hearts, adapter,
    point: (index = 0) => ({ x: 30 + index * 60, y: 30 }),
    mutate: () => mutation(),
    storageEvent: (key: string | null = COMPANION_HEARTS_KEY, newValue: string | null = state.raw) => listeners.get("storage")?.({ key, newValue } as StorageEvent),
  };
}

function expectHumanUnchanged(test: ReturnType<typeof fixture>, pressed = ["false", "false", "false"]) {
  for (const [index, heart] of test.hearts.entries()) {
    expect(heart.getAttribute("aria-pressed")).toBe(pressed[index]);
    expect(heart.textContent).toBe("42");
    expect(heart.click).not.toHaveBeenCalled();
    expect(heart.setAttribute.mock.calls.every(([key]) => key.startsWith("data-companion-"))).toBe(true);
    expect(heart.removeAttribute.mock.calls.every(([key]) => key.startsWith("data-companion-"))).toBe(true);
  }
}

describe("companion-only local heart toggle", () => {
  it("adds then removes every spanning copy without a human click, count or pressed change", () => {
    const test = fixture();
    expect(test.adapter.attemptAt(test.point())).toBe("added");
    expect(test.hearts.slice(0, 2).every(heart => heart.hasAttribute("data-companion-hearted"))).toBe(true);
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-heart-blocked"))).toBe(false);
    expect(test.adapter.attemptAt(test.point(1))).toBe("removed");
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-hearted"))).toBe(false);
    expect(JSON.parse(test.state.raw!)).toEqual({ version: 1, ids: [] });
    expectHumanUnchanged(test);
  });

  it("a human red copy blocks both addition and removal, then restores the remembered purple", () => {
    const test = fixture(undefined, saved(["public-a"]));
    test.hearts[1].attrs.set("aria-pressed", "true"); test.mutate();
    expect(test.hearts.slice(0, 2).every(heart => heart.hasAttribute("data-companion-heart-blocked"))).toBe(true);
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-hearted"))).toBe(false);
    expect(test.adapter.attemptAt(test.point())).toBe("blocked");
    expect(test.storage.setItem).not.toHaveBeenCalled();
    expectHumanUnchanged(test, ["false", "true", "false"]);
    test.hearts[1].attrs.set("aria-pressed", "false"); test.mutate();
    expect(test.hearts.slice(0, 2).every(heart => heart.hasAttribute("data-companion-hearted"))).toBe(true);
    expect(test.adapter.attemptAt(test.point())).toBe("removed");
    test.hearts[1].attrs.set("aria-pressed", "true"); test.mutate();
    expect(test.adapter.attemptAt(test.point())).toBe("blocked");
    expectHumanUnchanged(test, ["false", "true", "false"]);
  });

  it("takes current external additions and removals without resurrecting stale ids", () => {
    const test = fixture(undefined, saved(["public-a"]));
    test.state.raw = saved(["public-b"]);
    // Delayed event payload is intentionally stale; actual storage is newer.
    test.storageEvent(COMPANION_HEARTS_KEY, saved(["public-a"]));
    expect(test.hearts[0].hasAttribute("data-companion-hearted")).toBe(false);
    expect(test.hearts[2].hasAttribute("data-companion-hearted")).toBe(true);
    expect(test.adapter.attemptAt(test.point(2))).toBe("removed");
    test.storageEvent(COMPANION_HEARTS_KEY, saved(["public-a", "public-b"]));
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-hearted"))).toBe(false);
    expect(test.adapter.attemptAt(test.point())).toBe("added");
    expect(readCompanionHeartIds(test.state.raw)).toEqual(["public-a"]);
  });

  it("rechecks current device memory even when an external storage event was missed", () => {
    const test = fixture(undefined, saved(["public-a"]));
    test.state.raw = saved([]);
    expect(test.adapter.attemptAt(test.point())).toBe("added");
    test.state.raw = saved(["public-a", "public-b"]);
    expect(test.adapter.attemptAt(test.point(2))).toBe("removed");
    expect(readCompanionHeartIds(test.state.raw)).toEqual(["public-a"]);
  });

  it("preserves a quota-failed removal over stale storage and another tab's unrelated addition", () => {
    const test = fixture(undefined, saved(["public-a"]));
    test.state.failWrites = true;
    expect(test.adapter.attemptAt(test.point())).toBe("removed");
    expect(readCompanionHeartIds(test.state.raw)).toEqual(["public-a"]);
    test.storageEvent();
    expect(test.hearts[0].hasAttribute("data-companion-hearted")).toBe(false);
    test.state.raw = saved(["public-a", "public-b"]); test.storageEvent();
    expect(test.hearts[0].hasAttribute("data-companion-hearted")).toBe(false);
    expect(test.hearts[2].hasAttribute("data-companion-hearted")).toBe(true);
    test.state.failWrites = false;
    expect(test.adapter.attemptAt(test.point(2))).toBe("removed");
    expect(readCompanionHeartIds(test.state.raw)).toEqual([]);
    expectHumanUnchanged(test);
  });

  it("keeps failed additions when reads are blocked and can toggle them off locally", () => {
    const test = fixture();
    test.state.failWrites = true;
    expect(test.adapter.attemptAt(test.point())).toBe("added");
    test.state.failReads = true; test.storageEvent();
    expect(test.hearts[0].hasAttribute("data-companion-hearted")).toBe(true);
    expect(test.adapter.attemptAt(test.point())).toBe("removed");
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-hearted"))).toBe(false);
    test.state.failReads = false; test.state.failWrites = false;
    expect(test.adapter.attemptAt(test.point(2))).toBe("added");
    expect(readCompanionHeartIds(test.state.raw)).toEqual(["public-b"]);
  });

  it("explicit external clearing forgets even a failed local addition", () => {
    const test = fixture(); test.state.failWrites = true;
    expect(test.adapter.attemptAt(test.point())).toBe("added");
    test.storageEvent(null, null);
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-hearted"))).toBe(false);
    test.state.failWrites = false;
    expect(test.adapter.attemptAt(test.point())).toBe("added");
  });

  it("bounds persisted ids and rejects teaser, disabled, absent and disposed targets", () => {
    const test = fixture(undefined, saved(Array.from({ length: MAX_COMPANION_HEARTS }, (_, index) => `old-${index}`)));
    expect(test.adapter.attemptAt(test.point())).toBe("added");
    const ids = readCompanionHeartIds(test.state.raw);
    expect(ids).toHaveLength(MAX_COMPANION_HEARTS); expect(ids).not.toContain("old-0"); expect(ids.at(-1)).toBe("public-a");
    test.cards[2].classes.add("teaser");
    expect(test.adapter.attemptAt(test.point(2))).toBe("missing");
    test.hearts[0].attrs.set("disabled", ""); test.hearts[1].opacity = "0";
    expect(test.adapter.attemptAt(test.point())).toBe("missing");
    expect(test.adapter.attemptAt({ x: NaN, y: 30 })).toBe("missing");
    test.adapter.dispose();
    expect(test.hearts.some(heart => heart.hasAttribute("data-companion-hearted"))).toBe(false);
    expect(test.adapter.attemptAt(test.point())).toBe("missing");
  });
});
