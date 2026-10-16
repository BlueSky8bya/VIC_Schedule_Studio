"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Home } from "lucide-react";
import { logActivity } from "@/lib/activity/client";
import { COMPANION_CLIP_TIMING, COMPANION_TIMING, companionPlayDuration } from "@/lib/ui/viewer-companion/timing";
import { getCompanionArrivalPlay } from "@/lib/ui/viewer-companion/arrival-play";
import { companionAttentionPoint, deliberateCompanionAction } from "@/lib/ui/viewer-companion/deliberation";
import { advanceBrain, commitAction, createBrain, getAction, getCompanionMood, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionGeometryIdentity, observeCompanionPlatforms, type CompanionGeometrySubscription } from "@/lib/ui/viewer-companion/geometry";
import { COMPANION_DETAIL_EVENT, collectCompanionHideTargets, type CompanionDetailNotice, type CompanionHideTarget } from "@/lib/ui/viewer-companion/hide-targets";
import { createCompanionHideSeek } from "@/lib/ui/viewer-companion/hide-seek";
import { findCompanionDetailPerch } from "@/lib/ui/viewer-companion/detail-perch";
import { companionPremiereMoment, companionPremiereReturn, COMPANION_PREMIERE_ENTER_MS, type CompanionPremiereCue } from "@/lib/ui/viewer-companion/premiere";
import { sampleCompanionPremiereTravel } from "@/lib/ui/viewer-companion/premiere-travel";
import { syncedNow } from "@/lib/ui/synced-clock";
import { premiereViewportBounds } from "@/lib/ui/premiere/panel-departure";
import { companionSofaDepth, companionSofaRelease, type CompanionSofaDepth, type CompanionSofaPoint } from "@/lib/ui/viewer-companion/sofa";
import { projectCompanionSofaBody } from "@/lib/ui/viewer-companion/sofa-pose";
import { sampleCompanionSofaTravel } from "@/lib/ui/viewer-companion/sofa-travel";
import { companionPositionPoint, resolveCompanionPosition, type CompanionPositionMemory, type CompanionPositionSnapshot } from "@/lib/ui/viewer-companion/position-memory";
import { companionGripProfile } from "@/lib/ui/viewer-companion/contact-grip";
import { DEFAULT_COMPANION_CARE, loadCompanionCare, saveCompanionCare, subscribeCompanionHabits } from "@/lib/ui/viewer-companion/care";
import { learnCompanionHabits, type CompanionExperience } from "@/lib/ui/viewer-companion/habits";
import { createCompanionHearts } from "@/lib/ui/viewer-companion/hearts";
import { boundCompanionHangingPose, createCompanionMotion, nextCompanionPaint, sampleCompanionTravel } from "@/lib/ui/viewer-companion/motion";
import { createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { placeCompanionOverlayPerch, type CompanionOverlayPerch } from "@/lib/ui/viewer-companion/overlay-perch";
import { createCompanionOverlayReturn, type CompanionReturnPoint } from "@/lib/ui/viewer-companion/overlay-return";
import { FLIP_MS } from "@/lib/ui/flip-motion";
import { hasAmbientPauseOutside } from "@/lib/ui/ambient-pause";
import { createCompanionSupportMotion } from "@/lib/ui/viewer-companion/support-motion";
import { boundCompanionHeldPose, createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";
import { firstCompanionSupportBelow, nearestVerticalCompanionSupport } from "@/lib/ui/viewer-companion/support-landing";
import { boundCompanionBallisticArc, boundCompanionSineArc } from "@/lib/ui/viewer-companion/jump-arc";
import { createCompanionPettingContact, createCompanionPettingGesture, createCompanionPettingWindow } from "@/lib/ui/viewer-companion/petting";
import { randomCompanionFood, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { companionSpriteMetadata as registration, companionSpriteSources, decodeCompanionSprite, isCompanionSpriteDecoded, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionTapReaction, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { COMPANION_CARD_PLAY_EVENT, createCompanionCardPlay } from "@/lib/ui/viewer-companion/card-play";
import { requestCompanionPanelSide } from "@/lib/ui/viewer-companion/panel-play";
import { gfxMode as readGfxMode } from "@/lib/ui/gfx";
import { hapticSuccess } from "@/lib/ui/haptics";
import { playSfx } from "@/lib/ui/sfx";
import { CompanionFood, type CompanionFoodControl } from "./companion-food";
import { CompanionBedForeground, CompanionHome, type CompanionHomeAction } from "./companion-home";
import "./viewer-companion.css";

type Props = { root: RefObject<HTMLElement | null>; preferences: CompanionPreferences; blocked: boolean; overlayOpen: boolean; workspaceBusy?: boolean; agenda: boolean; monthKey: string; reduced: boolean; homeHost: HTMLElement | null; homeVisible: boolean; premiereCue?: CompanionPremiereCue | null; onPremiereJoin?: (generation: string, id: string) => void; positionMemory?: CompanionPositionMemory };
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
export default function ViewerCompanion({ root, preferences, blocked, overlayOpen, workspaceBusy = false, agenda, monthKey, reduced, homeHost, homeVisible, premiereCue = null, onPremiereJoin, positionMemory }: Props) {
  const actorId = useId();
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), reaction = useRef<HTMLSpanElement>(null), facing = useRef<HTMLSpanElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const pettingHand = useRef<HTMLSpanElement>(null);
  const contact = useRef<HTMLSpanElement>(null);
  const inertia = useRef<HTMLSpanElement>(null);
  const bedForeground = useRef<HTMLDivElement>(null);
  const control = useRef<Control | null>(null), brain = useRef(createBrain(performance.now()));
  const food = useRef<CompanionFoodControl>(null), careLoaded = useRef(false);
  const homeLauncher = useRef<HTMLButtonElement>(null);
  const compactHome = useRef<HTMLDivElement>(null);
  const homeFocus = useRef<string | null>(null);
  const lastPose = useRef<{ x: number; y: number; monthKey: string; atHome: boolean; homeSupportId?: string; seeded: boolean } | null>(null);
  const capturePosition = useRef<(() => void) | null>(null);
  const pendingPosition = useRef<CompanionPositionSnapshot | null>(null);
  // Layout cleanup runs before the old calendar/house DOM disappears. The
  // ordinary passive cleanup must not overwrite a new surface's memory.
  useLayoutEffect(() => () => { capturePosition.current?.(); }, [positionMemory]);
  const lastFood = useRef<CompanionFoodKind | undefined>(undefined);
  const overlayRef = useRef(overlayOpen);
  const workspaceBusyRef = useRef(workspaceBusy);
  workspaceBusyRef.current = workspaceBusy;
  const premiereRef = useRef({ cue: premiereCue, onJoin: onPremiereJoin });
  premiereRef.current = { cue: premiereCue, onJoin: onPremiereJoin };
  const premiereMemory = useRef({ generation: "", monthKey, joined: false, entryId: "", consumedExit: 0 });
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
  }, [homeHost, homeVisible, homeExpanded, suspended, overlayOpen, premiereCue?.owner]);
  // A window changes presentation, never the creature's identity or world.
  // Notify the stable imperative runtime after the dialog DOM has committed.
  useLayoutEffect(() => { window.dispatchEvent(new Event("vic:companion-overlay")); }, [overlayOpen]);
  // A studio edit gesture gates competing input, without remounting this
  // runtime or dropping the creature's current physical support.
  useLayoutEffect(() => { window.dispatchEvent(new Event("vic:companion-workspace")); }, [workspaceBusy]);
  const premiereItemsKey = premiereCue?.items.map(item => `${item.id}:${item.state}:${item.revealAt}`).join("|");
  useLayoutEffect(() => { window.dispatchEvent(new Event("vic:companion-premiere")); }, [premiereCue?.generation, premiereCue?.phase, premiereCue?.target, premiereCue?.exit?.token, premiereItemsKey]);
  useLayoutEffect(() => {
    const holder = compactHome.current, launcher = homeLauncher.current, page = root.current;
    if (!agenda || !holder || !page || suspended) return;
    const rail = page.querySelector<HTMLElement>(".agenda-legend-rail,.agenda-rail");
    if (!rail) return;
    // Reserve one ordinary44px rail control plus its existing8px flex gap.
    // The shared house stays fixed/portalled without covering records below it.
    rail.setAttribute("data-companion-launcher-space", "");
    const controls = [...rail.querySelectorAll<HTMLElement>(".button,.actor-badge-wrap,.m-rail-insights,.agenda-legend-nav button,.agenda-legend-nav a")].filter(node => !node.closest(".panel-section,.agenda-legend,.vc-home") && node.getClientRects().length).slice(0, 24);
    let frame = 0, disposed = false;
    const measure = () => {
      frame = 0;
      if (!launcher || !controls.length) return;
      const bounds = controls.map(node => node.getBoundingClientRect()), own = launcher.getBoundingClientRect();
      const viewport = premiereViewportBounds({ clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, visualViewport: window.visualViewport });
      const right = Math.max(...bounds.map(rect => rect.right)), bottom = Math.max(...bounds.map(rect => rect.bottom));
      holder.style.setProperty("--vc-launcher-right", `${Math.max(4, viewport.right - right)}px`);
      holder.style.setProperty("--vc-launcher-top", `${clamp(bottom + 8, viewport.top + 4, Math.max(viewport.top + 4, viewport.bottom - own.height - 8))}px`);
    };
    const queue = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure); };
    const layoutAnimation = (event: AnimationEvent) => { if (event.target instanceof Element && (rail.contains(event.target) || event.target.contains(rail))) queue(); };
    const observer = new ResizeObserver(queue);
    observer.observe(rail); controls.forEach(node => observer.observe(node));
    measure();
    window.addEventListener("resize", queue, { passive: true }); window.addEventListener("scroll", queue, { passive: true, capture: true }); window.addEventListener("vic:panel-section", queue); window.addEventListener("vic:side-panel", queue);
    document.addEventListener("animationend", layoutAnimation, true);
    window.visualViewport?.addEventListener("resize", queue, { passive: true });
    void document.fonts.ready.then(() => { if (!disposed) queue(); });
    return () => { disposed = true; rail.removeAttribute("data-companion-launcher-space"); observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", queue); window.removeEventListener("scroll", queue, true); window.removeEventListener("vic:panel-section", queue); window.removeEventListener("vic:side-panel", queue); document.removeEventListener("animationend", layoutAnimation, true); window.visualViewport?.removeEventListener("resize", queue); };
  }, [ready, root, agenda, homeExpanded, homeVisible, homeHost, suspended]);

  useEffect(() => {
    const el = body.current, button = actor.current, page = root.current, image = sprite.current, poseLayer = pose.current, reactionLayer = reaction.current, facingLayer = facing.current, contactLayer = contact.current, inertiaLayer = inertia.current;
    if (!ready || !el || !button || !page || !image || !poseLayer || !reactionLayer || !facingLayer || !contactLayer || !inertiaLayer || !preferences.enabled) return;
    if (blocked) { el.hidden = true; setSuspended(true); setHomeExpanded(false); return; }
    // Settings/auto/storage notifications own this snapshot. Animation frames
    // must not synchronously reread localStorage for each pose/spring/layer.
    let graphicsMode = readGfxMode();
    const gfxMode = () => graphicsMode;
    if (!careLoaded.current) { brain.current = { ...brain.current, ...loadCompanionCare() }; careLoaded.current = true; }
    else brain.current = { ...brain.current, habits: loadCompanionCare().habits };
    const persistCare = (force = false) => { brain.current = { ...brain.current, habits: saveCompanionCare(brain.current, force).habits }; };
    const offHabits = subscribeCompanionHabits(habits => { brain.current = { ...brain.current, habits }; });
    const experience = (kind: CompanionExperience) => {
      if (!preferences.enabled || !preferences.learnFromYou) return false;
      const habits = learnCompanionHabits(brain.current.habits, kind);
      if (habits === brain.current.habits) return false;
      brain.current = { ...brain.current, habits };
      // Only a credited experience flushes. Persist its spent credit too, so
      // a quick reload cannot train another full experience immediately.
      persistCare(true);
      return true;
    };
    const transferred = () => { experience("played"); logActivity("ui.click", { target: "companion-drag" }); };
    const publishCare = () => { const { hunger, affection, energy, curiosity } = brain.current; setCare({ hunger, affection, energy, curiosity }); };
    publishCare();
    const hearts = createCompanionHearts(page);
    const cardPlay = createCompanionCardPlay();
    let playImpact = false, playFalling = false, panelImpact = false, mishapUntil = 0;
    let moodPose = "", moodStarted = 0;
    const presence = createCompanionPresence(document.hasFocus(), performance.now());
    const saved = lastPose.current;
    if (!saved && !pendingPosition.current && positionMemory?.current) pendingPosition.current = positionMemory.current;
    const received = pendingPosition.current;
    const transferredPoint = received && companionPositionPoint(received, { width: innerWidth, height: innerHeight }, COMPANION_SIZE);
    const incoming = transferredPoint ? received : null;
    if (!incoming) pendingPosition.current = null;
    let pendingMonth = Boolean(saved && saved.monthKey !== monthKey && !saved.atHome);
    const monthStarted = performance.now(), monthReadyAt = monthStarted + (reduced ? 0 : 340);
    const incomingHome = incoming?.monthKey === monthKey && (incoming.anchor?.kind === "home" || incoming.anchor?.kind === "home-floor") ? incoming.anchor.kind : undefined;
    let platforms: Platform[] = [], landingPlatforms: Platform[] = [], x = saved?.x ?? transferredPoint?.x ?? innerWidth * .68, y = saved?.y ?? transferredPoint?.y ?? innerHeight - 18, support = saved?.atHome ? saved.homeSupportId ?? "companion-home" : incomingHome === "home" ? "companion-home" : incomingHome === "home-floor" ? "companion-home-floor" : "";
    let positionEntryWait = false;
    const supportById = (id: string) => platforms.find(p => p.id === id) ?? landingPlatforms.find(p => p.id === id);
    let worldSeeded = saved?.seeded ?? false;
    let raf = 0, timer: ReturnType<typeof setTimeout> | undefined, lastPaint = 0, lastTick = performance.now(), lastNeeds = lastTick, lastCare = lastTick, stopped = false, sleeping = false;
    let pause = true, started = false, nextDecision = 0, needsLanding = false, afterPetLanding = false, restAfterLanding = false;
    let action: CompanionAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, keyboardMoved = false, consumePlacementClick = false;
    let placementPointer: number | null = null;
    let pointer: { x: number; y: number } | undefined, heartResult: "added" | "removed" | "blocked" | "missing" | null = null;
    let clickGuard: ReturnType<typeof setTimeout> | undefined;
    let pressed: { id: number; x: number; y: number; at: number; dx: number; dy: number; dragged: boolean; grabbed: boolean; cancelled: boolean } | null = null;
    const size = COMPANION_SIZE;
    const studio = page.dataset.companionSurface === "studio";
    if (premiereMemory.current.monthKey !== monthKey) premiereMemory.current = { generation: "", monthKey, joined: false, entryId: "", consumedExit: 0 };
    let premiereActive = false, premiereAwaitingGeometry = false, premiereDisplay: (CompanionReturnPoint & { opacity: number }) | undefined;
    let premiereBounds: ReturnType<typeof premiereViewportBounds> | undefined;
    const readPremiereBounds = () => premiereBounds = premiereViewportBounds({ clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, visualViewport: window.visualViewport });
    const boundedPremierePlatforms = (items: readonly Platform[], bounds: ReturnType<typeof premiereViewportBounds>) => items.flatMap(platform => {
      const left = Math.max(platform.x, bounds.left + size / 2 + 4), right = Math.min(platform.x + platform.width, bounds.right - size / 2 - 4);
      return right > left && platform.y >= bounds.top + size + 8 && platform.y <= bounds.bottom - 12 ? [{ ...platform, x: left, width: right - left }] : [];
    });
    let premiereSource: { id: string; generation: string; element: HTMLElement; point: CompanionReturnPoint; from: CompanionReturnPoint } | undefined;
    let premiereProgress = 0, premiereInterrupted = false, premiereSeeded = false;
    let premierePerch: CompanionOverlayPerch | undefined;
    let premiereExit: { token: number; id: string; at: number; generation: string } | undefined;
    let premiereBounce: { from: CompanionReturnPoint; began: number; duration: number } | undefined;
    let homeDeparture: { generation: string; began: number; flying?: boolean } | undefined;
    let departedGeneration = "";
    let preludeTimer: ReturnType<typeof setTimeout> | undefined, preludeDeadline = 0;
    const preludeCue = () => {
      const cue = premiereRef.current.cue;
      return cue?.generation && !["idle", "return"].includes(cue.phase) && !premiereMemory.current.joined && cue.target - syncedNow() > COMPANION_PREMIERE_ENTER_MS ? cue : undefined;
    };
    // One deadline wakes an otherwise parked creature. Active roaming still
    // uses its existing scheduler; there is no second polling loop.
    const armPrelude = () => {
      const cue = preludeCue();
      const deadline = cue && !stopped && !pause && !premiereActive ? cue.target - (isHomeSupport(support) && departedGeneration !== cue.generation && cue.target - syncedNow() > 168000 ? 168000 : COMPANION_PREMIERE_ENTER_MS) : 0;
      if (deadline === preludeDeadline) return;
      clearTimeout(preludeTimer); preludeDeadline = deadline;
      if (deadline) preludeTimer = setTimeout(() => {
        preludeDeadline = 0; preludeTimer = undefined;
        sync();
        if (!pause && !premiereActive) { cancelAnimationFrame(raf); clearTimeout(timer); tick(performance.now()); }
      }, Math.max(1, deadline - syncedNow()));
    };
    const front = bedForeground.current;
    let bedScene: { anchor: Element; anchorX: number; anchorY: number; left: number; top: number; width: number; height: number; clip: { left: number; top: number; right: number; bottom: number } } | undefined;
    let bedNeedsPaint = false;
    const sofaPassage = (progress: number) => bedScene?.anchor.isConnected && action?.kind === "jump" && (travel === -2 || travel > 0) && (support === "companion-home" || action.target.platformId === "companion-home")
      ? sampleCompanionSofaTravel(origin, action.target, progress, Math.max(size + 8, bedScene.top + bedScene.height * .19 - size * .24 - 8)) : undefined;
    const hideBed = () => { if (front && !front.hidden) front.hidden = true; };
    // One extra static scene sample per existing geometry delivery. Frame
    // following below carries its cached anchor delta without new scene scans.
    const measureBed = () => {
      const bed = document.querySelector<SVGSVGElement>(".vc-home:not([data-panel-collapsed]) .vc-plush-bed"), anchor = bed?.parentElement?.querySelector(".vc-home-cushion"), room = bed?.closest(".vc-home-room");
      if (!front || !bed || !anchor || !room || !bed.isConnected) { bedScene = undefined; hideBed(); return; }
      const rect = bed.getBoundingClientRect(), seat = anchor.getBoundingClientRect(), clip = room.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || clip.width <= 0 || clip.height <= 0) { bedScene = undefined; hideBed(); return; }
      bedScene = { anchor, anchorX: seat.left, anchorY: seat.top, left: rect.left, top: rect.top, width: rect.width, height: rect.height, clip: { left: clip.left, top: clip.top, right: clip.right, bottom: clip.bottom } };
      bedNeedsPaint = true;
      const material = getComputedStyle(room.closest(".vc-home")!);
      for (const token of ["--vc-bed-light", "--vc-bed-cloth", "--vc-bed-shade", "--vc-soft-shadow"]) style(front, token, material.getPropertyValue(token));
    };
    // The fixed front belongs to the room even while the creature stands on
    // a card or the house floor. Reuse an already followed seat when present;
    // otherwise read just its retained anchor during the existing finite
    // layout window, never a new scan or an autonomous animation loop.
    const followBed = (sample?: { anchorX: number; anchorY: number }) => {
      const bed = bedScene;
      if (!bed) return false;
      if (!bed.anchor.isConnected) { bedScene = undefined; hideBed(); return true; }
      const rect = sample ? undefined : bed.anchor.getBoundingClientRect();
      if (rect && (rect.width <= 0 || rect.height <= 0)) { bedScene = undefined; hideBed(); return true; }
      const anchorX = sample?.anchorX ?? rect!.left, anchorY = sample?.anchorY ?? rect!.top;
      const dx = anchorX - bed.anchorX, dy = anchorY - bed.anchorY;
      bed.left += dx; bed.top += dy;
      bed.clip.left += dx; bed.clip.right += dx; bed.clip.top += dy; bed.clip.bottom += dy;
      bed.anchorX = anchorX; bed.anchorY = anchorY;
      return Boolean(dx || dy);
    };
    const visual = createCompanionMotion({ clips: Object.fromEntries(registration.rows.map((row, index) => [index, row.map((_, column) => column)])), rowCount: registration.rows.length, loopRows: [0, 2, 8, 9, 11, 20], maxFrameRate: 14 });
    const supportMotion = createCompanionSupportMotion();
    const heldInertia = createCompanionHeldInertia();
    let grip = { x: size / 2, y: size / 2 };
    let heldPivot = false, releasedPivotAt = -Infinity;
    const petting = createCompanionPettingGesture();
    const pettingWindow = createCompanionPettingWindow();
    const pettingBase = { left: -.68, right: .68, top: -1.04, bottom: .10 };
    const interactionFrame = () => {
      const point = isDetailGuest() && overlayPerch ? perchAnimation?.playState === "running" ? displayedPoint() : overlayPerch : { x, y, scale: 1 };
      return { ...point, size: size * point.scale };
    };
    const pettingPoint = (point: { x: number; y: number }) => { const frame = interactionFrame(); return { x: (point.x - frame.x) / frame.size, y: (point.y - frame.y) / frame.size }; };
    const touch = createCompanionPettingContact();
    let hoverPetting = false, hoverStarted = 0, petStarted = 0;
    let hoverPoint: { x: number; y: number } | undefined, hoverTarget: Element | null = null;
    let awaitingAtX = false, verticalLanding = false, measuredWidth = innerWidth;
    let presentationNow = 0;
    const hideSeek = createCompanionHideSeek();
    let hiding: { target: CompanionHideTarget; from: { x: number; y: number }; sheet?: HTMLElement; ready?: boolean } | undefined;
    let detailSheet: HTMLElement | null = null;
    let extractedFrom: HTMLElement | null = null, extractedEvent: string | null = null, pendingDetailDrop: { x: number; y: number } | undefined;
    let guestOwner: HTMLElement | null = null;
    const ownGuest = (sheet: HTMLElement | null) => {
      if (guestOwner && guestOwner !== sheet) {
        const owns = guestOwner.getAttribute("aria-owns")?.split(/\s+/).filter(id => id !== button.id).join(" ");
        if (owns) guestOwner.setAttribute("aria-owns", owns); else guestOwner.removeAttribute("aria-owns");
      }
      guestOwner = sheet;
      if (sheet) { const ids = new Set(sheet.getAttribute("aria-owns")?.split(/\s+/).filter(Boolean)); ids.add(button.id); sheet.setAttribute("aria-owns", [...ids].join(" ")); }
    };
    let guestUntil = 0, guestKeyboardHeld = false, guestKeyboardOrigin: CompanionOverlayPerch | undefined;
    let overlayHomeResident = false;
    let hideCandidate: CompanionHideTarget | undefined;
    let hideWakeTimer: ReturnType<typeof setTimeout> | undefined;
    const hideValid = () => Boolean(hiding && hiding.target.element.isConnected && page.contains(hiding.target.element) && hiding.target.element.dataset.eventid === hiding.target.eventId && (!studio || hiding.target.element.dataset.companionEvent === "ordinary") && !hiding.target.element.closest(".teaser,.teaser-revealing,.dimmed,[hidden],[inert],[aria-hidden='true']"));
    const hideHint = (show: boolean) => { hiding?.target.element.toggleAttribute("data-companion-hide-hint", show); };
    const resetHide = () => { if (hiding?.sheet) cancelGuestInput(); hideHint(false); ownGuest(null); clearTimeout(hideWakeTimer); hideSeek.reset(); hiding = undefined; hideCandidate = undefined; hideObserver.disconnect(); el.removeAttribute("data-hide-phase"); el.removeAttribute("data-hide-event"); el.removeAttribute("data-hide-perch"); el.removeAttribute("data-detail-guest"); style(el, "opacity", "1"); button.tabIndex = overlayRef.current ? -1 : 0; };
    const hideClock = (now: number) => { if (!hiding) return; if (!pause && !(overlayActive && (!hiding.sheet || !hiding.ready))) presentationNow += Math.max(0, now - lastTick); lastTick = now; };
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
    let followRaf = 0, followUntil = 0, scrollUntil = 0;
    let followedAt = -Infinity, followedKeys = "", anchorsDirty = false;
    let lastPoseSample = { row: 0, frame: 0, status: "idle" };
    let lastFoodPoint: { id: string; x: number; y: number } | undefined;
    let parkedLayoutTimer: ReturnType<typeof setTimeout> | undefined;
    let geometryReady = false, homeOccluded = false;
    let overlayActive = false, overlayPerch: CompanionOverlayPerch | undefined;
    let overlayDrag: { id: number; dx: number; dy: number; moved?: boolean; worldOrigin?: { x: number; y: number }; guest?: { x: number; y: number; origin: CompanionOverlayPerch; dragged: boolean } } | undefined, overlayPlacing = false;
    const isDetailGuest = () => overlayActive && Boolean(hiding?.sheet && hiding.ready || extractedFrom?.isConnected && extractedFrom === detailSheet && extractedFrom.dataset.companionDetailEvent === extractedEvent);
    const guestBusy = (now: number) => Boolean(overlayDrag?.guest || guestKeyboardHeld || now < petUntil || now < guestUntil || hiding?.ready && hideSeek.sample(presentationNow).active);
    let returning: ReturnType<typeof createCompanionOverlayReturn> | undefined;
    let returnTargetValid = false, pickupScale = 1, pickupAt = 0;
    let pickupOffset = { x: 0, y: 0 };
    let overlayRaf = 0, perchAnimation: Animation | undefined;
    const overlayObserved = new Set<HTMLElement>();
    const disconnectOverlay = () => { overlayResize?.disconnect(); overlayMutation?.disconnect(); overlayObserved.clear(); };
    let paintedRow = -1, paintedColumn = -1, paintedCell = "", paintedFacing = 0, forceNeutralPose = false;
    let paintedRegistration: { x: number; y: number; clip: readonly number[] } | undefined;
    let sofaDepth: CompanionSofaDepth = "clear";
    let sofaContact: { point: CompanionSofaPoint; body: readonly CompanionSofaPoint[]; depth: CompanionSofaDepth } | undefined;
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
    const resetInertia = () => { heldInertia.reset(); sofaContact = undefined; style(inertiaLayer, "transform", "rotate(0.000deg) scale(1.0000,1.0000)"); };
    el.style.setProperty("--vc-size", `${size}px`);
    const paint = (row: number, frame: number, status: string) => {
      bedNeedsPaint = false;
      if (premiereActive || premiereBounce) pendingPosition.current = null;
      if (pendingPosition.current) { hideBed(); if (!el.hidden) el.hidden = true; return; }
      const hide = hideSeek.sample(presentationNow);
      if (premiereAwaitingGeometry && !premiereActive && !premiereBounce) { hideBed(); el.hidden = true; return; }
      if (premiereActive && !premiereDisplay) { hideBed(); el.hidden = true; return; }
      if (hiding) { data("hidePhase", hide.phase); if (hide.phase === "hidden" || overlayActive && (!hiding.sheet || !hiding.ready)) { hideBed(); el.hidden = true; return; } }
      // The studio's found guest dozes in a measured blank part of the
      // editing field. Its visual carrier stays outside contenteditable.
      if (hiding?.ready && hiding.sheet?.hasAttribute("data-companion-detail-editor") && isDetailGuest()) {
        const dozing = status === "watch";
        if (dozing) { row = 11; frame = 0; status = "sleep"; }
        el.toggleAttribute("data-dreaming", dozing);
      }
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
      if (!premiereActive && !premiereBounce && !hiding && !overlayActive && !returning && !pressed && !keyboardHeld && !recoveringPickup && (awaitingAtX || !hasWorldSupport && !pendingMonth || homeOccluded && isHomeSupport(support) || x < size / 2 + 4 || x > innerWidth - size / 2 - 4 || y < size + 8 || y > innerHeight - 12)) { hideBed(); stopHover(); el.hidden = true; return; }
      const displayFrame = isDetailGuest() ? interactionFrame() : { x, y, size, scale: 1 };
      const normalizedGrip = { x: grip.x / size, y: grip.y / size };
      // Resolve just the attended cached support/snack. No route search or DOM
      // measurement runs in pose sampling; the existing follower owns layout.
      const attention = ["look", "sniff"].includes(status) ? action?.attention : undefined;
      const attendedSupport = attention?.goal && supportById(attention.goal.targetId);
      const attendedPoint = companionAttentionPoint(attention, attendedSupport ? [attendedSupport] : [], attention?.goal?.foodId ? food.current?.foods() : []);
      if (attention) data("attention", attention.kind); else el.removeAttribute("data-attention");
      if (attention?.goal) data("intent", attention.goal.kind); else el.removeAttribute("data-intent");
      const sample = visual.sample({ row, phase: clamp(frame / 15, 0, 1), status, x: isDetailGuest() ? displayFrame.x : x - carrier.x, y: isDetailGuest() ? displayFrame.y : y - carrier.y, now: presentationNow, grip: normalizedGrip, reduced: forceNeutralPose || reduced || gfxMode() === "off", attention: attendedPoint ? { direction: Math.abs(attendedPoint.x - x) < 3 ? brain.current.heading : attendedPoint.x < x ? -1 : 1, elevation: clamp((y - size * .5 - attendedPoint.y) / 160, -1, 1) } : undefined });
      if (forceNeutralPose) { heldPivot = false; releasedPivotAt = -Infinity; }
      forceNeutralPose = false;
      if (status === "held") { heldPivot = true; releasedPivotAt = Infinity; }
      else if (heldPivot) { heldPivot = false; releasedPivotAt = presentationNow; }
      // A hanging body stretches below the actual hand, including when its
      // drawing faces left. Keep that pivot through the100ms release mixer;
      // return to the support pivot only after the pose has settled.
      style(poseLayer, "transform-origin", heldPivot || presentationNow - releasedPivotAt < 100 ? `${sample.facing < 0 ? size - grip.x : grip.x}px ${grip.y}px` : "50% 100%");
      if (status === "held") data("grip", companionGripProfile(normalizedGrip).kind); else if (presentationNow - releasedPivotAt >= 100) el.removeAttribute("data-grip");
      if (reduced || gfxMode() === "off" || overlayActive && !(isDetailGuest() && (overlayDrag?.guest?.dragged || guestKeyboardHeld))) resetInertia();
      const physicalOrigin = { x: displayFrame.x - displayFrame.size / 2, y: displayFrame.y - displayFrame.size }, physicalGrip = { x: grip.x * displayFrame.scale, y: grip.y * displayFrame.scale };
      const sway = boundCompanionHeldPose(heldInertia.sample(performance.now()), physicalOrigin, physicalGrip, displayFrame.size, { width: innerWidth, height: innerHeight });
      const shape = heldPivot || presentationNow - releasedPivotAt < 100 ? boundCompanionHangingPose(sample, physicalOrigin, physicalGrip, displayFrame.size, { width: innerWidth, height: innerHeight }, sway) : { ...sample };
      if (action?.kind === "play" && action.play && status === "play") {
        const play = sampleCompanionPlay(action.play, (performance.now() - began) / total, reduced || gfxMode() === "off");
        // The current actual support owns world position throughout the gag.
        shape.bob += play.lift; shape.tilt += play.lean;
      }
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
      let display = overlayActive && overlayPerch && (isDetailGuest() || overlayDrag) ? overlayPerch : returning?.sample(performance.now(), world, geometryReady && returnTargetValid, reduced || gfxMode() === "off").point ?? world;
      if (premiereDisplay) { display = premiereDisplay; style(el, "opacity", String(premiereDisplay.opacity)); }
      if (hiding && (hide.phase === "entering" || hide.phase === "emerging")) {
        const p = sampleCompanionTravel(hide.phase === "emerging" ? 1 - hide.progress : hide.progress), entry = hiding.target.entry;
        display = { x: lerp(hiding.from.x, entry.x, p), y: lerp(hiding.from.y, entry.y + size * .08, p), scale: lerp(1, .12, p) };
        style(el, "opacity", String(1 - p));
      } else if (hiding?.sheet) style(el, "opacity", String(hide.phase === "found" ? Math.min(1, hide.progress * 4) : 1));
      style(el, "transform", `translate3d(${(display.x - size / 2).toFixed(3)}px,${(display.y - size).toFixed(3)}px,0) scale(${display.scale})`);
      const chew = status === "eat" && !reduced ? Math.sin(presentationNow * .024) * .012 : 0;
      style(poseLayer, "transform", `translate3d(0,${shape.bob.toFixed(3)}px,0) rotate(${shape.tilt.toFixed(3)}deg) scale(${(shape.scaleX + chew).toFixed(4)},${(shape.scaleY - chew * .8).toFixed(4)})`);
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
        paintedRegistration = cell;
      }
      data("state", status);
      data("platform", support);
      data("journey", action ? String(began) : "");
      if (shadow.current) {
        const progress = action ? clamp((performance.now() - began) / total, 0, 1) : 0;
        const ground = playFalling ? action!.target.y : action?.kind === "jump" ? lerp(origin.y, action.target.y, progress) : supportById(support)?.y ?? y;
        const altitude = Math.max(0, ground - y - response.lift), scale = clamp(1 - altitude / 260, .35, 1);
        style(shadow.current, "transform", `translate3d(0,${Math.max(0, ground - y).toFixed(2)}px,0) scale(${scale.toFixed(3)})`);
        style(shadow.current, "opacity", pressed?.grabbed || keyboardHeld ? "0" : String(.24 * scale));
      }
      el.hidden = !paintedCell;
      // Depth belongs to the complete currently painted body, including its
      // held pivot and inertia. Support/target IDs cannot describe a side-on
      // drag or the middle of a jump. Reuse this frame's numbers and cached
      // bed geometry: no computed-style reads or new animation loop.
      sofaContact = undefined;
      if (front && bedScene?.anchor.isConnected && paintedRegistration && !el.hidden && !pause && !premiereActive && !premiereBounce && !isDetailGuest() && !hiding && !homeOccluded) {
        const b = bedScene, right = b.left + b.width, bottom = b.top + b.height;
        const body = projectCompanionSofaBody({ size, display, cell: paintedRegistration, shape, pressure, response, facing: sample.facing, sway, chew,
          poseOrigin: heldPivot || presentationNow - releasedPivotAt < 100 ? { x: sample.facing < 0 ? size - grip.x : grip.x, y: grip.y } : undefined,
          inertiaOrigin: grip });
        sofaDepth = companionSofaDepth({ point: display, body, bed: { left: b.left, right, top: b.top, bottom }, seatY: b.anchorY, previous: sofaDepth });
        sofaContact = { point: { x, y }, body, depth: sofaDepth };
        data("sofaDepth", sofaDepth);
        if (front.dataset.depth !== sofaDepth) front.dataset.depth = sofaDepth;
        // Front/outside creatures paint above the whole sofa. Only a fully
        // contained resident belongs between its back and the matching U.
        style(front, "z-index", sofaDepth === "seat" || sofaDepth === "back" ? "76" : "74");
        style(front, "transform", `translate3d(${b.left.toFixed(3)}px,${b.top.toFixed(3)}px,0)`);
        style(front, "width", `${b.width}px`); style(front, "height", `${b.height}px`);
        style(front, "clip-path", `inset(${Math.max(0, b.clip.top - b.top, -b.top)}px ${Math.max(0, right - b.clip.right, right - innerWidth)}px ${Math.max(0, bottom - b.clip.bottom, bottom - innerHeight)}px ${Math.max(0, b.clip.left - b.left, -b.left)}px)`);
        if (front.hidden) front.hidden = false;
      } else { sofaDepth = "clear"; data("sofaDepth", "clear"); hideBed(); }
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
    const refreshAnchors = (now: number, scroll = false, force = false) => {
      if (premiereActive || isDetailGuest() || hiding) return false;
      // Static world travel changes only our numbers. Real layout/scroll
      // events open a finite tracking window; a full scan always rebases.
      // Main and follow rAFs share a timestamp, so read each pair just once.
      const followedIds = [...new Set([support, action?.target.platformId, action?.attention?.goal?.targetId].filter((id): id is string => Boolean(id)))];
      const keys = followedIds.join("\n");
      // A blocked frame may outlive the tracking window. Still consume its
      // pending layout change once before drawing at the old support point.
      if (!force && !anchorsDirty && (now > followUntil && now > scrollUntil || now === followedAt && keys === followedKeys)) return false;
      anchorsDirty = false;
      followedAt = now; followedKeys = keys;
      const progress = action ? clamp((now - began) / Math.max(1, total), 0, 1) : 0;
      const previousPassage = sofaPassage(progress);
      const samples = geometryTracker?.follow(followedIds) ?? [];
      const seatSample = samples.find(sample => sample.platform.id === "companion-home");
      const beforeBed = bedScene && { x: bedScene.anchorX, y: bedScene.anchorY };
      const bedMoved = followBed(seatSample);
      if (bedMoved) bedNeedsPaint = true;
      if (!seatSample && beforeBed && bedScene) {
        // A later drop/depth check uses this same seat, even when it was not
        // the occupied pair. Rebase its cached platform and seen anchor once;
        // if it enters the pair next frame, its movement must not apply twice.
        const seat = supportById("companion-home");
        if (seat) { seat.x += bedScene.anchorX - beforeBed.x; seat.y += bedScene.anchorY - beforeBed.y; }
        anchorSeen.set("companion-home", { x: bedScene.anchorX, y: bedScene.anchorY });
      }
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
      if (pressed || keyboardHeld || placing) { supportMotion.reset(now); return bedMoved; }
      const from = deltas.get(support) ?? { x: 0, y: 0 }, to = deltas.get(action?.target.platformId ?? support) ?? { x: 0, y: 0 };
      let px = 0, py = 0;
      if (action) {
        const age = now - began, p = clamp(age / Math.max(1, total), 0, 1);
        if (action.kind === "jump") { px = sofaPassage(p)?.horizontal ?? (travel > 0 ? clamp((age - COMPANION_TIMING.jumpAnticipation) / travel, 0, 1) : travel === -2 || travel === -4 ? sampleCompanionTravel(p) : travel === -3 ? sampleCompanionTravel(clamp(p / .78, 0, 1)) : p); py = travel === -1 ? p * p : px; }
        else if (playFalling) py = clamp(age / Math.min(650, total), 0, 1) ** 2;
        else if (action.kind === "walk") px = py = sampleCompanionTravel(p);
        else if (action.kind === "heart" || action.kind === "hide") px = py = sampleCompanionTravel(clamp(age / Math.max(1, travel), 0, 1));
        origin.x += from.x; origin.y += from.y;
        action.target.x += to.x; action.target.y += to.y;
        if (action.effectPoint) { action.effectPoint.x += to.x; action.effectPoint.y += to.y; }
      }
      // Lift/land carry different vertical weights from lateral passage.
      // Compare the same clock sample before/after moving its real anchors;
      // using horizontal progress for y would snap on the next world tick.
      const movedPassage = previousPassage && sofaPassage(progress);
      const dx = movedPassage ? movedPassage.x - previousPassage!.x : lerp(from.x, to.x, px), dy = movedPassage ? movedPassage.y - previousPassage!.y : lerp(from.y, to.y, py);
      x += dx; y += dy; carrier.x += dx; carrier.y += dy;
      if (scroll && dy && !pendingMonth && !reduced && gfxMode() !== "off" && !isHomeSupport(support) && action?.kind !== "jump" && !playFalling) supportMotion.push(dy, now);
      if (isHomeSupport(support) || pressed || keyboardHeld || reduced || gfxMode() === "off") supportMotion.reset(now);
      return Boolean(dx || dy || bedMoved);
    };
    const continuousMotion = () => Boolean(homeDeparture || premiereActive || premiereBounce || overlayDrag?.guest || guestKeyboardHeld || returning || heldInertia.sample(performance.now()).active || pickupScale !== 1 && performance.now() - pickupAt < 200 || pendingMonth || pressed || keyboardHeld || action && ["walk", "jump", "heart", "hide", "stretch", "shake", "eat", "play"].includes(action.kind));
    const followLayout = (event?: Event) => {
      if (premiereActive && event?.target === window.visualViewport) { viewportResized(); return; }
      // A compact room can unmount while the creature is parked. Drop its
      // front immediately at the topology event, before the120ms rescan.
      if (bedScene && !bedScene.anchor.isConnected) { bedScene = undefined; hideBed(); }
      if (stopped || pause || premiereActive || isDetailGuest() || hiding) return;
      // Real scroll/panel events own this short loop. Parked/quiet creatures
      // have no autonomous tracking, timers, geometry scans or brain ticks.
      const now = performance.now();
      // Opening a window can interrupt a real panel FLIP. A resident stays
      // inside that moving room, consuming only the already-open tail; window
      // activity itself never starts or extends background tracking.
      const residentTail = overlayActive;
      if (residentTail && now >= followUntil) return;
      anchorsDirty = true;
      if (!residentTail) {
        if (event?.type === "scroll") scrollUntil = now + 180;
        followUntil = Math.max(followUntil, now + (event?.type.startsWith("vic:") ? 900 : 180));
      }
      if (followRaf) return;
      const follow = (time: number) => {
        followRaf = 0;
        if (stopped || pause || premiereActive || isDetailGuest() || hiding) return;
        // rAF already follows the display's real frames. A second60Hz gate
        // can skip a16.5ms frame while the CSS panel still advances, leaving
        // the fixed front and its resident behind for exactly that frame.
        const moved = refreshAnchors(time, time <= scrollUntil), response = supportMotion.sample(time);
        const mainOwnsFrame = !reduced && gfxMode() === "full" && continuousMotion();
        // A main paint consumes this flag too, so a front already committed
        // in this frame does not need a duplicate full follower paint.
        if (bedNeedsPaint || (moved || response.active) && !mainOwnsFrame) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        else if (time >= followUntil && !mainOwnsFrame) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        if (time < followUntil || supportMotion.sample(time).active) followRaf = requestAnimationFrame(follow);
      };
      followRaf = requestAnimationFrame(follow);
    };
    const clearAction = () => { if (homeDeparture?.flying) homeDeparture = undefined; action = null; food.current?.nibble(); heartResult = null; sleeping = false; playImpact = playFalling = panelImpact = false; el.removeAttribute("data-attention"); el.removeAttribute("data-intent"); el.removeAttribute("data-play"); el.removeAttribute("data-play-beat"); el.removeAttribute("data-heart-result"); el.removeAttribute("data-dreaming"); el.removeAttribute("data-grab-ready"); if (effect.current) { effect.current.getAnimations().forEach(animation => animation.cancel()); effect.current.textContent = ""; effect.current.removeAttribute("style"); } };
    const settle = (point: { x: number; y: number }, nearby = false, atX = false) => {
      // User releases hit the first real card top on this vertical ray. The
      // separate text ledges remain the only autonomous destinations.
      const bed = bedScene?.anchor.isConnected ? bedScene : undefined;
      const contact = sofaContact && Math.hypot(sofaContact.point.x - point.x, sofaContact.point.y - point.y) <= 1 ? sofaContact : undefined;
      const sofa = !nearby && !atX && bed ? companionSofaRelease(point, { left: bed.left, right: bed.left + bed.width, top: bed.top, bottom: bed.top + bed.height }, supportById("companion-home"), landingPlatforms, size, contact) : null;
      const p = sofa ? supportById(sofa.platformId) : atX ? nearestVerticalCompanionSupport(point, platforms) : nearby ? nearestPlatform(point, platforms) : firstCompanionSupportBelow(point, landingPlatforms);
      awaitingAtX = atX && !p; verticalLanding = atX || !nearby;
      if (!p) { support = ""; clearAction(); stopHover(); el.hidden = true; return; }
      supportMotion.reset();
      const target = { x: sofa?.x ?? (atX || !nearby ? point.x : platformLandingX(p, point.x)), y: p.y, platformId: p.id };
      origin = { x, y }; action = { kind: "jump", target, duration: sofa ? 400 : 650 }; began = performance.now(); total = action.duration; travel = sofa ? -4 : nearby || atX ? -3 : -1;
      if (reduced) { x = target.x; y = target.y; support = target.platformId ?? ""; clearAction(); }
      brain.current = recordCompanionEvent(brain.current, "landed");
    };
    const supportedNow = () => { const p = supportById(support); return Boolean(p && Math.abs(y - p.y) <= 2 && x >= p.x && x <= p.x + p.width); };
    const releaseHold = () => { resetInertia(); const held = pressed; pressed = null; keyboardHeld = false; if (held && button.hasPointerCapture(held.id)) button.releasePointerCapture(held.id); };
    const startRest = () => { action = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000 }; began = performance.now(); total = 12000; };
    const wakeGuest = () => {
      if (!isDetailGuest()) return;
      hideClock(performance.now()); cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); schedule();
    };
    const affection = () => {
      if (!preferences.petting) return;
      const guest = isDetailGuest();
      petStarted = performance.now();
      if (!guest) { pendingMonth = false; awaitingAtX = false; afterPetLanding = !supportedNow(); restAfterLanding = false; clearAction(); }
      petUntil = performance.now() + (reduced ? 650 : COMPANION_TIMING.petReward);
      brain.current = recordCompanionEvent(brain.current, "petted");
      experience("petted");
      // One acknowledged gesture/reward, never a pose or pointer sample.
      logActivity("ui.click", { target: "companion-pet" });
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
      if (guest) wakeGuest(); else nextDecision = petUntil + 500;
    };
    const isOtherControl = (target: EventTarget | null) => target instanceof Element && !el.contains(target) && Boolean(target.closest("button,a,input,select,textarea,[role='button']"));
    const hoverEligible = () => !pause && !workspaceBusyRef.current && !premiereActive && !premiereBounce && !returning && !el.hidden && document.hasFocus() && preferences.petting && (isDetailGuest() ? !overlayDrag && !guestKeyboardHeld : !hiding && !overlayActive && presence.phase === "active" && !pressed && !keyboardHeld && !placing && !pendingMonth && !awaitingAtX && !(action && ["walk", "jump", "heart", "hide", "eat"].includes(action.kind)));
    const canHover = (point: { x: number; y: number }) => hoverEligible() && pettingWindow.contains(pettingPoint(point), pettingBase, performance.now());
    const stopHover = () => {
      petting.reset(); touch.reset(); pettingWindow.reset(); hoverPetting = false; hoverPoint = undefined;
      hoverTarget?.removeAttribute("data-vc-petting-cursor"); hoverTarget = null;
      el.removeAttribute("data-petting"); style(contactLayer, "transform", "translate3d(0,0,0) rotate(0deg) scale(1,1)");
    };
    const hover = (event: PointerEvent, target = event.target) => {
      // A forgiving whole-body sensor, independent of the smaller drag button:
      // passive hover never expands the hit target over calendar controls.
      const bodyFrame = interactionFrame(), horizontalReach = bodyFrame.size * .68;
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
      const normalized = (event.clientX - bodyFrame.x) / (bodyFrame.size * .76) + .5;
      // Preserve the familiar stroke distance while contact also responds in
      // the side padding, rather than clamping an entire margin to one point.
      const moving = touch.move((event.clientX - bodyFrame.x) / (horizontalReach * 2) + .5, now);
      const result = petting.sample(normalized, now, (event.clientY - bodyFrame.y) / (bodyFrame.size * .76));
      // The first pass has a small continuous contact response. Intent and
      // bounded affection still require a real back-and-forth gesture.
      if (result.stroking || hoverPetting) data("petting", "hover");
      else if (moving || touch.sample(now).pressure > 0) data("petting", "touch");
      else data("petting", "ready");
      if (pettingHand.current) style(pettingHand.current, "transform", `translate3d(${((event.clientX - bodyFrame.x) / bodyFrame.scale + size / 2 - 12).toFixed(2)}px,${((event.clientY - bodyFrame.y) / bodyFrame.scale + size - 21).toFixed(2)}px,0) rotate(${reduced ? 0 : -18 + (normalized - .5) * 12}deg)`);
      if (isDetailGuest() && (moving || touch.sample(now).pressure > 0)) { guestUntil = now + 600; wakeGuest(); }
      if (!result.stroking) { paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return; }
      if (!hoverPetting) {
        hoverStarted = petStarted = now;
        if (!isDetailGuest()) { afterPetLanding = !supportedNow(); restAfterLanding = false; clearAction(); }
      }
      if (result.reward) affection();
      hoverPetting = true; petUntil = now + 650; if (isDetailGuest()) wakeGuest(); else nextDecision = petUntil + 500;
      data("petting", "hover");
      paint(9, reduced ? 0 : ((now - hoverStarted) % COMPANION_TIMING.petLoop) / COMPANION_TIMING.petLoop * 15, "petted");
    };
    const leave = (event: PointerEvent) => {
      // pointerleave precedes the next document move. Yield to its real
      // destination before a reversal can award affection over another control.
      if (!event.relatedTarget || isOtherControl(event.relatedTarget)) stopHover();
      else hover(event, event.relatedTarget);
    };
    const outsideDocument = (event: PointerEvent) => { if (!event.relatedTarget) stopHover(); };
    control.current = {
      place: () => { if (!hiding && !isDetailGuest() && preferences.drag) {
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
        logActivity("ui.click", { target: "companion-home-call" });
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
      if (next.attention) spriteSources[next.attention.kind === "reconsider" ? 26 : 1].forEach(src => requestSprite.current(src));
      if (next.kind === "play" && next.play) {
        // Decode just the contact and expression packets ahead of their beat.
        // Keep the existing bounded cache; never warm the entire pose library.
        for (const row of new Set([sampleCompanionPlay(next.play, 0).row, sampleCompanionPlay(next.play, .5).row])) spriteSources[row].forEach(src => requestSprite.current(src));
      }
      if (next.kind === "play" && next.play?.startsWith("bonk-") && !supportedNow()) {
        // A tap during landing still has the requested immediate expression.
        // Its feet finish falling onto the first real lower support, rather
        // than freezing in midair or falling back to the old friendly tap.
        const landing = firstCompanionSupportBelow({ x, y }, landingPlatforms);
        if (landing) { action = { ...next, target: { x, y: landing.y, platformId: landing.id } }; playFalling = true; }
      }
      if (next.kind === "hide") {
        if (!hideCandidate) { action = null; nextDecision = now + 1000; return; }
        hiding = { target: hideCandidate, from: { x, y } }; hideSeek.start(hideCandidate.eventId, presentationNow, 12000 + Math.random() * 16000);
        data("hideEvent", hideCandidate.eventId); button.tabIndex = -1; stopHover();
        hideObserver.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-eventid", "data-companion-event", "hidden", "inert", "aria-hidden"] });
        setAnnouncement("빅타민이 일정 속에 숨었어요. 그 일정의 상세창에서 찾아보세요.");
      }
      if (next.kind === "jump") supportMotion.reset(now);
      brain.current = commitAction(brain.current, action ?? next, now);
      if (next.kind === "heart") {
        const speed = preferences.speed === "relaxed" ? 45 : preferences.speed === "lively" ? 100 : 70;
        travel = Math.abs(next.target.x - x) / speed * 1000;
        total += travel;
      }
      if (next.kind === "jump") {
        const g = 1100, impulse = Math.sqrt(2 * g * (next.jumpHeight ?? 140)), dy = next.target.y - y;
        travel = (impulse + Math.sqrt(Math.max(0, impulse * impulse + 2 * g * dy))) / g * 1000;
        total = COMPANION_TIMING.jumpAnticipation + travel + COMPANION_TIMING.jumpLanding;
      }
    };
    const tick = (now: number) => {
      if (stopped || pause) return;
      if (premiereActive) { tickPremiere(now); return; }
      if (pendingPosition.current) { lastTick = lastNeeds = lastCare = now; return; }
      const cue = preludeCue();
      if (!cue && premiereRef.current.cue?.generation && !["idle", "return"].includes(premiereRef.current.cue.phase) && !premiereMemory.current.joined) { sync(); return; }
      if (hiding && overlayActive && (!hiding.sheet || !hiding.ready)) { lastTick = now; return; }
      refreshAnchors(now, now <= scrollUntil);
      const delta = Math.max(0, now - lastTick); lastTick = now;
      presentationNow += delta;
      if (cue && !overlayActive && !pressed && !keyboardHeld && !placing && isHomeSupport(support) && departedGeneration !== cue.generation && cue.target - syncedNow() <= 168000) {
        departedGeneration = cue.generation; clearAction(); petUntil = 0; stopHover();
        presence.focus(document.hasFocus(), now, true); el.removeAttribute("data-dreaming");
        homeDeparture = { generation: cue.generation, began: now };
        connectGeometry(); hearts.pause(false);
      }
      if (homeDeparture && !homeDeparture.flying) {
        // Wake on the actual cushion, then jump to a measured calendar ledge
        // before region5 retires. Reduced motion keeps the same real support.
        const age = now - homeDeparture.began;
        if (!geometryReady || age < (reduced || gfxMode() === "off" ? 0 : 550)) { paint(12, age / 550 * 15, "wake"); schedule(); return; }
        const destinations = platforms.filter(p => !isHomeSupport(p.id) && !p.manualOnly);
        const target = nearestPlatform({ x, y }, destinations.filter(p => p.kind !== "floor")) ?? nearestPlatform({ x, y }, destinations);
        if (target) {
          homeDeparture.flying = true;
          origin = { x, y }; action = { kind: "jump", target: { x: platformLandingX(target, x), y: target.y, platformId: target.id }, duration: 850 }; began = now; total = 850; travel = -2;
          if (reduced || gfxMode() === "off") { x = action.target.x; y = target.y; support = target.id; clearAction(); }
          nextDecision = now + 1100;
        } else homeDeparture = undefined;
      }
      if (premiereBounce) {
        const progress = reduced || gfxMode() === "off" || gfxMode() === "soft" ? 1 : clamp((now - premiereBounce.began) / premiereBounce.duration, 0, 1);
        premiereDisplay = sampleCompanionPremiereTravel(premiereBounce.from, { x, y, scale: 1 }, progress, size, true);
        data("premiereCompanion", "return"); paint(15, progress * 15, "premiere-return"); lastNeeds = lastCare = now;
        if (progress >= 1) { premiereBounce = undefined; premiereDisplay = undefined; el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); style(el, "opacity", "1"); nextDecision = now + 650; paint(6, 15, "land"); }
        schedule(); return;
      }
      if (isDetailGuest()) {
        const hide = hideSeek.sample(presentationNow), held = Boolean(overlayDrag?.guest?.dragged || guestKeyboardHeld);
        if (now >= petUntil && hoverPetting) { hoverPetting = false; petting.reset(); if (hoverPoint) data("petting", "ready"); }
        const happy = now < petUntil;
        paint(held ? 8 : happy ? 9 : hide.phase === "found" ? 15 : 9, held ? 0 : happy ? reduced ? 0 : ((now - petStarted) % COMPANION_TIMING.petLoop) / COMPANION_TIMING.petLoop * 15 : hide.phase === "found" ? hide.progress * 15 : 0, held ? "held" : happy ? "petted" : hide.phase === "found" ? "found" : "watch");
        lastNeeds = lastCare = now;
        if (guestBusy(now)) schedule();
        return;
      }
      if (hiding) {
        const hide = hideSeek.sample(presentationNow);
        if (hide.phase === "hidden") {
          clearAction(); data("hidePhase", "hidden"); el.hidden = true;
          hideHint(true);
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
        hideHint(false);
        if (hiding.sheet) {
          paint(hide.phase === "found" ? 15 : 9, hide.progress * 15, hide.phase === "found" ? "found" : "watch");
          lastNeeds = lastCare = now;
          if (hide.active) schedule();
          return;
        }
        paint(hide.phase === "emerging" ? 15 : 14, hide.progress * 15, hide.phase === "emerging" ? "emerge" : "hide"); lastNeeds = lastCare = now; schedule(); return;
      }
      if (!returning && presence.phase === "active" && now - lastNeeds >= 250) { brain.current = advanceBrain(brain.current, now - lastNeeds, preferences.learnFromYou); persistCare(); lastNeeds = now; }
      if (now - lastCare >= 1000) { publishCare(); lastCare = now; }
      const phase = presence.step(now, Boolean(returning || action || pressed || keyboardHeld || placing || now < petUntil || afterPetLanding || pendingMonth && !overlayActive));
      data("presence", phase);
      if (returning) {
        const sample = returning.sample(now, { x, y, scale: 1 }, geometryReady && returnTargetValid, reduced || gfxMode() === "off");
        data("returning", sample.phase);
        el.removeAttribute("data-dreaming");
        if (!sample.done) {
          paint(sample.phase === "wake" ? 12 : sample.phase === "settle" ? 6 : 0, sample.phase === "wake" ? clamp(presence.elapsed(now) / COMPANION_TIMING.presenceWake, 0, 1) * 15 : sample.phase === "settle" ? 15 : 0, sample.phase === "wake" ? "wake" : sample.phase === "settle" ? "land" : "return");
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
        if (overlayActive || supportedNow()) paint(phase === "yawning" ? 10 : phase === "parked" ? 11 : phase === "waking" ? 12 : 0, (elapsed / (phase === "waking" ? COMPANION_TIMING.presenceWake : COMPANION_TIMING.presenceYawn)) * 15, phase === "parked" ? "sleep" : phase === "waking" ? "wake" : phase === "yawning" ? "yawn" : "idle");
        else { stopHover(); el.hidden = true; }
        if (phase === "parked") {
          resetInertia();
          el.dataset.dreaming = "";
          offGeometry?.(); offGeometry = undefined; geometryReady = false;
          hearts.pause(true);
          publishCare(); persistCare(true);
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
        paint(9, reduced ? 0 : ((now - petStarted) % COMPANION_TIMING.petLoop) / COMPANION_TIMING.petLoop * 15, "petted"); schedule(); return;
      }
      if (hoverPetting) { hoverPetting = false; if (hoverPoint) data("petting", "ready"); else el.removeAttribute("data-petting"); petting.reset(); }
      if (el.dataset.state === "petted" && effect.current) effect.current.textContent = "";
      if (afterPetLanding) { afterPetLanding = false; settle({ x, y }); }
      const foodGoalId = brain.current.foodGoal?.foodId;
      const liveFoods = food.current?.foods() ?? [];
      const seenFood = liveFoods.find(item => item.id === (action?.foodId ?? foodGoalId));
      if (seenFood) lastFoodPoint = { id: seenFood.id, x: seenFood.x, y: seenFood.y };
      const lostGoalId = food.current && [foodGoalId, action?.foodId].find(id => id && !food.current!.contains(id));
      if (lostGoalId) brain.current = recordCompanionEvent(brain.current, "food-lost");
      const interruptedFood = action?.foodId && !liveFoods.some(item => item.id === action!.foodId);
      if (interruptedFood) {
        // A folded/clipped/held snack still exists. Suspend its visual action
        // without treating a temporary unavailable support as a deleted meal.
        clearAction(); if (!supportedNow() && !(homeOccluded && isHomeSupport(support))) settle({ x, y }); nextDecision = now + 300;
      }
      // A genuinely removed meal earns one finite recheck at the last seen
      // point. A held/occluded snack merely suspends, and midair feet finish
      // their safe landing instead of freezing to perform an expression.
      if (lostGoalId && !action && supportedNow() && !workspaceBusyRef.current && presence.phase === "active" && !reduced && gfxMode() !== "off") {
        launch({ kind: "look", target: { x, y, platformId: support }, duration: 480, attention: { kind: "reconsider", ...(lastFoodPoint?.id === lostGoalId ? { point: { x: lastFoodPoint.x, y: lastFoodPoint.y } } : {}) } }, now);
      }
      if (!action && !workspaceBusyRef.current && presence.phase === "active" && geometryReady && now >= nextDecision && (!isHomeSupport(support) || supportById(support))) {
        const occupied = supportById(support);
        const availableFood = accessibleCompanionFoods(liveFoods, [...platforms, ...landingPlatforms]);
        const explicitSupports = landingPlatforms.filter(p => p.manualOnly && (p.id === occupied?.id || availableFood.some(item => item.platformId === p.id)));
        const worldPlatforms = explicitSupports.length ? [...platforms, ...explicitSupports] : platforms;
        const source = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
        // Both surfaces share one hide action. The explicit public marker
        // and user-opened detail bridge protect studio editing and data.
        hideCandidate = effective.ambientPrank && occupied?.kind === "card" && now - brain.current.createdAt >= 45000 ? collectCompanionHideTargets(page).find(target => target.element === source) : undefined;
        const world = { x, y, platformId: support, platforms: worldPlatforms, width: innerWidth, height: innerHeight, hideAvailable: Boolean(hideCandidate), foods: availableFood, pointer };
        const chosen = getAction(brain.current, world, effective, now);
        const chosenFood = availableFood.find(item => item.id === chosen.foodId);
        if (chosenFood) lastFoodPoint = { id: chosenFood.id, x: chosenFood.x, y: chosenFood.y };
        launch(deliberateCompanionAction(brain.current, world, effective, chosen, !reduced && gfxMode() !== "off"), now);
        if (hiding) { paint(14, 0, "hide"); schedule(); return; }
      }
      let row = 0, frame = 0, status = "idle";
      if (action) {
        const age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        if (action.kind === "walk") { x = lerp(origin.x, action.target.x, sampleCompanionTravel(p)); row = action.pace === "scoot" ? 20 : 2; }
        else if (action.kind === "jump") {
          const passage = sofaPassage(p);
          if (passage) { x = passage.x; y = passage.y; row = p < .28 ? 4 : p < .84 ? 5 : 6; frame = (p < .28 ? p / .28 : p < .84 ? (p - .28) / .56 : (p - .84) / .16) * 15; }
          else if (travel === -2) { const eased = sampleCompanionTravel(p), lift = boundCompanionSineArc(origin.y, action.target.y, reduced ? 0 : 60, size + 8); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(p * Math.PI) * lift; row = p < .5 ? 4 : p < .85 ? 5 : 6; frame = (p < .5 ? p * 2 : p < .85 ? (p - .5) / .35 : (p - .85) / .15) * 15; }
          else if (travel === -3) { const progress = clamp(p / .78, 0, 1), eased = sampleCompanionTravel(progress), lift = boundCompanionSineArc(origin.y, action.target.y, reduced ? 0 : 10, size + 8); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(progress * Math.PI) * lift; row = p < .78 ? 5 : 6; frame = (p < .78 ? progress : (p - .78) / .22) * 15; }
          else if (travel === -4) { const eased = sampleCompanionTravel(p); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased); row = p < .8 ? 5 : 6; frame = p * 15; }
          else if (travel === -1) { x = lerp(origin.x, action.target.x, p); y = lerp(origin.y, action.target.y, p * p); row = p < .8 ? 5 : 6; frame = (p < .8 ? p / .8 : (p - .8) / .2) * 15; }
          else if (age < COMPANION_TIMING.jumpAnticipation) { row = 3; frame = age / COMPANION_TIMING.jumpAnticipation * 15; }
          else if (age < COMPANION_TIMING.jumpAnticipation + travel) {
            const t = (age - COMPANION_TIMING.jumpAnticipation) / 1000, progress = clamp((age - COMPANION_TIMING.jumpAnticipation) / travel, 0, 1);
            const arc = boundCompanionBallisticArc(origin.y, action.target.y, .5 * 1100 * (travel / 1000) ** 2, size + 8);
            x = lerp(origin.x, action.target.x, progress); y = lerp(origin.y, action.target.y, progress) - arc.coefficient * progress * (1 - progress);
            const apex = arc.apexProgress * travel / 1000;
            row = t < apex ? 4 : 5; frame = (t < apex ? t / Math.max(.001, apex) : (t - apex) / Math.max(.001, travel / 1000 - apex)) * 15;
          } else { x = action.target.x; y = action.target.y; row = 6; frame = (age - COMPANION_TIMING.jumpAnticipation - travel) / COMPANION_TIMING.jumpLanding * 15; }
        } else if (action.kind === "sleep") {
          sleeping = true; row = age < COMPANION_TIMING.sleepYawn ? 10 : total - age < COMPANION_TIMING.sleepWake ? 12 : 11;
          frame = row === 10 ? age / COMPANION_TIMING.sleepYawn * 15 : row === 12 ? (age - total + COMPANION_TIMING.sleepWake) / COMPANION_TIMING.sleepWake * 15 : 0;
          el.toggleAttribute("data-dreaming", row === 11);
        } else if (action.kind === "heart") {
          if (age < travel) { x = lerp(origin.x, action.target.x, sampleCompanionTravel(age / Math.max(1, travel))); row = 2; }
          else {
            const t = (age - travel) / action.duration; row = 13; frame = t * 15;
            const heartLift = boundCompanionSineArc(origin.y, origin.y, reduced ? 0 : 18, size + 8);
            y = origin.y - Math.sin(clamp(t / .42, 0, 1) * Math.PI) * heartLift;
            if (t >= .25 && heartResult === null) {
              heartResult = !overlayActive && !workspaceBusyRef.current && action.effectPoint ? hearts.attemptAt(action.effectPoint) : "missing";
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
        } else if (action.kind === "panel") {
          row = 13; frame = p * 15;
          if (!panelImpact && p >= .55) {
            panelImpact = true;
            if (!overlayActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off" && action.panelSide) requestCompanionPanelSide(geometryTracker?.anchor(support)?.element, action.panelSide);
          }
        } else if (action.kind === "sniff") { row = 1; frame = p * 15; }
        else if (action.kind === "eat") {
          row = p < .18 ? 1 : 9; frame = p < .18 ? p / .18 * 15 : 0;
          const direction = paintedFacing < 0 ? -1 : 1;
          food.current?.nibble(action.foodId, p, { x: x + direction * size * .045, y: y - size * .24 }, direction);
        } else if (action.kind === "play" && action.play) {
          const play = sampleCompanionPlay(action.play, p, reduced || gfxMode() === "off");
          row = play.row; frame = play.phase * 15;
          const platform = supportById(support), direction = action.direction ?? brain.current.heading;
          const room = platform ? Math.max(0, Math.min(22, origin.x - platform.x - 8, platform.x + platform.width - origin.x - 8)) : 0;
          x = origin.x + direction * play.shift * room / 22;
          if (playFalling) {
            const fall = reduced ? 1 : clamp(age / Math.min(650, total), 0, 1);
            y = lerp(origin.y, action.target.y, fall * fall);
            if (fall >= 1) { playFalling = false; support = action.target.platformId ?? support; }
          }
          data("play", action.play); data("playBeat", play.beat);
          if (!playImpact && age >= Math.min(90, total * .05) && ["tumble", "bump", "slip"].includes(action.play)) {
            playImpact = true; mishapUntil = now + 6500;
            if (!workspaceBusyRef.current && !reduced && gfxMode() !== "off" && !isHomeSupport(support)) {
              const node = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
              if (preferences.cardPrank && node && !node.matches(".selected,.primary-selected,.dragging-src,.span-drag-src,.connect-target,.connect-hover,.connect-dim,.filter-dim,.is-editing,.is-selected") && collectCompanionHideTargets(page).some(target => target.element === node)) cardPlay.bump(node, paintedFacing);
              food.current?.jostle({ x, y }, 100);
            }
          }
        } else if (action.kind === "look") { row = action.attention?.kind === "reconsider" ? 26 : 1; frame = p * 15; }
        else if (action.kind === "stretch") { row = 16; frame = p * 15; }
        else if (action.kind === "shake") { row = 17; frame = p * 15; }
        if (p >= 1) {
          const completed = action, completedTravel = travel, completedOrigin = origin;
          const rested = sleeping, ejected = Boolean(homeDeparture?.flying);
          const continueRoute = Boolean(action.foodId && (action.kind === "walk" || action.kind === "jump"));
          if (action.kind === "eat" && action.foodId && food.current?.consume(action.foodId)) {
            brain.current = recordCompanionEvent(brain.current, "ate"); if (!experience("fed")) persistCare(true);
            petUntil = now + (reduced ? 400 : 1100);
          }
          if (["walk", "jump", "heart", "hide", "play"].includes(action.kind)) { x = action.target.x; y = action.target.y; support = action.target.platformId ?? support; }
          let arrivalPlay: CompanionAction["play"] = undefined;
          if ((completed.kind === "walk" || completed.kind === "jump") && !completed.foodId && !restAfterLanding && !ejected && !overlayActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off" && presence.phase === "active") {
            const landing = supportById(support);
            const node = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
            const ordinary = Boolean(node && !node.matches(".selected,.primary-selected,.dragging-src,.span-drag-src,.connect-target,.connect-hover,.connect-dim,.filter-dim,.is-editing,.is-selected") && collectCompanionHideTargets(page).some(target => target.element === node));
            const cardBounds = ordinary ? node!.getBoundingClientRect() : undefined;
            arrivalPlay = getCompanionArrivalPlay({
              kind: completed.kind, pace: completed.pace,
              distanceCSS: Math.hypot(x - completedOrigin.x, y - completedOrigin.y),
              natural: completed.kind === "walk" || completedTravel > 0,
              ordinaryCard: ordinary && landing?.kind === "card", width: landing?.width ?? 0,
              // Safe centre spans are not the card's physical edge. Contact
              // uses its actual ink box; the span still bounds all movement.
              edgeClearance: cardBounds ? Math.max(0, Math.min(x - cardBounds.left, cardBounds.right - x)) : 0,
              energy: brain.current.energy, cooldownReady: (brain.current.cooldowns.play ?? -Infinity) <= now,
              stable: Boolean(landing && Math.abs(y - landing.y) <= 2 && !isHomeSupport(support))
            }, preferences) ?? undefined;
          }
          clearAction();
          if (ejected && presence.phase === "parked") { row = 11; frame = 0; status = "sleep"; el.dataset.dreaming = ""; offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true); }
          if (rested) brain.current = recordCompanionEvent(brain.current, "rested"); nextDecision = now + (continueRoute ? 0 : completed.attention && completed.attention.kind !== "social" ? 60 : 220);
          if (restAfterLanding) { restAfterLanding = false; if (presence.phase === "active") control.current?.rest(); }
          if (arrivalPlay) {
            // The actual completed run/landing owns this one contact. Start
            // its reaction now rather than pausing for another random choice.
            launch({ kind: "play", play: arrivalPlay, target: { x, y, platformId: support }, duration: companionPlayDuration(arrivalPlay), direction: completed.direction }, now);
            const contact = sampleCompanionPlay(arrivalPlay, 0);
            row = contact.row; frame = 0; status = "play";
            data("play", arrivalPlay); data("playBeat", contact.beat);
          }
        }
      }
      const mood = getCompanionMood(brain.current);
      if (mood !== moodPose) { moodPose = mood; moodStarted = presentationNow; }
      if (mood === "disappointed" || mood === "sulky") {
        const moodRow = mood === "sulky" ? 19 : 18;
        spriteSources[moodRow].forEach(src => requestSprite.current(src));
        if (["idle", "look"].includes(status) && !action?.attention) { row = moodRow; frame = reduced ? 0 : clamp((presentationNow - moodStarted) / (COMPANION_CLIP_TIMING[moodRow].duration ?? 1400), 0, 1) * 15; }
      }
      data("mood", mood);
      paint(row, frame, status); schedule();
    };
    const schedule = () => {
      armPrelude();
      if (premiereActive) {
        if (stopped || pause || premiereExit) return;
        const cue = premiereRef.current.cue, memory = premiereMemory.current;
        const moment = companionPremiereMoment(cue, syncedNow(), memory.joined);
        if (moment.mode === "joined" || moment.mode === "join") return;
        if (moment.mode === "prelude" && cue) { timer = setTimeout(() => tick(performance.now()), Math.max(1, cue.target - syncedNow() - COMPANION_PREMIERE_ENTER_MS)); return; }
      }
      if (stopped || pause || hiding && overlayActive && !hiding.ready || !premiereActive && !premiereBounce && !homeDeparture && (isDetailGuest() ? !guestBusy(performance.now()) : hiding ? !hideSeek.sample(presentationNow).active : presence.phase === "parked" && !returning && !action)) return;
      if (reduced) timer = setTimeout(() => tick(performance.now()), 400);
      else {
        const moving = continuousMotion();
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
    const overlayWindows = () => {
      const nodes = new Set(document.querySelectorAll<HTMLElement>(".agenda-detail-sheet,.pi-sheet,.modal-card-settings,.day-vod-modal"));
      // Studio opts into the same presentation policy, but its edit surfaces
      // stay inside this actual shell; never inspect another mounted viewer.
      if (studio) for (const node of page.querySelectorAll<HTMLElement>(".event-editor-panel,.m-edit-sheet,.modal-card")) nodes.add(node);
      return [...nodes].filter(node => {
        if (!node.isConnected || !node.getClientRects().length) return false;
        const css = getComputedStyle(node), rect = node.getBoundingClientRect();
        return css.display !== "none" && !["hidden", "collapse"].includes(css.visibility) && Number(css.opacity || 1) > .05 && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      });
    };
    const updateOverlayPerch = () => {
      overlayRaf = 0;
      if (stopped || pause || !overlayActive || overlayDrag || guestKeyboardHeld) return;
      if (hiding && (!hiding.sheet || !hiding.ready)) { el.hidden = true; return; }
      if (!isDetailGuest()) {
        // Ordinary windows own only their own layer. Keep the real creature
        // on its actual support; opening/moving a window is not a pet move.
        overlayPerch = undefined;
        paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return;
      }
      const visibleGuest = isDetailGuest() && !el.hidden;
      const current = overlayPerch && !el.hidden ? displayedPoint() : overlayPerch ?? { x, y, scale: 1 };
      const windows = overlayWindows();
      const changed = windows.length !== overlayObserved.size || windows.some(node => !overlayObserved.has(node));
      for (const node of overlayObserved) if (!windows.includes(node)) { overlayResize?.unobserve(node); overlayObserved.delete(node); }
      for (const node of windows) if (!overlayObserved.has(node)) { overlayObserved.add(node); overlayResize?.observe(node); }
      if (changed) {
        overlayMutation.disconnect();
        windows.forEach(node => overlayMutation.observe(node, node.hasAttribute("data-companion-detail-editor")
          ? { attributes: true, attributeFilter: ["style", "class"], childList: true, characterData: true, subtree: true }
          : { attributes: true, attributeFilter: ["style", "class"] }));
      }
      const inside = hiding?.ready && hiding.sheet?.isConnected ? findCompanionDetailPerch(hiding.sheet, size) : null;
      const next: CompanionOverlayPerch = inside ? { x: inside.x, y: inside.y, scale: inside.size / size, overlap: false } : placeCompanionOverlayPerch(current, size, { width: innerWidth, height: innerHeight }, windows.map(node => node.getBoundingClientRect()), overlayPerch ? { preferNearby: true } : undefined);
      if (hiding?.sheet) data("hidePerch", inside ? "inside" : "outside");
      const paintPerch = () => { const hide = hideSeek.sample(presentationNow); if (isDetailGuest()) paint(hide.phase === "found" ? 15 : 9, hide.phase === "found" ? hide.progress * 15 : 0, hide.phase === "found" ? "found" : "watch"); else paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); };
      if (overlayPerch && next.x === overlayPerch.x && next.y === overlayPerch.y && next.scale === overlayPerch.scale) { if (el.hidden) paintPerch(); return; }
      const from = !isDetailGuest() || visibleGuest ? getComputedStyle(el).transform : "none";
      perchAnimation?.cancel(); overlayPerch = next;
      paintPerch();
      // A collision-bound display cannot overshoot through the moved window.
      // Keep shared FLIP duration, using the existing non-overshooting UI ease
      // for this constrained carrier; ordinary panels keep their spring.
      if (!reduced && gfxMode() !== "off" && from !== "none") perchAnimation = el.animate([{ transform: from }, { transform: el.style.transform }], { duration: FLIP_MS, easing: getComputedStyle(document.documentElement).getPropertyValue("--ease").trim() || "ease-out" });
    };
    const queueOverlayPerch = () => { if (overlayActive && !pause && !overlayRaf) overlayRaf = requestAnimationFrame(updateOverlayPerch); };
    const detailScrolled = (event: Event) => {
      const sheet = hiding?.ready ? hiding.sheet : null;
      if (sheet && event.target instanceof Node && (event.target === document || sheet.contains(event.target))) queueOverlayPerch();
    };
    const releaseOverlayDrag = () => {
      const drag = overlayDrag; overlayDrag = undefined; el.removeAttribute("data-overlay-drag");
      if (drag && button.hasPointerCapture(drag.id)) button.releasePointerCapture(drag.id);
    };
    const cancelGuestInput = (animate = false) => {
      const original = overlayDrag?.guest?.origin ?? guestKeyboardOrigin;
      if (original) overlayPerch = { ...original };
      releaseOverlayDrag(); guestKeyboardHeld = false; guestKeyboardOrigin = undefined; guestUntil = animate ? performance.now() + 160 : 0; petUntil = 0; forceNeutralPose = !animate; stopHover();
      if (animate) wakeGuest();
    };
    const dropGuest = (point: { x: number; y: number }, moved = true) => {
      if (!isDetailGuest() || !overlayPerch) return;
      const extracting = Boolean(hiding?.ready);
      guestKeyboardHeld = false; guestKeyboardOrigin = undefined; guestUntil = performance.now() + 160; petUntil = 0; stopHover();
      const sheet = hiding?.sheet ?? extractedFrom;
      const rect = sheet?.isConnected ? sheet.getBoundingClientRect() : null;
      const inside = rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      if (inside && hiding?.ready) { if (moved) transferred(); updateOverlayPerch(); paint(9, 0, "watch"); wakeGuest(); return; }
      // A user extraction remains a display-only guest until this window
      // closes. Only the next real world geometry delivery consumes its one
      // pending drop; no planner, vote or food action runs in the dialog.
      const shown = { ...overlayPerch };
      const eventId = hiding?.target.eventId ?? extractedEvent;
      resetHide(); extractedFrom = sheet ?? null; extractedEvent = eventId; ownGuest(extractedFrom);
      forceNeutralPose = false; guestUntil = performance.now() + 160;
      data("detailGuest", ""); data("hidePerch", "outside"); button.tabIndex = 0;
      overlayPerch = placeCompanionOverlayPerch(shown, size, { width: innerWidth, height: innerHeight }, overlayWindows().map(node => node.getBoundingClientRect()));
      pendingDetailDrop = { x: overlayPerch.x, y: overlayPerch.y };
      if (moved) {
        if (extracting) { experience("played"); logActivity("ui.click", { target: "companion-extract" }); }
        else transferred();
      }
      paint(9, 0, "watch"); wakeGuest();
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
    const premiereCard = (ids: readonly string[], masked: boolean) => {
      const viewport = readPremiereBounds();
      const allowed = new Set(ids), cards = page.querySelectorAll<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]");
      for (const id of ids) for (let index = 0; index < Math.min(cards.length, 200); index++) {
        const node = cards[index];
        if (!allowed.has(id) || node.dataset.eventid !== id || !node.isConnected || node.matches(".teaser") !== masked || node.closest(".dimmed,[hidden],[aria-hidden='true']")) continue;
        let visible = true;
        for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) { const css = getComputedStyle(parent); if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity || 1) < .05) { visible = false; break; } }
        if (!visible) continue;
        const rect = node.getBoundingClientRect();
        const left = Math.max(viewport.left, rect.left), right = Math.min(viewport.right, rect.right), top = Math.max(viewport.top, rect.top), bottom = Math.min(viewport.bottom, rect.bottom);
        if (right - left < 12 || bottom - top < 8) continue;
        for (const fraction of [.5, .25, .75]) {
          const point = { x: left + (right - left) * fraction, y: top + (bottom - top) / 2 };
          const hit = document.elementsFromPoint(point.x, point.y).find(element => !element.closest(".vc-companion,.vc-food-layer,.vc-bed-foreground"));
          if (!hit || !node.contains(hit)) continue;
          const control = hit.closest("button,a,input,select,textarea,[role='button']"); if (control && control !== node) continue;
          return { id, element: node, point: { x: clamp(point.x, viewport.left + size * .06 + 4, viewport.right - size * .06 - 4), y: clamp(point.y + size * .06, viewport.top + size * .12 + 4, viewport.bottom - 4), scale: .12 } };
        }
      }
      return undefined;
    };
    const joinPremiere = () => {
      const cue = premiereRef.current.cue, memory = premiereMemory.current;
      if (!cue || memory.generation !== cue.generation || memory.joined || pause || overlayRef.current) return;
      const sourceId = premiereSource?.generation === cue.generation && cue.items.some(item => item.id === premiereSource?.id) ? premiereSource.id : undefined;
      const id = sourceId ?? cue.items.find(item => item.state === "masked")?.id ?? cue.items[0]?.id;
      if (!id) return;
      memory.joined = true; memory.entryId = id; premiereDisplay = undefined;
      data("premiereCompanion", "joined"); data("premiereSource", id); hideBed(); el.hidden = true;
      premiereRef.current.onJoin?.(cue.generation, id);
    };
    const tickPremiere = (now: number) => {
      const cue = premiereRef.current.cue, memory = premiereMemory.current;
      if (!cue || cue.generation !== memory.generation || pause || !premiereActive) return;
      presentationNow += Math.max(0, now - lastTick); lastTick = lastNeeds = lastCare = now;
      const moment = companionPremiereMoment(cue, syncedNow(), memory.joined);
      if (moment.mode === "join" || moment.mode === "joined") { joinPremiere(); premiereDisplay = undefined; el.hidden = true; return; }
      if (moment.mode === "prelude") {
        if (premiereSource) { joinPremiere(); return; }
        premiereDisplay = premierePerch && !premierePerch.overlap ? { ...premierePerch, opacity: 1 } : undefined;
        data("premiereCompanion", "prelude"); paint(0, 0, "premiere-watch"); schedule(); return;
      }
      if (moment.mode !== "enter") return;
      if (premiereInterrupted) { joinPremiere(); return; }
      if (!premiereSource) {
        if (moment.progress > .15 || !premierePerch || premierePerch.overlap || reduced || ["off", "soft"].includes(gfxMode())) { joinPremiere(); return; }
        const card = premiereCard(cue.items.filter(item => item.state === "masked").map(item => item.id), true);
        if (!card) { joinPremiere(); return; }
        premiereSource = { ...card, generation: cue.generation, from: { x: premierePerch.x, y: premierePerch.y, scale: premierePerch.scale } };
        data("premiereSource", card.id);
      }
      if (!premiereSource.element.isConnected) { joinPremiere(); return; }
      premiereProgress = Math.max(premiereProgress, moment.progress);
      premiereDisplay = sampleCompanionPremiereTravel(premiereSource.from, premiereSource.point, premiereProgress, size);
      const row = premiereProgress < .1 ? 3 : premiereProgress < .45 ? 4 : premiereProgress < .7 ? 5 : 14;
      data("premiereCompanion", "enter"); paint(row, premiereProgress * 15, "premiere-enter"); schedule();
    };
    const syncPremiere = () => {
      const cue = premiereRef.current.cue, memory = premiereMemory.current;
      const active = Boolean(cue?.generation && cue.phase !== "idle" && cue.phase !== "return");
      if (active && cue && cue.target - syncedNow() > COMPANION_PREMIERE_ENTER_MS && !memory.joined && !premiereActive && !premiereSource) {
        if (memory.generation !== cue.generation) { memory.generation = cue.generation; memory.joined = false; memory.entryId = ""; departedGeneration = ""; homeDeparture = undefined; }
        // The prelude keeps the ordinary world alive until the actual entry.
        data("premiereCompanion", "prelude"); armPrelude(); return false;
      }
      // Dismiss/back/read exits have no calendar-return token. Their existing
      // 800ms stage return still owns the mounted room; wait quietly through
      // its own final ambient cleanup instead of unmounting/re-entering it.
      const retiring = Boolean(cue?.generation && cue.generation === memory.generation && (cue.phase === "return" || cue.phase === "idle" && premiereActive && document.documentElement.hasAttribute("data-ambient-pause") && !hasAmbientPauseOutside(cue.owner)));
      const exit = cue && cue.generation === memory.generation && memory.joined ? companionPremiereReturn(cue, memory.consumedExit) : null;
      if (premiereExit && memory.consumedExit === premiereExit.token && !premiereActive) return false;
      if (!cue || !active && !retiring && !exit && !premiereExit) {
        if (premiereActive) {
          premiereActive = false; premiereDisplay = undefined; premierePerch = undefined; premiereSource = undefined; premiereExit = undefined;
          el.inert = false; el.removeAttribute("aria-hidden"); el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); style(el, "opacity", "1"); button.tabIndex = overlayRef.current ? -1 : 0;
          premiereAwaitingGeometry = true; lastTick = lastNeeds = lastCare = performance.now(); nextDecision = lastTick + 800; started = false;
        }
        if (!active) { clearTimeout(preludeTimer); preludeDeadline = 0; homeDeparture = undefined; if (!premiereBounce) el.removeAttribute("data-premiere-companion"); }
        return false;
      }
      if (memory.generation !== cue.generation) { memory.generation = cue.generation; memory.joined = false; memory.entryId = ""; premiereSource = undefined; premierePerch = undefined; premiereExit = undefined; premiereProgress = 0; premiereInterrupted = false; premiereSeeded = false; premiereActive = false; }
      if (!premiereActive) {
        // A late/reduced-motion join can become hidden without any paint.
        // Once the premiere owns placement, no pending surface handoff may
        // overwrite its released-card return on a later geometry delivery.
        pendingPosition.current = null;
        const shown = el.hidden ? { x, y, scale: 1 } : displayedPoint();
        homeDeparture = undefined; clearTimeout(preludeTimer); preludeDeadline = 0;
        resetHide(); cancelGuestInput(); extractedFrom = null; extractedEvent = null; pendingDetailDrop = undefined;
        clearAction(); releaseHold(); stopHover(); releaseOverlayDrag(); returning = undefined; premiereBounce = undefined; el.removeAttribute("data-returning");
        data("presence", "active"); el.removeAttribute("data-dreaming");
        placing = overlayPlacing = false; delete el.dataset.placing; petUntil = 0; afterPetLanding = restAfterLanding = false; supportMotion.reset(); resetInertia();
        // Reuse a body-safe world ledge; the whole calendar is not an
        // obstacle (on agenda it spans more than the entire viewport).
        // Native controls keep their full rectangles. This is one sample at
        // handoff, never a second observer or a per-frame layout scan.
        const viewport = readPremiereBounds(), candidates = boundedPremierePlatforms(platforms, viewport);
        const known = supportedNow() ? candidates.find(platform => platform.id === support && x >= platform.x && x <= platform.x + platform.width) : nearestPlatform({ x, y }, candidates);
        const controls = [...page.querySelectorAll<HTMLElement>("button,a,input,select,textarea,[role='button']")].slice(0, 256)
          .filter(node => !node.matches(".vc-cushion-button") && !node.closest(".public-event,.agenda-event,.agenda-item,.vc-companion") && node.getClientRects().length).map(node => node.getBoundingClientRect());
        const safe = known ? { x: clamp(shown.x, known.x, known.x + known.width), y: known.y, scale: 1 } : shown;
        const localRects = [...controls, ...overlayWindows().map(node => node.getBoundingClientRect())].map(rect => ({ left: rect.left - viewport.left, right: rect.right - viewport.left, top: rect.top - viewport.top, bottom: rect.bottom - viewport.top }));
        const perch = known ? placeCompanionOverlayPerch({ ...safe, x: safe.x - viewport.left, y: safe.y - viewport.top }, size, viewport, localRects) : undefined;
        const visibleWorld = !el.hidden && shown.x >= viewport.left + size / 2 + 4 && shown.x <= viewport.right - size / 2 - 4 && shown.y >= viewport.top + size + 8 && shown.y <= viewport.bottom - 12;
        premierePerch = visibleWorld ? { ...shown, overlap: false } : perch ? { ...perch, x: perch.x + viewport.left, y: perch.y + viewport.top } : undefined;
        premiereActive = true; overlayActive = false; perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0;
      }
      cancelAnimationFrame(raf); clearTimeout(timer); cancelAnimationFrame(followRaf); followRaf = 0; clearTimeout(parkedLayoutTimer);
      offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true); food.current?.pause(true);
      const html = document.documentElement, ownsInert = (active || retiring) && page.dataset.companionPremiereOwner === cue.owner;
      const hardPause = blocked || document.hidden || overlayRef.current || page.inert && !ownsInert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause") && hasAmbientPauseOutside(cue.owner);
      pause = hardPause || Boolean(premiereExit && page.inert);
      started = true; setSuspended(hardPause); el.inert = true; el.setAttribute("aria-hidden", "true"); button.tabIndex = -1;
      lastTick = lastNeeds = lastCare = lastPaint = performance.now();
      if (exit && !premiereExit) premiereExit = { ...exit, at: performance.now() };
      if (premiereExit) {
        premiereDisplay = undefined; data("premiereCompanion", "waiting"); el.hidden = true;
        if (pause || cue.phase !== "idle") return true;
        const remaining = premiereExit.at + 800 - performance.now();
        if (remaining > 0) { timer = setTimeout(sync, remaining); return true; }
        memory.consumedExit = premiereExit.token; premiereActive = false; premiereAwaitingGeometry = true; el.inert = false; el.removeAttribute("aria-hidden"); button.tabIndex = 0;
        connectGeometry(); return true;
      }
      if (retiring) { premiereDisplay = undefined; data("premiereCompanion", "waiting"); hideBed(); el.hidden = true; return true; }
      if (pause) { if (premiereSource) premiereInterrupted = true; premiereDisplay = undefined; hideBed(); el.hidden = true; return true; }
      if (!premierePerch && !premiereSeeded && !memory.joined) {
        // First-ever enablement may coincide with a prelude. Reuse one
        // bounded shared scan to obtain a real body-safe starting ledge, then
        // disconnect immediately. The world/planner remains untouched.
        const generation = cue.generation;
        offGeometry = observeCompanionPlatforms(page, next => {
          offGeometry?.(); offGeometry = undefined; premiereSeeded = true;
          if (stopped || pause || !premiereActive || premiereRef.current.cue?.generation !== generation) return;
          const viewport = premiereBounds ?? readPremiereBounds();
          const safe = nearestPlatform({ x, y: viewport.top + viewport.height * .65 }, boundedPremierePlatforms(next, viewport));
          if (safe) premierePerch = { x: platformLandingX(safe, x), y: safe.y, scale: 1, overlap: false };
          cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); tickPremiere(lastTick);
        }, { size, identity: geometryIdentity, getHome: () => document.querySelector<HTMLElement>(".vc-home-cushion") });
      }
      tickPremiere(performance.now()); return true;
    };
    const sync = () => {
      graphicsMode = readGfxMode();
      if (blocked || document.hidden || overlayRef.current || premiereRef.current.cue?.phase && !["idle", "return", "prelude"].includes(premiereRef.current.cue.phase)) cardPlay.clear();
      if (syncPremiere()) return;
      hideClock(performance.now());
      const html = document.documentElement;
      const wantsOverlay = overlayRef.current;
      const livePrelude = preludeCue();
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause") && hasAmbientPauseOutside("poster-window", livePrelude ? [livePrelude.owner] : []);
      if (next) cardPlay.clear();
      if (hiding && !hideValid()) resetHide();
      if (hiding && !(hiding.sheet && !wantsOverlay)) {
        hideHint(false);
        clearTimeout(hideWakeTimer);
        cancelAnimationFrame(raf); clearTimeout(timer); cancelAnimationFrame(followRaf); followRaf = 0;
        offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true);
        pause = next; started = true; overlayActive = wantsOverlay; setSuspended(next); food.current?.pause(next || wantsOverlay);
        lastTick = lastNeeds = lastCare = lastPaint = performance.now();
        if (next) { cancelGuestInput(); el.hidden = true; return; }
        if (wantsOverlay && (!hiding.sheet || !hiding.ready)) { el.hidden = true; return; }
        if (hiding.sheet) updateOverlayPerch();
        paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        if (hideSeek.sample(presentationNow).phase === "hidden") { hideHint(!wantsOverlay); armHideWake(); }
        schedule(); return;
      }
      if (hiding?.sheet && !wantsOverlay) { cancelGuestInput(); resetHide(); }
      const overlayChanged = wantsOverlay !== overlayActive;
      if (overlayChanged) {
        const leavingGuest = isDetailGuest();
        const explicitDrop = !wantsOverlay && pendingDetailDrop ? { ...pendingDetailDrop } : undefined;
        const droppedDisplay = explicitDrop ? el.hidden ? { ...explicitDrop, scale: 1 } : displayedPoint() : undefined;
        // A native tap may scroll its card into view before the window opens.
        // Carry that final anchor delta now, and retain the disposed follow
        // snapshot to restore any layout delta before reconnecting on close.
        if (wantsOverlay) refreshAnchors(performance.now(), false, true);
        if (wantsOverlay) overlayHomeResident = isHomeSupport(support) && supportedNow() && action?.kind !== "jump" && !playFalling;
        overlayActive = wantsOverlay;
        el.toggleAttribute("data-home-window", overlayActive && overlayHomeResident);
        if (!overlayActive) refreshAnchors(performance.now(), false, true);
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
          overlayPerch = undefined; presence.focus(false, performance.now()); hearts.pause(true);
        } else {
          // Ordinary windows never borrowed the world position. Wake where
          // the current action actually ended, with no collision-return tween.
          // A discovered/extracted hide-seek guest still has its explicit
          // pending drop consumed by the next real geometry delivery.
          if (leavingGuest || explicitDrop) clearAction();
          petUntil = 0; afterPetLanding = restAfterLanding = false; pendingMonth = false;
          ownGuest(null); extractedFrom = null; extractedEvent = null; guestKeyboardHeld = false; guestKeyboardOrigin = undefined; guestUntil = 0; el.removeAttribute("data-detail-guest"); el.removeAttribute("data-hide-perch");
          supportMotion.reset(); pickupScale = 1; pickupOffset = { x: 0, y: 0 }; returnTargetValid = false;
          // Taking a found guest out of its window is an explicit user drop,
          // unlike merely opening an ordinary window. Adopt that world point
          // now, then bridge vertically to its fresh first support. This
          // retains the actually visible scale and never flashes the old card.
          if (explicitDrop) { x = clamp(explicitDrop.x, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(explicitDrop.y, size + 8, innerHeight - 12); }
          returning = droppedDisplay ? createCompanionOverlayReturn(droppedDisplay, performance.now(), false, FLIP_MS) : undefined;
          if (returning) data("returning", "settle"); else el.removeAttribute("data-returning");
          overlayHomeResident = false;
          overlayPerch = undefined; presence.focus(document.hasFocus(), performance.now());
          lastTick = lastNeeds = lastCare = lastPaint = performance.now();
          el.removeAttribute("data-dreaming");
        }
        if (overlayActive) followLayout();
      }
      food.current?.pause(next || overlayActive);
      if (next === pause && started) {
        if (overlayChanged && !pause) {
          if (overlayActive) updateOverlayPerch();
          else { connectGeometry(); hearts.pause(presence.phase === "parked"); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); }
          cancelAnimationFrame(raf); clearTimeout(timer); schedule();
        }
        armPrelude(); return;
      }
      started = true; pause = next; setSuspended(next); if (next) { hideBed(); el.hidden = true; }
      if (pause) { if (isDetailGuest()) cancelGuestInput(); else releaseOverlayDrag(); }
      if (pause) { overlayPlacing = false; delete el.dataset.placing; }
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); lastNeeds = lastTick; lastPaint = lastTick;
      if (pause) { clearTimeout(preludeTimer); preludeDeadline = 0; homeDeparture = undefined; returning = undefined; el.removeAttribute("data-returning"); pickupScale = 1; perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0; stopHover(); needsLanding = action?.kind === "jump" || playFalling || Boolean(pressed) || keyboardHeld || afterPetLanding; afterPetLanding = false; restAfterLanding = false; supportMotion.reset(); style(reactionLayer, "transform", "translate3d(0,0px,0) scale(1,1)"); persistCare(true); clearAction(); clearTimeout(parkedLayoutTimer); offGeometry?.(); offGeometry = undefined; geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(followRaf); followRaf = 0; geometryReady = false; hearts.pause(true); releaseHold(); placing = false; delete el.dataset.placing; setHomeExpanded(false); }
      else { presence.focus(!overlayActive && document.hasFocus(), lastTick); if (overlayActive) updateOverlayPerch(); else connectGeometry(); hearts.pause(overlayActive || presence.phase === "parked"); if (needsLanding) { needsLanding = false; settle({ x, y }); } nextDecision = performance.now() + 600; if (presence.phase !== "parked") schedule(); armPrelude(); }
    };
    const focusChanged = () => {
      if (premiereActive) return;
      if (pause) return;
      if (isDetailGuest()) { if (!document.hasFocus()) { cancelGuestInput(); paint(9, 0, "watch"); } lastTick = lastNeeds = lastCare = performance.now(); return; }
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
      if (workspaceBusyRef.current || premiereActive || premiereBounce) return;
      if (isDetailGuest() && !pause && !overlayDrag && !guestKeyboardHeld && event.button === 0 && event.isPrimary !== false && (preferences.drag || preferences.petting)) {
        const shown = displayedPoint(); perchAnimation?.cancel(); overlayPerch = { ...shown, overlap: overlayPerch?.overlap ?? false };
        stopHover(); guestUntil = petUntil = 0;
        grip = { x: clamp((event.clientX - shown.x) / shown.scale + size / 2, 0, size), y: clamp((event.clientY - shown.y) / shown.scale + size, 0, size) };
        style(inertiaLayer, "transform-origin", `${grip.x}px ${grip.y}px`);
        overlayDrag = { id: event.pointerId, dx: event.clientX - shown.x, dy: event.clientY - shown.y, guest: { x: event.clientX, y: event.clientY, origin: { ...overlayPerch }, dragged: false } };
        el.dataset.pointerFocus = "";
        event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId);
        paint(1, 0, "touch"); return;
      }
      if (hiding || pause || pressed || event.button !== 0 || (!preferences.drag && !preferences.petting)) return;
      if (overlayActive) {
        if (overlayHomeResident) return;
        if (!preferences.drag || overlayDrag) return;
        el.dataset.pointerFocus = "";
        // An exposed sleeper remains directly movable, without stealing
        // modal focus. Release commits its actual new world point.
        const shown = displayedPoint(); perchAnimation?.cancel();
        overlayPerch = { ...shown, overlap: overlayPerch?.overlap ?? false };
        overlayDrag = { id: event.pointerId, dx: event.clientX - shown.x, dy: event.clientY - shown.y, worldOrigin: { x, y } };
        event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId);
        data("overlayDrag", ""); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        return;
      }
      interruptReturn(); homeDeparture = undefined;
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
        if (overlayDrag.guest && !overlayDrag.guest.dragged) {
          if (!preferences.drag || Math.hypot(event.clientX - overlayDrag.guest.x, event.clientY - overlayDrag.guest.y) <= 6) return;
          overlayDrag.guest.dragged = true; data("overlayDrag", "");
        }
        const previous = overlayPerch, scaled = size * overlayPerch.scale;
        overlayPerch = { ...overlayPerch, x: clamp(event.clientX - overlayDrag.dx, scaled / 2 + 4, innerWidth - scaled / 2 - 4), y: clamp(event.clientY - overlayDrag.dy, scaled + 4, innerHeight - 4) };
        if (overlayPerch.x !== previous.x || overlayPerch.y !== previous.y) overlayDrag.moved = true;
        if (overlayDrag.guest && !reduced && gfxMode() !== "off") heldInertia.push((overlayPerch.x - previous.x) / previous.scale, (overlayPerch.y - previous.y) / previous.scale, performance.now(), { x: grip.x / size, y: grip.y / size });
        if (overlayDrag.guest) { paint(8, 0, "held"); wakeGuest(); } else paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return;
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
        else heldInertia.push(x - previousX, y - previousY, performance.now(), { x: grip.x / size, y: grip.y / size });
        // Keep every physical input sample, but let the already running60Hz
        // loop commit the newest pose once per display frame. Reduced/lower
        // grades retain immediate pointer feedback instead of waiting400ms.
        if (reduced || gfxMode() !== "full") paint(8, 0, "held");
      }
    };
    const up = (event: PointerEvent) => {
      if (overlayDrag?.id === event.pointerId && overlayDrag.guest) {
        const guest = overlayDrag.guest;
        if (event.type === "pointercancel") { cancelGuestInput(true); paint(9, 0, "watch"); return; }
        releaseOverlayDrag();
        if (guest.dragged) dropGuest({ x: event.clientX, y: event.clientY });
        else if (preferences.petting && Math.hypot(event.clientX - guest.x, event.clientY - guest.y) <= 6) affection();
        else paint(9, 0, "watch");
        return;
      }
      if (overlayDrag?.id === event.pointerId) {
        const moved = overlayDrag.moved && event.type !== "pointercancel";
        const point = event.type === "pointercancel" ? overlayDrag.worldOrigin : overlayPerch;
        releaseOverlayDrag(); overlayPerch = undefined;
        if (point) { x = point.x; y = point.y; clearAction(); settle({ x, y }); }
        if (moved && point) transferred();
        lastTick = lastNeeds = lastPaint = performance.now(); schedule(); return;
      }
      if (!pressed || pressed.id !== event.pointerId) return;
      // A release can arrive before the next display frame. Commit its last
      // held body now so sofa release tests the current full pose, never the
      // previous pointer sample. Capture and cancellation remain synchronous.
      if (pressed.grabbed && event.type !== "pointercancel" && !pressed.cancelled && !reduced && gfxMode() === "full") paint(8, 0, "held");
      const held = pressed; pressed = null;
      if (event.type === "pointercancel" || held.cancelled) { resetInertia(); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); }
      el.removeAttribute("data-grab-ready");
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (held.dragged) { brain.current = recordCompanionEvent(brain.current, "dragged"); settle({ x, y }); if (!held.cancelled && event.type !== "pointercancel") transferred(); }
      else if (!held.cancelled && !held.grabbed && event.type !== "pointercancel") {
        const reaction = preferences.petting ? companionTapReaction({ elapsed: performance.now() - held.at, moved: Math.hypot(event.clientX - held.x, event.clientY - held.y), cancelled: held.cancelled, recentMishap: performance.now() < mishapUntil }) : null;
        if (reaction) {
          experience("bonked");
          petUntil = 0; const now = performance.now();
          launch({ kind: "play", play: reaction, target: { x, y, platformId: support }, duration: companionPlayDuration(reaction, reduced) }, now);
          data("play", reaction); paint(25, 0, "play");
          logActivity("ui.click", { target: "companion-bonk" });
          setAnnouncement(reaction === "bonk-sad" ? "빅타민이 눈치를 보며 잠깐 시무룩해져요." : "깜짝 놀란 빅타민의 눈가가 잠깐 촉촉해져요. 쓰다듬어 달래 줄 수 있어요.");
        } else affection();
      }
      else settle({ x, y });
    };
    const lostCapture = (event: PointerEvent) => {
      if (overlayDrag?.id === event.pointerId && overlayDrag.guest) { cancelGuestInput(true); paint(9, 0, "watch"); return; }
      if (overlayDrag?.id === event.pointerId) { releaseOverlayDrag(); updateOverlayPerch(); return; }
      if (stopped || pause || !pressed || pressed.id !== event.pointerId) return;
      pressed.cancelled = true; up(event);
    };
    const key = (event: KeyboardEvent) => {
      if (premiereActive || premiereBounce) return;
      if (isDetailGuest() && !pause && !overlayDrag) {
        const owns = event.key === "Enter" && preferences.petting || event.key === " " && preferences.drag || guestKeyboardHeld && (event.key.startsWith("Arrow") || event.key === "Escape");
        if (!owns) return;
        event.preventDefault(); event.stopPropagation(); el.removeAttribute("data-pointer-focus"); stopHover();
        if (event.repeat && (event.key === " " || event.key === "Enter")) return;
        if (event.key === "Enter") affection();
        else if (event.key === "Escape") { cancelGuestInput(true); paint(9, 0, "watch"); }
        else if (event.key === " ") {
          if (guestKeyboardHeld && overlayPerch) dropGuest({ x: overlayPerch.x, y: overlayPerch.y - size * overlayPerch.scale / 2 }, Boolean(guestKeyboardOrigin && Math.hypot(overlayPerch.x - guestKeyboardOrigin.x, overlayPerch.y - guestKeyboardOrigin.y) > 6));
          else if (overlayPerch) { const shown = displayedPoint(); perchAnimation?.cancel(); overlayPerch = { ...shown, overlap: overlayPerch.overlap }; guestKeyboardOrigin = { ...overlayPerch }; guestKeyboardHeld = true; grip = { x: size / 2, y: size / 2 }; style(inertiaLayer, "transform-origin", `${grip.x}px ${grip.y}px`); paint(8, 0, "held"); }
        } else if (guestKeyboardHeld && overlayPerch) {
          const scaled = size * overlayPerch.scale;
          overlayPerch = { ...overlayPerch, x: clamp(overlayPerch.x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), scaled / 2 + 4, innerWidth - scaled / 2 - 4), y: clamp(overlayPerch.y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), scaled + 4, innerHeight - 4) };
          paint(8, 0, "held");
        }
        wakeGuest(); return;
      }
      if (hiding) return;
      el.removeAttribute("data-pointer-focus");
      if (pause || overlayActive) return;
      const owns = event.key === "Escape" || event.key === "Enter" && preferences.petting || (event.key === " " || event.key.toLowerCase() === "p") && preferences.drag || event.key.toLowerCase() === "n" && preferences.sleep || keyboardHeld && event.key.startsWith("Arrow");
      if (owns) { event.preventDefault(); event.stopPropagation(); }
      if (owns) { interruptReturn(); homeDeparture = undefined; }
      if (owns) stopHover();
      if (owns) { presence.focus(document.hasFocus(), performance.now(), true); data("presence", presence.phase); }
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      if (event.key === "Enter" && preferences.petting) { event.preventDefault(); affection(); }
      else if (event.key.toLowerCase() === "p" && preferences.drag && !event.repeat) control.current?.place();
      else if (event.key.toLowerCase() === "n" && preferences.sleep && !event.repeat) { control.current?.rest(); logActivity("ui.click", { target: "companion-rest" }); }
      else if (event.key === " " && preferences.drag) { event.preventDefault(); awaitingAtX = false; pendingMonth = false; clearAction(); supportMotion.reset(); keyboardHeld = !keyboardHeld; if (!keyboardHeld) { settle({ x, y }); if (keyboardMoved) transferred(); } keyboardMoved = false; }
      else if (event.key === "Escape") { event.preventDefault(); pendingMonth = false; keyboardHeld = false; placing = false; delete el.dataset.placing; settle({ x, y }); }
      else if (keyboardHeld && event.key.startsWith("Arrow")) { event.preventDefault(); const previous = { x, y }; x = clamp(x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), size + 8, innerHeight - 12); keyboardMoved ||= x !== previous.x || y !== previous.y; }
      if (owns) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastPaint = performance.now(); schedule(); }
    };
    const keyboardModality = () => { el.removeAttribute("data-pointer-focus"); };
    const place = (event: PointerEvent) => {
      if (premiereActive || premiereBounce) return;
      if (!el.contains(event.target as Node)) stopHover();
      if (!pause && overlayActive && overlayPlacing && !el.contains(event.target as Node)) {
        overlayPlacing = false; delete el.dataset.placing;
        // A two-tap alternative to dragging; ordinary dialog controls always
        // retain their own input and never become accidental placement sites.
        if ((event.target as Element | null)?.closest("button,a,input,select,textarea,[role='button']")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        consumePlacementClick = true; placementPointer = event.pointerId; clearTimeout(clickGuard);
        overlayPerch = placeCompanionOverlayPerch({ x: event.clientX, y: event.clientY, scale: overlayPerch?.scale }, size, { width: innerWidth, height: innerHeight }, overlayWindows().map(node => node.getBoundingClientRect()));
        transferred();
        perchAnimation?.cancel(); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return;
      }
      if (pause || overlayActive || !placing || el.contains(event.target as Node)) return;
      event.preventDefault(); event.stopPropagation(); placing = false; delete el.dataset.placing;
      // pointerdown cancellation alone does not cancel the independent click:
      // consume this placement's click before a real card/heart can receive it.
      consumePlacementClick = true; placementPointer = event.pointerId; clearTimeout(clickGuard);
      x = clamp(event.clientX, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(event.clientY, size + 8, innerHeight - 12); settle({ x, y });
      transferred();
    };
    const placementReleased = (event: PointerEvent) => {
      if (placementPointer !== event.pointerId) return;
      // Keep ownership for an arbitrarily long press; the fallback only starts
      // after release/cancel if the browser does not synthesize a click.
      placementPointer = null; clearTimeout(clickGuard); clickGuard = setTimeout(() => { consumePlacementClick = false; }, 500);
    };
    const click = (event: MouseEvent) => { cardPlay.restore(event.target); if (consumePlacementClick) { event.preventDefault(); event.stopImmediatePropagation(); consumePlacementClick = false; placementPointer = null; clearTimeout(clickGuard); } };
    const sensePointer = (event: PointerEvent) => {
      if (premiereActive || premiereBounce) return;
      if (!pause && (!overlayActive || isDetailGuest()) && event.pointerType !== "touch") {
        if (!overlayActive) pointer = { x: event.clientX, y: event.clientY };
        // Hover can reach the whole body without an enlarged hitbox stealing adjacent
        // calendar/window buttons. Reuse this existing passive pointer sensor.
        if (!el.contains(event.target as Node)) {
          if (isOtherControl(event.target)) stopHover();
          else hover(event);
        }
      }
    };
    const captureForSurface = () => {
      if (!positionMemory || !worldSeeded && !supportById(support)) return;
      let anchor: CompanionPositionSnapshot["anchor"];
      const stable = !pressed && !keyboardHeld && action?.kind !== "jump" && !playFalling;
      if (stable && isHomeSupport(support) && (homeOccluded || supportedNow())) {
        const floor = isHomeFloor(support), node = document.querySelector(floor ? ".vc-home-floor" : ".vc-home-cushion"), rect = node?.getBoundingClientRect();
        anchor = { kind: floor ? "home-floor" : "home", u: rect && rect.width > 0 ? clamp((x - rect.left) / rect.width, 0, 1) : .5 };
      } else if (stable && !premiereActive && !premiereBounce) {
        const node = geometryTracker?.anchor(support)?.element;
        // Reuse the existing public/ordinary/visible-card allowlist. Text,
        // private or unreleased IDs never enter the surface handoff.
        const card = node && collectCompanionHideTargets(page).find(target => target.element === node || target.element.contains(node));
        if (card) {
          const rect = card.element.getBoundingClientRect();
          anchor = { kind: "public-card", eventId: card.eventId, u: clamp((x - rect.left) / rect.width, 0, 1), manualTop: Boolean(supportById(support)?.manualOnly) };
        }
      }
      positionMemory.current = { point: { x, y }, viewport: { width: innerWidth, height: innerHeight }, monthKey, seeded: worldSeeded || Boolean(supportById(support)), ...(anchor ? { anchor } : {}) };
    };
    capturePosition.current = captureForSurface;
    const onGeometry = (next: Platform[]) => {
      if (premiereActive || overlayActive || hiding) return;
      // Drag-source text is intentionally hidden by the editor. That brief
      // presentation is not deletion of the occupied ledge. Keep the last
      // physical snapshot until the existing editor gesture has ended.
      if (workspaceBusyRef.current) { refreshAnchors(performance.now(), false, true); return; }
      const geometryAt = performance.now();
      followUntil = Math.max(followUntil, geometryAt + FLIP_MS);
      premiereAwaitingGeometry = false;
      const widthChanged = measuredWidth !== innerWidth;
      measuredWidth = innerWidth;
      geometryReady = true;
      if (returning) returnTargetValid = false;
      refreshAnchors(geometryAt, false, true);
      // A full scan revalidates safe spans; scrolling itself was already
      // carried per-frame by its actual anchor, including nested/fixed panels.
      platforms = next.filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      landingPlatforms = [...(geometryTracker?.landings() ?? [])].filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      measureBed();
      food.current?.sync(platforms, id => geometryTracker?.anchor(id), geometryTracker?.landings(32));
      if (premiereExit && premiereMemory.current.consumedExit === premiereExit.token) {
        const exit = premiereExit, cue = premiereRef.current.cue, now = performance.now();
        premiereExit = undefined;
        const released = cue?.generation === exit.generation ? cue.items.filter(item => item.state === "released").map(item => item.id) : [];
        const ids = [premiereMemory.current.entryId, exit.id, ...released].filter((id, index, values) => released.includes(id) && values.indexOf(id) === index);
        const card = premiereCard(ids, false);
        const cardSupports = card ? landingPlatforms.filter(platform => geometryTracker?.anchor(platform.id)?.element === card.element) : [];
        const target = (card ? nearestPlatform(card.point, cardSupports) ?? firstCompanionSupportBelow(card.point, landingPlatforms) : undefined)
          ?? nearestVerticalCompanionSupport({ x, y }, platforms) ?? nearestPlatform({ x, y }, platforms);
        clearAction(); afterPetLanding = restAfterLanding = false; pendingMonth = false; awaitingAtX = !target;
        if (target) { x = platformLandingX(target, card?.point.x ?? x); y = target.y; support = target.id; }
        else support = "";
        premierePerch = undefined; premiereSource = undefined; forceNeutralPose = true;
        presence.focus(document.hasFocus(), now, true); data("presence", presence.phase); el.removeAttribute("data-dreaming");
        lastTick = lastNeeds = lastCare = lastPaint = now; nextDecision = now + 1450;
        food.current?.pause(false); hearts.pause(false);
        if (card && target && !reduced && !["off", "soft"].includes(gfxMode())) {
          premiereBounce = { from: card.point, began: now, duration: 800 };
          premiereDisplay = sampleCompanionPremiereTravel(card.point, { x, y, scale: 1 }, 0, size, true);
          data("premiereSource", card.id); data("premiereCompanion", "return"); paint(15, 0, "premiere-return");
        } else {
          premiereDisplay = undefined; el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); style(el, "opacity", "1");
          if (target) paint(0, 0, "idle"); else el.hidden = true;
        }
        refreshAnchors(now); cancelAnimationFrame(raf); clearTimeout(timer); schedule(); return;
      }
      if (premiereBounce) {
        if (!supportById(support)) { premiereBounce = undefined; premiereDisplay = undefined; style(el, "opacity", "1"); el.removeAttribute("data-premiere-companion"); }
        else { refreshAnchors(performance.now()); return; }
      }
      if (pendingDetailDrop) {
        const point = { x: clamp(pendingDetailDrop.x, size / 2 + 4, innerWidth - size / 2 - 4), y: clamp(pendingDetailDrop.y, size + 8, innerHeight - 12) };
        pendingDetailDrop = undefined;
        const target = firstCompanionSupportBelow(point, landingPlatforms);
        clearAction(); afterPetLanding = restAfterLanding = false; needsLanding = false; supportMotion.reset();
        x = point.x; y = target?.y ?? point.y; support = target?.id ?? ""; awaitingAtX = !target;
        returnTargetValid = Boolean(target); nextDecision = performance.now() + FLIP_MS + 600;
        refreshAnchors(performance.now());
        return;
      }
      const transfer = pendingPosition.current;
      if (transfer && !pendingMonth && !pressed && !keyboardHeld && !placing) {
        const point = companionPositionPoint(transfer, { width: innerWidth, height: innerHeight }, size);
        const transferCardId = transfer.monthKey === monthKey && transfer.anchor?.kind === "public-card" ? transfer.anchor.eventId : undefined;
        const card = transferCardId ? collectCompanionHideTargets(page)
          .filter(target => target.eventId === transferCardId)
          .sort((a, b) => Math.hypot(a.entry.x - (point?.x ?? x), a.entry.y - (point?.y ?? y)) - Math.hypot(b.entry.x - (point?.x ?? x), b.entry.y - (point?.y ?? y)))[0] : undefined;
        const belongs = (platform: Platform) => { const node = geometryTracker?.anchor(platform.id)?.element; return Boolean(card && node && (card.element === node || card.element.contains(node))); };
        const homeNode = document.querySelector(".vc-home-cushion"), floorNode = document.querySelector(".vc-home-floor");
        const homeRect = homeNode?.getBoundingClientRect(), floorRect = floorNode?.getBoundingClientRect(), cardRect = card?.element.getBoundingClientRect();
        const restored = resolveCompanionPosition(transfer, { monthKey, platforms, landings: landingPlatforms, viewport: { width: innerWidth, height: innerHeight }, size,
          ...(card && cardRect ? { publicCard: { eventId: card.eventId, range: { x: cardRect.left, width: cardRect.width }, platforms: platforms.filter(belongs), landings: landingPlatforms.filter(belongs) } } : {}),
          ...(homeRect && homeRect.width > 0 ? { homeRange: { x: homeRect.left, width: homeRect.width } } : {}),
          ...(floorRect && floorRect.width > 0 ? { homeFloorRange: { x: floorRect.left, width: floorRect.width } } : {}) });
        // An entering calendar can initially expose only its floor while its
        // finite intro owns opacity/fit. Keep the handoff until that intro
        // settles; one existing geometry subscription reconnect also delivers
        // an unchanged empty-calendar floor. No polling or perpetual timer.
        const entering = page.getAnimations({ subtree: true }).filter(animation => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))
            && target instanceof Element && !target.closest(".vc-companion,.vc-food-layer,.vc-home");
        });
        if (entering.length) {
          if (!positionEntryWait) {
            positionEntryWait = true;
            void Promise.allSettled(entering.map(animation => animation.finished)).then(() => {
              positionEntryWait = false;
              if (!stopped && !pause && pendingPosition.current && !premiereActive && !overlayActive && !hiding) {
                offGeometry?.(); offGeometry = undefined; connectGeometry();
              }
            });
          }
          if (!el.hidden) el.hidden = true; return;
        }
        // A folded/offscreen/remounting house still owns its resident. Keep
        // the existing home-occlusion wait, rather than moving it to a card.
        const waitingHome = transfer.monthKey === monthKey && (transfer.anchor?.kind === "home" || transfer.anchor?.kind === "home-floor") && !restored;
        const fallback = !restored && !waitingHome && point ? nearestPlatform(point, platforms) : undefined;
        if (restored || fallback) {
          clearAction(); supportMotion.reset(); resetInertia();
          x = restored?.point.x ?? platformLandingX(fallback!, point!.x); y = restored?.point.y ?? fallback!.y; support = restored?.platformId ?? fallback!.id;
          worldSeeded = true; awaitingAtX = false; needsLanding = false; pendingPosition.current = null;
          lastTick = lastNeeds = lastCare = performance.now(); nextDecision = lastTick + 1100;
          data("positionTransfer", restored?.kind ?? "nearby");
          // Geometry, not repeated AI ticks, wakes a waiting handoff. This
          // also leaves a folded house completely quiet until it reappears.
          cancelAnimationFrame(raf); clearTimeout(timer); schedule();
        } else if (!waitingHome) { if (!el.hidden) el.hidden = true; return; }
      }
      if (pendingMonth) return;
      // Geometry may refresh during a captured drag or keyboard placement.
      // Publish new supports, but input alone owns the displayed world point.
      if (pressed || keyboardHeld || placing) return;
      homeOccluded = false;
      const residesAtHome = isHomeSupport(support) && !pressed && !keyboardHeld && !placing && !afterPetLanding && (!action || isHomeSupport(action.target.platformId ?? "")) && action?.kind !== "jump" && !playFalling;
      if (residesAtHome) {
        const floor = isHomeFloor(support);
        const home = document.querySelector<HTMLElement>(floor ? ".vc-home-floor" : ".vc-home-cushion");
        const occludeResident = () => {
          homeOccluded = true; hideBed(); stopHover(); if (!returning && !el.hidden) el.hidden = true;
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
      if (presence.phase === "parked" && !homeDeparture) {
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
      if (!premiereActive && !hiding && !overlayActive && !offGeometry) {
        geometryReady = false;
        geometryTracker = offGeometry = observeCompanionPlatforms(page, onGeometry, { size, identity: geometryIdentity, getHome: () => document.querySelector<HTMLElement>(".vc-home-cushion"),
          // Reuse the existing observer's invalidation. Main frames follow an
          // in-flight CSS/WAAPI reflow immediately, before its coalesced scan;
          // unchanged calendars never need a perpetual rectangle read loop.
          onInvalidate: () => { anchorsDirty = true; followUntil = Math.max(followUntil, performance.now() + FLIP_MS); } });
      }
    };
    const parkedLayout = () => {
      if (premiereActive || hiding || pause || overlayActive || presence.phase !== "parked") return;
      clearTimeout(parkedLayoutTimer);
      parkedLayoutTimer = setTimeout(() => { if (!pause && presence.phase === "parked") connectGeometry(); }, 120);
    };
    const panelChanged = (event: Event) => {
      if (premiereActive || hiding || overlayActive) return;
      if (document.querySelector(".vc-home[data-panel-collapsed]")) {
        bedScene = undefined; hideBed();
        if (isHomeSupport(support)) { homeOccluded = true; el.hidden = true; stopHover(); }
      }
      parkedLayout(); followLayout(event);
    };
    const spriteDecoded = () => { if (!pause) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); };
    const workspaceChanged = () => {
      if (workspaceBusyRef.current) { stopHover(); cardPlay.clear(); return; }
      if (pause || overlayActive || hiding || premiereActive) return;
      offGeometry?.(); offGeometry = undefined; connectGeometry();
      cancelAnimationFrame(raf); clearTimeout(timer);
      lastTick = lastNeeds = lastPaint = performance.now(); schedule();
    };
    const viewportResized = () => {
      if (premiereActive) {
        readPremiereBounds();
        if (premiereSource) premiereInterrupted = true;
        else if (!premiereMemory.current.joined && !premiereExit) { premierePerch = undefined; premiereSeeded = false; }
        // An entry interrupted by a real resize joins quietly at the current
        // scene. A prelude gets one fresh shared scan, never a stale endpoint
        // or a replay of the old trajectory after orientation changes.
        sync(); return;
      }
      if (premiereBounce) {
        premiereBounce = undefined; premiereDisplay = undefined; premiereAwaitingGeometry = true;
        style(el, "opacity", "1"); el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); hideBed(); el.hidden = true;
        nextDecision = performance.now() + 600; connectGeometry();
      }
      queueOverlayPerch();
    };
    const detailChanged = (event: Event) => {
      hideClock(performance.now());
      const notice = (event as CustomEvent<CompanionDetailNotice>).detail;
      detailSheet = notice?.sheet instanceof HTMLElement && notice.sheet.isConnected && (notice.sheet.matches(".agenda-detail-sheet") || studio && page.contains(notice.sheet) && notice.sheet.hasAttribute("data-companion-detail-editor")) && notice.sheet.dataset.companionDetailEvent === notice.eventId ? notice.sheet : null;
      if (extractedFrom && (extractedFrom !== detailSheet || notice.eventId !== extractedEvent)) {
        cancelGuestInput(); ownGuest(null); extractedFrom = null; extractedEvent = null; if (overlayRef.current) pendingDetailDrop = undefined;
        el.removeAttribute("data-detail-guest"); el.removeAttribute("data-hide-perch"); button.tabIndex = overlayRef.current ? -1 : 0;
        queueOverlayPerch();
      }
      if (hiding?.sheet && (!detailSheet || detailSheet.dataset.companionDetailEvent !== hiding.target.eventId)) {
        // A reused sheet is a new window owner. A found guest must not leak
        // into another event while React keeps overlayOpen=true.
        cancelGuestInput(); resetHide(); clearAction(); presence.focus(false, performance.now());
        lastTick = lastNeeds = lastCare = performance.now(); queueOverlayPerch();
        cancelAnimationFrame(raf); clearTimeout(timer); schedule(); return;
      }
      if (!hiding || !detailSheet || detailSheet.dataset.companionDetailEvent !== hiding.target.eventId || !hideValid()) return;
      if (!notice.ready) {
        hiding.sheet = detailSheet; hiding.ready = false; hideHint(false); clearTimeout(hideWakeTimer); stopHover(); perchAnimation?.cancel(); el.hidden = true; sync(); return;
      }
      if (hideSeek.find(hiding.target.eventId, presentationNow)) {
        logActivity("ui.click", { target: "companion-find" });
        hiding.sheet = detailSheet; hiding.ready = true; hideHint(false); clearAction(); stopHover();
        data("hidePhase", "found"); data("detailGuest", ""); data("presence", "active"); button.tabIndex = 0; ownGuest(detailSheet); el.removeAttribute("data-dreaming");
        setAnnouncement("찾았다! 빅타민이 일정 안에서 반겨요.");
        sync();
      } else if (hiding.sheet && hiding.ready) queueOverlayPerch();
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.target === document.documentElement && ["data-theme", "data-eye-comfort"].includes(record.attributeName ?? ""))) { measureBed(); if (!pause) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); }
      sync();
    });
    const graphicsStored = (event: StorageEvent) => { if (event.key === null || event.key === "vic.gfx" || event.key === "vic.gfxPref") sync(); };
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-showcase", "data-ambient-pause", "data-gfx", "data-theme", "data-eye-comfort"] });
    observer.observe(page, { attributes: true, attributeFilter: ["inert", "data-companion-premiere-owner"] });
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", place, true); document.addEventListener("click", click, true);
    window.addEventListener("blur", focusChanged); window.addEventListener("focus", focusChanged);
    window.addEventListener("vic:companion-overlay", sync);
    window.addEventListener("vic:companion-workspace", workspaceChanged);
    window.addEventListener("vic:companion-premiere", sync);
    window.addEventListener("vic:companion-sprite", spriteDecoded);
    window.addEventListener("vic:gfx-pref", sync); window.addEventListener("vic:gfx-auto", sync); window.addEventListener("storage", graphicsStored);
    window.addEventListener(COMPANION_DETAIL_EVENT, detailChanged);
    window.addEventListener("resize", viewportResized, { passive: true });
    document.addEventListener("animationend", queueOverlayPerch, true);
    window.addEventListener("scroll", detailScrolled, { passive: true, capture: true });
    window.addEventListener("resize", parkedLayout, { passive: true }); window.addEventListener("scroll", parkedLayout, { passive: true, capture: true }); window.addEventListener("vic:companion-home", parkedLayout);
    window.addEventListener("scroll", followLayout, { passive: true, capture: true }); window.addEventListener("vic:companion-home", followLayout); window.addEventListener("vic:side-panel", followLayout);
    window.addEventListener("vic:panel-section", panelChanged);
    window.addEventListener(COMPANION_CARD_PLAY_EVENT, followLayout);
    window.visualViewport?.addEventListener("scroll", followLayout, { passive: true });
    window.visualViewport?.addEventListener("resize", viewportResized, { passive: true });
    document.addEventListener("pointerup", placementReleased, true); document.addEventListener("pointercancel", placementReleased, true);
    document.addEventListener("pointermove", sensePointer, { passive: true });
    document.addEventListener("pointerout", outsideDocument, { passive: true });
    document.addEventListener("keydown", keyboardModality, true);
    button.addEventListener("pointerdown", down); button.addEventListener("pointermove", move); button.addEventListener("pointerleave", leave); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("lostpointercapture", lostCapture); button.addEventListener("keydown", key);
    sync();
    return () => {
      offHabits();
      lastPose.current = { x, y, monthKey, seeded: worldSeeded || Boolean(supportById(support)), atHome: isHomeSupport(support) && (homeOccluded || supportedNow()) && !pressed && !keyboardHeld && action?.kind !== "jump" && !playFalling, homeSupportId: isHomeSupport(support) ? support : undefined };
      if (capturePosition.current === captureForSurface) capturePosition.current = null;
      persistCare(true);
      stopped = true; clearTimeout(preludeTimer); homeDeparture = undefined; el.removeAttribute("data-home-window"); resetHide(); resetInertia(); returning = undefined; premiereDisplay = undefined; premiereBounce = undefined; premiereExit = undefined; el.inert = false; el.removeAttribute("aria-hidden"); el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); el.removeAttribute("data-returning"); stopHover(); cancelAnimationFrame(followRaf); geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearTimeout(parkedLayoutTimer); clearAction(); control.current = null; observer.disconnect(); offGeometry?.(); hearts.dispose();
      cardPlay.clear();
      releaseOverlayDrag(); perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf);
      window.removeEventListener("vic:companion-overlay", sync); window.removeEventListener("vic:companion-workspace", workspaceChanged); window.removeEventListener("resize", viewportResized); document.removeEventListener("animationend", queueOverlayPerch, true);
      window.removeEventListener("scroll", detailScrolled, true);
      window.removeEventListener("vic:companion-premiere", sync);
      window.removeEventListener("vic:companion-sprite", spriteDecoded);
      window.removeEventListener("vic:gfx-pref", sync); window.removeEventListener("vic:gfx-auto", sync); window.removeEventListener("storage", graphicsStored);
      window.removeEventListener(COMPANION_DETAIL_EVENT, detailChanged);
      window.removeEventListener("blur", focusChanged); window.removeEventListener("focus", focusChanged);
      window.removeEventListener("resize", parkedLayout); window.removeEventListener("scroll", parkedLayout, true); window.removeEventListener("vic:companion-home", parkedLayout);
      window.removeEventListener("scroll", followLayout, true); window.removeEventListener("vic:companion-home", followLayout); window.removeEventListener("vic:side-panel", followLayout); window.visualViewport?.removeEventListener("scroll", followLayout);
      window.visualViewport?.removeEventListener("resize", viewportResized);
      window.removeEventListener("vic:panel-section", panelChanged);
      window.removeEventListener(COMPANION_CARD_PLAY_EVENT, followLayout);
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); document.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      document.removeEventListener("pointermove", sensePointer);
      document.removeEventListener("pointerout", outsideDocument);
      document.removeEventListener("keydown", keyboardModality, true);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerleave", leave); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("lostpointercapture", lostCapture); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
      hideBed();
    };
  }, [ready, root, preferences, blocked, agenda, monthKey, reduced, geometryIdentity, positionMemory]);

  if (!ready) return null;
  const closeHome = () => { setHomeExpanded(false); };
  const act = (kind: CompanionHomeAction) => { control.current?.[kind](); };
  const performanceActive = Boolean(premiereCue?.generation && premiereCue.phase !== "idle" && (premiereCue.phase === "return" || premiereCue.target - syncedNow() <= 166000));
  const house = <CompanionHome care={care} preferences={preferences} inactive={overlayOpen || performanceActive} owner={premiereCue?.owner} onAction={act} onClose={homeVisible ? undefined : closeHome} />;
  return createPortal(<><div className="vc-companion" ref={body} hidden data-sfx="off" data-size="large" data-overlay={overlayOpen ? "quiet" : undefined} data-workspace-busy={workspaceBusy ? "" : undefined}>
    <span className="vc-contact-shadow" ref={shadow} aria-hidden="true" />
    <button id={actorId} className="vc-actor" ref={actor} type="button" tabIndex={overlayOpen ? -1 : 0} data-sfx="off" data-activity-manual="" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space P N ArrowUp ArrowDown ArrowLeft ArrowRight Escape" onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); control.current?.place(); }}><span className="vc-inertia" ref={inertia} aria-hidden="true"><span className="vc-facing" ref={facing}><span className="vc-reaction" ref={reaction}><span className="vc-contact" ref={contact}><span className="vc-pose" ref={pose}><span className="vc-sprite" ref={sprite} /></span></span></span></span></span><span className="vc-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span></button>
    <span className="vc-effect" ref={effect} aria-hidden="true" />
    <span className="vc-affection-hearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></span>
    <span className="vc-petting-hand" ref={pettingHand} aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M10 26c-3-3-5-6-6-9-1-2 1-4 3-2l3 3-1-9c0-3 3-4 4-1l1 6V6c0-3 4-3 4 0v8l1-6c1-3 4-2 4 1l-1 8 2-3c2-2 4 0 2 3l-4 7c-1 2-3 4-6 4h-3Z"/><path className="vc-hand-fold" d="M11 21c2-2 5-2 7 0"/><path className="vc-hand-cuff" d="M10 27h11v4H10Z"/></svg></span>
    <span className="sr-only" id="vc-help">빅타민의 몸 위에서 마우스를 좌우로 움직여 쓰다듬기. 짧게 누르면 톡 치기. 끌어서 옮기기. 두 번 누른 뒤 놓을 곳 선택. Enter 쓰다듬기. 스페이스로 집고 방향키로 옮긴 뒤 스페이스나 Escape로 놓기. P로 위치 선택. N으로 낮잠.</span>
    <span className="sr-only" role="status">{announcement}</span>
  </div><div className="vc-bed-foreground" ref={bedForeground} hidden aria-hidden="true"><CompanionBedForeground /></div><CompanionFood ref={food} enabled={preferences.feeding} blocked={blocked || overlayOpen} monthKey={monthKey} returnFocus={() => { if (!overlayRef.current && !body.current?.hidden) actor.current?.focus({ preventScroll: true }); }} />
    {!suspended && !blocked ? homeVisible && homeHost ? createPortal(house, homeHost) : <div className="vc-compact-home" ref={compactHome} data-companion-home-owner={premiereCue?.owner} data-pm-exit="5" data-agenda={agenda ? "" : undefined} inert={overlayOpen || performanceActive ? true : undefined} aria-hidden={overlayOpen || performanceActive ? true : undefined} data-sfx="off" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (homeExpanded) logActivity("ui.click", { target: "companion-home-close" }); closeHome(); } }}>
      {homeExpanded ? house : <button ref={homeLauncher} data-act="companion-home-open" data-home-action="launcher" type="button" className="button vc-home-launcher" aria-label="빅타민 집 열기" aria-expanded={false} onClick={() => setHomeExpanded(true)}><Home size={16} aria-hidden="true" />빅타민 집</button>}
    </div> : null}
  </>, document.body);
}
