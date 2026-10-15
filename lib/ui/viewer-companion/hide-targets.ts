/** One device-local bridge. Public event ids identify already rendered cards;
 * no title, date, tag, account, server request or persisted game state crosses it. */
export const COMPANION_DETAIL_EVENT = "vic:companion-detail";
export type CompanionDetailNotice = { eventId: string | null; sheet: HTMLElement | null; ready: boolean };
export type CompanionHideRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type CompanionHideTarget = { eventId: string; element: HTMLElement; rect: CompanionHideRect; entry: { x: number; y: number } };
const CARD = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]";
const EXCLUDED = ".teaser,.teaser-revealing,.dimmed,[inert],[hidden],[aria-hidden='true']";
const CONTROL = "button,a[href],input,select,textarea,[role='button']";
const publicId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);

/** Call only when choosing/revalidating one finite hide action. Native hit
 * testing protects complete controls and opaque rooms without treating the
 * schedule's own role=button as an obstacle. No observers or polling live here.
 * The drawing may enter a small card; this is not a92px standing-platform test. */
export function collectCompanionHideTargets(root: HTMLElement): CompanionHideTarget[] {
  const doc = root.ownerDocument, win = doc.defaultView;
  if (!win || !root.isConnected || !Number.isFinite(win.innerWidth) || !Number.isFinite(win.innerHeight)) return [];
  const styles = new Map<Element, CSSStyleDeclaration>(), visibility = new Map<Element, boolean>(), bounds = new Map<Element, DOMRect>();
  const style = (node: Element) => { const value = styles.get(node) ?? win.getComputedStyle(node); styles.set(node, value); return value; };
  const measure = (node: Element) => { const value = bounds.get(node) ?? node.getBoundingClientRect(); bounds.set(node, value); return value; };
  const visible = (node: Element | null): boolean => {
    if (!node) return true;
    const cached = visibility.get(node); if (cached !== undefined) return cached;
    const css = style(node);
    const value = !node.matches(EXCLUDED) && css.display !== "none" && !["hidden", "collapse"].includes(css.visibility) && Number(css.opacity || 1) > .05 && visible(node.parentElement);
    visibility.set(node, value); return value;
  };
  const targets: CompanionHideTarget[] = [];
  // querySelectorAll is one bounded source lookup; inspect at most200 cards.
  const cards = root.querySelectorAll<HTMLElement>(CARD);
  for (let index = 0; index < Math.min(cards.length, 200); index++) {
    const element = cards[index];
    const eventId = element.dataset.eventid;
    // Studio DOM also contains nonpublic/support/teaser cards. Only the
    // explicit ordinary-public marker may participate in the shared game.
    if (root.dataset.companionSurface === "studio" && element.dataset.companionEvent !== "ordinary") continue;
    if (!publicId(eventId) || !element.isConnected || !visible(element)) continue;
    const box = measure(element);
    if (![box.left, box.top, box.right, box.bottom].every(Number.isFinite)) continue;
    let left = Math.max(0, box.left), top = Math.max(0, box.top), right = Math.min(win.innerWidth, box.right), bottom = Math.min(win.innerHeight, box.bottom);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const css = style(parent), clipX = /^(auto|scroll|hidden|clip)$/.test(css.overflowX), clipY = /^(auto|scroll|hidden|clip)$/.test(css.overflowY);
      if (!clipX && !clipY) continue;
      const clip = measure(parent);
      if (clipX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (clipY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
    }
    if (right - left < 12 || bottom - top < 8) continue;
    const rect = { left, top, right, bottom, width: right - left, height: bottom - top };
    let entry: CompanionHideTarget["entry"] | undefined;
    for (const fy of [.5, .75, .25]) {
      for (const fx of [.5, .2, .8]) {
        const point = { x: left + rect.width * fx, y: top + rect.height * fy };
        // Companion/food carriers may temporarily sit above the same card;
        // the user's underlying calendar click remains the target contract.
        const hit = doc.elementsFromPoint(point.x, point.y).find(node => !node.closest(".vc-companion,.vc-food-layer"));
        if (!hit || hit.closest(CARD) !== element) continue;
        const control = hit.closest(CONTROL);
        if (control && control !== element && !(root.dataset.companionSurface === "studio" && control.classList.contains("studio-day") && control.contains(element))) continue;
        entry = point; break;
      }
      if (entry) break;
    }
    if (entry) targets.push({ eventId, element, rect, entry });
  }
  return targets;
}
