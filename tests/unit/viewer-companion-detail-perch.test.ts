import { describe, expect, it, vi } from "vitest";
import { findCompanionDetailPerch, type CompanionDetailPerch } from "@/lib/ui/viewer-companion/detail-perch";

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect;
class ElementFixture {
  isConnected = true;
  parentElement: ElementFixture | null = null;
  hidden = false;
  inert = false;
  ignored = false;
  editor = false;
  editorField: ElementFixture | null = null;
  decorativeEditorRing = false;
  matches = () => this.decorativeEditorRing;
  style = { display: "block", visibility: "visible", opacity: "1", overflowX: "visible", overflowY: "visible" };
  rect = box(0, 0, 400, 300);
  getBoundingClientRect = vi.fn(() => this.rect);
  hasAttribute = (name: string) => name === "hidden" && this.hidden || name === "data-companion-detail-editor" && this.editor;
  querySelector = () => this.editorField;
  closest(selector: string): ElementFixture | null {
    if (selector === "[inert]" && this.inert || selector !== "[inert]" && this.ignored) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  controls: ElementFixture[] = [];
  querySelectorAll = () => this.controls;
}
function fixture() {
  const sheet = new ElementFixture();
  const nodes: { parentElement: ElementFixture; rects: DOMRect[] }[] = [];
  const getComputedStyle = vi.fn((element: ElementFixture) => element.style);
  const range = { current: nodes[0], selectNodeContents: vi.fn(function (this: { current: typeof nodes[number] }, node: typeof nodes[number]) { this.current = node; }), getClientRects: vi.fn(function (this: { current: typeof nodes[number] }) { return this.current.rects; }), detach: vi.fn() };
  const doc = { defaultView: { innerWidth: 1000, innerHeight: 800, getComputedStyle }, createRange: vi.fn(() => range), createTreeWalker: vi.fn(() => { let next = 0; return { nextNode: () => nodes[next++] ?? null }; }) };
  Object.assign(sheet, { ownerDocument: doc });
  Object.defineProperty(sheet, "textContent", { get() { throw new Error("Schedule strings must not be read"); } });
  const text = (rects: DOMRect[], parent = sheet) => {
    const node = { parentElement: parent, rects };
    Object.defineProperty(node, "nodeValue", { get() { throw new Error("Schedule strings must not be read"); } });
    nodes.push(node); return node;
  };
  const control = (rect: DOMRect) => { const element = new ElementFixture(); element.rect = rect; element.parentElement = sheet; sheet.controls.push(element); return element; };
  const find = (size?: number) => findCompanionDetailPerch(sheet as unknown as HTMLElement, size);
  return { sheet, nodes, range, doc, getComputedStyle, text, control, find };
}
function cell(point: CompanionDetailPerch) { return { left: point.x - point.size / 2, top: point.y - point.size, right: point.x + point.size / 2, bottom: point.y }; }
function clear(point: CompanionDetailPerch, obstacle: DOMRect) {
  const c = cell(point);
  expect(c.right <= obstacle.left - 6 || c.left >= obstacle.right + 6 || c.bottom <= obstacle.top - 6 || c.top >= obstacle.bottom + 6).toBe(true);
}

describe("finite public detail-window companion perch", () => {
  it("keeps the full92px sprite inside the real window with12px padding", () => {
    const f = fixture(); f.sheet.rect = box(100, 50, 500, 350);
    expect(f.find()).toEqual({ x: 442, y: 338, size: 92 });
    expect(cell(f.find()!)).toEqual({ left: 396, top: 246, right: 488, bottom: 338 });
    expect(f.sheet.getBoundingClientRect).toHaveBeenCalledTimes(2); // One read per independent invocation.
  });

  it("prefers an available full-size gap instead of shrinking near text or native controls", () => {
    const f = fixture(), title = box(0, 0, 400, 70), button = box(250, 180, 400, 300);
    f.text([title]); f.control(button);
    const point = f.find()!;
    expect(point.size).toBe(92); clear(point, title); clear(point, button);
    expect(point.x).toBeLessThan(250);
    expect(f.range.selectNodeContents).toHaveBeenCalledTimes(1);
  });

  it("uses44px only when all full-size positions are blocked and returns null if even44px cannot fit", () => {
    const f = fixture(); f.sheet.rect = box(0, 0, 200, 200); const content = box(0, 0, 200, 130); f.text([content]);
    const point = f.find()!; expect(point.size).toBe(44); clear(point, content);
    f.nodes[0].rects = [box(0, 0, 200, 200)]; expect(f.find()).toBeNull();
  });

  it("crosses overlapping control exclusions in one direction without leaving the pet in either target", () => {
    const f = fixture(), controls = [box(250, 180, 400, 300), box(160, 180, 240, 300), box(180, 190, 300, 280)];
    controls.forEach(rect => f.control(rect)); const point = f.find()!;
    expect(point).toEqual({ x: 108, y: 288, size: 92 }); controls.forEach(rect => clear(point, rect));
    for (const control of f.sheet.controls) expect(control.getBoundingClientRect).toHaveBeenCalledOnce();
  });

  it("uses exact obstacle edges to find a narrow gap between the regular grid rows", () => {
    const f = fixture(); f.sheet.rect = box(0, 0, 150, 250);
    const above = box(0, 0, 150, 76.5), below = box(0, 132.5, 150, 250);
    f.text([above, below]); const point = f.find()!;
    expect(point).toEqual({ x: 116, y: 126.5, size: 44 }); clear(point, above); clear(point, below);
  });

  it("clips scrolled-away glyphs to their actual overflow container, without reading their strings", () => {
    const f = fixture(), scroller = new ElementFixture(); scroller.parentElement = f.sheet;
    scroller.rect = box(0, 20, 400, 60); scroller.style.overflowY = "auto";
    f.text([box(0, 200, 400, 260)], scroller);
    expect(f.find()).toEqual({ x: 342, y: 288, size: 92 });
    expect(f.range.getClientRects).toHaveBeenCalledTimes(1); expect(f.range.detach).toHaveBeenCalledTimes(1);
    expect(scroller.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(f.getComputedStyle.mock.calls.filter(([element]) => element === scroller)).toHaveLength(1);
  });

  it("respects both viewport and ancestor overflow boundaries before applying the inner padding", () => {
    const f = fixture(), clip = new ElementFixture(); clip.rect = box(0, 0, 220, 210); clip.style.overflowX = "hidden"; clip.style.overflowY = "clip";
    f.sheet.parentElement = clip; f.sheet.rect = box(-20, -30, 400, 300); f.doc.defaultView.innerWidth = 200;
    const point = f.find()!; expect(point).toEqual({ x: 142, y: 198, size: 92 });
    const c = cell(point); expect(c.left).toBeGreaterThanOrEqual(12); expect(c.right).toBe(188); expect(c.top).toBeGreaterThanOrEqual(12);
  });

  it("protects visible decorative media too, while ignoring actually hidden glyphs", () => {
    const f = fixture(), hidden = new ElementFixture(); hidden.parentElement = f.sheet; hidden.hidden = true;
    f.text([box(0, 0, 400, 300)], hidden); const image = box(200, 150, 400, 300); f.control(image);
    const point = f.find()!; expect(point.size).toBe(92); clear(point, image);
    expect(f.range.getClientRects).not.toHaveBeenCalled();
  });

  it("lets a studio guest nap only in blank editable geometry without touching its text", () => {
    const f = fixture(); f.sheet.editor = true;
    const field = f.control(box(20, 40, 380, 120)); f.sheet.editorField = field;
    const title = box(30, 50, 190, 75); f.text([title], field);
    const point = f.find()!;
    expect(point).toEqual({ x: 352, y: 114, size: 44 }); clear(point, title);
    expect(cell(point).left).toBeGreaterThanOrEqual(field.rect.left + 6);
    expect(cell(point).top).toBeGreaterThanOrEqual(field.rect.top + 6);
    expect(f.range.selectNodeContents).toHaveBeenCalledOnce();
  });

  it("fails closed for missing/full/clipped studio fields and keeps other editables protected", () => {
    const f = fixture(); f.sheet.editor = true; expect(f.find()).toBeNull();
    const field = f.control(box(20, 40, 380, 120)); f.sheet.editorField = field;
    f.text([box(20, 40, 380, 120)], field); expect(f.find()).toBeNull();
    f.nodes.length = 0;
    const otherField = f.control(box(20, 40, 380, 120)); expect(f.find()).toBeNull();
    otherField.hidden = true;
    field.hidden = true; expect(f.find()).toBeNull();
    field.hidden = false; field.style.overflowY = "auto";
    f.sheet.rect = box(0, 0, 400, 80); expect(f.find()).toBeNull();
  });

  it("ignores only the studio's direct decorative perimeter, retaining real media/control protection", () => {
    const f = fixture(); f.sheet.editor = true;
    f.sheet.editorField = f.control(box(20, 40, 380, 120));
    const outline = f.control(box(0, 0, 400, 300)); outline.decorativeEditorRing = true;
    expect(f.find()).toEqual({ x: 352, y: 114, size: 44 });
    outline.decorativeEditorRing = false; expect(f.find()).toBeNull();
    outline.decorativeEditorRing = true; f.sheet.editor = false; expect(f.find()).toBeNull();
  });

  it("fails closed for hidden, detached, inert, malformed or excessively dense windows", () => {
    for (const mode of ["hidden", "detached", "inert", "invalid"] as const) {
      const f = fixture();
      if (mode === "hidden") f.sheet.hidden = true;
      if (mode === "detached") f.sheet.isConnected = false;
      if (mode === "inert") f.sheet.inert = true;
      if (mode === "invalid") f.sheet.rect = box(NaN, 0, 400, 300);
      expect(f.find()).toBeNull();
    }
    const texts = fixture(); for (let i = 0; i < 1025; i++) texts.text([]);
    expect(texts.find()).toBeNull(); expect(texts.range.getClientRects).toHaveBeenCalledTimes(1024); expect(texts.range.detach).toHaveBeenCalledOnce();
    const controls = fixture(); for (let i = 0; i < 257; i++) controls.control(box(0, 0, 1, 1));
    expect(controls.find()).toBeNull(); expect(controls.range.detach).toHaveBeenCalledOnce();
  });
});
