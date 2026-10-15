"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Home } from "lucide-react";
import { advanceBrain, commitAction, createBrain, getAction, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionGeometryIdentity, observeCompanionPlatforms, type CompanionGeometrySubscription } from "@/lib/ui/viewer-companion/geometry";
import { acquireCompanionAmbientPreview } from "@/lib/ui/viewer-companion/ambient-preview";
import { DEFAULT_COMPANION_CARE, loadCompanionCare, saveCompanionCare } from "@/lib/ui/viewer-companion/care";
import { createCompanionHearts } from "@/lib/ui/viewer-companion/hearts";
import { createCompanionMotion, nextCompanionPaint, sampleCompanionTravel } from "@/lib/ui/viewer-companion/motion";
import { createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { createCompanionSupportMotion } from "@/lib/ui/viewer-companion/support-motion";
import { nearestVerticalCompanionSupport } from "@/lib/ui/viewer-companion/support-landing";
import { createCompanionPettingGesture } from "@/lib/ui/viewer-companion/petting";
import { randomCompanionFood, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import registration from "@/lib/ui/viewer-companion/fluid-sprite.json";
import { gfxMode } from "@/lib/ui/gfx";
import { CompanionFood, type CompanionFoodControl } from "./companion-food";
import { CompanionHome, type CompanionHomeAction } from "./companion-home";
import "./viewer-companion.css";

type Props = { root: RefObject<HTMLDivElement | null>; preferences: CompanionPreferences; blocked: boolean; agenda: boolean; monthKey: string; reduced: boolean; homeHost: HTMLElement | null; homeVisible: boolean };
type Control = Record<CompanionHomeAction | "place" | "rest", () => void>;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sizes = { small: 60, normal: 76, large: 92 };

/** One optional local creature. It senses geometry, heart occupancy and local
 * input/snack coordinates; titles and account data never enter its brain.
 * Imperative transform/frame writes never re-render the calendar on a tick. */
export default function ViewerCompanion({ root, preferences, blocked, agenda, monthKey, reduced, homeHost, homeVisible }: Props) {
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), reaction = useRef<HTMLSpanElement>(null), facing = useRef<HTMLSpanElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const pettingHand = useRef<HTMLSpanElement>(null);
  const control = useRef<Control | null>(null), brain = useRef(createBrain(performance.now()));
  const food = useRef<CompanionFoodControl>(null), careLoaded = useRef(false);
  const homeLauncher = useRef<HTMLButtonElement>(null);
  const homeFocus = useRef<string | null>(null);
  const lastPose = useRef<{ x: number; y: number; monthKey: string; atHome: boolean } | null>(null);
  const lastFood = useRef<CompanionFoodKind | undefined>(undefined);
  const [homeExpanded, setHomeExpanded] = useState(false), [suspended, setSuspended] = useState(true);
  const [care, setCare] = useState({ ...DEFAULT_COMPANION_CARE }), [announcement, setAnnouncement] = useState("");
  const [ready, setReady] = useState(false);
  const [geometryIdentity] = useState(createCompanionGeometryIdentity);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    const track = (event: FocusEvent) => { const target = event.target as HTMLElement; if (target === document.body) return; homeFocus.current = target.closest(".vc-home,.vc-home-launcher") ? target.dataset.homeAction ?? "home" : null; };
    document.addEventListener("focusin", track); return () => document.removeEventListener("focusin", track);
  }, []);
  useLayoutEffect(() => {
    window.dispatchEvent(new Event("vic:companion-home"));
    if (!suspended && homeFocus.current && document.activeElement === document.body) {
      const matching = [...document.querySelectorAll<HTMLButtonElement>(".vc-home [data-home-action]")].find(node => node.dataset.homeAction === homeFocus.current && !node.disabled);
      (matching ?? document.querySelector<HTMLButtonElement>(".vc-home button:not(:disabled)") ?? homeLauncher.current)?.focus({ preventScroll: true });
    }
  }, [homeHost, homeVisible, homeExpanded, suspended]);

  useEffect(() => {
    const el = body.current, button = actor.current, page = root.current, image = sprite.current, poseLayer = pose.current, reactionLayer = reaction.current, facingLayer = facing.current;
    if (!ready || !el || !button || !page || !image || !poseLayer || !reactionLayer || !facingLayer || !preferences.enabled) return;
    if (blocked) { el.hidden = true; setSuspended(true); setHomeExpanded(false); return; }
    if (!careLoaded.current) { brain.current = { ...brain.current, ...loadCompanionCare() }; careLoaded.current = true; }
    const publishCare = () => { const { hunger, affection, energy, curiosity } = brain.current; setCare({ hunger, affection, energy, curiosity }); };
    publishCare();
    const hearts = createCompanionHearts(page);
    const presence = createCompanionPresence(document.hasFocus(), performance.now());
    const saved = lastPose.current;
    let pendingMonth = Boolean(saved && saved.monthKey !== monthKey && !saved.atHome);
    const monthStarted = performance.now(), monthReadyAt = monthStarted + (reduced ? 0 : 340);
    let platforms: Platform[] = [], x = saved?.x ?? innerWidth * .68, y = saved?.y ?? innerHeight - 18, support = saved?.atHome ? "companion-home" : "";
    let raf = 0, timer: ReturnType<typeof setTimeout> | undefined, lastPaint = 0, lastTick = performance.now(), lastNeeds = lastTick, lastCare = lastTick, stopped = false, sleeping = false;
    let pause = true, started = false, nextDecision = 0, needsLanding = false, afterPetLanding = false, restAfterLanding = false, releaseAmbient = () => {};
    let action: CompanionAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, consumePlacementClick = false;
    let placementPointer: number | null = null;
    let pointer: { x: number; y: number } | undefined, heartResult: "added" | "removed" | "blocked" | "missing" | null = null;
    let clickGuard: ReturnType<typeof setTimeout> | undefined;
    let pressed: { id: number; x: number; y: number; at: number; dx: number; dy: number; dragged: boolean; grabbed: boolean; cancelled: boolean } | null = null;
    const size = sizes[preferences.size];
    const visual = createCompanionMotion({ clips: Object.fromEntries(registration.rows.map((row, index) => [index, row.map((_, column) => column)])), rowCount: registration.rows.length, loopRows: [0, 2, 8, 9, 11], maxFrameRate: 14 });
    const supportMotion = createCompanionSupportMotion();
    const petting = createCompanionPettingGesture();
    let hoverPetting = false, hoverStarted = 0, petStarted = 0;
    let awaitingAtX = false, verticalLanding = false, measuredWidth = innerWidth;
    let presentationNow = 0;
    let offGeometry: CompanionGeometrySubscription | undefined, geometryTracker: CompanionGeometrySubscription | undefined;
    const anchorSeen = new Map<string, { x: number; y: number }>();
    const carrier = { x: 0, y: 0 };
    let followRaf = 0, followUntil = 0, lastFollow = 0, scrollUntil = 0;
    let lastPoseSample = { row: 0, frame: 0, status: "idle" };
    let parkedLayoutTimer: ReturnType<typeof setTimeout> | undefined;
    let geometryReady = false, homeOccluded = false;
    let paintedRow = -1, paintedColumn = -1, paintedCell = -1, paintedFacing = 0;
    const effective = reduced ? { ...preferences, roam: false, jump: false, ambientPrank: false } : preferences;
    const paintedStyles = new WeakMap<HTMLElement, Map<string, string>>();
    const style = (node: HTMLElement, name: string, value: string) => {
      let values = paintedStyles.get(node);
      if (!values) { values = new Map(); paintedStyles.set(node, values); }
      // CSSOM serializes transforms with different spacing/zero units. Cache
      // desired values instead of comparing against that normalized string.
      if (values.get(name) !== value) { node.style.setProperty(name, value); values.set(name, value); }
    };
    const data = (name: string, value: string) => { if (el.dataset[name] !== value) el.dataset[name] = value; };
    el.style.setProperty("--vc-size", `${size}px`);
    const paint = (row: number, frame: number, status: string) => {
      lastPoseSample = { row, frame, status };
      // Scroll can carry an anchor outside the safe viewport between full
      // scans. Never paint that interim frame over headers or clipped edges.
      // Event-owned follow frames must preserve the same empty-geometry gate
      // as the main loop, including its final neutral spring frame.
      if (awaitingAtX || !platforms.length && !pendingMonth && !pressed && !keyboardHeld || homeOccluded && support === "companion-home" || x < size / 2 + 4 || x > innerWidth - size / 2 - 4 || y < size + 8 || y > innerHeight - 12) { el.hidden = true; return; }
      const sample = visual.sample({ row, phase: clamp(frame / 15, 0, 1), status, x: x - carrier.x, y: y - carrier.y, now: presentationNow, reduced });
      const response = supportMotion.sample(performance.now());
      style(reactionLayer, "transform", `translate3d(0,${response.lift.toFixed(3)}px,0) scale(${(1 + response.squash * .35).toFixed(4)},${(1 - response.squash).toFixed(4)})`);
      // World travel stays smooth even when the authored pose holds. Registration
      // is measured from the opaque body, not transparent padding/shadow specks.
      style(el, "transform", `translate3d(${(x - size / 2).toFixed(3)}px,${(y - size).toFixed(3)}px,0)`);
      const chew = status === "eat" && !reduced ? Math.sin(presentationNow * .024) * .012 : 0;
      style(poseLayer, "transform", `translate3d(0,${sample.bob.toFixed(3)}px,0) rotate(${sample.tilt.toFixed(3)}deg) scale(${(sample.scaleX + chew).toFixed(4)},${(sample.scaleY - chew * .8).toFixed(4)})`);
      if (sample.facing !== paintedFacing) { facingLayer.style.transform = `scaleX(${sample.facing})`; el.dataset.facing = sample.facing < 0 ? "left" : "right"; paintedFacing = sample.facing; }
      const index = registration.rows[sample.row][sample.column];
      const column = sample.column;
      if (sample.row !== paintedRow || column !== paintedColumn) {
        el.style.setProperty("--vc-column", `${column / 15 * 100}%`);
        el.style.setProperty("--vc-row", `${sample.row / (registration.rows.length - 1) * 100}%`);
        paintedRow = sample.row; paintedColumn = column;
      }
      if (index !== paintedCell) {
        const cell = registration.frames[index];
        el.style.setProperty("--vc-cell-x", `${index % registration.grid / (registration.grid - 1) * 100}%`);
        el.style.setProperty("--vc-cell-y", `${Math.floor(index / registration.grid) / (registration.gridRows - 1) * 100}%`);
        image.style.transform = `translate3d(${cell.x / 80 * size}px,${cell.y / 80 * size}px,0)`;
        image.style.clipPath = `inset(${cell.clip.map(value => `${value / 80 * 100}%`).join(" ")})`;
        data("pose", String(index));
        paintedCell = index;
      }
      data("state", status);
      data("platform", support);
      data("journey", action ? String(began) : "");
      if (shadow.current) {
        const progress = action ? clamp((performance.now() - began) / total, 0, 1) : 0;
        const ground = action?.kind === "jump" ? lerp(origin.y, action.target.y, progress) : platforms.find(p => p.id === support)?.y ?? y;
        const altitude = Math.max(0, ground - y - response.lift), scale = clamp(1 - altitude / 260, .35, 1);
        style(shadow.current, "transform", `translate3d(0,${Math.max(0, ground - y).toFixed(2)}px,0) scale(${scale.toFixed(3)})`);
        style(shadow.current, "opacity", pressed?.grabbed || keyboardHeld ? "0" : String(.24 * scale));
      }
      el.hidden = false;
    };
    // Anchor translation and safe-span re-clipping are different things. Only
    // the real DOM anchor delta carries a journey; its clock never restarts.
    const refreshAnchors = (now: number, scroll = false) => {
      const samples = geometryTracker?.follow([support, action?.target.platformId ?? ""].filter(Boolean)) ?? [];
      const deltas = new Map<string, { x: number; y: number }>();
      for (const sample of samples) {
        const id = sample.platform.id, before = anchorSeen.get(id);
        const platform = platforms.find(p => p.id === id);
        anchorSeen.set(id, { x: sample.anchorX, y: sample.anchorY });
        const delta = before ? { x: sample.anchorX - before.x, y: sample.anchorY - before.y } : platform ? { x: sample.platform.x - platform.x, y: sample.platform.y - platform.y } : { x: 0, y: 0 };
        deltas.set(id, delta);
        if (platform && (delta.x || delta.y)) {
          platform.x += delta.x; platform.y += delta.y;
          if (platform.heart) { platform.heart.x += delta.x; platform.heart.y += delta.y; }
        }
      }
      if (pressed || keyboardHeld || placing) { supportMotion.reset(now); return false; }
      const from = deltas.get(support) ?? { x: 0, y: 0 }, to = deltas.get(action?.target.platformId ?? support) ?? { x: 0, y: 0 };
      let px = 0, py = 0;
      if (action) {
        const age = now - began, p = clamp(age / Math.max(1, total), 0, 1);
        if (action.kind === "jump") { px = travel > 0 ? clamp((age - 180) / travel, 0, 1) : travel === -2 ? sampleCompanionTravel(p) : travel === -3 ? sampleCompanionTravel(clamp(p / .78, 0, 1)) : p; py = travel === -1 ? p * p : px; }
        else if (action.kind === "walk") px = py = sampleCompanionTravel(p);
        else if (action.kind === "heart" || action.kind === "hide") px = py = sampleCompanionTravel(clamp(age / Math.max(1, travel), 0, 1));
        origin.x += from.x; origin.y += from.y;
        action.target.x += to.x; action.target.y += to.y;
        if (action.effectPoint) { action.effectPoint.x += to.x; action.effectPoint.y += to.y; }
      }
      const dx = lerp(from.x, to.x, px), dy = lerp(from.y, to.y, py);
      x += dx; y += dy; carrier.x += dx; carrier.y += dy;
      if (scroll && dy && !pendingMonth && !reduced && gfxMode() !== "off" && support !== "companion-home" && action?.kind !== "jump") supportMotion.push(dy, now);
      if (support === "companion-home" || pressed || keyboardHeld || reduced || gfxMode() === "off") supportMotion.reset(now);
      return Boolean(dx || dy);
    };
    const followLayout = (event?: Event) => {
      if (stopped || pause) return;
      // Real scroll/panel events own this short loop. Parked/quiet creatures
      // have no autonomous tracking, timers, geometry scans or brain ticks.
      const now = performance.now();
      if (event?.type === "scroll") scrollUntil = now + 180;
      followUntil = Math.max(followUntil, now + (event?.type.startsWith("vic:") ? 900 : 180));
      if (followRaf) return;
      const follow = (time: number) => {
        followRaf = 0;
        if (stopped || pause) return;
        if (time - lastFollow >= 1000 / 60 - .1) {
          lastFollow = time;
          const moved = refreshAnchors(time, time <= scrollUntil), response = supportMotion.sample(time);
          if (moved || response.active) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
          // The final neutral frame must be committed too, so no residual
          // spring offset survives when the event-owned loop stops.
          else if (time >= followUntil) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        }
        if (time < followUntil || supportMotion.sample(time).active) followRaf = requestAnimationFrame(follow);
      };
      followRaf = requestAnimationFrame(follow);
    };
    const clearAction = () => { action = null; food.current?.nibble(); heartResult = null; sleeping = false; releaseAmbient(); releaseAmbient = () => {}; el.removeAttribute("data-hidden"); el.removeAttribute("data-heart-result"); el.removeAttribute("data-dreaming"); el.removeAttribute("data-grab-ready"); if (effect.current) { effect.current.getAnimations().forEach(animation => animation.cancel()); effect.current.textContent = ""; effect.current.removeAttribute("style"); } };
    const settle = (point: { x: number; y: number }, nearby = false, atX = false) => {
      const below = platforms.filter(p => p.y >= point.y - 12 && point.x >= p.x - 10 && point.x <= p.x + p.width + 10);
      const p = atX ? nearestVerticalCompanionSupport(point, platforms) : nearby ? nearestPlatform(point, platforms) : nearestPlatform(point, below) ?? platforms.find(p => p.kind === "floor") ?? nearestPlatform(point, platforms);
      awaitingAtX = atX && !p; verticalLanding = atX;
      if (!p) { support = ""; clearAction(); el.hidden = true; return; }
      supportMotion.reset();
      const target = { x: atX ? point.x : platformLandingX(p, point.x), y: p.y, platformId: p.id };
      origin = { x, y }; action = { kind: "jump", target, duration: 650 }; began = performance.now(); total = 650; travel = nearby || atX ? -3 : -1;
      if (reduced) { x = target.x; y = target.y; support = target.platformId ?? ""; clearAction(); }
      brain.current = recordCompanionEvent(brain.current, "landed");
    };
    const supportedNow = () => { const p = platforms.find(p => p.id === support); return Boolean(p && Math.abs(y - p.y) <= 2 && x >= p.x && x <= p.x + p.width); };
    const releaseHold = () => { const held = pressed; pressed = null; keyboardHeld = false; if (held && button.hasPointerCapture(held.id)) button.releasePointerCapture(held.id); };
    const startRest = () => { action = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000 }; began = performance.now(); total = 12000; };
    const affection = () => {
      if (!preferences.petting) return;
      pendingMonth = false;
      awaitingAtX = false; petStarted = performance.now();
      afterPetLanding = !supportedNow(); restAfterLanding = false;
      clearAction(); petUntil = performance.now() + (reduced ? 650 : 1500);
      brain.current = recordCompanionEvent(brain.current, "petted");
      publishCare(); setAnnouncement("빅타민이 손길을 좋아해요. 조금 더 친해졌어요.");
      // Direct input acknowledges immediately, even when reduced-motion's
      // ambient pose loop sleeps for 400ms. Each new tap owns a fresh pulse.
      paint(9, 0, "petted");
      if (effect.current) {
        effect.current.textContent = "♡"; effect.current.getAnimations().forEach(animation => animation.cancel());
        if (!reduced) effect.current.animate([{ opacity: 0, transform: "translateY(4px) scale(.8)" }, { opacity: 1, offset: .2 }, { opacity: 0, transform: "translateY(-14px) scale(1.08)" }], { duration: 1300, fill: "forwards" });
      }
      nextDecision = petUntil + 500;
    };
    const stopHover = () => { petting.reset(); hoverPetting = false; el.removeAttribute("data-petting"); };
    const hover = (event: PointerEvent) => {
      const head = event.clientY >= y - size * .70 && event.clientY <= y - size * .28;
      if (event.pointerType !== "mouse" || event.buttons !== 0 || !head || pause || el.hidden || !document.hasFocus() || presence.phase !== "active" || !preferences.petting || pressed || keyboardHeld || placing || pendingMonth || awaitingAtX || action && ["walk", "jump", "heart", "hide", "eat"].includes(action.kind)) { stopHover(); return; }
      const normalized = (event.clientX - x) / (size * .76) + .5;
      const result = petting.sample(normalized, performance.now());
      if (!result.stroking) return;
      const now = performance.now();
      if (!hoverPetting) {
        hoverStarted = petStarted = now;
        afterPetLanding = !supportedNow(); restAfterLanding = false;
        clearAction();
      }
      if (result.reward) affection();
      hoverPetting = true; petUntil = now + 650; nextDecision = petUntil + 500;
      data("petting", "hover");
      if (pettingHand.current) style(pettingHand.current, "transform", `translate3d(${(event.clientX - x + size / 2 - 15).toFixed(2)}px,${(event.clientY - y + size - 26).toFixed(2)}px,0) rotate(${reduced ? 0 : ((normalized - .5) * 18).toFixed(2)}deg)`);
      paint(9, reduced ? 0 : ((now - hoverStarted) % 950) / 950 * 15, "petted");
    };
    control.current = {
      place: () => { if (preferences.drag) { stopHover(); awaitingAtX = false; pendingMonth = false; clearAction(); releaseHold(); petUntil = 0; afterPetLanding = false; restAfterLanding = false; placing = true; el.dataset.placing = ""; } },
      rest: () => { if (preferences.sleep) { pendingMonth = false; clearAction(); releaseHold(); afterPetLanding = false; restAfterLanding = false; petUntil = 0;
        if (!supportedNow()) { settle({ x, y }); if (reduced) startRest(); else restAfterLanding = true; }
        else startRest();
      } },
      home: () => {
        if (!preferences.sleep) return;
        pendingMonth = false;
        const home = platforms.find(p => p.id === "companion-home");
        if (!home) { setAnnouncement("쿠션이 보이도록 집을 펼쳐 주세요."); return; }
        stopHover(); awaitingAtX = false; verticalLanding = false;
        clearAction(); releaseHold(); petUntil = 0; afterPetLanding = false; restAfterLanding = true;
        const target = { x: platformLandingX(home, home.x + home.width / 2), y: home.y, platformId: home.id };
        origin = { x, y }; began = performance.now(); total = clamp(Math.hypot(target.x - x, target.y - y) * 2, 650, 1600); travel = -2;
        action = { kind: "jump", target, duration: total };
        if (reduced) { x = target.x; y = target.y; support = target.platformId; restAfterLanding = false; startRest(); }
        setAnnouncement("빅타민이 포근한 자리로 돌아가요.");
      },
      feed: () => {
        const kind = randomCompanionFood(lastFood.current); lastFood.current = kind;
        const outlet = document.querySelector(".vc-dispenser-slot")?.getBoundingClientRect();
        // Spill into the open tray left of the outlet. A selected snack must
        // never cover the button needed to dispense the next one.
        food.current?.spawn(kind, outlet ? { x: outlet.left - 40, y: outlet.bottom + 4 } : { x: x + size * .7, y });
      },
      clearFood: () => food.current?.clear(),
    };
    const launch = (next: CompanionAction, now: number) => {
      clearAction(); action = next; origin = { x, y }; began = now; total = next.duration; travel = 0;
      if (next.kind === "jump") supportMotion.reset(now);
      brain.current = commitAction(brain.current, next, now);
      if (next.kind === "heart" || next.kind === "hide") {
        const speed = preferences.speed === "relaxed" ? 45 : preferences.speed === "lively" ? 100 : 70;
        travel = Math.abs(next.target.x - x) / speed * 1000;
        total += travel;
      }
      if (next.kind === "jump") {
        const g = 1100, impulse = Math.sqrt(2 * g * (next.jumpHeight ?? 140)), dy = next.target.y - y;
        travel = (impulse + Math.sqrt(Math.max(0, impulse * impulse + 2 * g * dy))) / g * 1000;
        total = 180 + travel + 260;
      }
    };
    const tick = (now: number) => {
      if (stopped || pause) return;
      refreshAnchors(now, now <= scrollUntil);
      const delta = Math.max(0, now - lastTick); lastTick = now;
      presentationNow += delta;
      if (presence.phase === "active" && now - lastNeeds >= 250) { brain.current = advanceBrain(brain.current, now - lastNeeds); saveCompanionCare(brain.current); lastNeeds = now; }
      if (now - lastCare >= 1000) { publishCare(); lastCare = now; }
      const phase = presence.step(now, Boolean(action || now < petUntil || afterPetLanding || pendingMonth));
      data("presence", phase);
      if (pendingMonth) {
        if (now < monthReadyAt || !geometryReady) {
          // The month grid has its own finite slide. Hold this creature's
          // viewport identity while fresh, sanitized text ledges settle.
          y = Math.min(innerHeight - 12, (saved?.y ?? y) + (reduced ? 0 : 10 * clamp((now - monthStarted) / 340, 0, 1) ** 2));
          paint(5, 0, "jump"); schedule(); return;
        }
        pendingMonth = false; settle({ x: saved?.x ?? x, y: saved?.y ?? y }, true);
      }
      if (!action && ["resting", "yawning", "parked", "waking"].includes(phase)) {
        const elapsed = presence.elapsed(now);
        if (supportedNow()) paint(phase === "yawning" ? 10 : phase === "parked" ? 11 : phase === "waking" ? 12 : 0, (elapsed / (phase === "waking" ? 800 : 900)) * 15, phase === "parked" ? "sleep" : phase === "waking" ? "wake" : phase === "yawning" ? "yawn" : "idle");
        else el.hidden = true;
        if (phase === "parked") {
          el.dataset.dreaming = "";
          offGeometry?.(); offGeometry = undefined; geometryReady = false;
          hearts.pause(true);
          publishCare(); saveCompanionCare(brain.current, true);
          // No companion rAF, timer, needs or layout observer remains. Only
          // the small compositor sleep cue moves while OBS can still see it.
          return;
        }
        schedule(); return;
      }
      if (action?.kind !== "sleep") el.removeAttribute("data-dreaming");
      if (awaitingAtX || !platforms.length && !pressed && !keyboardHeld) { el.hidden = true; schedule(); return; }
      if (placing) { if (action) began += delta; paint(1, 0, "placing"); schedule(); return; }
      if (pressed || keyboardHeld) {
        el.toggleAttribute("data-grab-ready", Boolean(pressed?.grabbed));
        paint(pressed?.grabbed || keyboardHeld ? 8 : 1, 0, pressed?.grabbed || keyboardHeld ? "held" : "touch");
        schedule(); return;
      }
      if (now < petUntil) {
        if (effect.current) effect.current.textContent = "♡";
        // Authored happy poses and a small contact lean, independent of world
        // coordinates. A hover gesture never moves the support or captures it.
        paint(9, reduced ? 0 : ((now - petStarted) % 950) / 950 * 15, "petted"); schedule(); return;
      }
      if (hoverPetting) { hoverPetting = false; el.removeAttribute("data-petting"); petting.reset(); }
      if (el.dataset.state === "petted" && effect.current) effect.current.textContent = "";
      if (afterPetLanding) { afterPetLanding = false; settle({ x, y }); }
      if (action?.foodId && !food.current?.foods().some(item => item.id === action!.foodId)) { clearAction(); settle({ x, y }); nextDecision = now + 300; }
      if (!action && presence.phase === "active" && geometryReady && now >= nextDecision && (support !== "companion-home" || platforms.some(p => p.id === support))) launch(getAction(brain.current, { x, y, platformId: support, platforms, width: innerWidth, height: innerHeight, ambientAvailable: true, foods: food.current?.foods(), pointer }, effective, now), now);
      let row = 0, frame = 0, status = "idle";
      if (action) {
        const age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        if (action.kind === "walk") { x = lerp(origin.x, action.target.x, sampleCompanionTravel(p)); row = 2; }
        else if (action.kind === "jump") {
          if (travel === -2) { const eased = sampleCompanionTravel(p); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(p * Math.PI) * (reduced ? 0 : 60); row = p < .5 ? 4 : p < .85 ? 5 : 6; frame = (p < .5 ? p * 2 : p < .85 ? (p - .5) / .35 : (p - .85) / .15) * 15; }
          else if (travel === -3) { const progress = clamp(p / .78, 0, 1), eased = sampleCompanionTravel(progress); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(progress * Math.PI) * (reduced ? 0 : 10); row = p < .78 ? 5 : 6; frame = (p < .78 ? progress : (p - .78) / .22) * 15; }
          else if (travel === -1) { x = lerp(origin.x, action.target.x, p); y = lerp(origin.y, action.target.y, p * p); row = p < .8 ? 5 : 6; frame = (p < .8 ? p / .8 : (p - .8) / .2) * 15; }
          else if (age < 180) { row = 3; frame = age / 180 * 15; }
          else if (age < 180 + travel) {
            const t = (age - 180) / 1000, progress = clamp((age - 180) / travel, 0, 1);
            x = lerp(origin.x, action.target.x, progress); y = lerp(origin.y, action.target.y, progress) - .5 * 1100 * (travel / 1000) ** 2 * progress * (1 - progress);
            const apex = Math.sqrt(2 * 1100 * (action.jumpHeight ?? 140)) / 1100;
            row = t < apex ? 4 : 5; frame = (t < apex ? t / apex : (t - apex) / Math.max(.001, travel / 1000 - apex)) * 15;
          } else { x = action.target.x; y = action.target.y; row = 6; frame = (age - 180 - travel) / 260 * 15; }
        } else if (action.kind === "sleep") {
          sleeping = true; row = age < 1000 ? 10 : total - age < 1100 ? 12 : 11;
          frame = row === 10 ? age / 1000 * 15 : row === 12 ? (age - total + 1100) / 1100 * 15 : 0;
          el.toggleAttribute("data-dreaming", row === 11);
        } else if (action.kind === "heart" || action.kind === "hide") {
          if (age < travel) { x = lerp(origin.x, action.target.x, sampleCompanionTravel(age / Math.max(1, travel))); row = 2; }
          else if (action.kind === "heart") {
            const t = (age - travel) / action.duration; row = 13; frame = t * 15;
            y = origin.y + Math.max(0, Math.sin(t * Math.PI * 2)) * (reduced ? 0 : 18);
            if (t >= .25 && heartResult === null) {
              heartResult = action.effectPoint ? hearts.attemptAt(action.effectPoint) : "missing";
              el.dataset.heartResult = heartResult;
              if (heartResult !== "missing") setAnnouncement(heartResult === "added" ? "빅타민이 보라 하트를 남겼어요. 관심 수에는 포함되지 않아요." : heartResult === "removed" ? "빅타민이 자기 보라 하트를 거두었어요." : "이미 있는 하트에 콩! 빅타민이 아쉬워해요.");
            }
            if (heartResult === "blocked" && t > .5) { row = 10; frame = Math.min(15, (t - .5) * 30); }
            if (effect.current) {
              effect.current.textContent = t > .25 && t < .85 ? heartResult === "blocked" ? "◌" : heartResult === "added" ? "♥" : "" : "";
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
        } else if (action.kind === "sniff") { row = 1; frame = p * 15; }
        else if (action.kind === "eat") {
          row = p < .18 ? 1 : 9; frame = p < .18 ? p / .18 * 15 : 0;
          const direction = paintedFacing < 0 ? -1 : 1;
          food.current?.nibble(action.foodId, p, { x: x + direction * size * .045, y: y - size * .24 }, direction);
        } else if (action.kind === "look") { row = 1; frame = p * 15; }
        else if (action.kind === "stretch") { row = 16; frame = p * 15; }
        else if (action.kind === "shake") { row = 17; frame = p * 15; }
        if (p >= 1) {
          const rested = sleeping;
          const continueRoute = Boolean(action.foodId && (action.kind === "walk" || action.kind === "jump"));
          if (action.kind === "eat" && action.foodId && food.current?.consume(action.foodId)) {
            brain.current = recordCompanionEvent(brain.current, "ate"); saveCompanionCare(brain.current, true);
            petUntil = now + (reduced ? 400 : 1100);
          }
          if (["walk", "jump", "heart", "hide"].includes(action.kind)) { x = action.target.x; y = action.target.y; support = action.target.platformId ?? support; }
          clearAction(); if (rested) brain.current = recordCompanionEvent(brain.current, "rested"); nextDecision = now + (continueRoute ? 0 : 220);
          if (restAfterLanding) { restAfterLanding = false; if (presence.phase === "active") control.current?.rest(); }
        }
      }
      paint(row, frame, status); schedule();
    };
    const schedule = () => {
      if (stopped || pause || presence.phase === "parked") return;
      if (reduced) timer = setTimeout(() => tick(performance.now()), 400);
      else {
        const moving = Boolean(pendingMonth || pressed || keyboardHeld || action && ["walk", "jump", "heart", "hide", "stretch", "shake", "eat"].includes(action.kind));
        // Continuous travel/scalar transitions, cyclic drawings at<=14Hz; action poses follow their phase.
        // A quiet creature needs only the cadence of its native idle loop.
        const fps = moving ? gfxMode() === "full" ? 60 : 30 : 14;
        const draw = (now: number) => {
        const deadline = nextCompanionPaint(now, lastPaint, fps);
        if (deadline !== null) { lastPaint = deadline; tick(now); }
        else schedule();
        };
        if (moving && fps === 60) raf = requestAnimationFrame(draw);
        else timer = setTimeout(() => { raf = requestAnimationFrame(draw); }, Math.max(1, 1000 / fps - (performance.now() - lastPaint) - 1));
      }
    };
    const sync = () => {
      const html = document.documentElement;
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause");
      if (next === pause && started) return;
      started = true; pause = next; setSuspended(next); if (next) el.hidden = true;
      food.current?.pause(next);
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); lastNeeds = lastTick; lastPaint = lastTick;
      if (pause) { stopHover(); needsLanding = action?.kind === "jump" || Boolean(pressed) || keyboardHeld || afterPetLanding; afterPetLanding = false; restAfterLanding = false; supportMotion.reset(); style(reactionLayer, "transform", "translate3d(0,0px,0) scale(1,1)"); saveCompanionCare(brain.current, true); clearAction(); clearTimeout(parkedLayoutTimer); offGeometry?.(); offGeometry = undefined; geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(followRaf); followRaf = 0; geometryReady = false; hearts.pause(true); if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id); pressed = null; keyboardHeld = false; placing = false; delete el.dataset.placing; setHomeExpanded(false); }
      else { presence.focus(document.hasFocus(), lastTick); connectGeometry(); hearts.pause(presence.phase === "parked"); if (needsLanding) { needsLanding = false; settle({ x, y }); } nextDecision = performance.now() + 600; if (presence.phase !== "parked") schedule(); }
    };
    const focusChanged = () => {
      if (pause) return;
      const now = performance.now(), wasParked = presence.phase === "parked";
      presence.focus(document.hasFocus(), now);
      if (!document.hasFocus()) {
        stopHover();
        // A held pointer/placement has no natural endpoint; release it and
        // finish a short landing rather than leaving a dangling capture.
        if (pressed || keyboardHeld || placing) { clearAction(); releaseHold(); placing = false; delete el.dataset.placing; settle({ x, y }); }
      } else if (wasParked) {
        cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(parkedLayoutTimer);
        lastTick = lastNeeds = lastCare = lastPaint = now;
        el.removeAttribute("data-dreaming");
        connectGeometry(); hearts.pause(false); schedule();
      }
      if (document.hasFocus()) lastNeeds = now;
    };
    const down = (event: PointerEvent) => {
      if (pause || pressed || event.button !== 0 || (!preferences.drag && !preferences.petting)) return;
      stopHover(); awaitingAtX = false;
      event.preventDefault(); event.stopPropagation(); button.focus({ preventScroll: true }); button.setPointerCapture(event.pointerId);
      restAfterLanding = false; afterPetLanding = false;
      petUntil = 0;
      pendingMonth = false; supportMotion.reset();
      clearAction(); pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dx: event.clientX - x, dy: event.clientY - y, dragged: false, grabbed: false, cancelled: false };
    };
    const move = (event: PointerEvent) => {
      if (!pressed) { hover(event); return; }
      if (pressed.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      if (!preferences.drag && distance > 6) pressed.cancelled = true;
      if (preferences.drag && distance > 6) {
        pressed.grabbed = true;
        pressed.dragged = true; x = clamp(event.clientX - pressed.dx, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(event.clientY - pressed.dy, size + 8, innerHeight - 12);
        paint(8, 0, "held");
      }
    };
    const up = (event: PointerEvent) => {
      if (!pressed || pressed.id !== event.pointerId) return;
      const held = pressed; pressed = null;
      el.removeAttribute("data-grab-ready");
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (held.dragged) { brain.current = recordCompanionEvent(brain.current, "dragged"); settle({ x, y }); }
      else if (!held.cancelled && !held.grabbed && event.type !== "pointercancel") affection();
      else settle({ x, y });
    };
    const lostCapture = (event: PointerEvent) => {
      if (stopped || pause || !pressed || pressed.id !== event.pointerId) return;
      pressed.cancelled = true; up(event);
    };
    const key = (event: KeyboardEvent) => {
      const owns = event.key === "Escape" || event.key === "Enter" && preferences.petting || (event.key === " " || event.key.toLowerCase() === "p") && preferences.drag || event.key.toLowerCase() === "n" && preferences.sleep || keyboardHeld && event.key.startsWith("Arrow");
      if (owns) { event.preventDefault(); event.stopPropagation(); }
      if (owns) stopHover();
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      if (event.key === "Enter" && preferences.petting) { event.preventDefault(); affection(); }
      else if (event.key.toLowerCase() === "p" && preferences.drag && !event.repeat) control.current?.place();
      else if (event.key.toLowerCase() === "n" && preferences.sleep && !event.repeat) control.current?.rest();
      else if (event.key === " " && preferences.drag) { event.preventDefault(); awaitingAtX = false; pendingMonth = false; clearAction(); supportMotion.reset(); keyboardHeld = !keyboardHeld; if (!keyboardHeld) settle({ x, y }); }
      else if (event.key === "Escape") { event.preventDefault(); pendingMonth = false; keyboardHeld = false; placing = false; delete el.dataset.placing; settle({ x, y }); }
      else if (keyboardHeld && event.key.startsWith("Arrow")) { event.preventDefault(); x = clamp(x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), size + 8, innerHeight - 12); }
    };
    const place = (event: PointerEvent) => {
      if (!placing || el.contains(event.target as Node)) return;
      event.preventDefault(); event.stopPropagation(); placing = false; delete el.dataset.placing;
      // pointerdown cancellation alone does not cancel the independent click:
      // consume this placement's click before a real card/heart can receive it.
      consumePlacementClick = true; placementPointer = event.pointerId; clearTimeout(clickGuard);
      x = clamp(event.clientX, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(event.clientY, size + 8, innerHeight - 12); settle({ x, y });
    };
    const placementReleased = (event: PointerEvent) => {
      if (placementPointer !== event.pointerId) return;
      // Keep ownership for an arbitrarily long press; the fallback only starts
      // after release/cancel if the browser does not synthesize a click.
      placementPointer = null; clearTimeout(clickGuard); clickGuard = setTimeout(() => { consumePlacementClick = false; }, 500);
    };
    const click = (event: MouseEvent) => { if (consumePlacementClick) { event.preventDefault(); event.stopImmediatePropagation(); consumePlacementClick = false; placementPointer = null; clearTimeout(clickGuard); } };
    const sensePointer = (event: PointerEvent) => { if (!pause && event.pointerType !== "touch") pointer = { x: event.clientX, y: event.clientY }; };
    const onGeometry = (next: Platform[]) => {
      const widthChanged = measuredWidth !== innerWidth;
      measuredWidth = innerWidth;
      geometryReady = true;
      refreshAnchors(performance.now());
      // A full scan revalidates safe spans; scrolling itself was already
      // carried per-frame by its actual anchor, including nested/fixed panels.
      platforms = next.filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      food.current?.sync(platforms, id => geometryTracker?.anchor(id));
      if (pendingMonth) return;
      homeOccluded = false;
      const residesAtHome = support === "companion-home" && !pressed && !keyboardHeld && !placing && !afterPetLanding && (!action || action.target.platformId === "companion-home") && action?.kind !== "jump";
      if (residesAtHome) {
        const home = document.querySelector<HTMLElement>(".vc-home-cushion");
        if (home?.closest(".vc-home")?.hasAttribute("data-panel-collapsed")) {
          homeOccluded = true; el.hidden = true;
          if (presence.phase === "parked") { offGeometry?.(); offGeometry = undefined; geometryReady = false; }
          return;
        }
        const rect = home?.isConnected ? home.getBoundingClientRect() : undefined;
        if (rect && rect.width > 0 && rect.height > 0) {
          const safe = platforms.find(p => p.id === "companion-home");
          const homeX = safe ? platformLandingX(safe, x) : clamp(x, rect.left + rect.width * .25, rect.right - rect.width * .25);
          const dx = homeX - x, dy = rect.top - y;
          x = homeX; y = rect.top; carrier.x += dx; carrier.y += dy;
          if (action) { origin.x += dx; origin.y += dy; action.target.x += dx; action.target.y += dy; }
          supportMotion.reset();
          // A house scrolling outside the viewport still owns its resident.
          // Hide the clipped frame; never turn the calendar into its new bed.
          if (!safe) {
            homeOccluded = true;
            paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
            el.hidden = true;
            if (presence.phase === "parked") { offGeometry?.(); offGeometry = undefined; geometryReady = false; }
            return;
          }
        }
      }
      const resolve = (id: string, point: { x: number; y: number }) => {
        const exact = platforms.find(p => p.id === id);
        if (id === "companion-home" && exact) return exact;
        if (exact && Math.abs(point.y - exact.y) <= 3 && point.x >= exact.x && point.x <= exact.x + exact.width) return exact;
        const group = id.match(/^(?:card|date)-\d+/)?.[0];
        return group ? nearestVerticalCompanionSupport(point, platforms.filter(p => (p.id === group || p.id.startsWith(`${group}-`)) && Math.abs(point.y - p.y) <= 3)) : undefined;
      };
      if (presence.phase === "parked") {
        const old = resolve(support, { x, y });
        const p = old ?? nearestVerticalCompanionSupport({ x, y }, platforms) ?? (widthChanged ? nearestPlatform({ x, y }, platforms) : undefined);
        clearAction();
        awaitingAtX = !p;
        if (p) { support = p.id; if (widthChanged) x = platformLandingX(p, x); y = p.y; paint(11, 0, "sleep"); el.dataset.dreaming = ""; }
        else { support = ""; el.hidden = true; }
        clearTimeout(parkedLayoutTimer); offGeometry?.(); offGeometry = undefined; geometryReady = false;
        return;
      }
      // A clipped support is not a request to visit another column. Keep the
      // same x while waiting for a real ledge there; never reseed as a new pet.
      if (awaitingAtX && !pressed && !keyboardHeld && !placing) {
        settle({ x, y }, false, !widthChanged);
        if (awaitingAtX) return;
      }
      if (!support && !action && !pressed && !keyboardHeld && !placing && !afterPetLanding) {
        const p = nearestPlatform({ x, y: saved?.y ?? innerHeight * .65 }, saved ? platforms : platforms.filter(p => p.kind !== "floor")) ?? platforms[0];
        if (p) { x = platformLandingX(p, x); y = p.y; support = p.id; }
      } else if (!pressed && !keyboardHeld && !placing && !afterPetLanding) {
        const p = resolve(support, { x, y });
        if (p) support = p.id;
        const destination = action?.target.platformId;
        const target = destination && action ? resolve(destination, action.target) : undefined;
        if (action && target) {
          action.target.platformId = target.id;
          if (!verticalLanding) action.target.x = platformLandingX(target, action.target.x);
          action.target.y = target.y;
        }
        // Genuine deletion/occlusion/resize needs one safe landing. A source
        // leaving the viewport during a valid flight does not cancel it.
        if (action && destination && !target || !action && !p) {
          clearAction(); settle({ x, y }, false, !widthChanged);
        } else if (!action && p) { y = p.y; }
      }
      // Seed current baselines after span identity remapping, not with span.x:
      // clipping can move that x without the underlying text moving at all.
      refreshAnchors(performance.now());
    };
    const connectGeometry = () => {
      if (!offGeometry) {
        geometryReady = false;
        geometryTracker = offGeometry = observeCompanionPlatforms(page, onGeometry, { size, identity: geometryIdentity, getHome: () => document.querySelector<HTMLElement>(".vc-home-cushion") });
      }
    };
    const parkedLayout = () => {
      if (pause || presence.phase !== "parked") return;
      clearTimeout(parkedLayoutTimer);
      parkedLayoutTimer = setTimeout(() => { if (!pause && presence.phase === "parked") connectGeometry(); }, 120);
    };
    const panelChanged = (event: Event) => {
      if (support === "companion-home" && document.querySelector(".vc-home[data-panel-collapsed]")) {
        homeOccluded = true; el.hidden = true; stopHover();
      }
      parkedLayout(); followLayout(event);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase", "data-ambient-pause", "data-gfx"] });
    observer.observe(page, { attributes: true, attributeFilter: ["inert"] });
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", place, true); document.addEventListener("click", click, true);
    window.addEventListener("blur", focusChanged); window.addEventListener("focus", focusChanged);
    window.addEventListener("resize", parkedLayout, { passive: true }); window.addEventListener("scroll", parkedLayout, { passive: true, capture: true }); window.addEventListener("vic:companion-home", parkedLayout);
    window.addEventListener("scroll", followLayout, { passive: true, capture: true }); window.addEventListener("vic:companion-home", followLayout); window.addEventListener("vic:side-panel", followLayout);
    window.addEventListener("vic:panel-section", panelChanged);
    window.visualViewport?.addEventListener("scroll", followLayout, { passive: true });
    document.addEventListener("pointerup", placementReleased, true); document.addEventListener("pointercancel", placementReleased, true);
    document.addEventListener("pointermove", sensePointer, { passive: true });
    button.addEventListener("pointerdown", down); button.addEventListener("pointermove", move); button.addEventListener("pointerleave", stopHover); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("lostpointercapture", lostCapture); button.addEventListener("keydown", key);
    sync();
    return () => {
      lastPose.current = { x, y, monthKey, atHome: support === "companion-home" && (homeOccluded || supportedNow()) && !pressed && !keyboardHeld && action?.kind !== "jump" };
      saveCompanionCare(brain.current, true);
      stopped = true; stopHover(); cancelAnimationFrame(followRaf); geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearTimeout(parkedLayoutTimer); clearAction(); control.current = null; observer.disconnect(); offGeometry?.(); hearts.dispose();
      window.removeEventListener("blur", focusChanged); window.removeEventListener("focus", focusChanged);
      window.removeEventListener("resize", parkedLayout); window.removeEventListener("scroll", parkedLayout, true); window.removeEventListener("vic:companion-home", parkedLayout);
      window.removeEventListener("scroll", followLayout, true); window.removeEventListener("vic:companion-home", followLayout); window.removeEventListener("vic:side-panel", followLayout); window.visualViewport?.removeEventListener("scroll", followLayout);
      window.removeEventListener("vic:panel-section", panelChanged);
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); document.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      document.removeEventListener("pointermove", sensePointer);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerleave", stopHover); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("lostpointercapture", lostCapture); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
    };
  }, [ready, root, preferences, blocked, agenda, monthKey, reduced, geometryIdentity]);

  if (!ready) return null;
  const closeHome = () => { setHomeExpanded(false); };
  const act = (kind: CompanionHomeAction) => { control.current?.[kind](); };
  const house = <CompanionHome care={care} preferences={preferences} onAction={act} onClose={homeVisible ? undefined : closeHome} />;
  return createPortal(<><div className="vc-companion" ref={body} hidden data-sfx="off">
    <span className="vc-contact-shadow" ref={shadow} aria-hidden="true" />
    <button className="vc-actor" ref={actor} type="button" data-sfx="off" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space P N ArrowUp ArrowDown ArrowLeft ArrowRight Escape" onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); control.current?.place(); }}><span className="vc-facing" ref={facing} aria-hidden="true"><span className="vc-reaction" ref={reaction}><span className="vc-pose" ref={pose}><span className="vc-sprite" ref={sprite} /></span></span></span><span className="vc-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span></button>
    <span className="vc-effect" ref={effect} aria-hidden="true" />
    <span className="vc-petting-hand" ref={pettingHand} aria-hidden="true"><svg viewBox="0 0 32 38" focusable="false"><path d="M9 22 5 16c-2-3-5-1-3 2l5 10c2 3 4 5 5 9h13l1-7 4-12c1-3-3-4-4-1l-2 5V8c0-3-4-3-4 0v11V4c0-3-4-3-4 0v15V6c0-3-4-3-4 0v14L9 9C8 6 5 7 6 10Z" /><path className="vc-hand-cuff" d="M10 32h16v5H11Z" /><path className="vc-hand-fold" d="M10 23c3-3 8-2 10 1" /></svg></span>
    <span className="sr-only" id="vc-help">머리 위에서 마우스를 좌우로 움직이거나 눌러서 쓰다듬기. 끌어서 옮기기. 두 번 누른 뒤 놓을 곳 선택. Enter 쓰다듬기. 스페이스로 집고 방향키로 옮긴 뒤 스페이스나 Escape로 놓기. P로 위치 선택. N으로 낮잠.</span>
    <span className="sr-only" role="status">{announcement}</span>
  </div><CompanionFood ref={food} enabled={preferences.feeding} blocked={blocked} monthKey={monthKey} returnFocus={() => { if (!body.current?.hidden) actor.current?.focus({ preventScroll: true }); }} />
    {!suspended && !blocked ? homeVisible && homeHost ? createPortal(house, homeHost) : <div className="vc-compact-home" data-sfx="off" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeHome(); } }}>
      {homeExpanded ? house : <button ref={homeLauncher} data-home-action="launcher" type="button" className="vc-home-launcher" aria-label="빅타민 집 열기" aria-expanded={false} onClick={() => setHomeExpanded(true)}><Home size={16} aria-hidden="true" />빅타민 집</button>}
    </div> : null}
  </>, document.body);
}
