import type { Platform } from "./brain";

const CARD_SELECTOR = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const DAY_SELECTOR = ".public-day,.agenda-day";
const DATE_TEXT_SELECTOR = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong";
const CARD_TEXT_SELECTOR = ".public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";
const TEXT_SURFACE_SELECTOR = `${DATE_TEXT_SELECTOR},${CARD_TEXT_SELECTOR}`;
const MAX_PLATFORMS = 200;
const MEASUREMENT_INTERVAL_MS = 120;
const CLEARANCE = 3;
const DEFAULT_SIZE = 76;

export type CompanionTextRect = { left: number; right: number; top: number; bottom: number };
export type CompanionSurface = { x: number; y: number; width: number };
export type CompanionFootprint = { width: number; height: number };
export type CompanionGeometryOptions = { size?: number; home?: HTMLElement | null; getHome?: () => HTMLElement | null };

/** Text behind the opaque house is not visible ink. Keep any part outside its
 * bounds, so a character overhanging the house still avoids exposed labels. */
export function unoccludedCompanionRects(rect: CompanionTextRect, cover?: CompanionTextRect): CompanionTextRect[] {
  if (!cover || cover.left >= rect.right || cover.right <= rect.left || cover.top >= rect.bottom || cover.bottom <= rect.top) return [rect];
  const left = Math.max(rect.left, cover.left), right = Math.min(rect.right, cover.right);
  const top = Math.max(rect.top, cover.top), bottom = Math.min(rect.bottom, cover.bottom);
  const parts = [
    { left: rect.left, right: rect.right, top: rect.top, bottom: top },
    { left: rect.left, right: rect.right, top: bottom, bottom: rect.bottom },
    { left: rect.left, right: left, top, bottom },
    { left: right, right: rect.right, top, bottom },
  ];
  return parts.filter(part => part.right > part.left && part.bottom > part.top);
}

/** Output spans are safe character-centre intervals, not the card's outer box.
 * Every centre along a span leaves the whole sprite clear of rendered text.
 * The brain's usual landing inset provides additional room at either end. */
export function safeCompanionSurfaces(
  surface: CompanionSurface,
  obstacles: readonly CompanionTextRect[],
  size: number,
  viewport: { width: number; height: number },
  footprint: CompanionFootprint = { width: size, height: size },
): CompanionSurface[] {
  if (![surface.x, surface.y, surface.width, size, viewport.width, viewport.height, footprint.width, footprint.height].every(Number.isFinite)
    || size <= 0 || footprint.width <= 0 || footprint.height <= 0 || surface.width <= 0 || surface.y < size + CLEARANCE || surface.y > viewport.height - 12) return [];
  const half = size / 2;
  const bodyHalf = footprint.width / 2;
  const left = Math.max(surface.x, half + 4);
  const right = Math.min(surface.x + surface.width, viewport.width - half - 4);
  if (right - left < 1) return [];
  let spans: [number, number][] = [[left, right]];
  for (const rect of obstacles) {
    if (![rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)
      || rect.right <= rect.left || rect.bottom <= rect.top
      || rect.top >= surface.y + CLEARANCE || rect.bottom <= surface.y - footprint.height - CLEARANCE) continue;
    const blockedLeft = rect.left - bodyHalf - CLEARANCE;
    const blockedRight = rect.right + bodyHalf + CLEARANCE;
    const next: [number, number][] = [];
    for (const [a, b] of spans) {
      if (blockedRight <= a || blockedLeft >= b) { next.push([a, b]); continue; }
      if (blockedLeft - a >= 1) next.push([a, Math.min(b, blockedLeft)]);
      if (b - blockedRight >= 1) next.push([Math.max(a, blockedRight), b]);
    }
    spans = next;
    if (!spans.length) break;
  }
  return spans.map(([x, rightEdge]) => ({ x, y: surface.y, width: rightEdge - x }));
}

/** The pet sees walkable rectangles, never event ids, titles, tag text or auth
 * data. All coordinates are fixed viewport CSS pixels, including under zoom.
 * Nothing is measured on an idle animation loop; layout events coalesce. */
