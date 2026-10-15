"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Home } from "lucide-react";
import { advanceBrain, commitAction, createBrain, getAction, getCompanionMood, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionGeometryIdentity, observeCompanionPlatforms, type CompanionGeometrySubscription } from "@/lib/ui/viewer-companion/geometry";
import { COMPANION_DETAIL_EVENT, collectCompanionHideTargets, type CompanionDetailNotice, type CompanionHideTarget } from "@/lib/ui/viewer-companion/hide-targets";
import { createCompanionHideSeek } from "@/lib/ui/viewer-companion/hide-seek";
import { findCompanionDetailPerch } from "@/lib/ui/viewer-companion/detail-perch";
import { DEFAULT_COMPANION_CARE, loadCompanionCare, saveCompanionCare } from "@/lib/ui/viewer-companion/care";
import { createCompanionHearts } from "@/lib/ui/viewer-companion/hearts";
import { createCompanionMotion, nextCompanionPaint, sampleCompanionTravel } from "@/lib/ui/viewer-companion/motion";
import { createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { placeCompanionOverlayPerch, type CompanionOverlayPerch } from "@/lib/ui/viewer-companion/overlay-perch";
import { createCompanionOverlayReturn, type CompanionReturnPoint } from "@/lib/ui/viewer-companion/overlay-return";
import { FLIP_MS, FLIP_SPRING } from "@/lib/ui/flip-motion";
import { hasAmbientPauseOutside } from "@/lib/ui/ambient-pause";
import { createCompanionSupportMotion } from "@/lib/ui/viewer-companion/support-motion";
import { boundCompanionHeldPose, createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";
import { firstCompanionSupportBelow, nearestVerticalCompanionSupport } from "@/lib/ui/viewer-companion/support-landing";
import { boundCompanionBallisticArc, boundCompanionSineArc } from "@/lib/ui/viewer-companion/jump-arc";
import { createCompanionPettingContact, createCompanionPettingGesture, createCompanionPettingWindow } from "@/lib/ui/viewer-companion/petting";
import { randomCompanionFood, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import registration from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import { companionSpriteSources, decodeCompanionSprite, isCompanionSpriteDecoded, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { gfxMode } from "@/lib/ui/gfx";
import { hapticSuccess } from "@/lib/ui/haptics";
import { playSfx } from "@/lib/ui/sfx";
import { CompanionFood, type CompanionFoodControl } from "./companion-food";
import { CompanionHome, type CompanionHomeAction } from "./companion-home";
import "./viewer-companion.css";

type Props = { root: RefObject<HTMLDivElement | null>; preferences: CompanionPreferences; blocked: boolean; overlayOpen: boolean; agenda: boolean; monthKey: string; reduced: boolean; homeHost: HTMLElement | null; homeVisible: boolean };
type Control = Record<CompanionHomeAction | "place" | "rest", () => void>;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const COMPANION_SIZE = 92;
const isHomeFloor = (id: string) => /^companion-home-floor(?:-\d+)?$/.test(id);
const isHomeSupport = (id: string) => id === "companion-home" || isHomeFloor(id);
const spriteSources = registration.rows.map((_, row) => companionSpriteSources(row));

/** One optional local creature. It senses geometry, heart occupancy and local
 * input/snack coordinates; titles and account data never enter its brain.
 * Imperative transform/frame writes never re-render the calendar on a tick. */
export default function ViewerCompanion({ root, preferences, blocked, overlayOpen, agenda, monthKey, reduced, homeHost, homeVisible }: Props) {
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), reaction = useRef<HTMLSpanElement>(null), facing = useRef<HTMLSpanElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const pettingHand = useRef<HTMLSpanElement>(null);
  const contact = useRef<HTMLSpanElement>(null);
  const inertia = useRef<HTMLSpanElement>(null);
  const control = useRef<Control | null>(null), brain = useRef(createBrain(performance.now()));
  const food = useRef<CompanionFoodControl>(null), careLoaded = useRef(false);
  const homeLauncher = useRef<HTMLButtonElement>(null);
  const homeFocus = useRef<string | null>(null);
  const lastPose = useRef<{ x: number; y: number; monthKey: string; atHome: boolean; homeSupportId?: string; seeded: boolean } | null>(null);
  const lastFood = useRef<CompanionFoodKind | undefined>(undefined);
  const overlayRef = useRef(overlayOpen);
  const spriteQuality = useRef({ pending: new Set<string>(), failures: new Map<string, number>() });
  const requestSprite = useRef<(src: string) => void>(() => {});
  overlayRef.current = overlayOpen;
  const [homeExpanded, setHomeExpanded] = useState(false), [suspended, setSuspended] = useState(true);
  const [care, setCare] = useState({ ...DEFAULT_COMPANION_CARE }), [announcement, setAnnouncement] = useState("");
  const [ready, setReady] = useState(false);
  const [geometryIdentity] = useState(createCompanionGeometryIdentity);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready || !preferences.enabled) return;
    let live = true;
    const cache = spriteQuality.current;
    requestSprite.current = src => {
      if (isCompanionSpriteDecoded(src) || cache.pending.has(src) || (cache.failures.get(src) ?? 0) >= 2) return;
      cache.pending.add(src);
      void decodeCompanionSprite(src).then(ok => {
        cache.pending.delete(src);
        if (ok) cache.failures.delete(src);
        else cache.failures.set(src, (cache.failures.get(src) ?? 0) + 1);
        if (live && ok) window.dispatchEvent(new Event("vic:companion-sprite"));
      });
    };
    spriteSources[0].forEach(src => requestSprite.current(src));
    return () => { live = false; requestSprite.current = () => {}; };
  }, [ready, preferences.enabled]);
  useEffect(() => {
    const track = (event: FocusEvent) => { const target = event.target as HTMLElement; if (target === document.body) return; homeFocus.current = target.closest(".vc-home,.vc-home-launcher") ? target.dataset.homeAction ?? "home" : null; };
    document.addEventListener("focusin", track); return () => document.removeEventListener("focusin", track);
  }, []);
  useLayoutEffect(() => {
    window.dispatchEvent(new Event("vic:companion-home"));
    if (!overlayOpen && !suspended && homeFocus.current && document.activeElement === document.body) {
      const matching = [...document.querySelectorAll<HTMLButtonElement>(".vc-home [data-home-action]")].find(node => node.dataset.homeAction === homeFocus.current && !node.disabled);
      (matching ?? document.querySelector<HTMLButtonElement>(".vc-home button:not(:disabled)") ?? homeLauncher.current)?.focus({ preventScroll: true });
    }
  }, [homeHost, homeVisible, homeExpanded, suspended, overlayOpen]);
  // A window changes presentation, never the creature's identity or world.
  // Notify the stable imperative runtime after the dialog DOM has committed.
  useLayoutEffect(() => { window.dispatchEvent(new Event("vic:companion-overlay")); }, [overlayOpen]);

  useEffect(() => {
    const el = body.current, button = actor.current, page = root.current, image = sprite.current, poseLayer = pose.current, reactionLayer = reaction.current, facingLayer = facing.current, contactLayer = contact.current, inertiaLayer = inertia.current;
    if (!ready || !el || !button || !page || !image || !poseLayer || !reactionLayer || !facingLayer || !contactLayer || !inertiaLayer || !preferences.enabled) return;
    if (blocked) { el.hidden = true; setSuspended(true); setHomeExpanded(false); return; }
    if (!careLoaded.current) { brain.current = { ...brain.current, ...loadCompanionCare() }; careLoaded.current = true; }
    const publishCare = () => { const { hunger, affection, energy, curiosity } = brain.current; setCare({ hunger, affection, energy, curiosity }); };
    publishCare();
    const hearts = createCompanionHearts(page);
    const presence = createCompanionPresence(document.hasFocus(), performance.now());
    const saved = lastPose.current;
    let pendingMonth = Boolean(saved && saved.monthKey !== monthKey && !saved.atHome);
    const monthStarted = performance.now(), monthReadyAt = monthStarted + (reduced ? 0 : 340);
    let platforms: Platform[] = [], landingPlatforms: Platform[] = [], x = saved?.x ?? innerWidth * .68, y = saved?.y ?? innerHeight - 18, support = saved?.atHome ? saved.homeSupportId ?? "companion-home" : "";
    const supportById = (id: string) => platforms.find(p => p.id === id) ?? landingPlatforms.find(p => p.id === id);
    let worldSeeded = saved?.seeded ?? false;
    let raf = 0, timer: ReturnType<typeof setTimeout> | undefined, lastPaint = 0, lastTick = performance.now(), lastNeeds = lastTick, lastCare = lastTick, stopped = false, sleeping = false;
    let pause = true, started = false, nextDecision = 0, needsLanding = false, afterPetLanding = false, restAfterLanding = false;
    let action: CompanionAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, consumePlacementClick = false;
    let placementPointer: number | null = null;
    let pointer: { x: number; y: number } | undefined, heartResult: "added" | "removed" | "blocked" | "missing" | null = null;
    let clickGuard: ReturnType<typeof setTimeout> | undefined;
    let pressed: { id: number; x: number; y: number; at: number; dx: number; dy: number; dragged: boolean; grabbed: boolean; cancelled: boolean } | null = null;
    const size = COMPANION_SIZE;
    const visual = createCompanionMotion({ clips: Object.fromEntries(registration.rows.map((row, index) => [index, row.map((_, column) => column)])), rowCount: registration.rows.length, loopRows: [0, 2, 8, 9, 11], maxFrameRate: 14 });
    const supportMotion = createCompanionSupportMotion();
    const heldInertia = createCompanionHeldInertia();
    let grip = { x: size / 2, y: size / 2 };
    let heldPivot = false, releasedPivotAt = -Infinity;
    const petting = createCompanionPettingGesture();
    const pettingWindow = createCompanionPettingWindow();
    const pettingBase = { left: -.68, right: .68, top: -1.04, bottom: .10 };
    const pettingPoint = (point: { x: number; y: number }) => ({ x: (point.x - x) / size, y: (point.y - y) / size });
    const touch = createCompanionPettingContact();
    let hoverPetting = false, hoverStarted = 0, petStarted = 0;
    let hoverPoint: { x: number; y: number } | undefined, hoverTarget: Element | null = null;
    let awaitingAtX = false, verticalLanding = false, measuredWidth = innerWidth;
    let presentationNow = 0;
    const hideSeek = createCompanionHideSeek();
    let hiding: { target: CompanionHideTarget; from: { x: number; y: number }; sheet?: HTMLElement } | undefined;
    let detailSheet: HTMLElement | null = null;
    let hideCandidate: CompanionHideTarget | undefined;
    let hideWakeTimer: ReturnType<typeof setTimeout> | undefined;
    const hideValid = () => Boolean(hiding && hiding.target.element.isConnected && page.contains(hiding.target.element) && hiding.target.element.dataset.eventid === hiding.target.eventId && !hiding.target.element.closest(".teaser,.teaser-revealing,.dimmed,[hidden]"));
    const resetHide = () => { clearTimeout(hideWakeTimer); hideSeek.reset(); hiding = undefined; hideCandidate = undefined; hideObserver.disconnect(); el.removeAttribute("data-hide-phase"); el.removeAttribute("data-hide-event"); el.removeAttribute("data-hide-perch"); style(el, "opacity", "1"); button.tabIndex = overlayRef.current ? -1 : 0; };
    const hideClock = (now: number) => { if (!hiding) return; if (!pause && !(overlayActive && !hiding.sheet)) presentationNow += Math.max(0, now - lastTick); lastTick = now; };
    const armHideWake = () => {
      clearTimeout(hideWakeTimer);
      const remaining = hideSeek.wakeIn(presentationNow);
      if (remaining !== null && !pause && !overlayActive) hideWakeTimer = setTimeout(() => {
        hideWakeTimer = undefined;
        if (!hiding || pause || overlayActive) return;
        const visible = collectCompanionHideTargets(page).find(target => target.element === hiding!.target.element);
        if (!visible) { resetHide(); connectGeometry(); hearts.pause(presence.phase === "parked"); lastTick = lastNeeds = performance.now(); nextDecision = lastTick + 600; schedule(); return; }
        const dx = visible.rect.left - hiding.target.rect.left, dy = visible.rect.top - hiding.target.rect.top;
        hiding.from.x = clamp(hiding.from.x + dx, size / 2 + 4, innerWidth - size / 2 - 4);
        hiding.from.y = clamp(hiding.from.y + dy, size + 8, innerHeight - 12);
        // Only the display endpoint moves here. The retained geometry anchor
        // applies the actual world delta once when observation reconnects.
        hiding.target = visible;
        tick(performance.now());
      }, Math.max(1, remaining));
    };
    let offGeometry: CompanionGeometrySubscription | undefined, geometryTracker: CompanionGeometrySubscription | undefined;
    const anchorSeen = new Map<string, { x: number; y: number }>();
    const carrier = { x: 0, y: 0 };
    let followRaf = 0, followUntil = 0, lastFollow = 0, scrollUntil = 0;
    let lastPoseSample = { row: 0, frame: 0, status: "idle" };
    let parkedLayoutTimer: ReturnType<typeof setTimeout> | undefined;
    let geometryReady = false, homeOccluded = false;
    let overlayActive = false, overlayPerch: CompanionOverlayPerch | undefined;
    let overlayDrag: { id: number; dx: number; dy: number } | undefined, overlayPlacing = false;
    let returning: ReturnType<typeof createCompanionOverlayReturn> | undefined;
    let returnTargetValid = false, pickupScale = 1, pickupAt = 0;
    let pickupOffset = { x: 0, y: 0 };
    let overlayRaf = 0, perchAnimation: Animation | undefined;
    const overlayObserved = new Set<HTMLElement>();
    const disconnectOverlay = () => { overlayResize?.disconnect(); overlayMutation?.disconnect(); overlayObserved.clear(); };
    let paintedRow = -1, paintedColumn = -1, paintedCell = "", paintedFacing = 0;
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
    const resetInertia = () => { heldInertia.reset(); style(inertiaLayer, "transform", "rotate(0.000deg) scale(1.0000,1.0000)"); };
    el.style.setProperty("--vc-size", `${size}px`);
    const paint = (row: number, frame: number, status: string) => {
      const hide = hideSeek.sample(presentationNow);
      if (hiding) { data("hidePhase", hide.phase); if (hide.phase === "hidden" || !hiding.sheet && overlayActive) { el.hidden = true; return; } }
      lastPoseSample = { row, frame, status };
      // Cursor presence belongs to a valid hover, not the pressure/reward
      // envelopes. Existing paints also release it when the world moves away.
      if (hoverPoint && (!canHover(hoverPoint) || !hoverTarget?.isConnected || isOtherControl(hoverTarget))) stopHover();
      if (supportById(support)) worldSeeded = true;
      // Scroll can carry an anchor outside the safe viewport between full
      // scans. Never paint that interim frame over headers or clipped edges.
      // Event-owned follow frames must preserve the same empty-geometry gate
      // as the main loop, including its final neutral spring frame.
      const recoveringPickup = Boolean(pickupScale !== 1 || pickupOffset.x || pickupOffset.y) && performance.now() - pickupAt < 200 && !reduced && gfxMode() !== "off";
      const hasWorldSupport = platforms.length > 0 || Boolean(supportById(support) || action?.target.platformId && supportById(action.target.platformId));
      if (!hiding && !overlayActive && !returning && !pressed && !keyboardHeld && !recoveringPickup && (awaitingAtX || !hasWorldSupport && !pendingMonth || homeOccluded && isHomeSupport(support) || x < size / 2 + 4 || x > innerWidth - size / 2 - 4 || y < size + 8 || y > innerHeight - 12)) { stopHover(); el.hidden = true; return; }
      const sample = visual.sample({ row, phase: clamp(frame / 15, 0, 1), status, x: x - carrier.x, y: y - carrier.y, now: presentationNow, reduced: reduced || gfxMode() === "off" });
      if (status === "held") { heldPivot = true; releasedPivotAt = Infinity; }
      else if (heldPivot) { heldPivot = false; releasedPivotAt = presentationNow; }
      // A hanging body stretches below the actual hand, including when its
      // drawing faces left. Keep that pivot through the100ms release mixer;
      // return to the support pivot only after the pose has settled.
      style(poseLayer, "transform-origin", heldPivot || presentationNow - releasedPivotAt < 100 ? `${sample.facing < 0 ? size - grip.x : grip.x}px ${grip.y}px` : "50% 100%");
      if (reduced || gfxMode() === "off" || overlayActive) resetInertia();
      const sway = boundCompanionHeldPose(heldInertia.sample(performance.now()), { x: x - size / 2, y: y - size }, grip, size, { width: innerWidth, height: innerHeight });
      style(inertiaLayer, "transform", `rotate(${sway.tilt.toFixed(3)}deg) scale(${(1 - sway.stretch * .35).toFixed(4)},${(1 + sway.stretch).toFixed(4)})`);
      const pressure = touch.sample(performance.now(), reduced || gfxMode() === "off");
      if (!pressure.pressure && !hoverPetting && el.dataset.petting === "touch") data("petting", "ready");
      style(contactLayer, "transform", `translate3d(${(pressure.x * sample.facing).toFixed(3)}px,${pressure.y.toFixed(3)}px,0) rotate(${(pressure.tilt * sample.facing).toFixed(3)}deg) scale(${(1 + pressure.squash * .65).toFixed(4)},${(1 - pressure.squash).toFixed(4)})`);
      const response = supportMotion.sample(performance.now());
      style(reactionLayer, "transform", `translate3d(0,${response.lift.toFixed(3)}px,0) scale(${(1 + response.squash * .35).toFixed(4)},${(1 - response.squash).toFixed(4)})`);
      // World travel stays smooth even when the authored pose holds. Registration
      // is measured from the opaque body, not transparent padding/shadow specks.
      const restore = reduced || gfxMode() === "off" ? 1 : sampleCompanionTravel(clamp((performance.now() - pickupAt) / 200, 0, 1));
      const world = { x: x + pickupOffset.x * (1 - restore), y: y + pickupOffset.y * (1 - restore), scale: lerp(pickupScale, 1, restore) };
      let display = overlayActive && overlayPerch ? overlayPerch : returning?.sample(performance.now(), world, geometryReady && returnTargetValid, reduced || gfxMode() === "off").point ?? world;
      if (hiding && (hide.phase === "entering" || hide.phase === "emerging")) {
        const p = sampleCompanionTravel(hide.phase === "emerging" ? 1 - hide.progress : hide.progress), entry = hiding.target.entry;
        display = { x: lerp(hiding.from.x, entry.x, p), y: lerp(hiding.from.y, entry.y + size * .08, p), scale: lerp(1, .12, p) };
        style(el, "opacity", String(1 - p));
      } else if (hiding?.sheet) style(el, "opacity", String(hide.phase === "found" ? Math.min(1, hide.progress * 4) : 1));
      style(el, "transform", `translate3d(${(display.x - size / 2).toFixed(3)}px,${(display.y - size).toFixed(3)}px,0) scale(${display.scale})`);
      const chew = status === "eat" && !reduced ? Math.sin(presentationNow * .024) * .012 : 0;
      style(poseLayer, "transform", `translate3d(0,${sample.bob.toFixed(3)}px,0) rotate(${sample.tilt.toFixed(3)}deg) scale(${(sample.scaleX + chew).toFixed(4)},${(sample.scaleY - chew * .8).toFixed(4)})`);
      if (sample.facing !== paintedFacing) { facingLayer.style.transform = `scaleX(${sample.facing})`; el.dataset.facing = sample.facing < 0 ? "left" : "right"; paintedFacing = sample.facing; }
      const index = registration.rows[sample.row][sample.column];
      const selected = selectCompanionSprite(index, sample.row, sample.column);
      spriteSources[sample.row].forEach(src => requestSprite.current(src));
      const packetReady = isCompanionSpriteDecoded(selected.src) || paintedCell.startsWith(`${selected.src}:`);
      const column = sample.column;
      if (sample.row !== paintedRow || column !== paintedColumn) {
        el.style.setProperty("--vc-column", `${column / 15 * 100}%`);
        el.style.setProperty("--vc-row", `${sample.row / (registration.rows.length - 1) * 100}%`);
        paintedRow = sample.row; paintedColumn = column;
      }
      const cellKey = `${selected.src}:${selected.index}`;
      if (packetReady && cellKey !== paintedCell) {
        const cell = selected.frame, grid = selected.grid, rows = selected.gridRows;
        image.style.backgroundImage = `url("${selected.src}")`;
        image.style.backgroundSize = `${grid * 100}% ${rows * 100}%`;
        el.style.setProperty("--vc-cell-x", `${selected.index % grid / (grid - 1) * 100}%`);
        el.style.setProperty("--vc-cell-y", `${Math.floor(selected.index / grid) / (rows - 1) * 100}%`);
        image.style.transform = `translate3d(${cell.x / 80 * size}px,${cell.y / 80 * size}px,0)`;
        image.style.clipPath = `inset(${cell.clip.map(value => `${value / 80 * 100}%`).join(" ")})`;
        data("pose", String(selected.physicalIndex)); data("atlas", "hd"); data("quality", "sharp");
        paintedCell = cellKey;
      }
      data("state", status);
      data("platform", support);
      data("journey", action ? String(began) : "");
      if (shadow.current) {
        const progress = action ? clamp((performance.now() - began) / total, 0, 1) : 0;
        const ground = action?.kind === "jump" ? lerp(origin.y, action.target.y, progress) : supportById(support)?.y ?? y;
        const altitude = Math.max(0, ground - y - response.lift), scale = clamp(1 - altitude / 260, .35, 1);
        style(shadow.current, "transform", `translate3d(0,${Math.max(0, ground - y).toFixed(2)}px,0) scale(${scale.toFixed(3)})`);
        style(shadow.current, "opacity", pressed?.grabbed || keyboardHeld ? "0" : String(.24 * scale));
      }
      el.hidden = !paintedCell;
      if (el.hidden) stopHover();
    };
    const displayedPoint = (): CompanionReturnPoint => {
      // Read before cancelling a finite WAAPI relocation, including its
      // halfway scale. These coordinates reconstruct this carrier transform
      // exactly; child facing/contact/pose never changes the world anchor.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return { x: matrix.m41 + size / 2, y: matrix.m42 + size, scale: matrix.m11 || 1 };
    };
    const interruptReturn = () => {
      if (!returning) return;
      const point = displayedPoint();
      const keepSupport = supportedNow() && Math.hypot(point.x - x, point.y - y) < 2 && Math.abs(point.scale - 1) < .01;
      returning = undefined; el.removeAttribute("data-returning");
      x = clamp(point.x, size / 2 + 4, innerWidth - size / 2 - 4);
      y = clamp(point.y, size + 8, innerHeight - 12);
      pickupOffset = { x: point.x - x, y: point.y - y };
      if (!keepSupport) support = "";
      awaitingAtX = false; homeOccluded = false;
      pickupScale = point.scale; pickupAt = performance.now();
      presence.focus(document.hasFocus(), pickupAt, true);
      nextDecision = pickupAt + 350;
      supportMotion.reset();
    };
    // Anchor translation and safe-span re-clipping are different things. Only
    // the real DOM anchor delta carries a journey; its clock never restarts.
    const refreshAnchors = (now: number, scroll = false) => {
      if (overlayActive || hiding) return false;
      const samples = geometryTracker?.follow([support, action?.target.platformId ?? ""].filter(Boolean)) ?? [];
      const deltas = new Map<string, { x: number; y: number }>();
      for (const sample of samples) {
        const id = sample.platform.id, before = anchorSeen.get(id);
        const platform = supportById(id);
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
      if (scroll && dy && !pendingMonth && !reduced && gfxMode() !== "off" && !isHomeSupport(support) && action?.kind !== "jump") supportMotion.push(dy, now);
      if (isHomeSupport(support) || pressed || keyboardHeld || reduced || gfxMode() === "off") supportMotion.reset(now);
      return Boolean(dx || dy);
    };
    const followLayout = (event?: Event) => {
      if (stopped || pause || overlayActive || hiding) return;
      // Real scroll/panel events own this short loop. Parked/quiet creatures
      // have no autonomous tracking, timers, geometry scans or brain ticks.
      const now = performance.now();
      if (event?.type === "scroll") scrollUntil = now + 180;
      followUntil = Math.max(followUntil, now + (event?.type.startsWith("vic:") ? 900 : 180));
      if (followRaf) return;
      const follow = (time: number) => {
        followRaf = 0;
        if (stopped || pause || overlayActive || hiding) return;
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
    const clearAction = () => { action = null; food.current?.nibble(); heartResult = null; sleeping = false; el.removeAttribute("data-heart-result"); el.removeAttribute("data-dreaming"); el.removeAttribute("data-grab-ready"); if (effect.current) { effect.current.getAnimations().forEach(animation => animation.cancel()); effect.current.textContent = ""; effect.current.removeAttribute("style"); } };
    const settle = (point: { x: number; y: number }, nearby = false, atX = false) => {
      // User releases hit the first real card top on this vertical ray. The
      // separate text ledges remain the only autonomous destinations.
      const p = atX ? nearestVerticalCompanionSupport(point, platforms) : nearby ? nearestPlatform(point, platforms) : firstCompanionSupportBelow(point, landingPlatforms);
      awaitingAtX = atX && !p; verticalLanding = atX || !nearby;
      if (!p) { support = ""; clearAction(); stopHover(); el.hidden = true; return; }
      supportMotion.reset();
      const target = { x: atX || !nearby ? point.x : platformLandingX(p, point.x), y: p.y, platformId: p.id };
      origin = { x, y }; action = { kind: "jump", target, duration: 650 }; began = performance.now(); total = 650; travel = nearby || atX ? -3 : -1;
      if (reduced) { x = target.x; y = target.y; support = target.platformId ?? ""; clearAction(); }
      brain.current = recordCompanionEvent(brain.current, "landed");
    };
    const supportedNow = () => { const p = supportById(support); return Boolean(p && Math.abs(y - p.y) <= 2 && x >= p.x && x <= p.x + p.width); };
    const releaseHold = () => { resetInertia(); const held = pressed; pressed = null; keyboardHeld = false; if (held && button.hasPointerCapture(held.id)) button.releasePointerCapture(held.id); };
    const startRest = () => { action = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000 }; began = performance.now(); total = 12000; };
    const affection = () => {
      if (!preferences.petting) return;
      pendingMonth = false;
      awaitingAtX = false; petStarted = performance.now();
      afterPetLanding = !supportedNow(); restAfterLanding = false;
      clearAction(); petUntil = performance.now() + (reduced ? 650 : 1500);
      brain.current = recordCompanionEvent(brain.current, "petted");
      data("mood", "happy");
      // One deliberate reward, never pointermove audio. Both feedback buses
      // retain the app's master/category/volume/hidden-tab preferences.
      hapticSuccess(); playSfx("hope");
      publishCare(); setAnnouncement("빅타민이 손길을 좋아해요. 조금 더 친해졌어요.");
      // Direct input acknowledges immediately, even when reduced-motion's
      // ambient pose loop sleeps for 400ms. Each new tap owns a fresh pulse.
      paint(9, 0, "petted");
      if (effect.current) {
        effect.current.textContent = "";
      }
      nextDecision = petUntil + 500;
    };
    const isOtherControl = (target: EventTarget | null) => target instanceof Element && !el.contains(target) && Boolean(target.closest("button,a,input,select,textarea,[role='button']"));
    const hoverEligible = () => !hiding && !pause && !overlayActive && !returning && !el.hidden && document.hasFocus() && presence.phase === "active" && preferences.petting && !pressed && !keyboardHeld && !placing && !pendingMonth && !awaitingAtX && !(action && ["walk", "jump", "heart", "hide", "eat"].includes(action.kind));
    const canHover = (point: { x: number; y: number }) => hoverEligible() && pettingWindow.contains(pettingPoint(point), pettingBase, performance.now());
    const stopHover = () => {
      petting.reset(); touch.reset(); pettingWindow.reset(); hoverPetting = false; hoverPoint = undefined;
      hoverTarget?.removeAttribute("data-vc-petting-cursor"); hoverTarget = null;
      el.removeAttribute("data-petting"); style(contactLayer, "transform", "translate3d(0,0,0) rotate(0deg) scale(1,1)");
    };
    const hover = (event: PointerEvent, target = event.target) => {
      // A forgiving whole-body sensor, independent of the smaller drag button:
      // passive hover never expands the hit target over calendar controls.
      const horizontalReach = size * .68;
      const point = { x: event.clientX, y: event.clientY };
      const now = performance.now();
      if (event.pointerType !== "mouse" || event.buttons !== 0 || !hoverEligible() || !(target instanceof Element) || isOtherControl(target) || !pettingWindow.move(pettingPoint(point), pettingBase, now)) { stopHover(); return; }
      hoverPoint = point;
      if (hoverTarget !== target) {
        hoverTarget?.removeAttribute("data-vc-petting-cursor"); hoverTarget = target;
        // Mark only the actual non-control surface under this pointer. No
        // enlarged hitbox, global cursor override or inline-style replacement.
        hoverTarget.setAttribute("data-vc-petting-cursor", "");
      }
      const normalized = (event.clientX - x) / (size * .76) + .5;
      // Preserve the familiar stroke distance while contact also responds in
      // the side padding, rather than clamping an entire margin to one point.
      const moving = touch.move((event.clientX - x) / (horizontalReach * 2) + .5, now);
      const result = petting.sample(normalized, now, (event.clientY - y) / (size * .76));
      // The first pass has a small continuous contact response. Intent and
      // bounded affection still require a real back-and-forth gesture.
      if (result.stroking || hoverPetting) data("petting", "hover");
      else if (moving || touch.sample(now).pressure > 0) data("petting", "touch");
      else data("petting", "ready");
      if (pettingHand.current) style(pettingHand.current, "transform", `translate3d(${(event.clientX - x + size / 2 - 12).toFixed(2)}px,${(event.clientY - y + size - 21).toFixed(2)}px,0) rotate(${reduced ? 0 : -18 + (normalized - .5) * 12}deg)`);
      if (!result.stroking) { paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return; }
      if (!hoverPetting) {
        hoverStarted = petStarted = now;
        afterPetLanding = !supportedNow(); restAfterLanding = false;
        clearAction();
      }
      if (result.reward) affection();
      hoverPetting = true; petUntil = now + 650; nextDecision = petUntil + 500;
      data("petting", "hover");
      paint(9, reduced ? 0 : ((now - hoverStarted) % 950) / 950 * 15, "petted");
    };
    const leave = (event: PointerEvent) => {
      // pointerleave precedes the next document move. Yield to its real
      // destination before a reversal can award affection over another control.
      if (!event.relatedTarget || isOtherControl(event.relatedTarget)) stopHover();
      else hover(event, event.relatedTarget);
    };
    const outsideDocument = (event: PointerEvent) => { if (!event.relatedTarget) stopHover(); };
    control.current = {
      place: () => { if (!hiding && preferences.drag) {
        if (overlayActive) { overlayPlacing = true; el.dataset.placing = ""; setAnnouncement("빅타민을 놓을 곳을 한 번 눌러 주세요."); return; }
        interruptReturn(); stopHover(); awaitingAtX = false; pendingMonth = false; clearAction(); releaseHold(); petUntil = 0; afterPetLanding = false; restAfterLanding = false; placing = true; el.dataset.placing = "";
      } },
      rest: () => { if (!hiding && preferences.sleep) { interruptReturn(); pendingMonth = false; clearAction(); releaseHold(); afterPetLanding = false; restAfterLanding = false; petUntil = 0;
        if (!supportedNow()) { settle({ x, y }); if (reduced) startRest(); else restAfterLanding = true; }
        else startRest();
      } },
      home: () => {
        if (hiding || !preferences.sleep) return;
        pendingMonth = false;
        const home = platforms.find(p => p.id === "companion-home");
        if (!home) { setAnnouncement("쿠션이 보이도록 집을 펼쳐 주세요."); return; }
        interruptReturn();
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
        const slot = document.querySelector<HTMLElement>(".vc-dispenser-slot");
        const outlet = slot?.getBoundingClientRect();
        // Spill into the open tray left of the outlet. A selected snack must
        // never cover the button needed to dispense the next one.
        food.current?.spawn(kind, outlet ? { x: outlet.left - 40, y: outlet.bottom + 4 } : { x: x + size * .7, y }, slot ?? undefined);
      },
      clearFood: () => food.current?.clear(),
    };
    const launch = (next: CompanionAction, now: number) => {
      clearAction(); action = next; origin = { x, y }; began = now; total = next.duration; travel = 0;
      if (next.kind === "hide") {
        if (!hideCandidate) { action = null; nextDecision = now + 1000; return; }
        hiding = { target: hideCandidate, from: { x, y } }; hideSeek.start(hideCandidate.eventId, presentationNow, 12000 + Math.random() * 16000);
        data("hideEvent", hideCandidate.eventId); button.tabIndex = -1; stopHover();
        hideObserver.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-eventid"] });
        setAnnouncement("빅타민이 일정 속에 숨었어요. 그 일정의 상세창에서 찾아보세요.");
      }
      if (next.kind === "jump") supportMotion.reset(now);
      brain.current = commitAction(brain.current, next, now);
      if (next.kind === "heart") {
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
      if (hiding) {
        const hide = hideSeek.sample(presentationNow);
        if (hide.phase === "hidden") {
          clearAction(); data("hidePhase", "hidden"); el.hidden = true;
          offGeometry?.(); offGeometry = undefined; geometryReady = false;
          cancelAnimationFrame(followRaf); followRaf = 0; hearts.pause(true); lastNeeds = lastCare = now;
          armHideWake();
          return;
        }
        if (hide.phase === "done") {
          const shown = displayedPoint();
          resetHide(); clearAction(); returnTargetValid = false;
          returning = createCompanionOverlayReturn(shown, now, false, FLIP_MS); data("returning", "settle");
          connectGeometry(); hearts.pause(false); lastNeeds = lastCare = now; nextDecision = now + 800;
          paint(15, 15, "return"); schedule(); return;
        }
        if (hiding.sheet) {
          paint(hide.phase === "found" ? 15 : 9, hide.progress * 15, hide.phase === "found" ? "found" : "watch");
          lastNeeds = lastCare = now;
          if (hide.active) schedule();
          return;
        }
        paint(hide.phase === "emerging" ? 15 : 14, hide.progress * 15, hide.phase === "emerging" ? "emerge" : "hide"); lastNeeds = lastCare = now; schedule(); return;
      }
      if (!returning && presence.phase === "active" && now - lastNeeds >= 250) { brain.current = advanceBrain(brain.current, now - lastNeeds); saveCompanionCare(brain.current); lastNeeds = now; }
      if (now - lastCare >= 1000) { publishCare(); lastCare = now; }
      const phase = presence.step(now, Boolean(returning || action || pressed || keyboardHeld || placing || now < petUntil || afterPetLanding || pendingMonth && !overlayActive));
      data("presence", phase);
      if (returning) {
        const sample = returning.sample(now, { x, y, scale: 1 }, geometryReady && returnTargetValid, reduced || gfxMode() === "off");
        data("returning", sample.phase);
        el.removeAttribute("data-dreaming");
        if (!sample.done) {
          paint(sample.phase === "wake" ? 12 : sample.phase === "settle" ? 6 : 0, sample.phase === "wake" ? clamp(presence.elapsed(now) / 800, 0, 1) * 15 : sample.phase === "settle" ? 15 : 0, sample.phase === "wake" ? "wake" : sample.phase === "settle" ? "land" : "return");
          schedule(); return;
        }
        if (sample.expired) awaitingAtX = true;
        returning = undefined; el.removeAttribute("data-returning");
        lastNeeds = now; nextDecision = now + 350;
      }
      if (pendingMonth && !overlayActive) {
        if (now < monthReadyAt || !geometryReady) {
          // The month grid has its own finite slide. Hold this creature's
          // viewport identity while fresh, sanitized text ledges settle.
          y = Math.min(innerHeight - 12, (saved?.y ?? y) + (reduced ? 0 : 10 * clamp((now - monthStarted) / 340, 0, 1) ** 2));
          paint(5, 0, "jump"); schedule(); return;
        }
        pendingMonth = false; settle({ x: saved?.x ?? x, y: saved?.y ?? y }, true);
      }
      if (!action && !pressed && !keyboardHeld && !placing && ["resting", "yawning", "parked", "waking"].includes(phase)) {
        const elapsed = presence.elapsed(now);
        if (overlayActive || supportedNow()) paint(phase === "yawning" ? 10 : phase === "parked" ? 11 : phase === "waking" ? 12 : 0, (elapsed / (phase === "waking" ? 800 : 900)) * 15, phase === "parked" ? "sleep" : phase === "waking" ? "wake" : phase === "yawning" ? "yawn" : "idle");
        else { stopHover(); el.hidden = true; }
        if (phase === "parked") {
          resetInertia();
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
      if (!overlayActive && (awaitingAtX || !platforms.length && !supportById(support) && !(action?.target.platformId && supportById(action.target.platformId)) && !pressed && !keyboardHeld)) { stopHover(); el.hidden = true; schedule(); return; }
      if (placing) { if (action) began += delta; paint(1, 0, "placing"); schedule(); return; }
      if (pressed || keyboardHeld) {
        el.toggleAttribute("data-grab-ready", Boolean(pressed?.grabbed));
        paint(pressed?.grabbed || keyboardHeld ? 8 : 1, 0, pressed?.grabbed || keyboardHeld ? "held" : "touch");
        schedule(); return;
      }
      if (now < petUntil) {
        if (effect.current) effect.current.textContent = "";
        // Authored happy poses and a small contact lean, independent of world
        // coordinates. A hover gesture never moves the support or captures it.
        paint(9, reduced ? 0 : ((now - petStarted) % 950) / 950 * 15, "petted"); schedule(); return;
      }
      if (hoverPetting) { hoverPetting = false; if (hoverPoint) data("petting", "ready"); else el.removeAttribute("data-petting"); petting.reset(); }
      if (el.dataset.state === "petted" && effect.current) effect.current.textContent = "";
      if (afterPetLanding) { afterPetLanding = false; settle({ x, y }); }
      const foodGoalId = brain.current.foodGoal?.foodId;
      const lostGoalId = foodGoalId && food.current && !food.current.contains(foodGoalId) ? foodGoalId : undefined;
      if (lostGoalId) brain.current = recordCompanionEvent(brain.current, "food-lost");
      if (action?.foodId && !food.current?.foods().some(item => item.id === action!.foodId)) {
        // A folded/clipped/held snack still exists. Suspend its visual action
        // without treating a temporary unavailable support as a deleted meal.
        if (action.foodId !== lostGoalId && !food.current?.contains(action.foodId)) brain.current = recordCompanionEvent(brain.current, "food-lost");
        clearAction(); if (!supportedNow() && !(homeOccluded && isHomeSupport(support))) settle({ x, y }); nextDecision = now + 300;
      }
      if (!action && presence.phase === "active" && geometryReady && now >= nextDecision && (!isHomeSupport(support) || supportById(support))) {
        const occupied = supportById(support);
        const availableFood = accessibleCompanionFoods(food.current?.foods() ?? [], [...platforms, ...landingPlatforms]);
        const explicitSupports = landingPlatforms.filter(p => p.manualOnly && (p.id === occupied?.id || availableFood.some(item => item.platformId === p.id)));
        const worldPlatforms = explicitSupports.length ? [...platforms, ...explicitSupports] : platforms;
        const source = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]");
        hideCandidate = effective.ambientPrank && occupied?.kind === "card" && now - brain.current.createdAt >= 45000 ? collectCompanionHideTargets(page).find(target => target.element === source) : undefined;
        launch(getAction(brain.current, { x, y, platformId: support, platforms: worldPlatforms, width: innerWidth, height: innerHeight, hideAvailable: Boolean(hideCandidate), foods: availableFood, pointer }, effective, now), now);
        if (hiding) { paint(14, 0, "hide"); schedule(); return; }
      }
      let row = 0, frame = 0, status = "idle";
      if (action) {
        const age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        if (action.kind === "walk") { x = lerp(origin.x, action.target.x, sampleCompanionTravel(p)); row = 2; }
        else if (action.kind === "jump") {
          if (travel === -2) { const eased = sampleCompanionTravel(p), lift = boundCompanionSineArc(origin.y, action.target.y, reduced ? 0 : 60, size + 8); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(p * Math.PI) * lift; row = p < .5 ? 4 : p < .85 ? 5 : 6; frame = (p < .5 ? p * 2 : p < .85 ? (p - .5) / .35 : (p - .85) / .15) * 15; }
          else if (travel === -3) { const progress = clamp(p / .78, 0, 1), eased = sampleCompanionTravel(progress), lift = boundCompanionSineArc(origin.y, action.target.y, reduced ? 0 : 10, size + 8); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(progress * Math.PI) * lift; row = p < .78 ? 5 : 6; frame = (p < .78 ? progress : (p - .78) / .22) * 15; }
          else if (travel === -1) { x = lerp(origin.x, action.target.x, p); y = lerp(origin.y, action.target.y, p * p); row = p < .8 ? 5 : 6; frame = (p < .8 ? p / .8 : (p - .8) / .2) * 15; }
          else if (age < 180) { row = 3; frame = age / 180 * 15; }
          else if (age < 180 + travel) {
            const t = (age - 180) / 1000, progress = clamp((age - 180) / travel, 0, 1);
            const arc = boundCompanionBallisticArc(origin.y, action.target.y, .5 * 1100 * (travel / 1000) ** 2, size + 8);
            x = lerp(origin.x, action.target.x, progress); y = lerp(origin.y, action.target.y, progress) - arc.coefficient * progress * (1 - progress);
            const apex = arc.apexProgress * travel / 1000;
            row = t < apex ? 4 : 5; frame = (t < apex ? t / Math.max(.001, apex) : (t - apex) / Math.max(.001, travel / 1000 - apex)) * 15;
          } else { x = action.target.x; y = action.target.y; row = 6; frame = (age - 180 - travel) / 260 * 15; }
        } else if (action.kind === "sleep") {
          sleeping = true; row = age < 1000 ? 10 : total - age < 1100 ? 12 : 11;
          frame = row === 10 ? age / 1000 * 15 : row === 12 ? (age - total + 1100) / 1100 * 15 : 0;
          el.toggleAttribute("data-dreaming", row === 11);
        } else if (action.kind === "heart") {
          if (age < travel) { x = lerp(origin.x, action.target.x, sampleCompanionTravel(age / Math.max(1, travel))); row = 2; }
          else {
            const t = (age - travel) / action.duration; row = 13; frame = t * 15;
            y = origin.y + Math.max(0, Math.sin(t * Math.PI * 2)) * (reduced ? 0 : 18);
            if (t >= .25 && heartResult === null) {
              heartResult = !overlayActive && action.effectPoint ? hearts.attemptAt(action.effectPoint) : "missing";
              if (heartResult === "blocked") brain.current = recordCompanionEvent(brain.current, "heart-blocked");
              el.dataset.heartResult = heartResult;
              if (heartResult !== "missing") setAnnouncement(heartResult === "added" ? "빅타민이 보라 하트를 남겼어요. 관심 수에는 포함되지 않아요." : heartResult === "removed" ? "빅타민이 자기 보라 하트를 거두었어요." : "이미 있는 하트에 콩! 빅타민이 아쉬워해요.");
            }
            if (heartResult === "blocked" && t > .5) { row = 18; frame = Math.min(15, (t - .5) * 30); }
            if (effect.current) {
              effect.current.textContent = t > .25 && t < .85 ? heartResult === "blocked" ? "◌" : heartResult === "added" ? "♥" : "" : "";
              effect.current.style.setProperty("--vc-effect", `${-t * 25}px`);
              if (action.effectPoint) { effect.current.style.left = `${action.effectPoint.x - x + size / 2}px`; effect.current.style.top = `${action.effectPoint.y - y + size}px`; }
            }
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
      const mood = getCompanionMood(brain.current);
      if (mood === "disappointed" || mood === "sulky") {
        const moodRow = mood === "sulky" ? 19 : 18;
        spriteSources[moodRow].forEach(src => requestSprite.current(src));
        if (["idle", "look"].includes(status)) { row = moodRow; frame = reduced ? 0 : presentationNow % 1800 / 1800 * 15; }
      }
      data("mood", mood);
      paint(row, frame, status); schedule();
    };
    const schedule = () => {
      if (stopped || pause || hiding && !hideSeek.sample(presentationNow).active || !hiding && presence.phase === "parked" && !returning) return;
      if (reduced) timer = setTimeout(() => tick(performance.now()), 400);
      else {
        const moving = Boolean(returning || heldInertia.sample(performance.now()).active || pickupScale !== 1 && performance.now() - pickupAt < 200 || pendingMonth || pressed || keyboardHeld || action && ["walk", "jump", "heart", "hide", "stretch", "shake", "eat"].includes(action.kind));
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
    const overlayWindows = () => [...document.querySelectorAll<HTMLElement>(".agenda-detail-sheet,.pi-sheet,.modal-card-settings,.day-vod-modal")].filter(node => node.getClientRects().length > 0);
    const updateOverlayPerch = () => {
      overlayRaf = 0;
      if (stopped || pause || !overlayActive || overlayDrag) return;
      if (hiding && !hiding.sheet) { el.hidden = true; return; }
      const windows = overlayWindows();
      const changed = windows.length !== overlayObserved.size || windows.some(node => !overlayObserved.has(node));
      for (const node of overlayObserved) if (!windows.includes(node)) { overlayResize?.unobserve(node); overlayObserved.delete(node); }
      for (const node of windows) if (!overlayObserved.has(node)) { overlayObserved.add(node); overlayResize?.observe(node); }
      if (changed) { overlayMutation.disconnect(); windows.forEach(node => overlayMutation.observe(node, { attributes: true, attributeFilter: ["style", "class"] })); }
      const inside = hiding?.sheet?.isConnected ? findCompanionDetailPerch(hiding.sheet, size) : null;
      const next: CompanionOverlayPerch = inside ? { x: inside.x, y: inside.y, scale: inside.size / size, overlap: false } : placeCompanionOverlayPerch(overlayPerch ?? { x, y }, size, { width: innerWidth, height: innerHeight }, windows.map(node => node.getBoundingClientRect()));
      if (hiding?.sheet) data("hidePerch", inside ? "inside" : "outside");
      if (overlayPerch && next.x === overlayPerch.x && next.y === overlayPerch.y && next.scale === overlayPerch.scale) { if (el.hidden) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return; }
      const from = getComputedStyle(el).transform;
      perchAnimation?.cancel(); overlayPerch = next;
      paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
      // Same shared FLIP timing; flipSpring itself clears transform, whereas
      // this fixed world carrier must retain its complete translated matrix.
      if (!reduced && gfxMode() !== "off" && from !== "none") perchAnimation = el.animate([{ transform: from }, { transform: el.style.transform }], { duration: FLIP_MS, easing: FLIP_SPRING });
    };
    const queueOverlayPerch = () => { if (overlayActive && !pause && !overlayRaf) overlayRaf = requestAnimationFrame(updateOverlayPerch); };
    const releaseOverlayDrag = () => {
      const drag = overlayDrag; overlayDrag = undefined; el.removeAttribute("data-overlay-drag");
      if (drag && button.hasPointerCapture(drag.id)) button.releasePointerCapture(drag.id);
    };
    const overlayResize = new ResizeObserver(queueOverlayPerch);
    const overlayMutation = new MutationObserver(queueOverlayPerch);
    // This observer exists only while one card owns the hiding session. A
    // scroll/clipped card remains the same source; actual deletion/re-gating
    // cancels it without a periodic geometry or brain loop.
    const hideObserver = new MutationObserver(() => {
      if (!hiding || hideValid()) return;
      resetHide(); clearAction(); lastTick = lastNeeds = lastCare = performance.now(); nextDecision = lastTick + 600;
      sync(); if (!pause) { if (overlayActive) { presence.focus(false, lastTick); queueOverlayPerch(); } else { connectGeometry(); hearts.pause(presence.phase === "parked"); } cancelAnimationFrame(raf); clearTimeout(timer); schedule(); }
    });
    const sync = () => {
      hideClock(performance.now());
      const html = document.documentElement;
      const wantsOverlay = overlayRef.current;
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause") && hasAmbientPauseOutside("poster-window");
      if (hiding && !hideValid()) resetHide();
      if (hiding && !(hiding.sheet && !wantsOverlay)) {
        clearTimeout(hideWakeTimer);
        cancelAnimationFrame(raf); clearTimeout(timer); cancelAnimationFrame(followRaf); followRaf = 0;
        offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true);
        pause = next; started = true; overlayActive = wantsOverlay; setSuspended(next); food.current?.pause(next || wantsOverlay);
        lastTick = lastNeeds = lastCare = lastPaint = performance.now();
        if (next || wantsOverlay && !hiding.sheet) { el.hidden = true; return; }
        if (hiding.sheet) updateOverlayPerch();
        paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        if (hideSeek.sample(presentationNow).phase === "hidden") armHideWake();
        schedule(); return;
      }
      if (hiding?.sheet && !wantsOverlay) resetHide();
      const overlayChanged = wantsOverlay !== overlayActive;
      if (overlayChanged) {
        const shown = el.hidden ? { x, y, scale: 1 } : displayedPoint();
        const wasAsleep = presence.phase === "parked" || presence.phase === "yawning" || action?.kind === "sleep";
        // A native tap may scroll its card into view before the window opens.
        // Carry that final anchor delta now, and retain the disposed follow
        // snapshot to restore any layout delta before reconnecting on close.
        if (wantsOverlay) refreshAnchors(performance.now());
        overlayActive = wantsOverlay;
        if (!overlayActive) refreshAnchors(performance.now());
        const held = Boolean(pressed || keyboardHeld || placing);
        stopHover(); releaseHold(); releaseOverlayDrag(); placing = overlayPlacing = false; delete el.dataset.placing;
        if (held) { clearAction(); settle({ x, y }); }
        consumePlacementClick = false; placementPointer = null; clearTimeout(clickGuard);
        clearTimeout(parkedLayoutTimer); cancelAnimationFrame(followRaf); followRaf = 0;
        offGeometry?.(); offGeometry = undefined; geometryReady = false;
        perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0;
        if (overlayActive) {
          // Finish an authored action, then reuse blur's quiet rest. Ordinary
          // windows never tear down/reseed the creature or steal modal input.
          returning = undefined; el.removeAttribute("data-returning");
          pickupScale = 1; pickupOffset = { x: 0, y: 0 };
          overlayPerch = { ...shown, overlap: false }; presence.focus(false, performance.now()); hearts.pause(true);
        } else {
          // Keep the visible perch until the real world has been revalidated.
          // Closing explicitly supersedes a quiet/unfinished action, rather
          // than resuming a stale jump/food timer underneath the waking pose.
          clearAction(); petUntil = 0; afterPetLanding = restAfterLanding = false; pendingMonth = false;
          supportMotion.reset(); pickupScale = 1; pickupOffset = { x: 0, y: 0 }; returnTargetValid = false;
          returning = createCompanionOverlayReturn(shown, performance.now(), wasAsleep, FLIP_MS);
          data("returning", "wake");
          overlayPerch = undefined; presence.focus(document.hasFocus(), performance.now());
          lastTick = lastNeeds = lastCare = lastPaint = performance.now();
          el.removeAttribute("data-dreaming");
        }
      }
      food.current?.pause(next || overlayActive);
      if (next === pause && started) {
        if (overlayChanged && !pause) {
          if (overlayActive) updateOverlayPerch();
          else { connectGeometry(); hearts.pause(presence.phase === "parked"); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); }
          cancelAnimationFrame(raf); clearTimeout(timer); schedule();
        }
        return;
      }
      started = true; pause = next; setSuspended(next); if (next) el.hidden = true;
      if (pause) releaseOverlayDrag();
      if (pause) { overlayPlacing = false; delete el.dataset.placing; }
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); lastNeeds = lastTick; lastPaint = lastTick;
      if (pause) { returning = undefined; el.removeAttribute("data-returning"); pickupScale = 1; perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0; stopHover(); needsLanding = action?.kind === "jump" || Boolean(pressed) || keyboardHeld || afterPetLanding; afterPetLanding = false; restAfterLanding = false; supportMotion.reset(); style(reactionLayer, "transform", "translate3d(0,0px,0) scale(1,1)"); saveCompanionCare(brain.current, true); clearAction(); clearTimeout(parkedLayoutTimer); offGeometry?.(); offGeometry = undefined; geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(followRaf); followRaf = 0; geometryReady = false; hearts.pause(true); releaseHold(); placing = false; delete el.dataset.placing; setHomeExpanded(false); }
      else { presence.focus(!overlayActive && document.hasFocus(), lastTick); if (overlayActive) updateOverlayPerch(); else connectGeometry(); hearts.pause(overlayActive || presence.phase === "parked"); if (needsLanding) { needsLanding = false; settle({ x, y }); } nextDecision = performance.now() + 600; if (presence.phase !== "parked") schedule(); }
    };
    const focusChanged = () => {
      if (pause) return;
      if (hiding) { presence.focus(!overlayActive && document.hasFocus(), performance.now()); lastNeeds = lastCare = performance.now(); return; }
      const now = performance.now(), wasParked = presence.phase === "parked";
      presence.focus(!overlayActive && document.hasFocus(), now);
      if (!document.hasFocus()) {
        resetInertia();
        const liftedDisplay = Boolean(overlayDrag);
        releaseOverlayDrag();
        if (liftedDisplay) updateOverlayPerch();
        stopHover();
        // A held pointer/placement has no natural endpoint; release it and
        // finish a short landing rather than leaving a dangling capture.
        if (pressed || keyboardHeld || placing) { clearAction(); releaseHold(); placing = false; delete el.dataset.placing; settle({ x, y }); }
      } else if (wasParked && !overlayActive) {
        cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(parkedLayoutTimer);
        lastTick = lastNeeds = lastCare = lastPaint = now;
        el.removeAttribute("data-dreaming");
        connectGeometry(); hearts.pause(false); schedule();
      }
      if (document.hasFocus()) lastNeeds = now;
    };
    const down = (event: PointerEvent) => {
      if (hiding || pause || pressed || event.button !== 0 || (!preferences.drag && !preferences.petting)) return;
      if (overlayActive) {
        if (!preferences.drag || overlayDrag) return;
        el.dataset.pointerFocus = "";
        // A decorative lift owns only this pointer. Keep the modal's focus,
        // saved world support and sleeping planner untouched.
        const shown = displayedPoint(); perchAnimation?.cancel();
        overlayPerch = { ...shown, overlap: overlayPerch?.overlap ?? false };
        overlayDrag = { id: event.pointerId, dx: event.clientX - shown.x, dy: event.clientY - shown.y };
        event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId);
        data("overlayDrag", ""); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        return;
      }
      interruptReturn();
      stopHover(); awaitingAtX = false;
      const now = performance.now();
      // Direct handling supersedes the800ms passive wake. Otherwise that
      // branch can hide a captured creature as soon as it leaves its ledge.
      presence.focus(document.hasFocus(), now, true); data("presence", presence.phase);
      event.preventDefault(); event.stopPropagation(); button.focus({ preventScroll: true }); button.setPointerCapture(event.pointerId);
      el.dataset.pointerFocus = "";
      restAfterLanding = false; afterPetLanding = false;
      petUntil = 0;
      pendingMonth = false; supportMotion.reset();
      // The grip remains under the pointer while the body lags around it.
      // This layer precedes facing, so horizontal turns never mirror inertia.
      // A new hand owns a fresh grip, not the previous release's spring tail.
      resetInertia();
      grip = { x: clamp(event.clientX - x + size / 2, 0, size), y: clamp(event.clientY - y + size, 0, size) };
      style(inertiaLayer, "transform-origin", `${grip.x}px ${grip.y}px`);
      clearAction(); pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dx: event.clientX - x, dy: event.clientY - y, dragged: false, grabbed: false, cancelled: false };
      connectGeometry();
      paint(1, 0, "touch");
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastPaint = now; schedule();
    };
    const move = (event: PointerEvent) => {
      if (overlayDrag?.id === event.pointerId && overlayPerch) {
        const scaled = size * overlayPerch.scale;
        overlayPerch = { ...overlayPerch, x: clamp(event.clientX - overlayDrag.dx, scaled / 2 + 4, innerWidth - scaled / 2 - 4), y: clamp(event.clientY - overlayDrag.dy, scaled + 4, innerHeight - 4) };
        paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return;
      }
      if (!pressed) { hover(event); return; }
      if (pressed.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      if (!preferences.drag && distance > 6) pressed.cancelled = true;
      if (preferences.drag && (pressed.grabbed || distance > 6)) {
        const previousX = x, previousY = y;
        pressed.grabbed = true;
        pressed.dragged = true; x = clamp(event.clientX - pressed.dx, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(event.clientY - pressed.dy, size + 8, innerHeight - 12);
        if (reduced || gfxMode() === "off") resetInertia();
        else heldInertia.push(x - previousX, y - previousY, performance.now());
        paint(8, 0, "held");
      }
    };
    const up = (event: PointerEvent) => {
      if (overlayDrag?.id === event.pointerId) { releaseOverlayDrag(); updateOverlayPerch(); return; }
      if (!pressed || pressed.id !== event.pointerId) return;
      const held = pressed; pressed = null;
      if (event.type === "pointercancel" || held.cancelled) resetInertia();
      el.removeAttribute("data-grab-ready");
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (held.dragged) { brain.current = recordCompanionEvent(brain.current, "dragged"); settle({ x, y }); }
      else if (!held.cancelled && !held.grabbed && event.type !== "pointercancel") affection();
      else settle({ x, y });
    };
    const lostCapture = (event: PointerEvent) => {
      if (overlayDrag?.id === event.pointerId) { releaseOverlayDrag(); updateOverlayPerch(); return; }
      if (stopped || pause || !pressed || pressed.id !== event.pointerId) return;
      pressed.cancelled = true; up(event);
    };
    const key = (event: KeyboardEvent) => {
      if (hiding) return;
      el.removeAttribute("data-pointer-focus");
      if (pause || overlayActive) return;
      const owns = event.key === "Escape" || event.key === "Enter" && preferences.petting || (event.key === " " || event.key.toLowerCase() === "p") && preferences.drag || event.key.toLowerCase() === "n" && preferences.sleep || keyboardHeld && event.key.startsWith("Arrow");
      if (owns) { event.preventDefault(); event.stopPropagation(); }
      if (owns) interruptReturn();
      if (owns) stopHover();
      if (owns) { presence.focus(document.hasFocus(), performance.now(), true); data("presence", presence.phase); }
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      if (event.key === "Enter" && preferences.petting) { event.preventDefault(); affection(); }
      else if (event.key.toLowerCase() === "p" && preferences.drag && !event.repeat) control.current?.place();
      else if (event.key.toLowerCase() === "n" && preferences.sleep && !event.repeat) control.current?.rest();
      else if (event.key === " " && preferences.drag) { event.preventDefault(); awaitingAtX = false; pendingMonth = false; clearAction(); supportMotion.reset(); keyboardHeld = !keyboardHeld; if (!keyboardHeld) settle({ x, y }); }
      else if (event.key === "Escape") { event.preventDefault(); pendingMonth = false; keyboardHeld = false; placing = false; delete el.dataset.placing; settle({ x, y }); }
      else if (keyboardHeld && event.key.startsWith("Arrow")) { event.preventDefault(); x = clamp(x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), size + 8, innerHeight - 12); }
      if (owns) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastPaint = performance.now(); schedule(); }
    };
    const keyboardModality = () => { el.removeAttribute("data-pointer-focus"); };
    const place = (event: PointerEvent) => {
      if (!el.contains(event.target as Node)) stopHover();
      if (!pause && overlayActive && overlayPlacing && !el.contains(event.target as Node)) {
        overlayPlacing = false; delete el.dataset.placing;
        // A two-tap alternative to dragging; ordinary dialog controls always
        // retain their own input and never become accidental placement sites.
        if ((event.target as Element | null)?.closest("button,a,input,select,textarea,[role='button']")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        consumePlacementClick = true; placementPointer = event.pointerId; clearTimeout(clickGuard);
        overlayPerch = placeCompanionOverlayPerch({ x: event.clientX, y: event.clientY, scale: overlayPerch?.scale }, size, { width: innerWidth, height: innerHeight }, overlayWindows().map(node => node.getBoundingClientRect()));
        perchAnimation?.cancel(); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return;
      }
      if (pause || overlayActive || !placing || el.contains(event.target as Node)) return;
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
    const sensePointer = (event: PointerEvent) => {
      if (!pause && !overlayActive && event.pointerType !== "touch") {
        pointer = { x: event.clientX, y: event.clientY };
        // Hover can reach the whole body without an enlarged hitbox stealing adjacent
        // calendar/window buttons. Reuse this existing passive pointer sensor.
        if (!el.contains(event.target as Node)) {
          if (isOtherControl(event.target)) stopHover();
          else hover(event);
        }
      }
    };
    const onGeometry = (next: Platform[]) => {
      if (overlayActive || hiding) return;
      const widthChanged = measuredWidth !== innerWidth;
      measuredWidth = innerWidth;
      geometryReady = true;
      if (returning) returnTargetValid = false;
      refreshAnchors(performance.now());
      // A full scan revalidates safe spans; scrolling itself was already
      // carried per-frame by its actual anchor, including nested/fixed panels.
      platforms = next.filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      landingPlatforms = [...(geometryTracker?.landings() ?? [])].filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      food.current?.sync(platforms, id => geometryTracker?.anchor(id), geometryTracker?.landings(32));
      if (pendingMonth) return;
      // Geometry may refresh during a captured drag or keyboard placement.
      // Publish new supports, but input alone owns the displayed world point.
      if (pressed || keyboardHeld || placing) return;
      homeOccluded = false;
      const residesAtHome = isHomeSupport(support) && !pressed && !keyboardHeld && !placing && !afterPetLanding && (!action || isHomeSupport(action.target.platformId ?? "")) && action?.kind !== "jump";
      if (residesAtHome) {
        const floor = isHomeFloor(support);
        const home = document.querySelector<HTMLElement>(floor ? ".vc-home-floor" : ".vc-home-cushion");
        const occludeResident = () => {
          homeOccluded = true; stopHover(); if (!returning) el.hidden = true;
          if (presence.phase === "parked") { offGeometry?.(); offGeometry = undefined; geometryReady = false; }
        };
        if (home?.closest(".vc-home")?.hasAttribute("data-panel-collapsed")) {
          occludeResident(); return;
        }
        const rect = home?.isConnected ? home.getBoundingClientRect() : undefined;
        // A closed compact room or a temporary portal gap still owns its
        // resident. Wait for the same room, rather than choosing a calendar.
        if (!rect || rect.width <= 0 || rect.height <= 0) { occludeResident(); return; }
        if (rect && rect.width > 0 && rect.height > 0) {
          const floorSupports = floor ? landingPlatforms.filter(p => isHomeFloor(p.id)) : [];
          const safe = floor ? nearestVerticalCompanionSupport({ x, y: rect.bottom - COMPANION_HOME_FLOOR_INSET }, floorSupports) ?? nearestPlatform({ x, y }, floorSupports) : platforms.find(p => p.id === "companion-home");
          const homeX = safe ? platformLandingX(safe, x) : clamp(x, rect.left + rect.width * .25, rect.right - rect.width * .25);
          const homeY = floor ? rect.bottom - COMPANION_HOME_FLOOR_INSET : rect.top;
          const dx = homeX - x, dy = homeY - y;
          x = homeX; y = homeY; carrier.x += dx; carrier.y += dy;
          if (safe) { support = safe.id; if (action) action.target.platformId = safe.id; }
          if (action) { origin.x += dx; origin.y += dy; action.target.x += dx; action.target.y += dy; }
          supportMotion.reset();
          // A house scrolling outside the viewport still owns its resident.
          // Hide the clipped frame; never turn the calendar into its new bed.
          if (!safe) {
            homeOccluded = true;
            paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
            if (!returning) { stopHover(); el.hidden = true; }
            if (presence.phase === "parked") { offGeometry?.(); offGeometry = undefined; geometryReady = false; }
            return;
          }
        }
      }
      const resolve = (id: string, point: { x: number; y: number }) => {
        const exact = supportById(id);
        if (isHomeSupport(id) && exact) return exact;
        if (exact && Math.abs(point.y - exact.y) <= 3 && point.x >= exact.x && point.x <= exact.x + exact.width) return exact;
        const group = id.match(/^(?:card|date)-\d+/)?.[0];
        return group ? nearestVerticalCompanionSupport(point, platforms.filter(p => (p.id === group || p.id.startsWith(`${group}-`)) && Math.abs(point.y - p.y) <= 3)) : undefined;
      };
      if (returning) {
        // Closing a window may unlock scroll/reflow before this delivery.
        // Prefer the retained DOM span's identity, not its old y coordinate.
        const retained = supportById(support);
        const p = retained
          ?? nearestVerticalCompanionSupport({ x, y }, platforms)
          ?? (widthChanged || !worldSeeded ? nearestPlatform({ x, y }, platforms) : undefined);
        awaitingAtX = !p;
        if (p) { x = retained ? clamp(x, p.x, p.x + p.width) : platformLandingX(p, x); y = p.y; support = p.id; returnTargetValid = true; }
        refreshAnchors(performance.now());
        return;
      }
      if (presence.phase === "parked") {
        const old = resolve(support, { x, y });
        const p = old ?? nearestVerticalCompanionSupport({ x, y }, platforms) ?? (widthChanged ? nearestPlatform({ x, y }, platforms) : undefined);
        clearAction();
        awaitingAtX = !p;
        if (p) { support = p.id; if (widthChanged) x = platformLandingX(p, x); y = p.y; paint(11, 0, "sleep"); el.dataset.dreaming = ""; }
        else { support = ""; stopHover(); el.hidden = true; }
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
      if (!hiding && !overlayActive && !offGeometry) {
        geometryReady = false;
        geometryTracker = offGeometry = observeCompanionPlatforms(page, onGeometry, { size, identity: geometryIdentity, getHome: () => document.querySelector<HTMLElement>(".vc-home-cushion") });
      }
    };
    const parkedLayout = () => {
      if (hiding || pause || overlayActive || presence.phase !== "parked") return;
      clearTimeout(parkedLayoutTimer);
      parkedLayoutTimer = setTimeout(() => { if (!pause && presence.phase === "parked") connectGeometry(); }, 120);
    };
    const panelChanged = (event: Event) => {
      if (hiding || overlayActive) return;
      if (isHomeSupport(support) && document.querySelector(".vc-home[data-panel-collapsed]")) {
        homeOccluded = true; el.hidden = true; stopHover();
      }
      parkedLayout(); followLayout(event);
    };
    const spriteDecoded = () => { if (!pause) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); };
    const detailChanged = (event: Event) => {
      hideClock(performance.now());
      const notice = (event as CustomEvent<CompanionDetailNotice>).detail;
      detailSheet = notice?.sheet instanceof HTMLElement && notice.sheet.isConnected && notice.sheet.matches(".agenda-detail-sheet") && notice.sheet.dataset.companionDetailEvent === notice.eventId ? notice.sheet : null;
      if (hiding?.sheet && (!detailSheet || detailSheet.dataset.companionDetailEvent !== hiding.target.eventId)) {
        // A reused sheet is a new window owner. A found guest must not leak
        // into another event while React keeps overlayOpen=true.
        resetHide(); clearAction(); presence.focus(false, performance.now());
        lastTick = lastNeeds = lastCare = performance.now(); queueOverlayPerch();
        cancelAnimationFrame(raf); clearTimeout(timer); schedule(); return;
      }
      if (!hiding || !detailSheet || detailSheet.dataset.companionDetailEvent !== hiding.target.eventId || !hideValid()) return;
      if (hideSeek.find(hiding.target.eventId, presentationNow)) {
        hiding.sheet = detailSheet; clearAction(); stopHover();
        data("hidePhase", "found"); button.tabIndex = -1;
        setAnnouncement("찾았다! 빅타민이 일정 안에서 반겨요.");
        sync();
      } else if (hiding.sheet) queueOverlayPerch();
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase", "data-ambient-pause", "data-gfx"] });
    observer.observe(page, { attributes: true, attributeFilter: ["inert"] });
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", place, true); document.addEventListener("click", click, true);
    window.addEventListener("blur", focusChanged); window.addEventListener("focus", focusChanged);
    window.addEventListener("vic:companion-overlay", sync);
    window.addEventListener("vic:companion-sprite", spriteDecoded);
    window.addEventListener(COMPANION_DETAIL_EVENT, detailChanged);
    window.addEventListener("resize", queueOverlayPerch, { passive: true });
    document.addEventListener("animationend", queueOverlayPerch, true);
    window.addEventListener("resize", parkedLayout, { passive: true }); window.addEventListener("scroll", parkedLayout, { passive: true, capture: true }); window.addEventListener("vic:companion-home", parkedLayout);
    window.addEventListener("scroll", followLayout, { passive: true, capture: true }); window.addEventListener("vic:companion-home", followLayout); window.addEventListener("vic:side-panel", followLayout);
    window.addEventListener("vic:panel-section", panelChanged);
    window.visualViewport?.addEventListener("scroll", followLayout, { passive: true });
    document.addEventListener("pointerup", placementReleased, true); document.addEventListener("pointercancel", placementReleased, true);
    document.addEventListener("pointermove", sensePointer, { passive: true });
    document.addEventListener("pointerout", outsideDocument, { passive: true });
    document.addEventListener("keydown", keyboardModality, true);
    button.addEventListener("pointerdown", down); button.addEventListener("pointermove", move); button.addEventListener("pointerleave", leave); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("lostpointercapture", lostCapture); button.addEventListener("keydown", key);
    sync();
    return () => {
      lastPose.current = { x, y, monthKey, seeded: worldSeeded || Boolean(supportById(support)), atHome: isHomeSupport(support) && (homeOccluded || supportedNow()) && !pressed && !keyboardHeld && action?.kind !== "jump", homeSupportId: isHomeSupport(support) ? support : undefined };
      saveCompanionCare(brain.current, true);
      stopped = true; resetHide(); resetInertia(); returning = undefined; el.removeAttribute("data-returning"); stopHover(); cancelAnimationFrame(followRaf); geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearTimeout(parkedLayoutTimer); clearAction(); control.current = null; observer.disconnect(); offGeometry?.(); hearts.dispose();
      releaseOverlayDrag(); perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf);
      window.removeEventListener("vic:companion-overlay", sync); window.removeEventListener("resize", queueOverlayPerch); document.removeEventListener("animationend", queueOverlayPerch, true);
      window.removeEventListener("vic:companion-sprite", spriteDecoded);
      window.removeEventListener(COMPANION_DETAIL_EVENT, detailChanged);
      window.removeEventListener("blur", focusChanged); window.removeEventListener("focus", focusChanged);
      window.removeEventListener("resize", parkedLayout); window.removeEventListener("scroll", parkedLayout, true); window.removeEventListener("vic:companion-home", parkedLayout);
      window.removeEventListener("scroll", followLayout, true); window.removeEventListener("vic:companion-home", followLayout); window.removeEventListener("vic:side-panel", followLayout); window.visualViewport?.removeEventListener("scroll", followLayout);
      window.removeEventListener("vic:panel-section", panelChanged);
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); document.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      document.removeEventListener("pointermove", sensePointer);
      document.removeEventListener("pointerout", outsideDocument);
      document.removeEventListener("keydown", keyboardModality, true);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerleave", leave); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("lostpointercapture", lostCapture); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
    };
  }, [ready, root, preferences, blocked, agenda, monthKey, reduced, geometryIdentity]);

  if (!ready) return null;
  const closeHome = () => { setHomeExpanded(false); };
  const act = (kind: CompanionHomeAction) => { control.current?.[kind](); };
  const house = <CompanionHome care={care} preferences={preferences} inactive={overlayOpen} onAction={act} onClose={homeVisible ? undefined : closeHome} />;
  return createPortal(<><div className="vc-companion" ref={body} hidden data-sfx="off" data-size="large" data-overlay={overlayOpen ? "quiet" : undefined}>
    <span className="vc-contact-shadow" ref={shadow} aria-hidden="true" />
    <button className="vc-actor" ref={actor} type="button" tabIndex={overlayOpen ? -1 : 0} data-sfx="off" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space P N ArrowUp ArrowDown ArrowLeft ArrowRight Escape" onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); control.current?.place(); }}><span className="vc-inertia" ref={inertia} aria-hidden="true"><span className="vc-facing" ref={facing}><span className="vc-reaction" ref={reaction}><span className="vc-contact" ref={contact}><span className="vc-pose" ref={pose}><span className="vc-sprite" ref={sprite} /></span></span></span></span></span><span className="vc-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span></button>
    <span className="vc-effect" ref={effect} aria-hidden="true" />
    <span className="vc-affection-hearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></span>
    <span className="vc-petting-hand" ref={pettingHand} aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M10 26c-3-3-5-6-6-9-1-2 1-4 3-2l3 3-1-9c0-3 3-4 4-1l1 6V6c0-3 4-3 4 0v8l1-6c1-3 4-2 4 1l-1 8 2-3c2-2 4 0 2 3l-4 7c-1 2-3 4-6 4h-3Z"/><path className="vc-hand-fold" d="M11 21c2-2 5-2 7 0"/><path className="vc-hand-cuff" d="M10 27h11v4H10Z"/></svg></span>
    <span className="sr-only" id="vc-help">빅타민의 머리나 몸통에서 마우스를 좌우로 움직이거나 눌러서 쓰다듬기. 끌어서 옮기기. 두 번 누른 뒤 놓을 곳 선택. Enter 쓰다듬기. 스페이스로 집고 방향키로 옮긴 뒤 스페이스나 Escape로 놓기. P로 위치 선택. N으로 낮잠.</span>
    <span className="sr-only" role="status">{announcement}</span>
  </div><CompanionFood ref={food} enabled={preferences.feeding} blocked={blocked || overlayOpen} monthKey={monthKey} returnFocus={() => { if (!overlayRef.current && !body.current?.hidden) actor.current?.focus({ preventScroll: true }); }} />
    {!suspended && !blocked ? homeVisible && homeHost ? createPortal(house, homeHost) : <div className="vc-compact-home" data-agenda={agenda ? "" : undefined} inert={overlayOpen ? true : undefined} aria-hidden={overlayOpen ? true : undefined} data-sfx="off" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeHome(); } }}>
      {homeExpanded ? house : <button ref={homeLauncher} data-home-action="launcher" type="button" className="button vc-home-launcher" aria-label="빅타민 집 열기" aria-expanded={false} onClick={() => setHomeExpanded(true)}><Home size={16} aria-hidden="true" />빅타민 집</button>}
    </div> : null}
  </>, document.body);
}
