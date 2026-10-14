"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { FLIP_SPRING } from "@/lib/ui/flip-motion";
import { subscribeClock, syncedNow } from "@/lib/ui/synced-clock";
import { lateCardDeparture, passage, planCardDepartures, REGION_WINDOWS, type CardDeparture } from "@/lib/ui/premiere/choreography";
import type { PremiereFrame } from "@/lib/ui/premiere/plan";
import { premiereFocusMotion } from "@/lib/ui/premiere/focus-motion";

export function usePremiereChoreography(frame: PremiereFrame, reduced: boolean, root: RefObject<HTMLDivElement | null>, exit: RefObject<HTMLButtonElement | null>, stage: RefObject<HTMLDivElement | null>, previousFocus: RefObject<HTMLElement | null>) {
  const latest = useRef(frame); latest.current = frame;
  const active = frame.phase !== "idle";
  useLayoutEffect(() => {
    const page = root.current;
    if (!page || !active || reduced) return;
    // These shared cards keep their original DOM/layout. Mark every topology,
    // including cards outside the export surface and the preview navigation.
    const extra = [
      ...[...page.querySelectorAll<HTMLElement>(".viewer-ambient-ctl")].map(el => ({ el, code: "5" })),
      ...[...page.querySelectorAll<HTMLElement>(".soop-live-card")].map(el => ({ el, code: "6" })),
      ...[...(page.parentElement?.querySelectorAll<HTMLElement>(".viewer-preview-overlay") ?? [])].map(el => ({ el, code: "3" }))
    ].map(item => ({ ...item, before: item.el.getAttribute("data-pm-exit") }));
    for (const { el, code } of extra) el.dataset.pmExit = code;
    const regions = [...new Set([...page.querySelectorAll<HTMLElement>("[data-pm-exit]"), ...extra.map(item => item.el)])].map(el => ({ el, inert: el.inert, hidden: el.getAttribute("aria-hidden") }));
    const cardSelector = "[data-eventid],[data-supportid]";
    const navigationSelector = '[data-act="이전 달"],[data-act="다음 달"],[data-act="month-title"],[data-act="today-fab"],[data-act="mb-act"]';
    const controlled = new Map<HTMLElement, boolean>();
    const cards = new Set<HTMLElement>();
    let generation = "";
    let departures = new Map<string, CardDeparture>();
    let canvas = page.querySelector<HTMLElement>(".poster-stage");
    let fit = page.querySelector<HTMLElement>(".poster-fit");
    const marked = new Set<HTMLElement>();
    let widthRatio = 1, shift = 0;
    const measure = () => {
      if (!canvas || !fit) return;
      const style = getComputedStyle(fit);
      const left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
      // offset* deliberately ignores our transforms. Export width/rows and the
      // saved shared panel state never change while its space is visually used.
      widthRatio = canvas.offsetWidth ? Math.max(1, (fit.clientWidth - left - right) / canvas.offsetWidth) : 1;
      shift = left - canvas.offsetLeft;
    };
    measure();
    const resize = new ResizeObserver(measure);
    if (canvas) resize.observe(canvas);
    if (fit) resize.observe(fit);
    page.style.setProperty("--pm-spring", FLIP_SPRING);
    const restoreRegion = (item: typeof regions[number]) => {
      item.el.inert = item.inert;
      if (item.hidden === null) item.el.removeAttribute("aria-hidden"); else item.el.setAttribute("aria-hidden", item.hidden);
    };
    const update = () => {
      const current = latest.current;
      const returning = current.phase === "return" || current.phase === "idle";
      const seconds = returning ? Infinity : (current.target - syncedNow()) / 1000;
      stage.current?.style.setProperty("--pm-progress", String(Math.max(0, Math.min(1, 1 - seconds / 180))));
      stage.current?.style.setProperty("--pm-ring-offset", String(1 - Math.max(0, Math.min(1, seconds / 60))));
      const motion = premiereFocusMotion(seconds * 1000);
      const finale = current.phase === "reveal" ? 0 : motion.retreat;
      const grade = stage.current?.dataset.gfx;
      const drift = grade === "off" ? 0 : grade === "soft" || grade === "lite" ? .45 : 1;
      // One truthful clock conducts visual gathering too. Motion stops before
      // the last ten seconds; the ring remains an actual time indicator.
      for (const [key, value] of Object.entries({ "--pm-digit-x": `${motion.x * drift}px`, "--pm-digit-y": `${motion.y * drift}px`, "--pm-digit-tilt": `${motion.tilt * drift}deg`, "--pm-final": String(finale), "--pm-gather": String(passage(seconds, 68, 10)), "--pm-fold-drift": `${Math.sin(Math.max(0, 68 - seconds) * .48) * 5 * drift * (1 - passage(seconds, 12, 10))}px` })) stage.current?.style.setProperty(key, value);
      for (const el of stage.current?.querySelectorAll<HTMLElement>("[data-pm-retreat]") ?? []) {
        const hidden = finale > .8;
        if (hidden && el.contains(document.activeElement)) exit.current?.focus({ preventScroll: true });
        el.inert = hidden;
        if (hidden) el.setAttribute("aria-hidden", "true"); else el.removeAttribute("aria-hidden");
      }
      page.dataset.premiere = current.phase;
      page.style.setProperty("--pm-focus", String(passage(seconds, 180, 76)));
      const yieldPanel = passage(seconds, 138, 124);
      page.style.setProperty("--pm-panel-yield", String(yieldPanel));
      page.style.setProperty("--pm-canvas-scale", String(1 + (widthRatio - 1) * yieldPanel));
      page.style.setProperty("--pm-canvas-x", `${shift * yieldPanel}px`);
      for (const item of regions) {
        const window = REGION_WINDOWS[item.el.dataset.pmExit ?? ""];
        if (!window) continue;
        const progress = passage(seconds, ...window);
        item.el.style.setProperty("--pm-region", String(progress));
        if (progress > .05 && !returning) {
          if (item.el.contains(document.activeElement)) { previousFocus.current = document.activeElement as HTMLElement; exit.current?.focus({ preventScroll: true }); }
          item.el.inert = true; item.el.setAttribute("aria-hidden", "true");
        } else restoreRegion(item);
      }
      const ids = new Set(current.items.map(item => item.id));
      const targets = [...page.querySelectorAll<HTMLElement>("[data-eventid]")].filter(el => ids.has(el.dataset.eventid ?? ""));
      for (const el of marked) if (!targets.includes(el)) { delete el.dataset.pmTarget; marked.delete(el); }
      for (const el of targets) { el.dataset.pmTarget = "1"; marked.add(el); }
      page.style.setProperty("--pm-lift", String(passage(seconds, 75, 68)));
      const allCards = [...page.querySelectorAll<HTMLElement>(cardSelector)];
      const keyOf = (el: HTMLElement) => el.dataset.eventid ? `event:${el.dataset.eventid}` : `support:${el.dataset.supportid}`;
      const seed = current.items.map(item => `${item.id}:${item.revealAt}`).sort().join("|");
      if (generation !== seed) {
        generation = seed;
        departures = planCardDepartures(allCards.filter(el => !el.dataset.pmTarget).map(keyOf), seed);
      }
      for (const el of allCards) {
        cards.add(el);
        if (el.dataset.pmTarget) { delete el.dataset.pmDepart; el.style.removeProperty("--pm-leave"); continue; }
        const key = keyOf(el);
        if (!departures.has(key)) departures.set(key, lateCardDeparture(key, seed));
        const score = departures.get(key)!;
        el.dataset.pmDepart = String(score.variant);
        el.style.setProperty("--pm-leave", String(passage(seconds, score.start, score.end)));
      }
      // Native inert covers keyboard/focus and nested heart/support links.
      // Day-background VOD handlers need the capture guard below as well.
      const controls = page.querySelectorAll<HTMLElement>(`${cardSelector},${navigationSelector},.public-day button,.public-day a,.public-day [tabindex],.agenda-day button,.agenda-day a,.agenda-day [tabindex]`);
      for (const el of controls) {
        if (!controlled.has(el)) controlled.set(el, el.inert);
        const locked = !returning && !el.closest("[data-pm-target]");
        if (locked && el.contains(document.activeElement)) { previousFocus.current = document.activeElement as HTMLElement; exit.current?.focus({ preventScroll: true }); }
        el.inert = locked || controlled.get(el)!;
      }
    };
    const guard = (event: Event) => {
      if (latest.current.phase === "return" || latest.current.phase === "idle") return;
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(`.public-day,.agenda-day,${navigationSelector}`) || target.closest("[data-pm-target]")) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const guardedEvents = ["pointerdown", "click", "auxclick", "keydown", "contextmenu"];
    for (const name of guardedEvents) page.addEventListener(name, guard, true);
    const known = new Set(regions.map(item => item.el));
    const topology = new MutationObserver(changes => {
      const relevant = `.soop-live-card,.viewer-ambient-ctl,[data-pm-exit],.public-day,.agenda-day,${cardSelector}`;
      if (!changes.some(change => [...change.addedNodes].some(node => node instanceof Element && (node.matches(relevant) || node.querySelector(relevant))))) return;
      for (const [selector, code] of [[".viewer-ambient-ctl", "5"], [".soop-live-card", "6"]]) {
        for (const el of page.querySelectorAll<HTMLElement>(selector)) {
          if (known.has(el)) continue;
          extra.push({ el, code, before: el.getAttribute("data-pm-exit") });
          el.dataset.pmExit = code;
        }
      }
      for (const el of page.querySelectorAll<HTMLElement>("[data-pm-exit]")) {
        if (known.has(el)) continue;
        regions.push({ el, inert: el.inert, hidden: el.getAttribute("aria-hidden") }); known.add(el);
      }
      const nextCanvas = page.querySelector<HTMLElement>(".poster-stage"), nextFit = page.querySelector<HTMLElement>(".poster-fit");
      if (nextCanvas !== canvas) { if (canvas) resize.unobserve(canvas); canvas = nextCanvas; if (canvas) resize.observe(canvas); }
      if (nextFit !== fit) { if (fit) resize.unobserve(fit); fit = nextFit; if (fit) resize.observe(fit); }
      measure(); update();
    });
    // Watch topology changes, not the 10Hz style writes. A live card arriving
    // after the prelude must immediately inherit the same exit/inert score.
    topology.observe(page, { childList: true, subtree: true });
    update();
    const unsubscribe = subscribeClock(update);
    return () => {
      unsubscribe(); resize.disconnect(); topology.disconnect();
      for (const name of guardedEvents) page.removeEventListener(name, guard, true);
      delete page.dataset.premiere;
      for (const key of ["--pm-spring", "--pm-focus", "--pm-lift", "--pm-panel-yield", "--pm-canvas-scale", "--pm-canvas-x"]) page.style.removeProperty(key);
      for (const item of regions) { item.el.style.removeProperty("--pm-region"); restoreRegion(item); }
      for (const el of marked) delete el.dataset.pmTarget;
      for (const el of cards) { delete el.dataset.pmDepart; el.style.removeProperty("--pm-leave"); }
      for (const [el, inert] of controlled) el.inert = inert;
      for (const { el, before } of extra) { if (before === null) delete el.dataset.pmExit; else el.dataset.pmExit = before; }
    };
  }, [active, reduced, root, exit, stage, previousFocus]);
}
