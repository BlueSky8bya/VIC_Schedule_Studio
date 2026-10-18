import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_BEHAVIOR_IDS, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";

const harness = vi.hoisted(() => ({ states: [] as unknown[], state: 0, refs: [] as { current: unknown }[], ref: 0, activity: vi.fn(), acknowledge: vi.fn() }));
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
vi.mock("@/lib/ui/viewer-companion/collection", async original => ({ ...await original<typeof import("@/lib/ui/viewer-companion/collection")>(), acknowledgeCompanionCollection: harness.acknowledge }));
vi.mock("@/lib/ui/sfx", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/ui/sfx")>(), playSfx: vi.fn() }));

type Element = ReactElement<Record<string, unknown>>;
let tree: Element;
let discoveryRendering = false;
let discoveryCollection: CompanionCollection | null = null;
async function render(active = true, preferences = DEFAULT_COMPANION_PREFERENCES) {
  vi.stubGlobal("React", await import("react"));
  harness.state = 0; harness.ref = 0;
  if (discoveryRendering) {
    const { CompanionDiscovery } = await import("@/components/shared/companion-discovery");
    tree = CompanionDiscovery({ collection: discoveryCollection, active }) as Element;
  } else {
    const { CompanionProfile } = await import("@/components/shared/companion-profile");
    tree = CompanionProfile({ preferences, active });
  }
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
async function discover() {
  click(find(node => node.props["data-profile-page"] === "discover"));
  await render();
  expect(find(node => node.props["data-profile-page"] === "discover").props["aria-selected"]).toBe(true);
  // The discovery chunk owns its own persistent state after the first visit.
  discoveryRendering = true; harness.states = []; harness.refs = [];
  await render();
}
function key(element: Element, value: string) {
  const buttons = foods().map(() => ({ focus: vi.fn() }));
  const event = { key: value, preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: { dataset: { act: element.props["data-act"], actOpt: element.props["data-act-opt"] }, closest: () => ({ querySelectorAll: () => buttons }) } };
  (element.props.onKeyDown as (event: KeyboardEvent<HTMLButtonElement>) => void)(event as unknown as KeyboardEvent<HTMLButtonElement>);
}
beforeEach(() => {
  harness.states = []; harness.refs = []; harness.activity.mockReset(); harness.acknowledge.mockReset(); discoveryRendering = false; discoveryCollection = null;
  vi.stubGlobal("getComputedStyle", () => ({ gridTemplateColumns: "1fr 1fr 1fr 1fr" }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("actual shared profile navigation callbacks", () => {
  it("removes passive cards, instructions and storage chatter while retaining the real portrait, facts and useful empty state", async () => {
    await render();
    expect(nodes(tree).filter(node => ["rhh-profile-action-grid", "rhh-profile-action", "rhh-profile-try", "rhh-profile-motion-note", "rhh-trait-note"].includes(String(node.props.className)))).toHaveLength(0);
    expect(find(node => node.props["aria-label"] === "옷장 열기")).toBeDefined();
    expect(find(node => node.props.className === "rhh-companion-facts")).toBeDefined();
    expect(find(node => node.props.className === "rhh-habit-empty").props.children).toBe("아직 배운 습관이 없어요.");
    expect(nodes(tree).filter(node => node.props.className === "rhh-trait-reason")).toHaveLength(0);
  });
  it("describes real learned distance, play frequency and look duration changes in concrete words for every species/personality/gait", async () => {
    for (const animalMode of ["default", "cat", "dog"] as const) for (const personality of ["curious", "affectionate", "sleepy"] as const) for (const speed of ["relaxed", "normal", "lively"] as const) for (const sign of [-1, 1]) {
      const preferences = { ...DEFAULT_COMPANION_PREFERENCES, animalMode, personality, speed };
      const habits = { ...DEFAULT_COMPANION_MEMORY.habits, sociability: sign * .6, playfulness: sign * .3, confidence: sign * .5 };
      const baseline = getCompanionBehaviorProfile({ ...preferences, learnFromYou: false }), actual = getCompanionBehaviorProfile(preferences, habits);
      harness.states = []; harness.refs = []; harness.states[1] = { ...DEFAULT_COMPANION_MEMORY, habits };
      await render(true, preferences);
      const list = find(node => node.props.className === "rhh-profile-learned");
      const words = nodes(list).filter(node => node.type === "li").map(node => node.props.children);
      expect(words).toEqual([
        actual.pointerGap < baseline.pointerGap ? "마우스에 더 바짝 다가와요." : "마우스에서 조금 떨어져 걸어요.",
        actual.playWeight > baseline.playWeight ? "재롱을 더 자주 부려요." : "재롱을 덜 부려요.",
        actual.lookScale < baseline.lookScale ? "잠깐 두리번거려요." : "조금 더 오래 두리번거려요.",
      ]);
    }
  });
  it("shows a concise real recent event and makes stored habits visibly inactive when learning is OFF", async () => {
    harness.states[1] = { ...DEFAULT_COMPANION_MEMORY, habits: { ...DEFAULT_COMPANION_MEMORY.habits, sociability: .6, playfulness: .3, confidence: .5 }, life: { ...DEFAULT_COMPANION_MEMORY.life, recent: ["kind-touch"] } };
    await render(true, { ...DEFAULT_COMPANION_PREFERENCES, learnFromYou: false });
    expect(find(node => node.props.className === "rhh-habit-paused").props.children).toBe("적용 중지");
    expect(nodes(find(node => node.props.className === "rhh-profile-learned")).filter(node => node.type === "li")).toHaveLength(3);
    expect(nodes(find(node => node.props.className === "rhh-trait-reason")).filter(node => node.type === "span").map(node => node.props.children)).toEqual(["최근 경험", "쓰다듬기"]);
    await render(); expect(nodes(tree).filter(node => node.props.className === "rhh-habit-paused")).toHaveLength(0);
    expect(nodes(find(node => node.props.className === "rhh-profile-learned")).filter(node => node.type === "li")).toHaveLength(3);
  });
  it("keeps the actual favorite snack portrait badge across hunger and social needs", async () => {
    const favorites = [
      { kind: "peach", name: "복숭아", file: "foods-106-v1.webp", position: "100% 0%" },
      { kind: "strawberry", name: "딸기", file: "foods-106-v1.webp", position: `${2 / 7 * 100}% 0%` },
      { kind: "rice-ball", name: "삼각김밥", file: "rice-ball-108-v1.webp", position: "0% 0%" },
      { kind: "chocolate", name: "초콜릿", file: "foods-109-6-v1.webp", position: "100% 100%" },
    ] as const;
    for (const hunger of [0, 1]) for (const favorite of favorites) {
      const favoriteFood = favorite.kind;
      harness.states[1] = { ...DEFAULT_COMPANION_MEMORY, hunger, life: { ...DEFAULT_COMPANION_MEMORY.life, favoriteFood, social: 0, play: 1, comfort: 1 } };
      await render();
      const badge = find(node => node.props.className === "rhh-companion-interest");
      const art = nodes(badge).find(node => node.props.className === "vc-collection-art")!;
      expect(badge.props.role).toBe("img");
      expect(badge.props["aria-label"]).toBe(`좋아하는 간식 · ${favorite.name}`);
      expect(art.props.style).toMatchObject({ backgroundImage: `url("/companion/collection/${favorite.file}")`, backgroundSize: expect.any(String), backgroundPosition: favorite.position });
      expect(nodes(badge).filter(node => typeof node.type !== "string")).toHaveLength(0);
    }
  });
  it("acknowledges only deliberate unread tile inspection, not mounting, category changes or paging", async () => {
    harness.acknowledge.mockReturnValue(true);
    discoveryCollection = { version: 1, foods: [...COMPANION_FOOD_KINDS.slice(0, 10)], behaviors: ["ask-petting"], situations: ["meal-finished"], gifts: { pending: null, unlocked: [], equipped: null, activeMs: 0, interactionCredit: 0 }, seen: { foods: [], behaviors: [], situations: [], accessories: [] } };
    await render(); await discover(); expect(harness.acknowledge).not.toHaveBeenCalled();
    expect(foods()[0].props["data-unread"]).toBe(true); expect(foods()[0].props["aria-describedby"]).toBe("unit-profile");
    click(find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "next")); await render();
    expect(foods()[0].props["data-food-index"]).toBe(4); expect(harness.acknowledge).not.toHaveBeenCalled();
    key(foods()[0], "ArrowRight"); await render(); expect(harness.acknowledge.mock.calls).toEqual([["food", COMPANION_FOOD_KINDS[5]]]);
    click(foods()[0]); expect(harness.acknowledge.mock.calls.at(-1)).toEqual(["food", COMPANION_FOOD_KINDS[4]]);
    key(foods()[0], "Home"); await render(); harness.acknowledge.mockClear(); harness.activity.mockClear();
    key(foods()[0], "Home"); expect(harness.acknowledge.mock.calls).toEqual([["food", "apple"]]); expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-collection-inspect#food" }]]);
    harness.activity.mockClear(); harness.acknowledge.mockReturnValue(false); key(foods()[0], "Home"); expect(harness.activity).not.toHaveBeenCalled();
    click(find(node => node.props["data-act"] === "companion-collection-category" && node.props["data-act-opt"] === "behavior")); await render(); harness.acknowledge.mockClear();
    expect(harness.acknowledge).not.toHaveBeenCalled();
    click(find(node => node.props["data-collection-index"] === 0)); expect(harness.acknowledge.mock.calls).toEqual([["behavior", "ask-petting"]]);
    harness.acknowledge.mockClear(); click(find(node => node.props["data-collection-index"] === 1)); expect(harness.acknowledge).not.toHaveBeenCalled();
  });
  it("leads with a live portrait and keeps all operational controls on the last page", async () => {
    await render();
    const pages = nodes(tree).filter(node => node.props["data-profile-page"]);
    expect(pages.map(node => node.props["data-profile-page"])).toEqual(["together", "discover", "dress", "settings"]);
    expect(pages[0].props["aria-selected"]).toBe(true);
    expect(find(node => node.props["aria-label"] === "옷장 열기")).toBeDefined();
    expect(nodes(tree).some(node => node.props["data-act"] === "companion-enabled")).toBe(false);
    expect(nodes(tree).some(node => node.props.collection !== undefined)).toBe(false);
    click(find(node => node.props["aria-label"] === "옷장 열기")); await render();
    expect(find(node => node.props["data-profile-page"] === "dress").props["aria-selected"]).toBe(true);
  });
  it("reaches the final environment page by keyboard with a fixed activity target", async () => {
    await render();
    key(find(node => node.props["data-profile-page"] === "together"), "End"); await render();
    expect(find(node => node.props["data-profile-page"] === "settings").props["aria-selected"]).toBe(true);
    expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-profile-page#settings" }]]);
  });
  it("mounts at most24 food tiles only in the active discovery page and keeps unknown names concealed", async () => {
    await render(); expect(foods()).toHaveLength(0);
    await discover();
    const visited: number[] = [];
    for (;;) {
      expect(foods().length).toBeGreaterThan(0); expect(foods().length).toBeLessThanOrEqual(24);
      expect(foods().every(node => /^\?\?\? · \d+$/.test(String(node.props["aria-label"])))).toBe(true);
      visited.push(...foods().map(node => node.props["data-food-index"] as number));
      expect(visited.length).toBeLessThanOrEqual(COMPANION_FOOD_KINDS.length);
      const next = find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "next");
      if (next.props.disabled) break;
      click(next); await render();
    }
    expect(visited).toEqual(COMPANION_FOOD_KINDS.map((_, index) => index));
    await render(false); expect(foods()).toHaveLength(0);
  });
  it("pages in registry order without manually logging native-click actions", async () => {
    await render(); await discover(); harness.activity.mockClear();
    const size = foods().length;
    click(find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "next")); await render();
    expect(foods().map(node => node.props["data-food-index"])).toEqual(Array.from({ length: Math.min(size, COMPANION_FOOD_KINDS.length - size) }, (_, index) => index + size));
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
    const size = foods().length;
    key(foods().at(-1)!, "ArrowRight"); await render();
    expect(foods()[0].props["data-food-index"]).toBe(size); expect(foods()[0].props["aria-pressed"]).toBe(true);
    key(foods()[0], "ArrowLeft"); await render();
    expect(foods().at(-1)!.props["data-food-index"]).toBe(size - 1); expect(foods().at(-1)!.props["aria-pressed"]).toBe(true);
    key(foods().at(-1)!, "Home"); await render(); const count = harness.activity.mock.calls.length;
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
    const kinds: unknown[] = [], indexes: unknown[] = [];
    for (;;) {
      const memories = nodes(tree).filter(node => node.props["data-act"] === "companion-collection-inspect");
      expect(memories.length).toBeGreaterThan(0); expect(memories.length).toBeLessThanOrEqual(24);
      expect(memories.every(node => /^\?\?\? · \d+$/.test(String(node.props["aria-label"])))).toBe(true);
      expect(memories.filter(node => node.props.tabIndex === 0)).toHaveLength(1);
      kinds.push(...memories.map(node => node.props["data-act-opt"])); indexes.push(...memories.map(node => node.props["data-collection-index"]));
      expect(indexes.length).toBeLessThanOrEqual(COMPANION_BEHAVIOR_IDS.length + COMPANION_SITUATION_IDS.length);
      const next = find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "next");
      if (next.props.disabled) break;
      click(next); await render();
    }
    expect(kinds).toEqual([...COMPANION_BEHAVIOR_IDS.map(() => "behavior"), ...COMPANION_SITUATION_IDS.map(() => "moment")]);
    expect(indexes).toEqual(Array.from({ length: COMPANION_BEHAVIOR_IDS.length + COMPANION_SITUATION_IDS.length }, (_, index) => index));
    expect(nodes(tree).some(node => node.props["aria-label"] === "추억 종류")).toBe(false);
  });
  it("crosses the merged-memory boundary and records the selected destination's fixed category exactly once", async () => {
    await render(); await discover();
    click(find(node => node.props["data-act"] === "companion-collection-category" && node.props["data-act-opt"] === "behavior")); await render();
    const memoryTiles = () => nodes(tree).filter(node => node.props["data-act"] === "companion-collection-inspect");
    const memory = (index: number) => memoryTiles().find(node => node.props["data-collection-index"] === index)!;
    for (let page = 0; !memory(COMPANION_BEHAVIOR_IDS.length - 1); page++) {
      expect(page).toBeLessThan(COMPANION_BEHAVIOR_IDS.length);
      click(find(node => node.props["data-act"] === "companion-collection-page" && node.props["data-act-opt"] === "next")); await render();
    }
    harness.activity.mockClear();
    key(memory(COMPANION_BEHAVIOR_IDS.length - 1), "ArrowRight"); await render();
    expect(memory(COMPANION_BEHAVIOR_IDS.length).props["aria-pressed"]).toBe(true);
    key(memory(COMPANION_BEHAVIOR_IDS.length), "ArrowLeft"); await render();
    expect(memory(COMPANION_BEHAVIOR_IDS.length - 1).props["aria-pressed"]).toBe(true);
    key(memoryTiles()[0], "End"); await render();
    expect(memoryTiles().at(-1)?.props["aria-pressed"]).toBe(true);
    expect(harness.activity.mock.calls).toEqual([
      ["ui.click", { target: "companion-collection-inspect#moment" }],
      ["ui.click", { target: "companion-collection-inspect#behavior" }],
      ["ui.click", { target: "companion-collection-inspect#moment" }],
    ]);
  });
});
