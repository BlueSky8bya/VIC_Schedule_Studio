export type CompanionDetailPerch = { x: number; y: number; size: number };
type Rect = { left: number; top: number; right: number; bottom: number };

const PADDING = 12;
const GUTTER = 6;
const MAX_NODES = 1024;
const MAX_RECTS = 2048;
const MAX_CONTROLS = 256;
const MAX_EDGE_ROWS = 128;
const CONTENT = "button,a[href],input,select,textarea,[role=button],[tabindex],img,svg,video,canvas,iframe,object,embed,[role=img]";
const intersects = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const intersection = (a: Rect, b: Rect): Rect => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
const valid = (rect: Rect) => [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) && rect.right > rect.left && rect.bottom > rect.top;

function findGap(bounds: Rect, obstacles: readonly Rect[], preferredSize: number): CompanionDetailPerch | null {
  const preferred = Number.isFinite(preferredSize) && preferredSize >= 44 ? preferredSize : 92;
  for (const size of new Set([preferred, 44])) {
    if (bounds.right - bounds.left < size || bounds.bottom - bounds.top < size) continue;
    const top = bounds.top + size, bottom = bounds.bottom;
    // Exact obstacle edges catch narrow gaps between grid rows. The grid and
    // edge budget are finite even for a long, densely formatted schedule.
    const edges = obstacles.flatMap(rect => [rect.top - GUTTER, rect.bottom + GUTTER + size])
      .filter(y => y >= top && y <= bottom).sort((a, b) => b - a).slice(0, MAX_EDGE_ROWS);
    const rows = [...new Set([bottom, top, ...Array.from({ length: 33 }, (_, i) => top + (bottom - top) * i / 32), ...edges])].sort((a, b) => b - a);
    for (const y of rows) {
      const minimum = bounds.left + size / 2;
      let x = bounds.right - size / 2;
      const blocked = obstacles.filter(rect => y > rect.top - GUTTER && y - size < rect.bottom + GUTTER)
        .map(rect => ({ left: rect.left - GUTTER - size / 2, right: rect.right + GUTTER + size / 2 }))
        .sort((a, b) => b.right - a.right);
      // Descending right edges allow one leftward pass, rather than repeatedly
      // splitting an ever-growing set of spans in a densely formatted sheet.
      for (const span of blocked) {
        if (x > span.left && x < span.right) x = span.left;
        if (x < minimum) break;
      }
      if (x >= minimum) return { x, y, size };
    }
  }
  return null;
}

/** One event-owned measurement of an existing public detail window. Reads only
 * geometry, never schedule strings; dense/hidden windows fail closed so the
 * caller can keep its existing external perch. No observers or DOM writes. */
export function findCompanionDetailPerch(sheet: HTMLElement, preferredSize = 92): CompanionDetailPerch | null {
  const doc = sheet.ownerDocument, win = doc.defaultView;
  if (!sheet.isConnected || !win || sheet.closest("[inert]")) return null;
  const styles = new WeakMap<Element, CSSStyleDeclaration>(), rectangles = new WeakMap<Element, DOMRect>();
  const style = (element: Element) => { let value = styles.get(element); if (!value) { value = win.getComputedStyle(element); styles.set(element, value); } return value; };
  const rect = (element: Element) => { let value = rectangles.get(element); if (!value) { value = element.getBoundingClientRect(); rectangles.set(element, value); } return value; };
  const visible = (element: Element | null): boolean => {
    for (let node = element; node; node = node.parentElement) {
      const css = style(node);
      if (node.hasAttribute("hidden") || css.display === "none" || css.visibility === "hidden" || css.visibility === "collapse" || Number(css.opacity || 1) <= .01) return false;
    }
    return true;
  };
  if (!visible(sheet)) return null;
  const viewport = { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight };
  const clipping = (element: Element | null, initial: Rect): Rect => {
    let result = initial;
    for (let node = element; node; node = node.parentElement) {
      const css = style(node), x = /hidden|clip|scroll|auto/.test(css.overflowX), y = /hidden|clip|scroll|auto/.test(css.overflowY);
      if (!x && !y) continue;
      const box = rect(node);
      result = intersection(result, { left: x ? box.left : result.left, right: x ? box.right : result.right, top: y ? box.top : result.top, bottom: y ? box.bottom : result.bottom });
    }
    return result;
  };
  const windowBounds = clipping(sheet.parentElement, intersection(rect(sheet), viewport));
  const bounds = { left: windowBounds.left + PADDING, top: windowBounds.top + PADDING, right: windowBounds.right - PADDING, bottom: windowBounds.bottom - PADDING };
  if (!valid(bounds)) return null;
  const obstacles: Rect[] = [];
  const append = (value: Rect, parent: Element) => {
    const clipped = clipping(parent, intersection(value, windowBounds));
    if (valid(clipped) && intersects(clipped, bounds)) obstacles.push(clipped);
    return obstacles.length <= MAX_RECTS;
  };
  const range = doc.createRange();
  try {
    const walker = doc.createTreeWalker(sheet, 4 /* SHOW_TEXT: no global document assumption. */);
    let count = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (++count > MAX_NODES) return null;
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script,style,template,noscript,.sr-only,.vc-companion")) continue;
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (!append(box, parent)) return null;
    }
    const controls = sheet.querySelectorAll(CONTENT);
    if (controls.length > MAX_CONTROLS) return null;
    for (const element of controls) {
      if (!visible(element) || element.closest(".vc-companion")) continue;
      if (!append(rect(element), element.parentElement ?? sheet)) return null;
    }
  } catch { return null; }
  finally { range.detach(); }
  return findGap(bounds, obstacles, preferredSize);
}
