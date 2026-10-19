"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { logActivity } from "@/lib/activity/client";
import type { CompanionFood as Food, Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_HOME_FLOOR_FOOD, COMPANION_HOME_FLOOR_INSET, COMPANION_TRASH_DISCARD_MS, MAX_COMPANION_FOOD, attachCompanionFood, companionFoodJostle, companionTrashProgress, followCompanionFood, followCompanionViewportFloorFood, isCompanionHomeFloorFoodSupport, isCompanionViewportFloorFoodSupport, placeCompanionFood, presentCompanionFood, rebaseCompanionFoodBodySupport, rebaseCompanionFoodSupport, receiveCompanionHomeFloorFood, safeCompanionAttachedFood, type CompanionFoodAttachment, type CompanionFoodDropSupport, type CompanionFoodPresentation } from "@/lib/ui/viewer-companion/food";
import { companionCalendarAnchorIdentity, isCompanionPanelFloor, type CompanionGeometryAnchor } from "@/lib/ui/viewer-companion/geometry";
import { companionLayoutMotionMs } from "@/lib/ui/viewer-companion/element-anchor";
import { createCompanionFoodGravity, createCompanionFoodToss } from "@/lib/ui/viewer-companion/food-gravity";
import { planCompanionDispenserEjection, planCompanionFoodThrow, planCompanionFoodToss, planCompanionHomeFoodEjection } from "@/lib/ui/viewer-companion/food-toss";
import { nextCompanionPaint } from "@/lib/ui/viewer-companion/motion";
import { createCompanionInputFrame } from "@/lib/ui/viewer-companion/input-frame";
import { gfxMode as readGfxMode, type GfxMode } from "@/lib/ui/gfx";
import { FLIP_MS } from "@/lib/ui/flip-motion";
import { COMPANION_CARD_PLAY_EVENT } from "@/lib/ui/viewer-companion/card-play";
import { COMPANION_FOOD_NAMES as names, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { CompanionFruit } from "./companion-fruit";

type Point = { x: number; y: number };
export type CompanionFoodControl = {
  spawn: (kind: Food["kind"], point: Point, source?: HTMLElement, autonomous?: boolean, recipient?: Point, occupied?: readonly Point[], petSupports?: readonly Platform[]) => string | undefined;
  occupied: () => readonly Point[];
  foods: () => readonly Food[];
  contains: (id: string) => boolean;
  consume: (id: string) => boolean;
  stash: (id: string) => boolean;
  nibble: (id?: string, progress?: number, mouth?: Point, facing?: -1 | 1) => void;
  sync: (platforms: readonly Platform[], getAnchor?: (id: string) => CompanionGeometryAnchor | undefined, landings?: readonly Platform[]) => void;
  pause: (paused: boolean) => void;
  jostle: (point: Point, radius: number, strength?: number) => void;
  beginCarry: (id: string) => boolean;
  carry: (id: string, point: Point, onPaint?: (point: Point) => void) => boolean;
  releaseCarry: (id: string, point?: Point) => boolean;
  discardCarry: (id: string, bin: HTMLElement) => boolean;
  carried: () => string | undefined;
  scatter: (point: Point, radius: number, strength?: number) => number;
  clear: () => void;
};
type Props = { enabled: boolean; blocked: boolean; monthKey: string; returnFocus: () => void; onLanded?: () => void; onDiscard?: (id: string) => void };
type Drag = { id: string; pointer: number; node: HTMLButtonElement; start: Point; point: Point; offset: Point; moved: boolean; wasFalling: boolean; startHome?: HomeAnchor; time: number; velocity: Point };
type Hover = { id: string; bin: HTMLElement; point: Point; since: number; pinned: boolean };
type Discard = { id: string; bin: HTMLElement; node: HTMLElement; animation?: Animation; timer: ReturnType<typeof setTimeout> };
type Jostle = { node: HTMLElement; animation: Animation };
type HomeAnchor = "tray" | "floor";
type FoodAttachment = { element?: Element; position: CompanionFoodAttachment; home?: HomeAnchor; panel?: boolean; identity?: string; viewportFloor?: { x: number }; pending?: true };
type AttachmentRead = { food: Food; bound?: FoodAttachment; rect?: DOMRect; controls?: readonly DOMRect[]; supports?: readonly CompanionFoodDropSupport[]; unavailable?: boolean };
const homeSelector = (kind: HomeAnchor) => kind === "floor" ? ".vc-home .vc-home-floor" : ".vc-home .vc-dispenser-slot";
const homeFoodId = (kind?: HomeAnchor) => kind === "floor" ? COMPANION_HOME_FLOOR_FOOD : undefined;
const homeControlRects = (element: Element, measured = new Map<Element, DOMRect>()) => [...element.closest(".vc-home")!.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.matches(".vc-cushion-button")).map(node => {
  let rect = measured.get(node);
  if (!rect) { rect = node.getBoundingClientRect(); measured.set(node, rect); }
  return rect;
});
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const reduced = () => document.documentElement.hasAttribute("data-reduce-motion");
const transform = (point: Point) => `translate3d(${point.x.toFixed(3)}px,${point.y.toFixed(3)}px,0)`;

/** Bounded local snacks, one logical position per snack. Dragging and mouth
 * presentation only write transforms; React commits placement/removal. Native
 * capture owns only real drag/trash gestures. Pointer taps never arm a global
 * placement mode; keyboard grab/arrow/put-down remains an explicit alternative. */
export const CompanionFood = forwardRef<CompanionFoodControl, Props>(function CompanionFood({ enabled, blocked, monthKey, returnFocus, onLanded, onDiscard }, ref) {
  const landed = useRef(onLanded); landed.current = onLanded;
  // This local scene notification marks an actual human removal only. Food
  // IDs never enter activity metadata, discovery or the autonomous trash path.
  const discarded = useRef(onDiscard); discarded.current = onDiscard;
  const [foods, setFoods] = useState<Food[]>([]), [selected, setSelected] = useState<string | null>(null), [paused, setPaused] = useState(blocked);
  const [message, setMessage] = useState("");
  const current = useRef<Food[]>([]), selection = useRef<string | null>(null), platforms = useRef<readonly CompanionFoodDropSupport[]>([]), layer = useRef<HTMLDivElement>(null);
  const keyboardMoved = useRef(false);
  const nodes = useRef(new Map<string, HTMLButtonElement>()), presentations = useRef(new Map<string, CompanionFoodPresentation>());
  const attachments = useRef(new Map<string, FoodAttachment>()), visibility = useRef(new Map<string, boolean>());
  const anchorFor = useRef<((id: string) => CompanionGeometryAnchor | undefined) | undefined>(undefined);
  const drops = useRef(new Map<string, ReturnType<typeof createCompanionFoodGravity>>());
  const jostles = useRef(new Map<string, Jostle>());
  const dropFrame = useRef(0), lastDropPaint = useRef(0), suspending = useRef(false), animateDrops = useRef<() => void>(() => {});
  const painted = useRef(new WeakMap<HTMLElement, { transform: string; nibble?: string; eating?: boolean }>());
  const renderedTransforms = useRef(new Map<string, string>());
  const serial = useRef(0), dragging = useRef<Drag | null>(null), hover = useRef<Hover | null>(null), discard = useRef<Discard | null>(null);
  const carried = useRef<string | undefined>(undefined);
  const dragFrame = useRef<ReturnType<typeof createCompanionInputFrame> | null>(null);
  dragFrame.current ??= createCompanionInputFrame();
  const hoverFrame = useRef(0), followFrame = useRef(0), operating = useRef(false);
  const graphics = useRef<GfxMode>("full");
  const followUntil = useRef(0), followHome = useRef<() => void>(() => {});
  const followedFrame = useRef<{ time: number; foods: Food[] } | null>(null);
  const focusReturn = useRef(returnFocus); focusReturn.current = returnFocus;
  const guard = useRef<{ owns: boolean; pointer: number | null; timer?: ReturnType<typeof setTimeout> }>({ owns: false, pointer: null });
  operating.current = enabled && !blocked && !paused;
  useLayoutEffect(() => {
    if (!enabled) return;
    // Settings own this snapshot. Falling/following snacks never synchronously
    // reread localStorage on the display clock, including auto-mode JSON.
    const changed = () => { graphics.current = readGfxMode(); };
    const stored = (event: StorageEvent) => { if (event.key === null || event.key === "vic.gfx" || event.key === "vic.gfxPref") changed(); };
    changed();
    window.addEventListener("vic:gfx-pref", changed); window.addEventListener("vic:gfx-auto", changed); window.addEventListener("storage", stored);
    return () => { window.removeEventListener("vic:gfx-pref", changed); window.removeEventListener("vic:gfx-auto", changed); window.removeEventListener("storage", stored); };
  }, [enabled]);
  const cancelJostle = useCallback((id?: string) => {
    for (const [key, active] of jostles.current) if (!id || key === id) {
      active.animation.onfinish = null; active.animation.oncancel = null;
      active.animation.cancel(); jostles.current.delete(key); active.node.removeAttribute("data-jostling");
    }
  }, []);
  const update = useCallback((next: Food[]) => {
    const ids = new Set(next.map(food => food.id));
    if (carried.current && !ids.has(carried.current)) carried.current = undefined;
    for (const id of jostles.current.keys()) if (!ids.has(id)) cancelJostle(id);
    for (const id of attachments.current.keys()) if (!ids.has(id)) attachments.current.delete(id);
    // Carry/stash deliberately detach a source before removal. Each retained
    // map must release its own retired IDs, including those detached snacks.
    for (const id of visibility.current.keys()) if (!ids.has(id)) visibility.current.delete(id);
    for (const id of presentations.current.keys()) if (!ids.has(id)) presentations.current.delete(id);
    for (const id of drops.current.keys()) if (!ids.has(id)) { drops.current.delete(id); presentations.current.delete(id); }
    if (!drops.current.size) { cancelAnimationFrame(dropFrame.current); dropFrame.current = 0; }
    current.current = next; setFoods(next);
  }, [cancelJostle]);
  const choose = useCallback((id: string | null) => { if (selection.current !== id) keyboardMoved.current = false; selection.current = id; setSelected(id); }, []);
  const paint = useCallback((food: Food, presentation?: CompanionFoodPresentation) => {
    const node = nodes.current.get(food.id); if (!node || discard.current?.id === food.id) return;
    const hidden = visibility.current.get(food.id) === false;
    // Like the resident's data-platform, expose only the anonymous current
    // physical support for native contact diagnostics, never a date/event ID.
    const platform = food.platformId ?? "";
    if (node.dataset.platform !== platform) node.dataset.platform = platform;
    if (hidden) cancelJostle(food.id);
    if (node.hidden !== hidden) node.hidden = hidden;
    if (node.hasAttribute("data-falling") !== drops.current.has(food.id)) node.toggleAttribute("data-falling", drops.current.has(food.id));
    if (node.hasAttribute("data-carried") !== (carried.current === food.id)) node.toggleAttribute("data-carried", carried.current === food.id);
    const pose = presentation ?? { x: food.x, y: food.y, scale: 1, rotation: 0 };
    const next = transform(pose), cached = painted.current.get(node);
    if (cached?.transform !== next) node.style.transform = next;
    const art = node.firstElementChild as HTMLElement | null;
    const local = `rotate(${pose.rotation.toFixed(3)}deg) scale(${(pose.scaleX ?? pose.scale).toFixed(4)},${(pose.scaleY ?? pose.scale).toFixed(4)})`;
    if (art && painted.current.get(art)?.transform !== local) { art.style.transform = local; painted.current.set(art, { transform: local }); }
    const nibble = String(pose.scale), eating = Boolean(presentation) && !drops.current.has(food.id);
    if (cached?.nibble !== nibble) node.style.setProperty("--vc-nibble", nibble);
    if (cached?.eating !== eating) node.toggleAttribute("data-eating", eating);
    painted.current.set(node, { transform: next, nibble, eating });
  }, [cancelJostle]);
  const resetNibble = useCallback((id?: string) => {
    for (const food of current.current) if ((!id || food.id === id) && !drops.current.has(food.id)) { presentations.current.delete(food.id); paint(food); }
  }, [paint]);
  const rebasePresentation = useCallback((id: string, keepSupport = false) => {
    const food = current.current.find(item => item.id === id); if (!food) return;
    cancelJostle(id);
    const pose = presentations.current.get(id) ?? food;
    drops.current.delete(id);
    if (!drops.current.size) { cancelAnimationFrame(dropFrame.current); dropFrame.current = 0; }
    if (!keepSupport && !attachments.current.get(id)?.home) attachments.current.delete(id);
    visibility.current.set(id, true);
    current.current = current.current.map(item => item.id === id ? { ...item, x: pose.x, y: pose.y, platformId: keepSupport ? item.platformId : homeFoodId(attachments.current.get(id)?.home) } : item);
    resetNibble(id); return pose;
  }, [cancelJostle, resetNibble]);
  const receivingHome = useCallback((point: Point, release: Point) => {
    if (release.x < 0 || release.x > innerWidth || release.y < 0 || release.y > innerHeight) return;
    // The compact room can clip its content. Native hit testing protects the
    // visible recipient, including when captured food/creature is in front.
    const hit = document.elementsFromPoint(release.x, release.y).find(node => !node.closest(".vc-food-layer,.vc-companion"));
    if (!hit) return;
    const element = document.querySelector<HTMLElement>(homeSelector("floor"));
    // The decorative floor receives direct drops; the sofa is never a food
    // support. A release above the floor continues through the shared gravity.
    if (!element?.isConnected || element.matches("[hidden],[inert],[data-panel-collapsed]") || element.parentElement?.closest("[hidden],[inert],[aria-hidden=true],[data-panel-collapsed]")) return;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || Number(style.opacity || 1) <= .05) return;
    const room = element.closest(".vc-home-room");
    // The sofa art overlaps the real floor at its feet. This grants only the
    // floor's own rectangle; touching its seat cannot bind a snack to the bed.
    const throughSofa = room?.contains(hit) && Boolean(hit.closest(".vc-cushion-button"));
    if (hit !== room && hit !== element && !throughSofa) return;
    const rect = element.getBoundingClientRect();
    const placed = receiveCompanionHomeFloorFood(point, release, rect, homeControlRects(element));
    if (placed) return { element, rect, point: placed, kind: "floor" as const };
  }, []);
  const followDragHome = useCallback((drag: Drag) => {
    const food = current.current.find(item => item.id === drag.id); if (!food) return;
    const home = drag.startHome ? receivingHome(food, drag.point) : undefined;
    // Logical pointer coordinates are captured on every input. Hit tests and
    // house/control geometry belong to one display batch, not each high-rate
    // mouse sample. Release also flushes once before settling.
    if (home) attachments.current.set(drag.id, { home: home.kind, element: home.element, position: attachCompanionFood(home.point, { x: scrollX, y: scrollY }, { x: home.rect.left, y: home.rect.top }) });
    else attachments.current.delete(drag.id);
    current.current = current.current.map(item => item.id === drag.id ? { ...item, platformId: homeFoodId(home?.kind) } : item);
  }, [receivingHome]);
  const moveDrag = useCallback((drag: Drag, pointer: Point) => {
    const food = current.current.find(item => item.id === drag.id); if (!food) return;
    const now = performance.now(), dt = Math.max(8, now - drag.time);
    const point = { x: clamp(pointer.x - drag.offset.x, 24, innerWidth - 24), y: clamp(pointer.y - drag.offset.y, 48, innerHeight - 24) };
    drag.velocity = { x: (point.x - food.x) / dt * 1000, y: (point.y - food.y) / dt * 1000 }; drag.time = now; drag.point = pointer;
    visibility.current.set(food.id, true);
    current.current = current.current.map(item => item.id === food.id ? { ...item, ...point } : item);
  }, []);
  const bindHome = useCallback((food: Food, target: NonNullable<ReturnType<typeof receivingHome>>, from?: Point) => {
    const placed: Food = { id: food.id, kind: food.kind, ...target.point, platformId: homeFoodId(target.kind) };
    attachments.current.set(food.id, { home: target.kind, element: target.element, position: attachCompanionFood(placed, { x: scrollX, y: scrollY }, { x: target.rect.left, y: target.rect.top }) });
    visibility.current.set(food.id, true); drops.current.delete(food.id); presentations.current.delete(food.id);
    if (!drops.current.size) { cancelAnimationFrame(dropFrame.current); dropFrame.current = 0; }
    // An explicit carried destination is a receiving surface, never the new
    // drawing origin. Preserve the already painted snack until its finite
    // gravity sampler takes over in this same synchronous release batch.
    paint(placed, from && { ...from, scale: 1, rotation: 0 }); followHome.current(); return placed;
  }, [paint]);
  const measureSupports = useCallback(() => {
    const measured = new Map<Element, DOMRect>(), sources = new Map<string, { element: Element; origin: Point & { width: number; height: number }; identity?: string }>();
    // Rebase the bounded existing platform list once at deliberate release.
    // Choosing from stale pre-scroll heights could otherwise select a ledge
    // that is now above the pointer. No selector walk or Range scan is needed.
    const available = platforms.current.slice(0, 200).flatMap(support => {
      const source = anchorFor.current?.(support.id);
      // An installed native resolver can reject a recycled date/closed panel
      // before its coalesced scan. That rejection must not become a stale
      // document-space landing. Only the real viewport plane lacks a source.
      if (!source?.element) return !anchorFor.current || isCompanionViewportFloorFoodSupport(support.id) ? [support] : [];
      if (!source.element.isConnected || source.element.closest("[data-panel-collapsed]")) return [];
      let rect = measured.get(source.element);
      if (!rect) { rect = source.element.getBoundingClientRect(); measured.set(source.element, rect); }
      if (rect.width <= 0 || rect.height <= 0) return [];
      sources.set(support.id, { element: source.element, origin: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, ...(source.identity ? { identity: source.identity } : {}) });
      const rebased = rebaseCompanionFoodSupport(support, source, rect);
      return rebased ? [rebased] : [];
    });
    return { available, sources };
  }, []);
  const bindLanding = useCallback((food: Food, placed: Food, point: Point, sources: ReturnType<typeof measureSupports>["sources"]) => {
    const source = placed.platformId ? sources.get(placed.platformId) : undefined, origin = source?.origin;
    const houseFloor = isCompanionHomeFloorFoodSupport(placed.platformId) && source?.element.matches(".vc-home-floor");
    if (houseFloor) placed.platformId = COMPANION_HOME_FLOOR_FOOD;
    // Bind to the current origin once. A subsequent scroll reads only this
    // retained source, never applies a second baseline delta or picks a day.
    const position = attachCompanionFood(placed, { x: scrollX, y: scrollY }, origin);
    attachments.current.set(food.id, { element: source?.element, position, ...(source?.identity ? { identity: source.identity } : {}), ...(isCompanionPanelFloor(placed.platformId) ? { panel: true } : {}), ...(houseFloor ? { home: "floor" as const } : {}), ...(isCompanionViewportFloorFoodSupport(placed.platformId) ? { viewportFloor: { x: point.x } } : {}), ...(!placed.platformId ? { pending: true as const } : {}) }); visibility.current.set(food.id, true);
    drops.current.delete(food.id); presentations.current.delete(food.id);
  }, []);
  const settleFood = useCallback((food: Food, point: Point, release?: Point, velocity?: Point, carriedFrom?: Point) => {
    // Merely selecting, pausing or dispensing another snack is not a drop.
    // Only genuine movement or an outside placement detaches a home snack.
    if (!release && attachments.current.get(food.id)?.home && point.x === food.x && point.y === food.y) { paint(food); return food; }
    const throwing = velocity && Math.hypot(velocity.x, velocity.y) >= 40;
    const home = release && !throwing ? receivingHome(point, release) : undefined;
    if (home && !carriedFrom) return bindHome(food, home);
    const { available, sources } = measureSupports();
    const toss = throwing ? planCompanionFoodThrow({ ...food, ...point }, velocity, available, { width: innerWidth, height: innerHeight }) : undefined;
    const placed = home ? bindHome(food, home, carriedFrom) : toss?.food ?? placeCompanionFood(food, point, available, { width: innerWidth, height: innerHeight });
    if (!home) bindLanding(food, placed, toss ? placed : point, sources);
    const landing = available.find(support => support.id === placed.platformId);
    const origin = carriedFrom ?? point;
    const recoverAboveFloor = placed.y < origin.y && isCompanionViewportFloorFoodSupport(placed.platformId);
    const gravity = toss ? createCompanionFoodToss(origin, placed, performance.now(), { ...toss, flutter: true })
      : createCompanionFoodGravity(origin, placed, performance.now(), { flutter: true, ...(landing?.dropSurface ? { contactX: point.x } : {}), ...(recoverAboveFloor ? { recoverAboveFloor: true } : {}) });
    if (gravity.duration > 0 && operating.current && !suspending.current && !document.hidden && !reduced() && graphics.current !== "off") {
      drops.current.set(food.id, gravity);
      const presentation = gravity.sample(performance.now()); presentations.current.set(food.id, presentation); paint(placed, presentation);
      animateDrops.current();
    } else paint(placed);
    return placed;
  }, [bindHome, bindLanding, measureSupports, paint, receivingHome]);
  const releaseCarry = useCallback((id: string, point?: Point) => {
    if (carried.current !== id || point && ![point.x, point.y].every(Number.isFinite)) return false;
    const food = current.current.find(item => item.id === id);
    carried.current = undefined;
    if (!food) return false;
    const destination = point ? { x: clamp(point.x, 24, innerWidth - 24), y: clamp(point.y, 0, innerHeight - 24) } : food;
    update(current.current.map(item => item.id === id ? settleFood(item, destination, destination, undefined, food) : item));
    return true;
  }, [settleFood, update]);
  const finishDrops = useCallback(() => {
    cancelAnimationFrame(dropFrame.current); dropFrame.current = 0;
    for (const id of drops.current.keys()) {
      drops.current.delete(id); presentations.current.delete(id);
      const food = current.current.find(item => item.id === id); if (food) paint(food);
    }
  }, [paint]);
  const followAttachments = useCallback((frameTime?: number) => {
    if (!operating.current || document.hidden) return;
    // A finite home follow and a fall may share a browser frame. The first
    // callback owns its read/compute/write batch; a changed food list or an
    // explicit geometry sync still gets a fresh measurement.
    if (frameTime !== undefined && followedFrame.current?.time === frameTime && followedFrame.current.foods === current.current) return;
    followedFrame.current = null;
    const scroll = { x: window.scrollX, y: window.scrollY }, viewport = { width: innerWidth, height: innerHeight };
    const measured = new Map<Element, DOMRect>(), controls = new Map<Element, readonly DOMRect[]>();
    // Finish every retained source/control read before changing food styles.
    // Otherwise one snack's transform/hidden write can precede the next rect.
    const readings = current.current.map<AttachmentRead>(food => {
      if (food.id === dragging.current?.id || food.id === discard.current?.id || food.id === carried.current) return { food };
      let bound = attachments.current.get(food.id);
      if (food.id === selection.current && !bound?.home) return { food };
      if (!bound) { bound = { position: attachCompanionFood(food, scroll) }; attachments.current.set(food.id, bound); }
      if (bound.viewportFloor || bound.pending) return { food, bound };
      if (bound.home && !bound.element?.isConnected) bound.element = document.querySelector<HTMLElement>(homeSelector(bound.home)) ?? undefined;
      if (bound.home && !bound.element) return { food, bound, unavailable: true };
      if (bound.panel && food.platformId) {
        const replacement = anchorFor.current?.(food.platformId);
        if (replacement?.element?.isConnected) bound.element = replacement.element;
      }
      // A deleted/recycled date is not a document-space fallback or another
      // day. Only the same explicit panel/home family may replace native DOM.
      if (bound.element && (!bound.element.isConnected || bound.identity !== companionCalendarAnchorIdentity(bound.element))) return { food, bound, unavailable: true };
      let rect: DOMRect | undefined;
      if (bound.element) {
        rect = measured.get(bound.element);
        if (!rect) { rect = bound.element.getBoundingClientRect(); measured.set(bound.element, rect); }
        // The outlet/floor is decorative aria-hidden ink, yet remains a real
        // measured recipient. Its enclosing room still fails closed when
        // hidden, inert or folded; calendar/panel sources include themselves.
        const visibilitySource = bound.home ? bound.element.parentElement : bound.element;
        if (rect.width <= 0 || rect.height <= 0 || visibilitySource?.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]")) return { food, bound, unavailable: true };
        if (bound.home === "floor" && !controls.has(bound.element)) controls.set(bound.element, homeControlRects(bound.element, measured));
      }
      const supports = bound.element && rect && !bound.home ? platforms.current.flatMap(support => {
        const source = anchorFor.current?.(support.id);
        if (!source || source.element !== bound.element) return [];
        const rebased = rebaseCompanionFoodSupport(support, source, rect!);
        return rebased ? [rebased] : [];
      }) : undefined;
      return { food, bound, rect, controls: bound.element ? controls.get(bound.element) : undefined, supports };
    });
    const paintIds = new Set<string>(), unavailableIds = new Set<string>();
    current.current = readings.map(({ food, bound, rect, controls: obstacles, supports, unavailable }) => {
      if (!bound) return food;
      paintIds.add(food.id);
      if (unavailable) { unavailableIds.add(food.id); visibility.current.set(food.id, false); return food; }
      if (bound.pending) {
        const retained = { ...food, x: clamp(food.x, 24, innerWidth - 24), y: clamp(food.y, 44, innerHeight - 24) };
        const recovered = followCompanionViewportFloorFood(retained, retained.x, platforms.current, viewport);
        visibility.current.set(food.id, true);
        if (!recovered) return retained;
        bound.pending = undefined; bound.viewportFloor = { x: retained.x }; bound.position = attachCompanionFood(recovered, scroll);
        const gravity = createCompanionFoodGravity(retained, recovered, performance.now(), { recoverAboveFloor: true, flutter: true });
        if (gravity.duration && operating.current && !suspending.current && !document.hidden && !reduced() && graphics.current !== "off") {
          drops.current.set(food.id, gravity); presentations.current.set(food.id, gravity.sample(performance.now())); animateDrops.current();
        }
        return recovered;
      }
      if (bound.viewportFloor) {
        const followed = followCompanionViewportFloorFood(food, bound.viewportFloor.x, platforms.current, viewport);
        // A fully covered floor must not fabricate an unsafe span. Keep its
        // last point/intended x for the next real geometry delivery instead.
        if (!followed) { unavailableIds.add(food.id); visibility.current.set(food.id, false); return food; }
        bound.position = attachCompanionFood(followed, scroll);
        const shown = drops.current.has(food.id) ? presentations.current.get(food.id) ?? followed : followed;
        visibility.current.set(food.id, shown.x >= -22 && shown.x <= viewport.width + 22 && shown.y >= -6 && shown.y <= viewport.height + 38);
        return followed;
      }
      let followed = followCompanionFood(bound.position, scroll, rect, bound.home === "tray" ? false : bound.home === "floor" ? "floor" : true);
      if (supports) {
        const safe = safeCompanionAttachedFood(followed.point, supports);
        if (!safe) { unavailableIds.add(food.id); visibility.current.set(food.id, false); return food; }
        followed = { point: safe, attachment: { ...followed.attachment, documentX: safe.x + scroll.x, documentY: safe.y + scroll.y } };
      }
      if (bound.home === "floor" && rect && bound.element) {
        const safe = receiveCompanionHomeFloorFood(followed.point, { x: followed.point.x, y: rect.top + rect.height - 2 }, rect, obstacles ?? [], true);
        if (!safe) { unavailableIds.add(food.id); visibility.current.set(food.id, false); return food; }
        // Reflow may move controls across a retained local x. Keep its source
        // offset for regrowth; only the displayed safe x/document point changes.
        followed = { point: safe, attachment: { ...followed.attachment, documentX: safe.x + scroll.x, documentY: safe.y + scroll.y } };
      }
      bound.position = followed.attachment;
      const next = { ...food, ...followed.point };
      // A geometry sync may arrive between gravity frames. Its logical target
      // can already be below the viewport while the drawing is still falling.
      const shown = drops.current.has(food.id) ? presentations.current.get(food.id) ?? next : next;
      visibility.current.set(food.id, shown.x >= -22 && shown.x <= viewport.width + 22 && shown.y >= -6 && shown.y <= viewport.height + 38);
      return next;
    });
    if (frameTime !== undefined) {
      if (drops.current.size) {
        const byId = new Map(current.current.map(food => [food.id, food]));
        for (const [id, gravity] of drops.current) {
          const food = byId.get(id);
          if (!food) { drops.current.delete(id); presentations.current.delete(id); continue; }
          // Sample against the carried target before the only paint. Following
          // a moving support never reseeds the fall's original clock or x.
          const presentation = gravity.sample(frameTime, food);
          // Visibility follows the actual falling drawing; folded or unsafe
          // house attachments retain their existing occlusion.
          if (!unavailableIds.has(id)) visibility.current.set(id, presentation.x >= -22 && presentation.x <= viewport.width + 22 && presentation.y >= -6 && presentation.y <= viewport.height + 38);
          if (presentation.active) presentations.current.set(id, presentation);
          else { drops.current.delete(id); presentations.current.delete(id); if (!unavailableIds.has(id) && visibility.current.get(id) !== false && operating.current && !document.hidden) landed.current?.(); }
          paintIds.add(id);
        }
      }
      if (!drops.current.size) { cancelAnimationFrame(dropFrame.current); dropFrame.current = 0; }
      followedFrame.current = { time: frameTime, foods: current.current };
    }
    for (const food of current.current) if (paintIds.has(food.id)) paint(food, presentations.current.get(food.id));
  }, [paint]);
  const runDrops = useCallback(() => {
    if (dropFrame.current || !drops.current.size) return;
    lastDropPaint.current = performance.now() - 1000 / 60;
    const step = (now: number) => {
      dropFrame.current = 0;
      const mode = graphics.current;
      if (!operating.current || document.hidden || reduced() || mode === "off") { finishDrops(); return; }
      const deadline = nextCompanionPaint(now, lastDropPaint.current, mode === "full" ? 60 : 30);
      if (deadline !== null) {
        lastDropPaint.current = deadline;
        // At most MAX_COMPANION_FOOD retained source rects, only during a fall.
        // A moving target carries the fall; neither its clock nor x is reseeded.
        followAttachments(now);
      }
      if (drops.current.size) dropFrame.current = requestAnimationFrame(step);
    };
    dropFrame.current = requestAnimationFrame(step);
  }, [finishDrops, followAttachments]);
  animateDrops.current = runDrops;
  const clearGuard = useCallback(() => { clearTimeout(guard.current.timer); guard.current = { owns: false, pointer: null }; }, []);
  const ownClick = useCallback((pointer: number) => { clearTimeout(guard.current.timer); guard.current = { owns: true, pointer }; }, []);
  const clearBin = (bin: HTMLElement) => { bin.removeAttribute("data-food-over"); };
  const cancelHover = useCallback(() => { cancelAnimationFrame(hoverFrame.current); hoverFrame.current = 0; if (hover.current) clearBin(hover.current.bin); hover.current = null; }, []);
  const release = useCallback((settle = false) => {
    dragFrame.current!.cancel();
    const drag = dragging.current;
    if (!drag) return;
    if (drag.moved) { followDragHome(drag); const latest = current.current.find(item => item.id === drag.id); if (latest) paint(latest); }
    dragging.current = null;
    if (drag.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer);
    if (settle) update(current.current.map(food => food.id === drag.id ? settleFood(food, food, drag.moved && attachments.current.get(food.id)?.home === "floor" ? { x: food.x + drag.offset.x, y: food.y + drag.offset.y } : undefined) : food));
  }, [followDragHome, paint, settleFood, update]);
  const cancelDiscard = useCallback((settle = false) => {
    const pending = discard.current; if (!pending) return;
    discard.current = null; clearTimeout(pending.timer); pending.animation?.cancel();
    pending.node.removeAttribute("data-discarding"); clearBin(pending.bin);
    if (settle) update(current.current.map(food => food.id === pending.id ? settleFood(food, food) : food));
    const food = current.current.find(food => food.id === pending.id); if (food) paint(food);
  }, [paint, settleFood, update]);
  const trashAt = useCallback((point: Point) => {
    for (const bin of document.querySelectorAll<HTMLElement>("[data-companion-trash]")) {
      if (bin.hasAttribute("disabled") || bin.getAttribute("aria-disabled") === "true") continue;
      const rect = bin.getBoundingClientRect(), style = getComputedStyle(bin);
      if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && Number(style.opacity || 1) > .05 && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) return bin;
    }
    return undefined;
  }, []);
  const beginDiscard = useCallback((id: string, bin: HTMLElement, human = true) => {
    const food = current.current.find(food => food.id === id), node = nodes.current.get(id);
    if (!operating.current || !food || !node || !bin.isConnected) { cancelHover(); return false; }
    cancelDiscard(); cancelAnimationFrame(hoverFrame.current); hoverFrame.current = 0; hover.current = null;
    release(); choose(null); resetNibble(id);
    bin.setAttribute("data-food-over", "");
    const rect = bin.getBoundingClientRect();
    const animation = reduced() ? undefined : node.animate([
      { transform: node.style.transform, opacity: 1 },
      { transform: `${transform({ x: rect.left + rect.width / 2, y: rect.top + rect.height * .65 })} scale(.16)`, opacity: 0 },
    ], { duration: COMPANION_TRASH_DISCARD_MS, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    node.setAttribute("data-discarding", "");
    const timer = setTimeout(() => {
      if (discard.current?.id !== id) return;
      discard.current = null; clearBin(bin); animation?.cancel();
      const removed = current.current.some(food => food.id === id);
      if ((document.activeElement as HTMLElement | null)?.dataset.food === id) focusReturn.current();
      presentations.current.delete(id); update(current.current.filter(food => food.id !== id)); setMessage("밥을 휴지통에 버렸어요.");
      if (human && removed) { discarded.current?.(id); logActivity("ui.click", { target: "companion-food-discard" }); }
    }, COMPANION_TRASH_DISCARD_MS);
    discard.current = { id, bin, node, animation, timer };
    return true;
  }, [cancelDiscard, cancelHover, choose, release, resetNibble, update]);
  const startHover = useCallback((id: string, bin: HTMLElement, point: Point, pinned = false) => {
    if (discard.current?.id === id) return;
    if (hover.current?.id === id && hover.current.bin === bin) { hover.current.point = point; hover.current.pinned ||= pinned; return; }
    cancelHover(); hover.current = { id, bin, point, since: performance.now(), pinned };
    bin.setAttribute("data-food-over", "");
    const step = (now: number) => {
      const state = hover.current;
      if (!state || !operating.current || !state.bin.isConnected || !current.current.some(food => food.id === state.id)) { cancelHover(); return; }
      const progress = companionTrashProgress(now - state.since);
      if (progress >= 1) {
        if (state.pinned || trashAt(state.point) === state.bin) beginDiscard(state.id, state.bin);
        else cancelHover();
      } else hoverFrame.current = requestAnimationFrame(step);
    };
    hoverFrame.current = requestAnimationFrame(step);
  }, [beginDiscard, cancelHover, trashAt]);
  const drop = useCallback((id: string, pointer?: Point, moved = false, velocity?: Point) => {
    const food = current.current.find(food => food.id === id); if (!food) return;
    const point = pointer ?? { x: food.x, y: food.y - 16 }, bin = trashAt(point);
    if (bin) { startHover(id, bin, point, true); return; }
    cancelHover(); resetNibble(id);
    // A horizontal keyboard move keeps its actual floor plane. The art
    // centre can overlap the bed behind it; receive at the open front edge.
    const releasePoint = !pointer && food.platformId === COMPANION_HOME_FLOOR_FOOD ? { x: food.x, y: food.y + COMPANION_HOME_FLOOR_INSET - 2 } : point;
    // A self-tap or Enter with no movement only puts a home snack down. It
    // does not turn the dispenser tray into an intentional outside release.
    const release = moved || !attachments.current.get(id)?.home ? releasePoint : undefined;
    update(current.current.map(item => item.id === id ? settleFood(item, item, release, velocity) : item));
    if (moved || selection.current === id && keyboardMoved.current) logActivity("ui.click", { target: "companion-food-move" });
    choose(null); setMessage("밥을 놓았어요. 배고프면 빅타민이 찾아와요.");
  }, [cancelHover, choose, resetNibble, settleFood, startHover, trashAt, update]);
  const interrupt = useCallback(() => {
    const homeSelection = selection.current && attachments.current.get(selection.current)?.home ? selection.current : null;
    suspending.current = true; cancelJostle(); finishDrops();
    if (carried.current) releaseCarry(carried.current);
    cancelAnimationFrame(followFrame.current); followFrame.current = 0; followUntil.current = 0; cancelHover(); cancelDiscard(true); release(true); resetNibble();
    if (selection.current) update(current.current.map(food => food.id === selection.current ? settleFood(food, food) : food));
    choose(homeSelection); suspending.current = false;
  }, [cancelDiscard, cancelHover, cancelJostle, choose, finishDrops, release, releaseCarry, resetNibble, settleFood, update]);

  useImperativeHandle(ref, () => ({
    spawn(kind, point, source, autonomous = false, recipient, occupied = [], petSupports) {
      if (!operating.current || !isCompanionFoodKind(kind) || ![point.x, point.y].every(Number.isFinite)) return;
      if (autonomous && recipient && (document.hidden || selection.current || dragging.current || discard.current)) return;
      if (current.current.length >= MAX_COMPANION_FOOD) { setMessage(`밥은 ${MAX_COMPANION_FOOD}개까지 놓을 수 있어요. 남은 밥을 기다리거나 휴지통에 치워 주세요.`); return; }
      if (source && (!source.isConnected || source.closest("[hidden],[inert]"))) return;
      const outlet = source?.getBoundingClientRect();
      if (outlet && (outlet.width <= 0 || outlet.height <= 0)) return;
      const origin = outlet ? { x: outlet.left + outlet.width / 2, y: outlet.bottom + 2 } : point;
      const food: Food = { id: `snack-${++serial.current}`, kind, x: clamp(origin.x, 24, innerWidth - 24), y: clamp(origin.y, 48, innerHeight - 24) };
      let placed: Food;
      if (source || autonomous && recipient) {
        const { available, sources } = measureSupports();
        const viewport = { width: innerWidth, height: innerHeight };
        const bodies = petSupports?.slice(0, 8).flatMap(support => {
          const anchor = anchorFor.current?.(support.id), current = [...sources.values()].find(s => s.element === anchor?.element)?.origin;
          if (!anchor?.element || !current) return [];
          // Reuse the same native frame already read for the room's food
          // supports. A moving panel must not compare old body x with new food x.
          if (anchor.left === current.x && anchor.top === current.y && anchor.width === current.width && anchor.height === current.height) return [support];
          const rebased = rebaseCompanionFoodBodySupport(support, anchor, { left: current.x, top: current.y, width: current.width, height: current.height });
          return rebased ? [rebased] : [];
        });
        const ejection = source ? planCompanionHomeFoodEjection(food, available, viewport, [...current.current, ...occupied], bodies)
          : planCompanionDispenserEjection(food, recipient!, available, viewport);
        if (!ejection) return;
        placed = ejection.food; bindLanding(food, placed, origin, sources);
        if (!suspending.current && !document.hidden && !reduced() && graphics.current !== "off") {
          const flight = createCompanionFoodToss(food, placed, performance.now(), ejection);
          drops.current.set(food.id, flight);
          const pose = flight.sample(performance.now()); presentations.current.set(food.id, pose); paint(placed, pose); animateDrops.current();
        } else paint(placed);
      } else {
        placed = autonomous ? settleFood(food, food) : food;
      }
      cancelHover(); update([...current.current, placed]); setMessage(autonomous ? "간식이 나왔어요." : `${names[kind]} 꺼냈어요. 잡아 끌어 옮겨 주세요.`);
      if (!autonomous) logActivity("ui.click", { target: "companion-food-spawn" });
      if (attachments.current.get(food.id)?.home) followHome.current();
      return food.id;
    },
    // Logical destinations reserve space during finite falls too. Presentation
    // coordinates and IDs never leave this local physics bridge.
    occupied: () => current.current.map(({ x, y }) => ({ x, y })),
    foods: () => current.current.filter(food => !attachments.current.get(food.id)?.pending && !drops.current.has(food.id) && visibility.current.get(food.id) !== false && food.id !== selection.current && food.id !== dragging.current?.id && food.id !== discard.current?.id && food.id !== carried.current),
    contains: id => current.current.some(food => food.id === id),
    consume(id) {
      if (attachments.current.get(id)?.pending || drops.current.has(id) || visibility.current.get(id) === false || selection.current === id || dragging.current?.id === id || discard.current?.id === id || carried.current === id || !current.current.some(food => food.id === id)) return false;
      if ((document.activeElement as HTMLElement | null)?.dataset.food === id) focusReturn.current();
      presentations.current.delete(id); update(current.current.filter(food => food.id !== id)); setMessage("빅타민이 밥을 맛있게 먹었어요."); return true;
    },
    stash(id) {
      if (attachments.current.get(id)?.pending || drops.current.has(id) || visibility.current.get(id) === false || selection.current === id || dragging.current?.id === id || discard.current?.id === id || carried.current === id || !current.current.some(food => food.id === id)) return false;
      if ((document.activeElement as HTMLElement | null)?.dataset.food === id) focusReturn.current();
      cancelJostle(id); presentations.current.delete(id); attachments.current.delete(id);
      update(current.current.filter(food => food.id !== id)); setMessage("주머니 속으로 쏙!"); return true;
    },
    nibble(id, progress = 0, mouth, facing = 1) {
      if (id) cancelJostle(id);
      for (const food of current.current) {
        if (food.id === carried.current) continue;
        if (drops.current.has(food.id)) continue;
        if (food.id !== id || food.id === selection.current || food.id === dragging.current?.id || food.id === discard.current?.id) { presentations.current.delete(food.id); paint(food); continue; }
        const presentation = presentCompanionFood(food, progress, mouth, facing, reduced());
        presentations.current.set(food.id, presentation); paint(food, presentation);
      }
    },
    sync(next, getAnchor, landings) {
      // The pet carries its occupied/target Platform objects between full
      // scans. Food needs the immutable full-scan baseline paired with anchor()
      // so a drag/drop during scrolling applies the DOM delta exactly once.
      platforms.current = (landings ?? next).map(platform => ({ ...platform })); if (getAnchor) anchorFor.current = getAnchor;
      followAttachments();
    },
    pause(next) { operating.current = enabled && !blocked && !next; setPaused(next); if (next) interrupt(); else followAttachments(); },
    beginCarry(id) {
      const food = current.current.find(item => item.id === id);
      if (!operating.current || document.hidden || carried.current || !food || !nodes.current.has(id) || attachments.current.get(id)?.pending || drops.current.has(id) || presentations.current.has(id)
        || visibility.current.get(id) === false || selection.current || dragging.current || discard.current) return false;
      cancelJostle(id); attachments.current.delete(id); carried.current = id;
      current.current = current.current.map(item => item.id === id ? { ...item, platformId: undefined } : item);
      paint(food); return true;
    },
    carry(id, point, onPaint) {
      if (!operating.current || document.hidden || carried.current !== id || ![point.x, point.y].every(Number.isFinite)) return false;
      const food = current.current.find(item => item.id === id), node = nodes.current.get(id); if (!food || !node?.isConnected) return false;
      const next = { ...food, x: clamp(point.x, 24, innerWidth - 24), y: clamp(point.y, 0, innerHeight - 24), platformId: undefined };
      current.current = current.current.map(item => item.id === id ? next : item);
      paint(next);
      if (!node.hidden) onPaint?.({ x: Number(next.x.toFixed(3)), y: Number(next.y.toFixed(3)) });
      return true;
    },
    releaseCarry,
    discardCarry(id, bin) {
      const food = current.current.find(item => item.id === id);
      if (!operating.current || document.hidden || carried.current !== id || !food || !bin.isConnected || !bin.matches("[data-companion-trash]")
        || bin.closest("[hidden],[inert],[aria-hidden=true],[data-panel-collapsed]") || bin.hasAttribute("disabled") || bin.getAttribute("aria-disabled") === "true") return false;
      const rect = bin.getBoundingClientRect(), style = getComputedStyle(bin);
      if (rect.width <= 0 || rect.height <= 0 || style.visibility === "hidden" || Number(style.opacity || 1) <= .05
        || food.x < rect.left - 44 || food.x > rect.right + 44 || food.y - 16 < rect.top - 44 || food.y - 16 > rect.bottom + 44) return false;
      if (!nodes.current.has(id)) return false;
      carried.current = undefined;
      return beginDiscard(id, bin, false);
    },
    carried: () => carried.current,
    scatter(point, radius, strength = 1) {
      if (!operating.current || document.hidden || ![point.x, point.y, radius].every(Number.isFinite) || radius <= 0) return 0;
      const nearby = current.current.filter(food => !attachments.current.get(food.id)?.pending && !drops.current.has(food.id) && !presentations.current.has(food.id) && visibility.current.get(food.id) !== false
        && food.id !== carried.current && food.id !== selection.current && food.id !== dragging.current?.id && food.id !== discard.current?.id)
        .map(food => ({ food, distance: Math.hypot(food.x - point.x, food.y - point.y) })).filter(item => item.distance <= radius).sort((a, b) => a.distance - b.distance).slice(0, 3);
      if (!nearby.length) return 0;
      const { available, sources } = measureSupports(), changed = new Map<string, Food>();
      const now = performance.now(), animate = !suspending.current && !reduced() && graphics.current !== "off";
      for (const { food } of nearby) {
        const toss = planCompanionFoodToss(food, point, strength, available, { width: innerWidth, height: innerHeight });
        if (!toss) continue;
        cancelJostle(food.id); const placed = toss.food;
        bindLanding(food, placed, placed, sources); changed.set(food.id, placed);
        if (animate) { const flight = createCompanionFoodToss(food, placed, now, toss); drops.current.set(food.id, flight); const pose = flight.sample(now); presentations.current.set(food.id, pose); paint(placed, pose); }
        else paint(placed);
      }
      if (changed.size) { update(current.current.map(food => changed.get(food.id) ?? food)); animateDrops.current(); }
      return changed.size;
    },
    jostle(point, radius, strength = 1) {
      if (!operating.current || document.hidden || reduced() || graphics.current === "off" || ![point.x, point.y, radius].every(Number.isFinite) || radius <= 0) return;
      // Cosmetic art only: the native food target, logical support, gravity
      // and eating eligibility keep their exact coordinates and ownership.
      const nearby = current.current.filter(food => !attachments.current.get(food.id)?.pending && !drops.current.has(food.id) && !presentations.current.has(food.id) && visibility.current.get(food.id) !== false && food.id !== carried.current && food.id !== selection.current && food.id !== dragging.current?.id && food.id !== discard.current?.id)
        .map(food => ({ food, distance: Math.hypot(food.x - point.x, food.y - point.y) }))
        .filter(({ distance }) => distance <= radius).sort((a, b) => a.distance - b.distance).slice(0, 3);
      cancelJostle();
      for (const { food, distance } of nearby) {
        const node = nodes.current.get(food.id), art = node?.firstElementChild as HTMLElement | null;
        if (!node || !art?.animate) continue;
        const { height, rotation, duration } = companionFoodJostle(distance, radius, food.x < point.x ? -1 : 1, strength)!;
        const animation = art.animate([
          { transform: "translate3d(0,0,0) rotate(0deg)" },
          { transform: `translate3d(0,${-height}px,0) rotate(${rotation}deg)`, offset: .45 },
          { transform: "translate3d(0,0,0) rotate(0deg)" },
        ], { duration, easing: "cubic-bezier(.2,.65,.35,1)" });
        jostles.current.set(food.id, { node, animation }); node.setAttribute("data-jostling", "");
        const done = () => { if (jostles.current.get(food.id)?.animation === animation) { jostles.current.delete(food.id); node.removeAttribute("data-jostling"); } };
        animation.onfinish = done; animation.oncancel = done;
      }
    },
    clear() {
      interrupt();
      const removed = current.current.map(food => food.id);
      if ((document.activeElement as HTMLElement | null)?.closest(".vc-food")) focusReturn.current();
      update([]); choose(null); setMessage("남은 밥을 치웠어요.");
      for (const id of removed) discarded.current?.(id);
      if (removed.length) logActivity("ui.click", { target: "companion-food-clear" });
    },
  }));
  useLayoutEffect(() => {
    // Only a changed React transform prop can overwrite the imperative pose.
    // Unrelated parent commits leave the frame cache and resting DOM untouched.
    for (const food of foods) {
      const logical = transform(food), node = nodes.current.get(food.id);
      if (node && renderedTransforms.current.get(food.id) !== logical) painted.current.delete(node);
      renderedTransforms.current.set(food.id, logical);
    }
    for (const id of renderedTransforms.current.keys()) if (!nodes.current.has(id)) renderedTransforms.current.delete(id);
    for (const food of current.current) paint(food, presentations.current.get(food.id));
  });
  useLayoutEffect(() => { if (selected) nodes.current.get(selected)?.focus({ preventScroll: true }); }, [selected]);
  useEffect(() => { interrupt(); update([]); choose(null); setMessage(""); }, [enabled, choose, interrupt, update]);
  const foodMonth = useRef(monthKey);
  useEffect(() => {
    if (foodMonth.current === monthKey) return;
    foodMonth.current = monthKey;
    interrupt();
    // The new calendar never inherits yesterday's anonymous day/card source.
    // Actual home/panel/current screen-floor food belongs to that live plane.
    update(current.current.filter(food => { const bound = attachments.current.get(food.id); return Boolean(bound?.home || bound?.panel || bound?.viewportFloor || bound?.pending); }));
    choose(null); setMessage("");
  }, [monthKey, choose, interrupt, update]);
  useEffect(() => { if (blocked) interrupt(); setPaused(blocked); }, [blocked, interrupt]);
  useEffect(() => {
    if (!enabled) return;
    const down = (event: PointerEvent) => {
      if (dragging.current && dragging.current.pointer !== event.pointerId) {
        if (layer.current?.contains(event.target as Node)) { event.preventDefault(); event.stopImmediatePropagation(); }
        return;
      }
      // A fresh pointer sequence supersedes an old canceled/missing click.
      if (guard.current.owns) clearGuard();
    };
    const up = (event: PointerEvent) => {
      if (!guard.current.owns || guard.current.pointer !== event.pointerId) return;
      if (event.type === "pointercancel") interrupt();
      guard.current.pointer = null; clearTimeout(guard.current.timer);
      guard.current.timer = setTimeout(clearGuard, 500);
    };
    const click = (event: MouseEvent) => {
      if ("pointerId" in event && Number(event.pointerId) < 0) return;
      if (guard.current.owns) { event.preventDefault(); event.stopImmediatePropagation(); clearGuard(); }
    };
    const hidden = () => { if (document.hidden) interrupt(); };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true); document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", hidden); window.addEventListener("blur", interrupt);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("blur", interrupt);
      suspending.current = true;
      finishDrops(); cancelHover(); cancelDiscard(); if (carried.current) releaseCarry(carried.current); release(); clearGuard();
      suspending.current = false;
    };
  }, [enabled, cancelDiscard, cancelHover, clearGuard, finishDrops, interrupt, release, releaseCarry]);
  useEffect(() => {
    if (!enabled) return;
    // Only real layout events own this finite follow. A closed/remounted home
    // retains its local tray origin; no idle observer or perpetual rAF runs.
    const schedule = (event?: Event) => {
      if (!operating.current || document.hidden) return;
      const sources = [...new Set([...attachments.current.values()].flatMap(bound => bound.element ? [bound.element] : []))];
      const motionEvent = event?.type === "vic:layout-motion" || event?.type === "animationstart" || event?.type === "transitionrun";
      const duration = companionLayoutMotionMs(event, sources, event?.type === "scroll" ? 180 : FLIP_MS);
      if (motionEvent && !duration) return;
      if (sources.length && duration && !reduced() && graphics.current !== "off") followUntil.current = Math.max(followUntil.current, performance.now() + duration + 80);
      if (followFrame.current) return;
      // The event can run later than this frame's rAF timestamp. Always carry
      // its first frame, then use that same clock for the finite follow tail.
      let lastPaint: number | undefined;
      const frame = (now: number) => {
        followFrame.current = 0;
        if (!operating.current || document.hidden) return;
        // Full mode follows each real display frame. A second60Hz threshold
        // would skip16.5ms CSS frames while the native calendar keeps moving.
        const deadline = lastPaint === undefined || graphics.current === "full" ? now : nextCompanionPaint(now, lastPaint, 30);
        // A live fall already follows every attachment at the same cadence.
        // Yield its reads/paint to that owner, then resume the finite tail.
        if (deadline !== null) { lastPaint = deadline; if (!drops.current.size) followAttachments(now); }
        if (now < followUntil.current && !reduced() && graphics.current !== "off") followFrame.current = requestAnimationFrame(frame);
      };
      followFrame.current = requestAnimationFrame(frame);
    };
    followHome.current = schedule;
    window.addEventListener("scroll", schedule, { passive: true, capture: true }); window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedule, { passive: true }); window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("vic:panel-section", schedule); window.addEventListener("vic:companion-home", schedule); window.addEventListener("vic:side-panel", schedule);
    window.addEventListener(COMPANION_CARD_PLAY_EVENT, schedule);
    window.addEventListener("vic:layout-motion", schedule);
    document.addEventListener("animationstart", schedule, true); document.addEventListener("transitionrun", schedule, true);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancelAnimationFrame(followFrame.current); followFrame.current = 0;
      followUntil.current = 0; followHome.current = () => {};
      window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule); window.visualViewport?.removeEventListener("resize", schedule);
      window.removeEventListener("vic:panel-section", schedule); window.removeEventListener("vic:companion-home", schedule); window.removeEventListener("vic:side-panel", schedule); document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener(COMPANION_CARD_PLAY_EVENT, schedule);
      window.removeEventListener("vic:layout-motion", schedule);
      document.removeEventListener("animationstart", schedule, true); document.removeEventListener("transitionrun", schedule, true);
    };
  }, [enabled, followAttachments]);

  if (!enabled) return null;
  return <div className="vc-food-layer" ref={layer} hidden={blocked || paused} data-sfx="off">
    {foods.map(food => <button type="button" className="vc-food" key={food.id} ref={node => { if (node) nodes.current.set(food.id, node); else nodes.current.delete(food.id); }} data-activity-manual="" data-food={food.id} data-kind={food.kind} data-selected={selected === food.id ? "" : undefined}
      style={{ left: 0, top: 0, transform: transform(food) }} aria-label={`빅타민 밥 ${names[food.kind]} · 잡아서 옮기기`} aria-describedby="vc-food-help"
      onPointerDown={event => {
        if (!operating.current || event.button !== 0 || dragging.current) return;
        event.preventDefault(); event.stopPropagation(); cancelHover();
        if (carried.current === food.id) carried.current = undefined;
        if (discard.current?.id === food.id) cancelDiscard();
        const wasFalling = drops.current.has(food.id);
        const position = rebasePresentation(food.id, !wasFalling && !presentations.current.has(food.id))!;
        choose(null); ownClick(event.pointerId);
        event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = { id: food.id, pointer: event.pointerId, node: event.currentTarget, start: { x: event.clientX, y: event.clientY }, point: { x: event.clientX, y: event.clientY }, offset: { x: event.clientX - position.x, y: event.clientY - position.y }, moved: false, wasFalling, startHome: attachments.current.get(food.id)?.home, time: performance.now(), velocity: { x: 0, y: 0 } };
      }}
      onPointerMove={event => {
        const drag = dragging.current; if (!drag || drag.id !== food.id || drag.pointer !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > 6) drag.moved = true;
        if (!drag.moved) return;
        moveDrag(drag, { x: event.clientX, y: event.clientY });
        dragFrame.current!.queue(() => {
          if (dragging.current !== drag || !operating.current) return;
          followDragHome(drag);
          const bin = trashAt(drag.point);
          const item = current.current.find(item => item.id === food.id); if (item) paint(item);
          if (bin) startHover(food.id, bin, drag.point); else cancelHover();
        });
      }}
      onPointerUp={event => {
        const drag = dragging.current; if (drag?.pointer !== event.pointerId) return;
        if (drag.moved && (drag.point.x !== event.clientX || drag.point.y !== event.clientY)) moveDrag(drag, { x: event.clientX, y: event.clientY });
        const velocity = performance.now() - drag.time <= 100 ? drag.velocity : { x: 0, y: 0 };
        event.stopPropagation(); release();
        if (drag.moved) drop(food.id, { x: event.clientX, y: event.clientY }, true, velocity);
        else {
          // Catching a falling snack pauses it under the pointer. Releasing
          // without moving resumes that fall; a resting/home tap stays put
          // and never becomes a trash gesture or a global placement mode.
          if (drag.wasFalling) update(current.current.map(item => item.id === food.id ? settleFood(item, item, { x: event.clientX, y: event.clientY }) : item));
          choose(null);
        }
      }}
      onPointerCancel={event => { if (dragging.current?.pointer === event.pointerId) { cancelHover(); release(true); choose(null); } }}
      onLostPointerCapture={event => { if (dragging.current?.pointer === event.pointerId) { cancelHover(); release(true); choose(null); } }}
      onClick={event => { event.preventDefault(); event.stopPropagation(); }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Escape", "Delete", "Backspace"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (carried.current === food.id) carried.current = undefined;
        if (event.key === "Escape") { const moved = selection.current === food.id && keyboardMoved.current; cancelHover(); if (discard.current?.id === food.id) cancelDiscard(); release(); const point = rebasePresentation(food.id); update(current.current.map(item => item.id === food.id ? settleFood(item, point ?? item) : item)); choose(null); if (moved) logActivity("ui.click", { target: "companion-food-move" }); return; }
        if (["Delete", "Backspace"].includes(event.key)) { if (!current.current.some(item => item.id === food.id)) return; cancelHover(); if (discard.current?.id === food.id) cancelDiscard(); focusReturn.current(); presentations.current.delete(food.id); update(current.current.filter(item => item.id !== food.id)); choose(null); setMessage("밥을 치웠어요."); discarded.current?.(food.id); logActivity("ui.click", { target: "companion-food-discard" }); return; }
        if (["Enter", " "].includes(event.key)) { if (!event.repeat) { if (selection.current === food.id) drop(food.id); else { rebasePresentation(food.id); choose(food.id); } } return; }
        rebasePresentation(food.id); attachments.current.delete(food.id); visibility.current.set(food.id, true); choose(food.id);
        update(current.current.map(item => {
          if (item.id !== food.id) return item;
          const point = { x: clamp(item.x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), 24, innerWidth - 24), y: clamp(item.y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), 48, innerHeight - 24) };
          keyboardMoved.current ||= point.x !== item.x || point.y !== item.y;
          return { ...item, ...point, platformId: event.key === "ArrowLeft" || event.key === "ArrowRight" ? item.platformId === COMPANION_HOME_FLOOR_FOOD ? item.platformId : undefined : undefined };
        }));
      }}><span aria-hidden="true"><CompanionFruit kind={food.kind} /></span></button>)}
    <span className="sr-only" id="vc-food-help">밥을 잡아 끌어 놓을 곳이나 휴지통으로 옮기기. Enter로 집고 방향키로 옮긴 뒤 Enter로 놓기. Delete로 치우기.</span>
    <span className="sr-only" role="status">{message}</span>
  </div>;
});
