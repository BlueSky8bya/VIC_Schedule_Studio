import type { Platform } from "./brain";

const CARD_SELECTOR = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const DAY_SELECTOR = ".public-day,.agenda-day";
const OCCUPIED_SELECTOR = `${CARD_SELECTOR},.support-bar,.agenda-event[data-supportid]`;
const MAX_PLATFORMS = 200;
const MEASUREMENT_INTERVAL_MS = 120;

/** The pet sees walkable rectangles, never event ids, titles, tag text or auth
 * data. All coordinates are fixed viewport CSS pixels, including under zoom.
 * Nothing is measured on an idle animation loop; layout events coalesce. */
export function observeCompanionPlatforms(root: HTMLElement, onChange: (platforms: Platform[]) => void): () => void {
  const win = root.ownerDocument.defaultView;
  if (!win) return () => {};
  const ids = new WeakMap<Element, string>();
  let serial = 0;
  const idFor = (element: Element, kind: "card" | "date") => {
    let id = ids.get(element);
    if (!id) { id = `${kind}-${++serial}`; ids.set(element, id); }
    return id;
  };
  let disposed = false;
  let frame = 0;
  let timer = 0;
  let measuredAt = -Infinity;
  let previous = "";
  const observed = new Set<Element>();
  const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);

  function measure() {
    frame = 0;
    if (disposed) return;
    measuredAt = win!.performance.now();
    const width = win!.innerWidth;
    const height = win!.innerHeight;
    const platforms: Platform[] = [{ id: "viewport-floor", x: 12, y: Math.max(0, height - 18), width: Math.max(1, width - 24), kind: "floor" }];
    const nextObserved = new Set<Element>([root]);
    const visibleCache = new Map<Element, boolean>();
    function visible(element: Element | null): boolean {
      if (!element) return true;
      const cached = visibleCache.get(element);
      if (cached !== undefined) return cached;
      const style = win!.getComputedStyle(element);
      const own = !element.hasAttribute("hidden") && !element.hasAttribute("inert")
        && element.getAttribute("aria-hidden") !== "true"
        && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse"
        && Number(style.opacity || 1) > .05;
      const result = own && visible(element.parentElement);
      visibleCache.set(element, result);
      return result;
    }
    function surface(rect: DOMRect, y: number) {
      if (!Number.isFinite(y) || y < 12 || y > height - 12 || rect.height <= 0) return undefined;
      const x = Math.max(12, rect.left);
      const right = Math.min(width - 12, rect.right);
      return right - x >= 24 ? { x, y, width: right - x } : undefined;
    }
    function hasRenderedContent(day: HTMLElement) {
      for (const content of day.querySelectorAll<HTMLElement>(OCCUPIED_SELECTOR)) {
        // Filtered cards still occupy their original layout. A pet must not
        // sleep through faint text merely because that card is not a ledge.
        const rect = content.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return true;
      }
      return false;
    }
    if (root.isConnected && visible(root)) {
      for (const element of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
        if (platforms.length >= MAX_PLATFORMS) break;
        nextObserved.add(element);
        if (!visible(element) || element.closest(".dimmed")) continue;
        const rect = element.getBoundingClientRect();
        const top = surface(rect, rect.top + 1);
        if (!top) continue;
        const platform: Platform = { id: idFor(element, "card"), ...top, kind: "card" };
        const heart = element.querySelector<HTMLElement>(".event-heart");
        if (heart && visible(heart)) {
          const heartRect = heart.getBoundingClientRect();
          const x = heartRect.left + heartRect.width / 2;
          const y = heartRect.top + heartRect.height / 2;
          if (heartRect.width > 0 && heartRect.height > 0 && x >= 0 && x <= width && y >= 0 && y <= height) platform.heart = { x, y, blocked: heart.getAttribute("aria-pressed") === "true" || heart.hasAttribute("data-companion-hearted") || heart.hasAttribute("data-companion-heart-blocked") };
        }
        platforms.push(platform);
      }
      for (const day of root.querySelectorAll<HTMLElement>(DAY_SELECTOR)) {
        if (platforms.length >= MAX_PLATFORMS) break;
        nextObserved.add(day);
        if (!visible(day)) continue;
        const rect = day.getBoundingClientRect();
        // A date needs actual spare vertical room for a resting sprite. Tiny
        // agenda rows retain readable date/empty labels and use the floor.
        if (rect.height < 88 || hasRenderedContent(day)) continue;
        const bottom = surface(rect, rect.bottom - 12);
        if (bottom) platforms.push({ id: idFor(day, "date"), ...bottom, kind: "date" });
      }
    }
    for (const element of observed) {
      if (!nextObserved.has(element)) { resizeObserver?.unobserve(element); observed.delete(element); }
    }
    for (const element of nextObserved) {
      if (!observed.has(element)) { resizeObserver?.observe(element); observed.add(element); }
    }
    // Suppress equal layout deliveries, including a countdown's text mutation.
    const signature = JSON.stringify(platforms);
    if (signature !== previous) { previous = signature; onChange(platforms); }
  }

  function schedule() {
    if (disposed || frame || timer) return;
    const wait = Math.max(0, MEASUREMENT_INTERVAL_MS - (win!.performance.now() - measuredAt));
    if (wait > 0) {
      timer = win!.setTimeout(() => { timer = 0; if (!disposed) frame = win!.requestAnimationFrame(measure); }, wait);
    } else frame = win!.requestAnimationFrame(measure);
  }

  const mutationObserver = new MutationObserver(records => {
    if (records.some(record => record.type === "childList" || record.type === "attributes")) schedule();
  });
  mutationObserver.observe(root, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-pressed", "data-companion-hearted", "data-companion-heart-blocked", "data-premiere", "data-pm-depart"],
  });
  // Ancestor visibility can change when the same shared viewer enters/leaves
  // preview. Observe only its attributes, not the rest of the application.
  for (let parent = root.parentElement; parent; parent = parent.parentElement) {
    mutationObserver.observe(parent, { attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden"] });
  }
  win.addEventListener("resize", schedule, { passive: true });
  win.addEventListener("scroll", schedule, { passive: true, capture: true });
  root.addEventListener("transitionend", schedule);
  root.addEventListener("animationend", schedule);
  root.ownerDocument.fonts?.addEventListener("loadingdone", schedule);
  schedule();

  return () => {
    disposed = true;
    win.cancelAnimationFrame(frame);
    win.clearTimeout(timer);
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
    win.removeEventListener("resize", schedule);
    win.removeEventListener("scroll", schedule, true);
    root.removeEventListener("transitionend", schedule);
    root.removeEventListener("animationend", schedule);
    root.ownerDocument.fonts?.removeEventListener("loadingdone", schedule);
    observed.clear();
  };
}
