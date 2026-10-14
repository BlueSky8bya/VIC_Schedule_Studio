"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { advanceBrain, commitAction, createBrain, getAction, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { observeCompanionPlatforms } from "@/lib/ui/viewer-companion/geometry";
import { acquireCompanionAmbientPreview } from "@/lib/ui/viewer-companion/ambient-preview";
import { gfxMode } from "@/lib/ui/gfx";
import "./viewer-companion.css";

type Props = { root: RefObject<HTMLDivElement | null>; preferences: CompanionPreferences; blocked: boolean; agenda: boolean; monthKey: string; reduced: boolean };
type Control = { pet: () => void; place: () => void; rest: () => void };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const sizes = { small: 60, normal: 76, large: 92 };

/** One optional local creature. The only sensed schedule data is geometry.
 * Imperative transform/frame writes never re-render the calendar on a tick. */
export default function ViewerCompanion({ root, preferences, blocked, agenda, monthKey, reduced }: Props) {
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const control = useRef<Control | null>(null), brain = useRef(createBrain(performance.now()));
  const lastPose = useRef<{ x: number; y: number; monthKey: string } | null>(null);
  const menuOpen = useRef(false);
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  const locateMenu = () => {
    const el = body.current; if (!el) return;
    const rect = el.getBoundingClientRect(), height = 192;
    el.style.setProperty("--vc-menu-left", `${clamp(rect.left, 8, innerWidth - 168) - rect.left}px`);
    const top = rect.top > height + 8 ? rect.top - height : Math.min(innerHeight - height - 8, rect.bottom + 8);
    el.style.setProperty("--vc-menu-top", `${Math.max(8, top) - rect.top}px`);
  };
  useEffect(() => { setReady(true); }, []);
  useEffect(() => { menuOpen.current = menu; }, [menu]);

  useEffect(() => {
    const el = body.current, button = actor.current, page = root.current;
    if (!ready || !el || !button || !page || !preferences.enabled) return;
    if (blocked) { el.hidden = true; menuOpen.current = false; setMenu(false); return; }
    const saved = lastPose.current?.monthKey === monthKey ? lastPose.current : null;
    let platforms: Platform[] = [], x = saved?.x ?? innerWidth * .68, y = saved?.y ?? innerHeight - 18, support = "";
    let raf = 0, timer: ReturnType<typeof setTimeout> | undefined, lastPaint = 0, lastTick = performance.now(), stopped = false, sleeping = false;
    let pause = true, started = false, nextDecision = 0, releaseAmbient = () => {};
    let action: CompanionAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, consumePlacementClick = false;
    let placementPointer: number | null = null;
    let clickGuard: ReturnType<typeof setTimeout> | undefined;
    let pressed: { id: number; x: number; y: number; at: number; dx: number; dy: number; lastX: number; direction: number; strokes: number; dragged: boolean; petted: boolean } | null = null;
    const size = sizes[preferences.size];
    const effective = reduced ? { ...preferences, roam: false, jump: false, ambientPrank: false } : preferences;
    el.style.setProperty("--vc-size", `${size}px`);
    const paint = (row: number, frame: number, status: string) => {
      el.style.transform = `translate3d(${Math.round(x - size / 2)}px,${Math.round(y - size)}px,0)`;
      el.style.setProperty("--vc-column", `${clamp(Math.floor(frame), 0, 15) / 15 * 100}%`);
      el.style.setProperty("--vc-row", `${row / 15 * 100}%`);
      el.dataset.state = status;
      el.dataset.platform = support;
    };
    const clearAction = () => { action = null; sleeping = false; releaseAmbient(); releaseAmbient = () => {}; el.removeAttribute("data-hidden"); if (effect.current) { effect.current.textContent = ""; effect.current.removeAttribute("style"); } };
    const settle = (point: { x: number; y: number }) => {
      const below = platforms.filter(p => p.y >= point.y - 12 && point.x >= p.x - 10 && point.x <= p.x + p.width + 10);
      const p = nearestPlatform(point, below) ?? platforms.find(p => p.kind === "floor");
      const target = p ? { x: platformLandingX(p, point.x), y: p.y, platformId: p.id } : { x: point.x, y: innerHeight - 18 };
      origin = { x, y }; action = { kind: "jump", target, duration: 650 }; began = performance.now(); total = 650; travel = -1;
      if (reduced) { x = target.x; y = target.y; support = target.platformId ?? ""; clearAction(); }
      brain.current = recordCompanionEvent(brain.current, "landed");
    };
    const affection = () => {
      if (!preferences.petting) return;
      clearAction(); petUntil = performance.now() + (reduced ? 650 : 1500);
      brain.current = recordCompanionEvent(brain.current, "petted");
      nextDecision = petUntil + 500;
    };
    control.current = {
      pet: affection,
      place: () => { if (preferences.drag) { clearAction(); placing = true; el.dataset.placing = ""; } },
      rest: () => { if (preferences.sleep) { clearAction(); action = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000 }; began = performance.now(); total = 12000; } }
    };
    const launch = (next: CompanionAction, now: number) => {
      clearAction(); action = next; origin = { x, y }; began = now; total = next.duration; travel = 0;
      brain.current = commitAction(brain.current, next, now);
      if (next.kind === "heart" || next.kind === "hide") {
        const speed = preferences.speed === "relaxed" ? 45 : preferences.speed === "lively" ? 100 : 70;
        travel = Math.abs(next.target.x - x) / speed * 1000;
        total += travel;
      }
      if (next.kind === "jump") {
        const g = 1100, impulse = Math.sqrt(2 * g * 140), dy = next.target.y - y;
        travel = (impulse + Math.sqrt(Math.max(0, impulse * impulse + 2 * g * dy))) / g * 1000;
        total = 180 + travel + 260;
      }
    };
    const tick = (now: number) => {
      if (stopped || pause) return;
      const elapsed = Math.min(100, Math.max(0, now - lastTick)); lastTick = now;
      brain.current = advanceBrain(brain.current, elapsed);
      if (menuOpen.current || placing) { paint(1, Math.floor(now / 160) % 16, placing ? "placing" : "look"); schedule(); return; }
      if (pressed || keyboardHeld) {
        const happy = pressed?.petted;
        paint(happy ? 9 : pressed && now - pressed.at < 250 ? 7 : 8, Math.floor(now / (reduced ? 500 : 80)) % 16, happy ? "petted" : "held");
        schedule(); return;
      }
      if (now < petUntil) { paint(9, Math.floor((1500 - petUntil + now) / 95) % 16, "petted"); schedule(); return; }
      if (!action && now >= nextDecision) launch(getAction(brain.current, { x, y, platformId: support, platforms, width: innerWidth, height: innerHeight, ambientAvailable: true }, effective, now), now);
      let row = 0, frame = Math.floor(now / 150) % 16, status = "idle";
      if (action) {
        const age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        if (action.kind === "walk") { x = lerp(origin.x, action.target.x, ease(p)); row = 2; frame = Math.floor(age / 75) % 16; }
        else if (action.kind === "jump") {
          if (travel === -1) { x = lerp(origin.x, action.target.x, p); y = lerp(origin.y, action.target.y, p * p); row = p < .8 ? 5 : 6; frame = Math.floor(p * 15); }
          else if (age < 180) { row = 3; frame = age / 180 * 15; }
          else if (age < 180 + travel) {
            const t = (age - 180) / 1000, progress = clamp((age - 180) / travel, 0, 1);
            x = lerp(origin.x, action.target.x, progress); y = origin.y - Math.sqrt(2 * 1100 * 140) * t + .5 * 1100 * t * t;
            row = t < Math.sqrt(2 * 1100 * 140) / 1100 ? 4 : 5; frame = progress * 15;
          } else { x = action.target.x; y = action.target.y; row = 6; frame = (age - 180 - travel) / 260 * 15; }
        } else if (action.kind === "sleep") {
          sleeping = true; row = age < 1000 ? 10 : total - age < 1100 ? 12 : 11;
          frame = row === 10 ? age / 1000 * 15 : row === 12 ? (age - total + 1100) / 1100 * 15 : Math.floor(age / 200) % 16;
          if (effect.current) effect.current.textContent = row === 11 ? "z Z" : "";
        } else if (action.kind === "heart" || action.kind === "hide") {
          if (age < travel) { x = lerp(origin.x, action.target.x, age / Math.max(1, travel)); row = 2; frame = Math.floor(age / 75) % 16; }
          else if (action.kind === "heart") {
            const t = (age - travel) / action.duration; row = 13; frame = t * 15;
            y = origin.y + Math.max(0, Math.sin(t * Math.PI * 2)) * (reduced ? 0 : 18);
            if (effect.current) {
              effect.current.textContent = t > .25 && t < .85 ? "♥" : "";
              effect.current.style.setProperty("--vc-effect", `${-t * 25}px`);
              if (action.effectPoint) { effect.current.style.left = `${action.effectPoint.x - x + size / 2}px`; effect.current.style.top = `${action.effectPoint.y - y + size}px`; }
            }
          } else {
            const t = (age - travel) / action.duration; row = t < .15 ? 14 : t > .82 ? 15 : 14;
            frame = t < .15 ? t / .15 * 15 : t > .82 ? (t - .82) / .18 * 15 : 15;
            if (!el.hasAttribute("data-hidden") && t > .15 && t < .82) { el.dataset.hidden = ""; if (!agenda) releaseAmbient = acquireCompanionAmbientPreview(); }
            if (t > .82) { el.removeAttribute("data-hidden"); releaseAmbient(); }
            if (effect.current) effect.current.textContent = t > .15 && t < .82 ? "⋯ 🍂" : "";
          }
        } else if (action.kind === "look") { row = 1; frame = p * 15; }
        if (p >= 1) {
          const rested = sleeping;
          if (["walk", "jump", "heart", "hide"].includes(action.kind)) { x = action.target.x; y = action.target.y; support = action.target.platformId ?? support; }
          clearAction(); if (rested) brain.current = recordCompanionEvent(brain.current, "rested"); nextDecision = now + 450;
        }
      }
      x = clamp(x, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y, size + 8, innerHeight - 12);
      paint(row, frame, status); schedule();
    };
    const schedule = () => {
      if (stopped || pause) return;
      if (reduced) timer = setTimeout(() => tick(performance.now()), 400);
      else raf = requestAnimationFrame(now => { const interval = gfxMode() === "full" ? 1000 / 30 : 1000 / 12; if (now - lastPaint >= interval) { lastPaint = now; tick(now); } else schedule(); });
    };
    const sync = () => {
      const html = document.documentElement;
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause");
      if (next === pause && started) return;
      started = true; pause = next; el.hidden = next;
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now();
      if (pause) { clearAction(); if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id); pressed = null; keyboardHeld = false; placing = false; delete el.dataset.placing; menuOpen.current = false; setMenu(false); }
      else { nextDecision = performance.now() + 600; schedule(); }
    };
    const down = (event: PointerEvent) => {
      if (pause || event.button !== 0 || (!preferences.drag && !preferences.petting)) return;
      event.preventDefault(); event.stopPropagation(); button.focus({ preventScroll: true }); button.setPointerCapture(event.pointerId);
      clearAction(); pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dx: event.clientX - x, dy: event.clientY - y, lastX: event.clientX, direction: 0, strokes: 0, dragged: false, petted: false };
    };
    const move = (event: PointerEvent) => {
      if (!pressed || pressed.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y), delta = event.clientX - pressed.lastX;
      if (preferences.petting && !pressed.dragged && performance.now() - pressed.at > 180 && Math.abs(event.clientY - pressed.y) < 24 && Math.abs(delta) > 2) {
        const direction = Math.sign(delta); if (pressed.direction && direction !== pressed.direction) pressed.strokes++;
        pressed.direction = direction;
        if (pressed.strokes >= 2) { if (!pressed.petted) affection(); pressed.petted = true; petUntil = performance.now() + 1000; }
      }
      pressed.lastX = event.clientX;
      if (preferences.drag && !pressed.petted && distance > 32) {
        pressed.dragged = true; x = clamp(event.clientX - pressed.dx, size / 2, innerWidth - size / 2); y = clamp(event.clientY - pressed.dy, size, innerHeight - 12);
      }
    };
    const up = (event: PointerEvent) => {
      if (!pressed || pressed.id !== event.pointerId) return;
      const held = pressed; pressed = null;
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (held.dragged) { brain.current = recordCompanionEvent(brain.current, "dragged"); settle({ x, y }); }
      else if (event.type !== "pointercancel") affection();
    };
    const key = (event: KeyboardEvent) => {
      const owns = event.key === "Escape" || event.key === "Enter" && preferences.petting || event.key === " " && preferences.drag || keyboardHeld && event.key.startsWith("Arrow");
      if (owns) { event.preventDefault(); event.stopPropagation(); }
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      if (event.key === "Enter" && preferences.petting) { event.preventDefault(); affection(); }
      else if (event.key === " " && preferences.drag) { event.preventDefault(); clearAction(); keyboardHeld = !keyboardHeld; if (!keyboardHeld) settle({ x, y }); }
      else if (event.key === "Escape") { event.preventDefault(); keyboardHeld = false; placing = false; delete el.dataset.placing; settle({ x, y }); }
      else if (keyboardHeld && event.key.startsWith("Arrow")) { event.preventDefault(); x = clamp(x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), size / 2, innerWidth - size / 2); y = clamp(y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), size, innerHeight - 12); }
    };
    const place = (event: PointerEvent) => {
      if (!placing || el.contains(event.target as Node)) return;
      event.preventDefault(); event.stopPropagation(); placing = false; delete el.dataset.placing;
      // pointerdown cancellation alone does not cancel the independent click:
      // consume this placement's click before a real card/heart can receive it.
      consumePlacementClick = true; placementPointer = event.pointerId; clearTimeout(clickGuard);
      x = clamp(event.clientX, size / 2, innerWidth - size / 2); y = clamp(event.clientY, size, innerHeight - 12); settle({ x, y });
    };
    const placementReleased = (event: PointerEvent) => {
      if (placementPointer !== event.pointerId) return;
      // Keep ownership for an arbitrarily long press; the fallback only starts
      // after release/cancel if the browser does not synthesize a click.
      placementPointer = null; clearTimeout(clickGuard); clickGuard = setTimeout(() => { consumePlacementClick = false; }, 500);
    };
    const click = (event: MouseEvent) => { if (consumePlacementClick) { event.preventDefault(); event.stopImmediatePropagation(); consumePlacementClick = false; placementPointer = null; clearTimeout(clickGuard); } };
    const offGeometry = observeCompanionPlatforms(page, next => {
      const previous = platforms;
      // A visible ledge must leave room for this configured sprite above it.
      // Use the same foot boundary as painting/dragging, including after scroll.
      platforms = next.filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      if (!support) {
        const p = nearestPlatform({ x, y: saved?.y ?? innerHeight * .65 }, saved ? platforms : platforms.filter(p => p.kind !== "floor")) ?? platforms[0];
        if (p) { x = platformLandingX(p, x); y = p.y; support = p.id; }
      } else if (!pressed && !keyboardHeld) {
        const p = platforms.find(p => p.id === support);
        const target = action?.target.platformId;
        const changed = (id: string) => {
          const before = previous.find(p => p.id === id), after = platforms.find(p => p.id === id);
          return !before || !after || Math.abs(before.x - after.x) > 1 || Math.abs(before.y - after.y) > 1 || Math.abs(before.width - after.width) > 1;
        };
        // Scroll/resize/deletion invalidates a ballistic destination. Cancel
        // the old journey and land on current visible geometry, never thin air.
        if (!p || action && (changed(support) || target && changed(target))) { clearAction(); settle({ x, y }); }
        else if (!action) { x = platformLandingX(p, x); y = p.y; }
      }
      if (!pressed && !keyboardHeld) paint(0, 0, "idle");
    });
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase", "data-ambient-pause", "data-gfx"] });
    observer.observe(page, { attributes: true, attributeFilter: ["inert"] });
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", place, true); document.addEventListener("click", click, true);
    document.addEventListener("pointerup", placementReleased, true); document.addEventListener("pointercancel", placementReleased, true);
    button.addEventListener("pointerdown", down); button.addEventListener("pointermove", move); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("keydown", key);
    sync();
    return () => {
      lastPose.current = { x, y, monthKey };
      stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearAction(); control.current = null; observer.disconnect(); offGeometry();
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); document.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
    };
  }, [ready, root, preferences, blocked, agenda, monthKey, reduced]);

  if (!ready) return null;
  const closeMenu = () => { menuOpen.current = false; setMenu(false); actor.current?.focus({ preventScroll: true }); };
  const act = (kind: keyof Control) => { closeMenu(); control.current?.[kind](); };
  return createPortal(<div className="vc-companion" ref={body} hidden data-sfx="off">
    <button className="vc-actor" ref={actor} type="button" data-sfx="off" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape"><span className="vc-sprite" aria-hidden="true" /><span className="vc-effect" ref={effect} aria-hidden="true" /></button>
    <span className="sr-only" id="vc-help">Enter로 쓰다듬기. 스페이스로 집고 화살표로 이동한 뒤 스페이스나 Escape로 놓기. 메뉴의 옮기기로 원하는 곳을 눌러도 돼요.</span>
    <button className="vc-menu-toggle" aria-label="빅타민 메뉴" aria-expanded={menu} type="button" onClick={() => { locateMenu(); menuOpen.current = !menu; setMenu(!menu); }}>···</button>
    {menu ? <div className="vc-menu" role="group" aria-label="빅타민과 놀기" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); } }}>
      {preferences.petting ? <button type="button" onClick={() => act("pet")}>쓰다듬기</button> : null}
      {preferences.drag ? <button type="button" onClick={() => act("place")}>옮길 곳 고르기</button> : null}
      {preferences.sleep ? <button type="button" onClick={() => act("rest")}>잠깐 쉬기</button> : null}
      <button type="button" onClick={closeMenu}>닫기</button>
    </div> : null}
  </div>, document.body);
}
