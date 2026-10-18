import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";

const harness = vi.hoisted(() => ({ states: [] as unknown[], state: 0, refs: [] as { current: unknown }[], ref: 0, activity: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.state++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === "function" ? initial() : initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value; }];
  },
  useRef: (initial: unknown) => harness.refs[harness.ref++] ?? (harness.refs[harness.ref - 1] = { current: initial }),
  useCallback: (callback: unknown) => callback,
  useId: () => "unit-profile",
  // This harness covers actual navigation callbacks/state, not effects or
  // native focus/layout. Production-build browser cases cover those paths.
  useEffect: () => {},
}));
vi.mock("@/lib/activity/client", () => ({ logActivity: harness.activity }));
vi.mock("@/lib/ui/sfx", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/ui/sfx")>(), playSfx: vi.fn() }));

type Element = ReactElement<Record<string, unknown>>;
let tree: Element;
async function render(active = true) {
  vi.stubGlobal("React", await import("react"));
  harness.state = 0; harness.ref = 0;
  const { CompanionProfile } = await import("@/components/shared/companion-profile");
  tree = CompanionProfile({ preferences: DEFAULT_COMPANION_PREFERENCES, active });
  return tree;
}
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child));
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...nodes(element.props.children as ReactNode)];
}
const find = (predicate: (node: Element) => boolean) => nodes(tree).find(predicate)!;
const foods = () => nodes(tree).filter(node => node.props["data-food-index"] !== undefined);
const click = (element: Element) => (element.props.onClick as (event: { detail: number }) => void)({ detail: 1 });
async function discover() { click(find(node => node.props["data-profile-page"] === "discover")); await render(); }
function key(element: Element, value: string) {
  const buttons = foods().map(() => ({ focus: vi.fn() }));
  const event = { key: value, preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: { dataset: { act: element.props["data-act"], actOpt: element.props["data-act-opt"] }, closest: () => ({ querySelectorAll: () => buttons }) } };
  (element.props.onKeyDown as (event: KeyboardEvent<HTMLButtonElement>) => void)(event as unknown as KeyboardEvent<HTMLButtonElement>);
}
beforeEach(() => {
  harness.states = []; harness.refs = []; harness.activity.mockReset();
  vi.stubGlobal("getComputedStyle", () => ({ gridTemplateColumns: "1fr 1fr 1fr 1fr" }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("actual shared profile navigation callbacks", () => {
  it("mounts at most24 food tiles only in the active discovery page and keeps unknown names concealed", async () => {
    await render(); expect(foods()).toHaveLength(0);
    await discover();
    expect(foods()).toHaveLength(Math.min(24, COMPANION_FOOD_KINDS.length));
    expect(foods().every(node => /^\?\?\? · \d+$/.test(String(node.props["aria-label"])))).toBe(true);
    await render(false); expect(foods()).toHaveLength(0);
  });
  it("pages in registry order without manually logging native-click actions", async () => {
    await render(); await discover(); harness.activity.mockClear();
    click(find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "next")); await render();
    expect(foods().map(node => node.props["data-food-index"])).toEqual(Array.from({ length: Math.min(24, COMPANION_FOOD_KINDS.length - 24) }, (_, index) => index + 24));
    expect(foods()[0].props["aria-pressed"]).toBe(true);
    click(find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "prev")); await render();
    expect(foods()[0].props["data-food-index"]).toBe(0);
    expect(harness.activity).not.toHaveBeenCalled();
  });
  it("End/Home reaches the actual last/first record across page boundaries using fixed category activity only", async () => {
    await render(); await discover(); harness.activity.mockClear();
    key(foods()[0], "End"); await render();
    const last = foods().at(-1)!;
    expect(last.props["data-food-index"]).toBe(COMPANION_FOOD_KINDS.length - 1);
    expect(last.props["aria-pressed"]).toBe(true);
    expect(foods().length).toBeLessThanOrEqual(24);
    expect(find(node => node.props["data-act-opt"] === "next" && node.props["data-act"] === "companion-collection-page").props.disabled).toBe(true);
    key(last, "Home"); await render();
    expect(foods()[0].props["aria-pressed"]).toBe(true);
    expect(foods()[0].props["data-food-index"]).toBe(0);
    expect(harness.activity.mock.calls).toEqual(Array.from({ length: 2 }, () => ["ui.click", { target: "companion-collection-inspect#food" }]));
  });
  it("crosses a page edge in either direction and emits no extra activity for a clamped edge key", async () => {
    await render(); await discover(); harness.activity.mockClear();
    key(foods()[23], "ArrowRight"); await render();
    expect(foods()[0].props["data-food-index"]).toBe(24); expect(foods()[0].props["aria-pressed"]).toBe(true);
    key(foods()[0], "ArrowLeft"); await render();
    expect(foods()[23].props["data-food-index"]).toBe(23); expect(foods()[23].props["aria-pressed"]).toBe(true);
    key(foods()[23], "Home"); await render(); const count = harness.activity.mock.calls.length;
    key(foods()[0], "Home"); key(foods()[0], "ArrowLeft"); await render();
    expect(harness.activity).toHaveBeenCalledTimes(count);
  });
  it("logs changed profile keyboard selection once and does not log Home on the current first tab", async () => {
    await render(); const first = find(node => node.props["data-profile-page"] === "together");
    key(first, "Home"); expect(harness.activity).not.toHaveBeenCalled();
    key(first, "ArrowRight"); await render();
    expect(find(node => node.props["data-profile-page"] === "discover").props["aria-selected"]).toBe(true);
    expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-profile-page#discover" }]]);
  });
  it("offers only two collections and keeps all behavior/situation memories together without revealing unknown names", async () => {
    await render(); await discover();
    const categories = nodes(tree).filter(node => node.props["data-act"] === "companion-collection-category");
    expect(categories.map(node => node.props["data-act-opt"])).toEqual(["food", "behavior"]);
    click(categories[1]); await render();
    const memories = nodes(tree).filter(node => node.props["data-act"] === "companion-collection-inspect");
    expect(memories).toHaveLength(COMPANION_BEHAVIOR_IDS.length + COMPANION_SITUATION_IDS.length);
    expect(memories.map(node => node.props["data-act-opt"])).toEqual([...COMPANION_BEHAVIOR_IDS.map(() => "behavior"), ...COMPANION_SITUATION_IDS.map(() => "moment")]);
    expect(memories.every(node => /^\?\?\? · \d+$/.test(String(node.props["aria-label"])))).toBe(true);
    expect(nodes(tree).some(node => node.props["aria-label"] === "추억 종류")).toBe(false);
    expect(memories.filter(node => node.props.tabIndex === 0)).toHaveLength(1);
  });
  it("crosses the merged-memory boundary and records the selected destination's fixed category exactly once", async () => {
    await render(); await discover();
    click(find(node => node.props["data-act"] === "companion-collection-category" && node.props["data-act-opt"] === "behavior")); await render();
    const memoryTiles = () => nodes(tree).filter(node => node.props["data-act"] === "companion-collection-inspect");
    harness.activity.mockClear();
    key(memoryTiles()[COMPANION_BEHAVIOR_IDS.length - 1], "ArrowRight"); await render();
    expect(memoryTiles()[COMPANION_BEHAVIOR_IDS.length].props["aria-pressed"]).toBe(true);
    key(memoryTiles()[COMPANION_BEHAVIOR_IDS.length], "ArrowLeft"); await render();
    expect(memoryTiles()[COMPANION_BEHAVIOR_IDS.length - 1].props["aria-pressed"]).toBe(true);
    key(memoryTiles()[0], "End"); await render();
    expect(memoryTiles().at(-1)?.props["aria-pressed"]).toBe(true);
    expect(harness.activity.mock.calls).toEqual([
      ["ui.click", { target: "companion-collection-inspect#moment" }],
      ["ui.click", { target: "companion-collection-inspect#behavior" }],
      ["ui.click", { target: "companion-collection-inspect#moment" }],
    ]);
  });
});
