import { describe, expect, it, vi } from "vitest";
import { collectCompanionHideTargets, COMPANION_DETAIL_EVENT } from "@/lib/ui/viewer-companion/hide-targets";

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;
class FixtureNode {
  isConnected = true;
  parentElement: FixtureNode | null = null;
  dataset: Record<string, string> = {};
  style = { display: "block", visibility: "visible", opacity: "1", overflowX: "visible", overflowY: "visible" };
  box = rect(100, 150, 200, 30);
  card = false;
  control = false;
  companion = false;
  excluded = false;
  day = false;
  classList = { contains: (name: string) => name === "studio-day" && this.day };
  contains(node: FixtureNode): boolean { return node === this || Boolean(node.parentElement && this.contains(node.parentElement)); }
  getBoundingClientRect = vi.fn(() => this.box);
  // The adapter must never inspect schedule text or other DTO fields.
  get textContent(): never { throw new Error("SYNTHETIC_TITLE_CANARY must not be read"); }
  matches(selector: string) { return selector.startsWith(".teaser,") ? this.excluded : selector.startsWith(".public-event[") ? this.card : false; }
  closest(selector: string): FixtureNode | null {
    const match = selector.startsWith(".public-event[") ? this.card : selector.startsWith("button,") ? this.control || this.card : selector.startsWith(".vc-companion,") ? this.companion : false;
    return match ? this : this.parentElement?.closest(selector) ?? null;
  }
}
function fixture() {
  const root = new FixtureNode(), cards: FixtureNode[] = [], layers: FixtureNode[] = [];
  root.box = rect(0, 0, 1000, 800);
  const win = { innerWidth: 1000, innerHeight: 800, getComputedStyle: vi.fn((node: FixtureNode) => node.style) };
  const doc = { defaultView: win, elementsFromPoint: vi.fn((x: number, y: number) => [...layers, ...cards].filter(node => node.isConnected && x >= node.box.left && x <= node.box.right && y >= node.box.top && y <= node.box.bottom)) };
  const dom = Object.assign(root, { ownerDocument: doc, querySelectorAll: vi.fn(() => cards) });
  const add = (id = "public-1", parent = root) => { const node = new FixtureNode(); node.card = true; node.dataset.eventid = id; node.parentElement = parent; cards.push(node); return node; };
  return { root: dom as unknown as HTMLElement, sourceRoot: root, cards, layers, win, doc, add };
}

