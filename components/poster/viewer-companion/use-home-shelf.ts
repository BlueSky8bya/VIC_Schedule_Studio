"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { premiereViewportBounds } from "@/lib/ui/premiere/panel-departure";

/** One compact room below its real chrome entry. It reserves no calendar row
 * and never changes the reader's scroll position. Layout work is event-driven. */
export function useHomeShelf({ active, expanded, monthKey, host, launcher, room, setExpanded }: {
  active: boolean; expanded: boolean; monthKey: string; host: HTMLElement | null;
  launcher: RefObject<HTMLButtonElement | null>; room: RefObject<HTMLDivElement | null>;
  setExpanded: (expanded: boolean) => void;
}) {
  const intent = useRef<"open" | "close" | null>(null);
  const previous = useRef<{ x: number; y: number } | null>(null);
  const open = useCallback(() => { intent.current = "open"; setExpanded(true); }, [setExpanded]);
  const close = useCallback(() => { intent.current = "close"; setExpanded(false); }, [setExpanded]);
  useLayoutEffect(() => {
    if (!active) { intent.current = null; return; }
    if (expanded && intent.current === "open") room.current?.querySelector<HTMLButtonElement>('[data-home-action="close"]')?.focus({ preventScroll: true });
    else if (!expanded && intent.current === "close") launcher.current?.focus({ preventScroll: true });
    intent.current = null;
  }, [active, expanded, launcher, room]);
  useLayoutEffect(() => {
    const holder = room.current, entry = launcher.current;
    if (!active || !expanded || !host || !holder || !entry) return;
    let frame = 0, last = "";
    const measure = () => {
      frame = 0;
      const viewport = premiereViewportBounds({ clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, visualViewport: window.visualViewport });
      const left = viewport.left + 12, top = viewport.top + 12, right = viewport.right - 12, bottom = viewport.bottom - 12;
      holder.style.setProperty("--vc-home-max-width", `${Math.max(1, right - left)}px`);
      holder.style.setProperty("--vc-home-max-height", `${Math.max(1, bottom - top)}px`);
      const box = holder.getBoundingClientRect(), anchor = entry.getBoundingClientRect();
      const visible = anchor.bottom > viewport.top && anchor.top < viewport.bottom && anchor.right > viewport.left && anchor.left < viewport.right;
      const target = visible ? { x: anchor.left, y: anchor.bottom + 8 } : previous.current ?? { x: left, y: top };
      if (visible && target.y + box.height > bottom && anchor.top - box.height - 8 >= top) target.y = anchor.top - box.height - 8;
      const x = Math.max(left, Math.min(target.x, right - box.width)), y = Math.max(top, Math.min(target.y, bottom - box.height));
      previous.current = { x, y };
      holder.style.setProperty("--vc-home-left", `${x.toFixed(2)}px`);
      holder.style.setProperty("--vc-home-top", `${y.toFixed(2)}px`);
      const next = [x, y, box.width, box.height].map(value => Math.round(value * 10)).join(":");
      if (last === next) return;
      last = next; window.dispatchEvent(new Event("vic:companion-home"));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(queue); observer.observe(holder); observer.observe(entry);
    // A sibling label can move this entry without resizing it (for example
    // the studio build-copy confirmation). Observe only its small chrome
    // group, rather than polling positions or watching the whole document.
    const group = entry.closest(".studio-left,.header-left") ?? entry.parentElement?.parentElement;
    const mutations = new MutationObserver(queue);
    if (group) { observer.observe(group); mutations.observe(group, { childList: true, characterData: true, subtree: true }); }
    // Hover/press transforms move the anchor without changing its layout box.
    // A finite transition end delivers its final position without idle polls.
    const entryEvents = ["pointerenter", "pointerleave", "pointerdown", "pointerup", "focus", "blur", "transitionend"] as const;
    for (const type of entryEvents) entry.addEventListener(type, queue);
    window.addEventListener("resize", queue, { passive: true }); window.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("vic:side-panel", queue); window.addEventListener("vic:panel-section", queue);
    window.visualViewport?.addEventListener("resize", queue, { passive: true }); window.visualViewport?.addEventListener("scroll", queue, { passive: true });
    measure();
    return () => { observer.disconnect(); mutations.disconnect(); for (const type of entryEvents) entry.removeEventListener(type, queue); cancelAnimationFrame(frame); window.removeEventListener("resize", queue); window.removeEventListener("scroll", queue, true); window.removeEventListener("vic:side-panel", queue); window.removeEventListener("vic:panel-section", queue); window.visualViewport?.removeEventListener("resize", queue); window.visualViewport?.removeEventListener("scroll", queue); };
  }, [active, expanded, host, monthKey, launcher, room]);
  return { open, close };
}
