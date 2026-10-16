import type { Platform } from "./brain";
import { COMPANION_HOME_FLOOR_FOOD, COMPANION_HOME_FLOOR_INSET } from "./food";
import { companionSofaSeat } from "./sofa";
import { COMPANION_PANEL_SIDE_SELECTOR } from "./panel-play";

const STUDIO_CARD_SELECTOR = "[data-companion-event='ordinary'][data-eventid]";
const STUDIO_BAND_SELECTOR = "[data-companion-band='public'][data-supportid]";
const STUDIO_HEADER_SELECTOR = ".studio-weekdays";
const CARD_SELECTOR = `.public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],${STUDIO_CARD_SELECTOR}`;
const BAND_SELECTOR = `.support-bar[data-supportid],.agenda-event[data-supportid],.agenda-item[data-supportid],${STUDIO_BAND_SELECTOR}`;
const HEADER_SELECTOR = `.weekday-row,.public-calendar-header,.agenda-header,${STUDIO_HEADER_SELECTOR}`;
// A day is a large clickable container on both surfaces, not one giant control
// obstacle. Its nested edit/delete/private-card controls remain protected.
const DAY_SELECTOR = ".public-day,.agenda-day,.studio-day";
const DATE_TEXT_SELECTOR = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.studio-day .studio-day-head > strong";
const CARD_TEXT_SELECTOR = `.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li,${STUDIO_CARD_SELECTOR} .pill-main strong,${STUDIO_CARD_SELECTOR} .pill-subs li,${STUDIO_CARD_SELECTOR} .pill-sub-last .pill-sub-text,${STUDIO_CARD_SELECTOR} .agenda-title-text,${STUDIO_CARD_SELECTOR} .agenda-subs li`;
const TEXT_SURFACE_SELECTOR = `${DATE_TEXT_SELECTOR},${CARD_TEXT_SELECTOR}`;
const MAX_PLATFORMS = 200;
const MEASUREMENT_INTERVAL_MS = 120;
const CLEARANCE = 3;
const DEFAULT_SIZE = 76;
const FOOD_SIZE = 32;
// The fruit's 32px art has a 44px native hit target, reaching 38px above its foot.
// Reserve that hit target around controls without imposing the pet's 92px fit.
const FOOD_FOOTPRINT = { width: 44, height: 38 };

export type CompanionTextRect = { left: number; right: number; top: number; bottom: number };
export type CompanionSurface = { x: number; y: number; width: number };
export type CompanionFootprint = { width: number; height: number };
export type CompanionGeometryIdentity = { ids: WeakMap<Element, string>; serial: number };
export type CompanionGeometryOptions = { size?: number; home?: HTMLElement | null; getHome?: () => HTMLElement | null; identity?: CompanionGeometryIdentity; onInvalidate?: () => void };
export type CompanionFollowSample = { platform: Platform; anchorX: number; anchorY: number };
export type CompanionGeometryAnchor = { element?: Element; left: number; top: number };
export type CompanionGeometrySubscription = (() => void) & { follow: (ids: readonly string[]) => CompanionFollowSample[]; anchor: (id: string) => CompanionGeometryAnchor | undefined; landings: (size?: number) => readonly Platform[]; revalidate: () => void };

/** A renderer can retain anonymous anchor identity while its observers sleep. */
export function createCompanionGeometryIdentity(): CompanionGeometryIdentity {
  return { ids: new WeakMap<Element, string>(), serial: 0 };
}

