import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useId: () => "unit-pager-unread" }));
import { logActivity } from "@/lib/activity/client";
import { CompanionCollectionPager } from "@/components/shared/companion-collection-pager";
import { companionCollectionPageDots, companionCollectionUnreadDirections, companionCollectionUnreadPages, onCollectionArrowKey } from "@/components/shared/companion-collection-navigation";

type Element = ReactElement<Record<string, unknown>>;
const nodes = (node: ReactNode): Element[] => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" && "props" in node ? [node as Element, ...nodes((node as Element).props.children as ReactNode)] : [];
const selected = vi.fn();
const render = (overrides: Partial<Parameters<typeof CompanionCollectionPager>[0]> = {}) => CompanionCollectionPager({ label: "냠냠 도감 페이지", previousLabel: "이전 간식", nextLabel: "다음 간식", page: { page: 0, count: 15 }, size: 12, length: 180, selected: 0, unread: () => false, select: selected, categoryAt: () => "food", ...overrides });
const button = (tree: ReactNode, direction: string) => nodes(tree).find(node => node.props["data-page-direction"] === direction)!;
const click = (node: Element, detail = 1) => (node.props.onClick as (event: { detail: number }) => void)({ detail });

beforeEach(async () => { vi.stubGlobal("React", await import("react")); selected.mockReset(); vi.mocked(logActivity).mockClear(); });
afterEach(() => vi.unstubAllGlobals());