describe("ordinary public-card hide targets", () => {
  it("returns only a local public id, DOM identity, clipped bounds and a native free entry", () => {
    const f = fixture(), card = f.add();
    const target = collectCompanionHideTargets(f.root)[0];
    expect(COMPANION_DETAIL_EVENT).toBe("vic:companion-detail");
    expect(Object.keys(target).sort()).toEqual(["element", "entry", "eventId", "rect"]);
    expect(target).toEqual({ eventId: "public-1", element: card, rect: { left: 100, top: 150, right: 300, bottom: 180, width: 200, height: 30 }, entry: { x: 200, y: 165 } });
    expect(card.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });
  it("rejects teaser, placeholder, dimmed, inert and hidden cards or hidden ancestors", () => {
    const f = fixture();
    for (let i = 0; i < 5; i++) f.add(`excluded-${i}`).excluded = true;
    const hiddenParent = new FixtureNode(); hiddenParent.parentElement = f.sourceRoot; hiddenParent.style.opacity = "0";
    f.add("behind-hidden-parent", hiddenParent);
    const detached = f.add("detached"); detached.isConnected = false;
    expect(collectCompanionHideTargets(f.root)).toEqual([]);
    expect(f.cards.every(node => node.getBoundingClientRect.mock.calls.length === 0)).toBe(true);
  });
  it("uses viewport and actual overflow clips, and never enters an offscreen or sliver card", () => {
    const f = fixture(), clip = new FixtureNode(); clip.parentElement = f.sourceRoot; clip.style.overflowX = "hidden"; clip.style.overflowY = "auto"; clip.box = rect(120, 160, 100, 30);
    const card = f.add("clipped", clip); card.box = rect(100, 150, 200, 60);
    f.add("offscreen").box = rect(1100, 100, 100, 40);
    f.add("sliver").box = rect(996, 100, 100, 40);
    expect(collectCompanionHideTargets(f.root)).toMatchObject([{ eventId: "clipped", rect: { left: 120, top: 160, right: 220, bottom: 190, width: 100, height: 30 } }]);
    expect(clip.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });
  it("protects complete native child controls while allowing the card's own role=button", () => {
    const f = fixture(), card = f.add(), heart = new FixtureNode(); heart.control = true; heart.parentElement = card; heart.box = rect(178, 150, 44, 30); f.layers.push(heart);
    const target = collectCompanionHideTargets(f.root)[0];
    expect(target.entry).toEqual({ x: 140, y: 165 });
    expect(target.element).toBe(card);
    heart.box = card.box;
    expect(collectCompanionHideTargets(f.root)).toEqual([]);
  });
  it("does not hide behind another opaque room or card, and ignores only its own presentation carriers", () => {
    const f = fixture(), card = f.add(), cover = new FixtureNode(); cover.box = card.box; f.layers.push(cover);
    expect(collectCompanionHideTargets(f.root)).toEqual([]);
    cover.companion = true;
    expect(collectCompanionHideTargets(f.root)).toHaveLength(1);
    cover.companion = false; cover.card = true; cover.dataset.eventid = "other-public-event";
    expect(collectCompanionHideTargets(f.root)).toEqual([]);
  });
  it("bounds candidates at200 and reads each shared clipping rectangle only once", () => {
    const f = fixture(); f.sourceRoot.style.overflowY = "hidden";
    for (let i = 0; i < 205; i++) f.add(`public-${i}`);
    // Each card is tested against a native hit of that same element. The cap,
    // rather than overlapping sibling paint order, is this test's concern.
    let index = 0; f.doc.elementsFromPoint.mockImplementation(() => [f.cards[index++]]);
    expect(collectCompanionHideTargets(f.root)).toHaveLength(200);
    expect(f.cards.slice(200).every(node => node.getBoundingClientRect.mock.calls.length === 0)).toBe(true);
    expect(f.sourceRoot.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(f.doc.elementsFromPoint).toHaveBeenCalledTimes(200);
  });
  it("rejects unstructured identifiers and nonfinite geometry without copying titles", () => {
    const f = fixture();
    for (const id of ["", "has spaces", "synthetic@example.invalid", "x".repeat(97)]) f.add(id);
    f.add("nan").box = rect(NaN, 100, 100, 40);
    expect(collectCompanionHideTargets(f.root)).toEqual([]);
    f.sourceRoot.isConnected = false; expect(collectCompanionHideTargets(f.root)).toEqual([]);
  });

  it("requires an ordinary-public studio marker and accepts its structural day container only", () => {
    const f = fixture(); f.sourceRoot.dataset.companionSurface = "studio";
    const card = f.add(); expect(collectCompanionHideTargets(f.root)).toEqual([]);
    card.dataset.companionEvent = "ordinary";
    const day = new FixtureNode(); day.day = true; day.control = true; day.parentElement = f.sourceRoot;
    card.parentElement = day; card.card = false;
    // The real card is a div, whose enclosing day has role=button.
    const originalClosest = card.closest.bind(card);
    card.closest = selector => selector.startsWith(".public-event[") ? card : originalClosest(selector);
    expect(collectCompanionHideTargets(f.root)).toHaveLength(1);
    day.day = false; expect(collectCompanionHideTargets(f.root)).toEqual([]);
    card.dataset.companionEvent = "teaser"; day.day = true; expect(collectCompanionHideTargets(f.root)).toEqual([]);
  });
});
