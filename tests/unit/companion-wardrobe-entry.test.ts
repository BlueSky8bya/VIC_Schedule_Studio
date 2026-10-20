import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import type { CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { COMPANION_SCENE_SIGNAL, emitCompanionWardrobePreference } from "@/lib/ui/viewer-companion/scene-signals";

type Effect = { deps?: readonly unknown[]; cleanup?: () => void };
const hooks = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as Effect[],
  state: 0, ref: 0, effect: 0, dirty: false, pending: [] as (() => void)[],
  equip: vi.fn(), acknowledge: vi.fn(), opened: vi.fn(),
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.state++;
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.states[index], (value: unknown) => {
      const next = typeof value === "function" ? value(hooks.states[index]) : value;
      if (!Object.is(next, hooks.states[index])) { hooks.states[index] = next; hooks.dirty = true; }
    }];
  },
  useRef: (initial: unknown) => hooks.refs[hooks.ref++] ?? (hooks.refs[hooks.ref - 1] = { current: initial }),
  useId: () => "wardrobe-entry",
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = hooks.effect++, previous = hooks.effects[index];
    if (previous && deps && previous.deps?.length === deps.length && deps.every((dep, item) => Object.is(dep, previous.deps![item]))) return;
    hooks.pending.push(() => {
      previous?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() || undefined };
    });
  },
}));
vi.mock("@/components/shared/companion-collection-navigation", async original => ({ ...await original<typeof import("@/components/shared/companion-collection-navigation")>(),
  useCompanionCollectionLayout: () => ({ columns: 4, rows: 1, size: 4 }),
}));
vi.mock("@/lib/ui/viewer-companion/collection", async original => ({ ...await original<typeof import("@/lib/ui/viewer-companion/collection")>(), equipCompanionAccessory: hooks.equip, acknowledgeCompanionCollection: hooks.acknowledge }));
vi.mock("@/lib/ui/viewer-companion/companion-sound", () => ({ playCompanionSound: vi.fn() }));
vi.mock("@/lib/ui/haptics", () => ({ hapticSuccess: vi.fn() }));

type Element = ReactElement<Record<string, unknown>>;
let tree: Element | null, collection: CompanionCollection | null;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...nodes(element.props.children as ReactNode)];
}
const find = (predicate: (element: Element) => boolean) => nodes(tree).find(predicate)!;
const selected = () => nodes(tree).filter(element => element.props["data-accessory"] && element.props["aria-pressed"]).map(element => element.props["data-accessory"]);
const preview = () => find(element => "accessory" in element.props && "behaviors" in element.props)?.props.accessory;
const click = (element: Element) => (element.props.onClick as () => void)();
async function render(active = true) {
  vi.stubGlobal("React", await import("react"));
  const { CompanionWardrobe } = await import("@/components/shared/companion-wardrobe");
  for (let turn = 0; turn < 10; turn++) {
    hooks.state = hooks.ref = hooks.effect = 0; hooks.dirty = false; hooks.pending = [];
    tree = CompanionWardrobe({ collection, preferences: DEFAULT_COMPANION_PREFERENCES, active });
    for (const effect of hooks.pending) effect();
    if (!hooks.dirty) return;
  }
  throw new Error("wardrobe effects did not settle");
}
beforeEach(() => {
  hooks.states = []; hooks.refs = []; hooks.effects = []; hooks.pending = [];
  hooks.equip.mockReset(); hooks.acknowledge.mockReset(); hooks.opened.mockReset();
  collection = { version: 1, foods: [], behaviors: [], situations: [], gifts: { pending: null, unlocked: [...COMPANION_WEARABLE_IDS], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 } };
  hooks.equip.mockImplementation(accessory => { collection = { ...collection!, gifts: { ...collection!.gifts, equipped: accessory } }; return true; });
  const window = new EventTarget();
  window.addEventListener(COMPANION_SCENE_SIGNAL, () => { hooks.opened(); emitCompanionWardrobePreference("beret"); });
  vi.stubGlobal("window", window);
});
afterEach(() => { for (const effect of hooks.effects) effect.cleanup?.(); vi.unstubAllGlobals(); });

it("opens at real glasses despite the immediate learned preference, without equipment or read writes", async () => {
  await render();
  expect(hooks.opened).toHaveBeenCalled(); expect(selected()).toEqual(["sunglasses"]); expect(preview()).toBe("sunglasses");
  expect(find(element => element.props["data-act"] === "companion-accessory-equip").props.children).toContain("벗기기");
  emitCompanionWardrobePreference("beret"); await render();
  expect(selected()).toEqual(["sunglasses"]); expect(preview()).toBe("sunglasses");
  expect(hooks.equip).not.toHaveBeenCalled(); expect(hooks.acknowledge).not.toHaveBeenCalled();
});

it("handles collection arriving after the already visible wardrobe", async () => {
  const saved = collection; collection = null; await render(); expect(preview()).toBeNull();
  collection = saved; await render();
  expect(selected()).toEqual(["sunglasses"]); expect(preview()).toBe("sunglasses"); expect(hooks.equip).not.toHaveBeenCalled();
});

it("keeps intentional browsing until departure, then reopens at the current worn item's own page", async () => {
  collection!.gifts.equipped = "sleep-mask-tori";
  await render(); expect(selected()).toEqual(["sleep-mask-tori"]); expect(preview()).toBe("sleep-mask-tori");
  const pager = find(element => element.props.label === "옷장 페이지");
  (pager.props.select as (index: number) => void)(1); await render();
  expect(selected()).toEqual(["beret"]); expect(preview()).toBe("beret");
  collection = { ...collection!, gifts: { ...collection!.gifts, activeMs: 1000 } }; await render();
  expect(selected()).toEqual(["beret"]); expect(preview()).toBe("beret");
  await render(false); await render();
  expect(selected()).toEqual(["sleep-mask-tori"]); expect(preview()).toBe("sleep-mask-tori");
  expect(hooks.equip).not.toHaveBeenCalled(); expect(hooks.acknowledge).not.toHaveBeenCalled();
});

it("removes immediately and lets a deliberate replacement win over later suggestions", async () => {
  await render(); click(find(element => element.props["data-act"] === "companion-accessory-equip")); await render();
  expect(collection!.gifts.equipped).toBeNull(); expect(preview()).toBeNull();
  emitCompanionWardrobePreference("beret"); await render(); expect(preview()).toBeNull();
  click(find(element => element.props["data-accessory"] === "beret")); await render();
  click(find(element => element.props["data-act"] === "companion-accessory-equip" && element.props["data-act-opt"] === "on")); await render();
  expect(collection!.gifts.equipped).toBe("beret"); expect(preview()).toBe("beret");
  expect(hooks.equip.mock.calls).toEqual([[null], ["beret"]]);
});
