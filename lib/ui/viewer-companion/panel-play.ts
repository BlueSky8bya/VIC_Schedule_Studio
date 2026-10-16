import type { PanelSide } from "../use-side-panel";

export const COMPANION_PANEL_SIDE_EVENT = "vic:companion-panel-side";
export const COMPANION_PANEL_SIDE_SELECTOR = ".panel-place-ctl .ppc-side[data-companion-panel-side]";
export const COMPANION_PANEL_PREVIEW_MS = 7000;

/** One exact shared panel arrow owns this affordance. This does not synthesize
 * a click, discover arbitrary controls or change the user's saved position. */
export function requestCompanionPanelSide(element: Element | undefined, side: PanelSide): boolean {
  if (!element?.isConnected || !element.matches(COMPANION_PANEL_SIDE_SELECTOR)
    || element.getAttribute("data-companion-panel-side") !== side
    || element.getAttribute("aria-pressed") !== "false" || element.hasAttribute("disabled")
    || element.closest("[inert],[hidden],[aria-hidden='true'],[data-companion-workspace-busy],[data-premiere]")) return false;
  const doc = element.ownerDocument, win = doc.defaultView;
  if (!win || doc.hidden || doc.documentElement.hasAttribute("data-reduce-motion")) return false;
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = win.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity || 1) <= .05) return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || rect.left < 0 || rect.right > win.innerWidth || rect.top < 0 || rect.bottom > win.innerHeight) return false;
  // The shared control cancels only an accepted request. Unmounted, stale or
  // inert controls therefore fail closed without falling back to .click().
  return !element.dispatchEvent(new CustomEvent(COMPANION_PANEL_SIDE_EVENT, { bubbles: true, cancelable: true, detail: { side } }));
}
