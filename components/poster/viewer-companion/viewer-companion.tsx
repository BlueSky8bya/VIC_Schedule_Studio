"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { soundEnabled, soundVolume } from "@/lib/ui/sfx";
import { Home, X } from "lucide-react";
import { logActivity } from "@/lib/activity/client";
import { COMPANION_CLIP_TIMING, COMPANION_PLAY_TIMING, COMPANION_TIMING, COMPANION_THROW_ROW, companionPlayDuration } from "@/lib/ui/viewer-companion/timing";
import { getCompanionArrivalPlay } from "@/lib/ui/viewer-companion/arrival-play";
import { companionRunTripContact, planCompanionRomp, sampleCompanionRunUp, validCompanionRunHop, type CompanionRunTrip } from "@/lib/ui/viewer-companion/romp";
import { cancelCompanionEpisode, companionEpisodeHopAvailable, companionEpisodeMishap, companionEpisodeRunHop, companionEpisodeRunTrip, companionRollProgress } from "@/lib/ui/viewer-companion/episodes";
import { companionAttentionPoint, deliberateCompanionAction } from "@/lib/ui/viewer-companion/deliberation";
import { advanceBrain, cancelCompanionTravelGoal, commitAction, createBrain, getAction, getCompanionMood, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_THROW_LIMITS, createCompanionThrow, createCompanionThrowVelocity, stepCompanionThrow, type CompanionThrowState, type CompanionThrowVelocity } from "@/lib/ui/viewer-companion/throw";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionWorldPreferencesKey } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionGeometryIdentity, observeCompanionPlatforms, type CompanionGeometrySubscription } from "@/lib/ui/viewer-companion/geometry";
import { COMPANION_DETAIL_EVENT, collectCompanionHideTargets, type CompanionDetailNotice, type CompanionHideTarget } from "@/lib/ui/viewer-companion/hide-targets";
import { createCompanionHideSeek } from "@/lib/ui/viewer-companion/hide-seek";
import { findCompanionDetailPerch } from "@/lib/ui/viewer-companion/detail-perch";
import { companionGuestExtractionScale, type CompanionGuestBounds } from "@/lib/ui/viewer-companion/guest-extraction";
import { canParkCompanionHomeWait, companionHomeBlockedResponse, planCompanionHomeReturn } from "@/lib/ui/viewer-companion/home-route";
import { companionPremiereMoment, companionPremiereReturn, COMPANION_PREMIERE_ENTER_MS, type CompanionPremiereCue } from "@/lib/ui/viewer-companion/premiere";
import { sampleCompanionPremiereTravel } from "@/lib/ui/viewer-companion/premiere-travel";
import { syncedNow } from "@/lib/ui/synced-clock";
import { premiereViewportBounds } from "@/lib/ui/premiere/panel-departure";
import { companionSofaDepth, companionSofaRelease, type CompanionSofaDepth, type CompanionSofaPoint } from "@/lib/ui/viewer-companion/sofa";
import { projectCompanionSofaBody, projectCompanionSpritePoint } from "@/lib/ui/viewer-companion/sofa-pose";
import { canStartCompanionAccessoryMotion, COMPANION_ACCESSORY_MOTION_MS, isCompanionHat, sampleCompanionAccessoryMotion } from "@/lib/ui/viewer-companion/accessory-motion";
import { playCompanionSound, type CompanionSoundMoment } from "@/lib/ui/viewer-companion/companion-sound";
import { getCompanionRadioSnapshot, getCompanionRadioToggleIntent, stopCompanionRadio, subscribeCompanionRadio, toggleCompanionRadio } from "@/lib/ui/viewer-companion/radio-player";
import { getCompanionRadioPreferences, subscribeCompanionRadioPreferences } from "@/lib/ui/viewer-companion/radio-preferences";
import { canStartCompanionRadioReaction, companionRadioFoodPriority, COMPANION_RADIO_REACTION_MS, createCompanionRadioReactionInbox, getCompanionRadioReaction, sampleCompanionRadioReaction, type CompanionRadioReaction } from "@/lib/ui/viewer-companion/radio-reaction";
import { COMPANION_INSTRUMENT_EVENT, type CompanionInstrumentPulse } from "@/lib/ui/viewer-companion/instrument-music";
import { createCompanionInstrumentInbox, getCompanionInstrumentReaction, sampleCompanionInstrumentReaction, type CompanionInstrumentReaction } from "@/lib/ui/viewer-companion/instrument-reaction";
import { companionRunContactSituation, type CompanionSituationId } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_ACCESSORY_NAMES, type CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { advanceCompanionMealWait, projectCompanionMouth } from "@/lib/ui/viewer-companion/mouth";
import { COMPANION_FEED_RETRY_MS, rememberCompanionOutcomes } from "@/lib/ui/viewer-companion/planner";
import { companionSofaFlightMs, sampleCompanionSofaTravel, type CompanionSofaTravelShape } from "@/lib/ui/viewer-companion/sofa-travel";
import { createCompanionFoodCuriosity } from "@/lib/ui/viewer-companion/novel-food";
import { createCompanionHousehold, type CompanionHouseholdBeat, type CompanionHouseholdHome } from "@/lib/ui/viewer-companion/household";
import { createCompanionViewportRecovery } from "@/lib/ui/viewer-companion/viewport-recovery";
import { companionPositionPoint, resolveCompanionPosition, type CompanionPositionMemory, type CompanionPositionSnapshot } from "@/lib/ui/viewer-companion/position-memory";
import { companionGripProfile } from "@/lib/ui/viewer-companion/contact-grip";
import { companionMaterialScale } from "@/lib/ui/viewer-companion/material-scale";
import { DEFAULT_COMPANION_CARE, loadCompanionCare, saveCompanionCare, subscribeCompanionHabits, subscribeCompanionLife } from "@/lib/ui/viewer-companion/care";
import { learnCompanionHabits, type CompanionExperience } from "@/lib/ui/viewer-companion/habits";
import { experienceCompanionLife, type CompanionLifeExperience } from "@/lib/ui/viewer-companion/life";
import { advanceCompanionCollection, equipCompanionAccessory, flushCompanionCollection, getCompanionUnreadCounts, loadCompanionCollection, openCompanionGift, recordCompanionConsumedFood, recordCompanionGiftInteraction, recordCompanionObservedBehavior, recordCompanionObservedSituation, subscribeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { createCompanionHearts } from "@/lib/ui/viewer-companion/hearts";
import { boundCompanionHangingPose, createCompanionMotion, nextCompanionPaint, sampleCompanionTravel } from "@/lib/ui/viewer-companion/motion";
import { createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { placeCompanionOverlayPerch, type CompanionOverlayPerch } from "@/lib/ui/viewer-companion/overlay-perch";
import { createCompanionOverlayReturn, type CompanionReturnPoint } from "@/lib/ui/viewer-companion/overlay-return";
import { FLIP_MS } from "@/lib/ui/flip-motion";
import { hasAmbientPauseOutside } from "@/lib/ui/ambient-pause";
import { createCompanionSupportMotion } from "@/lib/ui/viewer-companion/support-motion";
import { boundCompanionHeldPose, createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";
import { createCompanionHeldShake } from "@/lib/ui/viewer-companion/held-shake";
import { companionViewportFloorAbove, companionWorldHiddenReason, firstCompanionSupportBelow, nearestVerticalCompanionSupport, recoverCompanionDropAtViewportFloor, recoverCompanionPassiveFloor, recoverCompanionVerticalSupport } from "@/lib/ui/viewer-companion/support-landing";
import { boundCompanionBallisticArc, boundCompanionSineArc, companionBallisticArcIsSafe } from "@/lib/ui/viewer-companion/jump-arc";
import { createCompanionPettingContact, createCompanionPettingGesture, createCompanionPettingWindow } from "@/lib/ui/viewer-companion/petting";
import { randomCompanionFood, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { acquireDecodedCompanionSprite, canDecodeCompanionSprite, companionMotionClips, companionSpriteMetadata as registration, companionSpriteSources, decodeCompanionSprite, isCompanionSpriteDecoded, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionNextPlayRow, companionTapReaction, sampleCompanionCozySleep, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { COMPANION_CARD_PLAY_EVENT, createCompanionCardPlay } from "@/lib/ui/viewer-companion/card-play";
import { requestCompanionPanelSide } from "@/lib/ui/viewer-companion/panel-play";
import { gfxMode as readGfxMode } from "@/lib/ui/gfx";
import { hapticSuccess } from "@/lib/ui/haptics";
import { CompanionFood, type CompanionFoodControl } from "./companion-food";
// Keep a cold stamp/gift's Suspense boundary local. Suspending the whole
// resident also disconnects its layout-owned decoded picture temporarily.
const CompanionCollectionArt = dynamic(() => import("./companion-collection-art").then(module => module.CompanionCollectionArt), { loading: () => null });
import { CompanionBedForeground, CompanionHome, type CompanionHomeAction } from "./companion-home";
import { useHomeShelf } from "./use-home-shelf";
import "./viewer-companion.css";

type Props = { onOpenBook: () => void; root: RefObject<HTMLElement | null>; preferences: CompanionPreferences; blocked: boolean; overlayOpen: boolean; workspaceBusy?: boolean; agenda: boolean; monthKey: string; reduced: boolean; homeHost: HTMLElement | null; homeVisible: boolean; launcherHost?: HTMLElement | null; compactHost?: HTMLElement | null; premiereCue?: CompanionPremiereCue | null; onPremiereJoin?: (generation: string, id: string) => void; positionMemory?: CompanionPositionMemory };
type Control = Record<Exclude<CompanionHomeAction, "book"> | "place" | "rest", () => void>;
type RuntimeAction = CompanionAction & { household?: CompanionHouseholdBeat; radio?: { generation: number; reaction: CompanionRadioReaction; bpm: number; instrument?: CompanionInstrumentReaction } };
const sampleWorldMusic = (music: NonNullable<RuntimeAction["radio"]>, age: number) => music.instrument ? sampleCompanionInstrumentReaction(music.instrument, age, music.bpm) : sampleCompanionRadioReaction(music.reaction, age, music.bpm);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const COMPANION_SIZE = 92;
const isHomeFloor = (id: string) => /^companion-home-floor(?:-\d+)?$/.test(id);
const isHomeSupport = (id: string) => id === "companion-home" || isHomeFloor(id);
const spriteSources = registration.rows.map((_, row) => companionSpriteSources(row));

/** One optional local creature. It senses geometry, heart occupancy and local
 * input/snack coordinates; titles and account data never enter its brain.
 * Imperative transform/frame writes never re-render the calendar on a tick. */
export default function ViewerCompanion({ onOpenBook, root, preferences, blocked, overlayOpen, workspaceBusy = false, agenda, monthKey, reduced, homeHost, homeVisible, launcherHost = null, compactHost = null, premiereCue = null, onPremiereJoin, positionMemory }: Props) {
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  // Audio sliders do not restart geometry, the brain or decoded body owners.
  const worldPreferencesKey = companionWorldPreferencesKey(preferences);
  const actorId = useId();
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), reaction = useRef<HTMLSpanElement>(null), facing = useRef<HTMLSpanElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const pettingHand = useRef<HTMLSpanElement>(null);
  const accessoryBack = useRef<HTMLSpanElement>(null), accessoryFront = useRef<HTMLSpanElement>(null), giftProp = useRef<HTMLSpanElement>(null), giftButton = useRef<HTMLButtonElement>(null);
  const wardrobe = useRef<{ equipped: CompanionAccessoryId | null; pending: CompanionAccessoryId | null }>({ equipped: null, pending: null });
  const refreshWardrobe = useRef<() => void>(() => {});
  const situationSink = useRef<(id: CompanionSituationId) => void>(() => {});
  const [pendingGift, setPendingGift] = useState<CompanionAccessoryId | null>(null), [openedGift, setOpenedGift] = useState<CompanionAccessoryId | null>(null);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [firstTaste, setFirstTaste] = useState<{ kind: CompanionFoodKind; x: number; y: number } | null>(null);
  const tasteStamp = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = tasteStamp.current;
    if (!firstTaste || !node) return;
    if (!preferences.enabled || blocked || overlayOpen || document.hidden) { setFirstTaste(null); return; }
    const destination = Array.from(document.querySelectorAll<HTMLElement>(".vc-book-button")).find(book => {
      const rect = book.getBoundingClientRect();
      return rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && !book.closest("[hidden],[inert]");
    })?.getBoundingClientRect();
    const end = destination ? { x: destination.left + destination.width / 2, y: destination.top + destination.height / 2 } : { x: firstTaste.x, y: firstTaste.y - 72 };
    const reduced = document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? "");
    const transform = (x: number, y: number, scale: number) => `translate3d(${x - 24}px,${y - 24}px,0) scale(${reduced ? 1 : scale})`;
    const animation = node.animate([
      { opacity: 0, transform: transform(firstTaste.x, firstTaste.y, 1.3) },
      { opacity: 1, transform: transform(firstTaste.x, firstTaste.y - (reduced ? 0 : 36), 1), offset: .28 },
      { opacity: 1, transform: transform(reduced ? firstTaste.x : end.x, reduced ? firstTaste.y : end.y, .55), offset: .85 },
      { opacity: 0, transform: transform(reduced ? firstTaste.x : end.x, reduced ? firstTaste.y : end.y, .45) },
    ], { duration: reduced ? 600 : 1500, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" });
    animation.onfinish = () => setFirstTaste(null);
    const hidden = () => { if (document.hidden) setFirstTaste(null); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); animation.onfinish = null; animation.cancel(); };
  }, [firstTaste, preferences.enabled, blocked, overlayOpen]);
  useEffect(() => {
    const update = () => setRadioPlaying(getCompanionRadioSnapshot().playing);
    const off = subscribeCompanionRadio(update); update();
    return () => { off(); stopCompanionRadio(); };
  }, []);
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
  const [ready, setReady] = useState(false), [unreadCollection, setUnreadCollection] = useState(false);
  const compactActive = ready && !suspended && !blocked && !(homeVisible && homeHost) && !!launcherHost && !!compactHost;
  const homeShelf = useHomeShelf({ active: compactActive, expanded: homeExpanded, monthKey, host: compactHost, launcher: homeLauncher, room: compactHome, setExpanded: setHomeExpanded });
  const [geometryIdentity] = useState(createCompanionGeometryIdentity);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready || !preferences.enabled) {
      wardrobe.current = { equipped: null, pending: null }; setUnreadCollection(false); setPendingGift(null); setOpenedGift(null); refreshWardrobe.current(); return;
    }
    const read = (value: ReturnType<typeof loadCompanionCollection>) => {
      const prior = wardrobe.current;
      setUnreadCollection(getCompanionUnreadCounts(value).total > 0);
      wardrobe.current = { equipped: value.gifts.equipped, pending: value.gifts.pending };
      if (value.gifts.pending && prior.pending !== value.gifts.pending) situationSink.current("gift-arrival");
      setPendingGift(value.gifts.pending); setOpenedGift(current => current && value.gifts.unlocked.includes(current) ? current : null); refreshWardrobe.current();
    };
    read(loadCompanionCollection());
    return subscribeCompanionCollection(read);
  }, [ready, preferences.enabled]);
  useEffect(() => {
    if (!ready || !preferences.enabled) return;
    let live = true;
    const cache = spriteQuality.current;
    requestSprite.current = src => {
      if (isCompanionSpriteDecoded(src) || cache.pending.has(src) || (cache.failures.get(src) ?? 0) >= 2 || !canDecodeCompanionSprite(src)) return;
      cache.pending.add(src);
      void decodeCompanionSprite(src).then(ok => {
        cache.pending.delete(src);
        if (ok) cache.failures.delete(src);
        else if (canDecodeCompanionSprite(src)) cache.failures.set(src, (cache.failures.get(src) ?? 0) + 1);
        if (live && ok) window.dispatchEvent(new Event("vic:companion-sprite"));
      });
    };
    spriteSources[0].forEach(src => requestSprite.current(src));
    return () => { live = false; requestSprite.current = () => {}; };
  }, [ready, preferences.enabled]);
  useLayoutEffect(() => {
    const host = sprite.current;
    if (!ready || !host) return;
    // Ordinary controller/preference restarts retain the displayed picture.
    // React may also clean up layout effects when a Suspense tree is hidden;
    // the painter must readopt the same decoded node on a resumed live host.
    return () => {
      if (!host.firstElementChild) return;
      host.replaceChildren();
      // Other active owners retry on their existing clock. Dispatching here
      // could re-enter this controller before its passive cleanup finishes.
    };
  }, [ready]);
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

  useEffect(() => {
    void worldPreferencesKey;
    const preferences = preferencesRef.current;
    const el = body.current, button = actor.current, page = root.current, image = sprite.current, poseLayer = pose.current, reactionLayer = reaction.current, facingLayer = facing.current, contactLayer = contact.current, inertiaLayer = inertia.current;
    if (!ready || !el || !button || !page || !image || !poseLayer || !reactionLayer || !facingLayer || !contactLayer || !inertiaLayer || !preferences.enabled) return;
    if (blocked) { el.hidden = true; setSuspended(true); setHomeExpanded(false); return; }
    // Settings/auto/storage notifications own this snapshot. Animation frames
    // must not synchronously reread localStorage for each pose/spring/layer.
    let graphicsMode = readGfxMode();
    const gfxMode = () => graphicsMode;
    if (!careLoaded.current) { brain.current = { ...brain.current, ...loadCompanionCare() }; careLoaded.current = true; }
    else { const saved = loadCompanionCare(); brain.current = { ...brain.current, habits: saved.habits, life: saved.life }; }
    loadCompanionCollection();
    let lastMemorySave = performance.now();
    const persistCare = (force = false) => { const saved = saveCompanionCare(brain.current, force); brain.current = { ...brain.current, habits: saved.habits, life: saved.life }; flushCompanionCollection(force); lastMemorySave = performance.now(); };
    const offHabits = subscribeCompanionHabits(habits => { brain.current = { ...brain.current, habits }; });
    const offLife = subscribeCompanionLife(life => { brain.current = { ...brain.current, life }; });
    const rememberLife = (event: CompanionLifeExperience) => {
      if (!preferences.enabled || !preferences.learnFromYou) return false;
      const life = experienceCompanionLife(brain.current.life, event);
      if (life === brain.current.life) return false;
      brain.current = { ...brain.current, life }; persistCare(true); return true;
    };
    const experience = (kind: CompanionExperience, foodKind?: CompanionFoodKind) => {
      // Real direct interactions can earn a keepsake even when learning is
      // OFF. Autonomous play and merely spawned food never call this path.
      if (preferences.enabled && ["petted", "reassured", "fed", "played"].includes(kind)) recordCompanionGiftInteraction();
      if (!preferences.enabled || !preferences.learnFromYou) return false;
      const habits = learnCompanionHabits(brain.current.habits, kind);
      const event: CompanionLifeExperience | undefined = kind === "fed" ? foodKind ? { kind: "fed", food: foodKind } : undefined : kind === "reassured" ? { kind: "petted" } : kind === "petted" || kind === "played" ? { kind } : undefined;
      const life = event ? experienceCompanionLife(brain.current.life, event) : brain.current.life;
      if (habits === brain.current.habits && life === brain.current.life) return false;
      brain.current = { ...brain.current, habits, life };
      // Only a credited experience flushes. Persist its spent credit too, so
      // a quick reload cannot train another full experience immediately.
      persistCare(true);
      return true;
    };
    const transferred = (thrown = false, rough = false) => { if (!rough) experience("played"); logActivity("ui.click", { target: thrown ? "companion-throw" : "companion-drag" }); };
    const publishCare = () => {
      const { hunger, affection, energy, curiosity } = brain.current;
      const next = { hunger: Math.round(hunger * 100) / 100, affection: Math.round(affection * 100) / 100, energy: Math.round(energy * 100) / 100, curiosity: Math.round(curiosity * 100) / 100 };
      setCare(previous => previous.hunger === next.hunger && previous.affection === next.affection && previous.energy === next.energy && previous.curiosity === next.curiosity ? previous : next);
    };
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
    let homeJourney: false | "called" | "automatic" = false;
    let homeWakeUntil = 0, strandedSince = 0, homeRetryAt = 0;
    let homeWaitingGeometry = false, homeValidationRequested = false, homeLookUsed = false, homeLegs = 0;
    let homeEntryFloor: string | undefined;
    let pendingHomeRecall: HTMLElement | undefined;
    const cancelHomeJourney = () => { pendingHomeRecall = undefined; homeJourney = false; homeWakeUntil = 0; strandedSince = 0; homeWaitingGeometry = homeValidationRequested = homeLookUsed = false; homeLegs = 0; homeEntryFloor = undefined; el.removeAttribute("data-home-journey"); el.removeAttribute("data-home-waiting"); el.removeAttribute("data-home-wait-pose"); };
    const supportById = (id: string) => platforms.find(p => p.id === id) ?? landingPlatforms.find(p => p.id === id);
    // Only an actual impact teaches this brief local caution. It keeps the
    // current food/route identity and never persists a calendar location.
    const rememberMishapPlace = () => {
      if (!preferences.learnFromYou || !supportById(support)) return;
      brain.current = { ...brain.current, places: rememberCompanionOutcomes(brain.current.places ?? [], [{ targetId: support, result: "blocked" }], brain.current.activeMs) };
    };
    let worldSeeded = saved?.seeded ?? false;
    let raf = 0, timer: ReturnType<typeof setTimeout> | undefined, lastPaint = 0, lastTick = performance.now(), lastNeeds = lastTick, lastCare = lastTick, stopped = false, sleeping = false;
    let inputPaintQueued = false, interactionUntil = 0;
    let pause = true, started = false, nextDecision = 0, needsLanding = false, afterPetLanding = false, restAfterLanding = false;
    let action: RuntimeAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, keyboardMoved = false, consumePlacementClick = false;
    let sofaTravelActive = false;
    let sofaFlightShape: CompanionSofaTravelShape | undefined, ballisticCoefficient: number | null = null;
    let jumpRecoveryContext: Pick<CompanionAction, "foodId" | "intention" | "episode"> | undefined;
    const jumpAnticipation = () => action?.runUp ? 0 : (action?.jumpHeight ?? 140) > 140 ? 320 : COMPANION_TIMING.jumpAnticipation;
    let placementPointer: number | null = null;
    let pointer: { x: number; y: number } | undefined, pointerAnchor: { x: number; y: number } | undefined, pointerStableSince = 0, heartResult: "added" | "removed" | "blocked" | "missing" | null = null;
    const foodCuriosity = createCompanionFoodCuriosity();
    const household = createCompanionHousehold();
    let householdEffectApplied = false;
    let curiosityTossed = false, invitedUntil = 0, lastRoughAt = -Infinity, roughInGrip = false;
    const hurtTrust = (kind: "rough-play" | "betrayed", now: number) => {
      if (now - lastRoughAt < 2500) return;
      lastRoughAt = now;
      brain.current = { ...brain.current, affection: Math.max(0, brain.current.affection - (kind === "betrayed" ? .22 : .16)),
        affect: { ...brain.current.affect, joy: 0, frustration: .9 } };
      experience(kind); persistCare(true); publishCare(); invitedUntil = 0;
    };
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
    let bedScene: { anchor: Element; anchorX: number; anchorY: number; left: number; top: number; width: number; height: number; opacity: number; opacitySources: Element[]; clip: { left: number; top: number; right: number; bottom: number } } | undefined;
    let bedNeedsPaint = false;
    // Ownership outlives a scene snapshot so invalidation/portal replacement
    // can always restore the old room, even after bedScene was cleared.
    let localBedFront: SVGGElement | null = null, localBedFrontHidden = false;
    const sampleSofaRoute = (candidate: CompanionAction, from: { x: number; y: number }, progress: number, occupied = support, fixed?: CompanionSofaTravelShape) => bedScene?.anchor.isConnected && candidate.kind === "jump" && (occupied === "companion-home" || candidate.target.platformId === "companion-home")
      ? sampleCompanionSofaTravel(from, candidate.target, progress, Math.max(size + 8, bedScene.top + bedScene.height * .19 - size * .24 - 8), { left: bedScene.left, right: bedScene.left + bedScene.width, bodyHalfWidth: size * .38 + 3, ceiling: size + 8 }, fixed) : undefined;
    const sofaFlightProgress = (now: number) => travel > 0 ? clamp((now - began - jumpAnticipation()) / travel, 0, 1) : clamp((now - began) / Math.max(1, total - COMPANION_TIMING.jumpLanding), 0, 1);
    const sofaPassage = (progress: number) => action && (travel === -2 || travel > 0) ? sampleSofaRoute(action, origin, progress, support, sofaFlightShape) : undefined;
    const hideBed = () => {
      if (localBedFrontHidden && localBedFront) { localBedFront.removeAttribute("visibility"); localBedFrontHidden = false; }
      if (front && !front.hidden) front.hidden = true;
    };
    // One extra static scene sample per existing geometry delivery. Frame
    // following below carries its cached anchor delta without new scene scans.
    const measureBed = () => {
      const bed = document.querySelector<SVGSVGElement>(".vc-home:not([data-panel-collapsed]) .vc-plush-bed"), anchor = bed?.parentElement?.querySelector(".vc-home-cushion"), room = bed?.closest(".vc-home-room");
      if (!front || !bed || !anchor || !room || !bed.isConnected) { bedScene = undefined; hideBed(); return; }
      const localFront = bed.querySelector<SVGGElement>(".vc-bed-local-front");
      if (!localFront) { bedScene = undefined; hideBed(); return; }
      if (localBedFront !== localFront) { hideBed(); localBedFront = localFront; }
      const rect = bed.getBoundingClientRect(), seat = anchor.getBoundingClientRect(), clip = room.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || clip.width <= 0 || clip.height <= 0) { bedScene = undefined; hideBed(); return; }
      // The portal already inherits body/html opacity. Cache room-side ancestors
      // once, including carriers whose CSS entry has not started yet. The finite
      // follower reads only this array, never rescanning parents or animations.
      const opacitySources: Element[] = [];
      let opacity = 1;
      for (let node: Element | null = bed; node && node !== document.body; node = node.parentElement) {
        const value = clamp(Number(getComputedStyle(node).opacity || 1), 0, 1);
        opacity *= value;
        opacitySources.push(node);
      }
      bedScene = { anchor, anchorX: seat.left, anchorY: seat.top, left: rect.left, top: rect.top, width: rect.width, height: rect.height, opacity, opacitySources, clip: { left: clip.left, top: clip.top, right: clip.right, bottom: clip.bottom } };
      bedNeedsPaint = true;
      const material = getComputedStyle(room.closest(".vc-home")!);
      for (const token of ["--vc-bed-light", "--vc-bed-cloth", "--vc-bed-shade", "--vc-soft-shadow"]) style(front, token, material.getPropertyValue(token));
    };
    // The complete room already draws its front. The extra portal is needed
    // only around an interior resident; its retained seat and opacity share
    // the existing finite layout lease, with no new scan or animation clock.
    const followBed = (sample?: { anchorX: number; anchorY: number }, now = performance.now()) => {
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
      const opacity = now <= followUntil
        ? bed.opacitySources.reduce((alpha, source) => alpha * clamp(Number(getComputedStyle(source).opacity || 1), 0, 1), 1)
        : bed.opacity;
      const opacityChanged = opacity !== bed.opacity;
      bed.opacity = opacity;
      return Boolean(dx || dy || opacityChanged);
    };
    const visual = createCompanionMotion({ clips: companionMotionClips, rowCount: registration.rows.length, loopRows: [0, 2, 8, 9, 11, 20], maxFrameRate: 14 });
    const supportMotion = createCompanionSupportMotion();
    const heldInertia = createCompanionHeldInertia();
    const heldShake = createCompanionHeldShake();
    const throwVelocity = createCompanionThrowVelocity();
    let flight: CompanionThrowState | undefined, flightAt = 0;
    const throwBounds = () => ({ left: size / 2 + 4, right: innerWidth - size / 2 - 4, top: size + 8, bottom: innerHeight - 12 });
    const clearThrow = () => {
      flight = undefined; flightAt = 0; throwVelocity.reset();
      for (const key of ["data-throw-phase", "data-throw-vx", "data-throw-vy"]) el.removeAttribute(key);
    };
    let shakenReleasePending: { column: number } | undefined;
    let shakenGroundColumn: number | undefined;
    let runTrip: CompanionRunTrip | undefined, runHop: CompanionAction | undefined, runUpCurve = false;
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
    let handPresentation: string | undefined;
    let awaitingAtX: false | "vertical" | "drop" = false;
    let verticalRecoveryX: number | undefined;
    let verticalLanding = false;
    const viewportRecovery = createCompanionViewportRecovery({ width: innerWidth, height: innerHeight });
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
    let guestKeyboardBounds: CompanionGuestBounds | undefined;
    let overlayHomeResident = false;
    let hideCandidate: CompanionHideTarget | undefined;
    let hideWakeTimer: ReturnType<typeof setTimeout> | undefined;
    const hideValid = () => Boolean(hiding && hiding.target.element.isConnected && page.contains(hiding.target.element) && hiding.target.element.dataset.eventid === hiding.target.eventId && (!studio || hiding.target.element.dataset.companionEvent === "ordinary") && !hiding.target.element.closest(".teaser,.teaser-revealing,.dimmed,[hidden],[inert],[aria-hidden='true']"));
    const hideHint = (show: boolean) => {
      const card = hiding?.target.element;
      if (!card || card.hasAttribute("data-companion-hide-hint") === show) return;
      if (show) {
        card.style.setProperty("--vc-hide-hint-duration", `${9000 + Math.random() * 5000}ms`);
        card.style.setProperty("--vc-hide-hint-delay", `${-Math.random() * 4000}ms`);
        card.style.setProperty("--vc-hide-hint-direction", Math.random() < .5 ? "-1" : "1");
      } else {
        for (const key of ["--vc-hide-hint-duration", "--vc-hide-hint-delay", "--vc-hide-hint-direction"]) card.style.removeProperty(key);
      }
      card.toggleAttribute("data-companion-hide-hint", show);
    };
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
    let waitingForSupport = false, supportValidationRequested = false;
    let supportValidationTimer: ReturnType<typeof setTimeout> | undefined;
    let geometryReady = false, initialGeometryMeasured = false, homeOccluded = false;
    let overlayActive = false, overlayPerch: CompanionOverlayPerch | undefined;
    let overlayDrag: { id: number; dx: number; dy: number; moved?: boolean; worldOrigin?: { x: number; y: number }; guest?: { x: number; y: number; origin: CompanionOverlayPerch; bounds?: CompanionGuestBounds; dragged: boolean } } | undefined, overlayPlacing = false;
    const isDetailGuest = () => overlayActive && Boolean(hiding?.sheet && hiding.ready || extractedFrom?.isConnected && extractedFrom === detailSheet && extractedFrom.dataset.companionDetailEvent === extractedEvent);
    const needsOverlayWorldSeed = () => overlayActive && !initialGeometryMeasured && !hiding;
    const guestBusy = (now: number) => Boolean(overlayDrag?.guest || guestKeyboardHeld || now < petUntil || now < guestUntil || hiding?.ready && hideSeek.sample(presentationNow).active);
    let returning: ReturnType<typeof createCompanionOverlayReturn> | undefined;
    let returnTargetValid = false, pickupScale = 1, pickupAt = 0;
    let pickupOffset = { x: 0, y: 0 };
    let overlayRaf = 0, perchAnimation: Animation | undefined;
    const overlayObserved = new Set<HTMLElement>();
    const disconnectOverlay = () => { overlayResize?.disconnect(); overlayMutation?.disconnect(); overlayObserved.clear(); };
    let paintedRow = -1, paintedColumn = -1, paintedCell = "", paintedFacing = 0, forceNeutralPose = false;
    let paintedTexture = image.querySelector<HTMLImageElement>(".vc-texture");
    let paintedRegistration: { x: number; y: number; clip: readonly number[] } | undefined;
    let paintedSelection: ReturnType<typeof selectCompanionSprite> | undefined;
    const pendingSituations = new Map<CompanionSituationId, { rows?: readonly number[]; expires: number; actionAt?: number }>();
    let pendingCue: CompanionSoundMoment | undefined;
    let radioState = getCompanionRadioSnapshot(), radioPreferences = getCompanionRadioPreferences();
    const radioInbox = createCompanionRadioReactionInbox(radioState.generation);
    const instrumentInbox = createCompanionInstrumentInbox();
    let instrumentAudible = soundEnabled() && soundVolume() > 0;
    let pocketCapture: { id: string; kind: CompanionFoodKind } | undefined;
    let pocketDrawn = false, pocketStashed = false, pocketEjected = false, accessoryHabitAt = 0;
    const queueSituation = (id: CompanionSituationId, rows?: readonly number[], actionAt?: number) => pendingSituations.set(id, { rows, actionAt, expires: performance.now() + 12000 });
    situationSink.current = id => { queueSituation(id); };
    if (wardrobe.current.pending) queueSituation("gift-arrival");
    let accessoryReadyAt = brain.current.activeMs + 6000, lastEquipped = wardrobe.current.equipped, accessoryWitnessed = 0, accessoryLanded = false;
    let accessoryModule: typeof import("@/lib/ui/viewer-companion/accessory") | undefined;
    let wardrobePainter: ReturnType<typeof import("@/lib/ui/viewer-companion/accessory").createCompanionAccessoryPainter> | undefined;
    let wardrobeLoading: Promise<void> | undefined, wardrobeFailures = 0;
    const ensureWardrobe = (forCarry = false) => {
      if (wardrobePainter || wardrobeLoading || wardrobeFailures >= 2 || !forCarry && !wardrobe.current.equipped && !wardrobe.current.pending) return;
      wardrobeLoading = import("@/lib/ui/viewer-companion/accessory").then(module => {
        if (stopped || !accessoryBack.current || !accessoryFront.current || !giftProp.current) return;
        accessoryModule = module;
        wardrobePainter = module.createCompanionAccessoryPainter({ back: accessoryBack.current, front: accessoryFront.current, gift: giftProp.current });
        wardrobePainter.paint(paintedSelection, wardrobe.current.equipped, Boolean(wardrobe.current.pending));
        window.dispatchEvent(new Event("vic:companion-sprite"));
      }).catch(() => { wardrobeFailures++; }).finally(() => { wardrobeLoading = undefined; });
    };
    ensureWardrobe();
    refreshWardrobe.current = () => {
      if (lastEquipped !== wardrobe.current.equipped) { lastEquipped = wardrobe.current.equipped; accessoryReadyAt = brain.current.activeMs + 6000; }
      ensureWardrobe();
      wardrobePainter?.paint(paintedSelection, wardrobe.current.equipped, Boolean(wardrobe.current.pending));
    };
    let mealAnchored = false, mealWaited = 0;
    // A controller restart does not discard its live drawing or registration
    // while the next action warms. Only the presentation lifetime releases it.
    const priorPose = Number(el.dataset.pose);
    if (paintedTexture && Number.isInteger(priorPose) && priorPose >= 0 && priorPose < registration.frames.length) {
      const prior = selectCompanionSprite(priorPose);
      if (paintedTexture.getAttribute("src") === prior.src) {
        paintedCell = `${prior.src}:${prior.index}`;
        paintedRegistration = prior.frame;
        paintedSelection = prior;
      }
    }
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
    const clearSupportWait = () => { waitingForSupport = supportValidationRequested = false; clearTimeout(supportValidationTimer); supportValidationTimer = undefined; };
    const resetInertia = () => { heldInertia.reset(); heldShake.reset(); shakenReleasePending = undefined; shakenGroundColumn = undefined; el.removeAttribute("data-held-dizzy"); sofaContact = undefined; style(inertiaLayer, "transform", "rotate(0.000deg) scale(1.0000,1.0000)"); };
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
      if (!action?.accessory) { el.removeAttribute("data-accessory-trick"); el.removeAttribute("data-accessory-beat"); }
      if (!action?.radio) { el.removeAttribute("data-radio-reaction"); el.removeAttribute("data-radio-generation"); }
      // Cursor presence belongs to a valid hover, not the pressure/reward
      // envelopes. Existing paints also release it when the world moves away.
      if (hoverPoint && (!canHover(hoverPoint) || !hoverTarget?.isConnected || isOtherControl(hoverTarget))) stopHover();
      if (hoverPoint && handPresentation && pettingHand.current) style(pettingHand.current, "transform", handPresentation);
      if (supportById(support)) worldSeeded = true;
      // Scroll can carry an anchor outside the safe viewport between full
      // scans. Never paint that interim frame over headers or clipped edges.
      // Event-owned follow frames must preserve the same empty-geometry gate
      // as the main loop, including its final neutral spring frame.
      // A failed deliberate drop has no world drawing to lend to an ordinary
      // window or pickup-recovery paint. New direct input and authored guest/
      // premiere presentation still own their existing exceptions.
      const recoveringPickup = Boolean(pickupScale !== 1 || pickupOffset.x || pickupOffset.y) && performance.now() - pickupAt < 200 && !reduced && gfxMode() !== "off";
      const hasWorldSupport = Boolean(flight) || platforms.length > 0 || Boolean(supportById(support) || action?.target.platformId && supportById(action.target.platformId));
      // During a real same-column gravity recovery, the registered artwork
      // fits above its foot before the transparent92px cell does. Keep that
      // short top-edge section neutral instead of blinking the whole creature.
      const neutralVerticalRecovery = Boolean(action?.kind === "jump" && travel === -1 && verticalLanding && action.target.platformId && supportById(action.target.platformId)
        && y < size + 8 && !pressed && !keyboardHeld && !placing && !overlayActive && !returning && !hiding && !premiereActive && !playFalling && !recoveringPickup);
      const hiddenWorld = companionWorldHiddenReason({ point: { x, y }, viewport: { width: innerWidth, height: innerHeight }, size, awaiting: awaitingAtX, hasSupport: hasWorldSupport, pendingMonth, homeOccluded, atHome: isHomeSupport(support), neutralVerticalRecovery });
      const directWorldInput = pressed || keyboardHeld || placing || overlayDrag || overlayPlacing;
      // An ordinary window does not authorize a hidden/stale world point.
      // Authored guests, premieres and actual direct handling own presentation.
      if (hiddenWorld && !premiereActive && !premiereBounce && !hiding && !isDetailGuest() && !directWorldInput
        && !(hiddenWorld !== "drop" && (returning || recoveringPickup))) { data("hiddenReason", hiddenWorld); hideBed(); stopHover(); el.hidden = true; return; }
      el.removeAttribute("data-hidden-reason");
      const displayFrame = isDetailGuest() ? interactionFrame() : { x, y, size, scale: 1 };
      const normalizedGrip = { x: grip.x / size, y: grip.y / size };
      const heldReaction = status === "held" && pressed?.grabbed && !overlayActive && !reduced && gfxMode() !== "off" ? heldShake.sample(performance.now()) : { active: false, phase: 0 };
      el.toggleAttribute("data-held-dizzy", heldReaction.active);
      if (heldReaction.active) spriteSources[23].forEach(src => requestSprite.current(src));
      // Resolve just the attended cached support/snack. No route search or DOM
      // measurement runs in pose sampling; the existing follower owns layout.
      const attention = ["look", "sniff", "play"].includes(status) ? action?.attention : undefined;
      const goal = brain.current.intention, goalSupport = goal && supportById(goal.targetId);
      if (goal && goal.remaining > 0 && ["consider", "travel"].includes(goal.stage) && goalSupport) {
        const snack = goal.foodId ? food.current?.foods().find(item => item.id === goal.foodId) : undefined;
        data("travelGoal", `${goal.kind}:${goal.foodId ?? goal.targetId}:${goal.foodId ? "" : goal.offset.toFixed(4)}`);
        data("travelTargetX", platformLandingX(goalSupport, snack?.x ?? goalSupport.x + goalSupport.width * goal.offset).toFixed(3));
        data("travelRemaining", String(goal.remaining)); data("travelStage", goal.stage);
      } else for (const key of ["data-travel-goal", "data-travel-target-x", "data-travel-remaining", "data-travel-stage"]) el.removeAttribute(key);
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
      // The foot-pivot recovery owns its gesture after landing. End the finite
      // hand tail before bounding this larger pose in a neutral outer plane.
      if (status === "play" && (action?.play === "dizzy" || action?.play === "tumble" || action?.play === "slip-tumble") && sample.row === 23) heldInertia.reset();
      const sway = neutralVerticalRecovery ? { tilt: 0, stretch: 0 } : boundCompanionHeldPose(heldInertia.sample(performance.now()), physicalOrigin, physicalGrip, displayFrame.size, { width: innerWidth, height: innerHeight });
      const shape = heldPivot || presentationNow - releasedPivotAt < 100 ? boundCompanionHangingPose(sample, physicalOrigin, physicalGrip, displayFrame.size, { width: innerWidth, height: innerHeight }, sway) : { ...sample };
      const play = action?.kind === "play" && action.play && status === "play" ? sampleCompanionPlay(action.play, (performance.now() - began) / total, reduced || gfxMode() === "off") : action?.kind === "sleep" && action.living === "cozy" && status === "sleep" ? sampleCompanionCozySleep(performance.now() - began, total, action.cozySettled, reduced || gfxMode() === "off") : undefined;
      if (play) {
        // The current actual support owns world position throughout the gag.
        shape.bob += play.lift; shape.tilt += play.lean;
        shape.scaleY *= 1 - play.compression; shape.scaleX = 1 / shape.scaleY;
        if ((action?.play === "dizzy" || action?.play === "tumble" || action?.play === "slip-tumble") && play.beat === "recover") Object.assign(shape, boundCompanionHangingPose(shape, physicalOrigin, { x: displayFrame.size / 2, y: displayFrame.size }, displayFrame.size, { width: innerWidth, height: innerHeight }, { tilt: 0, stretch: 0 }));
      }
      const accessoryMotion = action?.accessory && status === "look" && action.accessory === wardrobe.current.equipped ? sampleCompanionAccessoryMotion(action.accessory, performance.now() - began) : undefined;
      if (accessoryMotion) {
        shape.bob -= accessoryMotion.bodyLift; shape.tilt += accessoryMotion.bodyLean;
        shape.scaleY *= 1 - accessoryMotion.squash; shape.scaleX = 1 / shape.scaleY;
      }
      const radioMotion = action?.radio && status === "look" ? sampleWorldMusic(action.radio, performance.now() - began) : undefined;
      if (radioMotion) {
        shape.bob += radioMotion.bob; shape.tilt += radioMotion.tilt;
        shape.scaleY *= 1 - radioMotion.squash; shape.scaleX = 1 / shape.scaleY;
      }
      if (neutralVerticalRecovery) Object.assign(shape, { bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
      const inertiaScale = companionMaterialScale(1 + sway.stretch);
      style(inertiaLayer, "transform", `rotate(${sway.tilt.toFixed(3)}deg) scale(${inertiaScale.scaleX.toFixed(4)},${inertiaScale.scaleY.toFixed(4)})`);
      const pressure = touch.sample(performance.now(), reduced || gfxMode() === "off" || neutralVerticalRecovery);
      if (!pressure.pressure && !hoverPetting && el.dataset.petting === "touch") data("petting", "ready");
      const contactScale = companionMaterialScale(1 - pressure.squash);
      style(contactLayer, "transform", `translate3d(${(pressure.x * sample.facing).toFixed(3)}px,${pressure.y.toFixed(3)}px,0) rotate(${(pressure.tilt * sample.facing).toFixed(3)}deg) scale(${contactScale.scaleX.toFixed(4)},${contactScale.scaleY.toFixed(4)})`);
      const response = neutralVerticalRecovery ? { lift: 0, squash: 0 } : supportMotion.sample(performance.now());
      const reactionScale = companionMaterialScale(1 - response.squash);
      style(reactionLayer, "transform", `translate3d(0,${response.lift.toFixed(3)}px,0) scale(${reactionScale.scaleX.toFixed(4)},${reactionScale.scaleY.toFixed(4)})`);
      // World travel stays smooth even when the authored pose holds. Registration
      // is measured from the opaque body, not transparent padding/shadow specks.
      const restore = reduced || gfxMode() === "off" ? 1 : sampleCompanionTravel(clamp((performance.now() - pickupAt) / 200, 0, 1));
      const world = { x: x + pickupOffset.x * (1 - restore), y: y + pickupOffset.y * (1 - restore), scale: lerp(pickupScale, 1, restore) };
      let display = overlayActive && overlayPerch && (isDetailGuest() || overlayDrag) ? overlayPerch : returning?.sample(performance.now(), world, geometryReady && returnTargetValid, reduced || gfxMode() === "off").point ?? world;
      let displayOpacity = 1;
      if (premiereDisplay) { display = premiereDisplay; displayOpacity = premiereDisplay.opacity; }
      if (hiding && (hide.phase === "entering" || hide.phase === "emerging")) {
        const p = sampleCompanionTravel(hide.phase === "emerging" ? 1 - hide.progress : hide.progress), entry = hiding.target.entry;
        display = { x: lerp(hiding.from.x, entry.x, p), y: lerp(hiding.from.y, entry.y + size * .08, p), scale: lerp(1, .12, p) };
        displayOpacity = 1 - p;
      } else if (hiding?.sheet) displayOpacity = hide.phase === "found" ? Math.min(1, hide.progress * 4) : 1;
      style(el, "transform", `translate3d(${(display.x - size / 2).toFixed(3)}px,${(display.y - size).toFixed(3)}px,0) scale(${display.scale})`);
      const chew = status === "eat" && !reduced ? Math.sin(presentationNow * .024) * .012 : 0;
      const poseScale = companionMaterialScale(shape.scaleY - chew * .8);
      style(poseLayer, "transform", `translate3d(0,${shape.bob.toFixed(3)}px,0) rotate(${shape.tilt.toFixed(3)}deg) scale(${poseScale.scaleX.toFixed(4)},${poseScale.scaleY.toFixed(4)})`);
      if (sample.facing !== paintedFacing) { facingLayer.style.transform = `scaleX(${sample.facing})`; el.dataset.facing = sample.facing < 0 ? "left" : "right"; paintedFacing = sample.facing; }
      // Expression alone changes art. The row8 held sampler above still owns
      // gravity, the ear/body grip, facing and the full-pose viewport bounds.
      // Six drawing steps per520ms keep this held cycle below14Hz.
      // Retain the final spiral drawing through real ballistic travel and the
      // first ground beat. Physical fall/landing sampling stays independent.
      const carriedColumn = !reduced && gfxMode() !== "off" && !overlayActive ? action?.kind === "jump" ? shakenReleasePending?.column : action?.play === "dizzy" && sample.row === 22 ? shakenGroundColumn : undefined : undefined;
      const drawingRow = heldReaction.active || carriedColumn !== undefined ? 22 : sample.row;
      const column = heldReaction.active ? Math.min(registration.rows[22].length - 1, Math.floor(Math.floor(heldReaction.phase * 6) / 6 * registration.rows[22].length)) : carriedColumn ?? sample.column;
      const index = registration.rows[drawingRow][column];
      const selected = selectCompanionSprite(index, drawingRow, column);
      requestSprite.current(selected.src);
      // Prepare only the imminent jump stage, within the shared3-image/
      //2-decode budget. Never fan out all four stages on every pose sample.
      if (action?.kind === "jump" && drawingRow >= 3 && drawingRow <= 5) spriteSources[drawingRow + 1].forEach(src => requestSprite.current(src));
      if (drawingRow !== paintedRow || column !== paintedColumn) {
        el.style.setProperty("--vc-column", `${column / 15 * 100}%`);
        el.style.setProperty("--vc-row", `${drawingRow / (registration.rows.length - 1) * 100}%`);
        paintedRow = drawingRow; paintedColumn = column;
      }
      const cellKey = `${selected.src}:${selected.index}`;
      // Use the exact decoded Image. Reusing its URI as a CSS background would
      // start another independent image consumer and can paint a blank cell.
      const texture = paintedTexture?.getAttribute("src") === selected.src && paintedTexture.parentElement === image
        ? paintedTexture : acquireDecodedCompanionSprite(selected.src, image);
      const needsAdoption = texture && texture.parentElement !== image;
      if (texture && (cellKey !== paintedCell || needsAdoption)) {
        const cell = selected.frame, grid = selected.grid, rows = selected.gridRows;
        if (texture !== paintedTexture || needsAdoption) {
          texture.className = "vc-texture";
          texture.alt = ""; texture.draggable = false;
          texture.style.width = `${grid * 100}%`;
          texture.style.height = `${rows * 100}%`;
        }
        texture.style.transform = `translate3d(${-(selected.index % grid) / grid * 100}%,${-Math.floor(selected.index / grid) / rows * 100}%,0)`;
        image.style.transform = `translate3d(${cell.x / 80 * size}px,${cell.y / 80 * size}px,0)`;
        image.style.clipPath = `inset(${cell.clip.map(value => `${value / 80 * 100}%`).join(" ")})`;
        // Configuration and adoption are synchronous. A live foreign owner is
        // never detached; an unavailable packet leaves the old body intact.
        if (texture !== paintedTexture || needsAdoption) { image.replaceChildren(texture); paintedTexture = texture; }
        data("pose", String(selected.physicalIndex)); data("atlas", "hd"); data("quality", "sharp");
        paintedCell = cellKey;
        paintedRegistration = cell;
        paintedSelection = selected;
      }
      const observed = { requestedRow: drawingRow, requestedIndex: selected.physicalIndex, adoptedIndex: paintedSelection?.physicalIndex, requestedSrc: selected.src, adoptedSrc: paintedSelection?.src,
        decoded: Boolean(paintedTexture?.complete && paintedTexture.naturalWidth && paintedTexture.parentElement === image && paintedTexture.getAttribute("src") === selected.src),
        visible: !el.hidden && !document.hidden && displayOpacity > .05 };
      // Listening is a local performance, not a newly witnessed authored
      // behavior or a care reward. Keep ordinary collection truth separate.
      let discovered = !action?.radio && recordCompanionObservedBehavior(observed), giftDiscovered = false;
      const projection = { size, display, shape, pressure, response, facing: sample.facing, sway, chew,
        poseOrigin: heldPivot || presentationNow - releasedPivotAt < 100 ? { x: sample.facing < 0 ? size - grip.x : grip.x, y: grip.y } : undefined,
        inertiaOrigin: grip };
      const carriedFood = food.current?.carried();
      if (carriedFood && paintedSelection) {
        const carryAnchor = accessoryModule?.companionCarryAnchor(paintedSelection);
        const carryPoint = carryAnchor ? projectCompanionSpritePoint({ ...projection, cell: paintedSelection.frame }, carryAnchor) : null;
        // Transport sits on the registered upper front of the body. The
        // 32px snack foot is8px below that point, leaving real floor clearance.
        if (carryPoint) food.current?.carry(carriedFood, { x: carryPoint.x, y: carryPoint.y + 8 });
      }
      if (status === "eat" && action?.kind === "eat") {
        const mouth = paintedSelection ? projectCompanionMouth(paintedSelection, projection) : null;
        if (mouth) { mealAnchored = true; food.current?.nibble(action.foodId, clamp((performance.now() - began) / total, 0, 1), mouth, sample.facing); }
        else food.current?.nibble();
      }
      if (action?.accessory === "magic-pocket" && accessoryMotion && preferences.rarePrank && paintedSelection && observed.decoded && wardrobePainter?.accessoryReady()) {
        const opening = accessoryModule?.companionAccessoryAnchor(paintedSelection, "magic-pocket", "opening", accessoryMotion.accessory);
        const point = opening && projectCompanionSpritePoint({ ...projection, cell: paintedSelection.frame }, opening);
        const progress = clamp((performance.now() - began) / total, 0, 1);
        if (point && pocketCapture && !pocketStashed && progress >= .2 && progress < .78) {
          pocketDrawn = true; food.current?.nibble(pocketCapture.id, clamp((progress - .2) / .35, 0, 1), point, sample.facing);
        }
        if (point && !pocketEjected && progress >= .78 && (!pocketCapture || pocketStashed)) {
          pocketEjected = true; food.current?.spawn(randomCompanionFood(pocketCapture?.kind), { x: point.x + sample.facing * 22, y: point.y - 8 }, undefined, true);
        }
        if (point && pocketCapture && pocketDrawn && !pocketStashed && progress >= .78) {
          // Keep the original entity until this atomic swap. Interrupting the
          // earlier shrink only restores its presentation through clearAction.
          pocketStashed = food.current?.stash(pocketCapture.id) ?? false;
          if (pocketStashed) { pocketEjected = true; food.current?.spawn(randomCompanionFood(pocketCapture.kind), { x: point.x + sample.facing * 22, y: point.y - 8 }, undefined, true); }
        }
      }
      data("state", status);
      if (!action?.radio?.instrument) el.removeAttribute("data-instrument-reaction");
      if (action?.living && ["play", "sleep", "walk"].includes(status)) data("living", action.living); else el.removeAttribute("data-living");
      data("platform", support);
      data("journey", action ? String(began) : "");
      if (shadow.current) {
        const progress = action ? clamp((performance.now() - began) / total, 0, 1) : 0;
        const ground = playFalling ? action!.target.y : action?.kind === "jump" ? lerp(origin.y, action.target.y, progress) : supportById(support)?.y ?? y;
        const altitude = Math.max(0, ground - y - response.lift + (accessoryMotion?.bodyLift ?? 0) - (radioMotion?.bob ?? 0)), scale = clamp(1 - altitude / 260, .35, 1);
        style(shadow.current, "transform", `translate3d(0,${Math.max(0, ground - y).toFixed(2)}px,0) scale(${scale.toFixed(3)})`);
        style(shadow.current, "opacity", pressed?.grabbed || keyboardHeld ? "0" : String(.24 * scale));
      }
      el.hidden = !paintedCell;
      ensureWardrobe();
      const giftPoint = wardrobePainter?.paint(paintedSelection, wardrobe.current.equipped, Boolean(wardrobe.current.pending), accessoryMotion?.accessory);
      if (accessoryMotion && wardrobePainter?.accessoryReady() && observed.visible && observed.decoded && observed.adoptedIndex === observed.requestedIndex && accessoryFront.current && !accessoryFront.current.hidden) accessoryWitnessed |= accessoryMotion.phase === "show" ? 2 : accessoryMotion.phase === "settle" ? 4 : 0;
      for (const [id, pending] of pendingSituations) {
        if (performance.now() > pending.expires || pending.actionAt !== undefined && pending.actionAt !== began) { pendingSituations.delete(id); continue; }
        if (pending.rows && !pending.rows.includes(drawingRow) || id === "gift-arrival" && (!giftPoint || !wardrobePainter?.giftReady() || giftPoint.behind || giftProp.current?.hidden) || id === "accessory-trick" && (!wardrobe.current.equipped || !wardrobePainter?.accessoryReady() || accessoryFront.current?.hidden)) continue;
        if (observed.visible && observed.decoded && observed.adoptedIndex === observed.requestedIndex && observed.adoptedSrc === observed.requestedSrc) {
          const first = recordCompanionObservedSituation({ ...observed, id, occurred: true });
          discovered = first || discovered; giftDiscovered ||= first && id === "gift-arrival";
          pendingSituations.delete(id);
        }
      }
      if (discovered || pendingCue) { const cue = giftDiscovered ? "gift" : discovered ? "discover" : pendingCue!; pendingCue = undefined; if (observed.visible) playCompanionSound(cue, preferencesRef.current); }
      if (wardrobe.current.equipped && paintedSelection) { data("accessory", wardrobe.current.equipped); data("accessoryPose", String(paintedSelection.physicalIndex)); }
      else { el.removeAttribute("data-accessory"); el.removeAttribute("data-accessory-pose"); }
      const giftHit = giftButton.current;
      if (giftHit) {
        const point = giftPoint && wardrobePainter?.giftReady() && !giftPoint.behind && paintedSelection ? projectCompanionSpritePoint({ ...projection, cell: paintedSelection.frame }, giftPoint) : null;
        if (point && display.scale > 0) {
          style(giftHit, "left", `${((point.x - display.x) / display.scale + size / 2).toFixed(3)}px`);
          style(giftHit, "top", `${((point.y - display.y + size / 2) / display.scale + size / 2).toFixed(3)}px`);
          style(giftHit, "pointer-events", pressed || keyboardHeld || placing || premiereActive || premiereBounce ? "none" : "auto");
          giftHit.hidden = false;
        } else giftHit.hidden = true;
      }
      // Depth belongs to the complete currently painted body, including its
      // held pivot and inertia. Support/target IDs cannot describe a side-on
      // drag or the middle of a jump. Reuse this frame's numbers and cached
      // bed geometry: no computed-style reads or new animation loop.
      sofaContact = undefined;
      if (front && bedScene?.anchor.isConnected && paintedRegistration && !el.hidden && !pause && !premiereActive && !premiereBounce && !isDetailGuest() && !hiding && !homeOccluded) {
        const b = bedScene, right = b.left + b.width, bottom = b.top + b.height;
        const body = projectCompanionSofaBody({ ...projection, cell: paintedRegistration });
        sofaDepth = companionSofaDepth({ point: display, body, bed: { left: b.left, right, top: b.top, bottom }, seatY: b.anchorY, previous: sofaDepth });
        sofaContact = { point: { x, y }, body, depth: sofaDepth };
        data("sofaDepth", sofaDepth);
        if (front.dataset.depth !== sofaDepth) front.dataset.depth = sofaDepth;
        // An outside creature needs no second copy of the room's own front.
        // Only the full-body interior depth owns the separate masking cloth.
        if ((sofaDepth === "seat" || sofaDepth === "back") && localBedFront?.isConnected) {
          // One front owns the cloth pixels. Presentation visibility avoids a
          // style mutation feeding the home's geometry observer back into itself.
          if (!localBedFrontHidden) { localBedFront.setAttribute("visibility", "hidden"); localBedFrontHidden = true; }
          displayOpacity *= b.opacity;
          style(front, "z-index", "76");
          style(front, "opacity", String(b.opacity));
          style(front, "transform", `translate3d(${b.left.toFixed(3)}px,${b.top.toFixed(3)}px,0)`);
          style(front, "width", `${b.width}px`); style(front, "height", `${b.height}px`);
          style(front, "clip-path", `inset(${Math.max(0, b.clip.top - b.top, -b.top)}px ${Math.max(0, right - b.clip.right, right - innerWidth)}px ${Math.max(0, bottom - b.clip.bottom, bottom - innerHeight)}px ${Math.max(0, b.clip.left - b.left, -b.left)}px)`);
          if (front.hidden) front.hidden = false;
        } else hideBed();
      } else { sofaDepth = "clear"; data("sofaDepth", "clear"); hideBed(); }
      // One owner/write restores a released/outside body to1 immediately and
      // preserves premiere/hide fades without a transient1→room-alpha commit.
      style(el, "opacity", String(displayOpacity));
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
      verticalRecoveryX = undefined;
      if (!returning) return;
      const point = displayedPoint();
      const keepSupport = supportedNow() && Math.hypot(point.x - x, point.y - y) < 2 && Math.abs(point.scale - 1) < .01;
      returning = undefined; el.removeAttribute("data-returning");
      x = clamp(point.x, size / 2 + 4, innerWidth - size / 2 - 4);
      y = clamp(point.y, size + 8, innerHeight - 12);
      pickupOffset = { x: point.x - x, y: point.y - y };
      if (!keepSupport) support = "";
      awaitingAtX = false; homeOccluded = false; clearSupportWait();
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
      const progress = action ? sofaFlightProgress(now) : 0;
      const previousPassage = sofaPassage(progress);
      const samples = geometryTracker?.follow(followedIds) ?? [];
      const seatSample = samples.find(sample => sample.platform.id === "companion-home");
      const beforeBed = bedScene && { x: bedScene.anchorX, y: bedScene.anchorY };
      const bedMoved = followBed(seatSample, now);
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
      if (pressed || keyboardHeld || placing || flight) { supportMotion.reset(now); return bedMoved; }
      const from = deltas.get(support) ?? { x: 0, y: 0 }, to = deltas.get(action?.target.platformId ?? support) ?? { x: 0, y: 0 };
      let px = 0, py = 0;
      if (action) {
        const age = now - began, p = clamp(age / Math.max(1, total), 0, 1);
        if (action.kind === "jump") { const passage = sofaPassage(progress); px = passage?.horizontal ?? (travel > 0 ? clamp((age - jumpAnticipation()) / travel, 0, 1) : travel === -2 || travel === -4 ? sampleCompanionTravel(p) : travel === -3 ? sampleCompanionTravel(clamp(p / .78, 0, 1)) : p); py = passage ? progress : travel === -1 ? p * p : px; }
        else if (playFalling) py = clamp(age / Math.min(650, total), 0, 1) ** 2;
        else if (action.kind === "walk") px = py = runUpCurve ? sampleCompanionRunUp(p) : sampleCompanionTravel(p);
        else if (action.kind === "heart" || action.kind === "hide") px = py = sampleCompanionTravel(clamp(age / Math.max(1, travel), 0, 1));
        origin.x += from.x; origin.y += from.y;
        if (runTrip && !runTrip.foodId) runTrip.x += from.x;
        if (runHop?.target.platformId === support) { runHop.target.x += from.x; runHop.target.y += from.y; }
        action.target.x += to.x; action.target.y += to.y;
        if (action.effectPoint) { action.effectPoint.x += to.x; action.effectPoint.y += to.y; }
      }
      // Lift/land carry different vertical weights from lateral passage.
      // Compare the same clock sample before/after moving its real anchors;
      // using horizontal progress for y would snap on the next world tick.
      const movedPassage = previousPassage && sofaPassage(progress);
      const validPassage = previousPassage?.safe && movedPassage?.safe;
      const dx = validPassage ? movedPassage!.x - previousPassage!.x : lerp(from.x, to.x, px);
      const dy = validPassage ? movedPassage!.y - previousPassage!.y : lerp(from.y, to.y, py);
      x += dx; y += dy; carrier.x += dx; carrier.y += dy;
      if (scroll && dy && !pendingMonth && !reduced && gfxMode() !== "off" && !isHomeSupport(support) && action?.kind !== "jump" && !playFalling) supportMotion.push(dy, now);
      if (isHomeSupport(support) || pressed || keyboardHeld || reduced || gfxMode() === "off") supportMotion.reset(now);
      return Boolean(dx || dy || bedMoved);
    };
    const continuousMotion = () => Boolean(performance.now() < interactionUntil || homeDeparture || premiereActive || premiereBounce || overlayDrag?.guest || guestKeyboardHeld || returning || heldInertia.sample(performance.now()).active || pickupScale !== 1 && performance.now() - pickupAt < 200 || pendingMonth || pressed || keyboardHeld || action && (action.accessory || action.radio || ["walk", "jump", "heart", "hide", "stretch", "shake", "eat", "play"].includes(action.kind)));
    const followLayout = (event?: Event) => {
      if (premiereActive && event?.target === window.visualViewport) { viewportResized(); return; }
      // A compact room can unmount while the creature is parked. Drop its
      // front immediately at the topology event, before the120ms rescan.
      if (bedScene && !bedScene.anchor.isConnected) {
        bedScene = undefined; hideBed();
        if (isHomeSupport(support) && !pressed && !keyboardHeld && !placing && action?.kind !== "jump" && !playFalling) {
          homeOccluded = true; data("hiddenReason", "home"); el.hidden = true; stopHover();
        }
      }
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
        // The new room can be scanned while still outside the viewport. Its
        // computed CSS slide causes no further mutation. Only this existing
        // finite follower may ask the regular safe scan to revalidate it.
        if (time < followUntil && homeOccluded && isHomeSupport(support) && offGeometry && bedScene?.anchor.isConnected
          && !overlayActive && !pressed && !keyboardHeld && !placing && !returning && !pendingMonth
          && !workspaceBusyRef.current && !afterPetLanding && !playFalling && action?.kind !== "jump"
          && (!action || isHomeSupport(action.target.platformId ?? ""))) offGeometry.revalidate();
        const mainOwnsFrame = !reduced && gfxMode() === "full" && continuousMotion();
        // A main paint consumes this flag too, so a front already committed
        // in this frame does not need a duplicate full follower paint.
        if (bedNeedsPaint || (moved || response.active) && !mainOwnsFrame) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        else if (time >= followUntil && !mainOwnsFrame) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        if (time >= followUntil && presence.phase === "parked" && homeOccluded) {
          offGeometry?.(); offGeometry = undefined; geometryReady = false; return;
        }
        if (time < followUntil || supportMotion.sample(time).active) followRaf = requestAnimationFrame(follow);
      };
      followRaf = requestAnimationFrame(follow);
    };
    const cancelTravelGoal = () => {
      viewportRecovery.revoke();
      brain.current = cancelCompanionTravelGoal(brain.current);
      if (action?.intention?.kind === "explore") action = { ...action, intention: undefined };
      if (runHop?.intention?.kind === "explore") runHop = undefined;
      for (const key of ["data-travel-goal", "data-travel-target-x", "data-travel-remaining", "data-travel-stage"]) el.removeAttribute(key);
    };
    const cancelEpisode = () => {
      cancelTravelGoal();
      const revoked = cancelCompanionEpisode(brain.current, action);
      brain.current = revoked.brain; action = revoked.action;
      // Retain the already-selected curve of the current finite walk while
      // revoking its queued hop; changing that curve mid-stride would jump.
      runTrip = runHop = undefined;
      for (const key of ["data-episode", "data-episode-phase", "data-episode-variant", "data-episode-food"]) el.removeAttribute(key);
    };
    const cancelHousehold = () => { household.cancel(); const carried = food.current?.carried(); if (carried) food.current?.releaseCarry(carried); if (action?.household) action = { ...action, household: undefined }; el.removeAttribute("data-household"); };
    const clearAction = (preserveEpisode = false, preserveHousehold = false) => { if (!preserveHousehold) cancelHousehold(); el.removeAttribute("data-food-curiosity"); clearThrow(); sofaTravelActive = false; sofaFlightShape = undefined; ballisticCoefficient = null; el.removeAttribute("data-sofa-flight"); if (!preserveEpisode) { jumpRecoveryContext = undefined; brain.current = { ...brain.current, episode: undefined }; el.removeAttribute("data-episode"); el.removeAttribute("data-episode-phase"); el.removeAttribute("data-episode-variant"); el.removeAttribute("data-episode-food"); el.removeAttribute("data-food-goal"); } else if (brain.current.episode) data("episodePhase", brain.current.episode.phase); if (homeDeparture?.flying) homeDeparture = undefined; action = null; heldShake.reset(); shakenReleasePending = undefined; shakenGroundColumn = undefined; runTrip = runHop = undefined; runUpCurve = false; el.removeAttribute("data-trip"); el.removeAttribute("data-run-up"); el.removeAttribute("data-held-dizzy"); food.current?.nibble(); heartResult = null; sleeping = false; playImpact = playFalling = panelImpact = false; el.removeAttribute("data-attention"); el.removeAttribute("data-intent"); el.removeAttribute("data-play"); el.removeAttribute("data-play-beat"); el.removeAttribute("data-heart-result"); el.removeAttribute("data-dreaming"); el.removeAttribute("data-grab-ready"); if (effect.current) { effect.current.getAnimations().forEach(animation => animation.cancel()); effect.current.textContent = ""; effect.current.removeAttribute("style"); } };
    const settle = (point: { x: number; y: number }, nearby = false, atX = false) => {
      // One lost-support episode owns one body-width escape budget. Fresh
      // scans cannot repeatedly move this origin to ratchet across columns.
      if (atX) verticalRecoveryX ??= point.x;
      else verticalRecoveryX = undefined;
      // Explicit placement/cancellation owns the next descent. An old ballistic
      // sidecar must never override this newly chosen vertical landing.
      clearThrow();
      sofaTravelActive = false; sofaFlightShape = undefined; ballisticCoefficient = null; el.removeAttribute("data-sofa-flight");
      // User releases hit the first real card top on this vertical ray. The
      // separate text ledges remain the only autonomous destinations.
      const bed = bedScene?.anchor.isConnected ? bedScene : undefined;
      const contact = sofaContact && Math.hypot(sofaContact.point.x - point.x, sofaContact.point.y - point.y) <= 1 ? sofaContact : undefined;
      const sofa = !nearby && !atX && bed ? companionSofaRelease(point, { left: bed.left, right: bed.left + bed.width, top: bed.top, bottom: bed.top + bed.height }, supportById("companion-home"), landingPlatforms, size, contact) : null;
      const contactPlatform = sofa ? supportById(sofa.platformId) : atX ? recoverCompanionVerticalSupport(point, platforms, landingPlatforms) : nearby ? nearestPlatform(point, platforms)
        : firstCompanionSupportBelow(point, landingPlatforms) ?? companionViewportFloorAbove(point, landingPlatforms);
      const recovery = !contactPlatform && !sofa ? atX
        ? recoverCompanionPassiveFloor(point, landingPlatforms, size, verticalRecoveryX)
        : !nearby ? recoverCompanionDropAtViewportFloor(point, landingPlatforms) : undefined : undefined;
      const p = contactPlatform ?? recovery?.platform;
      // If even real viewport-floor recovery is unavailable, retain the drop
      // until safe geometry returns. Passive recovery keeps its own bounded escape;
      // late decoding or initial seeding must not revive it on another date.
      awaitingAtX = p ? false : !nearby && !atX ? "drop" : "vertical"; verticalLanding = atX || !nearby;
      if (!p) { support = ""; data("platform", ""); clearAction(Boolean(jumpRecoveryContext)); stopHover(); hideBed(); el.hidden = true; return; }
      clearSupportWait();
      supportMotion.reset();
      const target = { x: sofa?.x ?? recovery?.x ?? (atX || !nearby ? point.x : platformLandingX(p, point.x)), y: p.y, platformId: p.id };
      const raisedFloor = !sofa && !nearby && !atX && p.y < point.y - .5;
      origin = { x, y }; action = { kind: "jump", target, duration: sofa ? 400 : 650 }; began = performance.now(); total = action.duration; travel = sofa ? -4 : nearby || raisedFloor || atX && target.y < point.y ? -3 : -1;
      if (jumpRecoveryContext) { action = { ...action, ...jumpRecoveryContext }; jumpRecoveryContext = undefined; }
      if (reduced) { x = target.x; y = target.y; support = target.platformId ?? ""; verticalRecoveryX = undefined; clearAction(); }
      brain.current = recordCompanionEvent(brain.current, "landed");
    };
    const recoverJumpGeometry = (now: number) => {
      const interrupted = action;
      // x/y already include this geometry delivery's real anchor carry. They
      // are the recovery origin: never substitute a newly bounded parabola.
      clearAction(true);
      jumpRecoveryContext = interrupted && (interrupted.foodId || interrupted.intention || interrupted.episode) ? {
        ...(interrupted.foodId ? { foodId: interrupted.foodId } : {}),
        ...(interrupted.intention ? { intention: { ...interrupted.intention } } : {}),
        ...(interrupted.episode ? { episode: { ...interrupted.episode } } : {}) } : undefined;
      settle({ x, y });
      nextDecision = now + 300;
    };
    const waitForSupport = () => {
      waitingForSupport = true;
      cancelAnimationFrame(raf); clearTimeout(timer); inputPaintQueued = false;
      hideBed(); stopHover(); data("hiddenReason", awaitingAtX || "support"); el.hidden = true;
      // One final validation catches a transient reflow. Afterwards the same
      // passive observer waits for actual DOM/scroll/font events: no brain,
      // rAF, timer or repeated geometry request runs while support is missing.
      if (!supportValidationRequested && offGeometry) {
        supportValidationRequested = true;
        const observer = offGeometry;
        supportValidationTimer = setTimeout(() => {
          supportValidationTimer = undefined;
          if (!stopped && !pause && waitingForSupport && observer === offGeometry && !overlayActive && !hiding && !premiereActive) observer.revalidate(true);
        }, FLIP_MS);
      }
    };
    const beginThrow = (velocity: CompanionThrowVelocity, now: number) => {
      if (reduced || gfxMode() === "off" || overlayActive || premiereActive || Math.hypot(velocity.vx, velocity.vy) < COMPANION_THROW_LIMITS.minSpeed) return false;
      const next = createCompanionThrow({ x, y }, velocity, throwBounds());
      if (!next) return false;
      verticalRecoveryX = undefined; clearAction(); stopHover(); supportMotion.reset(now);
      clearSupportWait();
      flight = next; flightAt = now; origin = { x, y }; support = ""; data("platform", "");
      action = { kind: "jump", target: { x, y }, duration: COMPANION_THROW_LIMITS.maxFlightMs };
      began = now; total = action.duration; travel = -5; verticalLanding = false; awaitingAtX = false;
      data("throwPhase", "launch"); data("throwVx", next.vx.toFixed(3)); data("throwVy", next.vy.toFixed(3));
      spriteSources[COMPANION_THROW_ROW].forEach(src => requestSprite.current(src));
      return true;
    };
    const finishParkedDrop = () => {
      if (!overlayActive || presence.phase !== "parked" || pause || premiereActive || premiereBounce || homeDeparture || hiding || isDetailGuest()
        || action || returning || awaitingAtX || pressed || keyboardHeld || placing || overlayDrag || overlayPlacing) return false;
      // A sleeper's explicit world drop never wakes its autonomous presence.
      // Commit its terminal sleep before the parked scheduler stops; reduced
      // motion can reach this same endpoint synchronously inside settle().
      cancelAnimationFrame(raf); clearTimeout(timer); inputPaintQueued = false;
      resetInertia(); el.dataset.dreaming = "";
      offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true);
      paint(11, 0, "sleep");
      return true;
    };
    const supportedNow = () => { const p = supportById(support); return Boolean(p && Math.abs(y - p.y) <= 2 && x >= p.x && x <= p.x + p.width); };
    const accessorySpace = (id: CompanionAccessoryId) => {
      const occupied = supportById(support);
      const headroom = Math.min(y, ...platforms.filter(p => p.id !== support && p.y < y - 2 && x + size / 2 > p.x && x - size / 2 < p.x + p.width).map(p => y - p.y));
      return canStartCompanionAccessoryMotion({ id, roam: effective.roam, stable: supportedNow(), safe: Boolean(occupied && !occupied.manualOnly && !isHomeSupport(support) && !["hide", "control"].includes(occupied.kind ?? "")), headroom, edgeClearance: occupied ? Math.min(x - occupied.x, occupied.x + occupied.width - x) : 0, energy: brain.current.energy });
    };
    const musicAllowed = () => instrumentAudible && preferences.enabled && radioPreferences.react && effective.roam && document.hasFocus() && !document.hidden && !pause && !overlayActive && !overlayRef.current && !workspaceBusyRef.current && !blocked && !reduced && !["off", "soft"].includes(gfxMode()) && !premiereActive && !premiereBounce && !(premiereRef.current.cue?.generation && premiereRef.current.cue.phase !== "idle") && presence.phase === "active";
    const radioAllowed = () => musicAllowed() && radioPreferences.enabled && radioPreferences.volume > 0;
    const radioSpace = (foodCount: number, instrument = false) => {
      const occupied = supportById(support);
      const headroom = Math.min(y, ...platforms.filter(p => p.id !== support && p.y < y - 2 && x + size / 2 > p.x && x - size / 2 < p.x + p.width).map(p => y - p.y));
      const mealPriority = companionRadioFoodPriority({ feeding: effective.feeding, hunger: brain.current.hunger, availableFoods: foodCount });
      const busy = Boolean(action && !action.radio || pressed || keyboardHeld || placing || overlayDrag || overlayPlacing || hoverPetting || performance.now() < petUntil || homeJourney || pendingHomeRecall || returning || pendingMonth || waitingForSupport || afterPetLanding || restAfterLanding || mealPriority || brain.current.hunger >= .75 || brain.current.foodGoal || brain.current.intention || brain.current.episode);
      return (instrument ? musicAllowed() : radioAllowed()) && paintedTexture?.complete && paintedTexture.naturalWidth > 0 && canStartCompanionRadioReaction({ enabled: preferences.enabled, react: radioPreferences.react, roam: effective.roam, focused: document.hasFocus(), hidden: document.hidden, reduced, graphics: gfxMode(), stable: supportedNow(), safe: Boolean(occupied && (!occupied.manualOnly || support === "companion-home") && !["hide", "control"].includes(occupied.kind ?? "")), busy, headroom, edgeClearance: occupied ? Math.min(x - occupied.x, occupied.x + occupied.width - x) : 0, energy: brain.current.energy });
    };
    const releaseHold = () => { resetInertia(); const held = pressed; pressed = null; keyboardHeld = false; if (held && button.hasPointerCapture(held.id)) button.releasePointerCapture(held.id); };
    const startRest = () => {
      const cozy = isHomeSupport(support) && !reduced && gfxMode() !== "off";
      action = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000, ...(cozy ? { living: "cozy" as const } : {}) }; began = performance.now(); total = 12000;
      if (cozy) { data("living", "cozy"); spriteSources[35].forEach(src => requestSprite.current(src)); }
      pendingCue = "sleep";
    };
    const wakeGuest = () => {
      if (!isDetailGuest()) return;
      inputPaintQueued = false; hideClock(performance.now()); cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); schedule();
    };
    const affection = () => {
      el.removeAttribute("data-home-wait-pose");
      // A passing hover may offer a short reaction, not erase an accepted
      // recall. A pickup or another explicit destination still cancels it.
      if (homeJourney !== "called") cancelHomeJourney();
      if (!preferences.petting) return;
      const guest = isDetailGuest(), invited = performance.now() < invitedUntil;
      petStarted = performance.now();
      if (!guest) { pendingMonth = false; awaitingAtX = false; afterPetLanding = !supportedNow(); restAfterLanding = false; clearAction(); }
      petUntil = performance.now() + (reduced ? 650 : COMPANION_TIMING.petReward);
      brain.current = recordCompanionEvent(brain.current, "petted");
      if (invited) brain.current = { ...brain.current, affection: Math.min(1, brain.current.affection + .12) };
      experience(invited ? "reassured" : "petted"); persistCare(true); invitedUntil = 0;
      // One acknowledged gesture/reward, never a pose or pointer sample.
      logActivity("ui.click", { target: "companion-pet" });
      data("mood", "happy");
      // One deliberate reward, never pointermove audio. Both feedback buses
      // retain the app's master/category/volume/hidden-tab preferences.
      queueSituation("petting-comfort", [9]); hapticSuccess(); pendingCue = "pet";
      publishCare(); setAnnouncement("빅타민이 쓰다듬기를 좋아해요. 조금 더 친해졌어요.");
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
      handPresentation = undefined; interactionUntil = 0;
      hoverTarget?.removeAttribute("data-vc-petting-cursor"); hoverTarget = null;
      el.removeAttribute("data-petting"); style(contactLayer, "transform", "translate3d(0,0,0) rotate(0deg) scale(1,1)");
    };
    const inputPaint = (row: number, frame: number, status: string) => {
      el.removeAttribute("data-home-wait-pose");
      const quietInput = reduced || gfxMode() === "off" || gfxMode() === "soft" || overlayActive && !isDetailGuest();
      if (quietInput) {
        paint(row, frame, status);
        // Ordinary idle already has a clock; a blocked recall deliberately
        // does not. Give only this acknowledged contact its finite tail.
        if (!homeWaitingGeometry || overlayActive || presence.phase !== "active") return;
      }
      // Keep every gesture/inertia sample, but commit contact/hand/body once
      // on the existing display clock. A short input tail promotes idle14Hz
      // to the normal full60/lite30 cadence; it never starts a second loop.
      const now = performance.now();
      interactionUntil = now + 120;
      if (isDetailGuest()) guestUntil = Math.max(guestUntil, interactionUntil);
      if (inputPaintQueued) return;
      inputPaintQueued = true;
      hideClock(performance.now());
      cancelAnimationFrame(raf); clearTimeout(timer); schedule();
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
      handPresentation = `translate3d(${((event.clientX - bodyFrame.x) / bodyFrame.scale + size / 2 - 12).toFixed(2)}px,${((event.clientY - bodyFrame.y) / bodyFrame.scale + size - 21).toFixed(2)}px,0) rotate(${reduced ? 0 : -18 + (normalized - .5) * 12}deg)`;
      if (isDetailGuest() && (moving || touch.sample(now).pressure > 0)) guestUntil = now + 600;
      if (!result.stroking) { inputPaint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return; }
      if (!hoverPetting) {
        hoverStarted = petStarted = now;
        if (!isDetailGuest()) { afterPetLanding = !supportedNow(); restAfterLanding = false; clearAction(); }
      }
      if (result.reward) affection();
      hoverPetting = true; petUntil = now + 650; if (!isDetailGuest()) nextDecision = petUntil + 500;
      data("petting", "hover");
      inputPaint(9, reduced ? 0 : ((now - hoverStarted) % COMPANION_TIMING.petLoop) / COMPANION_TIMING.petLoop * 15, "petted");
    };
    const leave = (event: PointerEvent) => {
      // pointerleave precedes the next document move. Yield to its real
      // destination before a reversal can award affection over another control.
      if (!event.relatedTarget || isOtherControl(event.relatedTarget)) stopHover();
      else hover(event, event.relatedTarget);
    };
    const outsideDocument = (event: PointerEvent) => { if (!event.relatedTarget) { stopHover(); pointer = pointerAnchor = undefined; } };
    const openHomeRecallTarget = () => {
      const candidate = document.querySelector<HTMLElement>(".vc-home-cushion"), room = candidate?.closest<HTMLElement>(".vc-home");
      if (!candidate?.isConnected || !room || room.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]") || !candidate.getClientRects().length || getComputedStyle(candidate).visibility !== "visible") return undefined;
      return candidate;
    };
    const recallHome = (allowRevalidation = true) => {
      radioInbox.clear();
      instrumentInbox.clear();
      pendingHomeRecall = undefined;
      if (hiding || pause || overlayActive || premiereActive) return;
      // Parked sleep disposes its subscription. Reconnect before using cached
      // supports or requesting validation so later layout/folds remain live.
      connectGeometry();
      pendingMonth = false;
      const home = platforms.find(p => p.id === "companion-home");
      const candidate = openHomeRecallTarget();
      if (!home) {
        // A newly mounted compact room precedes the existing coalesced scan.
        // Retain this one explicit click until that scan, never poll or replay
        // it into a closed/replaced room or over a newer user interaction.
        if (allowRevalidation && candidate && geometryTracker) { logActivity("ui.click", { target: "companion-home-call" }); pendingHomeRecall = candidate; geometryTracker.revalidate(true); return; }
        if (!candidate) { setAnnouncement("쿠션이 보이도록 집을 펼쳐 주세요."); return; }
      }
      if (allowRevalidation) logActivity("ui.click", { target: "companion-home-call" });
      interruptReturn();
      stopHover(); awaitingAtX = false; verticalLanding = false;
      const waking = sleeping;
      cancelHomeJourney();
      clearAction(); releaseHold(); petUntil = 0; afterPetLanding = restAfterLanding = false;
      brain.current = { ...brain.current, intention: undefined, foodGoal: undefined };
      const now = performance.now(); homeJourney = "called"; homeWakeUntil = now + (waking ? 500 : 0); nextDecision = now;
      // A direct recall wakes a parked creature and owns this finite journey,
      // including a visible blur. Ordinary windows still finish only its leg.
      presence.focus(true, now, true); data("presence", presence.phase);
      data("homeJourney", "");
      if (!home) { homeWaitingGeometry = homeValidationRequested = true; el.dataset.homeWaiting = ""; }
      else if (reduced) { x = platformLandingX(home, home.x + home.width / 2); y = home.y; support = home.id; cancelHomeJourney(); if (!document.hasFocus()) presence.focus(false, now); if (preferences.sleep && document.hasFocus()) startRest(); else nextDecision = now + 1200; }
      else if (!supportedNow()) settle({ x, y });
      cancelAnimationFrame(raf); clearTimeout(timer); schedule();
      setAnnouncement("빅타민이 포근한 자리로 돌아가요.");
    };
    control.current = {
      place: () => { if (!hiding && !isDetailGuest() && preferences.drag) {
        radioInbox.clear();
        instrumentInbox.clear();
        cancelHomeJourney();
        if (overlayActive) { overlayPlacing = true; el.dataset.placing = ""; setAnnouncement("빅타민을 놓을 곳을 한 번 눌러 주세요."); return; }
        interruptReturn(); stopHover(); awaitingAtX = false; pendingMonth = false; clearAction(); releaseHold(); petUntil = 0; afterPetLanding = false; restAfterLanding = false; placing = true; el.dataset.placing = "";
      } },
      rest: () => { if (!hiding && preferences.sleep) { radioInbox.clear(); instrumentInbox.clear(); cancelHomeJourney(); interruptReturn(); pendingMonth = false; clearAction(); releaseHold(); afterPetLanding = false; restAfterLanding = false; petUntil = 0;
        if (!supportedNow()) { settle({ x, y }); if (reduced) startRest(); else restAfterLanding = true; }
        else startRest();
      } },
      home: () => { if (hiding || pause || overlayActive || premiereActive || !document.hasFocus()) return; playCompanionSound("cushion", preferencesRef.current); recallHome(); },
      radio: () => { if (!pause && !overlayActive && !premiereActive && !workspaceBusyRef.current && document.hasFocus() && !document.hidden) { logActivity("ui.click", { target: getCompanionRadioToggleIntent() === "stop" ? "companion-radio-stop" : "companion-radio-play" }); void toggleCompanionRadio(); } },
      feed: () => {
        radioInbox.clear();
        instrumentInbox.clear();
        pendingHomeRecall = undefined;
        if (action?.accessory || action?.radio) { clearAction(); nextDecision = performance.now(); }
        const kind = randomCompanionFood(lastFood.current); lastFood.current = kind;
        const slot = document.querySelector<HTMLElement>(".vc-dispenser-slot");
        const outlet = slot?.getBoundingClientRect();
        // Spill into the open tray left of the outlet. A selected snack must
        // never cover the button needed to dispense the next one.
        food.current?.spawn(kind, outlet ? { x: outlet.left - 40, y: outlet.bottom + 4 } : { x: x + size * .7, y }, slot ?? undefined);
        if (food.current) playCompanionSound("feed", preferencesRef.current);
      },
      clearFood: () => { pendingHomeRecall = undefined; food.current?.clear(); },
    };
    let preparedPlayRow = -1, preparedNextPlayRow = -1;
    const homeRouteWorld = () => {
      const occupied = supportById(support), roomFloors = landingPlatforms.filter(p => isHomeFloor(p.id));
      return { x, y, platformId: support, platforms: [...platforms, ...roomFloors, ...(occupied && !platforms.some(p => p.id === support) ? [occupied] : [])], width: innerWidth, height: innerHeight };
    };
    const planHomeFloorEntry = () => {
      const home = supportById("companion-home");
      if (!home) return;
      const centre = platformLandingX(home, home.x + home.width / 2), world = homeRouteWorld();
      const floors = world.platforms.filter(p => isHomeFloor(p.id) && Math.abs(platformLandingX(p, centre) - centre) < 1)
        .sort((a, b) => Math.hypot(centre - x, a.y - y) - Math.hypot(centre - x, b.y - y)).slice(0, 2);
      for (const floor of floors) {
        const vertical = sampleSofaRoute({ kind: "jump", target: { x: centre, y: home.y, platformId: home.id }, duration: 950 }, { x: centre, y: floor.y }, .5, floor.id);
        if (!vertical?.safe) continue;
        const plan = planCompanionHomeReturn(brain.current, world, { ...effective, jump: !reduced }, { id: floor.id, x: centre });
        if (plan.state === "travel") return { id: floor.id, action: plan.action };
      }
    };
    const launch = (next: RuntimeAction, now: number) => {
      curiosityTossed = false;
      if (next.household?.kind === "tidy") ensureWardrobe(true);
      accessoryWitnessed = 0; accessoryLanded = false;
      verticalRecoveryX = undefined;
      let passage = sampleSofaRoute(next, { x, y }, .5);
      let sofaTransfer = next.kind === "jump" && (support === "companion-home" || next.target.platformId === "companion-home");
      if (sofaTransfer && next.household && support === "companion-home" && (!passage || !passage.safe)) {
        // Leave through the measured cushion opening, then retain the errand
        // for its safe room-floor walk. A direct diagonal exit can cut the rim.
        const detour = planHomeFloorEntry();
        if (detour) {
          const candidate: RuntimeAction = { ...detour.action, household: { ...next.household, effect: undefined, point: undefined } };
          const alternate = sampleSofaRoute(candidate, { x, y }, .5);
          if (candidate.kind === "walk" || alternate?.safe) {
            next = candidate; passage = alternate;
            sofaTransfer = next.kind === "jump" && (support === "companion-home" || next.target.platformId === "companion-home");
          }
        }
      }
      if (sofaTransfer && (!passage || !passage.safe)) {
        if (homeJourney) {
          // A cramped direct seat edge need not strand a valid command. Reach
          // a real floor beneath its opening, then replan the contained lift.
          // Same planner/species speed and actual support identities are used.
          const detour = planHomeFloorEntry();
          if (detour) { homeEntryFloor = detour.id; next = detour.action; passage = sampleSofaRoute(next, { x, y }, .5); }
          if (!detour || passage && !passage.safe) { clearAction(true); waitForHomeGeometry(); return; }
        } else {
          // Keep an offered meal identity/finite budget through a blocked
          // transfer; explore failures instead gain the existing active-time
          // retry memory. Never paint an unsafe normal-arc fallback.
          const goal = next.intention;
          next = { kind: "look", target: { x, y, platformId: support }, duration: next.foodId ? 4000 : 480,
            ...(next.foodId ? { foodId: next.foodId } : {}), ...(next.foodId && goal ? { intention: { ...goal, stage: "consider" as const } } : {}),
            ...(next.episode ? { episode: { ...next.episode } } : {}),
            attention: { kind: "reconsider", ...(goal ? { goal: { ...goal } } : { point: { ...next.target } }) },
            outcomes: [...(next.outcomes ?? []).slice(0, 2), { targetId: goal?.targetId ?? next.target.platformId ?? "", result: "blocked" }] };
          passage = undefined;
        }
      }
      const playful = !homeJourney && !overlayActive && !workspaceBusyRef.current && !premiereActive && presence.phase === "active" && !reduced && gfxMode() !== "off";
      const romp = playful && !next.episode && !next.household ? planCompanionRomp({ action: next, from: { x, y }, platform: supportById(support), foods: food.current?.foods() ?? [], energy: brain.current.energy, cooldownReady: (brain.current.cooldowns.mishap ?? -Infinity) <= now }, preferences) : undefined;
      // A verified run-up shortens only this leg. Preserve the ultimate goal
      // and commit its actual duration/budget after selecting the takeoff.
      next = romp?.walk ?? next;
      clearAction(false, Boolean(next.household)); householdEffectApplied = false; if (next.household) data("household", next.household.kind); action = next; origin = { x, y }; began = now; total = next.duration; travel = 0;
      if (next.living === "social") invitedUntil = now + total + 7000;
      if (next.foodCuriosity) data("foodCuriosity", next.foodCuriosity); else el.removeAttribute("data-food-curiosity");
      pocketCapture = undefined; pocketDrawn = pocketStashed = pocketEjected = false;
      if (next.accessory === "magic-pocket" && effective.rarePrank) {
        const candidate = food.current?.foods().filter(item => Math.abs(item.y - y) < 75 && Math.abs(item.x - x) < 140).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (candidate) pocketCapture = { id: candidate.id, kind: candidate.kind };
      }
      mealAnchored = false; mealWaited = 0;
      if (next.kind === "eat") for (const row of [1, 9]) spriteSources[row].forEach(src => requestSprite.current(src));
      sofaTravelActive = Boolean(passage?.safe); sofaFlightShape = passage?.safe ? { coefficient: passage.coefficient, curve: passage.curve } : undefined; if (sofaTravelActive) data("sofaFlight", "");
      preparedPlayRow = preparedNextPlayRow = -1;
      if (next.foodId) data("foodGoal", next.foodId);
      if (next.living) data("living", next.living); else el.removeAttribute("data-living");
      if (next.kind === "sleep" && next.living === "cozy") spriteSources[next.cozySettled ? 40 : 35].forEach(src => requestSprite.current(src));
      if (next.episode) { data("episode", next.episode.kind); data("episodePhase", next.episode.phase); data("episodeVariant", next.episode.variant); if (next.episode.foodId) data("episodeFood", next.episode.foodId); }
      if (next.episode?.reunion && next.episode.phase === "notice") { petUntil = now + 950; pendingCue = "play"; }
      if (next.attention) spriteSources[next.attention.kind === "reconsider" ? 26 : 1].forEach(src => requestSprite.current(src));
      if (next.kind === "play" && next.play) {
        // Decode just the contact and expression packets ahead of their beat.
        // Keep the existing bounded cache; never warm the entire pose library.
        const beats = COMPANION_PLAY_TIMING[next.play].beats;
        for (const row of new Set(beats.slice(0, 2).map(beat => beat.row))) spriteSources[row].forEach(src => requestSprite.current(src));
        preparedPlayRow = beats[0].row;
        preparedNextPlayRow = companionNextPlayRow(next.play, 0, reduced || gfxMode() === "off");
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
      if (next.kind === "heart") {
        const speed = preferences.speed === "relaxed" ? 45 : preferences.speed === "lively" ? 100 : 70;
        travel = Math.abs(next.target.x - x) / speed * 1000;
        total += travel;
      }
      if (next.kind === "jump") {
        const g = 1100, impulse = Math.sqrt(2 * g * (next.jumpHeight ?? 140)), dy = next.target.y - y;
        travel = (impulse + Math.sqrt(Math.max(0, impulse * impulse + 2 * g * dy))) / g * 1000;
        if (sofaFlightShape) travel = Math.max(travel, companionSofaFlightMs(origin, next.target, sofaFlightShape));
        total = jumpAnticipation() + travel + COMPANION_TIMING.jumpLanding;
        // One launch owns this lift. More headroom after scrolling must not
        // increase it; less headroom is a finite recovery, never a new curve.
        if (!sofaTravelActive) ballisticCoefficient = boundCompanionBallisticArc(y, next.target.y, .5 * g * (travel / 1000) ** 2, size + 8).coefficient;
      }
      // Account for the actual finite flight, not the proposal's placeholder.
      brain.current = commitAction(brain.current, next.kind === "jump" ? { ...(action ?? next), duration: total } : action ?? next, now);
      if (playful && !next.household) {
        runTrip = next.episode ? companionEpisodeRunTrip(next, { x, y }, supportById(support), food.current?.foods() ?? [], brain.current, now, preferences) : romp?.trip; runHop = next.episode ? companionEpisodeRunHop(next, { x, y }, supportById(support), food.current?.foods() ?? [], brain.current, preferences) : romp?.hop;
        runUpCurve = Boolean(runHop);
        if (runTrip) for (const row of new Set([sampleCompanionPlay(runTrip.play, 0).row, sampleCompanionPlay(runTrip.play, .5).row])) spriteSources[row].forEach(src => requestSprite.current(src));
        if (runHop) for (const row of [4, 5]) spriteSources[row].forEach(src => requestSprite.current(src));
      }
      if (next.runUp) data("runUp", "positive");
      if (next.kind === "play" && next.play) pendingCue = next.play === "dizzy" ? "dizzy" : ["tumble", "slip-tumble", "bump", "slip"].includes(next.play) ? "tumble" : "play";
      else if (next.kind === "sleep") pendingCue = "sleep";
    };
    const waitForHomeGeometry = () => {
      if (!homeJourney) return;
      const response = companionHomeBlockedResponse(homeJourney, homeValidationRequested || !geometryTracker);
      if (response === "resume") {
        // An unsolicited rescue is not a user command. A disconnected room
        // must not park the awake renderer forever on its last expression.
        cancelHomeJourney(); homeRetryAt = brain.current.activeMs + 30000;
        nextDecision = performance.now() + 220;
        return;
      }
      homeWaitingGeometry = true;
      el.dataset.homeWaiting = "";
      // One explicit completion, then real geometry events own further tries.
      // A blocked command never falls back to random wandering or autonomous
      // sleep. Real blur can still finish its normal quiet-presence handoff.
      if (response === "revalidate" && geometryTracker) { homeValidationRequested = true; geometryTracker.revalidate(true); }
    };
    const advanceHomeJourney = (now: number) => {
      if (!homeJourney || homeWaitingGeometry || action || overlayActive || workspaceBusyRef.current || pause) return;
      const world = homeRouteWorld(), home = supportById("companion-home");
      const viaFloor = homeEntryFloor && home ? { id: homeEntryFloor, x: platformLandingX(home, home.x + home.width / 2) } : undefined;
      let plan = planCompanionHomeReturn(brain.current, world, { ...effective, jump: !reduced }, viaFloor);
      if (viaFloor && plan.state !== "travel") {
        homeEntryFloor = undefined;
        plan = planCompanionHomeReturn(brain.current, world, { ...effective, jump: !reduced });
      }
      if (plan.state === "travel") {
        // One short glance belongs to the mascot's return, never an unbounded
        // random diversion. Dogs run and cats walk in the shared route planner.
        if (homeJourney === "called" && preferences.animalMode === "default" && !homeLookUsed && homeLegs > 0 && !reduced && gfxMode() !== "off") {
          homeLookUsed = true; launch({ kind: "look", target: { x, y, platformId: support }, duration: 320 }, now);
        } else launch(plan.action, now);
        // A geometrically rejected seat transfer did not start a leg. Keep
        // its single validation lease so called/automatic waits cannot poll.
        if (action) homeValidationRequested = false;
      } else if (plan.state === "arrived") {
        cancelHomeJourney();
        if (!document.hasFocus()) presence.focus(false, now);
        // Visible blur hands the completed command back to the ordinary
        // rest/yawn/CSS sleep path instead of starting another12s JS action.
        if (preferences.sleep && document.hasFocus()) startRest();
        else nextDecision = now + 1200;
        setAnnouncement("빅타민이 포근한 자리에 도착했어요.");
      } else if (!openHomeRecallTarget()) {
        cancelHomeJourney(); homeRetryAt = brain.current.activeMs + 30000;
        setAnnouncement("쿠션이 보이도록 집을 펼쳐 주세요.");
      } else waitForHomeGeometry();
    };
    const tick = (now: number) => {
      inputPaintQueued = false;
      if (stopped || pause) return;
      if (premiereActive) { tickPremiere(now); return; }
      if (pendingPosition.current) { lastTick = lastNeeds = lastCare = now; return; }
      if (flight && (reduced || gfxMode() === "off")) { clearAction(); settle({ x, y }); }
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
        const destinations = platforms.filter(p => !isHomeSupport(p.id) && !p.manualOnly)
          .sort((a, b) => Number(a.kind === "floor") - Number(b.kind === "floor") || Math.hypot(platformLandingX(a, x) - x, a.y - y) - Math.hypot(platformLandingX(b, x) - x, b.y - y));
        const departure = destinations.slice(0, 12).map(target => {
          const next: CompanionAction = { kind: "jump", target: { x: platformLandingX(target, x), y: target.y, platformId: target.id }, duration: 850 };
          return { next, passage: sampleSofaRoute(next, { x, y }, .5) };
        }).find(candidate => reduced || gfxMode() === "off" || support !== "companion-home" || candidate.passage?.safe);
        if (departure) {
          homeDeparture.flying = true;
          origin = { x, y }; action = departure.next; began = now; total = departure.passage?.safe ? companionSofaFlightMs(origin, action.target, departure.passage) + COMPANION_TIMING.jumpLanding : 850; travel = -2;
          sofaTravelActive = Boolean(departure.passage?.safe); sofaFlightShape = departure.passage?.safe ? { coefficient: departure.passage.coefficient, curve: departure.passage.curve } : undefined; if (sofaTravelActive) data("sofaFlight", "");
          if (reduced || gfxMode() === "off") { x = action.target.x; y = action.target.y; support = action.target.platformId ?? support; clearAction(); }
          nextDecision = now + 1100;
        } else { homeDeparture = undefined; clearAction(true); settle({ x, y }); }
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
      if (!returning && presence.phase === "active" && now - lastNeeds >= 250) {
        const elapsed = now - lastNeeds;
        brain.current = advanceBrain(brain.current, elapsed, preferences.learnFromYou);
        const giftArrived = advanceCompanionCollection(elapsed, brain.current.affection, !action && !pressed && !keyboardHeld && !placing && !homeJourney && !overlayActive && !workspaceBusyRef.current && !brain.current.foodGoal && !brain.current.intention && !(brain.current.episode && brain.current.episode.remaining > 0 && brain.current.episode.phase !== "finish") && supportedNow());
        if (giftArrived) launch({ kind: "play", play: "bow", target: { x, y, platformId: support }, duration: companionPlayDuration("bow") }, now);
        if (now - lastMemorySave >= 5000) persistCare(); lastNeeds = now;
      }
      if (now - lastCare >= 1000) { publishCare(); lastCare = now; }
      const phase = presence.step(now, Boolean(homeJourney === "called" && !homeWaitingGeometry && !overlayActive || returning || action || pressed || keyboardHeld || placing || now < petUntil || afterPetLanding || pendingMonth && !overlayActive));
      data("presence", phase);
      if (returning) {
        const sample = returning.sample(now, { x, y, scale: 1 }, geometryReady && returnTargetValid, reduced || gfxMode() === "off");
        data("returning", sample.phase);
        el.removeAttribute("data-dreaming");
        if (!sample.done) {
          paint(sample.phase === "wake" ? 12 : sample.phase === "settle" ? 6 : 0, sample.phase === "wake" ? clamp(presence.elapsed(now) / COMPANION_TIMING.presenceWake, 0, 1) * 15 : sample.phase === "settle" ? 15 : 0, sample.phase === "wake" ? "wake" : sample.phase === "settle" ? "land" : "return");
          schedule(); return;
        }
        if (sample.expired) awaitingAtX = "vertical";
        else verticalRecoveryX = undefined;
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
      if (!overlayActive && !flight && (awaitingAtX || !platforms.length && !supportById(support) && !(action?.target.platformId && supportById(action.target.platformId)) && !pressed && !keyboardHeld)) { waitForSupport(); return; }
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
      // Count only the brain's active time. Tab absence/modal sleep neither
      // advances this recovery delay nor creates another background timer.
      const perch = supportById(support);
      const lowPerch = perch && !isHomeSupport(support) && (perch.kind === "floor" || perch.kind === "control" && y >= innerHeight - 200);
      if (!action && !homeJourney && !overlayActive && presence.phase === "active" && effective.roam && effective.jump && preferences.sleep && brain.current.activeMs >= homeRetryAt && lowPerch) {
        strandedSince ||= brain.current.activeMs;
        // Repeated same-floor hops are not upward progress. A visible date
        // nearby must not suppress recovery forever while utility ignores it.
        if (brain.current.activeMs - strandedSince >= 8000) {
          homeJourney = "automatic"; data("homeJourney", ""); nextDecision = now;
        }
      } else if (!homeJourney && !lowPerch) strandedSince = 0;
      if (homeJourney && !overlayActive && (presence.phase === "active" || homeJourney === "called" && presence.phase === "finishing") && !workspaceBusyRef.current) {
        if (!action && now < homeWakeUntil) { paint(12, (1 - (homeWakeUntil - now) / 500) * 15, "wake"); schedule(); return; }
        if (!action && now >= nextDecision) advanceHomeJourney(now);
      }
      if ((household.active() || food.current?.carried()) && (workspaceBusyRef.current || overlayActive || premiereActive || pendingMonth || returning || presence.phase !== "active" || reduced || gfxMode() === "off")) cancelHousehold();
      const foodGoalId = brain.current.foodGoal?.foodId;
      const liveFoods = food.current?.foods() ?? [];
      const seenFood = liveFoods.find(item => item.id === (action?.foodId ?? foodGoalId));
      if (seenFood) lastFoodPoint = { id: seenFood.id, x: seenFood.x, y: seenFood.y };
      const lostGoalId = food.current && [foodGoalId, action?.foodId].find(id => id && !food.current!.contains(id));
      if (lostGoalId) brain.current = recordCompanionEvent(brain.current, "food-lost");
      const interruptedFood = action?.foodId && !liveFoods.some(item => item.id === action!.foodId);
      if (interruptedFood && action && !["walk", "jump", "play"].includes(action.kind)) {
        // A folded/clipped/held snack still exists. Suspend its visual action
        // without treating a temporary unavailable support as a deleted meal.
        clearAction(Boolean(!lostGoalId && brain.current.episode?.kind === "meal")); if (!supportedNow() && !(homeOccluded && isHomeSupport(support))) settle({ x, y }); nextDecision = now + 300;
      }
      // A genuinely removed meal earns one finite recheck at the last seen
      // point. A held/occluded snack merely suspends, and midair feet finish
      // their safe landing instead of freezing to perform an expression.
      if (lostGoalId && !action && supportedNow() && !workspaceBusyRef.current && presence.phase === "active" && !reduced && gfxMode() !== "off") {
        launch({ kind: "look", target: { x, y, platformId: support }, duration: 480, attention: { kind: "reconsider", ...(lastFoodPoint?.id === lostGoalId ? { point: { x: lastFoodPoint.x, y: lastFoodPoint.y } } : {}) } }, now);
      }
      if (!action && !homeJourney && !workspaceBusyRef.current && presence.phase === "active" && geometryReady && now >= nextDecision && (!isHomeSupport(support) || supportById(support))) {
        const occupied = supportById(support);
        const availableFood = accessibleCompanionFoods(liveFoods, [...platforms, ...landingPlatforms]);
        const explicitSupports = landingPlatforms.filter(p => p.manualOnly && (p.id === occupied?.id || availableFood.some(item => item.platformId === p.id)));
        const worldPlatforms = explicitSupports.length ? [...platforms, ...explicitSupports] : platforms;
        const source = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
        // Both surfaces share one hide action. The explicit public marker
        // and user-opened detail bridge protect studio editing and data.
        hideCandidate = effective.ambientPrank && occupied?.kind === "card" && now - brain.current.createdAt >= 45000 ? collectCompanionHideTargets(page).find(target => target.element === source) : undefined;
        const world = { x, y, platformId: support, platforms: worldPlatforms, width: innerWidth, height: innerHeight, hideAvailable: Boolean(hideCandidate), foods: availableFood, pointer: pointer ? { ...pointer, stableMs: Math.max(0, now - pointerStableSince) } : undefined, animated: !reduced && gfxMode() !== "off" };
        const householdPlatforms = [...worldPlatforms, ...landingPlatforms.filter(p => p.manualOnly && isHomeFloor(p.id) && !worldPlatforms.some(existing => existing.id === p.id))];
        const householdHome: CompanionHouseholdHome = {};
        if (!overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off") {
          for (const [key, selector] of [["dispenser", ".vc-home .vc-dispenser"], ["bin", ".vc-home [data-companion-trash]"]] as const) {
            const control = document.querySelector<HTMLElement>(selector), rect = control?.getBoundingClientRect();
            if (!control || control.closest("[hidden],[inert],[aria-hidden='true']") || !rect || rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight) continue;
            const cx = rect.left + rect.width / 2, reach = key === "dispenser" ? size + rect.width / 2 : 44;
            const stance = householdPlatforms.filter(p => isHomeFloor(p.id) && Math.abs(platformLandingX(p, cx) - cx) <= reach && Math.abs(p.y - rect.bottom) < 100).sort((a, b) => Math.abs(platformLandingX(a, cx) - cx) - Math.abs(platformLandingX(b, cx) - cx))[0];
            if (stance) householdHome[key] = { x: platformLandingX(stance, cx), y: stance.y, platformId: stance.id };
          }
        }
        const errand = !overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off" ? household.next({ brain: brain.current, world: { ...world, platforms: householdPlatforms }, preferences: effective, now: brain.current.activeMs, home: householdHome, count: liveFoods.length + (food.current?.carried() ? 1 : 0), carried: food.current?.carried() }) : undefined;
        if (!errand && food.current?.carried()) food.current.releaseCarry(food.current.carried()!);
        const offeredRadio = radioInbox.peek(radioState, now);
        const reaction = !errand && offeredRadio?.mood && radioSpace(availableFood.length) ? getCompanionRadioReaction({ mood: offeredRadio.mood, preferences: effective, habits: brain.current.habits, life: brain.current.life, energy: brain.current.energy }) : undefined;
        if (reaction) radioInbox.take(radioState, now);
        const played = !errand && !radioState.playing && radioSpace(availableFood.length, true) ? instrumentInbox.take(now) : undefined;
        const instrumentReaction = played && getCompanionInstrumentReaction({ mood: played.pulse.mood, quality: played.quality, preferences: effective, life: brain.current.life, energy: brain.current.energy });
        const musical: RuntimeAction | undefined = reaction && reaction !== "ignore" && offeredRadio ? { kind: "look", radio: { generation: offeredRadio.generation, reaction, bpm: offeredRadio.bpm }, target: { x, y, platformId: support }, duration: COMPANION_RADIO_REACTION_MS }
          : instrumentReaction && instrumentReaction !== "ignore" && played ? { kind: "look", radio: { generation: 0, reaction: "sway", instrument: instrumentReaction, bpm: played.pulse.bpm }, target: { x, y, platformId: support }, duration: COMPANION_RADIO_REACTION_MS } : undefined;
        const equipped = wardrobe.current.equipped;
        const pocketAllowed = equipped === "magic-pocket" && effective.rarePrank && !companionRadioFoodPriority({ feeding: effective.feeding, hunger: brain.current.hunger, availableFoods: availableFood.length });
        const specialAllowed = !["magic-pocket", "propeller-hat"].includes(equipped ?? "") || effective.rarePrank;
        const safeTrick = !errand && !musical && equipped && specialAllowed && effective.roam && wardrobePainter?.accessoryReady() && paintedTexture?.complete && paintedTexture.naturalWidth > 0 && brain.current.activeMs >= accessoryReadyAt && (!availableFood.length || pocketAllowed) && brain.current.hunger < .75 && !brain.current.foodGoal && !brain.current.intention && !brain.current.episode && !returning && !pendingMonth && !reduced && !["off", "soft"].includes(gfxMode()) && (!isCompanionHat(equipped) || effective.jump)
          && accessorySpace(equipped);
        const chosen: RuntimeAction = errand ?? musical ?? (safeTrick ? { kind: "look", accessory: equipped!, target: { x, y, platformId: support }, duration: COMPANION_ACCESSORY_MOTION_MS } : getAction(brain.current, world, effective, now));
        if (musical?.radio) {
          const rows = musical.radio.reaction === "bored" ? [10, 1] : musical.radio.reaction === "sway" ? [1, 9] : musical.radio.reaction === "bounce" ? [9] : [1];
          const instrumentRow = musical.radio.instrument === "tease" ? 28 : musical.radio.instrument === "encourage" ? 29 : undefined;
          (instrumentRow === undefined ? rows : [instrumentRow]).forEach(row => spriteSources[row].forEach(src => requestSprite.current(src)));
        }
        if (safeTrick && !errand) { accessoryReadyAt = brain.current.activeMs + 45000; pendingCue = "play"; (isCompanionHat(equipped!) ? [3, 4] : [9]).forEach(row => spriteSources[row].forEach(src => requestSprite.current(src))); }
        const chosenFood = availableFood.find(item => item.id === chosen.foodId);
        if (chosenFood) lastFoodPoint = { id: chosenFood.id, x: chosenFood.x, y: chosenFood.y };
        const consumedFoods = chosenFood ? loadCompanionCollection().foods : [];
        const curiousMeal = !errand && !musical && !safeTrick && !reduced && gfxMode() !== "off"
          ? foodCuriosity.consider(chosen, chosenFood, Boolean(chosenFood && consumedFoods.includes(chosenFood.kind)), brain.current.hunger, effective, consumedFoods) : chosen;
        const curiousIntent = curiousMeal.foodCuriosity === "tease" && pointer ? { ...curiousMeal, direction: pointer.x < x ? -1 as const : 1 as const, attention: { kind: "social" as const, point: { ...pointer } } } : curiousMeal;
        launch(errand || musical || safeTrick ? chosen : deliberateCompanionAction(brain.current, world, effective, curiousIntent, !reduced && gfxMode() !== "off"), now);
        if (hiding) { paint(14, 0, "hide"); schedule(); return; }
      }
      let row = 0, frame = 0, status = "idle";
      if (action) {
        let age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        const householdBeat = action.household;
        if (householdBeat?.effect && !householdEffectApplied && p >= (action.kind === "walk" ? .82 : .48) && (householdBeat.effect !== "scatter" || !householdBeat.point || Math.hypot(x - householdBeat.point.x, y - householdBeat.point.y) <= 64)) {
          householdEffectApplied = true;
          let result: boolean | string = false;
          if (householdBeat.effect === "pick" && householdBeat.foodId) result = Boolean(paintedSelection && accessoryModule?.companionCarryAnchor(paintedSelection) && food.current?.beginCarry(householdBeat.foodId));
          else if (householdBeat.effect === "put" && householdBeat.foodId) result = Boolean(food.current?.releaseCarry(householdBeat.foodId));
          else if (householdBeat.effect === "discard" && householdBeat.foodId) {
            const bin = document.querySelector<HTMLElement>(".vc-home [data-companion-trash]");
            result = Boolean(bin && food.current?.discardCarry(householdBeat.foodId, bin));
          } else if (householdBeat.effect === "spawn") {
            const slot = document.querySelector<HTMLElement>(".vc-home .vc-dispenser-slot"), outlet = slot?.getBoundingClientRect();
            if (slot && outlet && outlet.width > 0 && Math.abs(x - (outlet.left + outlet.width / 2)) <= size + outlet.width / 2 && Math.abs(y - outlet.bottom) < size && !slot.parentElement?.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]")) {
              const kind = randomCompanionFood(lastFood.current);
              result = food.current?.spawn(kind, { x: outlet.left + outlet.width / 2, y: outlet.bottom + 2 }, undefined, true, { x, y }) ?? false;
              if (result) { lastFood.current = kind; pendingCue = "feed"; slot.closest("button")?.animate([{ transform: "scale(1)" }, { transform: "scale(.93)" }, { transform: "scale(1)" }], { duration: 280 }); }
            }
          } else if (householdBeat.effect === "scatter") { result = Boolean(food.current?.scatter(householdBeat.point ?? { x, y }, 110, 1.4)); if (result) pendingCue = "play"; }
          household.resolve(householdBeat, result, brain.current.activeMs);
        }
        if (action.foodCuriosity === "toss" && !curiosityTossed && p >= .4) { curiosityTossed = true; if (action.effectPoint) food.current?.jostle(action.effectPoint, 38, 2.5); }
        if (action.kind === "walk") {
          x = lerp(origin.x, action.target.x, runUpCurve ? sampleCompanionRunUp(p) : sampleCompanionTravel(p)); row = action.pace === "scoot" ? 20 : 2;
          if (runTrip) {
            const point = companionRunTripContact(runTrip, origin, action.target, supportById(support), liveFoods);
            if (point === null || overlayActive || homeJourney || workspaceBusyRef.current || presence.phase !== "active" || reduced || gfxMode() === "off") runTrip = undefined;
            else if ((x - point) * (action.target.x < origin.x ? -1 : 1) >= 0) {
              const contact = runTrip; x = point; rememberMishapPlace();
              const wasRunning = action.pace === "scoot";
              const trippedFood = liveFoods.find(item => item.id === contact.foodId);
              if (trippedFood) rememberLife({ kind: "food-mishap", food: trippedFood.kind });
              const reaction = action.episode ? companionEpisodeMishap(action, { x, y }, supportById(support), brain.current, now, preferences) : undefined;
              launch(reaction ?? { kind: "play", play: contact.play, target: { x, y, platformId: support }, duration: companionPlayDuration(contact.play), direction: action.direction, intention: brain.current.intention }, now);
              const contactPlay = reaction?.play ?? contact.play;
              data("trip", contact.cause); data("play", contactPlay); data("playBeat", "impact");
              const situation = companionRunContactSituation({ cause: contact.cause, running: wasRunning, foodPresent: Boolean(trippedFood) });
              if (situation) queueSituation(situation, [21, 24, 25], began);
              paint(sampleCompanionPlay(contactPlay, 0).row, 0, "play"); schedule(); return;
            }
          }
        }
        else if (action.kind === "jump") {
          const passage = sofaPassage(sofaFlightProgress(now));
          if (sofaTravelActive && (!passage || !passage.safe)) {
            // A resize/fold can revoke a once-safe rim/ceiling while airborne.
            // Adopt the actual shown point into the existing sofa collider or
            // first lower support; do not revert to a wall-crossing old arc.
            recoverJumpGeometry(now);
            paint(5, 0, "jump"); schedule(); return;
          }
          if (!flight && travel > 0 && !sofaTravelActive && (ballisticCoefficient === null || !companionBallisticArcIsSafe(origin.y, action.target.y, ballisticCoefficient, size + 8, sofaFlightProgress(now)))) {
            recoverJumpGeometry(now);
            paint(5, 0, "jump"); schedule(); return;
          }
          if (flight) {
            const result = stepCompanionThrow(flight, now - flightAt, landingPlatforms, throwBounds());
            flight = result.state; flightAt = now; x = flight.x; y = flight.y;
            const phase = flight.elapsedMs < 90 ? "launch" : flight.vy < -80 ? "rise" : flight.vy <= 80 ? "apex" : "fall";
            data("throwPhase", phase); data("throwVx", flight.vx.toFixed(3)); data("throwVy", flight.vy.toFixed(3));
            row = COMPANION_THROW_ROW;
            frame = phase === "launch" ? 0 : phase === "rise" ? 4 : phase === "apex" ? 8 : 12 + clamp(flight.vy / 950, 0, 1) * 3;
            if (phase === "fall") spriteSources[6].forEach(src => requestSprite.current(src));
            if (result.contact) {
              // The actual swept contact owns this one landing. No planned
              // target, endpoint clamp or geometry reflow can pre-land it.
              x = result.contact.x; y = result.contact.y; support = result.contact.platformId;
              action = { kind: "jump", target: { ...result.contact }, duration: COMPANION_TIMING.jumpLanding };
              flight = undefined; travel = -6; origin = { x, y }; began = now; total = action.duration; age = p = 0;
              brain.current = recordCompanionEvent(brain.current, "landed");
              data("throwPhase", "landing"); row = 6; frame = 0;
            } else if (flight.expired) {
              // Resize/deletion may leave no real support. Discard momentum
              // and reuse the existing finite vertical geometry recovery.
              clearAction(); settle({ x, y }); paint(5, 0, "jump"); schedule(); return;
            }
          }
          else if (travel === -6) { x = action.target.x; y = action.target.y; row = 6; frame = p * 15; }
          else if (passage) {
            x = passage.x; y = passage.y;
            const anticipation = travel > 0 ? jumpAnticipation() : 0, flightMs = travel > 0 ? travel : Math.max(1, total - COMPANION_TIMING.jumpLanding);
            const progress = sofaFlightProgress(now), apex = passage.coefficient > 0 ? clamp(.5 - (action.target.y - origin.y) / (2 * passage.coefficient), 0, 1) : action.target.y < origin.y ? 1 : 0;
            if (age < anticipation) { row = 3; frame = age / anticipation * 15; }
            else if (age >= anticipation + flightMs) { row = 6; frame = (age - anticipation - flightMs) / COMPANION_TIMING.jumpLanding * 15; }
            else { row = progress < apex ? 4 : 5; frame = (progress < apex ? progress / Math.max(.001, apex) : (progress - apex) / Math.max(.001, 1 - apex)) * 15; }
          }
          else if (travel === -2) { const eased = sampleCompanionTravel(p), lift = boundCompanionSineArc(origin.y, action.target.y, reduced ? 0 : 60, size + 8); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(p * Math.PI) * lift; row = p < .5 ? 4 : p < .85 ? 5 : 6; frame = (p < .5 ? p * 2 : p < .85 ? (p - .5) / .35 : (p - .85) / .15) * 15; }
          else if (travel === -3) { const progress = clamp(p / .78, 0, 1), eased = sampleCompanionTravel(progress), lift = boundCompanionSineArc(origin.y, action.target.y, reduced ? 0 : 10, size + 8); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased) - Math.sin(progress * Math.PI) * lift; row = p < .78 ? 5 : 6; frame = (p < .78 ? progress : (p - .78) / .22) * 15; }
          else if (travel === -4) { const eased = sampleCompanionTravel(p); x = lerp(origin.x, action.target.x, eased); y = lerp(origin.y, action.target.y, eased); row = p < .8 ? 5 : 6; frame = p * 15; }
          else if (travel === -1) { x = lerp(origin.x, action.target.x, p); y = lerp(origin.y, action.target.y, p * p); row = p < .8 ? 5 : 6; frame = (p < .8 ? p / .8 : (p - .8) / .2) * 15; }
          else if (age < jumpAnticipation()) { row = 3; frame = age / jumpAnticipation() * 15; }
          else if (age < jumpAnticipation() + travel) {
            const t = (age - jumpAnticipation()) / 1000, progress = clamp((age - jumpAnticipation()) / travel, 0, 1);
            const coefficient = ballisticCoefficient ?? 0;
            x = lerp(origin.x, action.target.x, progress); y = lerp(origin.y, action.target.y, progress) - coefficient * progress * (1 - progress);
            const apexProgress = coefficient > 0 ? clamp(.5 - (action.target.y - origin.y) / (2 * coefficient), 0, 1) : action.target.y < origin.y ? 1 : 0;
            const apex = apexProgress * travel / 1000;
            row = t < apex ? 4 : 5; frame = (t < apex ? t / Math.max(.001, apex) : (t - apex) / Math.max(.001, travel / 1000 - apex)) * 15;
          } else { x = action.target.x; y = action.target.y; row = 6; frame = (age - jumpAnticipation() - travel) / COMPANION_TIMING.jumpLanding * 15; }
        } else if (action.kind === "sleep") {
          const cozy = action.living === "cozy" ? sampleCompanionCozySleep(age, total, action.cozySettled, reduced || gfxMode() === "off") : undefined;
          sleeping = cozy ? cozy.dreaming : true; row = cozy?.row ?? (age < COMPANION_TIMING.sleepYawn ? 10 : total - age < COMPANION_TIMING.sleepWake ? 12 : 11);
          frame = cozy ? cozy.phase * 15 : row === 10 ? age / COMPANION_TIMING.sleepYawn * 15 : row === 12 ? (age - total + COMPANION_TIMING.sleepWake) / COMPANION_TIMING.sleepWake * 15 : 0;
          el.toggleAttribute("data-dreaming", row === 11 || row === 40);
        } else if (action.kind === "heart") {
          if (age < travel) { x = lerp(origin.x, action.target.x, sampleCompanionTravel(age / Math.max(1, travel))); row = 2; }
          else {
            const t = (age - travel) / action.duration; row = 13; frame = t * 15;
            const heartLift = boundCompanionSineArc(origin.y, origin.y, reduced ? 0 : 18, size + 8);
            y = origin.y - Math.sin(clamp(t / .42, 0, 1) * Math.PI) * heartLift;
            if (t >= .25 && heartResult === null) {
              heartResult = !overlayActive && !workspaceBusyRef.current && action.effectPoint ? hearts.attemptAt(action.effectPoint) : "missing";
              if (heartResult === "blocked") brain.current = recordCompanionEvent(brain.current, "heart-blocked");
              if (heartResult === "blocked") queueSituation("heart-blocked", [18], began);
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
          // A missing packet may retain another visible pose. Wait finitely
          // for an actual calibrated mouth instead of consuming an unseen bite.
          if (!mealAnchored) {
            const wait = advanceCompanionMealWait(now, began, delta, mealWaited);
            mealWaited = wait.waited; began = wait.began; age = p = 0;
            if (wait.expired) {
              const foodId = action.foodId; clearAction();
              if (foodId) brain.current = { ...brain.current, foodGoal: { foodId, remaining: 0, retryAfter: brain.current.activeMs + COMPANION_FEED_RETRY_MS } };
              nextDecision = now + 480; paint(1, 0, "look"); schedule(); return;
            }
          }
          row = p < .18 ? 1 : 9; frame = p < .18 ? p / .18 * 15 : 0;
        } else if (action.kind === "play" && action.play) {
          const play = sampleCompanionPlay(action.play, p, reduced || gfxMode() === "off");
          row = play.row; frame = play.phase * 15;
          if (preparedPlayRow !== play.row) {
            preparedPlayRow = play.row;
            preparedNextPlayRow = companionNextPlayRow(action.play, p, reduced || gfxMode() === "off");
          }
          // The bounded decoder may evict an unowned future packet while
          // this beat stays on the same row. Retry only its imminent row on
          // the existing tick; decoded/pending guards keep warm ticks cheap.
          if (preparedNextPlayRow >= 0) spriteSources[preparedNextPlayRow].forEach(src => requestSprite.current(src));
          const platform = supportById(support), direction = action.direction ?? brain.current.heading;
          const room = platform ? Math.max(0, Math.min(22, origin.x - platform.x - 8, platform.x + platform.width - origin.x - 8)) : 0;
          x = action.rolling ? lerp(origin.x, action.target.x, companionRollProgress(action.play, age)) : origin.x + direction * play.shift * room / 22;
          if (playFalling) {
            const fall = reduced ? 1 : clamp(age / Math.min(650, total), 0, 1);
            y = lerp(origin.y, action.target.y, fall * fall);
            if (fall >= 1) { playFalling = false; support = action.target.platformId ?? support; }
          }
          data("play", action.play); data("playBeat", play.beat);
          if (!playImpact && age >= Math.min(90, total * .05) && ["tumble", "slip-tumble", "bump", "slip"].includes(action.play)) {
            playImpact = true; mishapUntil = now + 6500;
            if (!workspaceBusyRef.current && !reduced && gfxMode() !== "off" && !isHomeSupport(support)) {
              const node = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
              if (preferences.cardPrank && node && !node.matches(".selected,.primary-selected,.dragging-src,.span-drag-src,.connect-target,.connect-hover,.connect-dim,.filter-dim,.is-editing,.is-selected") && collectCompanionHideTargets(page).some(target => target.element === node)) { cardPlay.bump(node, paintedFacing); queueSituation("card-bump", [21, 24, 25], began); }
              food.current?.jostle({ x, y }, 100);
            }
          }
        } else if (action.kind === "look" && action.radio) {
          const mealFoods = companionRadioFoodPriority({ feeding: effective.feeding, hunger: brain.current.hunger, availableFoods: liveFoods.length }) ? accessibleCompanionFoods(liveFoods, [...platforms, ...landingPlatforms]).length : 0;
          if ((action.radio.instrument ? radioState.playing || !radioSpace(mealFoods, true) : !radioState.playing || radioState.generation !== action.radio.generation || !radioSpace(mealFoods))) { clearAction(); nextDecision = now + 60; paint(0, 0, "idle"); schedule(); return; }
          const musical = sampleWorldMusic(action.radio, age); row = musical.row; frame = musical.frame;
          if (action.radio.instrument) data("instrumentReaction", action.radio.instrument); else el.removeAttribute("data-instrument-reaction");
          data("radioReaction", action.radio.reaction); data("radioGeneration", String(action.radio.generation));
        } else if (action.kind === "look" && action.accessory) {
          if (!effective.roam || action.accessory !== wardrobe.current.equipped || overlayActive || workspaceBusyRef.current || brain.current.foodGoal || liveFoods.length && action.accessory !== "magic-pocket" || ["magic-pocket", "propeller-hat"].includes(action.accessory) && !effective.rarePrank || !accessorySpace(action.accessory) || reduced || ["off", "soft"].includes(gfxMode())) { clearAction(); nextDecision = now + 60; paint(0, 0, "idle"); schedule(); return; }
          const trick = sampleCompanionAccessoryMotion(action.accessory, age); row = trick.row; frame = trick.frame;
          data("accessoryTrick", action.accessory); data("accessoryBeat", trick.phase);
          if (!accessoryLanded && isCompanionHat(action.accessory) && p >= .6) { accessoryLanded = true; pendingCue = "land"; }
        } else if (action.kind === "look") { row = action.attention?.kind === "reconsider" ? 26 : 1; frame = p * 15; }
        else if (action.kind === "stretch") { row = 16; frame = p * 15; }
        else if (action.kind === "shake") { row = 17; frame = p * 15; }
        if (p >= 1) {
          const completed = action, completedTravel = travel, completedOrigin = origin;
          if (homeJourney && (completed.kind === "walk" || completed.kind === "jump")) homeLegs++;
          const rested = completed.kind === "sleep", ejected = Boolean(homeDeparture?.flying);
          const continueRoute = Boolean(action.foodId && (action.kind === "walk" || action.kind === "jump") || brain.current.intention?.kind === "explore" && ["consider", "travel"].includes(brain.current.intention.stage) && brain.current.intention.remaining > 0);
          const eatenFood = action.kind === "eat" && action.foodId ? liveFoods.find(item => item.id === action!.foodId) : undefined;
          if (action.kind === "eat" && action.foodId && food.current?.consume(action.foodId)) {
            const firstFood = eatenFood && recordCompanionConsumedFood(eatenFood.kind, true);
            if (firstFood && eatenFood) setFirstTaste({ kind: eatenFood.kind, x, y: y - size * .4 });
            queueSituation("meal-finished", [0, 9, 29]); pendingCue = firstFood ? "discover" : "eat";
            brain.current = recordCompanionEvent(brain.current, "ate"); if (!experience("fed", eatenFood?.kind)) persistCare(true);
            petUntil = now + (reduced ? 400 : 1100);
          }
          if (completed.kind === "jump") pendingCue = "land";
          if ((completed.kind === "jump" || completed.kind === "walk" && completed.pace === "scoot") && wardrobe.current.equipped && !["magic-pocket", "propeller-hat"].includes(wardrobe.current.equipped)
            && brain.current.activeMs >= accessoryHabitAt && Math.random() < .25) {
            accessoryHabitAt = brain.current.activeMs + 45000; accessoryReadyAt = Math.min(accessoryReadyAt, brain.current.activeMs + 1000);
          }
          if (completed.accessory && (accessoryWitnessed & 6) === 6 && wardrobe.current.equipped === completed.accessory) queueSituation("accessory-trick", [9]);
          if (rested && isHomeSupport(support)) queueSituation("home-rested", [0, 9, 11, 12, 40]);
          if (["walk", "jump", "heart", "hide", "play"].includes(action.kind)) { x = action.target.x; y = action.target.y; support = action.target.platformId ?? support; }
          if (completed.kind === "jump" && verticalLanding) verticalRecoveryX = undefined;
          let arrivalPlay: CompanionAction["play"] = undefined;
          if (completed.kind === "jump" && shakenReleasePending && supportedNow() && !homeJourney && !ejected && !overlayActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off") arrivalPlay = "dizzy";
          else if (completed.kind === "jump" && !completed.foodId && !completed.episode && !homeJourney && !restAfterLanding && !ejected && !overlayActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off" && presence.phase === "active") {
            const landing = supportById(support);
            const node = geometryTracker?.anchor(support)?.element?.closest<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]");
            const ordinary = Boolean(node && !node.matches(".selected,.primary-selected,.dragging-src,.span-drag-src,.connect-target,.connect-hover,.connect-dim,.filter-dim,.is-editing,.is-selected") && collectCompanionHideTargets(page).some(target => target.element === node));
            const cardBounds = ordinary ? node!.getBoundingClientRect() : undefined;
            arrivalPlay = completed.household ? undefined : getCompanionArrivalPlay({
              kind: completed.kind, pace: completed.pace,
              distanceCSS: Math.hypot(x - completedOrigin.x, y - completedOrigin.y),
              natural: completedTravel > 0,
              ordinaryCard: ordinary && landing?.kind === "card", width: landing?.width ?? 0,
              // Safe centre spans are not the card's physical edge. Contact
              // uses its actual ink box; the span still bounds all movement.
              edgeClearance: cardBounds ? Math.max(0, Math.min(x - cardBounds.left, cardBounds.right - x)) : 0,
              energy: brain.current.energy, cooldownReady: (brain.current.cooldowns.mishap ?? -Infinity) <= now,
              stable: Boolean(landing && Math.abs(y - landing.y) <= 2 && !isHomeSupport(support))
            }, preferences) ?? undefined;
          }
          const shakenArrivalColumn = arrivalPlay === "dizzy" ? shakenReleasePending?.column : undefined;
          const continueEpisode = Boolean(!completed.episodeCancelled && (completed.episode || brain.current.episode?.phase === "ate") && !homeJourney && !overlayActive && !restAfterLanding && !ejected && !workspaceBusyRef.current && !premiereActive && !reduced && gfxMode() !== "off" && presence.phase === "active");
          const episodeMishap = continueEpisode && completed.kind === "jump" ? companionEpisodeMishap(completed, { x, y }, supportById(support), brain.current, now, preferences, true) : undefined;
          const nextHop = completed.kind === "walk" && !completed.episodeCancelled && runHop && supportedNow() && !homeJourney && !overlayActive && !restAfterLanding && !ejected && !workspaceBusyRef.current && !premiereActive && !reduced && gfxMode() !== "off" && presence.phase === "active" && validCompanionRunHop(runHop, { x, y }, supportById(support)) && (!runHop.episode || companionEpisodeHopAvailable(runHop, supportById(support), liveFoods)) ? runHop : undefined;
          clearAction(continueEpisode, Boolean(completed.household && household.active()));
          if (ejected && presence.phase === "parked") { row = 11; frame = 0; status = "sleep"; el.dataset.dreaming = ""; offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true); }
          if (rested) { brain.current = recordCompanionEvent(brain.current, "rested"); rememberLife({ kind: "rested" }); } if (completed.episodeCancelled) brain.current = { ...brain.current, episode: undefined }; nextDecision = now + (homeJourney || continueRoute || continueEpisode || completed.household && household.active() ? 0 : completed.attention && completed.attention.kind !== "social" ? 60 : 220);
          if (homeJourney && !overlayActive && (presence.phase === "active" || homeJourney === "called" && presence.phase === "finishing")) {
            advanceHomeJourney(now);
            if (action) { status = action.kind; row = action.kind === "walk" ? action.pace === "scoot" ? 20 : 2 : action.kind === "jump" ? 3 : action.kind === "sleep" ? 10 : 1; frame = 0; }
          }
          if (restAfterLanding) { restAfterLanding = false; if (presence.phase === "active") control.current?.rest(); }
          if (nextHop) { launch(nextHop, now); row = 4; frame = 0; status = "jump"; }
          if (episodeMishap) { rememberMishapPlace(); const trippedFood = liveFoods.find(item => item.id === episodeMishap.foodId); if (trippedFood) rememberLife({ kind: "food-mishap", food: trippedFood.kind }); launch(episodeMishap, now); const contact = sampleCompanionPlay(episodeMishap.play!, 0); row = contact.row; frame = 0; status = "play"; data("trip", "landing"); queueSituation("landing-mishap", [21, 24, 25], began); }
          if (arrivalPlay) {
            rememberMishapPlace();
            // The actual completed run/landing owns this one contact. Start
            // its reaction now rather than pausing for another random choice.
            launch({ kind: "play", play: arrivalPlay, target: { x, y, platformId: support }, duration: companionPlayDuration(arrivalPlay), direction: completed.direction, intention: brain.current.intention?.kind === "explore" ? brain.current.intention : undefined }, now);
            if (arrivalPlay !== "dizzy") queueSituation("landing-mishap", [21, 24, 25], began);
            shakenGroundColumn = shakenArrivalColumn;
            const contact = sampleCompanionPlay(arrivalPlay, 0);
            row = contact.row; frame = 0; status = "play";
            data("play", arrivalPlay); data("playBeat", contact.beat);
          }
          if (!ejected && completed.kind === "jump" && finishParkedDrop()) return;
        }
      }
      const mood = getCompanionMood(brain.current);
      if (mood !== moodPose) { moodPose = mood; moodStarted = presentationNow; }
      if (mood === "disappointed" || mood === "sulky") {
        const moodRow = mood === "sulky" ? 19 : 18;
        spriteSources[moodRow].forEach(src => requestSprite.current(src));
        if (["idle", "look"].includes(status) && !action?.attention && !action?.radio && !action?.household) { row = moodRow; frame = reduced ? 0 : clamp((presentationNow - moodStarted) / (COMPANION_CLIP_TIMING[moodRow].duration ?? 1400), 0, 1) * 15; }
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
      // An unreachable explicit command keeps one calm compositor-only wait
      // pose. Blur must still run the finite rest/yawn/parked handoff, instead
      // of stranding presence in `finishing` with the awake drawing forever.
      const quietHomeWait = Boolean(homeJourney && homeWaitingGeometry && !overlayActive && presence.phase === "active" && !stopped && !pause
        && canParkCompanionHomeWait(performance.now(), petUntil, interactionUntil, Boolean(action || continuousMotion() || touch.sample(performance.now()).pressure > 0 || pressed || keyboardHeld || placing || overlayDrag || overlayPlacing || returning || afterPetLanding || pendingMonth || hiding || waitingForSupport || awaitingAtX || pendingPosition.current || workspaceBusyRef.current)));
      el.toggleAttribute("data-home-wait-pose", quietHomeWait);
      if (quietHomeWait) { paint(1, 15, "look"); return; }
      if (stopped || pause || waitingForSupport && !overlayActive && !action && !pressed && !keyboardHeld && !placing && !returning || hiding && overlayActive && !hiding.ready || !premiereActive && !premiereBounce && !homeDeparture && (isDetailGuest() ? !guestBusy(performance.now()) : hiding ? !hideSeek.sample(presentationNow).active : presence.phase === "parked" && !returning && !action)) return;
      if (reduced) timer = setTimeout(() => tick(performance.now()), 400);
      else {
        const moving = continuousMotion();
        // Continuous travel/scalar transitions, cyclic drawings at<=14Hz; action poses follow their phase.
        // A quiet creature needs only the cadence of its native idle loop.
        const fps = moving ? gfxMode() === "full" ? 60 : 30 : 14;
        const draw = (now: number) => {
        inputPaintQueued = false;
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
      releaseOverlayDrag(); guestKeyboardHeld = false; guestKeyboardOrigin = undefined; guestKeyboardBounds = undefined; guestUntil = animate ? performance.now() + 160 : 0; petUntil = 0; forceNeutralPose = !animate; stopHover();
      if (animate) wakeGuest();
    };
    const dropGuest = (point: { x: number; y: number }, moved = true) => {
      if (!isDetailGuest() || !overlayPerch) return;
      const extracting = Boolean(hiding?.ready);
      guestKeyboardHeld = false; guestKeyboardOrigin = undefined; guestKeyboardBounds = undefined; guestUntil = performance.now() + 160; petUntil = 0; stopHover();
      const sheet = hiding?.sheet ?? extractedFrom;
      const rect = sheet?.isConnected ? sheet.getBoundingClientRect() : null;
      const inside = rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
      if (inside && hiding?.ready) { if (moved) transferred(); updateOverlayPerch(); paint(9, 0, "watch"); wakeGuest(); return; }
      // A user extraction remains a display-only guest until this window
      // closes. Only the next real world geometry delivery consumes its one
      // pending drop; no planner, vote or food action runs in the dialog.
      const shown = { ...overlayPerch };
      const from = el.style.transform;
      const eventId = hiding?.target.eventId ?? extractedEvent;
      resetHide(); extractedFrom = sheet ?? null; extractedEvent = eventId; ownGuest(extractedFrom);
      forceNeutralPose = false; guestUntil = performance.now() + 160;
      data("detailGuest", ""); data("hidePerch", "outside"); button.tabIndex = 0;
      overlayPerch = placeCompanionOverlayPerch({ ...shown, scale: 1 }, size, { width: innerWidth, height: innerHeight }, overlayWindows().map(node => node.getBoundingClientRect()));
      pendingDetailDrop = { x: overlayPerch.x, y: overlayPerch.y };
      if (moved) {
        if (extracting) { experience("played"); logActivity("ui.click", { target: "companion-extract" }); }
        else transferred();
      }
      paint(9, 0, "watch");
      if (!reduced && gfxMode() !== "off" && from !== el.style.transform) {
        perchAnimation?.cancel();
        perchAnimation = el.animate([{ transform: from }, { transform: el.style.transform }], { duration: FLIP_MS, easing: getComputedStyle(document.documentElement).getPropertyValue("--ease").trim() || "ease-out" });
      }
      wakeGuest();
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
        cancelHomeJourney(); premiereActive = true; overlayActive = false; perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0;
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
      if (!radioAllowed()) { radioInbox.clear(); if (action?.radio && !(action.radio.instrument ? musicAllowed() : radioAllowed())) clearAction(); }
      if (!musicAllowed()) instrumentInbox.clear();
      if (graphicsMode === "off" || blocked || document.hidden || overlayRef.current || workspaceBusyRef.current || premiereRef.current.cue?.phase && !["idle", "return", "prelude"].includes(premiereRef.current.cue.phase)) cancelEpisode();
      if (blocked || document.hidden || overlayRef.current || premiereRef.current.cue?.phase && !["idle", "return", "prelude"].includes(premiereRef.current.cue.phase)) cardPlay.clear();
      if (syncPremiere()) return;
      hideClock(performance.now());
      const html = document.documentElement;
      const wantsOverlay = overlayRef.current;
      const livePrelude = preludeCue();
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause") && hasAmbientPauseOutside("poster-window", livePrelude ? [livePrelude.owner] : []);
      if (next || wantsOverlay) { pendingHomeRecall = undefined; clearTimeout(parkedLayoutTimer); clearSupportWait(); }
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
          overlayPerch = undefined; presence.focus(homeJourney === "called" || document.hasFocus(), performance.now(), homeJourney === "called");
          lastTick = lastNeeds = lastCare = lastPaint = performance.now();
          el.removeAttribute("data-dreaming");
        }
        if (overlayActive) followLayout();
      }
      // A hard-pause release may resume the same already-open window. Seed
      // this new controller there too; established residents never reseed.
      if (!next && needsOverlayWorldSeed()) connectGeometry();
      food.current?.pause(next || overlayActive);
      if (next === pause && started) {
        if (overlayChanged && !pause) {
          if (overlayActive) updateOverlayPerch();
          else { connectGeometry(); hearts.pause(presence.phase === "parked"); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); }
          cancelAnimationFrame(raf); clearTimeout(timer); schedule();
        }
        armPrelude(); return;
      }
      started = true; pause = next; setSuspended(next); if (next) { pendingCue = undefined; hideBed(); el.hidden = true; }
      if (pause) { if (isDetailGuest()) cancelGuestInput(); else releaseOverlayDrag(); }
      if (pause) { overlayPlacing = false; delete el.dataset.placing; }
      cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); lastNeeds = lastTick; lastPaint = lastTick;
      if (pause) { clearTimeout(preludeTimer); preludeDeadline = 0; homeDeparture = undefined; returning = undefined; el.removeAttribute("data-returning"); pickupScale = 1; perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0; stopHover(); needsLanding = action?.kind === "jump" || playFalling || Boolean(pressed) || keyboardHeld || afterPetLanding; afterPetLanding = false; restAfterLanding = false; supportMotion.reset(); style(reactionLayer, "transform", "translate3d(0,0px,0) scale(1,1)"); persistCare(true); clearAction(); clearTimeout(parkedLayoutTimer); offGeometry?.(); offGeometry = undefined; geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(followRaf); followRaf = 0; geometryReady = false; hearts.pause(true); releaseHold(); placing = false; delete el.dataset.placing; setHomeExpanded(false); }
      else { presence.focus(!overlayActive && (homeJourney === "called" || document.hasFocus()), lastTick, !overlayActive && homeJourney === "called"); if (overlayActive) updateOverlayPerch(); else connectGeometry(); hearts.pause(overlayActive || presence.phase === "parked"); if (needsLanding) { needsLanding = false; settle({ x, y }); } nextDecision = performance.now() + 600; if (presence.phase !== "parked") schedule(); armPrelude(); }
    };
    const focusChanged = () => {
      if (!document.hasFocus()) { radioInbox.clear(); instrumentInbox.clear(); if (action?.radio) clearAction(); cancelEpisode(); pointer = pointerAnchor = undefined; pointerStableSince = 0; }
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
        clearSupportWait();
        cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(parkedLayoutTimer);
        lastTick = lastNeeds = lastCare = lastPaint = now;
        el.removeAttribute("data-dreaming");
        connectGeometry(); hearts.pause(false); schedule();
      } else if (document.hasFocus() && waitingForSupport && !overlayActive) {
        // Real focus may follow a settled layout without another scroll.
        // Request one event-owned delivery, never revive the stale drawing.
        connectGeometry(); offGeometry?.revalidate(true);
      }
      if (document.hasFocus()) lastNeeds = now;
      else if (homeWaitingGeometry && !action && !overlayActive) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastCare = lastPaint = now; schedule(); }
    };
    const down = (event: PointerEvent) => {
      if (workspaceBusyRef.current || premiereActive || premiereBounce) return;
      if (isDetailGuest() && !pause && !overlayDrag && !guestKeyboardHeld && event.button === 0 && event.isPrimary !== false && (preferences.drag || preferences.petting)) {
        const shown = displayedPoint(); perchAnimation?.cancel(); overlayPerch = { ...shown, overlap: overlayPerch?.overlap ?? false };
        stopHover(); guestUntil = petUntil = 0;
        grip = { x: clamp((event.clientX - shown.x) / shown.scale + size / 2, 0, size), y: clamp((event.clientY - shown.y) / shown.scale + size, 0, size) };
        style(inertiaLayer, "transform-origin", `${grip.x}px ${grip.y}px`);
        const sheet = hiding?.sheet ?? extractedFrom;
        overlayDrag = { id: event.pointerId, dx: event.clientX - shown.x, dy: event.clientY - shown.y, guest: { x: event.clientX, y: event.clientY, origin: { ...overlayPerch }, bounds: sheet?.getBoundingClientRect(), dragged: false } };
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
        clearAction(); cancelTravelGoal();
        x = shown.x; y = shown.y;
        overlayPerch = { ...shown, overlap: overlayPerch?.overlap ?? false };
        overlayDrag = { id: event.pointerId, dx: event.clientX - shown.x, dy: event.clientY - shown.y, worldOrigin: { x, y } };
        event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId);
        data("overlayDrag", ""); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        return;
      }
      interruptReturn(); homeDeparture = undefined; cancelHomeJourney(); cancelTravelGoal();
      stopHover(); awaitingAtX = false; clearSupportWait();
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
      if (action?.accessory) y -= sampleCompanionAccessoryMotion(action.accessory, now - began).bodyLift;
      if (action?.radio) y += sampleWorldMusic(action.radio, now - began).bob;
      radioInbox.clear();
      instrumentInbox.clear();
      grip = { x: clamp(event.clientX - x + size / 2, 0, size), y: clamp(event.clientY - y + size, 0, size) };
      style(inertiaLayer, "transform-origin", `${grip.x}px ${grip.y}px`);
      clearAction(); pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dx: event.clientX - x, dy: event.clientY - y, dragged: false, grabbed: false, cancelled: false };
      throwVelocity.begin(x, y, now);
      roughInGrip = false;
      if (!reduced && gfxMode() !== "off") spriteSources[COMPANION_THROW_ROW].forEach(src => requestSprite.current(src));
      if (!reduced && gfxMode() !== "off") heldShake.begin(x, y, performance.now());
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
        const previous = overlayPerch;
        const scale = overlayDrag.guest ? companionGuestExtractionScale(overlayDrag.guest.origin.scale, { x: event.clientX, y: event.clientY }, overlayDrag.guest.bounds, size, reduced || gfxMode() === "off") : overlayPerch.scale;
        const scaled = size * scale;
        const dx = overlayDrag.guest ? (grip.x - size / 2) * scale : overlayDrag.dx;
        const dy = overlayDrag.guest ? (grip.y - size) * scale : overlayDrag.dy;
        overlayPerch = { ...overlayPerch, scale, x: clamp(event.clientX - dx, scaled / 2 + 4, innerWidth - scaled / 2 - 4), y: clamp(event.clientY - dy, scaled + 4, innerHeight - 4) };
        if (overlayPerch.x !== previous.x || overlayPerch.y !== previous.y) overlayDrag.moved = true;
        if (overlayDrag.guest && !reduced && gfxMode() !== "off") heldInertia.push((overlayPerch.x - previous.x) / previous.scale, (overlayPerch.y - previous.y) / previous.scale, performance.now(), { x: grip.x / size, y: grip.y / size });
        if (overlayDrag.guest) inputPaint(8, 0, "held"); else paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return;
      }
      if (!pressed) { hover(event); return; }
      if (pressed.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      if (!preferences.drag && distance > 6) pressed.cancelled = true;
      if (preferences.drag && (pressed.grabbed || distance > 6)) {
        const previousX = x, previousY = y;
        if (!pressed.grabbed && !reduced && gfxMode() !== "off") spriteSources[22].forEach(src => requestSprite.current(src));
        // The first grip also warms its shake packet, which can evict an
        // earlier unowned flight image from the three-node cache. Keep the
        // imminent release requested during real dragging, using that same
        // bounded decoder rather than displaying a held key after takeoff.
        if (!reduced && gfxMode() !== "off") spriteSources[COMPANION_THROW_ROW].forEach(src => requestSprite.current(src));
        if (!pressed.grabbed) playCompanionSound("lift", preferencesRef.current);
        pressed.grabbed = true;
        pressed.dragged = true; x = clamp(event.clientX - pressed.dx, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(event.clientY - pressed.dy, size + 8, innerHeight - 12);
        throwVelocity.push(x, y, performance.now());
        if (reduced || gfxMode() === "off") resetInertia();
        else { heldInertia.push(x - previousX, y - previousY, performance.now(), { x: grip.x / size, y: grip.y / size }); heldShake.push(x, y, performance.now());
          if (!roughInGrip && heldShake.sample(performance.now()).active) { roughInGrip = true; hurtTrust("rough-play", performance.now()); logActivity("ui.click", { target: "companion-shake" }); }
        }
        // Keep every physical input sample; share the full60/lite30 display
        // owner. Reduced/off/soft retain immediate finite pointer feedback.
        inputPaint(8, 0, "held");
      }
    };
    const up = (event: PointerEvent) => {
      // Native pointerup may carry a newer position than the last delivered
      // move. Consume it with the same grip/clamps before painting or landing.
      // Cancellation and lost capture retain their last deliberate position.
      if (event.type === "pointerup" && (pressed?.id === event.pointerId && !pressed.cancelled || overlayDrag?.id === event.pointerId && overlayPerch)) move(event);
      if (overlayDrag?.id === event.pointerId && overlayDrag.guest) {
        const guest = overlayDrag.guest;
        if (event.type === "pointercancel") { cancelGuestInput(true); paint(9, 0, "watch"); return; }
        if (guest.dragged) paint(8, 0, "held");
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
        lastTick = lastNeeds = lastPaint = performance.now(); if (!finishParkedDrop()) schedule(); return;
      }
      if (!pressed || pressed.id !== event.pointerId) return;
      // A release can arrive before the next display frame. Commit its last
      // held body now so sofa release tests the current full pose, never the
      // previous pointer sample. Capture and cancellation remain synchronous.
      if (pressed.grabbed && event.type !== "pointercancel" && !pressed.cancelled) paint(8, 0, "held");
      const releasedColumn = paintedColumn;
      const held = pressed; pressed = null;
      const shaken = event.type === "pointerup" && !held.cancelled && held.grabbed && !reduced && gfxMode() !== "off" && heldShake.consume(performance.now());
      el.removeAttribute("data-held-dizzy");
      if (event.type === "pointercancel" || held.cancelled) { resetInertia(); paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); }
      el.removeAttribute("data-grab-ready");
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (held.dragged) {
        const now = performance.now(), velocity = throwVelocity.release(now);
        brain.current = recordCompanionEvent(brain.current, "dragged");
        const thrown = !held.cancelled && event.type === "pointerup" && beginThrow(velocity, now);
        if (!thrown) settle({ x, y });
        shakenReleasePending = shaken && action?.kind === "jump" ? { column: releasedColumn } : undefined;
        if (thrown) paint(COMPANION_THROW_ROW, 0, "jump");
        if (!held.cancelled && event.type === "pointerup") {
          const rough = roughInGrip || shaken || thrown && Math.hypot(velocity.vx, velocity.vy) >= 700;
          if (rough && !roughInGrip) hurtTrust("rough-play", now);
          transferred(thrown, rough);
        }
      }
      else if (!held.cancelled && !held.grabbed && event.type !== "pointercancel") {
        const reaction = preferences.petting ? companionTapReaction({ elapsed: performance.now() - held.at, moved: Math.hypot(event.clientX - held.x, event.clientY - held.y), cancelled: held.cancelled, recentMishap: performance.now() < mishapUntil }) : null;
        if (reaction) {
          if (performance.now() < invitedUntil) hurtTrust("betrayed", performance.now());
          else experience("bonked");
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
      if (["Enter", " ", "p", "P", "n", "N", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) cancelTravelGoal();
      if (isDetailGuest() && !pause && !overlayDrag) {
        const owns = event.key === "Enter" && preferences.petting || event.key === " " && preferences.drag || guestKeyboardHeld && (event.key.startsWith("Arrow") || event.key === "Escape");
        if (!owns) return;
        event.preventDefault(); event.stopPropagation(); el.removeAttribute("data-pointer-focus"); stopHover();
        if (event.repeat && (event.key === " " || event.key === "Enter")) return;
        if (event.key === "Enter") affection();
        else if (event.key === "Escape") { cancelGuestInput(true); paint(9, 0, "watch"); }
        else if (event.key === " ") {
          if (guestKeyboardHeld && overlayPerch) dropGuest({ x: overlayPerch.x, y: overlayPerch.y - size * overlayPerch.scale / 2 }, Boolean(guestKeyboardOrigin && Math.hypot(overlayPerch.x - guestKeyboardOrigin.x, overlayPerch.y - guestKeyboardOrigin.y) > 6));
          else if (overlayPerch) { const shown = displayedPoint(); perchAnimation?.cancel(); overlayPerch = { ...shown, overlap: overlayPerch.overlap }; guestKeyboardOrigin = { ...overlayPerch }; guestKeyboardBounds = (hiding?.sheet ?? extractedFrom)?.getBoundingClientRect(); guestKeyboardHeld = true; grip = { x: size / 2, y: size / 2 }; style(inertiaLayer, "transform-origin", `${grip.x}px ${grip.y}px`); paint(8, 0, "held"); }
        } else if (guestKeyboardHeld && overlayPerch) {
          const point = { x: overlayPerch.x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), y: overlayPerch.y - size * overlayPerch.scale / 2 + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0) };
          const scale = companionGuestExtractionScale(guestKeyboardOrigin?.scale ?? overlayPerch.scale, point, guestKeyboardBounds, size, reduced || gfxMode() === "off"), scaled = size * scale;
          overlayPerch = { ...overlayPerch, scale, x: clamp(point.x, scaled / 2 + 4, innerWidth - scaled / 2 - 4), y: clamp(point.y + scaled / 2, scaled + 4, innerHeight - 4) };
          paint(8, 0, "held");
        }
        wakeGuest(); return;
      }
      if (hiding) return;
      el.removeAttribute("data-pointer-focus");
      if (pause || overlayActive) return;
      const owns = event.key === "Escape" || event.key === "Enter" && preferences.petting || (event.key === " " || event.key.toLowerCase() === "p") && preferences.drag || event.key.toLowerCase() === "n" && preferences.sleep || keyboardHeld && event.key.startsWith("Arrow");
      if (owns) { radioInbox.clear(); instrumentInbox.clear(); }
      if (owns) { event.preventDefault(); event.stopPropagation(); }
      if (owns) { interruptReturn(); homeDeparture = undefined; }
      if (owns) stopHover();
      if (owns) { presence.focus(document.hasFocus(), performance.now(), true); data("presence", presence.phase); }
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      if (event.key === "Enter" && preferences.petting) { event.preventDefault(); affection(); }
      else if (event.key.toLowerCase() === "p" && preferences.drag && !event.repeat) control.current?.place();
      else if (event.key.toLowerCase() === "n" && preferences.sleep && !event.repeat) { control.current?.rest(); logActivity("ui.click", { target: "companion-rest" }); }
      else if (event.key === " " && preferences.drag) { event.preventDefault(); cancelHomeJourney(); awaitingAtX = false; pendingMonth = false; if (!keyboardHeld && action?.accessory) y -= sampleCompanionAccessoryMotion(action.accessory, performance.now() - began).bodyLift; if (!keyboardHeld && action?.radio) y += sampleWorldMusic(action.radio, performance.now() - began).bob; clearAction(); supportMotion.reset(); keyboardHeld = !keyboardHeld; if (keyboardHeld) playCompanionSound("lift", preferencesRef.current); else { settle({ x, y }); if (keyboardMoved) transferred(); } keyboardMoved = false; }
      else if (event.key === "Escape") { event.preventDefault(); const moved = keyboardHeld && keyboardMoved; pendingMonth = false; keyboardHeld = false; keyboardMoved = false; placing = false; delete el.dataset.placing; settle({ x, y }); if (moved) transferred(); }
      else if (keyboardHeld && event.key.startsWith("Arrow")) { event.preventDefault(); const previous = { x, y }; x = clamp(x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), size + 8, innerHeight - 12); keyboardMoved ||= x !== previous.x || y !== previous.y; }
      if (owns) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastPaint = performance.now(); schedule(); }
    };
    const keyboardModality = () => { pendingHomeRecall = undefined; el.removeAttribute("data-pointer-focus"); };
    const place = (event: PointerEvent) => {
      pendingHomeRecall = undefined;
      if (premiereActive || premiereBounce) return;
      if (!el.contains(event.target as Node)) stopHover();
      if (!pause && overlayActive && overlayPlacing && !el.contains(event.target as Node)) {
        overlayPlacing = false; delete el.dataset.placing;
        // A two-tap alternative to dragging; ordinary dialog controls always
        // retain their own input and never become accidental placement sites.
        const target = event.target instanceof Element ? event.target : null;
        const roleControl = target?.closest("[role='button']");
        // Studio paper cells carry a selection role, but explicit placement
        // owns that gesture just as it does viewer calendar paper. Nested
        // native controls still retain their input before this role exception.
        if (target?.closest("button,a,input,select,textarea")
          || roleControl && !roleControl.matches(".public-day,.agenda-day,.studio-day")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        consumePlacementClick = true; placementPointer = event.pointerId; clearTimeout(clickGuard);
        // Ordinary windows never borrow a display-only guest perch. This
        // explicit two-tap alternative commits the same world point/drop as
        // moving an exposed sleeper by hand; closing the window keeps it.
        perchAnimation?.cancel(); overlayPerch = undefined;
        x = clamp(event.clientX, size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(event.clientY, size + 8, innerHeight - 12);
        clearAction(); settle({ x, y });
        transferred();
        cancelAnimationFrame(raf); clearTimeout(timer);
        lastTick = lastNeeds = lastPaint = performance.now(); if (!finishParkedDrop()) schedule(); return;
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
    const click = (event: MouseEvent) => {
      // A completed placement owns its synthetic click before document-level
      // activity collection or a card's independent restore/open gesture.
      if (consumePlacementClick) {
        event.preventDefault(); event.stopImmediatePropagation(); consumePlacementClick = false; placementPointer = null; clearTimeout(clickGuard); return;
      }
      if (cardPlay.restore(event.target)) logActivity("ui.click", { target: "companion-card-restore" });
    };
    const sensePointer = (event: PointerEvent) => {
      if (premiereActive || premiereBounce) return;
      if (!pause && (!overlayActive || isDetailGuest()) && event.pointerType !== "touch") {
        if (!overlayActive) {
          if (event.buttons !== 0 || isOtherControl(event.target)) pointer = pointerAnchor = undefined;
          else {
            const point = { x: event.clientX, y: event.clientY };
            if (!pointerAnchor || Math.hypot(point.x - pointerAnchor.x, point.y - pointerAnchor.y) > 12) { pointerAnchor = point; pointerStableSince = performance.now(); }
            pointer = point;
          }
        }
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
    const applyGeometry = (next: Platform[], validationOnly = false) => {
      if (premiereActive || hiding || overlayActive && !needsOverlayWorldSeed()) return;
      // Drag-source text is intentionally hidden by the editor. That brief
      // presentation is not deletion of the occupied ledge. Keep the last
      // physical snapshot until the existing editor gesture has ended.
      if (workspaceBusyRef.current) { refreshAnchors(performance.now(), false, true); return; }
      const geometryAt = performance.now();
      if (!validationOnly) followUntil = Math.max(followUntil, geometryAt + FLIP_MS);
      premiereAwaitingGeometry = false;
      viewportRecovery.observe({ width: innerWidth, height: innerHeight });
      geometryReady = true;
      if (returning) returnTargetValid = false;
      refreshAnchors(geometryAt, false, true);
      // This delivery publishes new absolute positions for every ledge. Carry
      // the occupied pair once above, then retire every old anchor baseline:
      // revisiting an earlier goal must not add its old reflow delta twice.
      anchorSeen.clear();
      // A full scan revalidates safe spans; scrolling itself was already
      // carried per-frame by its actual anchor, including nested/fixed panels.
      platforms = next.filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      landingPlatforms = [...(geometryTracker?.landings() ?? [])].filter(p => p.y >= size + 8 && p.y <= innerHeight - 12);
      const viewportChanged = viewportRecovery.take({ validationOnly, hasSafePlatforms: platforms.length > 0, inputOwned: Boolean(pressed || keyboardHeld || placing) });
      measureBed();
      food.current?.sync(platforms, id => geometryTracker?.anchor(id), geometryTracker?.landings(32));
      if (homeJourney && !platforms.some(p => p.id === "companion-home")) {
        if (!openHomeRecallTarget()) {
          cancelHomeJourney(); clearAction();
          // A genuinely closed room is no longer a destination. A transient
          // safe-span miss keeps the command and waits for real geometry.
          if (!supportedNow()) settle({ x, y }, true);
          nextDecision = geometryAt + 1000;
        } else waitForHomeGeometry();
      }
      if (premiereExit && premiereMemory.current.consumedExit === premiereExit.token) {
        const exit = premiereExit, cue = premiereRef.current.cue, now = performance.now();
        premiereExit = undefined;
        const released = cue?.generation === exit.generation ? cue.items.filter(item => item.state === "released").map(item => item.id) : [];
        const ids = [premiereMemory.current.entryId, exit.id, ...released].filter((id, index, values) => released.includes(id) && values.indexOf(id) === index);
        const card = premiereCard(ids, false);
        const cardSupports = card ? landingPlatforms.filter(platform => geometryTracker?.anchor(platform.id)?.element === card.element) : [];
        const target = (card ? nearestPlatform(card.point, cardSupports) ?? firstCompanionSupportBelow(card.point, landingPlatforms) : undefined)
          ?? nearestVerticalCompanionSupport({ x, y }, platforms) ?? nearestPlatform({ x, y }, platforms);
        clearAction(); afterPetLanding = restAfterLanding = false; pendingMonth = false; awaitingAtX = target ? false : "vertical";
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
        const contact = firstCompanionSupportBelow(point, landingPlatforms) ?? companionViewportFloorAbove(point, landingPlatforms);
        const recovery = contact ? undefined : recoverCompanionDropAtViewportFloor(point, landingPlatforms);
        const target = contact ?? recovery?.platform;
        clearAction(); afterPetLanding = restAfterLanding = false; needsLanding = false; supportMotion.reset();
        x = recovery?.x ?? point.x; y = target?.y ?? point.y; support = target?.id ?? ""; awaitingAtX = target ? false : "drop";
        returnTargetValid = Boolean(target); nextDecision = performance.now() + FLIP_MS + 600;
        // Taking a found guest outside is the same deliberate release. A
        // failed display bridge must not time out into passive date recovery.
        if (!target) { returning = undefined; el.removeAttribute("data-returning"); data("platform", ""); hideBed(); stopHover(); el.hidden = true; }
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
              if (!stopped && !pause && pendingPosition.current && !premiereActive && (!overlayActive || needsOverlayWorldSeed()) && !hiding) {
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
          if (presence.phase === "parked" && (geometryAt >= followUntil || !followRaf)) { offGeometry?.(); offGeometry = undefined; geometryReady = false; }
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
            if (presence.phase === "parked" && (geometryAt >= followUntil || !followRaf)) { offGeometry?.(); offGeometry = undefined; geometryReady = false; }
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
        const retainedCandidate = supportById(support);
        // A floor fragment can keep its id while safe clipping moves its
        // edge. Returning must obey the same original escape budget too.
        const retainedX = retainedCandidate ? clamp(x, retainedCandidate.x, retainedCandidate.x + retainedCandidate.width) : x;
        const retained = retainedCandidate && (verticalRecoveryX === undefined || retainedCandidate.kind !== "floor"
          || retainedX >= verticalRecoveryX - size * .76 && retainedX <= verticalRecoveryX + size * .76) ? retainedCandidate : undefined;
        const vertical = retained ? undefined : recoverCompanionVerticalSupport({ x, y }, platforms, landingPlatforms);
        const escape = !retained && !vertical ? recoverCompanionPassiveFloor({ x, y }, landingPlatforms, size, verticalRecoveryX ??= x) : undefined;
        const p = retained
          ?? vertical
          ?? escape?.platform
          ?? (viewportChanged || !worldSeeded ? nearestPlatform({ x, y }, platforms) : undefined);
        awaitingAtX = p ? false : "vertical";
        if (p) { x = escape?.x ?? (retained || vertical ? clamp(x, p.x, p.x + p.width) : platformLandingX(p, x)); y = p.y; support = p.id; returnTargetValid = true; }
        refreshAnchors(performance.now());
        return;
      }
      if (presence.phase === "parked" && !homeDeparture && !action) {
        if (awaitingAtX === "drop" && !viewportChanged) {
          // A quiet layout delivery cannot convert failed first-contact intent
          // into a higher date perch. Retry the original first-contact rule
          // only against this fresh event's geometry, then sleep after landing.
          clearTimeout(parkedLayoutTimer); settle({ x, y });
          if (awaitingAtX) waitForSupport();
          else if (action) { lastTick = lastPaint = geometryAt; schedule(); }
          else { paint(11, 0, "sleep"); el.dataset.dreaming = ""; offGeometry?.(); offGeometry = undefined; geometryReady = false; }
          return;
        }
        const old = resolve(support, { x, y });
        const p = old ?? recoverCompanionVerticalSupport({ x, y }, platforms, landingPlatforms) ?? (viewportChanged ? nearestPlatform({ x, y }, platforms) : undefined);
        clearAction();
        awaitingAtX = p ? false : "vertical";
        clearTimeout(parkedLayoutTimer);
        if (!p) {
          settle({ x, y }, false, true);
          if (awaitingAtX) waitForSupport();
          else if (action) { lastTick = lastPaint = geometryAt; schedule(); }
          else { paint(11, 0, "sleep"); el.dataset.dreaming = ""; }
          return;
        }
        clearSupportWait();
        if (!old && !viewportChanged && Math.abs(p.y - y) > .5) {
          // An unsupported quiet sleeper gets the same finite gravity landing,
          // then returns to CSS-only sleep instead of jumping to a new date.
          settle({ x, y }, false, true); lastTick = lastPaint = geometryAt; schedule(); return;
        }
        support = p.id; if (viewportChanged) x = platformLandingX(p, x); y = p.y; paint(11, 0, "sleep"); el.dataset.dreaming = "";
        offGeometry?.(); offGeometry = undefined; geometryReady = false;
        return;
      }
      // A clipped support is not a request to visit another column. Keep the
      // same x while waiting for a real ledge there. Actual viewport shrink
      // can put that ray wholly outside/below the new world, so only resize
      // uses the nearest safe span and its clamped landing coordinate.
      if (awaitingAtX && !pressed && !keyboardHeld && !placing) {
        if (awaitingAtX === "drop" && !viewportChanged) settle({ x, y });
        else settle({ x, y }, viewportChanged, !viewportChanged);
        if (awaitingAtX) return;
      }
      if (!support && !action && !pressed && !keyboardHeld && !placing && !afterPetLanding) {
        const p = nearestPlatform({ x, y: saved?.y ?? innerHeight * .65 }, saved ? platforms : platforms.filter(p => p.kind !== "floor")) ?? platforms[0];
        if (p) { x = platformLandingX(p, x); y = p.y; support = p.id; }
      } else if (!pressed && !keyboardHeld && !placing && !afterPetLanding && !flight) {
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
          clearAction(Boolean(jumpRecoveryContext)); settle({ x, y }, viewportChanged, !viewportChanged);
        } else if (!action && p) { verticalRecoveryX = undefined; y = p.y; }
      }
      // Seed current baselines after span identity remapping, not with span.x:
      // clipping can move that x without the underlying text moving at all.
      refreshAnchors(performance.now());
    };
    const onGeometry = (next: Platform[], validationOnly = false) => {
      const wasWaiting = waitingForSupport;
      const seedingOverlay = needsOverlayWorldSeed();
      const resumeHome = Boolean(homeJourney && homeWaitingGeometry && !premiereActive && !overlayActive && !hiding && !workspaceBusyRef.current);
      if (resumeHome) { homeWaitingGeometry = false; el.removeAttribute("data-home-waiting"); el.removeAttribute("data-home-wait-pose"); }
      applyGeometry(next, validationOnly);
      // A nonempty scan may still be waiting for an existing panel intro to
      // finish before restoring staff handoff coordinates. Neither that scan
      // nor an empty visibility snapshot completes the initial world seed.
      initialGeometryMeasured ||= !pendingPosition.current && !pendingMonth && Boolean(supportById(support));
      if (seedingOverlay && initialGeometryMeasured && overlayActive) {
        // The actual ledge, including an empty calendar's real viewport floor,
        // owns visibility. Then return to the ordinary window's quiet lifetime.
        paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        offGeometry?.(); offGeometry = undefined; geometryReady = false;
      }
      if (!stopped && !pause && !overlayActive && !hiding && !premiereActive && !pendingPosition.current && !pendingMonth && !pressed && !keyboardHeld && !placing && !isHomeSupport(support)) {
        if (awaitingAtX || !platforms.length && !supportById(support) && !action) waitForSupport();
        else if (wasWaiting) {
          clearSupportWait(); cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastCare = lastPaint = performance.now();
          if (presence.phase === "parked" && !action) { paint(11, 0, "sleep"); el.dataset.dreaming = ""; }
          else schedule();
        }
      }
      const requestedHome = pendingHomeRecall;
      pendingHomeRecall = undefined;
      if (requestedHome && !stopped && !pause && !overlayActive && !overlayRef.current && !premiereActive && !hiding && !pressed && !keyboardHeld && !placing && !workspaceBusyRef.current && requestedHome === openHomeRecallTarget()) recallHome(false);
      if (resumeHome && !homeWaitingGeometry && !stopped && !pause && !overlayActive) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); nextDecision = lastTick; schedule(); }
    };
    const connectGeometry = () => {
      if (!premiereActive && !hiding && (!overlayActive || needsOverlayWorldSeed()) && !offGeometry) {
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
      if (workspaceBusyRef.current) { radioInbox.clear(); instrumentInbox.clear(); if (action?.radio) clearAction(); cancelEpisode(); stopHover(); cardPlay.clear(); return; }
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
        queueSituation("hide-found", [15]);
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
    document.addEventListener("visibilitychange", sync); document.addEventListener("pointerdown", place, true); window.addEventListener("click", click, true);
    const radioChanged = () => {
      radioState = getCompanionRadioSnapshot();
      if (action?.radio && (action.radio.instrument ? radioState.playing || !musicAllowed() : !radioState.playing || action.radio.generation !== radioState.generation || !radioAllowed())) { clearAction(); nextDecision = performance.now() + 60; }
      radioInbox.offer(radioState, performance.now(), radioAllowed());
      if (!stopped && radioAllowed()) { cancelAnimationFrame(raf); clearTimeout(timer); schedule(); }
    };
    const radioPreferencesChanged = () => {
      radioPreferences = getCompanionRadioPreferences();
      if (!radioAllowed()) { radioInbox.clear(); if (action?.radio && !(action.radio.instrument ? musicAllowed() : radioAllowed())) { clearAction(); nextDecision = performance.now() + 60; } }
      if (!musicAllowed()) instrumentInbox.clear();
      if (!stopped && !pause && presence.phase === "active") { cancelAnimationFrame(raf); clearTimeout(timer); schedule(); }
    };
    const offRadio = subscribeCompanionRadio(radioChanged), offRadioPreferences = subscribeCompanionRadioPreferences(radioPreferencesChanged);
    const instrumentPlayed = (event: Event) => {
      const now = performance.now();
      instrumentInbox.offer((event as CustomEvent<CompanionInstrumentPulse>).detail, now, musicAllowed() && !radioState.playing);
      if (action?.radio?.instrument) {
        const played = instrumentInbox.take(now);
        if (played) {
          const reaction = getCompanionInstrumentReaction({ mood: played.pulse.mood, quality: played.quality, preferences: effective, life: brain.current.life, energy: brain.current.energy });
          if (reaction === "ignore") { clearAction(); nextDecision = now + 100; }
          else { action.radio.instrument = reaction; (reaction === "tease" ? [28] : reaction === "encourage" ? [29] : [1, 9]).forEach(row => spriteSources[row].forEach(src => requestSprite.current(src))); }
        }
      }
      if (!stopped && musicAllowed() && !radioState.playing) { cancelAnimationFrame(raf); clearTimeout(timer); schedule(); }
    };
    window.addEventListener(COMPANION_INSTRUMENT_EVENT, instrumentPlayed);
    const instrumentSoundChanged = () => {
      instrumentAudible = soundEnabled() && soundVolume() > 0;
      if (!instrumentAudible) { instrumentInbox.clear(); if (action?.radio?.instrument) { clearAction(); nextDecision = performance.now() + 60; if (!stopped && !pause) schedule(); } }
    };
    const instrumentSoundStored = (event: StorageEvent) => { if (event.key === null || event.key === "vic.sound" || event.key === "vic.soundVol") instrumentSoundChanged(); };
    window.addEventListener("vic:sound", instrumentSoundChanged); window.addEventListener("storage", instrumentSoundStored);
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
    // Initial/back navigation may already be inside the rail's CSS entrance.
    // Geometry invalidation granted its FLIP lease; run that existing finite
    // follower once instead of leaving an idle14Hz body/front behind the rail.
    followLayout();
    return () => {
      offHabits();
      offLife();
      offRadio(); offRadioPreferences(); radioInbox.clear(); instrumentInbox.clear(); window.removeEventListener(COMPANION_INSTRUMENT_EVENT, instrumentPlayed);
      window.removeEventListener("vic:sound", instrumentSoundChanged); window.removeEventListener("storage", instrumentSoundStored);
      refreshWardrobe.current = () => {}; situationSink.current = () => {}; pendingSituations.clear(); wardrobePainter?.clear();
      lastPose.current = { x, y, monthKey, seeded: worldSeeded || Boolean(supportById(support)), atHome: isHomeSupport(support) && (homeOccluded || supportedNow()) && !pressed && !keyboardHeld && action?.kind !== "jump" && !playFalling, homeSupportId: isHomeSupport(support) ? support : undefined };
      if (capturePosition.current === captureForSurface) capturePosition.current = null;
      persistCare(true);
      stopped = true; clearSupportWait(); cancelTravelGoal(); cancelHomeJourney(); clearTimeout(preludeTimer); homeDeparture = undefined; el.removeAttribute("data-home-window"); resetHide(); resetInertia(); returning = undefined; premiereDisplay = undefined; premiereBounce = undefined; premiereExit = undefined; el.inert = false; el.removeAttribute("aria-hidden"); el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); el.removeAttribute("data-returning"); stopHover(); cancelAnimationFrame(followRaf); geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearTimeout(parkedLayoutTimer); clearAction(); control.current = null; observer.disconnect(); offGeometry?.(); hearts.dispose();
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
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); window.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      document.removeEventListener("pointermove", sensePointer);
      document.removeEventListener("pointerout", outsideDocument);
      document.removeEventListener("keydown", keyboardModality, true);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerleave", leave); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("lostpointercapture", lostCapture); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
      hideBed();
    };
  }, [ready, root, worldPreferencesKey, blocked, agenda, monthKey, reduced, geometryIdentity, positionMemory]);

  if (!ready) return null;
  const closeHome = homeShelf.close;
  const unwrapGift = () => {
    if (!preferences.enabled || blocked || overlayOpen || performanceActive) return;
    const received = openCompanionGift();
    if (!received) return;
    logActivity("ui.click", { target: "companion-gift-open" });
    setOpenedGift(received); hapticSuccess(); playCompanionSound("gift", preferencesRef.current);
    setAnnouncement(`${COMPANION_ACCESSORY_NAMES[received]} 선물을 받았어요. 프로필의 꾸미기에서 장착할 수 있어요.`);
    actor.current?.focus({ preventScroll: true });
  };
  const act = (kind: CompanionHomeAction) => { if (kind === "book") { onOpenBook(); return; } control.current?.[kind](); };
  const performanceActive = Boolean(premiereCue?.generation && premiereCue.phase !== "idle" && (premiereCue.phase === "return" || premiereCue.target - syncedNow() <= 166000));
  const house = <CompanionHome care={care} preferences={preferences} inactive={overlayOpen || performanceActive} owner={premiereCue?.owner} unreadCollection={unreadCollection} radioPlaying={radioPlaying} onAction={act} onClose={homeVisible ? undefined : closeHome} />;
  return createPortal(<>
    {firstTaste && preferences.enabled && !blocked && !overlayOpen && <span className="vc-first-taste" ref={tasteStamp} aria-hidden="true"><CompanionCollectionArt kind="food-stamp" id={firstTaste.kind} /></span>}
    <div className="vc-companion" ref={body} hidden data-sfx="off" data-size="large" data-overlay={overlayOpen ? "quiet" : undefined} data-workspace-busy={workspaceBusy ? "" : undefined}>
    <span className="vc-contact-shadow" ref={shadow} aria-hidden="true" />
    <button id={actorId} className="vc-actor" ref={actor} type="button" tabIndex={overlayOpen ? -1 : 0} data-sfx="off" data-activity-manual="" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space P N ArrowUp ArrowDown ArrowLeft ArrowRight Escape" onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); }}>
      <span className="vc-inertia" ref={inertia} aria-hidden="true"><span className="vc-facing" ref={facing}><span className="vc-reaction" ref={reaction}><span className="vc-contact" ref={contact}><span className="vc-pose" ref={pose}>
        <span className="vc-wearable vc-wearable-back" ref={accessoryBack} hidden />
        <span className="vc-sprite" ref={sprite} />
        <span className="vc-wearable vc-wearable-front" ref={accessoryFront} hidden />
        <span className="vc-wearable vc-gift-prop" ref={giftProp} hidden />
      </span></span></span></span></span>
      <span className="vc-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>
    </button>
    {pendingGift && <button className="vc-gift-open" ref={giftButton} hidden type="button" aria-label="빅타민이 가져온 선물 열기" title="선물 열기" data-activity-manual="" data-sfx="off" disabled={blocked || overlayOpen || performanceActive} tabIndex={overlayOpen || performanceActive ? -1 : 0} onPointerDown={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); unwrapGift(); }} />}
    <span className="vc-effect" ref={effect} aria-hidden="true" />
    <span className="vc-affection-hearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></span>
    <span className="vc-petting-hand" ref={pettingHand} aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M10 26c-3-3-5-6-6-9-1-2 1-4 3-2l3 3-1-9c0-3 3-4 4-1l1 6V6c0-3 4-3 4 0v8l1-6c1-3 4-2 4 1l-1 8 2-3c2-2 4 0 2 3l-4 7c-1 2-3 4-6 4h-3Z"/><path className="vc-hand-fold" d="M11 21c2-2 5-2 7 0"/><path className="vc-hand-cuff" d="M10 27h11v4H10Z"/></svg></span>
    <span className="sr-only" id="vc-help">빅타민의 몸 위에서 마우스를 좌우로 움직여 쓰다듬기. 짧게 누르면 톡 치기. 끌어서 옮기기. Enter 쓰다듬기. 스페이스로 집고 방향키로 옮긴 뒤 스페이스나 Escape로 놓기. P로 위치 선택. N으로 낮잠.</span>
    <span className="sr-only" role="status">{announcement}</span>
  </div>
    {openedGift && preferences.enabled && !blocked && !overlayOpen && !performanceActive && <aside className="vc-keepsake-notice" aria-label="받은 선물">
      <div className="vc-keepsake-art"><CompanionCollectionArt kind="gift" id="gift-open" /><CompanionCollectionArt kind="accessory" id={openedGift} /></div>
      <div><strong>{COMPANION_ACCESSORY_NAMES[openedGift]} 선물!</strong><button className="button" type="button" data-sfx="off" data-act="companion-accessory-equip" data-act-opt="on" onClick={() => { if (equipCompanionAccessory(openedGift)) { hapticSuccess(); playCompanionSound("equip", preferencesRef.current); setOpenedGift(null); actor.current?.focus({ preventScroll: true }); } }}>착용하기</button></div>
      <button className="vc-keepsake-close" type="button" aria-label="받은 선물 닫기" data-act="companion-gift-dismiss" onClick={() => { setOpenedGift(null); actor.current?.focus({ preventScroll: true }); }}><X size={17} aria-hidden="true" /></button>
    </aside>}
    <div className="vc-bed-foreground" ref={bedForeground} hidden aria-hidden="true"><CompanionBedForeground /></div><CompanionFood ref={food} enabled={preferences.feeding} blocked={blocked || overlayOpen} monthKey={monthKey} onLanded={() => { playCompanionSound("land", preferencesRef.current); }} returnFocus={() => { if (!overlayRef.current && !body.current?.hidden) actor.current?.focus({ preventScroll: true }); }} />
    {!suspended && !blocked && homeVisible && homeHost ? createPortal(house, homeHost) : null}
    {compactActive && launcherHost ? createPortal(<button ref={homeLauncher} data-act={homeExpanded ? "companion-home-close" : "companion-home-open"} data-home-action="launcher" type="button" className="button vc-home-launcher" aria-label={homeExpanded ? "빅타민 집 닫기" : "빅타민 집 열기"} aria-expanded={homeExpanded} aria-controls={`${actorId}-home`} data-companion-home-owner={premiereCue?.owner} data-pm-exit="5" inert={overlayOpen || performanceActive ? true : undefined} aria-hidden={overlayOpen || performanceActive ? true : undefined} onClick={() => homeExpanded ? closeHome() : homeShelf.open()} onKeyDown={event => { if (event.key === "Escape" && homeExpanded) { event.preventDefault(); event.stopPropagation(); logActivity("ui.click", { target: "companion-home-close" }); closeHome(); } }}><Home size={16} aria-hidden="true" /><span className="lbl vc-home-launcher-label">빅타민 집</span></button>, launcherHost) : null}
    {compactActive && compactHost ? createPortal(<div id={`${actorId}-home`} className="vc-compact-home" ref={compactHome} hidden={!homeExpanded} data-companion-home-owner={premiereCue?.owner} data-pm-exit="5" inert={overlayOpen || performanceActive ? true : undefined} aria-hidden={overlayOpen || performanceActive ? true : undefined} data-sfx="off" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (homeExpanded) logActivity("ui.click", { target: "companion-home-close" }); closeHome(); } }}>
      {homeExpanded ? house : null}
    </div>, document.body) : null}
  </>, document.body);
}
