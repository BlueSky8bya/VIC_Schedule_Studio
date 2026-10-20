import { describe, expect, it, vi } from "vitest";
import { createCompanionItemAnchors } from "@/lib/ui/viewer-companion/item-anchor";

class Style {
  declarations = new Map<string, { value: string; priority: string }>();
  getPropertyValue(property: string) { return this.declarations.get(property)?.value ?? ""; }
  getPropertyPriority(property: string) { return this.declarations.get(property)?.priority ?? ""; }
  setProperty(property: string, value: string, priority = "") { this.declarations.set(property, { value, priority }); }
  removeProperty(property: string) { const previous = this.getPropertyValue(property); this.declarations.delete(property); return previous; }
}
const document = { defaultView: { getComputedStyle: (node: { computed?: string; style: Style }) => ({ getPropertyValue: (key: string) => key === "anchor-name" ? node.computed ?? node.style.getPropertyValue(key) : "" }) } };
function element(order = 4) {
  const attributes = new Map<string, string>();
  return {
    style: new Style(), ownerDocument: document, isConnected: true, computed: "",
    compareDocumentPosition: vi.fn(() => order), getBoundingClientRect: vi.fn(() => { throw Error("Projection must not measure current layout"); }),
    getAttribute: (key: string) => attributes.get(key) ?? null,
    setAttribute: (key: string, value: string) => { attributes.set(key, value); },
    removeAttribute: (key: string) => { attributes.delete(key); },
  };
}
type MockElement = ReturnType<typeof element>;
const node = (mock: MockElement) => mock as unknown as HTMLElement;
const source = (mock: MockElement, left = 100, top = 200) => ({ element: mock as unknown as Element, left, top });
const name = (mock: MockElement) => mock.style.getPropertyValue("position-anchor");

