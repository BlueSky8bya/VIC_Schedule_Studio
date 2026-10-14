import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireCompanionAmbientPreview, COMPANION_AMBIENT_PREVIEW_MS } from "@/lib/ui/viewer-companion/ambient-preview";

class Root {
  attributes = new Map<string, string>();
  observers = new Set<Observer>();
  get dataset() { return { gfx: this.getAttribute("data-gfx") ?? undefined }; }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  hasAttribute(key: string) { return this.attributes.has(key); }
  setAttribute(key: string, value: string) { const oldValue = this.getAttribute(key); this.attributes.set(key, value); this.changed(key, oldValue); }
  removeAttribute(key: string) { const oldValue = this.getAttribute(key); this.attributes.delete(key); this.changed(key, oldValue); }
  changed(attributeName: string, oldValue: string | null) {
    for (const observer of [...this.observers]) if (observer.filter.includes(attributeName)) observer.callback([{ attributeName, oldValue }] as MutationRecord[], observer as unknown as MutationObserver);
  }
}
class Observer {
  root?: Root;
  filter: string[] = [];
  constructor(public callback: MutationCallback) {}
  observe(root: Root, options: MutationObserverInit) { this.root = root; this.filter = options.attributeFilter ?? []; root.observers.add(this); }
  disconnect() { this.root?.observers.delete(this); }
}
let root: Root;
let doc: EventTarget & { hidden: boolean; documentElement: Root };
let mobile: EventTarget & { matches: boolean };
const releases: (() => void)[] = [];
function acquire() { const release = acquireCompanionAmbientPreview(); releases.push(release); return release; }

beforeEach(() => {
  vi.useFakeTimers();
  root = new Root(); root.setAttribute("data-ambient", "off");
  doc = Object.assign(new EventTarget(), { hidden: false, documentElement: root });
  mobile = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", { matchMedia: () => mobile });
  vi.stubGlobal("MutationObserver", Observer);
});
afterEach(() => {
  while (releases.length) releases.pop()?.();
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe("companion ambient visual lease", () => {
  it("borrows only its own attribute and expires within20s", () => {
    const before = [...root.attributes];
    acquire();
    expect(root.hasAttribute("data-ambient-pet")).toBe(true);
    expect(root.getAttribute("data-ambient")).toBe("off");
    vi.advanceTimersByTime(COMPANION_AMBIENT_PREVIEW_MS - 1);
    expect(root.hasAttribute("data-ambient-pet")).toBe(true);
    vi.advanceTimersByTime(1);
    expect([...root.attributes]).toEqual(before);
    expect(root.observers.size).toBe(0);
  });
  it("releases idempotently without changing the saved preference", () => {
    const release = acquire(); release(); release();
    expect([...root.attributes]).toEqual([["data-ambient", "off"]]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("lets a new lease replace the old one without an old cleanup removing it", () => {
    const first = acquire();
    const old = root.getAttribute("data-ambient-pet");
    acquire();
    expect(root.getAttribute("data-ambient-pet")).not.toBe(old);
    first();
    expect(root.hasAttribute("data-ambient-pet")).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });
  it.each(["off", "soft"])("never acquires under gfx %s", gfx => {
    root.setAttribute("data-gfx", gfx); acquire();
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("never acquires for mobile or a hidden document", () => {
    mobile.matches = true; acquire();
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
    mobile.matches = false; doc.hidden = true; acquire();
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
  });
  it("ends on tab hiding, mobile rotation or graphics OFF", () => {
    acquire(); doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
    doc.hidden = false; acquire(); mobile.matches = true; mobile.dispatchEvent(new Event("change"));
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
    mobile.matches = false; acquire(); root.setAttribute("data-gfx", "off");
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
  });
  it("yields to actual user ambient changes but ignores rewriting the same value", () => {
    acquire(); root.setAttribute("data-ambient", "off");
    expect(root.hasAttribute("data-ambient-pet")).toBe(true);
    root.setAttribute("data-ambient", "dim");
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
    expect(root.getAttribute("data-ambient")).toBe("dim");
  });
  it.each(["data-ambient-pause", "data-showcase"])("yields to %s and does not acquire while it is held", attribute => {
    acquire(); root.setAttribute(attribute, "1");
    expect(root.hasAttribute("data-ambient-pet")).toBe(false);
    acquire(); expect(root.hasAttribute("data-ambient-pet")).toBe(false);
  });
  it("is safe during SSR", () => {
    vi.stubGlobal("window", undefined); vi.stubGlobal("document", undefined);
    expect(() => acquire()()).not.toThrow();
  });
});