export function observeCompanionPlatforms(root: HTMLElement, onChange: (platforms: Platform[]) => void, options: CompanionGeometryOptions = {}): () => void {
  const win = root.ownerDocument.defaultView;
  if (!win) return () => {};
  const size = Number.isFinite(options.size) && options.size! > 0 ? options.size! : DEFAULT_SIZE;
  // Registered/curated atlas union occupies <.70 width and <.713 height of the
  // square cell. .76 plus 3px clearance includes pose bob/scale and pixel edges;
  // transparent hairline padding must not eliminate every narrow agenda ledge.
  const footprint = { width: size * .76, height: size * .76 };
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
  let observedHome: HTMLElement | null = null;
  const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
  const homeObserver = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(schedule);

  function measure() {
    frame = 0;
    if (disposed) return;
    measuredAt = win!.performance.now();
    const width = win!.innerWidth;
    const height = win!.innerHeight;
    const platforms: Platform[] = [];
    const nextObserved = new Set<Element>([root]);
    const visibleCache = new Map<Element, boolean>();
    const styles = new Map<Element, CSSStyleDeclaration>();
    const clippedCache = new Map<Element, CompanionTextRect>();
    const viewport = { width, height };
    const viewportRect = { left: 0, right: width, top: 0, bottom: height };
    function styleFor(element: Element) {
      let style = styles.get(element);
      if (!style) { style = win!.getComputedStyle(element); styles.set(element, style); }
      return style;
    }
    function visible(element: Element | null): boolean {
      if (!element) return true;
      const cached = visibleCache.get(element);
      if (cached !== undefined) return cached;
      const style = styleFor(element);
      // aria-hidden/inert describe interaction, not whether ink is on screen.
      const own = !element.hasAttribute("hidden")
        && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse"
        && Number(style.opacity || 1) > .05;
      const result = own && visible(element.parentElement);
      visibleCache.set(element, result);
      return result;
    }
    function clipping(element: Element | null): CompanionTextRect {
      if (!element) return viewportRect;
      const cached = clippedCache.get(element);
      if (cached) return cached;
      const bounds = { ...clipping(element.parentElement) };
      const style = styleFor(element);
      const clipX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX);
      const clipY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
      if (clipX || clipY) {
        const rect = element.getBoundingClientRect();
        if (clipX) { bounds.left = Math.max(bounds.left, rect.left); bounds.right = Math.min(bounds.right, rect.right); }
        if (clipY) { bounds.top = Math.max(bounds.top, rect.top); bounds.bottom = Math.min(bounds.bottom, rect.bottom); }
      }
      clippedCache.set(element, bounds);
      return bounds;
    }
    const obstacles: CompanionTextRect[] = [];
    const controls: CompanionTextRect[] = [];
    const lines = new Map<HTMLElement, CompanionTextRect[]>();
    function measureText(scope: HTMLElement, supports: boolean) {
      const walker = root.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const range = root.ownerDocument.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,[data-companion-actor]")) continue;
        const clip = clipping(parent);
        range.selectNodeContents(node);
        // Do not read or retain nodeValue/textContent. The local brain receives
        // only anonymous geometry, including for server-masked teaser content.
        const target = supports ? parent.closest<HTMLElement>(TEXT_SURFACE_SELECTOR) : null;
        const candidate = target && root.contains(target) && !target.closest(".dimmed,[inert],[aria-hidden='true']") ? target : null;
        for (const rect of range.getClientRects()) {
          const clipped = { left: Math.max(rect.left, clip.left), right: Math.min(rect.right, clip.right), top: Math.max(rect.top, clip.top), bottom: Math.min(rect.bottom, clip.bottom) };
          if (clipped.right - clipped.left < .5 || clipped.bottom - clipped.top < .5) continue;
          const fragments = unoccludedCompanionRects(clipped, house?.contains(parent) ? undefined : houseBounds);
          for (const fragment of fragments) {
            obstacles.push(fragment);
            if (candidate) {
              const group = lines.get(candidate) ?? [];
              // Keep disjoint visible fragments separate: merging across the
              // house would invent a ledge through an opaque control surface.
              const line = group.find(item => Math.abs(item.top - fragment.top) < .75 && Math.abs(item.bottom - fragment.bottom) < 1.5 && fragment.left <= item.right + .5 && fragment.right >= item.left - .5);
              if (line) { line.left = Math.min(line.left, fragment.left); line.right = Math.max(line.right, fragment.right); }
              else group.push({ ...fragment });
              lines.set(candidate, group);
            }
          }
        }
      }
      range.detach();
    }
    const home = options.getHome?.() ?? options.home ?? null;
    const house = home?.closest<HTMLElement>(".vc-home") ?? null;
    const houseRect = house?.isConnected && visible(house) ? house.getBoundingClientRect() : undefined;
    const houseBounds = houseRect && houseRect.width > 0 && houseRect.height > 0 ? { left: houseRect.left, right: houseRect.right, top: houseRect.top, bottom: houseRect.bottom } : undefined;
    if (home !== observedHome) {
      homeObserver?.disconnect();
      observedHome = home;
      const house = home?.closest<HTMLElement>(".vc-home") ?? home?.parentElement;
      if (house) homeObserver?.observe(house, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden"] });
      for (let element: HTMLElement | null = house?.parentElement ?? home; element; element = element.parentElement) {
        homeObserver?.observe(element, { attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden"] });
      }
    }
    if (home) {
      nextObserved.add(home);
      const house = home.closest<HTMLElement>(".vc-home");
      if (house) nextObserved.add(house);
    }
    if (root.isConnected && visible(root)) {
      measureText(root, true);
      // The floating house can live outside the shared poster root. Measure
      // its own labels as obstacles without discovering unrelated app text.
      if (home?.parentElement && !root.contains(home)) measureText(home.closest<HTMLElement>(".vc-home") ?? home.parentElement, false);
      // Protect the complete hit target, including icon-only controls. The
      // cushion's own button is the deliberate support, so its label alone is
      // an obstacle. All other house controls remain protected on that ledge.
      const controlElements = new Set(root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"));
      for (const element of root.ownerDocument.querySelectorAll<HTMLElement>(".vc-home-launcher,.vc-home button")) controlElements.add(element);
      for (const element of controlElements) {
        if (!visible(element) || element.matches(`${CARD_SELECTOR},${DAY_SELECTOR}`) || element.closest(".vc-companion,.vc-cushion-button")) continue;
        const rect = element.getBoundingClientRect(), clip = clipping(element.parentElement);
        const bounds = { left: Math.max(rect.left, clip.left), right: Math.min(rect.right, clip.right), top: Math.max(rect.top, clip.top), bottom: Math.min(rect.bottom, clip.bottom) };
        if (bounds.right > bounds.left && bounds.bottom > bounds.top) controls.push(...unoccludedCompanionRects(bounds, house?.contains(element) ? undefined : houseBounds));
      }
      const homeObstacles = [...obstacles, ...controls];
      const ordinaryObstacles = houseBounds ? [...homeObstacles, houseBounds] : homeObstacles;
      const addSurface = (id: string, kind: Platform["kind"], source: CompanionSurface) => {
        const safe = safeCompanionSurfaces(source, ordinaryObstacles, size, viewport, footprint);
        for (let i = 0; i < safe.length && platforms.length < MAX_PLATFORMS; i++) platforms.push({ id: i ? `${id}-${i}` : id, ...safe[i], kind });
      };
      let floorY = height - 18;
      // The shared fixed month controls own the bottom of both PC and agenda.
      // A floor above them can be safe; no safe interval means no fake floor.
      for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
        if (!visible(bar) || styleFor(bar).position !== "fixed") continue;
        const rect = bar.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top >= height * .65 && rect.bottom <= height + 1) floorY = Math.min(floorY, rect.top - 8);
      }
      addSurface("viewport-floor", "floor", { x: 12, y: floorY, width: width - 24 });
      if (home?.isConnected && visible(home)) {
        const rect = home.getBoundingClientRect();
        const clip = clipping(home.parentElement);
        const x = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
        const safe = rect.top >= clip.top && rect.top < clip.bottom ? safeCompanionSurfaces({ x, y: rect.top, width: right - x }, homeObstacles, size, viewport, footprint) : [];
        const centre = rect.left + rect.width / 2;
        const preferred = safe.sort((a, b) => Math.abs(a.x + a.width / 2 - centre) - Math.abs(b.x + b.width / 2 - centre))[0];
        if (rect.height > 0 && preferred && platforms.length < MAX_PLATFORMS) platforms.push({ id: "companion-home", ...preferred, kind: "date" });
      }
      const cardPlatforms = new Map<HTMLElement, Platform[]>();
      for (const [element, rects] of lines) {
        if (platforms.length >= MAX_PLATFORMS) break;
        const date = element.matches(DATE_TEXT_SELECTOR);
        const owner = element.closest<HTMLElement>(date ? DAY_SELECTOR : CARD_SELECTOR);
        if (!owner) continue;
        const kind = date ? "date" : "card";
        const id = idFor(element, kind);
        for (let line = 0; line < rects.length && platforms.length < MAX_PLATFORMS; line++) {
          const rect = rects[line];
          const before = platforms.length;
          addSurface(line ? `${id}-line-${line}` : id, kind, { x: rect.left, y: rect.top - CLEARANCE, width: rect.right - rect.left });
          if (!date) {
            const group = cardPlatforms.get(owner) ?? [];
            group.push(...platforms.slice(before));
            cardPlatforms.set(owner, group);
          }
        }
      }
      for (const element of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
        nextObserved.add(element);
        const candidates = cardPlatforms.get(element);
        if (!candidates?.length) continue;
        const heart = element.querySelector<HTMLElement>(".event-heart");
        if (heart && visible(heart)) {
          const heartRect = heart.getBoundingClientRect();
          const x = heartRect.left + heartRect.width / 2;
          const y = heartRect.top + heartRect.height / 2;
          if (heartRect.width > 0 && heartRect.height > 0 && x >= 0 && x <= width && y >= 0 && y <= height) {
            const platform = candidates.reduce((best, candidate) => {
              const distance = (p: Platform) => Math.hypot(Math.max(p.x - x, 0, x - p.x - p.width), p.y - y);
              return distance(candidate) < distance(best) ? candidate : best;
            });
            platform.heart = { x, y, blocked: heart.getAttribute("aria-pressed") === "true" || heart.hasAttribute("data-companion-hearted") || heart.hasAttribute("data-companion-heart-blocked") };
          }
        }
      }
      for (const day of root.querySelectorAll<HTMLElement>(DAY_SELECTOR)) {
        nextObserved.add(day);
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
    if (records.some(record => record.type === "childList" || record.type === "attributes" || record.type === "characterData")) schedule();
  });
  mutationObserver.observe(root, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-pressed", "data-companion-hearted", "data-companion-heart-blocked", "data-premiere", "data-pm-depart"],
  });
  // Ancestor visibility can change when the same shared viewer enters/leaves
  // preview. Observe only its attributes, not the rest of the application.
  for (let parent = root.parentElement; parent; parent = parent.parentElement) {
    mutationObserver.observe(parent, { attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden"] });
  }
  win.addEventListener("resize", schedule, { passive: true });
  win.addEventListener("scroll", schedule, { passive: true, capture: true });
  win.addEventListener("vic:companion-home", schedule);
  root.addEventListener("transitionend", schedule);
  root.addEventListener("animationend", schedule);
  root.ownerDocument.fonts?.addEventListener("loadingdone", schedule);
  void root.ownerDocument.fonts?.ready.then(() => schedule());
  schedule();

  return () => {
    disposed = true;
    win.cancelAnimationFrame(frame);
    win.clearTimeout(timer);
    mutationObserver.disconnect();
    homeObserver?.disconnect();
    resizeObserver?.disconnect();
    win.removeEventListener("resize", schedule);
    win.removeEventListener("scroll", schedule, true);
    win.removeEventListener("vic:companion-home", schedule);
    root.removeEventListener("transitionend", schedule);
    root.removeEventListener("animationend", schedule);
    root.ownerDocument.fonts?.removeEventListener("loadingdone", schedule);
    observed.clear();
  };
}