describe("133/134 shared page dots and directional button navigation", () => {
  it("points to the nearest unread in each direction, including current-page siblings, without wrapping or reading the current item", () => {
    const unread = new Set([0, 11, 40, 179]);
    expect(companionCollectionUnreadDirections(12, 180, index => unread.has(index))).toEqual({ previous: 11, next: 40 });
    expect(companionCollectionUnreadDirections(0, 180, index => index === 0)).toEqual({ previous: null, next: null });
    expect(companionCollectionUnreadDirections(179, 180, index => unread.has(index))).toEqual({ previous: 40, next: null });
    expect(companionCollectionUnreadDirections(0, 0, () => true)).toEqual({ previous: null, next: null });
    let index = 10;
    while (unread.size) {
      const direction = companionCollectionUnreadDirections(index, 180, item => unread.has(item));
      index = (direction.next ?? direction.previous)!;
      expect(index).not.toBeNull(); unread.delete(index);
    }
  });
  it("keeps every page visible as a dot, including compact books that formerly hid pages behind the bar", () => {
    expect(companionCollectionPageDots(15)).toEqual(Array.from({ length: 15 }, (_, index) => index));
    for (const count of [1, 3, 15, 23, 45, 90]) for (let page = 0; page < count; page++) {
      const dots = companionCollectionPageDots(count);
      expect(dots).toContain(page); expect(dots).toHaveLength(count);
      expect(new Set(dots).size).toBe(dots.length); expect(dots[0]).toBeGreaterThanOrEqual(0); expect(dots.at(-1)).toBeLessThan(count);
    }
  });
  it("has a single accessible page rail and no visible numeric range or zero discovery badge", () => {
    const tree = render({ page: { page: 10, count: 15 }, selected: 120 });
    const all = nodes(tree), input = all.find(node => node.type === "input")!;
    expect(input.props).toMatchObject({ type: "range", min: 1, max: 15, value: 11, step: 1, "aria-label": "냠냠 도감 페이지 선택", "aria-valuetext": "15페이지 중 11페이지", "data-act": "companion-collection-page" });
    expect(all.filter(node => node.props["aria-current"] === "page").map(node => node.props["data-page"])).toEqual([10]);
    expect(all.some(node => /page-status|page-bar|next-unread|unread-count/.test(String(node.props.className)))).toBe(false);
    expect(all.filter(node => node.props.className === "rhh-collection-unread")).toHaveLength(0);
    (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: "15" } });
    expect(selected).toHaveBeenCalledExactlyOnceWith(168, false, false);
    expect(logActivity).not.toHaveBeenCalled(); // The real delegated change listener owns this one commit.
  });
  it("uses the real unread category for directional inspection and keeps ordinary arrows as single-page movement", () => {
    const tree = render({ page: { page: 2, count: 15 }, selected: 24, unread: index => index === 0 || index === 179, categoryAt: index => index === 179 ? "moment" : "behavior" });
    const previous = button(tree, "prev"), next = button(tree, "next");
    expect(previous.props).toMatchObject({ "aria-label": "이전 새 발견 보기", "data-act": "companion-collection-inspect", "data-act-opt": "behavior", "data-unread": true });
    expect(next.props).toMatchObject({ "aria-label": "다음 새 발견 보기", "data-act-opt": "moment", disabled: false });
    click(next, 0); expect(selected).toHaveBeenCalledExactlyOnceWith(179, true, true);
    expect(logActivity).not.toHaveBeenCalled(); // Native pointer/Enter click is captured once by the existing listener.
    const manual = render({ page: { page: 2, count: 15 }, selected: 24 });
    click(button(manual, "prev")); expect(selected).toHaveBeenLastCalledWith(12, false, false);
    click(button(manual, "next")); expect(selected).toHaveBeenLastCalledWith(36, false, false);
    expect(button(render(), "prev").props.disabled).toBe(true);
    expect(button(render({ page: { page: 14, count: 15 }, selected: 179 }), "next").props.disabled).toBe(true);
  });
  it("Left/Right activate the exact visible button, while Home/End remain ordinary page positioning", () => {
    const tree = render({ page: { page: 2, count: 15 }, selected: 24, unread: index => index === 179 });
    const preventDefault = vi.fn(), stopPropagation = vi.fn();
    const invoked: string[] = [];
    const key = (value: string, tagName = "BUTTON") => (tree.props.onKeyDown as (event: KeyboardEvent<HTMLElement>) => void)({ key: value, target: { tagName }, preventDefault, stopPropagation, currentTarget: { querySelectorAll: (selector: string) => {
      const direction = selector.includes('"prev"') ? "prev" : "next", node = button(tree, direction);
      return [{ disabled: node.props.disabled, closest: () => null, click: () => { invoked.push(direction); click(node, 0); } }];
    } } } as unknown as KeyboardEvent<HTMLElement>);
    key("ArrowRight"); expect(selected).toHaveBeenLastCalledWith(179, true, true);
    key("ArrowLeft", "INPUT"); expect(selected).toHaveBeenLastCalledWith(12, true, false);
    expect(invoked).toEqual(["next", "prev"]); expect(logActivity).not.toHaveBeenCalled();
    key("End", "INPUT"); expect(selected).toHaveBeenLastCalledWith(168, false, false);
    key("Home", "INPUT"); expect(selected).toHaveBeenLastCalledWith(0, false, false);
    key("Enter"); expect(selected).toHaveBeenCalledTimes(4); expect(logActivity).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(4); expect(stopPropagation).toHaveBeenCalledTimes(4);
  });
  it("marks unread pages independently from the current page and updates without acknowledging any entry", () => {
    expect([...companionCollectionUnreadPages(180, 12, index => [0, 11, 12, 179].includes(index))]).toEqual([0, 1, 14]);
    const tree = render({ page: { page: 1, count: 15 }, selected: 12, unread: index => index === 12 || index === 179 });
    const dots = nodes(tree).filter(node => node.props["data-page"] !== undefined);
    expect(dots.filter(node => node.props["data-unread"]).map(node => node.props["data-page"])).toEqual([1, 14]);
    expect(dots[1].props["aria-current"]).toBe("page");
    expect(nodes(tree).find(node => node.type === "input")!.props["aria-describedby"]).toBe("unit-pager-unread");
    expect(nodes(tree).find(node => node.props.id === "unit-pager-unread")!.props.children).toEqual(["새 발견이 남은 페이지: ", "2, 15"]);
    expect(selected).not.toHaveBeenCalled(); expect(logActivity).not.toHaveBeenCalled();
  });
  it("consumes disabled/loading edges, excludes hidden/inert footers, and leaves editing or modified keys alone", () => {
    const visible = { disabled: false, closest: () => null, click: vi.fn() }, hidden = { disabled: false, closest: () => ({}), click: vi.fn() };
    const preventDefault = vi.fn(), stopPropagation = vi.fn(), querySelectorAll = vi.fn(() => [hidden, visible]);
    const event = { key: "ArrowRight", target: {}, currentTarget: { querySelectorAll }, preventDefault, stopPropagation };
    onCollectionArrowKey(event as unknown as KeyboardEvent<HTMLElement>);
    expect(hidden.click).not.toHaveBeenCalled(); expect(visible.click).toHaveBeenCalledOnce();
    visible.disabled = true; onCollectionArrowKey(event as unknown as KeyboardEvent<HTMLElement>);
    querySelectorAll.mockReturnValue([]); onCollectionArrowKey(event as unknown as KeyboardEvent<HTMLElement>);
    expect(preventDefault).toHaveBeenCalledTimes(3); expect(stopPropagation).toHaveBeenCalledTimes(3); expect(visible.click).toHaveBeenCalledOnce();
    for (const overrides of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { nativeEvent: { isComposing: true } }, { target: { isContentEditable: true } }, { target: { closest: () => ({}) } }]) onCollectionArrowKey({ ...event, ...overrides } as unknown as KeyboardEvent<HTMLElement>);
    expect(preventDefault).toHaveBeenCalledTimes(3); expect(querySelectorAll).toHaveBeenCalledTimes(3); expect(logActivity).not.toHaveBeenCalled();
  });
  it("retains wardrobe inspection as local try-on with its existing category-free activity target", () => {
    const tree = render({ inspectionAction: "companion-accessory-select", categoryAt: undefined, unread: index => index === 26 });
    expect(button(tree, "next").props).toMatchObject({ "data-act": "companion-accessory-select", "data-act-opt": undefined });
    click(button(tree, "next")); expect(selected).toHaveBeenCalledExactlyOnceWith(26, false, true);
  });
});
