"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

type Visit = { month: string; host: HTMLElement; x: number; y: number; arrivedX: number; arrivedY: number; interrupted: boolean };

/** An explicit visit to the in-flow room owns only its own scroll/focus.
 * Geometry notifications are event-driven; no idle animation loop is added. */
export function useHomeShelf({ active, expanded, monthKey, host, launcher, room, setExpanded }: {
  active: boolean; expanded: boolean; monthKey: string; host: HTMLElement | null;
  launcher: RefObject<HTMLButtonElement | null>; room: RefObject<HTMLDivElement | null>;
  setExpanded: (expanded: boolean) => void;
}) {
  const intent = useRef<"open" | "close" | null>(null);
  const visit = useRef<Visit | null>(null);
  const departure = useRef<{ x: number; y: number } | null>(null);
  const restore = useRef<{ x: number; y: number } | null>(null);
  const open = useCallback(() => {
    departure.current = { x: window.scrollX, y: window.scrollY };
    intent.current = "open"; setExpanded(true);
  }, [setExpanded]);
  const close = useCallback(() => {
    const previous = visit.current;
    // Decide before removing layout space: native scroll anchoring and the
    // shorter document's scroll clamp are not evidence of user navigation.
    restore.current = previous && !previous.interrupted && previous.month === monthKey && previous.host === host &&
      Math.abs(window.scrollX - previous.arrivedX) < 2 && Math.abs(window.scrollY - previous.arrivedY) < 2 ? { x: previous.x, y: previous.y } : null;
    intent.current = "close"; setExpanded(false);
  }, [setExpanded, host, monthKey]);

  useLayoutEffect(() => {
    if (!active || !host) { visit.current = null; intent.current = null; departure.current = null; restore.current = null; return; }
    if (expanded && intent.current === "open") {
      const before = departure.current ?? { x: window.scrollX, y: window.scrollY };
      const page = host.closest(".studio-shell,.poster-page");
      const inset = Math.max(0, ...[...(page?.querySelectorAll<HTMLElement>(".studio-topbar,.m-topstick,.agenda-header") ?? [])].map(header => {
        const style = getComputedStyle(header), rect = header.getBoundingClientRect();
        return (style.position === "sticky" || style.position === "fixed") && rect.top <= 1 && rect.bottom > 0 ? rect.bottom : 0;
      }));
      const bounds = room.current?.getBoundingClientRect();
      if (bounds && (bounds.top < inset + 12 || bounds.bottom > window.innerHeight - 12)) {
        room.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        const arrived = room.current?.getBoundingClientRect();
        if (arrived && arrived.top < inset + 12) window.scrollBy({ top: arrived.top - inset - 12, behavior: "instant" });
      }
      visit.current = { month: monthKey, host, ...before, arrivedX: window.scrollX, arrivedY: window.scrollY, interrupted: false };
      room.current?.querySelector<HTMLButtonElement>('[data-home-action="fold"]')?.focus({ preventScroll: true });
    } else if (!expanded && intent.current === "close") {
      // React has already removed the shelf's reserved height here. Never
      // pull a reader back after wheel/key/touch or a different document.
      if (restore.current) window.scrollTo({ left: restore.current.x, top: restore.current.y, behavior: "instant" });
      launcher.current?.focus({ preventScroll: true });
      visit.current = null;
    }
    intent.current = null; departure.current = null; restore.current = null;
  }, [active, expanded, host, monthKey, launcher, room]);

  useLayoutEffect(() => {
    if (!active || !expanded) return;
    const interrupt = () => { if (visit.current) visit.current.interrupted = true; };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof Element && event.target.closest('button,input,textarea,select,[contenteditable="true"],[role="button"]'))) return;
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) interrupt();
    };
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !room.current?.contains(event.target) && !launcher.current?.contains(event.target)) interrupt();
    };
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchmove", interrupt, { passive: true });
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", pointer);
    return () => { window.removeEventListener("wheel", interrupt); window.removeEventListener("touchmove", interrupt); document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", pointer); };
  }, [active, expanded, launcher, room]);

  useLayoutEffect(() => {
    if (!active || !expanded || !host) return;
    let frame = 0, last = "";
    const measure = () => {
      frame = 0;
      const rect = room.current?.getBoundingClientRect();
      if (!rect) return;
      const next = [rect.left, rect.top, rect.width, rect.height].map(value => Math.round(value * 10)).join(":");
      if (last === next) return;
      last = next;
      window.dispatchEvent(new Event("vic:companion-home"));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(queue); observer.observe(host);
    window.addEventListener("resize", queue, { passive: true });
    window.addEventListener("vic:side-panel", queue); window.addEventListener("vic:panel-section", queue);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", queue); window.removeEventListener("vic:side-panel", queue); window.removeEventListener("vic:panel-section", queue); };
  }, [active, expanded, host, room]);
  return { open, close };
}
