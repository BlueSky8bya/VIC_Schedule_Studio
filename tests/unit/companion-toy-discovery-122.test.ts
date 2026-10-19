import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import type { CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { normalizeCompanionTastes, type CompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
const harness = vi.hoisted(() => ({ states: [] as unknown[], state: 0, refs: [] as { current: unknown }[], ref: 0, acknowledge: vi.fn(), activity: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const index = harness.state++; if (!(index in harness.states)) harness.states[index] = initial; return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value; }]; },
  useRef: (initial: unknown) => harness.refs[harness.ref++] ?? (harness.refs[harness.ref - 1] = { current: initial }),
  useId: () => "toy-unread", useEffect: () => {},
}));
vi.mock("@/lib/ui/viewer-companion/toy-tastes", async original => ({ ...await original<typeof import("@/lib/ui/viewer-companion/toy-tastes")>(), acknowledgeCompanionToy: harness.acknowledge }));
vi.mock("@/lib/activity/client", () => ({ logActivity: harness.activity }));
type Element = ReactElement<Record<string, unknown>>;
let tree: Element | null;
let selectedKind: CompanionToyKind = "ball";
function nodes(node: ReactNode): Element[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== "object" || !("props" in node)) return []; const element = node as Element; return [element, ...nodes(element.props.children as ReactNode)]; }
const tiles = () => nodes(tree).filter(node => node.props["data-collection-index"] !== undefined);
const find = (predicate: (node: Element) => boolean) => nodes(tree).find(predicate)!;
async function render(tastes: CompanionTastes | null = null, active = true) { vi.stubGlobal("React", await import("react")); harness.state = 0; harness.ref = 0; const { CompanionToyDiscovery } = await import("@/components/shared/companion-toy-discovery"); tree = CompanionToyDiscovery({ tastes, active, selectedKind, onSelect: value => { selectedKind = value; } }); }
const click = (node: Element, detail = 1) => (node.props.onClick as (event: { detail: number }) => void)({ detail });
beforeEach(() => { selectedKind = "ball"; harness.states = []; harness.refs = []; harness.acknowledge.mockReset(); harness.activity.mockReset(); vi.stubGlobal("getComputedStyle", () => ({ gridTemplateColumns: "1fr 1fr 1fr 1fr" })); });
afterEach(() => vi.unstubAllGlobals());
describe("122 finite toy book interaction", () => {
  it("mounts no hidden item's artwork/name and performs no automatic acknowledgment", async () => {
    await render(); expect(tiles()).toHaveLength(8);
    expect(tiles().every(node => /^\?\?\? · \d+$/.test(String(node.props["aria-label"])))).toBe(true);
    expect(nodes(tree).filter(node => typeof node.type === "function" && node.type.name === "CompanionToyArt")).toHaveLength(0);
    expect(harness.acknowledge).not.toHaveBeenCalled(); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("covers all twenty-four identities exactly once in finite pages and does not read items by paging", async () => {
    const tastes = normalizeCompanionTastes({ version: 1, toys: [...COMPANION_TOY_KINDS], seen: [] }), indexes: number[] = [];
    for (let i = 0; i < 6; i++) { await render(tastes); indexes.push(...tiles().map(node => Number(node.props["data-collection-index"]))); const next = find(node => node.props["aria-label"] === "다음 장난감"); if (next.props.disabled) break; click(next); }
    expect(indexes).toEqual(Array.from({ length: 24 }, (_, i) => i)); expect(tiles()).toHaveLength(8);
    expect(find(node => node.props["aria-label"] === "다음 장난감").props.disabled).toBe(true);
    expect(harness.acknowledge).not.toHaveBeenCalled();
  });
  it("jumps over read and undiscovered toys to each unread identity without acknowledging siblings", async () => {
    const tastes = normalizeCompanionTastes({ version: 1, toys: ["ball", "bell", "feather"], seen: ["ball"] });
    harness.acknowledge.mockImplementation((kind: CompanionToyKind) => { tastes.seen.push(kind); return true; });
    await render(tastes); click(find(node => node.props["aria-label"] === "다음 새 발견")); await render(tastes);
    expect(selectedKind).toBe("bell"); expect(harness.acknowledge.mock.calls).toEqual([["bell"]]);
    expect(find(node => node.props["aria-label"] === "다음 새 발견").props["data-act-opt"]).toBe("toy");
    click(find(node => node.props["aria-label"] === "다음 새 발견")); await render(tastes);
    expect(selectedKind).toBe("feather"); expect(harness.acknowledge.mock.calls).toEqual([["bell"], ["feather"]]);
    expect(find(node => node.props["aria-label"] === "다음 새 발견").props.disabled).toBe(true);
    expect(harness.activity).not.toHaveBeenCalled();
  });
  it("acknowledges pointer/keyboard inspection only and logs the fixed category rather than toy identity", async () => {
    const tastes = normalizeCompanionTastes({ version: 1, toys: ["ball", "blocks"], seen: [] }); await render(tastes);
    expect(tiles()[0].props["data-unread"]).toBe(true); click(tiles()[0]); expect(harness.acknowledge).toHaveBeenCalledWith("ball");
    harness.acknowledge.mockClear(); harness.acknowledge.mockReturnValue(true);
    const current = tiles()[0];
    (current.props.onKeyDown as (event: KeyboardEvent<HTMLButtonElement>) => void)({ key: "ArrowRight", preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: { dataset: { act: "companion-collection-inspect", actOpt: "toy" }, closest: () => ({ querySelectorAll: () => [] }) } } as unknown as KeyboardEvent<HTMLButtonElement>);
    await render(tastes); expect(tiles()[1].props["aria-pressed"]).toBe(true);
    expect(harness.acknowledge.mock.calls).toEqual([["blocks"]]); expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-collection-inspect#toy" }]]);
  });
  it("does not mount a paused/inactive book", async () => { await render(null, false); expect(tree).toBeNull(); expect(harness.acknowledge).not.toHaveBeenCalled(); });
});