type AnchorSnapshot = { platform: Platform; anchor?: Element; rect?: { left: number; top: number } };
const copyPlatform = (platform: Platform): Platform => ({ id: platform.id, x: platform.x, y: platform.y, width: platform.width, kind: platform.kind, ...(platform.manualOnly ? { manualOnly: true } : {}), ...(platform.heart ? { heart: { ...platform.heart } } : {}), ...(platform.panelSide ? { panelSide: platform.panelSide } : {}) });

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
    || size <= 0 || footprint.width <= 0 || footprint.height <= 0 || surface.width <= 0 || surface.y < Math.max(size, footprint.height) + CLEARANCE || surface.y > viewport.height - 12) return [];
  // A small drawing may have a larger native input target (food32:44x38).
  // Preserve full-cell bounds for the pet and the full input target for food.
  const half = Math.max(size, footprint.width) / 2;
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
export function observeCompanionPlatforms(root: HTMLElement, onChange: (platforms: Platform[], validationOnly?: boolean) => void, options: CompanionGeometryOptions = {}): CompanionGeometrySubscription {
  const win = root.ownerDocument.defaultView;
  if (!win) return Object.assign(() => {}, { follow: (): CompanionFollowSample[] => [], anchor: () => undefined, landings: (): Platform[] => [], revalidate: () => {} });
  const size = Number.isFinite(options.size) && options.size! > 0 ? options.size! : DEFAULT_SIZE;
  // Registered/curated atlas union occupies <.70 width and <.713 height of the
  // square cell. .76 plus 3px clearance includes pose bob/scale and pixel edges;
  // transparent hairline padding must not eliminate every narrow agenda ledge.
  const footprint = { width: size * .76, height: size * .76 };
  const identity = options.identity ?? createCompanionGeometryIdentity();
  const idFor = (element: Element, kind: "card" | "date") => {
    let id = identity.ids.get(element);
    if (!id) { id = `${kind}-${++identity.serial}`; identity.ids.set(element, id); }
    return id;
  };
  let anchors = new Map<string, AnchorSnapshot>();
  let followedIds: string[] = [];
  const retainedIds = new Set<string>();
  let disposed = false;
  let frame = 0;
  let timer = 0;
  let pendingValidationOnly = false;
  let measuredAt = -Infinity;
  let previous = "";
  let landingSnapshot: Platform[] = [];
  let foodLandingSnapshot: Platform[] = [];
  const observed = new Set<Element>();
  let observedHome: HTMLElement | null = null;
  const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
  const homeObserver = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(schedule);

  function measure() {
    frame = 0;
    if (disposed) return;
    const validationOnly = pendingValidationOnly; pendingValidationOnly = false;
    if (!root.isConnected) {
      anchors.clear(); followedIds = []; retainedIds.clear(); landingSnapshot = []; foodLandingSnapshot = [];
      if (previous !== "[]") { previous = "[]"; onChange([], validationOnly); }
      return;
    }
    measuredAt = win!.performance.now();
    const width = win!.innerWidth;
    const height = win!.innerHeight;
    const platforms: Platform[] = [];
    const landings: Platform[] = [];
    const foodLandings: Platform[] = [];
    const nextAnchors = new Map<string, AnchorSnapshot>();
    const remember = (platform: Platform, anchor?: Element, rect?: DOMRect) => {
      platforms.push(platform);
      if ((platform.kind === "floor" || platform.kind === "control" || platform.id === "companion-home") && landings.length < MAX_PLATFORMS) landings.push(copyPlatform(platform));
      nextAnchors.set(platform.id, { platform, anchor, rect: rect ? { left: rect.left, top: rect.top } : undefined });
    };
    const rememberFood = (id: string, spans: readonly CompanionSurface[], kind: Platform["kind"], anchor?: Element, rect?: DOMRect) => {
      for (let i = 0; i < spans.length && foodLandings.length < MAX_PLATFORMS; i++) {
        const platform: Platform = { id: i ? `${id}-${i}` : id, ...spans[i], kind, manualOnly: true };
        foodLandings.push(platform); nextAnchors.set(platform.id, { platform, anchor, rect: rect ? { left: rect.left, top: rect.top } : undefined });
      }
    };
    const nextObserved = new Set<Element>([root]);
    const visibleCache = new Map<Element, boolean>();
    const styles = new Map<Element, CSSStyleDeclaration>();
    const clippedCache = new Map<Element, CompanionTextRect>();
    const viewport = { width, height };
    const viewportRect = { left: 0, right: width, top: 0, bottom: height };
    const studio = root.getAttribute("data-companion-surface") === "studio";
    const supportVisible = (element: HTMLElement) => {
      if (element.closest(".dimmed,[hidden]")) return false;
      const lock = element.closest<HTMLElement>("[inert],[aria-hidden='true']");
      // Prelude disables card input before retiring its actual drawing. A
      // public physical ledge remains usable until its transform/opacity exits;
      // other modal/ancestor locks are never treated as this choreography.
      return !lock || Boolean(root.hasAttribute("data-premiere") && lock.matches(CARD_SELECTOR) && !lock.parentElement?.closest("[inert],[aria-hidden='true']"));
    };
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
        const candidate = target && root.contains(target) && supportVisible(target) && (!studio || target.matches(DATE_TEXT_SELECTOR) || Boolean(target.closest(STUDIO_CARD_SELECTOR))) ? target : null;
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
      const measuredControls = new Map<Element, DOMRect>();
      for (const element of root.ownerDocument.querySelectorAll<HTMLElement>(".vc-home-launcher,.vc-home button")) controlElements.add(element);
      for (const element of controlElements) {
        if (!visible(element) || element.matches(`${CARD_SELECTOR},${DAY_SELECTOR}`) || element.closest(".vc-companion,.vc-cushion-button")) continue;
        const rect = element.getBoundingClientRect(), clip = clipping(element.parentElement);
        measuredControls.set(element, rect);
        const bounds = { left: Math.max(rect.left, clip.left), right: Math.min(rect.right, clip.right), top: Math.max(rect.top, clip.top), bottom: Math.min(rect.bottom, clip.bottom) };
        if (bounds.right > bounds.left && bounds.bottom > bounds.top) controls.push(...unoccludedCompanionRects(bounds, house?.contains(element) ? undefined : houseBounds));
      }
      const homeObstacles = [...obstacles, ...controls];
      const ordinaryObstacles = houseBounds ? [...homeObstacles, houseBounds] : homeObstacles;
      const addSurface = (id: string, kind: Platform["kind"], source: CompanionSurface, anchor?: Element, rect?: DOMRect) => {
        const safe = safeCompanionSurfaces(source, ordinaryObstacles, size, viewport, footprint);
        for (let i = 0; i < safe.length && platforms.length < MAX_PLATFORMS; i++) remember({ id: i ? `${id}-${i}` : id, ...safe[i], kind }, anchor, rect);
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
      // The feet rest just above the real arrow's top; the body never covers
      // its human pointer target. Labels/adjacent controls still constrain the
      // entire footprint. No coordinates are guessed from viewport width.
      for (const element of root.querySelectorAll<HTMLElement>(COMPANION_PANEL_SIDE_SELECTOR)) {
        nextObserved.add(element);
        if (!visible(element) || !supportVisible(element) || element.hasAttribute("disabled")) continue;
        const side = element.getAttribute("data-companion-panel-side");
        if (side !== "left" && side !== "right") continue;
        const rect = measuredControls.get(element) ?? element.getBoundingClientRect(), clip = clipping(element.parentElement);
        const x = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
        if (rect.width <= 0 || rect.height <= 0 || rect.top < clip.top || rect.top > clip.bottom || right <= x) continue;
        const safe = safeCompanionSurfaces({ x, y: rect.top - CLEARANCE, width: right - x }, ordinaryObstacles, size, viewport, footprint);
        for (let i = 0; i < safe.length && platforms.length < MAX_PLATFORMS; i++) {
          remember({ id: `panel-side-${side}${i ? `-${i}` : ""}`, ...safe[i], kind: "control", ...(element.getAttribute("aria-pressed") === "false" ? { panelSide: side } : {}) }, element, rect);
        }
      }
      if (home?.isConnected && visible(home)) {
        const rect = home.getBoundingClientRect();
        const clip = clipping(home.parentElement);
        const x = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
        const opening = companionSofaSeat({ left: x, right, top: rect.top }, size);
        const safe = opening && rect.top >= clip.top && rect.top < clip.bottom ? safeCompanionSurfaces(opening, homeObstacles, size, viewport, footprint) : [];
        const centre = rect.left + rect.width / 2;
        const preferred = safe.sort((a, b) => Math.abs(a.x + a.width / 2 - centre) - Math.abs(b.x + b.width / 2 - centre))[0];
        if (rect.height > 0 && preferred && platforms.length < MAX_PLATFORMS) remember({ id: "companion-home", ...preferred, kind: "date" }, home, rect);
      }
      const homeFloor = house?.querySelector<HTMLElement>(".vc-home-floor");
      if (homeFloor?.isConnected && visible(homeFloor)) {
        nextObserved.add(homeFloor);
        const rect = homeFloor.getBoundingClientRect(), clip = clipping(homeFloor.parentElement);
        const x = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right), y = rect.bottom - COMPANION_HOME_FLOOR_INSET;
        // The room's floor is a real, separate plane. Only a deliberate food
        // target or the occupied manual support exposes it to the brain;
        // ordinary roaming must not start walking through house controls.
        // The bed is the existing deliberate room prop, while its own labels
        // and every other complete control remain obstacles at the92px tier.
        const spans = rect.height > 0 && y >= clip.top && y < clip.bottom
          ? safeCompanionSurfaces({ x, y, width: right - x }, homeObstacles, size, viewport, footprint) : [];
        for (let i = 0; i < spans.length && landings.length < MAX_PLATFORMS; i++) {
          const platform: Platform = { id: i ? `companion-home-floor-${i}` : "companion-home-floor", ...spans[i], kind: "floor", manualOnly: true };
          landings.push(platform); nextAnchors.set(platform.id, { platform, anchor: homeFloor, rect: { left: rect.left, top: rect.top } });
        }
        // A drop from above uses the same real floor as a direct room release.
        // The food's smaller footprint remains independent of the pet tier.
        if (rect.height > 0 && y >= clip.top && y < clip.bottom) rememberFood(COMPANION_HOME_FLOOR_FOOD,
          safeCompanionSurfaces({ x: x + FOOD_FOOTPRINT.width / 2, y, width: right - x - FOOD_FOOTPRINT.width }, homeObstacles, FOOD_SIZE, viewport, FOOD_FOOTPRINT), "floor", homeFloor, rect);
      }
      // A dense calendar cannot spend the whole bounded food snapshot before
      // its real house floor is published. First-contact selection still sorts
      // by physical height rather than this list order.
      rememberFood("viewport-floor-food", safeCompanionSurfaces({ x: 12, y: floorY, width: width - 24 }, ordinaryObstacles, FOOD_SIZE, viewport, FOOD_FOOTPRINT), "floor");
      // These are existing visible physical edges, not extra rows or invented
      // heights. Header bottoms leave the92px cell inside the viewport; every
      // weekday glyph and complete control above that edge stays an obstacle.
      for (const surface of [{ selector: BAND_SELECTOR, kind: "card" as const, edge: "top" }, { selector: HEADER_SELECTOR, kind: "date" as const, edge: "bottom" }]) {
        for (const element of root.querySelectorAll<HTMLElement>(surface.selector)) {
          nextObserved.add(element);
          if (platforms.length >= MAX_PLATFORMS || !visible(element) || !supportVisible(element) || studio && !element.matches(`${STUDIO_HEADER_SELECTOR},${STUDIO_BAND_SELECTOR}`)) continue;
          const rect = measuredControls.get(element) ?? element.getBoundingClientRect(), clip = clipping(element.parentElement);
          const x = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
          const edge = surface.edge === "top" ? rect.top : rect.bottom;
          if (rect.width <= 0 || rect.height <= 0 || edge < clip.top || edge > clip.bottom || right <= x) continue;
          const id = `${idFor(element, surface.kind)}-${surface.edge === "top" ? "band" : "header"}`;
          addSurface(id, surface.kind, { x, y: edge - CLEARANCE, width: right - x }, element, rect);
        }
      }
      const cardPlatforms = new Map<HTMLElement, Platform[]>();
      for (const [element, rects] of lines) {
        if (platforms.length >= MAX_PLATFORMS) break;
        const date = element.matches(DATE_TEXT_SELECTOR);
        const owner = element.closest<HTMLElement>(date ? DAY_SELECTOR : CARD_SELECTOR);
        if (!owner) continue;
        const kind = date ? "date" : "card";
        const id = idFor(element, kind);
        const anchorRect = element.getBoundingClientRect();
        for (let line = 0; line < rects.length && platforms.length < MAX_PLATFORMS; line++) {
          const rect = rects[line];
          const before = platforms.length;
          addSurface(line ? `${id}-line-${line}` : id, kind, { x: rect.left, y: rect.top - CLEARANCE, width: rect.right - rect.left }, element, anchorRect);
          if (!date) {
            const group = cardPlatforms.get(owner) ?? [];
            group.push(...platforms.slice(before));
            cardPlatforms.set(owner, group);
          }
        }
      }
      for (const element of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
        // Studio opts in only sanitized ordinary public cards. Its broader
        // agenda classes also contain support/private editor rows.
        if (studio && !element.matches(STUDIO_CARD_SELECTOR)) continue;
        nextObserved.add(element);
        if ((landings.length < MAX_PLATFORMS || foodLandings.length < MAX_PLATFORMS) && visible(element)) {
          const rect = element.getBoundingClientRect(), clip = clipping(element.parentElement);
          const left = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
          if (rect.width > 0 && rect.height > 0 && rect.top >= clip.top && rect.top < clip.bottom && right > left) {
            // A user-directed drop hits the rendered card edge, including on
            // dense agenda rows. Keep full control/home/viewport protection;
            // unlike autonomous roaming, do not silently skip this first card
            // merely because the body may overlap earlier text above it.
            const dropObstacles = houseBounds ? [...controls, houseBounds] : controls;
            const spans = safeCompanionSurfaces({ x: left, y: rect.top - CLEARANCE, width: right - left }, dropObstacles, size, viewport, footprint);
            const foodSpans = safeCompanionSurfaces({ x: left, y: rect.top - CLEARANCE, width: right - left }, dropObstacles, FOOD_SIZE, viewport, FOOD_FOOTPRINT);
            const baseId = spans.length || foodSpans.length ? idFor(element, "card") : "";
            const id = `${baseId}-top`;
            for (let i = 0; i < spans.length && landings.length < MAX_PLATFORMS; i++) {
              const platform: Platform = { id: i ? `${id}-${i}` : id, ...spans[i], kind: "card", manualOnly: true };
              landings.push(platform); nextAnchors.set(platform.id, { platform, anchor: element, rect: { left: rect.left, top: rect.top } });
            }
            rememberFood(`${baseId}-food-top`, foodSpans, "card", element, rect);
          }
        }
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
      for (const day of studio ? [] : root.querySelectorAll<HTMLElement>(DAY_SELECTOR)) {
        nextObserved.add(day);
      }
    }
    for (const element of observed) {
      if (!nextObserved.has(element)) { resizeObserver?.unobserve(element); observed.delete(element); }
    }
    for (const element of nextObserved) {
      if (!observed.has(element)) { resizeObserver?.observe(element); observed.add(element); }
    }
    // A source can scroll outside the safe landing region during a valid
    // flight. Retain only the last explicitly followed pair for translation;
    // these snapshots are never reintroduced into the safe platform list.
    retainedIds.clear();
    for (const id of followedIds) {
      const snapshot = anchors.get(id);
      if (!nextAnchors.has(id) && snapshot?.anchor?.isConnected) {
        nextAnchors.set(id, snapshot); retainedIds.add(id);
      }
    }
    // Publish the new absolute anchor baselines before the callback: a renderer
    // may follow/rebase an old world from inside this same onChange delivery.
    // Keep private copies so imperative carry cannot mutate the next baseline.
    anchors = new Map([...nextAnchors].map(([id, snapshot]) => [id, { ...snapshot, platform: copyPlatform(snapshot.platform) }]));
    landingSnapshot = landings.map(copyPlatform);
    foodLandingSnapshot = foodLandings.map(copyPlatform);
    // Suppress equal layout deliveries, including a countdown's text mutation.
    const signature = JSON.stringify([platforms, landings, foodLandings]);
    if (signature !== previous) { previous = signature; onChange(platforms, validationOnly); }
  }

  function schedule() {
    if (disposed) return;
    // The renderer may track its retained pair during an existing CSS motion
    // before this full scan is due. Notification performs no layout reads and
    // starts no new loop; static calendars otherwise reuse cached baselines.
    options.onInvalidate?.();
    enqueue(false);
  }
  function enqueue(validationOnly: boolean) {
    if (disposed) return;
    // A real DOM/event cause always wins over an already queued validation.
    // Validation alone never opens or extends the renderer's finite lease.
    if (frame || timer) { pendingValidationOnly = pendingValidationOnly && validationOnly; return; }
    pendingValidationOnly = validationOnly;
    const wait = Math.max(0, MEASUREMENT_INTERVAL_MS - (win!.performance.now() - measuredAt));
    if (wait > 0) {
      timer = win!.setTimeout(() => { timer = 0; if (!disposed) frame = win!.requestAnimationFrame(measure); }, wait);
    } else frame = win!.requestAnimationFrame(measure);
  }
  // A disclosure can close and reopen inside the same measurement interval.
  // Its final geometry may equal the previous scan, but residents still need
  // an explicit visibility validation after the temporary hidden state.
  const panelChanged = () => { previous = ""; schedule(); };

  const mutationObserver = new MutationObserver(records => {
    if (records.some(record => record.type === "childList" || record.type === "attributes" || record.type === "characterData")) schedule();
  });
  mutationObserver.observe(root, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden", "aria-pressed", "data-companion-event", "data-companion-band", "data-companion-hearted", "data-companion-heart-blocked", "data-premiere", "data-pm-depart", "data-companion-workspace-busy"],
  });
  // Ancestor visibility can change when the same shared viewer enters/leaves
  // preview. Observe only its attributes, not the rest of the application.
  for (let parent = root.parentElement; parent; parent = parent.parentElement) {
    mutationObserver.observe(parent, { attributes: true, attributeFilter: ["class", "style", "hidden", "inert", "aria-hidden"] });
  }
  win.addEventListener("resize", schedule, { passive: true });
  win.addEventListener("scroll", schedule, { passive: true, capture: true });
  win.addEventListener("scrollend", schedule, { passive: true, capture: true });
  win.visualViewport?.addEventListener("resize", schedule, { passive: true });
  win.visualViewport?.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("vic:companion-home", schedule);
  win.addEventListener("vic:panel-section", panelChanged);
  root.addEventListener("transitionend", schedule);
  root.addEventListener("animationend", schedule);
  root.ownerDocument.fonts?.addEventListener("loadingdone", schedule);
  void root.ownerDocument.fonts?.ready?.then(() => schedule());
  schedule();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    win.cancelAnimationFrame(frame);
    win.clearTimeout(timer);
    mutationObserver.disconnect();
    homeObserver?.disconnect();
    resizeObserver?.disconnect();
    win.removeEventListener("resize", schedule);
    win.removeEventListener("scroll", schedule, true);
    win.removeEventListener("scrollend", schedule, true);
    win.visualViewport?.removeEventListener("resize", schedule);
    win.visualViewport?.removeEventListener("scroll", schedule);
    win.removeEventListener("vic:companion-home", schedule);
    win.removeEventListener("vic:panel-section", panelChanged);
    root.removeEventListener("transitionend", schedule);
    root.removeEventListener("animationend", schedule);
    root.ownerDocument.fonts?.removeEventListener("loadingdone", schedule);
    observed.clear();
  };
  return Object.assign(dispose, {
    // Reuse the existing120ms queue. The finite renderer owns its lifetime;
    // this method performs no immediate reads, invalidation or autonomous loop.
    revalidate: () => enqueue(true),
    // Fresh baseline copies, paired with anchor(). Only the cached food32 tier
    // differs from the configured pet size; no caller triggers a new scan.
    // Callers own deliberate release rebasing; this performs no layout work.
    landings: (requestedSize?: number) => (requestedSize === FOOD_SIZE ? foodLandingSnapshot : landingSnapshot).map(copyPlatform),
    // Food captures its own small set of anchor offsets at placement. Expose
    // the already measured baseline, without enlarging the pet's follow pair
    // or doing an additional selector/Range/rect read.
    anchor(id: string): CompanionGeometryAnchor | undefined {
      const snapshot = anchors.get(id);
      return snapshot ? { element: snapshot.anchor, left: snapshot.rect?.left ?? 0, top: snapshot.rect?.top ?? 0 } : undefined;
    },
    follow(requested: readonly string[]): CompanionFollowSample[] {
      if (!root.isConnected) { anchors.clear(); followedIds = []; retainedIds.clear(); landingSnapshot = []; foodLandingSnapshot = []; return []; }
      followedIds = [...new Set(requested)].slice(0, 2);
      for (const id of retainedIds) {
        if (!followedIds.includes(id)) { anchors.delete(id); retainedIds.delete(id); }
      }
      const result: CompanionFollowSample[] = [];
      const measured = new Map<Element, DOMRect>();
      // Only the occupied support and the current destination are followed.
      // No Range, selector walk, style read or autonomous rAF lives here.
      // A parked renderer may explicitly follow the final snapshot after
      // unsubscribe; the caller owns that bounded lifetime until effect GC.
      for (const id of followedIds) {
        const snapshot = anchors.get(id);
        if (!snapshot) continue;
        const platform = copyPlatform(snapshot.platform);
        let anchorX = 0, anchorY = 0;
        if (snapshot.anchor) {
          if (!snapshot.anchor.isConnected || typeof snapshot.anchor.getBoundingClientRect !== "function") { anchors.delete(id); retainedIds.delete(id); continue; }
          let rect = measured.get(snapshot.anchor);
          if (!rect) { rect = snapshot.anchor.getBoundingClientRect(); measured.set(snapshot.anchor, rect); }
          if (rect.width <= 0 || rect.height <= 0 || !snapshot.rect) continue;
          const dx = rect.left - snapshot.rect.left, dy = rect.top - snapshot.rect.top;
          if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
          anchorX = rect.left; anchorY = rect.top;
          platform.x += dx; platform.y += dy;
          if (platform.heart) { platform.heart.x += dx; platform.heart.y += dy; }
        }
        result.push({ platform, anchorX, anchorY });
      }
      return result;
    },
  });
}
