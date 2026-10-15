"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { FLIP_SPRING } from "@/lib/ui/flip-motion";
import { subscribeClock, syncedNow } from "@/lib/ui/synced-clock";
import { lateCardDeparture, passage, planCardDepartures, REGION_WINDOWS, type CardDeparture } from "@/lib/ui/premiere/choreography";
import type { PremiereFrame } from "@/lib/ui/premiere/plan";
import { premiereFocusMotion } from "@/lib/ui/premiere/focus-motion";
import { premiereAudienceFrame, premiereAudienceSeat, premiereCompany } from "@/lib/ui/premiere/company";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { premiereViewportBounds, regionDeparture } from "@/lib/ui/premiere/panel-departure";

// A rapid OFF/Escape can remove choreography before the existing .64s return
// finishes. Share one finite clip lease so that tail cannot inflate mobile
// layout, and a new opening cannot inherit an old cleanup timer.
const viewportClips = new WeakMap<HTMLElement, { users: number; original: string | null; timer: number | null }>();
function clipViewport(root: HTMLElement): () => void {
  let entry = viewportClips.get(root);
  if (!entry) { entry = { users: 0, original: root.getAttribute("data-pm-viewport-clip"), timer: null }; viewportClips.set(root, entry); }
  const lease = entry;
  if (lease.timer !== null) { window.clearTimeout(lease.timer); lease.timer = null; }
  lease.users++; root.setAttribute("data-pm-viewport-clip", "");
  return () => {
    if (--lease.users > 0) return;
    lease.timer = window.setTimeout(() => {
      if (lease.original === null) root.removeAttribute("data-pm-viewport-clip"); else root.setAttribute("data-pm-viewport-clip", lease.original);
      viewportClips.delete(root);
    }, 700);
  };
}

