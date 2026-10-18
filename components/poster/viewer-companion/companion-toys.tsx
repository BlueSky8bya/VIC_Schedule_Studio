"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createCompanionToys, COMPANION_TOY_NAMES, type CompanionToy, type CompanionToyKind } from "@/lib/ui/viewer-companion/toys";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { logActivity } from "@/lib/activity/client";
import { CompanionToyArt } from "./companion-toy-art";
import type { CompanionToyExperience } from "@/lib/ui/viewer-companion/toy-tastes";
import "./companion-toys.css";

type Point = { x: number; y: number; platformId?: string };
export type CompanionToyControl = {
  sync: (platforms: readonly Platform[], bounds: { width: number; height: number }, now: number, smallHomeFloors?: readonly Platform[]) => void;
  tick: (now: number) => void;
  spawn: (point: Point, now: number, autonomous?: boolean) => string | undefined;
  available: () => CompanionToy[];
  ids: () => string[];
  count: () => number;
  moving: () => boolean;
  pause: (now: number) => void;
  resume: (now: number) => void;
  carried: () => string | undefined;
  pick: (id: string, point: Point) => boolean;
  carry: (id: string, point: Point) => boolean;
  put: (id: string, point: Point, now: number, toss?: boolean, asPlay?: boolean) => boolean;
  decline: (id: string, point: Point, now: number) => boolean;
  completePlay: (id: string, observed?: boolean) => void;
  stash: (id: string) => boolean;
  cancel: (now: number) => void;
};
type Props = { blocked: boolean; hidden?: boolean; onActivity: (direct?: boolean) => void; onCount: (count: number) => void; onReturned?: () => void; onExperience?: (kind: CompanionToyKind, outcome: CompanionToyExperience) => void };
export const CompanionToys = forwardRef<CompanionToyControl, Props>(function CompanionToys({ blocked, hidden = false, onActivity, onCount, onReturned, onExperience }, ref) {
  const model = useRef<ReturnType<typeof createCompanionToys> | null>(null);
  model.current ??= createCompanionToys();
  const world = model.current, nodes = useRef(new Map<string, HTMLButtonElement>()), count = useRef(0);
  const pendingPlays = useRef(new Map<string, { kind: CompanionToyKind; outcome: "played" | "declined" }>());
  const [items, setItems] = useState<{ id: string; kind: CompanionToyKind }[]>([]);
  const drag = useRef<{ id: string; pointer: number; node: HTMLButtonElement; moved: boolean; origin: Point; last: Point; time: number; velocity: Point } | null>(null);
  const blockedRef = useRef(blocked); blockedRef.current = blocked;
  const paint = useCallback(() => { world.visit(toy => {
    const node = nodes.current.get(toy.id);
    if (!node) return;
    node.hidden = Boolean(toy.hidden);
    const transform = "translate3d(" + toy.x.toFixed(3) + "px," + toy.y.toFixed(3) + "px,0) translate(-50%,-100%) rotate(" + toy.angle.toFixed(2) + "deg)";
    if (node.style.transform !== transform) node.style.transform = transform;
    for (const [key, value] of Object.entries({ held: String(toy.held), carried: String(toy.carried), kind: toy.kind, platform: toy.platformId ?? "", falling: String(!toy.held && !toy.carried && !toy.platformId && !toy.hidden) })) if (node.dataset[key] !== value) node.dataset[key] = value;
    node.disabled = blockedRef.current;
  }); }, [world]);
  const refresh = useCallback(() => {
    const next = world.items();
    setItems(previous => previous.length === next.length && previous.every((item, i) => item.id === next[i].id) ? previous : next.map(({ id, kind }) => ({ id, kind })));
    if (count.current !== next.length) { count.current = next.length; onCount(next.length); }
    paint();
  }, [world, onCount, paint]);
  const pauseModel = useCallback((now: number) => {
    pendingPlays.current.clear();
    const current = drag.current; drag.current = null;
    if (current) try { if (current.node.hasPointerCapture(current.pointer)) current.node.releasePointerCapture(current.pointer); } catch { /* detached capture */ }
    world.pause(now); paint();
  }, [world, paint]);
  useImperativeHandle(ref, () => ({
    sync(platforms, bounds, now, smallHomeFloors) { world.sync(platforms, bounds, now, smallHomeFloors); paint(); },
    tick(now) { world.tick(now); if (world.count() !== count.current) refresh(); else paint(); },
    spawn(point, now, autonomous = false) { if (blockedRef.current) return; const id = world.spawn(point, now); if (id) { refresh(); if (!autonomous) { const toy = world.items().find(item => item.id === id); if (toy) onExperience?.(toy.kind, "taken-out"); } onActivity(); } return id; },
    available: world.available, ids: world.ids, count: () => count.current, moving: world.moving, carried: world.carried,
    pause: pauseModel,
    resume(now) { if (!blockedRef.current) world.resume(now); },
    pick(id, point) { const ok = world.pick(id, point); paint(); return ok; },
    carry(id, point) { const ok = world.carry(id, point); paint(); return ok; },
    put(id, point, now, toss, asPlay = false) { const toy = world.items().find(item => item.id === id), ok = world.put(id, point, now, toss); paint(); if (ok) { if (toy && asPlay) pendingPlays.current.set(id, { kind: toy.kind, outcome: "played" }); onActivity(); } return ok; },
    decline(id, point, now) { const toy = world.items().find(item => item.id === id), ok = world.nudge(id, point, now); paint(); if (ok) { if (toy) pendingPlays.current.set(id, { kind: toy.kind, outcome: "declined" }); onActivity(); } return ok; },
    completePlay(id, observed = true) { const result = pendingPlays.current.get(id); pendingPlays.current.delete(id); if (observed && result && world.items().some(toy => toy.id === id && !toy.held)) onExperience?.(result.kind, result.outcome); },
    stash(id) { const toy = world.items().find(item => item.id === id), ok = world.stash(id); if (ok) { refresh(); if (toy) onExperience?.(toy.kind, "tidied"); } return ok; },
    cancel(now) { pendingPlays.current.clear(); world.releaseCarry(now); paint(); },
  }), [world, paint, refresh, onActivity, pauseModel, onExperience]);
  useEffect(() => {
    const now = performance.now();
    if (blocked) {
      // Model pause safely releases both pointer and keyboard holds in place,
      // then freezes every flight until the same host explicitly resumes.
      pauseModel(now);
    } else world.resume(now);
    paint();
  }, [blocked, world, paint, pauseModel]);
  const finish = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null; event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const box = !cancelled && document.querySelector<HTMLElement>(".vc-home [data-home-action='toys']"), rect = box && box.getBoundingClientRect();
    if (rect && event.clientX >= rect.left - 8 && event.clientX <= rect.right + 8 && event.clientY >= rect.top - 8 && event.clientY <= rect.bottom + 8 && world.returnHeld(current.id)) { refresh(); const toy = items.find(item => item.id === current.id); if (toy) onExperience?.(toy.kind, "tidied"); onReturned?.(); logActivity("ui.click", { target: "companion-toy-return" }); }
    else { world.drop(current.id, performance.now(), current.moved ? current.velocity : { x: 35, y: -130 }); if (!cancelled) logActivity("ui.click", { target: "companion-toy-drop" }); }
    paint(); onActivity(true);
  };
  return <div className="vc-toys" aria-label="빅타민 장난감" data-companion-toys="" hidden={hidden}>
    {items.map(toy => <button key={toy.id} ref={node => { if (node) { nodes.current.set(toy.id, node); paint(); } else nodes.current.delete(toy.id); }} className="vc-toy" data-companion-toy="" data-toy-id={toy.id} data-activity-manual="" data-act="companion-toy-grab" aria-label={COMPANION_TOY_NAMES[toy.kind] + " 잡기"} disabled={blocked} type="button"
      onPointerDown={event => { if (blockedRef.current || event.button !== 0 || !world.grab(toy.id)) return; pendingPlays.current.delete(toy.id); event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); const point = { x: event.clientX, y: event.clientY }; drag.current = { id: toy.id, pointer: event.pointerId, node: event.currentTarget, moved: false, origin: point, last: point, time: performance.now(), velocity: { x: 0, y: 0 } }; paint(); logActivity("ui.click", { target: "companion-toy-grab" }); onActivity(true); }}
      onPointerMove={event => { const current = drag.current; if (!current || current.pointer !== event.pointerId) return; event.stopPropagation(); const now = performance.now(), dt = Math.max(8, now - current.time), point = { x: event.clientX, y: event.clientY }; current.moved ||= Math.hypot(point.x - current.origin.x, point.y - current.origin.y) >= 4; current.velocity = { x: (point.x - current.last.x) / dt * 1000, y: (point.y - current.last.y) / dt * 1000 }; current.last = point; current.time = now; if (current.moved) world.drag(toy.id, point); paint(); }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onKeyDown={event => {
        if (blockedRef.current) return;
        const current = world.items().find(item => item.id === toy.id); if (!current) return;
        pendingPlays.current.delete(toy.id);
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          const ok = current.held ? world.drop(toy.id, performance.now(), { x: 20, y: -100 }) : world.grab(toy.id);
          if (ok) { logActivity("ui.click", { target: current.held ? "companion-toy-drop" : "companion-toy-grab" }); onActivity(true); paint(); }
        } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          if (!current.held) { if (!world.grab(toy.id)) return; logActivity("ui.click", { target: "companion-toy-grab" }); }
          if (world.drag(toy.id, { x: current.x + (event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0), y: current.y + (event.key === "ArrowDown" ? 16 : event.key === "ArrowUp" ? -16 : 0) })) { onActivity(true); paint(); }
        } else if (event.key === "Escape" && current.held) {
          event.preventDefault();
          if (world.drop(toy.id, performance.now())) { logActivity("ui.click", { target: "companion-toy-drop" }); onActivity(true); paint(); }
        }
      }}><CompanionToyArt kind={toy.kind} /></button>)}
  </div>;
});
