"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CompanionFood as Food, Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_TRASH_DISCARD_MS, MAX_COMPANION_FOOD, attachCompanionFood, companionTrashProgress, followCompanionFood, placeCompanionFood, presentCompanionFood, type CompanionFoodAttachment, type CompanionFoodPresentation } from "@/lib/ui/viewer-companion/food";
import type { CompanionGeometryAnchor } from "@/lib/ui/viewer-companion/geometry";
import { createCompanionFoodGravity } from "@/lib/ui/viewer-companion/food-gravity";
import { nextCompanionPaint } from "@/lib/ui/viewer-companion/motion";
import { gfxMode } from "@/lib/ui/gfx";
import { FLIP_MS } from "@/lib/ui/flip-motion";
import { COMPANION_FOOD_NAMES as names, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { CompanionFruit } from "./companion-fruit";

type Point = { x: number; y: number };
export type CompanionFoodControl = {
  spawn: (kind: Food["kind"], point: Point, source?: HTMLElement) => void;
  foods: () => readonly Food[];
  consume: (id: string) => boolean;
  nibble: (id?: string, progress?: number, mouth?: Point, facing?: -1 | 1) => void;
  sync: (platforms: readonly Platform[], getAnchor?: (id: string) => CompanionGeometryAnchor | undefined, landings?: readonly Platform[]) => void;
  pause: (paused: boolean) => void;
  clear: () => void;
};
type Props = { enabled: boolean; blocked: boolean; monthKey: string; returnFocus: () => void };
type Drag = { id: string; pointer: number; node: HTMLButtonElement; start: Point; offset: Point; moved: boolean; wasSelected: boolean };
type Hover = { id: string; bin: HTMLElement; point: Point; since: number; pinned: boolean };
type Discard = { id: string; bin: HTMLElement; node: HTMLElement; animation?: Animation; timer: ReturnType<typeof setTimeout> };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const reduced = () => document.documentElement.hasAttribute("data-reduce-motion");
const transform = (point: Point) => `translate3d(${point.x.toFixed(3)}px,${point.y.toFixed(3)}px,0)`;

/** Three local snacks, one logical position per snack. Dragging and mouth
 * presentation only write transforms; React commits placement/removal. Native
 * capture owns placement/trash clicks even after selection or a node vanishes. */
export const CompanionFood = forwardRef<CompanionFoodControl, Props>(function CompanionFood({ enabled, blocked, monthKey, returnFocus }, ref) {
  const [foods, setFoods] = useState<Food[]>([]), [selected, setSelected] = useState<string | null>(null), [paused, setPaused] = useState(blocked);
  const [message, setMessage] = useState("");
  const current = useRef<Food[]>([]), selection = useRef<string | null>(null), platforms = useRef<readonly Platform[]>([]), layer = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>()), presentations = useRef(new Map<string, CompanionFoodPresentation>());
  const attachments = useRef(new Map<string, { element?: Element; position: CompanionFoodAttachment; home?: boolean }>()), visibility = useRef(new Map<string, boolean>());
  const anchorFor = useRef<((id: string) => CompanionGeometryAnchor | undefined) | undefined>(undefined);
  const drops = useRef(new Map<string, ReturnType<typeof createCompanionFoodGravity>>());
  const dropFrame = useRef(0), lastDropPaint = useRef(0), suspending = useRef(false), animateDrops = useRef<() => void>(() => {});
  const painted = useRef(new WeakMap<HTMLElement, { transform: string; nibble?: string; eating?: boolean }>());
  const renderedTransforms = useRef(new Map<string, string>());
  const serial = useRef(0), dragging = useRef<Drag | null>(null), hover = useRef<Hover | null>(null), discard = useRef<Discard | null>(null);
  const dragFrame = useRef(0), hoverFrame = useRef(0), senseFrame = useRef(0), followFrame = useRef(0), operating = useRef(false);
  const followUntil = useRef(0), followHome = useRef<() => void>(() => {});
  const focusReturn = useRef(returnFocus); focusReturn.current = returnFocus;
  const guard = useRef<{ owns: boolean; pointer: number | null; timer?: ReturnType<typeof setTimeout> }>({ owns: false, pointer: null });
  operating.current = enabled && !blocked && !paused;
  const update = useCallback((next: Food[]) => {
    const ids = new Set(next.map(food => food.id));
    for (const id of attachments.current.keys()) if (!ids.has(id)) { attachments.current.delete(id); visibility.current.delete(id); presentations.current.delete(id); }
    for (const id of drops.current.keys()) if (!ids.has(id)) { drops.current.delete(id); presentations.current.delete(id); }
    if (!drops.current.size) { cancelAnimationFrame(dropFrame.current); dropFrame.current = 0; }
    current.current = next; setFoods(next);
  }, []);
  const choose = useCallback((id: string | null) => { selection.current = id; setSelected(id); }, []);
  const paint = useCallback((food: Food, presentation?: CompanionFoodPresentation) => {
    const node = nodes.current.get(food.id); if (!node || discard.current?.id === food.id) return;
    const hidden = visibility.current.get(food.id) === false;
    if (node.hidden !== hidden) node.hidden = hidden;
    if (node.hasAttribute("data-falling") !== drops.current.has(food.id)) node.toggleAttribute("data-falling", drops.current.has(food.id));
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
  }, []);
  const resetNibble = useCallback((id?: string) => {
    for (const food of current.current) if ((!id || food.id === id) && !drops.current.has(food.id)) { presentations.current.delete(food.id); paint(food); }
  }, [paint]);
  const rebasePresentation = useCallback((id: string) => {
    const food = current.current.find(item => item.id === id); if (!food) return;
    const pose = presentations.current.get(id) ?? food;
    drops.current.delete(id);
    if (!drops.current.size) { cancelAnimationFrame(dropFrame.current); dropFrame.current = 0; }
    if (!attachments.current.get(id)?.home) attachments.current.delete(id);
    visibility.current.set(id, true);
    current.current = current.current.map(item => item.id === id ? { ...item, x: pose.x, y: pose.y, platformId: undefined } : item);
    resetNibble(id); return pose;
  }, [resetNibble]);
  const settleFood = useCallback((food: Food, point: Point) => {
    // Merely selecting, pausing or dispensing another snack is not a drop.
    // Only genuine movement or an outside placement detaches a home snack.
    if (attachments.current.get(food.id)?.home && point.x === food.x && point.y === food.y) { paint(food); return food; }
    const scroll = { x: window.scrollX, y: window.scrollY };
    const measured = new Map<Element, DOMRect>(), sources = new Map<string, { element: Element; origin: Point }>();
    // Rebase the bounded existing platform list once at deliberate release.
    // Choosing from stale pre-scroll heights could otherwise select a ledge
    // that is now above the pointer. No selector walk or Range scan is needed.
    const available = platforms.current.slice(0, 200).flatMap(support => {
      const source = anchorFor.current?.(support.id);
      if (!source?.element) return [support];
      if (!source.element.isConnected || source.element.closest("[data-panel-collapsed]")) return [];
      let rect = measured.get(source.element);
      if (!rect) { rect = source.element.getBoundingClientRect(); measured.set(source.element, rect); }
      if (rect.width <= 0 || rect.height <= 0) return [];
      sources.set(support.id, { element: source.element, origin: { x: rect.left, y: rect.top } });
      return [{ ...support, x: support.x + rect.left - source.left, y: support.y + rect.top - source.top }];
    });
    const placed = placeCompanionFood(food, point, available);
    const source = placed.platformId ? sources.get(placed.platformId) : undefined, origin = source?.origin;
    // Bind to the current origin once. A subsequent scroll reads only this
    // retained source, never applies a second baseline delta or picks a day.
    const position = attachCompanionFood(placed, scroll, origin);
    attachments.current.set(food.id, { element: source?.element, position }); visibility.current.set(food.id, true);
    drops.current.delete(food.id); presentations.current.delete(food.id);
    const gravity = createCompanionFoodGravity(point, placed, performance.now());
    if (placed.platformId && gravity.duration > 0 && operating.current && !suspending.current && !document.hidden && !reduced() && gfxMode() !== "off") {
      drops.current.set(food.id, gravity);
      const presentation = gravity.sample(performance.now()); presentations.current.set(food.id, presentation); paint(placed, presentation);
      animateDrops.current();
    } else paint(placed);
    return placed;
  }, [paint]);
  const finishDrops = useCallback(() => {
    cancelAnimationFrame(dropFrame.current); dropFrame.current = 0;
    for (const id of drops.current.keys()) {
      drops.current.delete(id); presentations.current.delete(id);
      const food = current.current.find(item => item.id === id); if (food) paint(food);
    }
  }, [paint]);
  const followAttachments = useCallback(() => {
    if (!operating.current || document.hidden) return;
    const scroll = { x: window.scrollX, y: window.scrollY }, measured = new Map<Element, DOMRect>();
    current.current = current.current.map(food => {
      if (food.id === dragging.current?.id || food.id === discard.current?.id) return food;
      let bound = attachments.current.get(food.id);
      if (food.id === selection.current && !bound?.home) return food;
      if (!bound) { bound = { position: attachCompanionFood(food, scroll) }; attachments.current.set(food.id, bound); }
      if (bound.home && !bound.element?.isConnected) bound.element = document.querySelector<HTMLElement>(".vc-home .vc-dispenser-slot") ?? undefined;
      if (bound.home && !bound.element) { visibility.current.set(food.id, false); paint(food); return food; }
      if (bound.element && !bound.element.isConnected) { bound.element = undefined; food = { ...food, platformId: undefined }; }
      let rect: DOMRect | undefined;
      if (bound.element) {
        rect = measured.get(bound.element);
        if (!rect) { rect = bound.element.getBoundingClientRect(); measured.set(bound.element, rect); }
        if (rect.width <= 0 || rect.height <= 0 || bound.element.closest("[data-panel-collapsed]")) { visibility.current.set(food.id, false); paint(food); return food; }
      }
      const followed = followCompanionFood(bound.position, scroll, rect, !bound.home); bound.position = followed.attachment;
      const next = { ...food, ...followed.point };
      visibility.current.set(food.id, next.x >= -22 && next.x <= innerWidth + 22 && next.y >= -6 && next.y <= innerHeight + 38);
      paint(next, presentations.current.get(food.id)); return next;
    });
  }, [paint]);
  const runDrops = useCallback(() => {
    if (dropFrame.current || !drops.current.size) return;
    lastDropPaint.current = performance.now() - 1000 / 60;
    const step = (now: number) => {
      dropFrame.current = 0;
      const mode = gfxMode();
      if (!operating.current || document.hidden || reduced() || mode === "off") { finishDrops(); return; }
      const deadline = nextCompanionPaint(now, lastDropPaint.current, mode === "full" ? 60 : 30);
      if (deadline !== null) {
        lastDropPaint.current = deadline;
        // At most three retained source rects, only while a finite fall runs.
        // A moving target carries the fall; neither its clock nor x is reseeded.
        followAttachments();
        for (const [id, gravity] of drops.current) {
          const food = current.current.find(item => item.id === id);
          if (!food) { drops.current.delete(id); presentations.current.delete(id); continue; }
          const presentation = gravity.sample(now, food);
          if (presentation.active) presentations.current.set(id, presentation);
          else { drops.current.delete(id); presentations.current.delete(id); }
          paint(food, presentation.active ? presentation : undefined);
        }
      }
      if (drops.current.size) dropFrame.current = requestAnimationFrame(step);
    };
    dropFrame.current = requestAnimationFrame(step);
  }, [finishDrops, followAttachments, paint]);
  animateDrops.current = runDrops;
  const clearGuard = useCallback(() => { clearTimeout(guard.current.timer); guard.current = { owns: false, pointer: null }; }, []);
  const ownClick = useCallback((pointer: number) => { clearTimeout(guard.current.timer); guard.current = { owns: true, pointer }; }, []);
  const clearBin = (bin: HTMLElement) => { bin.removeAttribute("data-food-over"); bin.style.removeProperty("--vc-trash-progress"); };
  const cancelHover = useCallback(() => { cancelAnimationFrame(hoverFrame.current); hoverFrame.current = 0; if (hover.current) clearBin(hover.current.bin); hover.current = null; }, []);
  const release = useCallback((settle = false) => {
    cancelAnimationFrame(dragFrame.current); dragFrame.current = 0;
    const drag = dragging.current; dragging.current = null;
    if (!drag) return;
    if (drag.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer);
    if (settle) update(current.current.map(food => food.id === drag.id ? settleFood(food, food) : food));
  }, [settleFood, update]);
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
  const beginDiscard = useCallback((id: string, bin: HTMLElement) => {
    const food = current.current.find(food => food.id === id), node = nodes.current.get(id);
    if (!operating.current || !food || !node || !bin.isConnected) { cancelHover(); return; }
    cancelDiscard(); cancelAnimationFrame(hoverFrame.current); hoverFrame.current = 0; hover.current = null;
    release(); choose(null); resetNibble(id);
    bin.setAttribute("data-food-over", ""); bin.style.setProperty("--vc-trash-progress", "1");
    const rect = bin.getBoundingClientRect();
    const animation = reduced() ? undefined : node.animate([
      { transform: node.style.transform, opacity: 1 },
      { transform: `${transform({ x: rect.left + rect.width / 2, y: rect.top + rect.height * .65 })} scale(.16)`, opacity: 0 },
    ], { duration: COMPANION_TRASH_DISCARD_MS, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    node.setAttribute("data-discarding", "");
    const timer = setTimeout(() => {
      if (discard.current?.id !== id) return;
      discard.current = null; clearBin(bin); animation?.cancel();
      if ((document.activeElement as HTMLElement | null)?.dataset.food === id) focusReturn.current();
      presentations.current.delete(id); update(current.current.filter(food => food.id !== id)); setMessage("밥을 휴지통에 버렸어요.");
    }, COMPANION_TRASH_DISCARD_MS);
    discard.current = { id, bin, node, animation, timer };
  }, [cancelDiscard, cancelHover, choose, release, resetNibble, update]);
  const startHover = useCallback((id: string, bin: HTMLElement, point: Point, pinned = false) => {
    if (discard.current?.id === id) return;
    if (hover.current?.id === id && hover.current.bin === bin) { hover.current.point = point; hover.current.pinned ||= pinned; return; }
    cancelHover(); hover.current = { id, bin, point, since: performance.now(), pinned };
    bin.setAttribute("data-food-over", ""); bin.style.setProperty("--vc-trash-progress", "0");
    const step = (now: number) => {
      const state = hover.current;
      if (!state || !operating.current || !state.bin.isConnected || !current.current.some(food => food.id === state.id)) { cancelHover(); return; }
      const progress = companionTrashProgress(now - state.since);
      state.bin.style.setProperty("--vc-trash-progress", progress.toFixed(3));
      if (progress >= 1) {
        if (state.pinned || trashAt(state.point) === state.bin) beginDiscard(state.id, state.bin);
        else cancelHover();
      } else hoverFrame.current = requestAnimationFrame(step);
    };
    hoverFrame.current = requestAnimationFrame(step);
  }, [beginDiscard, cancelHover, trashAt]);
  const drop = useCallback((id: string, pointer?: Point) => {
    const food = current.current.find(food => food.id === id); if (!food) return;
    const point = pointer ?? { x: food.x, y: food.y - 16 }, bin = trashAt(point);
    if (bin) { startHover(id, bin, point, true); return; }
    cancelHover(); resetNibble(id);
    update(current.current.map(item => item.id === id ? settleFood(item, item) : item));
    choose(null); setMessage("밥을 놓았어요. 배고프면 빅타민이 찾아와요.");
  }, [cancelHover, choose, resetNibble, settleFood, startHover, trashAt, update]);
  const interrupt = useCallback(() => {
    const homeSelection = selection.current && attachments.current.get(selection.current)?.home ? selection.current : null;
    suspending.current = true; finishDrops();
    cancelAnimationFrame(senseFrame.current); cancelAnimationFrame(followFrame.current); followFrame.current = 0; followUntil.current = 0; cancelHover(); cancelDiscard(true); release(true); resetNibble();
    if (selection.current) update(current.current.map(food => food.id === selection.current ? settleFood(food, food) : food));
    choose(homeSelection); suspending.current = false;
  }, [cancelDiscard, cancelHover, choose, finishDrops, release, resetNibble, settleFood, update]);

  useImperativeHandle(ref, () => ({
    spawn(kind, point, source) {
      if (!operating.current || !isCompanionFoodKind(kind) || ![point.x, point.y].every(Number.isFinite)) return;
      if (current.current.length >= MAX_COMPANION_FOOD) { setMessage("밥은 세 개까지 놓을 수 있어요. 남은 밥을 기다리거나 휴지통에 치워 주세요."); return; }
      const food: Food = { id: `snack-${++serial.current}`, kind, x: clamp(point.x, 24, innerWidth - 24), y: clamp(point.y, 48, innerHeight - 24) };
      const settled = current.current.map(item => item.id === selection.current ? settleFood(item, item) : item);
      if (source?.isConnected) {
        const rect = source.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) attachments.current.set(food.id, { home: true, element: source, position: attachCompanionFood(food, { x: scrollX, y: scrollY }, { x: rect.left, y: rect.top }) });
      }
      cancelHover(); update([...settled, food]); choose(food.id); setMessage(`${names[kind]} 놓을 곳을 누르거나 방향키와 Enter로 놓아 주세요.`);
      if (attachments.current.get(food.id)?.home) followHome.current();
    },
    foods: () => current.current.filter(food => !drops.current.has(food.id) && visibility.current.get(food.id) !== false && food.id !== selection.current && food.id !== dragging.current?.id && food.id !== discard.current?.id),
    consume(id) {
      if (drops.current.has(id) || visibility.current.get(id) === false || selection.current === id || dragging.current?.id === id || discard.current?.id === id || !current.current.some(food => food.id === id)) return false;
      if ((document.activeElement as HTMLElement | null)?.dataset.food === id) focusReturn.current();
      presentations.current.delete(id); update(current.current.filter(food => food.id !== id)); setMessage("빅타민이 밥을 맛있게 먹었어요."); return true;
    },
    nibble(id, progress = 0, mouth, facing = 1) {
      for (const food of current.current) {
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
    clear() { interrupt(); if ((document.activeElement as HTMLElement | null)?.closest(".vc-food")) focusReturn.current(); update([]); choose(null); setMessage("남은 밥을 치웠어요."); },
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
  useEffect(() => { interrupt(); update([]); choose(null); setMessage(""); }, [monthKey, enabled, choose, interrupt, update]);
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
      if (!operating.current || event.button !== 0 || layer.current?.contains(event.target as Node)) return;
      // Carrying a selected snack must still allow opening its compact home.
      if ((event.target as Element | null)?.closest?.(".vc-home-launcher,[data-home-action=feed],.panel-section-toggle,[data-home-action=close]")) return;
      const food = current.current.find(food => food.id === selection.current); if (!food) return;
      const target = event.target as Element | null;
      if (attachments.current.get(food.id)?.home && target?.closest?.(".panel-place-ctl,.vc-home") && !target.closest("[data-companion-trash]")) return;
      event.preventDefault(); event.stopImmediatePropagation(); ownClick(event.pointerId);
      const point = { x: event.clientX, y: event.clientY }, bin = trashAt(point);
      if (bin) { startHover(food.id, bin, point, true); return; }
      cancelHover(); resetNibble(food.id);
      update(current.current.map(item => item.id === food.id ? settleFood(item, point) : item)); choose(null);
    };
    const move = (event: PointerEvent) => {
      if (!operating.current || dragging.current || !selection.current || event.pointerType === "touch") return;
      const point = { x: event.clientX, y: event.clientY };
      cancelAnimationFrame(senseFrame.current); senseFrame.current = requestAnimationFrame(() => {
        if (!selection.current || !operating.current) return;
        const bin = trashAt(point);
        if (bin) startHover(selection.current, bin, point);
        else if (!hover.current?.pinned) cancelHover();
      });
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
    document.addEventListener("pointerdown", down, true); document.addEventListener("pointermove", move, { capture: true, passive: true });
    document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true); document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", hidden); window.addEventListener("blur", interrupt);
    return () => {
      document.removeEventListener("pointerdown", down, true); document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", hidden); window.removeEventListener("blur", interrupt);
      cancelAnimationFrame(senseFrame.current); finishDrops(); cancelHover(); cancelDiscard(); release(); clearGuard();
    };
  }, [enabled, cancelDiscard, cancelHover, choose, clearGuard, finishDrops, interrupt, ownClick, release, resetNibble, settleFood, startHover, trashAt, update]);
  useEffect(() => {
    if (!enabled) return;
    // Only real layout events own this finite follow. A closed/remounted home
    // retains its local tray origin; no idle observer or perpetual rAF runs.
    const schedule = (event?: Event) => {
      if (!operating.current || document.hidden) return;
      if ((!event || event.type.startsWith("vic:")) && [...attachments.current.values()].some(bound => bound.home) && !reduced() && gfxMode() !== "off") followUntil.current = performance.now() + FLIP_MS + 80;
      if (followFrame.current) return;
      // The event can run later than this frame's rAF timestamp. Always carry
      // its first frame, then use that same clock for the finite follow tail.
      let lastPaint: number | undefined;
      const frame = (now: number) => {
        followFrame.current = 0;
        if (!operating.current || document.hidden) return;
        const deadline = lastPaint === undefined ? now : nextCompanionPaint(now, lastPaint, gfxMode() === "full" ? 60 : 30);
        if (deadline !== null) { lastPaint = deadline; followAttachments(); }
        if (now < followUntil.current && !reduced() && gfxMode() !== "off") followFrame.current = requestAnimationFrame(frame);
      };
      followFrame.current = requestAnimationFrame(frame);
    };
    followHome.current = schedule;
    window.addEventListener("scroll", schedule, { passive: true, capture: true }); window.addEventListener("resize", schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedule, { passive: true }); window.visualViewport?.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("vic:panel-section", schedule); window.addEventListener("vic:companion-home", schedule); window.addEventListener("vic:side-panel", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancelAnimationFrame(followFrame.current); followFrame.current = 0;
      followUntil.current = 0; followHome.current = () => {};
      window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule); window.visualViewport?.removeEventListener("resize", schedule);
      window.removeEventListener("vic:panel-section", schedule); window.removeEventListener("vic:companion-home", schedule); window.removeEventListener("vic:side-panel", schedule); document.removeEventListener("visibilitychange", schedule);
    };
  }, [enabled, followAttachments]);

  if (!enabled) return null;
  return <div className="vc-food-layer" ref={layer} hidden={blocked || paused} data-sfx="off">
    {foods.map(food => <button type="button" className="vc-food" key={food.id} ref={node => { if (node) nodes.current.set(food.id, node); else nodes.current.delete(food.id); }} data-food={food.id} data-kind={food.kind} data-selected={selected === food.id ? "" : undefined}
      style={{ left: 0, top: 0, transform: transform(food) }} aria-label={`빅타민 밥 ${names[food.kind]} · 잡아서 옮기기`} aria-describedby="vc-food-help"
      onPointerDown={event => {
        if (!operating.current || event.button !== 0 || dragging.current) return;
        event.preventDefault(); event.stopPropagation(); cancelHover();
        if (discard.current?.id === food.id) cancelDiscard();
        const wasSelected = selection.current === food.id, position = rebasePresentation(food.id)!;
        choose(null); ownClick(event.pointerId);
        event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = { id: food.id, pointer: event.pointerId, node: event.currentTarget, start: { x: event.clientX, y: event.clientY }, offset: { x: event.clientX - position.x, y: event.clientY - position.y }, moved: false, wasSelected };
      }}
      onPointerMove={event => {
        const drag = dragging.current; if (!drag || drag.id !== food.id || drag.pointer !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > 6) drag.moved = true;
        if (!drag.moved) return;
        attachments.current.delete(food.id); visibility.current.set(food.id, true);
        const point = { x: clamp(event.clientX - drag.offset.x, 24, innerWidth - 24), y: clamp(event.clientY - drag.offset.y, 48, innerHeight - 24) };
        current.current = current.current.map(item => item.id === food.id ? { ...item, platformId: undefined, ...point } : item);
        const pointer = { x: event.clientX, y: event.clientY };
        cancelAnimationFrame(dragFrame.current); dragFrame.current = requestAnimationFrame(() => {
          const item = current.current.find(item => item.id === food.id); if (item) paint(item);
          const bin = trashAt(pointer); if (bin) startHover(food.id, bin, pointer); else cancelHover();
        });
      }}
      onPointerUp={event => { const drag = dragging.current; if (drag?.pointer !== event.pointerId) return; event.stopPropagation(); release(); if (drag.moved || drag.wasSelected) drop(food.id, { x: event.clientX, y: event.clientY }); else { choose(food.id); setMessage("밥 놓을 곳이나 휴지통을 눌러 주세요."); } }}
      onPointerCancel={event => { if (dragging.current?.pointer === event.pointerId) { cancelHover(); release(true); choose(null); } }}
      onLostPointerCapture={event => { if (dragging.current?.pointer === event.pointerId) { cancelHover(); release(true); choose(null); } }}
      onClick={event => { event.preventDefault(); event.stopPropagation(); }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Escape", "Delete", "Backspace"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Escape") { cancelHover(); if (discard.current?.id === food.id) cancelDiscard(); release(); const point = rebasePresentation(food.id); update(current.current.map(item => item.id === food.id ? settleFood(item, point ?? item) : item)); choose(null); return; }
        if (["Delete", "Backspace"].includes(event.key)) { cancelHover(); if (discard.current?.id === food.id) cancelDiscard(); focusReturn.current(); presentations.current.delete(food.id); update(current.current.filter(item => item.id !== food.id)); choose(null); setMessage("밥을 치웠어요."); return; }
        if (["Enter", " "].includes(event.key)) { if (!event.repeat) { if (selection.current === food.id) drop(food.id); else { rebasePresentation(food.id); choose(food.id); } } return; }
        rebasePresentation(food.id); attachments.current.delete(food.id); visibility.current.set(food.id, true); choose(food.id);
        update(current.current.map(item => item.id === food.id ? { ...item, platformId: undefined, x: clamp(item.x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), 24, innerWidth - 24), y: clamp(item.y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), 48, innerHeight - 24) } : item));
      }}><span aria-hidden="true"><CompanionFruit kind={food.kind} /></span></button>)}
    <span className="sr-only" id="vc-food-help">밥을 누른 뒤 놓을 곳이나 휴지통을 누르거나 드래그로 옮기기. Enter로 집고 방향키로 옮긴 뒤 Enter로 놓기. Delete로 치우기.</span>
    <span className="sr-only" role="status">{message}</span>
  </div>;
});
