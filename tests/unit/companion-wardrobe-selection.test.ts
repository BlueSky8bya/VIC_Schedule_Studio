import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import type { CompanionCollection } from "@/lib/ui/viewer-companion/collection";

const harness = vi.hoisted(() => ({ states: [] as unknown[], state: 0, refs: [] as { current: unknown }[], ref: 0, equip: vi.fn(), gift: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.state++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === "function" ? initial() : initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value; }];
  },
  useRef: (initial: unknown) => harness.refs[harness.ref++] ?? (harness.refs[harness.ref - 1] = { current: initial }),
  useEffect: () => {},
}));
vi.mock("@/lib/ui/viewer-companion/collection", async original => ({ ...await original<typeof import("@/lib/ui/viewer-companion/collection")>(), equipCompanionAccessory: harness.equip, openCompanionGift: harness.gift }));
vi.mock("@/lib/ui/viewer-companion/companion-sound", () => ({ playCompanionSound: vi.fn() }));
vi.mock("@/lib/ui/haptics", () => ({ hapticSuccess: vi.fn() }));

type Element = ReactElement<Record<string, unknown>>;
let tree: Element | null, collection: CompanionCollection;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
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
  harness.states = []; harness.refs = []; harness.equip.mockReset(); harness.gift.mockReset();
  collection = { version: 1, foods: [], behaviors: ["groom"], situations: [], gifts: { pending: null, unlocked: ["sunglasses", "beret"], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 } };
  harness.equip.mockImplementation(accessory => { collection = { ...collection, gifts: { ...collection.gifts, equipped: accessory } }; return true; });
});

describe("actual wardrobe selection and equipment callbacks", () => {
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
      const next = find(element => element.props["data-act"] === "companion-collection-page" && element.props["data-act-opt"] === "next");
      if (next.props.disabled) break;
      click(next); await render(); expect(harness.equip).not.toHaveBeenCalled();
    }
    expect(ids).toEqual([...COMPANION_WEARABLE_IDS]);
    expect(find(element => element.props.className === "rhh-collection-heading").props.children).toEqual(expect.arrayContaining([expect.objectContaining({ props: expect.objectContaining({ children: [1, "/", COMPANION_WEARABLE_IDS.length] }) })]));
    const locked = nodes(tree).find(element => element.props["data-accessory"] && !element.props["data-found"])!;
    click(locked); await render(); expect(preview().accessory).toBeNull(); expect(harness.equip).not.toHaveBeenCalled();
    await render(false); expect(tree).toBeNull();
  });
});
