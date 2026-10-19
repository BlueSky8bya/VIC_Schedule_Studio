import { CompanionCollectionPager } from "@/components/shared/companion-collection-pager";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import type { CompanionCollection } from "@/lib/ui/viewer-companion/collection";

const harness = vi.hoisted(() => ({ states: [] as unknown[], state: 0, refs: [] as { current: unknown }[], ref: 0, equip: vi.fn(), gift: vi.fn(), acknowledge: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.state++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === "function" ? initial() : initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value; }];
  },
  useRef: (initial: unknown) => harness.refs[harness.ref++] ?? (harness.refs[harness.ref - 1] = { current: initial }),
  useId: () => "wardrobe-unread",
  useEffect: () => {},
}));
vi.mock("@/lib/ui/viewer-companion/collection", async original => ({ ...await original<typeof import("@/lib/ui/viewer-companion/collection")>(), equipCompanionAccessory: harness.equip, openCompanionGift: harness.gift, acknowledgeCompanionCollection: harness.acknowledge }));
vi.mock("@/lib/ui/viewer-companion/companion-sound", () => ({ playCompanionSound: vi.fn() }));
vi.mock("@/lib/ui/haptics", () => ({ hapticSuccess: vi.fn() }));

type Element = ReactElement<Record<string, unknown>>;
let tree: Element | null, collection: CompanionCollection;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  if (element.type === CompanionCollectionPager) return nodes(CompanionCollectionPager(element.props as unknown as Parameters<typeof CompanionCollectionPager>[0]));
  return [element, ...nodes(element.props.children as ReactNode)];
}
const find = (predicate: (element: Element) => boolean) => nodes(tree).find(predicate)!;
const preview = () => find(element => "behaviors" in element.props && "accessory" in element.props).props;
const click = (element: Element) => (element.props.onClick as (event: { detail: number }) => void)({ detail: 1 });
async function render(active = true) {
  vi.stubGlobal("React", await import("react")); harness.state = 0; harness.ref = 0;
  const { CompanionWardrobe } = await import("@/components/shared/companion-wardrobe");
  tree = CompanionWardrobe({ collection, preferences: DEFAULT_COMPANION_PREFERENCES, active });
}
beforeEach(() => {
  harness.states = []; harness.refs = []; harness.equip.mockReset(); harness.gift.mockReset(); harness.acknowledge.mockReset();
  collection = { version: 1, foods: [], behaviors: ["groom"], situations: [], gifts: { pending: null, unlocked: ["sunglasses", "beret"], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 } };
  harness.equip.mockImplementation(accessory => { collection = { ...collection, gifts: { ...collection.gifts, equipped: accessory } }; return true; });
});

