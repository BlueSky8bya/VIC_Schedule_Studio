"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { companionToyBoxDropReady, createCompanionToys, COMPANION_TOY_NAMES, type CompanionToy, type CompanionToyKind } from "@/lib/ui/viewer-companion/toys";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { logActivity } from "@/lib/activity/client";
import { CompanionToyArt } from "./companion-toy-art";
import type { CompanionToyExperience } from "@/lib/ui/viewer-companion/toy-tastes";
import { createCompanionInputFrame } from "@/lib/ui/viewer-companion/input-frame";
import "./companion-toys.css";
import { companionRoomItemLight, type CompanionRoomLightRect } from "@/lib/ui/viewer-companion/room-light";
import { createCompanionItemAnchors } from "@/lib/ui/viewer-companion/item-anchor";
import type { CompanionGeometryAnchor } from "@/lib/ui/viewer-companion/geometry";

type Point = { x: number; y: number; platformId?: string };
export type CompanionToyControl = {
  setRoomLight: (room?: CompanionRoomLightRect, grade?: number) => void;
  sync: (platforms: readonly Platform[], bounds: { width: number; height: number }, now: number, smallHomeFloors?: readonly Platform[], getAnchor?: (id: string) => CompanionGeometryAnchor | undefined) => void;
  tick: (now: number) => void;
  spawn: (point: Point, now: number, autonomous?: boolean, occupied?: readonly Point[]) => string | undefined;
  occupied: () => readonly Point[];
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
  nudge: (id: string, point: Point, now: number) => boolean;
  completePlay: (id: string, observed?: boolean) => void;
  completeCarriedPlay: (id: string, observed: boolean) => boolean;
  stash: (id: string) => boolean;
  cancel: (now: number) => void;
};
type Props = { blocked: boolean; hidden?: boolean; onActivity: (direct?: boolean) => void; onCount: (count: number) => void; onReturned?: () => void; onExperience?: (kind: CompanionToyKind, outcome: CompanionToyExperience, source?: Readonly<{ x: number; y: number }>) => void };
export const CompanionToys = forwardRef<CompanionToyControl, Props>(function CompanionToys({ blocked, hidden = false, onActivity, onCount, onReturned, onExperience }, ref) {
  const model = useRef<ReturnType<typeof createCompanionToys> | null>(null);
  model.current ??= createCompanionToys();
  const world = model.current, nodes = useRef(new Map<string, HTMLButtonElement>()), count = useRef(0);
  const itemAnchors = useRef<ReturnType<typeof createCompanionItemAnchors> | null>(null);
  itemAnchors.current ??= createCompanionItemAnchors();
  const anchorFor = useRef<((id: string) => CompanionGeometryAnchor | undefined) | undefined>(undefined);
  const pendingPlays = useRef(new Map<string, { kind: CompanionToyKind; outcome: "played" | "declined" }>());
  const pendingCarriedPlays = useRef(new Set<string>());
  const [items, setItems] = useState<{ id: string; kind: CompanionToyKind }[]>([]);
  const drag = useRef<{ id: string; pointer: number; node: HTMLButtonElement; moved: boolean; origin: Point; offset: Point; last: Point; time: number; velocity: Point } | null>(null);
  const dragFrame = useRef<ReturnType<typeof createCompanionInputFrame> | null>(null);
  dragFrame.current ??= createCompanionInputFrame();
  const painted = useRef(new WeakMap<HTMLButtonElement, string>());
  const paintedLight = useRef(new WeakMap<HTMLButtonElement, number>());
  const roomLight = useRef<{ room?: CompanionRoomLightRect; grade: number }>({ grade: 1 });
  const blockedRef = useRef(blocked); blockedRef.current = blocked;
  const dropBox = useRef<HTMLButtonElement | null>(null);
  const clearDropBox = useCallback(() => { dropBox.current?.removeAttribute("data-toy-over"); dropBox.current = null; }, []);
  const grab = (id: string) => {
    const toy = world.items().find(item => item.id === id); if (!toy) return;
    const node = nodes.current.get(id), source = toy.platformId && node?.dataset.nativeItemAnchor !== undefined ? anchorFor.current?.(toy.platformId) : undefined;
    let point: Point | undefined;
    if (source?.element?.isConnected) {
      // A native hit can arrive before the next JavaScript layout frame.
      // Resolve that existing grip against its actual floor once, before
      // detaching it into viewport coordinates for pointer/keyboard input.
      const rect = source.element.getBoundingClientRect();
      point = { x: toy.x + rect.left - source.left, y: toy.y + rect.top - source.top };
    }
    if (!world.grab(id)) return;
    if (point) world.drag(id, point);
    return world.items().find(item => item.id === id);
  };
  const returnTarget = (point: Point) => {
    const box = typeof document === "undefined" ? null : document.querySelector<HTMLButtonElement>(".vc-home [data-home-action='toys']");
    return box && !box.disabled && box.getAttribute("aria-disabled") !== "true" && !box.closest("[hidden],[inert],[aria-hidden='true']") && companionToyBoxDropReady(box.getBoundingClientRect(), point) ? box : undefined;
  };
  const paintDropBox = (point: Point) => {
    const target = returnTarget(point);
    if (target === dropBox.current) return;
    clearDropBox();
    if (target) { target.setAttribute("data-toy-over", ""); dropBox.current = target; }
  };
  const paint = useCallback((onlyId?: string) => { world.visit(toy => {
    if (onlyId && toy.id !== onlyId) return;
    const node = nodes.current.get(toy.id);
    if (!node) return;
    const light = companionRoomItemLight(toy, roomLight.current.room, roomLight.current.grade);
    if (paintedLight.current.get(node) !== light) { node.style.setProperty("--vc-item-room-light", String(light)); paintedLight.current.set(node, light); }
    node.hidden = Boolean(toy.hidden);
    const anchor = toy.platformId && !toy.hidden && !toy.held && !toy.carried ? anchorFor.current?.(toy.platformId) : undefined;
    const visibilitySource = anchor?.element?.matches(".vc-home-floor") ? anchor.element.parentElement : anchor?.element;
    const source = anchor?.element && !visibilitySource?.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]")
      ? { element: anchor.element, left: anchor.left, top: anchor.top } : undefined;
    const point = itemAnchors.current!.project(node, toy, source);
    const transform = "translate3d(" + point.x.toFixed(3) + "px," + point.y.toFixed(3) + "px,0) translate(-50%,-100%) rotate(" + toy.angle.toFixed(2) + "deg)";
    if (painted.current.get(node) !== transform) { node.style.transform = transform; painted.current.set(node, transform); }
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
    dragFrame.current!.cancel();
    clearDropBox();
    pendingPlays.current.clear();
    pendingCarriedPlays.current.clear();
    const current = drag.current; drag.current = null;
    if (current) try { if (current.node.hasPointerCapture(current.pointer)) current.node.releasePointerCapture(current.pointer); } catch { /* detached capture */ }
    world.pause(now); paint();
  }, [world, paint, clearDropBox]);
  useImperativeHandle(ref, () => ({
    setRoomLight(room, grade = 1) {
      const previous = roomLight.current;
      if (previous.grade === grade && ["left", "right", "top", "bottom"].every(key => previous.room?.[key as keyof CompanionRoomLightRect] === room?.[key as keyof CompanionRoomLightRect])) return;
      roomLight.current = { room: room && { ...room }, grade }; paint();
    },
    sync(platforms, bounds, now, smallHomeFloors, getAnchor) { if (getAnchor) anchorFor.current = getAnchor; world.sync(platforms, bounds, now, smallHomeFloors); paint(); },
    tick(now) { world.tick(now); if (world.count() !== count.current) refresh(); else paint(); },
    spawn(point, now, autonomous = false, occupied) { if (blockedRef.current) return; const id = world.spawn(point, now, occupied); if (id) { refresh(); if (!autonomous) { const toy = world.items().find(item => item.id === id); if (toy) onExperience?.(toy.kind, "taken-out"); } onActivity(); } return id; },
    occupied: world.occupied,
    available: world.available, ids: world.ids, count: () => count.current, moving: world.moving, carried: world.carried,
    pause: pauseModel,
    resume(now) { if (!blockedRef.current) world.resume(now); },
    pick(id, point) { const ok = world.pick(id, point); if (ok) { pendingPlays.current.delete(id); pendingCarriedPlays.current.add(id); } paint(id); return ok; },
    carry(id, point) { const ok = world.carry(id, point); paint(id); return ok; },
    put(id, point, now, toss, asPlay = false) { const toy = world.items().find(item => item.id === id), ok = world.put(id, point, now, toss); paint(); if (ok) { pendingCarriedPlays.current.delete(id); if (toy && asPlay) pendingPlays.current.set(id, { kind: toy.kind, outcome: "played" }); onActivity(); } return ok; },
    nudge(id, point, now) { const toy = world.items().find(item => item.id === id), ok = world.nudge(id, point, now); paint(); if (ok) { if (toy) pendingPlays.current.set(id, { kind: toy.kind, outcome: "played" }); onActivity(); } return ok; },
    decline(id, point, now) { const toy = world.items().find(item => item.id === id), ok = world.nudge(id, point, now); paint(); if (ok) { if (toy) pendingPlays.current.set(id, { kind: toy.kind, outcome: "declined" }); onActivity(); } return ok; },
    completePlay(id, observed = true) {
      const result = pendingPlays.current.get(id); pendingPlays.current.delete(id);
      const toy = world.items().find(toy => toy.id === id), node = nodes.current.get(id);
      if (!observed || !result || blockedRef.current || document.hidden || !toy || toy.held || toy.carried || toy.hidden || !node?.isConnected || node.hidden) return;
      // Once at the actual completion ACK, not on every pose/input frame.
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) onExperience?.(result.kind, result.outcome, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    },
    completeCarriedPlay(id, observed) {
      // One completion opportunity per successful real pickup. The authored
      // caller owns its decoded performance witness; a failed/canceled ACK
      // cannot be replayed later against the same carried object.
      const pending = pendingCarriedPlays.current.delete(id);
      const toy = world.items().find(toy => toy.id === id), node = nodes.current.get(id);
      if (!pending || !observed || blockedRef.current || document.hidden || world.carried() !== id || !toy?.carried || toy.held || toy.hidden || !node?.isConnected || node.hidden) return false;
      const view = node.ownerDocument.defaultView, style = view?.getComputedStyle(node);
      if (!style || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) <= 0) return false;
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0 && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite))) return false;
      onExperience?.(toy.kind, "played", { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      return true;
    },
    stash(id) { const toy = world.items().find(item => item.id === id), ok = world.stash(id); if (ok) { pendingCarriedPlays.current.delete(id); pendingPlays.current.delete(id); refresh(); if (toy) onExperience?.(toy.kind, "tidied"); } return ok; },
    cancel(now) { pendingPlays.current.clear(); pendingCarriedPlays.current.clear(); world.releaseCarry(now); paint(); },
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
  useEffect(() => () => { pauseModel(performance.now()); }, [pauseModel]);
  useEffect(() => () => itemAnchors.current!.clearAll(), []);
  useEffect(() => { if (hidden) clearDropBox(); }, [hidden, clearDropBox]);
  const finish = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    // Flush the final native point before release. The captured hit offset
    // remains fixed, including a pointerup before its pending display frame.
    if (!cancelled && current.moved) {
      const dt = Math.max(8, performance.now() - current.time);
      if (event.clientX !== current.last.x || event.clientY !== current.last.y) current.velocity = { x: (event.clientX - current.last.x) / dt * 1000, y: (event.clientY - current.last.y) / dt * 1000 };
      world.drag(current.id, { x: event.clientX - current.offset.x, y: event.clientY - current.offset.y });
    }
    if (cancelled) dragFrame.current!.cancel(); else dragFrame.current!.flush();
    clearDropBox();
    drag.current = null; event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const box = !cancelled && returnTarget({ x: event.clientX, y: event.clientY });
    if (box && world.returnHeld(current.id)) { refresh(); const toy = items.find(item => item.id === current.id); if (toy) onExperience?.(toy.kind, "tidied"); onReturned?.(); logActivity("ui.click", { target: "companion-toy-return" }); }
    else { world.drop(current.id, performance.now(), cancelled ? { x: 0, y: 0 } : current.moved ? current.velocity : { x: 35, y: -130 }); if (!cancelled) logActivity("ui.click", { target: "companion-toy-drop" }); }
    paint(); onActivity(true);
  };
  return <div className="vc-toys" aria-label="빅타민 장난감" data-companion-toys="" hidden={hidden}>
    {items.map(toy => <button key={toy.id} ref={node => { if (node) { nodes.current.set(toy.id, node); paint(); } else { const previous = nodes.current.get(toy.id); if (previous) itemAnchors.current!.clear(previous); nodes.current.delete(toy.id); } }} className="vc-toy" data-companion-toy="" data-toy-id={toy.id} data-activity-manual="" data-act="companion-toy-grab" aria-label={COMPANION_TOY_NAMES[toy.kind] + " 잡기"} disabled={blocked} type="button"
      onPointerDown={event => {
        if (blockedRef.current || drag.current || event.button !== 0) return;
        const position = grab(toy.id); if (!position) return;
        pendingPlays.current.delete(toy.id); pendingCarriedPlays.current.delete(toy.id); event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
        const point = { x: event.clientX, y: event.clientY };
        drag.current = { id: toy.id, pointer: event.pointerId, node: event.currentTarget, moved: false, origin: point, offset: { x: point.x - position.x, y: point.y - position.y }, last: point, time: performance.now(), velocity: { x: 0, y: 0 } };
        paint(toy.id); logActivity("ui.click", { target: "companion-toy-grab" }); onActivity(true);
      }}
      onPointerMove={event => {
        if (blockedRef.current) { clearDropBox(); return; }
        const current = drag.current; if (!current || current.pointer !== event.pointerId) return; event.stopPropagation();
        const now = performance.now(), dt = Math.max(8, now - current.time), point = { x: event.clientX, y: event.clientY };
        current.moved ||= Math.hypot(point.x - current.origin.x, point.y - current.origin.y) > 6;
        current.velocity = { x: (point.x - current.last.x) / dt * 1000, y: (point.y - current.last.y) / dt * 1000 }; current.last = point; current.time = now;
        if (current.moved) world.drag(toy.id, { x: point.x - current.offset.x, y: point.y - current.offset.y });
        dragFrame.current!.queue(() => {
          if (drag.current !== current || blockedRef.current) return;
          // A high-rate captured pointer still measures the box only once on
          // the existing latest-input frame, alongside the actual toy paint.
          paintDropBox(current.last);
          if (current.moved) paint(toy.id);
        });
      }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onKeyDown={event => {
        if (blockedRef.current || !["Enter", " ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape"].includes(event.key)) return;
        let current = world.items().find(item => item.id === toy.id); if (!current) return;
        if (event.key === "Escape" && !current.held) return;
        // Like food, this native control owns only its supported keys. In
        // particular arrows must not also navigate the calendar's month.
        event.preventDefault(); event.stopPropagation();
        const pointer = drag.current;
        if (pointer?.id === toy.id) {
          dragFrame.current!.cancel(); drag.current = null; clearDropBox();
          if (pointer.node.hasPointerCapture(pointer.pointer)) pointer.node.releasePointerCapture(pointer.pointer);
        }
        pendingPlays.current.delete(toy.id);
        pendingCarriedPlays.current.delete(toy.id);
        if (["Enter", " "].includes(event.key)) {
          const ok = current.held ? world.drop(toy.id, performance.now(), { x: 20, y: -100 }) : Boolean(grab(toy.id));
          if (ok) { logActivity("ui.click", { target: current.held ? "companion-toy-drop" : "companion-toy-grab" }); onActivity(true); paint(); }
        } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          if (!current.held) { const grabbed = grab(toy.id); if (!grabbed) return; current = grabbed; logActivity("ui.click", { target: "companion-toy-grab" }); }
          if (world.drag(toy.id, { x: current.x + (event.key === "ArrowRight" ? 16 : event.key === "ArrowLeft" ? -16 : 0), y: current.y + (event.key === "ArrowDown" ? 16 : event.key === "ArrowUp" ? -16 : 0) })) { onActivity(true); paint(); }
        } else if (event.key === "Escape" && current.held) {
          if (world.drop(toy.id, performance.now())) { logActivity("ui.click", { target: "companion-toy-drop" }); onActivity(true); paint(); }
        }
      }}><CompanionToyArt kind={toy.kind} /></button>)}
  </div>;
});
