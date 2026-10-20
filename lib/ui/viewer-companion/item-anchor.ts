type Point = Readonly<{ x: number; y: number }>;
type Source = Readonly<{ element: Element; left: number; top: number }>;
type Declaration = { value: string; priority: string };
type NamedSource = { element: Element; style: CSSStyleDeclaration; name: string; references: number; restore: Declaration; last: Declaration };
type OwnedProperty = { restore: Declaration; last: Declaration };
type Item = { source: NamedSource; properties: Map<string, OwnedProperty>; marker: string | null };

// Food and toys have separate lifetimes, but may rest on the same real floor.
// Retire its shared name only when the last manager releases its last object.
const sources = new WeakMap<Element, NamedSource>();
let serial = 0;
const marker = "data-native-item-anchor";
const read = (style: CSSStyleDeclaration, property: string): Declaration => ({ value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) });
const equal = (a: Declaration, b: Declaration) => a.value === b.value && a.priority === b.priority;
const write = (style: CSSStyleDeclaration, property: string, declaration: Declaration) => {
  if (declaration.value) style.setProperty(property, declaration.value, declaration.priority);
  else style.removeProperty(property);
};
const names = (value: string) => value.split(",").map(name => name.trim()).filter(name => name && !/^(none|initial|inherit|unset|revert|revert-layer)$/.test(name));
const without = (declaration: Declaration, name: string): Declaration => ({ ...declaration, value: names(declaration.value).filter(value => value !== name).join(", ") });

function keepSourceName(source: NamedSource) {
  const current = read(source.style, "anchor-name");
  if (!equal(current, source.last)) source.restore = names(current.value).includes(source.name) ? without(current, source.name) : current;
  let currentNames = names(current.value);
  // An inline name must not erase a name supplied by an existing class rule.
  // This is read only on acquisition/external replacement, never a rect read.
  if (!currentNames.length) currentNames = names(source.element.ownerDocument?.defaultView?.getComputedStyle(source.element).getPropertyValue("anchor-name") ?? "");
  if (!currentNames.includes(source.name)) {
    source.style.setProperty("anchor-name", [...currentNames, source.name].join(", "), current.priority);
  }
  source.last = read(source.style, "anchor-name");
}

function releaseSource(source: NamedSource) {
  if (--source.references) return;
  const current = read(source.style, "anchor-name");
  if (equal(current, source.last)) write(source.style, "anchor-name", source.restore);
  else if (names(current.value).includes(source.name)) write(source.style, "anchor-name", without(current, source.name));
  sources.delete(source.element);
}

/** Display projection only: the caller's logical coordinates and same-sample
 * source origin remain authoritative. Native anchor scroll compensation moves
 * the drawing with its support without waiting for a JavaScript frame. */
export function createCompanionItemAnchors(supported = typeof CSS !== "undefined" && typeof CSS.supports === "function"
  && CSS.supports("position-anchor", "--vc-item") && CSS.supports("left", "anchor(left, 0px)")) {
  const items = new Map<HTMLElement, Item>();
  const clear = (node: HTMLElement) => {
    const item = items.get(node); if (!item) return;
    for (const [property, owned] of item.properties) if (equal(read(node.style, property), owned.last)) write(node.style, property, owned.restore);
    if (node.getAttribute(marker) === "") {
      if (item.marker === null) node.removeAttribute(marker); else node.setAttribute(marker, item.marker);
    }
    items.delete(node); releaseSource(item.source);
  };
  const own = (node: HTMLElement, item: Item, property: string, value: string) => {
    const current = read(node.style, property), owned = item.properties.get(property);
    const restore = owned && equal(current, owned.last) ? owned.restore : current;
    if (current.value !== value || current.priority) node.style.setProperty(property, value);
    item.properties.set(property, { restore, last: read(node.style, property) });
  };
  return {
    project(node: HTMLElement, point: Point, source?: Source): { x: number; y: number } {
      if (!supported) { clear(node); return { x: point.x, y: point.y }; }
      const offset = source && { x: point.x - source.left, y: point.y - source.top };
      const sourceStyle = source && (source.element as Element & { style?: CSSStyleDeclaration }).style;
      // Numeric flags avoid a global Node dependency during server imports.
      let order = 0;
      if (typeof source?.element.compareDocumentPosition === "function") {
        try { order = source.element.compareDocumentPosition(node); } catch { /* An unusable source keeps the fixed-coordinate fallback. */ }
      }
      if (!source || !sourceStyle || !node.isConnected || !source.element.isConnected
        || source.element.ownerDocument !== node.ownerDocument || !(order & 4) || Boolean(order & 1)
        || ![point.x, point.y, source.left, source.top, offset!.x, offset!.y].every(Number.isFinite)) {
        clear(node); return { x: point.x, y: point.y };
      }
      let item = items.get(node);
      if (item && item.source.element !== source.element) { clear(node); item = undefined; }
      if (!item) {
        let named = sources.get(source.element);
        if (!named) {
          const original = read(sourceStyle, "anchor-name");
          let name: string;
          do { name = `--vc-item-${++serial}`; } while (names(original.value).includes(name));
          named = { element: source.element, style: sourceStyle, name, references: 0, restore: original, last: original };
          sources.set(source.element, named);
        }
        named.references++;
        item = { source: named, properties: new Map(), marker: node.getAttribute(marker) };
        items.set(node, item);
      }
      keepSourceName(item.source);
      // The overlay layer is fixed, but an absolute child still has that
      // layer as its containing block and cannot resolve an outside floor.
      // Give the anchored item the viewport containing block while leased.
      own(node, item, "position", "fixed");
      own(node, item, "position-anchor", item.source.name);
      own(node, item, "left", "anchor(left, 0px)");
      own(node, item, "top", "anchor(top, 0px)");
      if (node.getAttribute(marker) !== "") node.setAttribute(marker, "");
      return offset!;
    },
    clear,
    clearAll() { for (const node of items.keys()) clear(node); },
  };
}