describe("actual wardrobe selection and equipment callbacks", () => {
  it("jumps to unread owned gifts without changing equipment or revealing locked artwork", async () => {
    collection.gifts.unlocked = ["sunglasses", "beret", COMPANION_WEARABLE_IDS[26]];
    collection.seen = { foods: [], behaviors: [], situations: [], accessories: ["sunglasses"] };
    harness.acknowledge.mockImplementation((_kind, id) => { collection.seen!.accessories.push(id); return true; });
    await render(); const unread = () => find(element => element.props["aria-label"] === "다음 새 발견 보기");
    click(unread()); await render(); expect(preview().accessory).toBe("beret");
    click(unread()); await render(); expect(preview().accessory).toBe(COMPANION_WEARABLE_IDS[26]);
    expect(nodes(tree).filter(element => element.props["data-page-direction"] && element.props["data-unread"])).toHaveLength(0);
    expect(harness.acknowledge.mock.calls).toEqual([["accessory", "beret"], ["accessory", COMPANION_WEARABLE_IDS[26]]]);
    expect(harness.equip).not.toHaveBeenCalled(); expect(collection.gifts.equipped).toBe("sunglasses");
    for (const tile of nodes(tree).filter(element => element.props["data-accessory"] && !element.props["data-found"])) {
      expect(nodes(tile).some(element => typeof element.type === "function" && element.type.name === "CompanionCollectionArt")).toBe(false);
    }
  });
  it("keeps unread badges through opening and paging, acknowledging only the intentionally selected owned tile", async () => {
    collection.gifts.unlocked = [...COMPANION_WEARABLE_IDS];
    collection.seen = { foods: [], behaviors: [], situations: [], accessories: [] };
    await render(); expect(harness.acknowledge).not.toHaveBeenCalled();
    expect(find(element => element.props["data-accessory"] === "sunglasses").props["data-unread"]).toBe(true);
    (find(element => element.props.type === "range").props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: "2" } }); await render();
    expect(harness.acknowledge).not.toHaveBeenCalled();
    const first = find(element => element.props["data-accessory"] === COMPANION_WEARABLE_IDS[4]); click(first);
    expect(harness.acknowledge.mock.calls).toEqual([["accessory", COMPANION_WEARABLE_IDS[4]]]);
    harness.acknowledge.mockClear(); vi.stubGlobal("getComputedStyle", () => ({ gridTemplateColumns: "1fr 1fr 1fr 1fr" }));
    const event = { key: "Home", preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: { dataset: { act: "companion-accessory-select" }, closest: () => ({ querySelectorAll: () => [] }) } };
    (first.props.onKeyDown as (event: KeyboardEvent<HTMLButtonElement>) => void)(event as unknown as KeyboardEvent<HTMLButtonElement>);
    expect(harness.acknowledge.mock.calls).toEqual([["accessory", "sunglasses"]]);
    vi.unstubAllGlobals();
  });
  it("immediately previews actual equipment, and removing clears the selected try-on in the same update", async () => {
    await render(); expect(preview().accessory).toBe("sunglasses"); expect(preview().behaviors).toEqual(["groom"]);
    click(find(element => element.props["data-act"] === "companion-accessory-equip")); await render();
    expect(harness.equip.mock.calls).toEqual([[null]]); expect(preview().accessory).toBeNull();
    expect(collection.gifts.equipped).toBeNull();
    expect(nodes(tree).filter(element => element.props["data-accessory"] && element.props["aria-pressed"])).toHaveLength(0);
  });
  it("keeps try-on local, offers only owned items, and respects a subsequent ownership clear", async () => {
    await render();
    click(find(element => element.props["data-accessory"] === "beret")); await render();
    expect(preview().accessory).toBe("beret"); expect(harness.equip).not.toHaveBeenCalled();
    collection = { ...collection, gifts: { ...collection.gifts, unlocked: [], equipped: null } }; await render();
    expect(preview().accessory).toBeNull();
    expect(nodes(tree).some(element => element.props["data-act"] === "companion-accessory-equip")).toBe(false);
  });
  it("starts bare when nothing is worn and never leaks undiscovered gestures or retired catalogue entries", async () => {
    collection.gifts = { ...collection.gifts, unlocked: ["scarf", "bell-pendant", "sunglasses"], equipped: null };
    await render(); expect(preview().accessory).toBeNull(); expect(preview().behaviors).toEqual(collection.behaviors);
    const ids: unknown[] = [];
    for (;;) {
      const tiles = nodes(tree).filter(element => element.props["data-accessory"]);
      expect(tiles.length).toBeLessThanOrEqual(24); expect(tiles.filter(element => element.props.tabIndex === 0)).toHaveLength(1);
      expect(tiles.filter(element => !element.props["data-found"]).every(element => /^\?\?\? · \d+$/.test(String(element.props["aria-label"])))).toBe(true);
      ids.push(...tiles.map(element => element.props["data-accessory"]));
      expect(ids.length).toBeLessThanOrEqual(COMPANION_WEARABLE_IDS.length);
      const rail = find(element => element.props.type === "range");
      if (rail.props.value === rail.props.max) break;
      (rail.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: String(Number(rail.props.value) + 1) } }); await render(); expect(harness.equip).not.toHaveBeenCalled();
    }
    expect(ids).toEqual([...COMPANION_WEARABLE_IDS]);
    expect(find(element => element.props.className === "rhh-collection-heading").props.children).toEqual(expect.arrayContaining([expect.objectContaining({ props: expect.objectContaining({ children: [1, "/", COMPANION_WEARABLE_IDS.length] }) })]));
    const locked = nodes(tree).find(element => element.props["data-accessory"] && !element.props["data-found"])!;
    click(locked); await render(); expect(preview().accessory).toBeNull(); expect(harness.equip).not.toHaveBeenCalled();
    await render(false); expect(tree).toBeNull();
  });
});
