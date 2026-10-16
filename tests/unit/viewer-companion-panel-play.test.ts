import { describe, expect, it, vi } from "vitest";
import { commitAction, createBrain, getAction, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PANEL_SIDE_EVENT, COMPANION_PANEL_SIDE_SELECTOR, requestCompanionPanelSide } from "@/lib/ui/viewer-companion/panel-play";

const arrow: Platform = { id: "panel-side-right", x: 500, y: 737, width: 36, kind: "control", panelSide: "right" };
const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, feeding: false };
const world: CompanionWorld = { x: 518, y: 737, platformId: arrow.id, platforms: [arrow], width: 1000, height: 800 };
const brain = () => ({ ...createBrain(0, () => .5), activeMs: 90000 });

describe("companion's bounded panel arrow play", () => {
  it("uses an actual occupied arrow and enforces an active-time warmup and 90s cooldown", () => {
    const action = getAction(brain(), world, prefs, 100000, () => 0);
    expect(action).toEqual({ kind: "panel", panelSide: "right", duration: 1550, target: { x: 518, y: 737, platformId: arrow.id } });
    const next = commitAction(brain(), action, 100000);
    expect(next.cooldowns.panel).toBe(191550);
    expect(getAction(next, world, prefs, 191549, () => 0).kind).not.toBe("panel");
    expect(getAction(next, world, prefs, 191550, () => 0).kind).toBe("panel");
    expect(getAction({ ...brain(), activeMs: 89999 }, world, prefs, 100000, () => 0).kind).not.toBe("panel");
    expect(getAction(brain(), world, prefs, 100000, () => .06).kind).not.toBe("panel");
  });

  it("respects opt-out, pause, movement, exact contact and active-side gates", () => {
    for (const patch of [{ panelPrank: false }, { roam: false }, { enabled: false }]) expect(getAction(brain(), world, { ...prefs, ...patch }, 100000, () => 0).kind).not.toBe("panel");
    for (const patch of [{ paused: true }, { y: 728 }, { x: 499 }, { platformId: "other" }, { platforms: [{ ...arrow, panelSide: undefined }] }, { platforms: [{ ...arrow, manualOnly: true }] }]) {
      expect(getAction(brain(), { ...world, ...patch }, prefs, 100000, () => 0).kind).not.toBe("panel");
    }
  });

  it("leaves a nearby meal ahead of a playful control", () => {
    const action = getAction({ ...brain(), hunger: .9 }, { ...world, foods: [{ id: "fruit", kind: "apple", x: 518, y: 737, platformId: arrow.id }] }, { ...prefs, feeding: true }, 100000, () => 0);
    expect(action.kind).toBe("eat");
  });
});

function controlFixture() {
  const attributes = new Map([["data-companion-panel-side", "right"], ["aria-pressed", "false"]]);
  let locked = false, reduced = false;
  const style = { display: "block", visibility: "visible", opacity: "1" };
  const win = { innerWidth: 1000, innerHeight: 800, getComputedStyle: vi.fn(() => style) };
  const doc = { defaultView: win, hidden: false, documentElement: { hasAttribute: () => reduced } };
  const click = vi.fn();
  const element = Object.assign(new EventTarget(), {
    isConnected: true, ownerDocument: doc, parentElement: null,
    matches: (selector: string) => selector === COMPANION_PANEL_SIDE_SELECTOR,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    closest: () => locked ? element : null,
    getBoundingClientRect: () => ({ left: 500, top: 740, right: 536, bottom: 784, width: 36, height: 44 }), click,
  });
  return { element, attributes, doc, win, style, click, lock: (value: boolean) => { locked = value; }, reduce: (value: boolean) => { reduced = value; } };
}

describe("exact shared panel capability", () => {
  it("dispatches only the typed reversible port, never a browser click", () => {
    const f = controlFixture(), accepted = vi.fn((event: Event) => event.preventDefault());
    const element = f.element as unknown as Element;
    expect(requestCompanionPanelSide(element, "right")).toBe(false);
    f.element.addEventListener(COMPANION_PANEL_SIDE_EVENT, accepted);
    expect(requestCompanionPanelSide(element, "right")).toBe(true);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect((accepted.mock.calls[0][0] as CustomEvent).detail).toEqual({ side: "right" });
    expect(f.click).not.toHaveBeenCalled();
  });
  it("fails closed for stale, active, inert, reduced, hidden or offscreen controls", () => {
    const f = controlFixture(), accepted = vi.fn((event: Event) => event.preventDefault());
    f.element.addEventListener(COMPANION_PANEL_SIDE_EVENT, accepted);
    const element = f.element as unknown as Element;
    expect(requestCompanionPanelSide(element, "left")).toBe(false);
    f.attributes.set("aria-pressed", "true"); expect(requestCompanionPanelSide(element, "right")).toBe(false); f.attributes.set("aria-pressed", "false");
    f.attributes.set("disabled", ""); expect(requestCompanionPanelSide(element, "right")).toBe(false); f.attributes.delete("disabled");
    f.lock(true); expect(requestCompanionPanelSide(element, "right")).toBe(false); f.lock(false);
    f.reduce(true); expect(requestCompanionPanelSide(element, "right")).toBe(false); f.reduce(false);
    f.doc.hidden = true; expect(requestCompanionPanelSide(element, "right")).toBe(false); f.doc.hidden = false;
    f.style.opacity = "0"; expect(requestCompanionPanelSide(element, "right")).toBe(false); f.style.opacity = "1";
    f.win.innerHeight = 750; expect(requestCompanionPanelSide(element, "right")).toBe(false); f.win.innerHeight = 800;
    f.element.isConnected = false; expect(requestCompanionPanelSide(element, "right")).toBe(false);
    expect(accepted).not.toHaveBeenCalled(); expect(f.click).not.toHaveBeenCalled();
  });
});
