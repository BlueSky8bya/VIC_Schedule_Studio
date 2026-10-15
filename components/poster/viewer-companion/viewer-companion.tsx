"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Home } from "lucide-react";
import { advanceBrain, commitAction, createBrain, getAction, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { observeCompanionPlatforms } from "@/lib/ui/viewer-companion/geometry";
import { acquireCompanionAmbientPreview } from "@/lib/ui/viewer-companion/ambient-preview";
import { DEFAULT_COMPANION_CARE, loadCompanionCare, saveCompanionCare } from "@/lib/ui/viewer-companion/care";
import { createCompanionHearts } from "@/lib/ui/viewer-companion/hearts";
import { createCompanionMotion, nextCompanionPaint } from "@/lib/ui/viewer-companion/motion";
import registration from "@/lib/ui/viewer-companion/sprite-registration.json";
import { gfxMode } from "@/lib/ui/gfx";
import { CompanionFood, type CompanionFoodControl } from "./companion-food";
import { CompanionHome, type CompanionHomeAction } from "./companion-home";
import "./viewer-companion.css";

type Props = { root: RefObject<HTMLDivElement | null>; preferences: CompanionPreferences; blocked: boolean; agenda: boolean; monthKey: string; reduced: boolean; homeHost: HTMLElement | null; homeVisible: boolean };
type Control = Record<CompanionHomeAction, () => void>;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sizes = { small: 60, normal: 76, large: 92 };

/** One optional local creature. It senses geometry, heart occupancy and local
 * input/snack coordinates; titles and account data never enter its brain.
 * Imperative transform/frame writes never re-render the calendar on a tick. */
export default function ViewerCompanion({ root, preferences, blocked, agenda, monthKey, reduced, homeHost, homeVisible }: Props) {
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), facing = useRef<HTMLSpanElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const control = useRef<Control | null>(null), brain = useRef(createBrain(performance.now()));
  const food = useRef<CompanionFoodControl>(null), careLoaded = useRef(false);
  const homeLauncher = useRef<HTMLButtonElement>(null);
  const homeFocus = useRef<string | null>(null);
  const lastPose = useRef<{ x: number; y: number; monthKey: string } | null>(null);
  const [homeExpanded, setHomeExpanded] = useState(false), [suspended, setSuspended] = useState(true);
  const [care, setCare] = useState({ ...DEFAULT_COMPANION_CARE }), [announcement, setAnnouncement] = useState("");
  const [ready, setReady] = useState(false);
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
    const el = body.current, button = actor.current, page = root.current, image = sprite.current, poseLayer = pose.current, facingLayer = facing.current;
    if (!ready || !el || !button || !page || !image || !poseLayer || !facingLayer || !preferences.enabled) return;
    if (blocked) { el.hidden = true; setSuspended(true); setHomeExpanded(false); return; }
    if (!careLoaded.current) { brain.current = { ...brain.current, ...loadCompanionCare() }; careLoaded.current = true; }
    const publishCare = () => { const { hunger, affection, energy, curiosity } = brain.current; setCare({ hunger, affection, energy, curiosity }); };
    publishCare();
    const hearts = createCompanionHearts(page);
    const saved = lastPose.current?.monthKey === monthKey ? lastPose.current : null;
    let platforms: Platform[] = [], x = saved?.x ?? innerWidth * .68, y = saved?.y ?? innerHeight - 18, support = "";
    let raf = 0, timer: ReturnType<typeof setTimeout> | undefined, lastPaint = 0, lastTick = performance.now(), lastNeeds = lastTick, lastCare = lastTick, stopped = false, sleeping = false;
    let pause = true, started = false, nextDecision = 0, needsLanding = false, afterPetLanding = false, restAfterLanding = false, releaseAmbient = () => {};
    let action: CompanionAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, consumePlacementClick = false;
    let placementPointer: number | null = null;
    let pointer: { x: number; y: number } | undefined, heartResult: "added" | "removed" | "blocked" | "missing" | null = null;
    let clickGuard: ReturnType<typeof setTimeout> | undefined;
    let pressed: { id: number; x: number; y: number; at: number; dx: number; dy: number; dragged: boolean; grabbed: boolean; cancelled: boolean } | null = null;
    const size = sizes[preferences.size];
    const visual = createCompanionMotion({ clips: registration.clips });
    let presentationNow = 0;
    let paintedRow = -1, paintedColumn = -1, paintedFacing = 0;
    const effective = reduced ? { ...preferences, roam: false, jump: false, ambientPrank: false } : preferences;
    el.style.setProperty("--vc-size", `${size}px`);
    const paint = (row: number, frame: number, status: string) => {
      const sample = visual.sample({ row, phase: clamp(frame / 15, 0, 1), status, x, y, now: presentationNow, reduced });
      // World travel stays smooth even when the pixel pose holds. Registration
      // is measured from the opaque body, not transparent padding/shadow specks.
      el.style.transform = `translate3d(${(x - size / 2).toFixed(3)}px,${(y - size).toFixed(3)}px,0)`;
      poseLayer.style.transform = `translate3d(0,${sample.bob.toFixed(3)}px,0) scale(${sample.scaleX.toFixed(4)},${sample.scaleY.toFixed(4)})`;
      if (sample.facing !== paintedFacing) { facingLayer.style.transform = `scaleX(${sample.facing})`; el.dataset.facing = sample.facing < 0 ? "left" : "right"; paintedFacing = sample.facing; }
      if (sample.row !== paintedRow || sample.column !== paintedColumn) {
        const cell = registration.frames[sample.row][sample.column];
        el.style.setProperty("--vc-column", `${sample.column / 15 * 100}%`);
        el.style.setProperty("--vc-row", `${sample.row / 15 * 100}%`);
        image.style.transform = `translate3d(${cell.x / 80 * size}px,${cell.y / 80 * size}px,0)`;
        image.style.clipPath = `inset(${cell.clip.map(value => `${value / 80 * 100}%`).join(" ")})`;
        paintedRow = sample.row; paintedColumn = sample.column;
      }
      el.dataset.state = status;
      el.dataset.platform = support;
      if (shadow.current) {
        const progress = action ? clamp((performance.now() - began) / total, 0, 1) : 0;
        const ground = action?.kind === "jump" ? lerp(origin.y, action.target.y, progress) : platforms.find(p => p.id === support)?.y ?? y;
        const altitude = Math.max(0, ground - y), scale = clamp(1 - altitude / 260, .35, 1);
        shadow.current.style.transform = `translate3d(0,${Math.max(0, ground - y).toFixed(2)}px,0) scale(${scale.toFixed(3)})`;
        shadow.current.style.opacity = pressed?.grabbed || keyboardHeld ? "0" : String(.24 * scale);
      }
      el.hidden = false;
    };
    const clearAction = () => { action = null; food.current?.nibble(); heartResult = null; sleeping = false; releaseAmbient(); releaseAmbient = () => {}; el.removeAttribute("data-hidden"); el.removeAttribute("data-heart-result"); el.removeAttribute("data-dreaming"); el.removeAttribute("data-grab-ready"); if (effect.current) { effect.current.getAnimations().forEach(animation => animation.cancel()); effect.current.textContent = ""; effect.current.removeAttribute("style"); } };
    const settle = (point: { x: number; y: number }) => {
      const below = platforms.filter(p => p.y >= point.y - 12 && point.x >= p.x - 10 && point.x <= p.x + p.width + 10);
      const p = nearestPlatform(point, below) ?? platforms.find(p => p.kind === "floor") ?? nearestPlatform(point, platforms);
      if (!p) { support = ""; clearAction(); el.hidden = true; return; }
      const target = p ? { x: platformLandingX(p, point.x), y: p.y, platformId: p.id } : { x: point.x, y: innerHeight - 18 };
      origin = { x, y }; action = { kind: "jump", target, duration: 650 }; began = performance.now(); total = 650; travel = -1;
      if (reduced) { x = target.x; y = target.y; support = target.platformId ?? ""; clearAction(); }
      brain.current = recordCompanionEvent(brain.current, "landed");
    };
    const supportedNow = () => { const p = platforms.find(p => p.id === support); return Boolean(p && Math.abs(y - p.y) <= 2 && x >= p.x && x <= p.x + p.width); };
    const releaseHold = () => { if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id); pressed = null; keyboardHeld = false; };
    const startRest = () => { action = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000 }; began = performance.now(); total = 12000; };
    const affection = () => {
      if (!preferences.petting) return;
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
    control.current = {
      pet: affection,
      place: () => { if (preferences.drag) { clearAction(); releaseHold(); afterPetLanding = false; restAfterLanding = false; placing = true; el.dataset.placing = ""; } },
      rest: () => { if (preferences.sleep) { clearAction(); releaseHold(); afterPetLanding = false; restAfterLanding = false; petUntil = 0;
        if (!supportedNow()) { settle({ x, y }); if (reduced) startRest(); else restAfterLanding = true; }
        else startRest();
      } },
      home: () => {
        if (!preferences.sleep) return;
        const home = platforms.find(p => p.id === "companion-home");
        if (!home) { setAnnouncement("쿠션이 보이도록 집을 펼쳐 주세요."); return; }
        clearAction(); releaseHold(); petUntil = 0; afterPetLanding = false; restAfterLanding = true;
        const target = { x: platformLandingX(home, home.x + home.width / 2), y: home.y, platformId: home.id };
        origin = { x, y }; began = performance.now(); total = clamp(Math.hypot(target.x - x, target.y - y) * 2, 650, 1600); travel = -2;
        action = { kind: "jump", target, duration: total };
        if (reduced) { x = target.x; y = target.y; support = target.platformId; restAfterLanding = false; startRest(); }
        setAnnouncement("빅타민이 포근한 자리로 돌아가요.");
      },
      apple: () => { const outlet = document.querySelector(".vc-dispenser-slot")?.getBoundingClientRect(); food.current?.spawn("apple", outlet ? { x: outlet.left + outlet.width / 2, y: outlet.bottom } : { x: x + size * .7, y }); },
      lemon: () => { const outlet = document.querySelector(".vc-dispenser-slot")?.getBoundingClientRect(); food.current?.spawn("lemon", outlet ? { x: outlet.left + outlet.width / 2, y: outlet.bottom } : { x: x + size * .7, y }); },
      clearFood: () => food.current?.clear(),
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
      const delta = Math.max(0, now - lastTick); lastTick = now;
      presentationNow += delta;
      if (now - lastNeeds >= 250) { brain.current = advanceBrain(brain.current, now - lastNeeds); saveCompanionCare(brain.current); lastNeeds = now; }
      if (now - lastCare >= 1000) { publishCare(); lastCare = now; }
      if (!platforms.length && !pressed && !keyboardHeld) { el.hidden = true; schedule(); return; }
      if (placing) { if (action) began += delta; paint(1, 0, "placing"); schedule(); return; }
      if (pressed || keyboardHeld) {
        if (pressed && !pressed.cancelled && preferences.drag && now - pressed.at >= 360) pressed.grabbed = true;
        el.toggleAttribute("data-grab-ready", Boolean(pressed?.grabbed));
        el.style.setProperty("--vc-hold", `${pressed && !pressed.cancelled ? clamp((now - pressed.at) / 360, 0, 1) * 100 : 0}%`);
        paint(pressed?.grabbed || keyboardHeld ? 8 : 1, 0, pressed?.grabbed || keyboardHeld ? "held" : "touch");
        schedule(); return;
      }
      if (now < petUntil) { if (effect.current) effect.current.textContent = "♡"; paint(9, 0, "petted"); schedule(); return; }
      if (el.dataset.state === "petted" && effect.current) effect.current.textContent = "";
      if (afterPetLanding) { afterPetLanding = false; settle({ x, y }); }
      if (action?.foodId && !food.current?.foods().some(item => item.id === action!.foodId)) { clearAction(); settle({ x, y }); nextDecision = now + 300; }
      if (!action && now >= nextDecision) launch(getAction(brain.current, { x, y, platformId: support, platforms, width: innerWidth, height: innerHeight, ambientAvailable: true, foods: food.current?.foods(), pointer }, effective, now), now);
      let row = 0, frame = 0, status = "idle";
      if (action) {
        const age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        if (action.kind === "walk") { x = lerp(origin.x, action.target.x, p); row = 2; }
        else if (action.kind === "jump") {
          if (travel === -2) { const eased = p * p * (3 - 2 * p); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(p * Math.PI) * (reduced ? 0 : 60); row = p < .5 ? 4 : p < .85 ? 5 : 6; frame = (p < .5 ? p * 2 : p < .85 ? (p - .5) / .35 : (p - .85) / .15) * 15; }
          else if (travel === -1) { x = lerp(origin.x, action.target.x, p); y = lerp(origin.y, action.target.y, p * p); row = p < .8 ? 5 : 6; frame = (p < .8 ? p / .8 : (p - .8) / .2) * 15; }
          else if (age < 180) { row = 3; frame = age / 180 * 15; }
          else if (age < 180 + travel) {
            const t = (age - 180) / 1000, progress = clamp((age - 180) / travel, 0, 1);
            x = lerp(origin.x, action.target.x, progress); y = origin.y - Math.sqrt(2 * 1100 * 140) * t + .5 * 1100 * t * t;
            const apex = Math.sqrt(2 * 1100 * 140) / 1100;
            row = t < apex ? 4 : 5; frame = (t < apex ? t / apex : (t - apex) / Math.max(.001, travel / 1000 - apex)) * 15;
          } else { x = action.target.x; y = action.target.y; row = 6; frame = (age - 180 - travel) / 260 * 15; }
        } else if (action.kind === "sleep") {
          sleeping = true; row = age < 1000 ? 10 : total - age < 1100 ? 12 : 11;
          frame = row === 10 ? age / 1000 * 15 : row === 12 ? (age - total + 1100) / 1100 * 15 : 0;
          el.toggleAttribute("data-dreaming", row === 11);
        } else if (action.kind === "heart" || action.kind === "hide") {
          if (age < travel) { x = lerp(origin.x, action.target.x, age / Math.max(1, travel)); row = 2; }
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
          // Existing limbless happy/breathing poses make a tiny nibble loop;
          // fruit and satisfaction are separate from the sprite, no new limbs.
          row = p < .2 ? 1 : 9; frame = p < .2 ? p / .2 * 15 : 0;
          food.current?.nibble(action.foodId, p);
          if (effect.current) effect.current.textContent = p > .6 ? "✧" : "";
        } else if (action.kind === "look") { row = 1; frame = p * 15; }
        if (p >= 1) {
          const rested = sleeping;
          const continueRoute = Boolean(action.foodId && (action.kind === "walk" || action.kind === "jump"));
          if (action.kind === "eat" && action.foodId && food.current?.consume(action.foodId)) {
            brain.current = recordCompanionEvent(brain.current, "ate"); saveCompanionCare(brain.current, true);
            petUntil = now + (reduced ? 400 : 1100);
          }
          if (["walk", "jump", "heart", "hide"].includes(action.kind)) { x = action.target.x; y = action.target.y; support = action.target.platformId ?? support; }
          clearAction(); if (rested) brain.current = recordCompanionEvent(brain.current, "rested"); nextDecision = now + (continueRoute ? 0 : 220);
          if (restAfterLanding) { restAfterLanding = false; control.current?.rest(); }
        }
      }
      x = clamp(x, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y, size + 8, innerHeight - 12);
      paint(row, frame, status); schedule();
    };
    const schedule = () => {
      if (stopped || pause) return;
      if (reduced) timer = setTimeout(() => tick(performance.now()), 400);
      else raf = requestAnimationFrame(now => {
        const deadline = nextCompanionPaint(now, lastPaint, gfxMode() === "full" ? 0 : 30);
        if (deadline !== null) { lastPaint = deadline; tick(now); }
        else schedule();
      });
    };
    const sync = () => {
      const html = document.documentElement;
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause");
      if (next === pause && started) return;
      started = true; pause = next; setSuspended(next); if (next) el.hidden = true;
      food.current?.pause(next);
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); lastNeeds = lastTick; lastPaint = lastTick;
      if (pause) { needsLanding = action?.kind === "jump" || Boolean(pressed) || keyboardHeld || afterPetLanding; afterPetLanding = false; restAfterLanding = false; saveCompanionCare(brain.current, true); clearAction(); if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id); pressed = null; keyboardHeld = false; placing = false; delete el.dataset.placing; setHomeExpanded(false); }
      else { if (needsLanding) { needsLanding = false; settle({ x, y }); } nextDecision = performance.now() + 600; schedule(); }
    };
    const down = (event: PointerEvent) => {
      if (pause || event.button !== 0 || (!preferences.drag && !preferences.petting)) return;
      event.preventDefault(); event.stopPropagation(); button.focus({ preventScroll: true }); button.setPointerCapture(event.pointerId);
      restAfterLanding = false; afterPetLanding = false;
      petUntil = 0;
      clearAction(); pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dx: event.clientX - x, dy: event.clientY - y, dragged: false, grabbed: false, cancelled: false };
    };
    const move = (event: PointerEvent) => {
      if (!pressed || pressed.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      if (!pressed.grabbed && performance.now() - pressed.at < 360 && distance > 12) pressed.cancelled = true;
      if (preferences.drag && !pressed.cancelled && performance.now() - pressed.at >= 360 && distance > 8) {
        pressed.grabbed = true;
        pressed.dragged = true; x = clamp(event.clientX - pressed.dx, size / 2, innerWidth - size / 2); y = clamp(event.clientY - pressed.dy, size, innerHeight - 12);
        paint(8, 0, "held");
      }
    };
    const up = (event: PointerEvent) => {
      if (!pressed || pressed.id !== event.pointerId) return;
      const held = pressed; pressed = null;
      el.removeAttribute("data-grab-ready"); el.style.setProperty("--vc-hold", "0%");
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (held.dragged) { brain.current = recordCompanionEvent(brain.current, "dragged"); settle({ x, y }); }
      else if (!held.cancelled && !held.grabbed && performance.now() - held.at < 360 && event.type !== "pointercancel") affection();
      else settle({ x, y });
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
    const sensePointer = (event: PointerEvent) => { if (!pause && event.pointerType !== "touch") pointer = { x: event.clientX, y: event.clientY }; };
    const offGeometry = observeCompanionPlatforms(page, next => {
      const previous = platforms;
      // A visible ledge must leave room for this configured sprite above it.
      // Use the same foot boundary as painting/dragging, including after scroll.
      platforms = next.filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      food.current?.sync(platforms);
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
        const returningHome = action?.kind === "jump" && travel === -2 && target === "companion-home";
        const newHome = returningHome ? platforms.find(p => p.id === "companion-home") : undefined;
        if (returningHome && newHome && changed("companion-home")) {
          // A shared-panel spring moves the real cushion during the invitation.
          // Retarget from the current pose instead of falling onto the calendar.
          origin = { x, y }; began = performance.now(); total = clamp(Math.hypot(newHome.x + newHome.width / 2 - x, newHome.y - y) * 2, 350, 1000);
          action = { kind: "jump", target: { x: platformLandingX(newHome, newHome.x + newHome.width / 2), y: newHome.y, platformId: newHome.id }, duration: total };
        }
        else if (!p && !returningHome || action && !returningHome && (changed(support) || target && changed(target)) || returningHome && !newHome) { clearAction(); settle({ x, y }); }
        else if (!action && p) { x = platformLandingX(p, x); y = p.y; }
      }
      // Only the animation loop paints. Heart/resize observations must not
      // insert an idle frame into a running walk, jump or meal.
    }, { size, getHome: () => document.querySelector<HTMLElement>(".vc-home-cushion") });
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase", "data-ambient-pause", "data-gfx"] });
    observer.observe(page, { attributes: true, attributeFilter: ["inert"] });
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", place, true); document.addEventListener("click", click, true);
    document.addEventListener("pointerup", placementReleased, true); document.addEventListener("pointercancel", placementReleased, true);
    document.addEventListener("pointermove", sensePointer, { passive: true });
    button.addEventListener("pointerdown", down); button.addEventListener("pointermove", move); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("keydown", key);
    sync();
    return () => {
      lastPose.current = { x, y, monthKey };
      saveCompanionCare(brain.current, true);
      stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearAction(); control.current = null; observer.disconnect(); offGeometry(); hearts.dispose();
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); document.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      document.removeEventListener("pointermove", sensePointer);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
    };
  }, [ready, root, preferences, blocked, agenda, monthKey, reduced]);

  if (!ready) return null;
  const closeHome = () => { setHomeExpanded(false); };
  const act = (kind: CompanionHomeAction) => { if (["place", "apple", "lemon"].includes(kind)) setHomeExpanded(false); control.current?.[kind](); if (kind === "place") actor.current?.focus({ preventScroll: true }); };
  const house = <CompanionHome care={care} preferences={preferences} onAction={act} onClose={homeVisible ? undefined : closeHome} />;
  return createPortal(<><div className="vc-companion" ref={body} hidden data-sfx="off">
    <span className="vc-contact-shadow" ref={shadow} aria-hidden="true" />
    <button className="vc-actor" ref={actor} type="button" data-sfx="off" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape"><span className="vc-facing" ref={facing} aria-hidden="true"><span className="vc-pose" ref={pose}><span className="vc-sprite" ref={sprite} /></span></span><span className="vc-grip" aria-hidden="true" /><span className="vc-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span></button>
    <span className="vc-effect" ref={effect} aria-hidden="true" />
    <span className="sr-only" id="vc-help">톡 누르면 쓰다듬기. 꾹 누른 뒤 끌면 집기. Enter로 쓰다듬기. 스페이스로 집고 화살표로 이동한 뒤 스페이스나 Escape로 놓기. 빅타민 집의 옮길 곳 고르기로 원하는 곳을 눌러도 돼요.</span>
    <span className="sr-only" role="status">{announcement}</span>
  </div><CompanionFood ref={food} enabled={preferences.feeding} blocked={blocked} monthKey={monthKey} returnFocus={() => { if (!body.current?.hidden) actor.current?.focus({ preventScroll: true }); }} />
    {!suspended && !blocked ? homeVisible && homeHost ? createPortal(house, homeHost) : <div className="vc-compact-home" data-sfx="off" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeHome(); } }}>
      {homeExpanded ? house : <button ref={homeLauncher} data-home-action="launcher" type="button" className="vc-home-launcher" aria-label="빅타민 집 열기" aria-expanded={false} onClick={() => setHomeExpanded(true)}><Home size={16} aria-hidden="true" />빅타민 집</button>}
    </div> : null}
  </>, document.body);
}
