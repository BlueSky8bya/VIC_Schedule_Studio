"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import { gfxMode } from "@/lib/ui/gfx";
import { syncedNow, subscribeClock } from "@/lib/ui/synced-clock";
import { PREMIERE_EASE } from "@/lib/ui/premiere/focus-motion";
import type { PremiereFrame } from "@/lib/ui/premiere/plan";

type Options = { frame: PremiereFrame; ready: boolean; reduced: boolean; root: RefObject<HTMLDivElement | null>; screen: RefObject<HTMLDivElement | null>; transfer: RefObject<HTMLDivElement | null>; portal: RefObject<HTMLDivElement | null> };

/** Finite presentation only. The existing clock/publication path keeps running.
 * One journey per opening; updates interrupt it rather than replaying it. */
export function usePremiereEntry({ frame, ready, reduced, root, screen, transfer, portal }: Options) {
  const latest = useRef(frame); latest.current = frame;
  const stop = useRef<() => void>(() => {});
  const captured = useRef("");
  const focused = frame.focused || frame.phase === "return";
  const returning = frame.phase === "return";
  const signature = frame.items.map(item => `${item.id}:${item.revealAt}:${item.state}`).sort().join("|");

  useLayoutEffect(() => {
    const el = screen.current, layer = transfer.current, stage = portal.current;
    if (!ready || !focused || reduced || !el || !layer || !stage) return;
    if (returning) {
      el.style.transition = `transform 520ms ${PREMIERE_EASE}, opacity 520ms ease`;
      el.style.transform = "translateY(14px) scale(.985)"; el.style.opacity = "0";
      return () => { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; };
    }
    const initial = latest.current, grade = gfxMode();
    if (initial.remainMs <= 22000 || initial.items.some(item => item.state === "released") || grade === "off" || grade === "soft") return;
    const entryEase = getComputedStyle(document.documentElement).getPropertyValue("--spring-smooth").trim() || PREMIERE_EASE;
    const plane = layer.querySelector<HTMLElement>(".pm-entry-plane");
    const faces = [...layer.querySelectorAll<HTMLElement>(".pm-card-transfer")].slice(0, grade === "lite" ? 2 : 8);
    if (!plane || !faces.length) return;
    const target = el.getBoundingClientRect();
    if (!target.width || !target.height) return;
    const center = { x: innerWidth / 2, y: innerHeight / 2 };
    const gather = grade === "lite" ? 1250 : 1700, merge = 200, expand = grade === "lite" ? 1050 : 1500;
    const total = gather + merge + expand;
    const timers: ReturnType<typeof setTimeout>[] = [];
    captured.current = initial.items.map(item => `${item.id}:${item.revealAt}:${item.state}`).sort().join("|");
    let ended = false;
    let offClock = () => {};
    const resize = new ResizeObserver(() => { const next = el.getBoundingClientRect(); if (Math.abs(next.width - target.width) > 2 || Math.abs(next.height - target.height) > 2) finish(); });
    const preferences = new MutationObserver(() => { if (gfxMode() !== grade || document.documentElement.hasAttribute("data-reduce-motion")) finish(); });
    const finish = () => {
      if (ended) return;
      ended = true; timers.forEach(clearTimeout); offClock(); resize.disconnect(); preferences.disconnect();
      window.removeEventListener("resize", finish); document.removeEventListener("visibilitychange", hidden);
      delete stage.dataset.pmEntering; delete stage.dataset.pmEntry;
      // Removing the morph must not restart the base screen fade from opacity0.
      el.dataset.pmEntered = "";
      delete el.dataset.pmMorph; el.style.removeProperty("--pm-entry-ms");
      delete layer.dataset.active; delete layer.dataset.phase;
      plane.removeAttribute("style");
      for (const face of faces) { delete face.dataset.active; face.removeAttribute("style"); }
    };
    const hidden = () => { if (document.hidden) finish(); };
    stop.current = finish;
    el.dataset.pmMorph = "card"; el.style.setProperty("--pm-entry-ms", `${total}ms`);
    stage.dataset.pmEntering = ""; stage.dataset.pmEntry = "gather";
    for (const control of stage.querySelectorAll<HTMLElement>("[data-pm-retreat],[data-pm-audience-control]")) { control.inert = true; control.setAttribute("aria-hidden", "true"); }
    layer.dataset.active = ""; layer.dataset.phase = "gather";
    let primary = { width: 160, height: 44 };
    const meeting: { face: HTMLElement; x: number; y: number; width: number; height: number }[] = [];
    faces.forEach((face, index) => {
      const sources = [...(root.current?.querySelectorAll<HTMLElement>(`[data-eventid="${face.dataset.pmCarrier}"]`) ?? [])]
        .map(source => source.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
        .sort((a, b) => {
          const visible = (r: DOMRect) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth ? 0 : 1;
          return visible(a) - visible(b) || Math.hypot(a.x + a.width / 2 - center.x, a.y + a.height / 2 - center.y) - Math.hypot(b.x + b.width / 2 - center.x, b.y + b.height / 2 - center.y);
        });
      const from = sources[0];
      const width = from?.width ?? 160, height = from?.height ?? 44;
      if (!index) primary = { width, height };
      // Keep individual cards legible near the center, then actually merge.
      const fanX = (index - (faces.length - 1) / 2) * Math.min(36, Math.max(0, (innerWidth - width - 24) / Math.max(1, faces.length - 1)));
      const fanY = faces.length > 1 ? (index % 2 ? 1 : -1) * Math.min(12, height / 3) : 0;
      meeting.push({ face, x: fanX, y: fanY, width, height });
      // All copies keep native source size until they meet. Linked segments of
      // one ID contribute once; offscreen cards enter from the nearest edge.
      const x = Math.max(width / 2 + 8, Math.min(innerWidth - width / 2 - 8, from ? from.x + width / 2 : center.x));
      const y = Math.max(64 + height / 2, Math.min(innerHeight - height / 2 - 20, from ? from.y + height / 2 : innerHeight - 80));
      Object.assign(face.style, { left: `${center.x + fanX - width / 2}px`, top: `${center.y + fanY - height / 2}px`, width: `${width}px`, height: `${height}px`, zIndex: String(20 - index) });
      face.dataset.active = "";
      flipSpring(face, `translate(${x - center.x - fanX}px,${y - center.y - fanY}px) rotate(${index ? (index % 2 ? -1 : 1) * Math.min(7, index * 2) : 0}deg)`, { ms: gather, easing: entryEase });
    });
    const fromPlane = `translate(${center.x - target.x - target.width / 2}px,${center.y - target.y - target.height / 2}px) scale(${primary.width / target.width},${primary.height / target.height})`;
    Object.assign(plane.style, { left: `${target.x}px`, top: `${target.y}px`, width: `${target.width}px`, height: `${target.height}px`, transformOrigin: "center" });
    plane.style.setProperty("--pm-expand-ms", `${expand}ms`);
    timers.push(setTimeout(() => {
      if (ended) return;
      stage.dataset.pmEntry = "merge"; layer.dataset.phase = "merge";
      for (const item of meeting) {
        Object.assign(item.face.style, { left: `${center.x - item.width / 2}px`, top: `${center.y - item.height / 2}px` });
        flipSpring(item.face, `translate(${item.x}px,${item.y}px)`, { ms: merge, easing: PREMIERE_EASE });
      }
    }, gather));
    timers.push(setTimeout(() => {
      if (ended) return;
      stage.dataset.pmEntry = "unfold"; layer.dataset.phase = "unfold";
      flipSpring(plane, fromPlane, { ms: expand, easing: entryEase });
    }, gather + merge));
    timers.push(setTimeout(finish, total));
    offClock = subscribeClock(() => { if (latest.current.target - syncedNow() <= 18000) finish(); });
    resize.observe(el);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-gfx", "data-reduce-motion"] });
    window.addEventListener("resize", finish); document.addEventListener("visibilitychange", hidden);
    return () => { finish(); captured.current = ""; stop.current = () => {}; };
  }, [ready, focused, returning, reduced, root, screen, transfer, portal]);

  useLayoutEffect(() => { if (captured.current && captured.current !== signature) stop.current(); }, [signature]);
}