export function usePremiereChoreography(frame: PremiereFrame, reduced: boolean, root: RefObject<HTMLDivElement | null>, exit: RefObject<HTMLButtonElement | null>, stage: RefObject<HTMLDivElement | null>, previousFocus: RefObject<HTMLElement | null>, companionOwner?: string) {
  const latest = useRef(frame); latest.current = frame;
  const active = frame.phase !== "idle";
  useLayoutEffect(() => {
    const page = root.current;
    if (!page || !active || reduced) return;
    const regionVars = ["--pm-region", "--pm-region-travel", "--pm-region-anticipation", "--pm-region-fold", "--pm-region-opacity", "--pm-region-edge-x", "--pm-region-edge-y", "--pm-region-unit-x", "--pm-region-unit-y", "--pm-region-arc-x", "--pm-region-arc-y", "--pm-region-origin", "--pm-spring"];
    const readStyle = (el: HTMLElement, keys: string[]) => keys.map(key => ({ key, value: el.style.getPropertyValue(key), priority: el.style.getPropertyPriority(key) }));
    const restoreStyle = (el: HTMLElement, values: ReturnType<typeof readStyle>) => { for (const { key, value, priority } of values) { if (value) el.style.setProperty(key, value, priority); else el.style.removeProperty(key); } };
    const restoreAttribute = (el: HTMLElement, key: string, value: string | null) => { if (value === null) el.removeAttribute(key); else el.setAttribute(key, value); };
    // Root clipping also contains this page's body-portal house. Unlike hidden,
    // clip does not create a scroll container or change sticky/vertical scroll.
    const viewportRoot = page.ownerDocument.documentElement;
    const releaseViewport = clipViewport(viewportRoot);
    type Region = { el: HTMLElement; code: string; index: number; reactInert: boolean; inert: boolean; hidden: string | null; attributes: { key: string; value: string | null }[]; styles: ReturnType<typeof readStyle> };
    const regions = new Map<HTMLElement, Region>(), nextIndex = new Map<string, number>();
    const resize = new ResizeObserver(() => queueMeasure());
    let measureFrame = 0;
    const restoreRegion = (item: Region) => {
      // Either exact house can mount while React already owns inactive=true.
      // Restoring that captured value would leave it locked after the show.
      if (item.reactInert) return;
      item.el.inert = item.inert;
      restoreAttribute(item.el, "aria-hidden", item.hidden);
    };
    const unregister = (item: Region) => {
      restoreRegion(item); restoreStyle(item.el, item.styles);
      for (const { key, value } of item.attributes) restoreAttribute(item.el, key, value);
      resize?.unobserve(item.el); regions.delete(item.el);
    };
    // Only the public page, its preview navigation and this exact creature's
    // compact portal are owned. Never style another calendar's floating house.
    const registerRegions = () => {
      const candidates = new Map<HTMLElement, string>();
      for (const el of page.querySelectorAll<HTMLElement>("[data-pm-exit]")) candidates.set(el, el.dataset.pmExit ?? "");
      for (const [selector, code] of [[".viewer-ambient-ctl", "5"], [".soop-live-card", "6"]]) for (const el of page.querySelectorAll<HTMLElement>(selector)) candidates.set(el, code);
      for (const el of page.parentElement?.querySelectorAll<HTMLElement>(".viewer-preview-overlay") ?? []) candidates.set(el, "3");
      if (companionOwner) for (const el of page.ownerDocument.querySelectorAll<HTMLElement>(".vc-compact-home[data-companion-home-owner]")) {
        if (el.dataset.companionHomeOwner === companionOwner) candidates.set(el, "5");
      }
      // The compact shell already carries its whole house. Applying the same
      // score again to its nested home would double displacement and opacity.
      for (const el of candidates.keys()) {
        const shell = el.matches(".vc-home") ? el.closest<HTMLElement>(".vc-compact-home") : null;
        if (shell && candidates.has(shell)) candidates.delete(el);
      }
      let changed = false;
      for (const item of regions.values()) if (!candidates.has(item.el) || candidates.get(item.el) !== item.code) { unregister(item); changed = true; }
      for (const [el, code] of candidates) {
        if (regions.has(el) || !REGION_WINDOWS[code]) continue;
        const index = nextIndex.get(code) ?? 0; nextIndex.set(code, index + 1);
        const reactInert = Boolean(companionOwner && el.matches(".vc-home,.vc-compact-home") && el.dataset.companionHomeOwner === companionOwner);
        regions.set(el, { el, code, index, reactInert, inert: el.inert, hidden: el.getAttribute("aria-hidden"), styles: readStyle(el, regionVars), attributes: ["data-pm-exit", "data-pm-region-active", "data-pm-region-return"].map(key => ({ key, value: el.getAttribute(key) })) });
        el.dataset.pmExit = code; el.setAttribute("data-pm-region-active", "");
        el.style.setProperty("--pm-spring", FLIP_SPRING); resize?.observe(el); changed = true;
      }
      return changed;
    };
    registerRegions();
    const cardSelector = "[data-eventid],[data-supportid]";
    const navigationSelector = '[data-act="이전 달"],[data-act="다음 달"],[data-act="month-title"],[data-act="today-fab"],[data-act="mb-act"]';
    const controlled = new Map<HTMLElement, boolean>();
    const cards = new Map<HTMLElement, { target: string | null; departure: string | null; styles: ReturnType<typeof readStyle> }>();
    const rememberCard = (el: HTMLElement) => { if (!cards.has(el)) cards.set(el, { target: el.getAttribute("data-pm-target"), departure: el.getAttribute("data-pm-depart"), styles: readStyle(el, ["--pm-leave"]) }); };
    let generation = "";
    let departures = new Map<string, CardDeparture>();
    let canvas = page.querySelector<HTMLElement>(".poster-stage");
    let fit = page.querySelector<HTMLElement>(".poster-fit");
    const marked = new Set<HTMLElement>();
    let widthRatio = 1, shift = 0, dockTravel = 0;
    let audienceContainer: HTMLElement | null = null;
    let seats: { fan: HTMLElement; dx: number }[] = [];
    const measure = () => {
      const viewport = premiereViewportBounds({ clientWidth: viewportRoot.clientWidth, clientHeight: viewportRoot.clientHeight, visualViewport: window.visualViewport });
      for (const { el, code } of regions.values()) {
        if (!el.isConnected || code === "4") continue;
        // Neutralize only this owned presentation transform for one finite
        // layout read. Resizing an already departed panel must not measure its
        // offscreen position and compound the next edge distance.
        const before = readStyle(el, ["transform", "transition"]);
        el.style.setProperty("transition", "none", "important"); el.style.setProperty("transform", "none", "important");
        const rect = el.getBoundingClientRect();
        restoreStyle(el, before.filter(value => value.key === "transform"));
        // Commit the original presentation with transitions still disabled;
        // otherwise a resize could replay an offscreen panel from identity.
        void getComputedStyle(el).transform;
        restoreStyle(el, before.filter(value => value.key === "transition"));
        if (!rect.width || !rect.height) continue;
        const sx = rect.width / (el.offsetWidth || rect.width), sy = rect.height / (el.offsetHeight || rect.height);
        const bottom = code === "7" || el.matches(".agenda-monthbar"), direction = rect.left + rect.width / 2 < viewport.left + viewport.width / 2 ? -1 : 1;
        const geometry = {
          "--pm-region-edge-x": `${bottom ? 0 : (direction < 0 ? viewport.left - rect.right - 32 : viewport.right - rect.left + 32) / sx}px`,
          "--pm-region-edge-y": `${bottom ? (viewport.bottom - rect.top + 32) / sy : 0}px`,
          "--pm-region-unit-x": String(bottom ? 0 : direction), "--pm-region-unit-y": String(bottom ? 1 : 0),
          "--pm-region-arc-x": `${bottom ? direction * 18 / sx : 0}px`, "--pm-region-arc-y": `${bottom ? 0 : -28 / sy}px`,
          "--pm-region-origin": bottom ? "center bottom" : direction < 0 ? "left center" : "right center",
        };
        for (const [key, value] of Object.entries(geometry)) el.style.setProperty(key, value);
      }
      const agenda = matchMedia(POSTER_AGENDA_QUERY).matches;
      seats = [...(stage.current?.querySelectorAll<HTMLElement>(".pm-fan") ?? [])].map(fan => {
        const index = Number(fan.style.getPropertyValue("--fan-index"));
        const destination = agenda ? 38 + index * 12 : 36 + index * 6;
        return { fan, dx: (fan.parentElement?.clientWidth ?? 0) * destination / 100 - fan.offsetLeft };
      });
      const panel = page.querySelector<HTMLElement>(".poster-panel-ctl");
      const badge = stage.current?.querySelector<HTMLElement>(".pm-banner:not(.pm-banner-focused)");
      // Agenda has no panel slot: keep its badge above the mobile monthbar.
      // Ignore departure transforms; CSS zoom/safe-area still define the slot.
      if (panel && badge) {
        const style = getComputedStyle(panel), zoom = parseFloat(style.getPropertyValue("zoom")) || 1;
        const center = (parseFloat(style.bottom) + panel.offsetHeight / 2) * zoom;
        dockTravel = (parseFloat(getComputedStyle(badge).bottom) || 84) - center + badge.offsetHeight / 2;
      } else dockTravel = 0;
      if (!canvas || !fit) return;
      const style = getComputedStyle(fit);
      const left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
      // offset* deliberately ignores our transforms. Export width/rows and the
      // saved shared panel state never change while its space is visually used.
      widthRatio = canvas.offsetWidth ? Math.max(1, (fit.clientWidth - left - right) / canvas.offsetWidth) : 1;
      shift = left - canvas.offsetLeft;
    };
    measure();
    const queueMeasure = () => {
      if (!measureFrame) measureFrame = requestAnimationFrame(() => { measureFrame = 0; measure(); update(); });
    };
    for (const { el } of regions.values()) resize.observe(el);
    if (canvas) resize.observe(canvas);
    if (fit) resize.observe(fit);
    const panel = page.querySelector<HTMLElement>(".poster-panel-ctl"), badge = stage.current?.querySelector<HTMLElement>(".pm-banner");
    if (panel) resize.observe(panel);
    if (badge) resize.observe(badge);
    const pageStyle = readStyle(page, ["--pm-spring", "--pm-focus", "--pm-lift", "--pm-panel-yield", "--pm-canvas-scale", "--pm-canvas-x"]);
    const pagePhase = page.getAttribute("data-premiere");
    page.style.setProperty("--pm-spring", FLIP_SPRING);
    const update = () => {
      const current = latest.current;
      const nextAudience = stage.current?.querySelector<HTMLElement>(".pm-company") ?? null;
      if (nextAudience !== audienceContainer) {
        if (audienceContainer) resize?.unobserve(audienceContainer);
        audienceContainer = nextAudience;
        if (audienceContainer) resize?.observe(audienceContainer);
        measure();
      }
      const returning = current.phase === "return" || current.phase === "idle";
      const seconds = returning ? Infinity : (current.target - syncedNow()) / 1000;
      stage.current?.style.setProperty("--pm-progress", String(Math.max(0, Math.min(1, 1 - seconds / 180))));
      stage.current?.style.setProperty("--pm-dock-y", `${passage(seconds, 156, 152) * dockTravel}px`);
      stage.current?.style.setProperty("--pm-ring-offset", String(1 - Math.max(0, Math.min(1, seconds / 60))));
      const motion = premiereFocusMotion(seconds * 1000);
      const finale = current.phase === "reveal" ? 0 : motion.retreat;
      const company = premiereCompany(seconds * 1000);
      const retiring = current.phase === "reveal" ? 0 : company.retire;
      stage.current?.toggleAttribute("data-pm-quiet", retiring === 1);
      // Tab return/large clock correction must land directly in the final
      // seats, without CSS replaying a walk inside the last eight seconds.
      stage.current?.toggleAttribute("data-pm-seated", seconds <= 8);
      const grade = stage.current?.dataset.gfx;
      const drift = current.phase === "reveal" || grade === "off" ? 0 : grade === "soft" || grade === "lite" ? .45 : 1;
      // One truthful clock conducts the quiet seating too. Numeral hype stops
      // before ten; low-contrast audience travel ends before the final eight.
      for (const [key, value] of Object.entries({ "--pm-digit-x": `${motion.x * drift}px`, "--pm-digit-y": `${motion.y * drift}px`, "--pm-digit-tilt": `${motion.tilt * drift}deg`, "--pm-final": String(finale), "--pm-gather": String(passage(seconds, 68, 10)), "--pm-fold-drift": `${Math.sin(Math.max(0, 68 - seconds) * .48) * 5 * drift * (1 - passage(seconds, 12, 10))}px` })) stage.current?.style.setProperty(key, value);
      stage.current?.style.setProperty("--pm-company-retire", String(retiring));
      stage.current?.style.setProperty("--pm-settle", String(company.settle));
      for (const fan of stage.current?.querySelectorAll<HTMLElement>(".pm-fan") ?? []) {
        const seed = Number(fan.style.getPropertyValue("--fan-seed"));
        const cheerAt = Number(fan.parentElement?.dataset.cheerAt);
        const age = cheerAt ? performance.now() - cheerAt - Number(fan.style.getPropertyValue("--fan-index")) * 70 : Infinity;
        const index = grade === "off" || grade === "soft" ? 15 : premiereAudienceFrame(seconds * 1000, seed, age, grade === "lite");
        if (fan.dataset.frame !== String(index)) {
          fan.dataset.frame = String(index);
          fan.style.setProperty("--fan-frame-x", `${index % 4 * 100 / 3}%`);
          fan.style.setProperty("--fan-frame-y", `${Math.floor(index / 4) * 100 / 3}%`);
          const hop = [0, 0, 7, 15, 19, 8][index] ?? 0;
          fan.style.setProperty("--fan-hop", `${-hop * (grade === "lite" ? .45 : 1)}px`);
        }
      }
      for (const { fan, dx } of seats) {
        const seat = premiereAudienceSeat(seconds * 1000, Number(fan.style.getPropertyValue("--fan-index")), grade === "lite");
        const move = grade !== "off" && grade !== "soft";
        fan.style.setProperty("--fan-walk-x", `${move ? dx * seat.progress : 0}px`);
        fan.style.setProperty("--fan-walk-y", `${move ? seat.y : 0}px`);
        fan.style.setProperty("--fan-depth", String(move ? seat.depth : 1));
      }
      for (const el of stage.current?.querySelectorAll<HTMLElement>("[data-pm-retreat],[data-pm-audience-control]") ?? []) {
        const hidden = retiring > .8 || Boolean(stage.current?.hasAttribute("data-pm-entering"));
        if (hidden && el.contains(document.activeElement)) exit.current?.focus({ preventScroll: true });
        el.inert = hidden;
        if (hidden) el.setAttribute("aria-hidden", "true"); else el.removeAttribute("aria-hidden");
      }
      page.dataset.premiere = current.phase;
      page.style.setProperty("--pm-focus", String(passage(seconds, 180, 76)));
      const yieldPanel = passage(seconds, 152, 148);
      page.style.setProperty("--pm-panel-yield", String(yieldPanel));
      page.style.setProperty("--pm-canvas-scale", String(1 + (widthRatio - 1) * yieldPanel));
      page.style.setProperty("--pm-canvas-x", `${shift * yieldPanel}px`);
      for (const item of regions.values()) {
        if (!item.el.isConnected) continue;
        const window = REGION_WINDOWS[item.code];
        if (!window) continue;
        // Fixed ambient children keep their original containing block and
        // whole-window fade. Every physical panel follows its short flight.
        const score = item.code === "4" ? { progress: passage(seconds, ...window), travel: 0, anticipation: 0, fold: 0, opacity: 1 - passage(seconds, ...window) } : regionDeparture(seconds, window, item.index);
        const { progress } = score;
        // Once a panel is seated/offscreen its score is constant. Avoid
        // repeated style invalidation during the rest of the countdown.
        for (const [key, value] of Object.entries({ "--pm-region": progress, "--pm-region-travel": score.travel, "--pm-region-anticipation": score.anticipation, "--pm-region-fold": score.fold, "--pm-region-opacity": score.opacity })) {
          const next = String(value);
          if (item.el.style.getPropertyValue(key) !== next) item.el.style.setProperty(key, next);
        }
        item.el.toggleAttribute("data-pm-region-return", returning);
        if (progress > .05 && !returning) {
          if (item.el.contains(document.activeElement)) { previousFocus.current = document.activeElement as HTMLElement; exit.current?.focus({ preventScroll: true }); }
          if (!item.reactInert) { item.el.inert = true; item.el.setAttribute("aria-hidden", "true"); }
        } else restoreRegion(item);
      }
      const ids = new Set(current.items.map(item => item.id));
      const targets = [...page.querySelectorAll<HTMLElement>("[data-eventid]")].filter(el => ids.has(el.dataset.eventid ?? ""));
      for (const el of marked) if (!targets.includes(el)) { restoreAttribute(el, "data-pm-target", cards.get(el)?.target ?? null); marked.delete(el); }
      for (const el of targets) { rememberCard(el); el.dataset.pmTarget = "1"; marked.add(el); }
      page.style.setProperty("--pm-lift", String(passage(seconds, 75, 68)));
      const allCards = [...page.querySelectorAll<HTMLElement>(cardSelector)];
      const keyOf = (el: HTMLElement) => el.dataset.eventid ? `event:${el.dataset.eventid}` : `support:${el.dataset.supportid}`;
      const seed = current.items.map(item => `${item.id}:${item.revealAt}`).sort().join("|");
      if (generation !== seed) {
        generation = seed;
        departures = planCardDepartures(allCards.filter(el => !el.dataset.pmTarget).map(keyOf), seed);
      }
      for (const el of allCards) {
        rememberCard(el);
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
    const topology = new MutationObserver(changes => {
      const relevant = `.soop-live-card,.viewer-ambient-ctl,[data-pm-exit],.public-day,.agenda-day,${cardSelector}`;
      if (!changes.some(change => [...change.addedNodes, ...change.removedNodes].some(node => node instanceof Element && (node.matches(relevant) || node.querySelector(relevant))))) return;
      let remeasure = registerRegions();
      const nextCanvas = page.querySelector<HTMLElement>(".poster-stage"), nextFit = page.querySelector<HTMLElement>(".poster-fit");
      if (nextCanvas !== canvas) { if (canvas) resize?.unobserve(canvas); canvas = nextCanvas; if (canvas) resize?.observe(canvas); remeasure = true; }
      if (nextFit !== fit) { if (fit) resize?.unobserve(fit); fit = nextFit; if (fit) resize?.observe(fit); remeasure = true; }
      if (remeasure) queueMeasure();
      else update();
    });
    // Watch topology changes, not the 10Hz style writes. A live card arriving
    // after the prelude must immediately inherit the same exit/inert score.
    topology.observe(page, { childList: true, subtree: true });
    const homeChanged = () => { registerRegions(); queueMeasure(); };
    window.addEventListener("resize", queueMeasure, { passive: true });
    window.visualViewport?.addEventListener("resize", queueMeasure, { passive: true });
    window.addEventListener("vic:companion-home", homeChanged);
    update();
    const unsubscribe = subscribeClock(update);
    return () => {
      unsubscribe(); resize?.disconnect(); topology.disconnect(); cancelAnimationFrame(measureFrame);
      window.removeEventListener("resize", queueMeasure); window.removeEventListener("vic:companion-home", homeChanged);
      window.visualViewport?.removeEventListener("resize", queueMeasure);
      for (const name of guardedEvents) page.removeEventListener(name, guard, true);
      restoreAttribute(page, "data-premiere", pagePhase); restoreStyle(page, pageStyle);
      for (const item of regions.values()) unregister(item);
      for (const [el, before] of cards) { restoreAttribute(el, "data-pm-target", before.target); restoreAttribute(el, "data-pm-depart", before.departure); restoreStyle(el, before.styles); }
      for (const [el, inert] of controlled) el.inert = inert;
      releaseViewport();
    };
  }, [active, reduced, root, exit, stage, previousFocus, companionOwner]);
}
