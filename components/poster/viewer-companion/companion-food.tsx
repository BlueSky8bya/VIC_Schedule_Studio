"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CompanionFood as Food, Platform } from "@/lib/ui/viewer-companion/brain";
import { MAX_COMPANION_FOOD, placeCompanionFood, reconcileCompanionFood } from "@/lib/ui/viewer-companion/food";
import { CompanionFruit } from "./companion-fruit";

export type CompanionFoodControl = {
  spawn: (kind: Food["kind"], point: { x: number; y: number }) => void;
  foods: () => readonly Food[];
  consume: (id: string) => boolean;
  nibble: (id?: string, progress?: number) => void;
  sync: (platforms: readonly Platform[]) => void;
  pause: (paused: boolean) => void;
  clear: () => void;
};
type Props = { enabled: boolean; blocked: boolean; monthKey: string; returnFocus: () => void };
const names = { apple: "사과", lemon: "레몬" };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Three transient, device-only snacks. Selection provides a click/keyboard
 * alternative to dragging. Captured placement owns its entire resulting click,
 * including a long press, so feeding can never vote or open the card below. */
export const CompanionFood = forwardRef<CompanionFoodControl, Props>(function CompanionFood({ enabled, blocked, monthKey, returnFocus }, ref) {
  const [foods, setFoods] = useState<Food[]>([]), [selected, setSelected] = useState<string | null>(null), [paused, setPaused] = useState(blocked);
  const [message, setMessage] = useState("");
  const current = useRef<Food[]>([]), selection = useRef<string | null>(null), platforms = useRef<readonly Platform[]>([]), layer = useRef<HTMLDivElement>(null);
  const serial = useRef(0), dragging = useRef<{ id: string; pointer: number; node: HTMLButtonElement; x: number; y: number; moved: boolean } | null>(null);
  const update = useCallback((next: Food[]) => { current.current = next; setFoods(next); }, []);
  const choose = useCallback((id: string | null) => { selection.current = id; setSelected(id); }, []);
  const release = useCallback((settle = false) => {
    const drag = dragging.current; dragging.current = null;
    if (drag) { if (settle) update(current.current.map(food => food.id === drag.id ? placeCompanionFood(food, food, platforms.current) : food));
      if (drag.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer);
    }
  }, [update]);
  const settleSelection = useCallback(() => { if (selection.current) update(current.current.map(food => food.id === selection.current ? placeCompanionFood(food, food, platforms.current) : food)); choose(null); }, [choose, update]);
  useImperativeHandle(ref, () => ({
    spawn(kind, point) {
      if (!enabled || blocked || paused) return;
      if (current.current.length >= MAX_COMPANION_FOOD) { setMessage("밥은 세 개까지 놓을 수 있어요. 남은 밥부터 먹게 기다려 주세요."); return; }
      const food: Food = { id: `snack-${++serial.current}`, kind, x: clamp(point.x, 24, innerWidth - 24), y: clamp(point.y, 48, innerHeight - 24) };
      update([...current.current, food]); choose(food.id); setMessage(`${names[kind]} 놓을 곳을 눌러 주세요. 방향키와 Enter로도 놓을 수 있어요.`);
    },
    foods: () => current.current.filter(food => food.id !== selection.current && food.id !== dragging.current?.id),
    consume(id) {
      if (selection.current === id || dragging.current?.id === id || !current.current.some(food => food.id === id)) return false;
      if ((document.activeElement as HTMLElement | null)?.dataset.food === id) returnFocus();
      update(current.current.filter(food => food.id !== id)); setMessage("빅타민이 밥을 맛있게 먹었어요."); return true;
    },
    nibble(id, progress = 0) {
      for (const node of layer.current?.querySelectorAll<HTMLElement>(".vc-food") ?? []) node.style.setProperty("--vc-nibble", String(node.dataset.food === id ? Math.max(.35, 1 - progress * .65) : 1));
    },
    sync(next) {
      platforms.current = next;
      const updated = current.current.map(food => food.id === selection.current || food.id === dragging.current?.id ? food : reconcileCompanionFood(food, next));
      if (JSON.stringify(updated) !== JSON.stringify(current.current)) update(updated);
    },
    pause(next) { setPaused(next); if (next) { release(true); settleSelection(); } },
    clear() { release(); choose(null); update([]); setMessage("남은 밥을 치웠어요."); },
  }));
  // Focus in the commit, before another key can reach the calendar's month
  // shortcuts. A deferred animation-frame focus left the actor owning arrows.
  useLayoutEffect(() => { if (selected) layer.current?.querySelector<HTMLButtonElement>(`[data-food="${selected}"]`)?.focus({ preventScroll: true }); }, [selected]);
  useEffect(() => { release(); choose(null); update([]); setMessage(""); }, [monthKey, enabled, release, choose, update]);
  useEffect(() => { if (blocked) { release(true); settleSelection(); } setPaused(blocked); }, [blocked, release, settleSelection]);
  useEffect(() => () => release(), [release]);

  useEffect(() => {
    if (!enabled || blocked || paused || !selected) return;
    let ownsClick = false, pointer: number | null = null, timeout: ReturnType<typeof setTimeout> | undefined;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || layer.current?.contains(event.target as Node)) return;
      const food = current.current.find(food => food.id === selection.current); if (!food) return;
      event.preventDefault(); event.stopImmediatePropagation(); ownsClick = true; pointer = event.pointerId; clearTimeout(timeout);
      update(current.current.map(item => item.id === food.id ? placeCompanionFood(item, { x: event.clientX, y: event.clientY }, platforms.current) : item));
      // Keep the capture effect alive through pointerup/click, rather than
      // immediately unmounting the guard when the selection is cleared.
      selection.current = null; setMessage(`${names[food.kind]}를 놓았어요. 배고프면 빅타민이 찾아와요.`);
    };
    const finish = () => { setSelected(null); };
    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      pointer = null; timeout = setTimeout(() => { ownsClick = false; finish(); }, 500);
    };
    const click = (event: MouseEvent) => {
      if (!ownsClick) return;
      event.preventDefault(); event.stopImmediatePropagation(); ownsClick = false; clearTimeout(timeout); finish();
    };
    document.addEventListener("pointerdown", down, true); document.addEventListener("pointerup", up, true); document.addEventListener("pointercancel", up, true); document.addEventListener("click", click, true);
    return () => { clearTimeout(timeout); document.removeEventListener("pointerdown", down, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", up, true); document.removeEventListener("click", click, true); };
  }, [enabled, blocked, paused, selected, update]);

  if (!enabled) return null;
  const drop = (id: string) => {
    update(current.current.map(food => food.id === id ? placeCompanionFood(food, food, platforms.current) : food)); choose(null); setMessage("밥을 놓았어요. 배고프면 빅타민이 찾아와요.");
  };
  return <div className="vc-food-layer" ref={layer} hidden={blocked || paused} data-sfx="off">
    {foods.map(food => <button type="button" className="vc-food" key={food.id} data-food={food.id} data-kind={food.kind} data-selected={selected === food.id ? "" : undefined}
      style={{ left: food.x, top: food.y }} aria-label={`빅타민 밥 ${names[food.kind]} · 잡아서 옮기기`} aria-describedby="vc-food-help"
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); choose(null); dragging.current = { id: food.id, pointer: event.pointerId, node: event.currentTarget, x: event.clientX, y: event.clientY, moved: false }; }}
      onPointerMove={event => { const drag = dragging.current; if (drag?.id !== food.id || drag.pointer !== event.pointerId) return; if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) drag.moved = true; if (drag.moved) update(current.current.map(item => item.id === food.id ? { ...item, platformId: undefined, x: clamp(event.clientX, 24, innerWidth - 24), y: clamp(event.clientY, 48, innerHeight - 24) } : item)); }}
      onPointerUp={event => { const drag = dragging.current; if (drag?.pointer !== event.pointerId) return; event.stopPropagation(); release(); if (drag.moved) drop(food.id); else { choose(food.id); setMessage("밥 놓을 곳을 눌러 주세요."); } }}
      onPointerCancel={() => { release(); drop(food.id); }}
      onClick={event => { event.stopPropagation(); }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Escape", "Delete", "Backspace"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Escape") { drop(food.id); return; }
        if (["Delete", "Backspace"].includes(event.key)) { returnFocus(); update(current.current.filter(item => item.id !== food.id)); choose(null); setMessage("밥을 치웠어요."); return; }
        if (["Enter", " "].includes(event.key)) { if (!event.repeat) { if (selection.current === food.id) drop(food.id); else choose(food.id); } return; }
        choose(food.id); update(current.current.map(item => item.id === food.id ? { ...item, platformId: undefined, x: clamp(item.x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), 24, innerWidth - 24), y: clamp(item.y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), 48, innerHeight - 24) } : item));
      }}><span aria-hidden="true"><CompanionFruit kind={food.kind} /></span></button>)}
    {selected ? <span className="vc-food-hint">밥 놓을 곳을 눌러 주세요 <kbd>Esc</kbd> 놓기</span> : null}
    <span className="sr-only" id="vc-food-help">밥을 누른 뒤 놓을 곳을 누르거나 드래그로 옮기기. Enter로 집고 방향키로 옮긴 뒤 Enter로 놓기. Delete로 치우기.</span>
    <span className="sr-only" role="status">{message}</span>
  </div>;
});