describe("147 physical item display anchors", () => {
  it("projects against the supplied same-sample origin without rereading layout or changing world coordinates", () => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element(), point = Object.freeze({ x: 147, y: 291 });
    expect(manager.project(node(item), point, source(support))).toEqual({ x: 47, y: 91 });
    expect(point).toEqual({ x: 147, y: 291 });
    expect(name(item)).toMatch(/^--vc-item-\d+$/);
    expect(support.style.getPropertyValue("anchor-name")).toBe(name(item));
    expect(item.style.getPropertyValue("position")).toBe("fixed");
    expect(item.style.getPropertyValue("left")).toBe("anchor(left, 0px)");
    expect(item.style.getPropertyValue("top")).toBe("anchor(top, 0px)");
    expect(item.getAttribute("data-native-item-anchor")).toBe("");
    expect(support.getBoundingClientRect).not.toHaveBeenCalled();
    manager.clearAll();
    expect(item.style.getPropertyValue("position")).toBe("");
  });

  it("shares one source name across food/toy managers until the last release, then restores exact original priority", () => {
    const food = createCompanionItemAnchors(true), toys = createCompanionItemAnchors(true), support = element(), a = element(), b = element();
    support.style.setProperty("anchor-name", "--original, --also-original", "important");
    food.project(node(a), { x: 110, y: 220 }, source(support));
    toys.project(node(b), { x: 120, y: 230 }, source(support));
    expect(name(a)).toBe(name(b));
    expect(support.style.getPropertyValue("anchor-name")).toBe(`--original, --also-original, ${name(a)}`);
    expect(support.style.getPropertyPriority("anchor-name")).toBe("important");
    food.clearAll();
    expect(support.style.getPropertyValue("anchor-name")).toContain(name(b));
    toys.clear(node(b));
    expect(support.style.getPropertyValue("anchor-name")).toBe("--original, --also-original");
    expect(support.style.getPropertyPriority("anchor-name")).toBe("important");
  });

  it("preserves class-supplied names and releases the temporary inline declaration", () => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    support.computed = "--class-floor";
    manager.project(node(item), { x: 120, y: 240 }, source(support));
    expect(support.style.getPropertyValue("anchor-name")).toBe(`--class-floor, ${name(item)}`);
    manager.clearAll();
    expect(support.style.getPropertyValue("anchor-name")).toBe("");
  });

  it("releases an old source before projecting onto a different physical support", () => {
    const manager = createCompanionItemAnchors(true), first = element(), second = element(), item = element();
    first.style.setProperty("anchor-name", "none", "important");
    manager.project(node(item), { x: 110, y: 220 }, source(first));
    const initialName = name(item);
    expect(manager.project(node(item), { x: 560, y: 470 }, source(second, 500, 400))).toEqual({ x: 60, y: 70 });
    expect(first.style.getPropertyValue("anchor-name")).toBe("none");
    expect(first.style.getPropertyPriority("anchor-name")).toBe("important");
    expect(name(item)).not.toBe(initialName);
    manager.clearAll();
    expect(second.style.getPropertyValue("anchor-name")).toBe("");
  });

  it("restores original node styles and marker when flight/drag/carry removes its source", () => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    item.style.setProperty("position", "absolute", "important");
    item.style.setProperty("position-anchor", "--prior", "important");
    item.style.setProperty("left", "0px"); item.style.setProperty("top", "6px", "important");
    item.setAttribute("data-native-item-anchor", "external");
    manager.project(node(item), { x: 120, y: 250 }, source(support));
    expect(item.style.getPropertyValue("position")).toBe("fixed");
    expect(item.style.getPropertyPriority("position")).toBe("");
    expect(manager.project(node(item), { x: 13, y: 26 })).toEqual({ x: 13, y: 26 });
    expect(item.style.getPropertyValue("position")).toBe("absolute");
    expect(item.style.getPropertyPriority("position")).toBe("important");
    expect(item.style.getPropertyValue("position-anchor")).toBe("--prior");
    expect(item.style.getPropertyPriority("position-anchor")).toBe("important");
    expect(item.style.getPropertyValue("left")).toBe("0px");
    expect(item.style.getPropertyValue("top")).toBe("6px");
    expect(item.style.getPropertyPriority("top")).toBe("important");
    expect(item.getAttribute("data-native-item-anchor")).toBe("external");
    expect(support.style.getPropertyValue("anchor-name")).toBe("");
    manager.clear(node(item)); manager.clearAll();
  });

  it.each(["source-disconnected", "item-disconnected", "reversed", "different-document", "nan-point", "nan-origin", "overflow"])("rejects %s and clears a previous lease", condition => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    const point = { x: 120, y: 250 }, origin = source(support);
    manager.project(node(item), point, origin);
    if (condition === "source-disconnected") support.isConnected = false;
    if (condition === "item-disconnected") item.isConnected = false;
    if (condition === "reversed") support.compareDocumentPosition.mockReturnValue(2);
    if (condition === "different-document") item.ownerDocument = { ...document };
    if (condition === "nan-point") point.x = NaN;
    if (condition === "nan-origin") origin.top = NaN;
    if (condition === "overflow") { point.x = 1e308; origin.left = -1e308; }
    expect(manager.project(node(item), point, origin)).toEqual(point);
    expect(name(item)).toBe("");
    expect(item.getAttribute("data-native-item-anchor")).toBeNull();
    expect(support.style.getPropertyValue("anchor-name")).toBe("");
  });

  it("retains the fixed-coordinate fallback when unsupported, including a server environment without CSS", () => {
    const manager = createCompanionItemAnchors(false), support = element(), item = element();
    support.compareDocumentPosition.mockImplementation(() => { throw Error("Unsupported rendering must not inspect source DOM"); });
    expect(manager.project(node(item), { x: 10, y: 20 }, source(support))).toEqual({ x: 10, y: 20 });
    expect(support.compareDocumentPosition).not.toHaveBeenCalled();
    expect(name(item)).toBe(""); expect(support.style.getPropertyValue("anchor-name")).toBe("");
    vi.stubGlobal("CSS", undefined);
    try {
      const server = createCompanionItemAnchors();
      expect(server.project(node(item), { x: 10, y: 20 }, source(support))).toEqual({ x: 10, y: 20 });
      expect(support.compareDocumentPosition).not.toHaveBeenCalled();
      server.clearAll();
    } finally { vi.unstubAllGlobals(); }
  });

  it.each(["missing", "throws"])("safely retires an active lease when a source order method %s", condition => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    manager.project(node(item), { x: 120, y: 250 }, source(support));
    if (condition === "missing") Object.defineProperty(support, "compareDocumentPosition", { value: undefined });
    else support.compareDocumentPosition.mockImplementation(() => { throw Error("Unusable DOM source"); });
    expect(manager.project(node(item), { x: 123, y: 251 }, source(support))).toEqual({ x: 123, y: 251 });
    expect(name(item)).toBe("");
    expect(item.getAttribute("data-native-item-anchor")).toBeNull();
    expect(support.style.getPropertyValue("anchor-name")).toBe("");
  });

  it("preserves external name additions and their priority at last release", () => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    support.style.setProperty("anchor-name", "--original");
    manager.project(node(item), { x: 120, y: 250 }, source(support));
    support.style.setProperty("anchor-name", `${support.style.getPropertyValue("anchor-name")}, --external`, "important");
    manager.clearAll();
    expect(support.style.getPropertyValue("anchor-name")).toBe("--original, --external");
    expect(support.style.getPropertyPriority("anchor-name")).toBe("important");
  });

  it("keeps an external replacement through subsequent paints and restores it on cleanup", () => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    manager.project(node(item), { x: 120, y: 250 }, source(support));
    support.style.setProperty("anchor-name", "--replacement", "important");
    manager.project(node(item), { x: 125, y: 250 }, source(support));
    expect(support.style.getPropertyValue("anchor-name")).toBe(`--replacement, ${name(item)}`);
    manager.clearAll();
    expect(support.style.getPropertyValue("anchor-name")).toBe("--replacement");
    expect(support.style.getPropertyPriority("anchor-name")).toBe("important");
  });

  it("does not overwrite node or source declarations externally replaced just before cleanup", () => {
    const manager = createCompanionItemAnchors(true), support = element(), item = element();
    manager.project(node(item), { x: 120, y: 250 }, source(support));
    item.style.setProperty("left", "77px", "important"); item.setAttribute("data-native-item-anchor", "new-owner");
    support.style.setProperty("anchor-name", "--new-owner", "important");
    manager.clearAll();
    expect(item.style.getPropertyValue("left")).toBe("77px");
    expect(item.style.getPropertyPriority("left")).toBe("important");
    expect(item.getAttribute("data-native-item-anchor")).toBe("new-owner");
    expect(support.style.getPropertyValue("anchor-name")).toBe("--new-owner");
  });
});
