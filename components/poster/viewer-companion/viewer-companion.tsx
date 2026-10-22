"use client";

import { createCompanionPoseWitness } from "@/lib/ui/viewer-companion/memory-witness";
import { recordCompanionObservedExpression, recordCompanionObservedPose, recordCompanionCompletedActivity } from "@/lib/ui/viewer-companion/collection";
import { companionActivityMemory } from "@/lib/ui/viewer-companion/memory-catalog";
import { createCompanionExpressions } from "@/lib/ui/viewer-companion/expressions";
import { createCompanionExpressionPainter, COMPANION_EXPRESSION_REFERENCE_SRC } from "@/lib/ui/viewer-companion/expression-painter";

import { companionWorkExpressionsFor, companionWorkExpressionPose, type CompanionWorkExpressionOffer } from "@/lib/ui/viewer-companion/work-expression";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { sampleCompanionCheer } from "@/lib/ui/viewer-companion/cheer";
import { companionToyPlayDuration, sampleCompanionToyPlay } from "@/lib/ui/viewer-companion/toy-play";
import type { CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { createCompanionFoodAftertaste, sampleCompanionFoodAftertaste, type CompanionFoodAftertaste } from "@/lib/ui/viewer-companion/food-aftertaste";
import dynamic from "next/dynamic";
import { soundEnabled, soundVolume } from "@/lib/ui/sfx";
import { Home, X } from "lucide-react";
import { logActivity } from "@/lib/activity/client";
import { COMPANION_CLIP_TIMING, COMPANION_PLAY_TIMING, COMPANION_TIMING, COMPANION_THROW_ROW, companionPlayDuration } from "@/lib/ui/viewer-companion/timing";
import { getCompanionArrivalPlay } from "@/lib/ui/viewer-companion/arrival-play";
import { companionRunTripContact, companionToyTripExperience, planCompanionRomp, sampleCompanionRunUp, validCompanionRunHop, type CompanionRunTrip, type CompanionToyTripWitness } from "@/lib/ui/viewer-companion/romp";
import { cancelCompanionEpisode, companionEpisodeHopAvailable, companionEpisodeMishap, companionEpisodeRunHop, companionEpisodeRunTrip, companionRollProgress } from "@/lib/ui/viewer-companion/episodes";
import { companionAttentionPoint, deliberateCompanionAction } from "@/lib/ui/viewer-companion/deliberation";
import { companionExpressionFoodId } from "@/lib/ui/viewer-companion/expression-food-context";
import { advanceBrain, cancelCompanionTravelGoal, commitAction, createBrain, getAction, getFoodAction, getCompanionMood, nearestPlatform, platformLandingX, recordCompanionEvent, type CompanionAction, type CompanionPlay, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, nextCompanionPersonalityScene, type PersonalitySceneBeat, type PersonalityHome, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionRoutineArbiter, type CompanionRoutineEffect } from "@/lib/ui/viewer-companion/routine-arbiter";
import { createCompanionPublicLife } from "@/lib/ui/viewer-companion/public-life";
import { createCompanionAgentExperience, type CompanionExperienceEffect, type CompanionExperienceFamily } from "@/lib/ui/viewer-companion/agent-experience";
import { COMPANION_AGENT_EXPERIENCE_KEY, createCompanionAgentExperienceStore, reconcileCompanionAgentExperienceGeneration, sameCompanionAgentGeneration } from "@/lib/ui/viewer-companion/agent-experience-store";
import { createCompanionPersonalityJobs, getCompanionPersonalityMeal } from "@/lib/ui/viewer-companion/personality-jobs";
import { canCompanionSetHomeTv, companionHomeTvControl, getCompanionHomeTv, setCompanionHomeTv } from "@/lib/ui/viewer-companion/home-room-media";
import { canCompanionSetHomeLight, getCompanionHomeLight, getServerCompanionHomeLight, setCompanionHomeLight, subscribeCompanionHomeLight } from "@/lib/ui/viewer-companion/home-light";
import { companionRoomLighting } from "@/lib/ui/viewer-companion/room-lighting";
import { companionHomeLifePhaseFor, createCompanionHomeLifePolicy, planCompanionHomeLifeControl, type CompanionHomeLifeAction, type CompanionHomeLifePhase } from "@/lib/ui/viewer-companion/home-life-policy";
import { canCompanionSetCurtain, getCompanionCurtainChoice, setCompanionCurtainChoice, subscribeCompanionCurtainChoice } from "@/lib/ui/viewer-companion/home-curtain-control";
import { companionHomeCordTouches, companionHomeOpeningContact, companionHomeResidentFloor, companionRoomBodyLight, COMPANION_WASH_SUPPORT, sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";
import { COMPANION_THROW_LIMITS, createCompanionThrow, createCompanionThrowVelocity, stepCompanionThrow, type CompanionThrowState, type CompanionThrowVelocity } from "@/lib/ui/viewer-companion/throw";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionWorldPreferencesKey } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionGeometryIdentity, isCompanionPanelFloor, observeCompanionPlatforms, type CompanionGeometrySubscription } from "@/lib/ui/viewer-companion/geometry";
import { companionLayoutMotionMs, companionSupportPointDelta, type CompanionAnchorFrame } from "@/lib/ui/viewer-companion/element-anchor";
import { COMPANION_DETAIL_EVENT, collectCompanionHideTargets, type CompanionDetailNotice, type CompanionHideTarget } from "@/lib/ui/viewer-companion/hide-targets";
import { createCompanionHideSeek } from "@/lib/ui/viewer-companion/hide-seek";
import { findCompanionDetailPerch } from "@/lib/ui/viewer-companion/detail-perch";
import { companionGuestExtractionScale, type CompanionGuestBounds } from "@/lib/ui/viewer-companion/guest-extraction";
import { canParkCompanionHomeWait, companionHomeBlockedResponse, planCompanionHomeReturn } from "@/lib/ui/viewer-companion/home-route";
import { companionPremiereMoment, companionPremiereReturn, COMPANION_PREMIERE_ENTER_MS, type CompanionPremiereCue } from "@/lib/ui/viewer-companion/premiere";
import { sampleCompanionPremiereTravel } from "@/lib/ui/viewer-companion/premiere-travel";
import { syncedNow } from "@/lib/ui/synced-clock";
import { premiereViewportBounds } from "@/lib/ui/premiere/panel-departure";
import { companionSofaDepth, companionSofaRelease, companionSofaResident, type CompanionSofaDepth, type CompanionSofaPoint } from "@/lib/ui/viewer-companion/sofa";
import { projectCompanionSofaBody, projectCompanionSpritePoint } from "@/lib/ui/viewer-companion/sofa-pose";
import { canStartCompanionAccessoryMotion, COMPANION_ACCESSORY_MOTION_MS, isCompanionHat, sampleCompanionAccessoryMotion } from "@/lib/ui/viewer-companion/accessory-motion";
import { playCompanionSound, type CompanionSoundMoment } from "@/lib/ui/viewer-companion/companion-sound";
import { canCompanionSetRadio, getCompanionRadioSnapshot, getCompanionRadioToggleIntent, setCompanionRadioPlaying, stopCompanionRadio, subscribeCompanionRadio, toggleCompanionRadio } from "@/lib/ui/viewer-companion/radio-player";
import { getCompanionRadioPreferences, subscribeCompanionRadioPreferences } from "@/lib/ui/viewer-companion/radio-preferences";
import { canStartCompanionRadioReaction, companionRadioFoodPriority, COMPANION_RADIO_REACTION_MS, createCompanionRadioReactionInbox, getCompanionRadioReaction, sampleCompanionRadioReaction, type CompanionRadioReaction, type CompanionRadioMood } from "@/lib/ui/viewer-companion/radio-reaction";
import { COMPANION_INSTRUMENT_EVENT, type CompanionInstrumentPulse } from "@/lib/ui/viewer-companion/instrument-music";
import { createCompanionInstrumentInbox, getCompanionInstrumentReaction, sampleCompanionInstrumentReaction, type CompanionInstrumentReaction } from "@/lib/ui/viewer-companion/instrument-reaction";
import { companionRunContactSituation, type CompanionSituationId } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_ACCESSORY_NAMES, type CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { advanceCompanionMealWait, projectCompanionMouth } from "@/lib/ui/viewer-companion/mouth";
import { advanceCompanionPlayPresentation, type CompanionPlayPresentation } from "@/lib/ui/viewer-companion/play-presentation";
import { advanceCompanionHomeContactPresentation, companionLampPresentationReady, observeCompanionLampPresentation, type CompanionLampPresentation } from "@/lib/ui/viewer-companion/home-contact-presentation";
import { COMPANION_FEED_RETRY_MS, rememberCompanionOutcomes } from "@/lib/ui/viewer-companion/planner";
import { companionSofaFlightMs, sampleCompanionSofaTravel, type CompanionSofaTravelShape } from "@/lib/ui/viewer-companion/sofa-travel";
import { createCompanionFoodCuriosity } from "@/lib/ui/viewer-companion/novel-food";
import { createCompanionHousehold, type CompanionHouseholdBeat, type CompanionHouseholdHome } from "@/lib/ui/viewer-companion/household";
import { createCompanionViewportRecovery } from "@/lib/ui/viewer-companion/viewport-recovery";
import { companionPositionPoint, resolveCompanionPosition, type CompanionPositionMemory, type CompanionPositionSnapshot } from "@/lib/ui/viewer-companion/position-memory";
import { companionGripProfile } from "@/lib/ui/viewer-companion/contact-grip";
import { companionMaterialScale } from "@/lib/ui/viewer-companion/material-scale";
import { COMPANION_FULL_THRESHOLD, DEFAULT_COMPANION_CARE, loadCompanionCare, saveCompanionCare, subscribeCompanionHabits, subscribeCompanionLife } from "@/lib/ui/viewer-companion/care";
import { learnCompanionHabits, type CompanionExperience } from "@/lib/ui/viewer-companion/habits";
import { experienceCompanionLife, type CompanionLifeExperience } from "@/lib/ui/viewer-companion/life";
import { advanceCompanionCollection, equipCompanionAccessory, flushCompanionCollection, getCompanionUnreadCounts, loadCompanionCollection, observedCompanionBehavior, openCompanionGift, recordCompanionConsumedFood, recordCompanionGiftInteraction, recordCompanionObservedBehavior, recordCompanionObservedSituation, subscribeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { CompanionDiscoveryFlight, type CompanionDiscoveryNotice } from "./companion-discovery-flight";
import { createCompanionHearts } from "@/lib/ui/viewer-companion/hearts";
import { boundCompanionHangingPose, createCompanionMotion, nextCompanionPaint, sampleCompanionTravel } from "@/lib/ui/viewer-companion/motion";
import { companionPresenceActive, createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { createCompanionScenes, type CompanionSceneAction, type CompanionSceneEvent } from "@/lib/ui/viewer-companion/scenes";
import { COMPANION_WORK_SIGNAL, validCompanionWorkSignal } from "@/lib/ui/viewer-companion/work-signals";
import { createCompanionSceneStore } from "@/lib/ui/viewer-companion/scene-memory";
import { COMPANION_SCENE_SIGNAL, emitCompanionWardrobePreference, validCompanionSceneSignal } from "@/lib/ui/viewer-companion/scene-signals";
import { accessibleCompanionToys, findCompanionToyRoute, companionToyFoodPriority, createCompanionToyPlanner, type CompanionToyAction } from "@/lib/ui/viewer-companion/toys";
import { companionToyReturnDelivered, companionToyReturnTarget, planCompanionToyBoxApproach, sampleCompanionToyReturn, validCompanionToyBoxApproach } from "@/lib/ui/viewer-companion/toy-return";
import { companionFoodDisposalDelivered, companionFoodDisposalTarget, sampleCompanionFoodDisposal } from "@/lib/ui/viewer-companion/food-disposal";
import { createCompanionFeedCommands, type CompanionFeedCommand } from "@/lib/ui/viewer-companion/feed-command";
import { boundCompanionStationaryProgress, companionLifePurpose, createCompanionPersonalityActivity, preflightCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { advanceCompanionTastes, summarizeCompanionToyTastes, companionToyUnread, loadCompanionTastes, recordCompanionFoodTasteOutcome, recordCompanionToyExperience, shouldDeclineCompanionFood, subscribeCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { evaluateCompanionFoodTaste, type CompanionFoodTasteOutcome } from "@/lib/ui/viewer-companion/taste-reasons";
import { createCompanionReactiveCues } from "@/lib/ui/viewer-companion/reactive-cues";
import { resolveCompanionHomeEnvironment, type CompanionHomeEnvironmentContext } from "@/lib/ui/viewer-companion/home-environment";
import { companionHomeRest, INITIAL_COMPANION_HOME_CURTAIN, reduceCompanionHomeCurtain } from "@/lib/ui/viewer-companion/home-curtain";
import { placeCompanionOverlayPerch, type CompanionOverlayPerch } from "@/lib/ui/viewer-companion/overlay-perch";
import { createCompanionOverlayReturn, type CompanionReturnPoint } from "@/lib/ui/viewer-companion/overlay-return";
import { FLIP_MS } from "@/lib/ui/flip-motion";
import { hasAmbientPauseOutside } from "@/lib/ui/ambient-pause";
import { createCompanionSupportMotion } from "@/lib/ui/viewer-companion/support-motion";
import { boundCompanionHeldPose, createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";
import { createCompanionHeldShake } from "@/lib/ui/viewer-companion/held-shake";
import { captureCompanionRestartSupport, companionRestartPaintPending, deferCompanionRestartSupport, companionViewportFloorAbove, companionWorldHiddenReason, firstCompanionSupportBelow, nearestVerticalCompanionSupport, recoverCompanionDropAtViewportFloor, recoverCompanionPassiveFloor, recoverCompanionVerticalSupport, resolveCompanionRestartSupport, type CompanionRestartSupport } from "@/lib/ui/viewer-companion/support-landing";
import { boundCompanionBallisticArc, boundCompanionSineArc, companionBallisticArcIsSafe } from "@/lib/ui/viewer-companion/jump-arc";
import { companionPettingResponse, createCompanionPettingContact, createCompanionPettingGesture, createCompanionPettingWindow } from "@/lib/ui/viewer-companion/petting";
import { companionMayAddressAudience, companionOutsideSupport } from "@/lib/ui/viewer-companion/life-space";
import { randomCompanionFood, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { accessibleCompanionFoods } from "@/lib/ui/viewer-companion/food-access";
import { withinCompanionFoodReach } from "@/lib/ui/viewer-companion/food-reach";
import { COMPANION_HOME_FLOOR_INSET, isCompanionHomeFloorFoodSupport } from "@/lib/ui/viewer-companion/food";
import { acquireDecodedCompanionSprite, canDecodeCompanionSprite, companionMotionClips, companionSpriteMetadata as registration, companionSpriteSources, decodeCompanionSprite, isCompanionSpriteDecoded, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionNextPlayRow, companionTapReaction, sampleCompanionCozySleep, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { COMPANION_CARD_PLAY_EVENT, createCompanionCardPlay } from "@/lib/ui/viewer-companion/card-play";
import { requestCompanionPanelSide } from "@/lib/ui/viewer-companion/panel-play";
import { gfxMode as readGfxMode } from "@/lib/ui/gfx";
import { hapticSuccess } from "@/lib/ui/haptics";
import { CompanionFood, type CompanionFoodControl } from "./companion-food";
import { CompanionToys, type CompanionToyControl } from "./companion-toys";
// Keep a cold stamp/gift's Suspense boundary local. Suspending the whole
// resident also disconnects its layout-owned decoded picture temporarily.
const CompanionCollectionArt = dynamic(() => import("./companion-collection-art").then(module => module.CompanionCollectionArt), { loading: () => null });
import { CompanionBedForeground, CompanionHome, type CompanionHomeAction } from "./companion-home";
import { useHomeShelf } from "./use-home-shelf";
import { companionInitialHomePoint } from "@/lib/ui/viewer-companion/home-entry";
import "./viewer-companion.css";

type Props = { onOpenBook: (destination?: "personality") => void; root: RefObject<HTMLElement | null>; preferences: CompanionPreferences; blocked: boolean; overlayOpen: boolean; workspaceBusy?: boolean; editing?: boolean; agenda: boolean; monthKey: string; context?: CompanionHomeEnvironmentContext; reduced: boolean; homeHost: HTMLElement | null; homeVisible: boolean; launcherHost?: HTMLElement | null; compactHost?: HTMLElement | null; premiereCue?: CompanionPremiereCue | null; onPremiereJoin?: (generation: string, id: string) => void; positionMemory?: CompanionPositionMemory; fixtureFood?: CompanionFoodKind };
type Control = Record<Exclude<CompanionHomeAction, "book"> | "place" | "rest" | "toys" | "toyChanged" | "toyTouched" | "toyReturned", () => void>;
type RuntimeAction = CompanionAction & { petResponse?: true; homeLife?: CompanionHomeLifeAction["homeLife"]; toyPerformance?: { id: string; kind: CompanionToyKind }; foodAftertaste?: CompanionFoodAftertaste; workExpression?: CompanionWorkExpressionOffer; personalityScene?: PersonalitySceneBeat; personalityJobEnd?: true; foodRefusal?: { foodId: string; kind: CompanionFoodKind }; toyMishap?: CompanionToyTripWitness; personalitySignature?: CompanionPreferences["personality"]; scene?: CompanionSceneAction["scene"]; toy?: CompanionToyAction["toy"]; toyApproach?: { element: HTMLElement; effect: "stash" | "spawn"; duration: number }; household?: CompanionHouseholdBeat; radio?: { generation: number; reaction: CompanionRadioReaction; bpm: number; instrument?: CompanionInstrumentReaction } };
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
export default function ViewerCompanion({ onOpenBook, root, preferences, blocked, overlayOpen, workspaceBusy = false, editing = false, agenda, monthKey, context, reduced, homeHost, homeVisible, launcherHost = null, compactHost = null, premiereCue = null, onPremiereJoin, positionMemory, fixtureFood }: Props) {
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const environmentContext = useRef(context); environmentContext.current = context;
  const fallbackContext = () => ({ slug: "vic", year: Number(monthKey.split("-")[0]), month: Number(monthKey.split("-")[1]) });
  const [homeEnvironment, setHomeEnvironment] = useState(() => resolveCompanionHomeEnvironment(context ?? fallbackContext()));
  const environment = useRef(homeEnvironment);
  const environmentKey = JSON.stringify(context ?? { slug: "vic", year: Number(monthKey.split("-")[0]), month: Number(monthKey.split("-")[1]) });
  useEffect(() => {
    const next = resolveCompanionHomeEnvironment(JSON.parse(environmentKey) as CompanionHomeEnvironmentContext);
    environment.current = next; setHomeEnvironment(next);
  }, [environmentKey]);
  const toys = useRef<CompanionToyControl>(null), [toyCount, setToyCount] = useState(0);
  const toyTastes = useRef<ReturnType<typeof loadCompanionTastes> | null>(null);
  toyTastes.current ??= loadCompanionTastes();
  const sceneStore = useRef<ReturnType<typeof createCompanionSceneStore> | null>(null);
  const agentStore = useRef<ReturnType<typeof createCompanionAgentExperienceStore> | null>(null);
  const foodDiscarded = useRef<(id: string) => void>(() => {});
  // Audio sliders do not restart geometry, the brain or decoded body owners.
  const worldPreferencesKey = companionWorldPreferencesKey(preferences);
  const actorId = useId();
  const body = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null), effect = useRef<HTMLSpanElement>(null);
  const sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), reaction = useRef<HTMLSpanElement>(null), facing = useRef<HTMLSpanElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const expressionCanvas = useRef<HTMLCanvasElement>(null);
  const washTool = useRef<HTMLSpanElement>(null);
  const interactionTool = useRef<HTMLSpanElement>(null);
  const accessoryBack = useRef<HTMLSpanElement>(null), accessoryFront = useRef<HTMLSpanElement>(null), giftProp = useRef<HTMLSpanElement>(null), giftButton = useRef<HTMLButtonElement>(null);
  const wardrobe = useRef<{ equipped: CompanionAccessoryId | null; pending: CompanionAccessoryId | null }>({ equipped: null, pending: null });
  const refreshWardrobe = useRef<() => void>(() => {});
  const situationSink = useRef<(id: CompanionSituationId) => void>(() => {});
  const [pendingGift, setPendingGift] = useState<CompanionAccessoryId | null>(null), [openedGift, setOpenedGift] = useState<CompanionAccessoryId | null>(null);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [discovery, setDiscovery] = useState<CompanionDiscoveryNotice | null>(null);
  const discoverySerial = useRef(0), discoveryQueue = useRef<CompanionDiscoveryNotice[]>([]), activeDiscovery = useRef<CompanionDiscoveryNotice | null>(null);
  const discover = useCallback((notice: CompanionDiscoveryNotice extends infer T ? T extends CompanionDiscoveryNotice ? Omit<T, "serial"> : never : never) => {
    const next = { ...notice, serial: ++discoverySerial.current } as CompanionDiscoveryNotice;
    if (activeDiscovery.current) { if (discoveryQueue.current.length < 12) discoveryQueue.current.push(next); }
    else { activeDiscovery.current = next; setDiscovery(next); }
  }, []);
  const finishDiscovery = useCallback((serial: number) => {
    if (activeDiscovery.current?.serial !== serial) return;
    const next = discoveryQueue.current.shift() ?? null;
    activeDiscovery.current = next; setDiscovery(next);
  }, []);
  useEffect(() => {
    const update = () => setRadioPlaying(getCompanionRadioSnapshot().playing);
    const off = subscribeCompanionRadio(update); update();
    return () => { off(); stopCompanionRadio(); };
  }, []);
  const contact = useRef<HTMLSpanElement>(null);
  const inertia = useRef<HTMLSpanElement>(null);
  const bedForeground = useRef<HTMLDivElement>(null);
  const control = useRef<Control | null>(null), brain = useRef(createBrain(performance.now()));
  const routineEvent = useRef<(effect: CompanionRoutineEffect) => void>(() => {});
  const food = useRef<CompanionFoodControl>(null), careLoaded = useRef(false);
  const homeLauncher = useRef<HTMLButtonElement>(null);
  const compactHome = useRef<HTMLDivElement>(null);
  // Presentation changes move one room, not a newly mounted copy. Keep its
  // real controls, anchors and in-flight interaction owners alive together.
  const [homeCarrier] = useState(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div"); node.className = "vc-home-carrier"; return node;
  });
  const homeFocus = useRef<string | null>(null);
  const lastPose = useRef<{ x: number; y: number; monthKey: string; atHome: boolean; homeSupportId?: string; seeded: boolean; restartSupport?: CompanionRestartSupport } | null>(null);
  const initialHome = useRef<{ roll: number | null; entered: boolean; offered: boolean }>({ roll: null, entered: false, offered: false });
  const capturePosition = useRef<(() => void) | null>(null);
  const pendingPosition = useRef<CompanionPositionSnapshot | null>(null);
  // Layout cleanup runs before the old calendar/house DOM disappears. The
  // ordinary passive cleanup must not overwrite a new surface's memory.
  useLayoutEffect(() => () => { capturePosition.current?.(); }, [positionMemory]);
  const lastFood = useRef<CompanionFoodKind | undefined>(undefined);
  // The guarded fixture may choose one initial manual input, including a rare
  // food. Its real dispenser click, gravity, consume ACK and reaction are
  // unchanged. Ordinary routes pass nothing and retain the weighted draw.
  const initialFixtureFood = useRef(fixtureFood);
  const overlayRef = useRef(overlayOpen);
  const workspaceBusyRef = useRef(workspaceBusy);
  workspaceBusyRef.current = workspaceBusy;
  const editingRef = useRef(editing); editingRef.current = editing;
  const [workExpressions]=useState(()=>companionWorkExpressionsFor(root));
  useLayoutEffect(()=>{workExpressions.observe(overlayOpen,editing);},[workExpressions,overlayOpen,editing]);
  const premiereRef = useRef({ cue: premiereCue, onJoin: onPremiereJoin });
  premiereRef.current = { cue: premiereCue, onJoin: onPremiereJoin };
  const premiereMemory = useRef({ generation: "", monthKey, joined: false, entryId: "", consumedExit: 0 });
  const spriteQuality = useRef({ pending: new Set<string>(), failures: new Map<string, number>() });
  const requestSprite = useRef<(src: string) => void>(() => {});
  overlayRef.current = overlayOpen;
  const [homeExpanded, setHomeExpanded] = useState(false), [suspended, setSuspended] = useState(true);
  const [care, setCare] = useState({ ...DEFAULT_COMPANION_CARE }), [announcement, setAnnouncement] = useState("");
  const [homeCurtain, setHomeCurtain] = useState(INITIAL_COMPANION_HOME_CURTAIN);
  const homeLampLit = useSyncExternalStore(subscribeCompanionHomeLight, getCompanionHomeLight, getServerCompanionHomeLight);
  const curtainProjection = useRef(INITIAL_COMPANION_HOME_CURTAIN);
  useEffect(() => subscribeCompanionCurtainChoice(() => {
    // Direct controls still work while the creature is parked or roam is OFF.
    // This semantic subscription does not wake its brain or a motion loop.
    const next = reduceCompanionHomeCurtain(curtainProjection.current, { environment: environment.current,
      personality: preferencesRef.current.personality, rest: curtainProjection.current.rest, lookingOut: false,
      visible: !document.hidden, blocked: false, reduced: document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? ""), intent: getCompanionCurtainChoice() });
    curtainProjection.current = next; setHomeCurtain(next);
  }), []);
  const [ready, setReady] = useState(false), [unreadCollection, setUnreadCollection] = useState(false);
  const compactActive = ready && !suspended && !blocked && !(homeVisible && homeHost) && !!launcherHost && !!compactHost;
  useEffect(() => {
    if (compactActive && !initialHome.current.entered && !initialHome.current.offered) {
      initialHome.current.offered = true; setHomeExpanded(true);
    }
  }, [compactActive]);
  const homeShelf = useHomeShelf({ active: compactActive, expanded: homeExpanded, monthKey, host: compactHost, launcher: homeLauncher, room: compactHome, setExpanded: setHomeExpanded });
  const [geometryIdentity] = useState(createCompanionGeometryIdentity);
  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (!ready || !preferences.enabled) {
      wardrobe.current = { equipped: null, pending: null }; setUnreadCollection(false); setPendingGift(null); setOpenedGift(null); refreshWardrobe.current(); return;
    }
    let collectionUnread = 0;
    toyTastes.current = loadCompanionTastes();
    const read = (value: ReturnType<typeof loadCompanionCollection>) => {
      const prior = wardrobe.current;
      collectionUnread = getCompanionUnreadCounts(value).total;
      setUnreadCollection(collectionUnread + companionToyUnread(toyTastes.current) > 0);
      wardrobe.current = { equipped: value.gifts.equipped, pending: value.gifts.pending };
      if (value.gifts.pending && prior.pending !== value.gifts.pending) situationSink.current("gift-arrival");
      setPendingGift(value.gifts.pending); setOpenedGift(current => current && value.gifts.unlocked.includes(current) ? current : null); refreshWardrobe.current();
    };
    read(loadCompanionCollection());
    const offCollection = subscribeCompanionCollection(read);
    const offTastes = subscribeCompanionTastes(value => { toyTastes.current = value; setUnreadCollection(collectionUnread + companionToyUnread(value) > 0); });
    return () => { offCollection(); offTastes(); };
  }, [ready, preferences.enabled, preferences.sleep]);
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
    if (!ready || !homeCarrier) return;
    const destination = !suspended && !blocked ? homeVisible && homeHost ? homeHost : compactHome.current : null;
    if (destination && homeCarrier.parentElement !== destination) destination.appendChild(homeCarrier);
    else if (!destination) homeCarrier.remove();
  }, [ready, homeCarrier, homeHost, homeVisible, homeExpanded, compactActive, suspended, blocked]);
  useLayoutEffect(() => () => { homeCarrier?.remove(); }, [homeCarrier]);
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
  useLayoutEffect(() => { window.dispatchEvent(new Event("vic:companion-workspace")); }, [workspaceBusy, editing]);
  const premiereItemsKey = premiereCue?.items.map(item => `${item.id}:${item.state}:${item.revealAt}`).join("|");
  useLayoutEffect(() => { window.dispatchEvent(new Event("vic:companion-premiere")); }, [premiereCue?.generation, premiereCue?.phase, premiereCue?.target, premiereCue?.exit?.token, premiereItemsKey]);

  useEffect(() => {
    void worldPreferencesKey;
    const preferences = preferencesRef.current;
    const el = body.current, button = actor.current, page = root.current, image = sprite.current, poseLayer = pose.current, reactionLayer = reaction.current, facingLayer = facing.current, contactLayer = contact.current, inertiaLayer = inertia.current;
    if (!ready || !el || !button || !page || !image || !poseLayer || !reactionLayer || !facingLayer || !contactLayer || !inertiaLayer || !preferences.enabled) { if (lastPose.current) lastPose.current.restartSupport = undefined; return; }
    let witnessedCheerHops = 0, aftertastePaintMs = 0, aftertastePaintAt = 0;
    const aftertastes = createCompanionFoodAftertaste();
    el.dataset.lifePurpose = "ordinary";
    if (blocked) { if (lastPose.current) lastPose.current.restartSupport = undefined; el.hidden = true; setSuspended(true); setHomeExpanded(false); return; }
    // Settings/auto/storage notifications own this snapshot. Animation frames
    // must not synchronously reread localStorage for each pose/spring/layer.
    let graphicsMode = readGfxMode();
    const gfxMode = () => graphicsMode;
    if (!careLoaded.current) { brain.current = { ...brain.current, ...loadCompanionCare() }; careLoaded.current = true; }
    else { const saved = loadCompanionCare(); brain.current = { ...brain.current, habits: saved.habits, life: saved.life }; }
    loadCompanionCollection();
    if (!sceneStore.current) {
      let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* local storage can be unavailable */ }
      sceneStore.current = createCompanionSceneStore(storage);
    }
    if (!agentStore.current) {
      let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* Optional same-device learning. */ }
      agentStore.current = createCompanionAgentExperienceStore(storage);
    }
    let agentMemoryGeneration = brain.current.habits?.generation ?? 0;
    const agentMemory = createCompanionAgentExperience(agentStore.current.load(agentMemoryGeneration, preferences.learnFromYou));
    let agentActionGeneration = brain.current.habits?.generation ?? 0, agentActionPersonality = preferences.personality, washLearningCredit = false;
    const learnedPlaces = new Set<string>();
    const learnAgent = (effect: CompanionExperienceEffect, family?: CompanionExperienceFamily, autonomous = true, epoch = { generation: agentActionGeneration, personality: agentActionPersonality }) => agentMemory.observe({
      personality: preferencesRef.current.personality, context: isHomeSupport(support) ? "home" : "outside", effect, family,
      learn: preferencesRef.current.enabled && preferencesRef.current.learnFromYou && !document.hidden
        && (!autonomous || sameCompanionAgentGeneration(epoch.generation, brain.current.habits?.generation ?? 0) && epoch.personality === preferencesRef.current.personality),
    });
    const syncAgentMemory = (event: StorageEvent) => {
      if (event.key !== null && event.key !== COMPANION_AGENT_EXPERIENCE_KEY) return;
      agentMemory.restore(agentStore.current?.synchronize(event.key === null ? null : event.newValue, brain.current.habits?.generation ?? 0, preferencesRef.current.learnFromYou));
    };
    window.addEventListener("storage", syncAgentMemory);
    const scenes = createCompanionScenes(sceneStore.current.load(preferences.learnFromYou));
    // Synthetic QA can opt into anonymous read-only facts on exact loopback
    // fixture documents. No observer runs on deployed/user pages; this one
    // document-wide24-entry buffer never controls actor/needs/route state.
    const diagnostic143Enabled = location.protocol === "http:" && ["localhost", "127.0.0.1", "127.0.0.2", "[::1]"].includes(location.hostname)
      && location.pathname.startsWith("/visual-fixture/")
      && (window as Window & {__vicCompanionDiagnostics143?:{version:number}}).__vicCompanionDiagnostics143?.version === 1;
    const diagnostic143 = (stage:string,facts:Readonly<Record<string,unknown>>) => {
      if(!diagnostic143Enabled)return;
      const store=(window as Window & {__vicCompanionDiagnostics143?:{version:number;records:unknown[]}}).__vicCompanionDiagnostics143;
      if(store?.version!==1||!Array.isArray(store.records)||store.records.length>=24)return;
      store.records.push({stage,activeMs:brain.current.activeMs,facts});
    };
    const outsideDiagnostic = diagnostic143Enabled
      ? (fact:import("@/lib/ui/viewer-companion/outside-route").CompanionOutsideDiagnostic)=>diagnostic143(`outside-${fact.stage}`,{...fact}) : undefined;
    const personalityDirector = createCompanionPersonalityDirector(undefined,undefined,outsideDiagnostic,
      diagnostic143Enabled ? fact => diagnostic143("curious-toy-admission",fact) : undefined, receipt => {
        const id = companionActivityMemory(receipt.id);
        if (id && recordCompanionCompletedActivity(receipt)) discover({ kind: "behavior", id, source: { x, y: y - size * .4 } });
      });
    const routines = createCompanionRoutineArbiter(outsideDiagnostic);
    const publicLife = createCompanionPublicLife();
    const observeRoutine = (effect: CompanionRoutineEffect) => {
      routines.observe(effect, brain.current.activeMs);
      if (effect === "ate") { if (learnAgent("ate")) washLearningCredit = true; }
      else if (effect === "played") { if (learnAgent("toy-played")) washLearningCredit = true; }
      else if (effect === "washed" && washLearningCredit && learnAgent("washed")) washLearningCredit = false;
      else if (effect === "slept") learnAgent("slept");
    };
    routineEvent.current = observeRoutine;
    let personalityMusic: { source: "radio" | "instrument"; at: number; mood?: CompanionRadioMood } | undefined;
    const sceneEvent = (event: CompanionSceneEvent) => {
      scenes.event(event, brain.current.activeMs, preferences.learnFromYou);
      const at = brain.current.activeMs;
      if (event.kind === "encounter" || event.kind === "home-called") personalityDirector.event("arrival", at);
      if (event.kind === "petted") { personalityDirector.event("pet", at); learnAgent("petted", undefined, false); }
      if ((event.kind === "radio" && radioAllowed()) || event.kind === "instrument") {
        personalityMusic = { source: event.kind, at, mood: event.mood };
        personalityDirector.event("music", at);
      }
      if (event.kind === "rested" || event.kind === "manual-land" && event.recovered) personalityDirector.event("recovered", at);
      if (event.kind === "rested") personalityDirector.event("rested", at);
      if (event.kind === "layout" || event.kind === "month") personalityDirector.event("layout", at);
      if (event.kind === "accessory") personalityDirector.event("outfit", at);
      if (event.kind === "meal") { personalityDirector.event("meal", at); if (event.favoriteChanged) personalityDirector.event("favorite", at); }
    };
    foodDiscarded.current = id => sceneEvent({ kind: "user-discard", foodId: id });
    let encounterStarted = false, sceneOutfit: CompanionAccessoryId | null | undefined, environmentMinute = -1;
    let manualLandingPending: { recovered: boolean } | undefined;
    const scatteredFoods = new Map<string, { from: { x: number; y: number }; expires: number }>();
    let radioSceneStarted = -1, radioSceneListened = false, lastSceneScore: { id: string; segment: number } | undefined, unfinishedMelody = false, sceneLayoutPending = false;
    const sceneSignal = (event: Event) => {
      const signal = (event as CustomEvent).detail;
      if (!validCompanionSceneSignal(signal)) return;
      sceneEvent({ kind: "signal", signal });
      if (signal.kind === "wardrobe-opened") emitCompanionWardrobePreference(preferences.learnFromYou ? scenes.preferredAccessory(loadCompanionCollection().gifts.unlocked) : null);
    };
    window.addEventListener(COMPANION_SCENE_SIGNAL, sceneSignal);
    const workSignal = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!validCompanionWorkSignal(detail)) return;
      if (detail.kind === "saved") personalityDirector.event("work", brain.current.activeMs);
      else if (detail.kind === "opened") personalityDirector.event("editor-open", brain.current.activeMs);
      else if (detail.kind === "undo" || detail.kind === "redo") personalityDirector.event("undo", brain.current.activeMs);
      // Open/close only change the coarse editing prop. A successful public
      // save is the only completion signal; no title or event ID is observed.
    };
    window.addEventListener(COMPANION_WORK_SIGNAL, workSignal);
    const sceneDepart = () => {
      sceneEvent({ kind: "depart", wallTime: Date.now(), unfinished: hiding ? "hide" : action?.play === "cheer-rehearsal" ? "performance" : unfinishedMelody ? "melody" : undefined, ...(unfinishedMelody && lastSceneScore ? { score: lastSceneScore } : {}) });
      sceneStore.current?.save(scenes.checkpoint(), preferences.learnFromYou);
      agentStore.current?.save(agentMemory.snapshot(), brain.current.habits?.generation ?? 0, preferencesRef.current.learnFromYou);
    };
    window.addEventListener("pagehide", sceneDepart);
    const observeInstrumentScene = (played: { pulse: CompanionInstrumentPulse; quality: "steady" | "uneven" | "unknown" }) => {
      const pulse = played.pulse;
      if (!pulse.scoreKey || pulse.scoreSegment === undefined || pulse.scoreIndex === undefined) return;
      lastSceneScore = { id: pulse.scoreKey, segment: pulse.scoreSegment }; unfinishedMelody = !pulse.scoreEnd;
      sceneEvent({ kind: "instrument", phrase: Math.floor(pulse.scoreIndex / 3), finished: Boolean(pulse.scoreEnd), quality: played.quality, score: lastSceneScore, phraseEnd: pulse.phraseEnd, mood: pulse.mood });
    };
    let lastMemorySave = performance.now();
    let resetSceneSerial: number | undefined;
    const resetLearningMemory = (deferSceneCancel = false) => {
      agentMemory.clear(); agentStore.current?.clear(); learnedPlaces.clear(); washLearningCredit = false;
      // A pre-reset contact may finish its body reaction, but cannot teach
      // the erased accident again when the completed clip acknowledges it.
      if (action?.toyMishap) action = { ...action, toyMishap: undefined };
      toyMishapWitnessed = false;
      scenes.resetMemory(); unfinishedMelody = false; lastSceneScore = undefined; scatteredFoods.clear(); manualLandingPending = undefined;
      if (action?.scene) {
        if (["walk", "jump"].includes(action.kind)) action = { ...action, scene: undefined };
        else if (deferSceneCancel) resetSceneSerial = action.scene.serial;
        else clearAction();
      }
      sceneStore.current?.save(scenes.checkpoint(), true);
    };
    const persistCare = (force = false) => {
      const saved = saveCompanionCare(brain.current, force);
      // A forced meal save can run inside the completed-action stack. Wipe
      // memory now; cancel that exact legacy scene at the next existing tick.
      agentMemoryGeneration = reconcileCompanionAgentExperienceGeneration(agentMemoryGeneration, saved.habits.generation, () => resetLearningMemory(true));
      brain.current = { ...brain.current, habits: saved.habits, life: saved.life };
      flushCompanionCollection(force); sceneStore.current?.save(scenes.checkpoint(), preferences.learnFromYou);
      agentStore.current?.save(agentMemory.snapshot(), agentMemoryGeneration, preferencesRef.current.learnFromYou); lastMemorySave = performance.now();
    };
    const offHabits = subscribeCompanionHabits(habits => {
      const reset = habits.generation !== (brain.current.habits?.generation ?? 0);
      brain.current = { ...brain.current, habits };
      if (reset) {
        agentMemoryGeneration = reconcileCompanionAgentExperienceGeneration(agentMemoryGeneration, habits.generation, resetLearningMemory);
      }
    });
    const offLife = subscribeCompanionLife(life => { brain.current = { ...brain.current, life }; });
    const rememberLife = (event: CompanionLifeExperience) => {
      if (!preferences.enabled || !preferences.learnFromYou) return false;
      const life = experienceCompanionLife(brain.current.life, event);
      if (life === brain.current.life) return false;
      brain.current = { ...brain.current, life }; persistCare(true); return true;
    };
    const experience = (kind: CompanionExperience, foodKind?: CompanionFoodKind, taste?: CompanionFoodTasteOutcome) => {
      if (kind === "petted" || kind === "reassured") sceneEvent({ kind: "petted", place: isHomeSupport(support) ? "home" : supportById(support)?.kind === "card" ? "card" : "floor", equipped: wardrobe.current.equipped });
      if (kind === "played") sceneEvent({ kind: "played", equipped: wardrobe.current.equipped });
      // Real direct interactions can earn a keepsake even when learning is
      // OFF. Autonomous play and merely spawned food never call this path.
      if (preferences.enabled && ["petted", "reassured", "fed", "played"].includes(kind)) recordCompanionGiftInteraction();
      if (!preferences.enabled || !preferences.learnFromYou) return false;
      const habits = learnCompanionHabits(brain.current.habits, kind);
      const event: CompanionLifeExperience | undefined = kind === "fed" ? foodKind ? { kind: "fed", food: foodKind, ...(taste ? { taste } : {}) } : undefined : kind === "reassured" ? { kind: "petted" } : kind === "petted" || kind === "played" ? { kind } : undefined;
      const life = event ? experienceCompanionLife(brain.current.life, event) : brain.current.life;
      if (habits === brain.current.habits && life === brain.current.life) return false;
      brain.current = { ...brain.current, habits, life };
      // Only a credited experience flushes. Persist its spent credit too, so
      // a quick reload cannot train another full experience immediately.
      persistCare(true);
      return true;
    };
    let transferRecovery = false;
    const beginManualTransfer = () => {
      cancelManualWash();
      transferRecovery = performance.now() < mishapUntil || brain.current.places.some(place => place.failures > 0 && place.retryAfter > brain.current.activeMs
        && (place.id === support || place.id === brain.current.intention?.targetId || waitingForSupport));
    };
    const transferred = (thrown = false, rough = false) => { if (!rough) { experience("played"); manualLandingPending = { recovered: transferRecovery }; } transferRecovery = false; logActivity("ui.click", { target: thrown ? "companion-throw" : "companion-drag" }); };
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
    const workAllowed = () => editingRef.current && preferences.enabled && preferences.roam && !reduced && gfxMode() !== "off"
      && companionPresenceActive({ focused: document.hasFocus(), visible: !document.hidden, activeWhileVisible: preferences.activeWhileVisible, blocked: blocked || workspaceBusyRef.current });
    const workCanExpress=()=>workAllowed()&&workExpressions.available();
    const visibleActive = () => companionPresenceActive({ focused: document.hasFocus(), visible: !document.hidden, activeWhileVisible: preferences.activeWhileVisible, blocked: blocked || overlayRef.current && !workAllowed() || workspaceBusyRef.current });
    const presence = createCompanionPresence(visibleActive(), performance.now(), { autoSleep: preferences.sleep });
    const saved = lastPose.current;
    let restartSupport = saved?.restartSupport;
    if (!saved && !pendingPosition.current && positionMemory?.current) pendingPosition.current = positionMemory.current;
    const received = pendingPosition.current;
    const transferredPoint = received && companionPositionPoint(received, { width: innerWidth, height: innerHeight }, COMPANION_SIZE);
    const incoming = transferredPoint ? received : null;
    if (saved?.seeded || incoming) initialHome.current.entered = true;
    let freshHomePending = !saved?.seeded && !incoming && !initialHome.current.entered;
    if (freshHomePending) initialHome.current.roll ??= Math.random();
    if (!incoming) pendingPosition.current = null;
    let pendingMonth = Boolean(saved && saved.monthKey !== monthKey && !saved.atHome);
    let sceneMonthPending = Boolean(saved && saved.monthKey !== monthKey);
    const monthStarted = performance.now(), monthReadyAt = monthStarted + (reduced ? 0 : 340);
    const incomingHome = incoming?.monthKey === monthKey && (incoming.anchor?.kind === "home" || incoming.anchor?.kind === "home-floor") ? incoming.anchor.kind : undefined;
    let platforms: Platform[] = [], landingPlatforms: Platform[] = [], toyHomeContacts: Platform[] = [], x = saved?.x ?? transferredPoint?.x ?? innerWidth * .68, y = saved?.y ?? transferredPoint?.y ?? innerHeight - 18, support = saved?.atHome ? saved.homeSupportId ?? "companion-home" : incomingHome === "home" ? "companion-home" : incomingHome === "home-floor" ? "companion-home-floor" : "";
    let positionEntryWait = false;
    let homeJourney: false | "called" | "automatic" = false;
    let homeWakeUntil = 0, strandedSince = 0, homeRetryAt = 0;
    let homeWaitingGeometry = false, homeValidationRequested = false, homeLookUsed = false, homeLegs = 0;
    let homeEntryFloor: string | undefined;
    let pendingHomeRecall: HTMLElement | undefined;
    const pendingFeeds = createCompanionFeedCommands<HTMLElement>();
    const cancelHomeJourney = () => { pendingHomeRecall = undefined; homeJourney = false; homeWakeUntil = 0; strandedSince = 0; homeWaitingGeometry = homeValidationRequested = homeLookUsed = false; homeLegs = 0; homeEntryFloor = undefined; el.removeAttribute("data-home-journey"); el.removeAttribute("data-home-waiting"); el.removeAttribute("data-home-wait-pose"); };
    // A retired transparent panel anchor cannot keep a stale world grounded
    // while its next geometry delivery selects an actual lower support.
    const supportById = (id: string) => isCompanionPanelFloor(id) ? undefined : platforms.find(p => p.id === id) ?? landingPlatforms.find(p => p.id === id);
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
    let activityArrival: { action: RuntimeAction; from: { x:number;y:number;platformId?:string } } | undefined;
    let action: RuntimeAction | null = null, began = 0, origin = { x, y }, travel = 0, total = 0, petUntil = 0, placing = false, keyboardHeld = false, keyboardMoved = false, consumePlacementClick = false;
    let manualWashSource: HTMLElement | undefined, manualWashPending = false, manualWashUntil = 0;
    const manualWashVisible = (source: HTMLElement) => source.isConnected && source === document.querySelector(".vc-home [data-home-action='wash']")
      && !source.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]");
    const cancelManualWash = () => {
      manualWashSource = undefined; manualWashPending = false;
      if (!personalityDirector.manualWash()) return;
      personalityDirector.cancel();
      // The next direct gesture owns input. An in-flight leg keeps its safe
      // landing, with no later wash replay or fabricated completion.
      if (action?.personalityScene?.manual) {
        if (["walk", "jump"].includes(action.kind)) action = { ...action, personalityScene: undefined, personalitySignature: undefined };
        else clearAction();
      }
    };
    let sofaTravelActive = false;
    let petResponse: ReturnType<typeof companionPettingResponse> = [], petResponseUntil = 0;
    let sofaFlightShape: CompanionSofaTravelShape | undefined, ballisticCoefficient: number | null = null;
    let jumpRecoveryContext: Pick<CompanionAction, "foodId" | "intention" | "episode"> | undefined;
    const jumpAnticipation = () => action?.runUp ? 0 : (action?.jumpHeight ?? 140) > 140 ? 320 : COMPANION_TIMING.jumpAnticipation;
    let placementPointer: number | null = null;
    let pointer: { x: number; y: number } | undefined, pointerAnchor: { x: number; y: number } | undefined, pointerStableSince = 0, heartResult: "added" | "removed" | "blocked" | "missing" | null = null;
    const foodCuriosity = createCompanionFoodCuriosity();
    const household = createCompanionHousehold();
    const homeLifePolicy = createCompanionHomeLifePolicy();
    let homeLifePending: { original: RuntimeAction; phase: CompanionHomeLifePhase; personality: CompanionPreferences["personality"]; deadline: number; retryAt: number; legs: number; failures: number; targetRatio?: number; controlsReady?: boolean } | undefined;
    let homeLifeEffectApplied = false, homeLifeEffectSucceeded = false;
    const cancelHomeLife = () => { homeLifePending = undefined; el.removeAttribute("data-home-life");
      el.removeAttribute("data-home-life-scene"); el.removeAttribute("data-home-life-serial"); el.removeAttribute("data-home-life-beat"); };
    const reactive = createCompanionReactiveCues();
    let nextCueProbe = 0;
    const toyPlanner = createCompanionToyPlanner();
    const personalityActivity = createCompanionPersonalityActivity();
    const personalityJobs = createCompanionPersonalityJobs(personalityDirector, household, toyPlanner);
    let personalityEffectApplied = false;
    let washContactMs = 0, washPaintAt = 0, sleepPaintMs = 0, sleepPaintAt = 0, watchPaintMs = 0, watchPaintAt = 0;
    let roomBodyGrade = 1;
    let homeInteractionWitness: number | undefined, homeContactSerial = 0;
    type HomeContactKind = "tv" | "light" | "curtain" | "radio" | "dispenser" | "box" | "bin";
    let homeContact: { serial: number; kind: HomeContactKind; element: Element; point: { x: number; y: number; width?: number; height?: number }; startedAt: number;
      lampPaint?: { button: HTMLButtonElement; paint: HTMLElement; art: HTMLElement[]; feedback: HTMLElement[] } } | undefined;
    let homeLampPresentation: CompanionLampPresentation | undefined;
    let homeRadioPending: AbortController | undefined, homeRadioRequestedAt = 0;
    let touchedLamp: HTMLButtonElement | null = null;
    const showLampContact = (lamp: HTMLButtonElement | null) => {
      if (touchedLamp === lamp) return;
      touchedLamp?.removeAttribute("data-companion-touch");
      touchedLamp = lamp;
      touchedLamp?.setAttribute("data-companion-touch", "");
    };
    const homeContactElement = (kind: HomeContactKind): Element | null => {
      const selector = { tv: ".vc-home-tv-paint", light: ".vc-home-lamp-handle", curtain: ".vc-curtain-control > span", radio: ".vc-radio-button .vc-object-paint", dispenser: ".vc-dispenser-slot", box: ".vc-toy-box-opening", bin: ".vc-home-trash" }[kind];
      return document.querySelector(".vc-home " + selector);
    };
    const homeContactPoint = (kind: HomeContactKind, element: Element) => {
      const rect = element.getBoundingClientRect();
      if (!element.isConnected || !rect.width || !rect.height || element.closest("[hidden],[inert],[data-panel-collapsed]")) return;
      if (kind === "box") return companionHomeOpeningContact(rect, x);
      return { x: rect.left + rect.width * (kind === "tv" ? .36 : kind === "radio" ? .2 : .5),
        y: kind === "curtain" ? rect.bottom : kind === "bin" ? rect.top + rect.height * .16 : rect.top + rect.height * (kind === "radio" ? .8 : .5),
        ...(kind === "light" ? { width: rect.width, height: rect.height } : {}) };
    };
    const clearHomeContact = () => {
      homeRadioPending?.abort(); homeRadioPending = undefined; homeRadioRequestedAt = 0;
      homeContact = undefined; homeInteractionWitness = undefined; homeLampPresentation = undefined;
      showLampContact(null);
      if (interactionTool.current) interactionTool.current.hidden = true;
      el.removeAttribute("data-home-reaching");
    };
    const storedPersonalityFoods = new Set<string>();
    let nextSupplyAt = 0;
    let interruptedPersonalityItem: string | undefined, yieldedPersonalityItem: string | undefined, deferredPersonalityToy: string | undefined;
    let humanToyAt = -Infinity;
    const settledPersonalityToys = new Map<string, string>();
    let toyEffectApplied = false, toyPerformanceWitnessed = false, toyMishapWitnessed = false, foodRefusalWitnessed = false, sceneEffectApplied = false;
    let toyReturnAim: { element: HTMLElement; point: { x: number; y: number } } | undefined;
    let toyReturnPainted: { x: number; y: number } | undefined;
    let foodDisposalAim: { element: HTMLElement; point: { x: number; y: number } } | undefined;
    let foodDisposalPainted: { x: number; y: number } | undefined;
    const isFoodDisposal = (candidate: RuntimeAction | null) => candidate?.household?.effect === "discard" || candidate?.scene?.effect?.kind === "discard";
    const recordFoodDisposalPaint = (point: { x: number; y: number }) => { if (isFoodDisposal(action)) foodDisposalPainted = point; };
    let householdEffectApplied = false;
    let curiosityTossed = false, invitedUntil = 0, lastRoughAt = -Infinity, roughInGrip = false;
    const hurtTrust = (kind: "rough-play" | "betrayed", now: number) => {
      if (now - lastRoughAt < 2500) return;
      lastRoughAt = now;
      sceneEvent({ kind: "rough" }); manualLandingPending = undefined;
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
    const nativeSofaAnchors = CSS.supports("position-anchor", "--vc-sofa") && CSS.supports("left", "anchor(left, 0px)");
    const sofaAnchorName = `--vc-sofa-${button.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    let namedSofa: { bed: SVGSVGElement; seat: HTMLElement } | undefined;
    const clearSofaNames = () => {
      namedSofa?.bed.style.removeProperty("anchor-name"); namedSofa?.seat.style.removeProperty("anchor-name"); namedSofa = undefined;
    };
    let bedScene: { anchor: Element; anchorX: number; anchorY: number; left: number; top: number; width: number; height: number; opacity: number; opacitySources: Element[]; clip: { left: number; top: number; right: number; bottom: number } } | undefined;
    const syncRoomItemLight = () => {
      food.current?.setRoomLight(bedScene?.clip, bedScene ? roomBodyGrade : 1);
      toys.current?.setRoomLight(bedScene?.clip, bedScene ? roomBodyGrade : 1);
    };
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
      if (!front || !bed || !anchor || !room || !bed.isConnected) { bedScene = undefined; syncRoomItemLight(); hideBed(); return; }
      const localFront = bed.querySelector<SVGGElement>(".vc-bed-local-front");
      if (!localFront) { bedScene = undefined; syncRoomItemLight(); hideBed(); return; }
      if (localBedFront !== localFront) { hideBed(); localBedFront = localFront; }
      // CSS anchors must precede the fixed carrier in layout order. A new
      // presentation keeps the world-coordinate fallback until that actual
      // ordering is present; parsing CSS alone cannot prove a usable anchor.
      const anchorBeforeCarrier = Boolean(bed.compareDocumentPosition(front) & Node.DOCUMENT_POSITION_FOLLOWING)
        && Boolean(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      if ((!nativeSofaAnchors || !anchorBeforeCarrier) && namedSofa) clearSofaNames();
      if (nativeSofaAnchors && anchorBeforeCarrier && anchor instanceof HTMLElement && namedSofa?.bed !== bed) {
        clearSofaNames(); namedSofa = { bed, seat: anchor };
        bed.style.setProperty("anchor-name", sofaAnchorName); anchor.style.setProperty("anchor-name", `${sofaAnchorName}-seat`);
        // A world-space jump/drag releases the native seat's scroll adjustment.
        style(el, "--vc-sofa-native-anchor", `${sofaAnchorName}-seat`); style(front, "--vc-sofa-native-anchor", sofaAnchorName);
      }
      const rect = bed.getBoundingClientRect(), seat = anchor.getBoundingClientRect(), clip = room.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || clip.width <= 0 || clip.height <= 0) { bedScene = undefined; syncRoomItemLight(); hideBed(); return; }
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
      const material = getComputedStyle(room);
      roomBodyGrade = Number.parseFloat(material.getPropertyValue("--vc-room-art-grade")) || 1;
      syncRoomItemLight();
      if (homeContact) {
        const point = homeContactPoint(homeContact.kind, homeContact.element);
        if (point) homeContact.point = point;
        else clearHomeContact();
      }
      // React commits one shared material object to the room and foreground.
      // Geometry owns their positions, never a delayed material copy.
    };
    // The complete room already draws its front. The extra portal is needed
    // only around an interior resident; its retained seat and opacity share
    // the existing finite layout lease, with no new scan or animation clock.
    const followBed = (sample?: { anchorX: number; anchorY: number }, now = performance.now()) => {
      const bed = bedScene;
      if (!bed) return false;
      if (!bed.anchor.isConnected) { bedScene = undefined; syncRoomItemLight(); hideBed(); return true; }
      const rect = sample ? undefined : bed.anchor.getBoundingClientRect();
      if (rect && (rect.width <= 0 || rect.height <= 0)) { bedScene = undefined; syncRoomItemLight(); hideBed(); return true; }
      const anchorX = sample?.anchorX ?? rect!.left, anchorY = sample?.anchorY ?? rect!.top;
      const dx = anchorX - bed.anchorX, dy = anchorY - bed.anchorY;
      bed.left += dx; bed.top += dy;
      bed.clip.left += dx; bed.clip.right += dx; bed.clip.top += dy; bed.clip.bottom += dy;
      bed.anchorX = anchorX; bed.anchorY = anchorY;
      if (dx || dy) syncRoomItemLight();
      const opacity = now <= followUntil
        ? bed.opacitySources.reduce((alpha, source) => alpha * clamp(Number(getComputedStyle(source).opacity || 1), 0, 1), 1)
        : bed.opacity;
      const opacityChanged = opacity !== bed.opacity;
      bed.opacity = opacity;
      return Boolean(dx || dy || opacityChanged);
    };
    const poseWitness = createCompanionPoseWitness();
    const expressions = createCompanionExpressions(), facePainter = expressionCanvas.current ? createCompanionExpressionPainter(expressionCanvas.current) : undefined;
    let expressionMeal: { serial: number; food: string; full: boolean; last: boolean } | undefined, expressionCleanup = 0, expressionAnimating = false;
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
    let awaitingAtX: false | "vertical" | "drop" = false;
    let verticalRecoveryX: number | undefined;
    let verticalLanding = false;
    const viewportRecovery = createCompanionViewportRecovery({ width: innerWidth, height: innerHeight });
    let presentationNow = 0;
    const hideSeek = createCompanionHideSeek();
    let hiding: { personalityScene?: PersonalitySceneBeat; target: CompanionHideTarget; from: { x: number; y: number }; sheet?: HTMLElement; ready?: boolean } | undefined;
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
    const anchorSeen = new Map<string, { x: number; y: number; frame?: CompanionAnchorFrame }>();
    const toyAnchor = (id: string) => {
      const source = geometryTracker?.anchor(id), seen = anchorSeen.get(id);
      // The toy model receives the followed platform, not the old full-scan
      // position. Its display origin must use that same logical sample.
      return source && { ...source, left: seen?.x ?? source.left, top: seen?.y ?? source.top,
        ...(seen?.frame ? { width: seen.frame.width, height: seen.frame.height } : {}) };
    };
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
    let playPresentation: CompanionPlayPresentation = { started: false, waited: 0 };
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
    const publishHomeCurtain = (status: string, suspended = false) => {
      const restAction = action?.kind === "sleep";
      const atHome = isHomeSupport(support);
      const rest = companionHomeRest({
        atHome, grounded: atHome && status !== "jump" && supportedNow(), sleepAllowed: preferences.sleep,
        held: Boolean(pressed || keyboardHeld || placing || overlayDrag || overlayPlacing),
        resting: restAction || presence.phase === "yawning" || presence.phase === "parked",
        dreaming: presence.dreaming || restAction && sleeping,
        waking: status === "wake" || presence.phase === "waking" || restAction && performance.now() - began >= total - COMPANION_TIMING.sleepWake,
      });
      const next = reduceCompanionHomeCurtain(curtainProjection.current, {
        environment: environment.current, personality: preferences.personality, rest,
        lookingOut: atHome && (action?.scene?.id === 31 || action?.personalityScene?.command.kind === "watch") && action.kind === "look",
        intent: getCompanionCurtainChoice(),
        visible: !document.hidden, blocked: suspended || pause || overlayActive || premiereActive || Boolean(premiereBounce) || homeOccluded || workspaceBusyRef.current,
        reduced: reduced || gfxMode() === "off" || document.documentElement.dataset.gfx === "soft",
      });
      // Only coarse semantic changes reach React; ordinary pose/frame paints
      // return the same projection and never rerender the calendar or house.
      if (next !== curtainProjection.current) { curtainProjection.current = next; setHomeCurtain(next); }
    };
    el.style.setProperty("--vc-size", `${size}px`);
    const paint = (row: number, frame: number, status: string) => {
      if (el.hidden) poseWitness.reset();
      let watchPainted = false;
      try {
      bedNeedsPaint = false;
      // Preference restart keeps its exact point while fresh geometry proves
      // the old non-home support. Never expose a decoded unanchored idle frame.
      if (companionRestartPaintPending(restartSupport, support, Boolean(action || pressed || keyboardHeld || placing || returning || premiereActive || premiereBounce || hiding))) { hideBed(); el.hidden = true; return; }
      if (freshHomePending && !premiereActive && !premiereBounce && !hiding) { hideBed(); el.hidden = true; return; }
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
        if (dozing && preferences.sleep) { row = 11; frame = 0; status = "sleep"; } else if (dozing) { row = 0; frame = 0; status = "idle"; }
        el.toggleAttribute("data-dreaming", dozing && preferences.sleep);
      }
      if (!preferences.sleep && [10, 11, 40].includes(row)) { row = 0; frame = 0; status = "idle"; el.removeAttribute("data-dreaming"); }
      lastPoseSample = { row, frame, status };
      if (!action?.accessory) { el.removeAttribute("data-accessory-trick"); el.removeAttribute("data-accessory-beat"); }
      if (!action?.radio) { el.removeAttribute("data-radio-reaction"); el.removeAttribute("data-radio-generation"); }
      // Contact presence belongs to a valid hover, not the pressure/reward
      // envelopes. Existing paints also release it when the world moves away.
      if (hoverPoint && (!canHover(hoverPoint) || !hoverTarget?.isConnected || isOtherControl(hoverTarget))) stopHover();
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
      const attention = ["look", "sniff", "play"].includes(status)
        ? homeContact ? { kind: "social" as const, point: homeContact.point } : action?.attention : undefined;
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
      // Row9 contact deliberately ignores the generic observation attention.
      // Face the actual cord during this owned local action, even when the
      // safe floor ends just beside it and the last walk faced the other way.
      if (homeContact?.kind === "light" && status === "play" && isHomeFloor(support) && supportedNow()
        && !pressed && !keyboardHeld && !placing) sample.facing = homeContact.point.x < x ? -1 : 1;
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
      const playProgress = action?.kind === "play" && !playPresentation.started && !playFalling ? 0 : (performance.now() - began) / total;
      const cheerQuiet = reduced || ["off", "soft"].includes(gfxMode());
      const playingToy = action?.toyPerformance && status === "play" && toys.current?.carried() === action.toyPerformance.id ? sampleCompanionToyPlay(action.toyPerformance.kind, playProgress, cheerQuiet) : undefined;
      const aftertaste = action?.foodAftertaste && status === "play" ? sampleCompanionFoodAftertaste(action.foodAftertaste.kind, playProgress, cheerQuiet) : undefined;
      const play = aftertaste ?? (playingToy ? { ...playingToy, beat: "play" } : action?.kind === "play" && action.play && status === "play" ? sampleCompanionPlay(action.play, playProgress, reduced || gfxMode() === "off" || action.play === "cheer-rehearsal" && cheerQuiet) : action?.kind === "sleep" && action.living === "cozy" && status === "sleep" ? sampleCompanionCozySleep(performance.now() - began, total, action.cozySettled, reduced || gfxMode() === "off") : undefined);
      if (play) {
        // The current actual support owns world position throughout the gag.
        shape.bob += play.lift; shape.tilt += play.lean;
        shape.scaleY *= 1 - play.compression; shape.scaleX = 1 / shape.scaleY;
        if (action?.play === "cheer-rehearsal") shape.bob = Math.max(-Math.max(0, physicalOrigin.y - 2), shape.bob);
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
      const interaction = homeContact?.element.isConnected && isHomeFloor(support) && supportedNow() ? homeContact : undefined;
      // The handle itself moves during a finite tug. Keep contact on its
      // measured current rectangle, rather than an earlier layout sample.
      if (interaction?.kind === "light") {
        const current = homeContactPoint("light", interaction.element);
        if (current) interaction.point = current;
      }
      const previousCarry = paintedSelection && accessoryModule?.companionHomeContactAnchor(paintedSelection, interaction?.kind === "light" || interaction?.kind === "curtain");
      const previousHand = previousCarry && paintedSelection ? projectCompanionSpritePoint({ size, display, shape, pressure, response, facing: sample.facing, sway, chew: 0, cell: paintedSelection.frame }, previousCarry) : null;
      const reach = interaction && previousHand ? sampleCompanionHomeReach({ hand: previousHand, contact: interaction.point, footY: display.y, ceiling: bedScene?.clip.top ?? 0, size, progress: (performance.now() - began) / total, jump: effective.jump, cord: interaction.kind === "light" }) : undefined;
      if (reach) display = { ...display, y: display.y - reach.lift };
      const roomLight = companionRoomBodyLight(display, bedScene?.clip, roomBodyGrade);
      style(el, "--vc-body-room-light", String(roomLight));
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
      // Toothbrushing uses the registered happy mouth atlas; groom packets have no calibrated mouth.
      const washingPose = action?.personalityScene?.command.kind === "wash" && !action.personalityScene.travel && status === "play";
      const drawingRow = washingPose || interaction ? 9 : heldReaction.active || carriedColumn !== undefined ? 22 : sample.row;
      const column = washingPose || interaction ? Math.floor((presentationNow % 800) / 800 * registration.rows[9].length) : heldReaction.active ? Math.min(registration.rows[22].length - 1, Math.floor(Math.floor(heldReaction.phase * 6) / 6 * registration.rows[22].length)) : carriedColumn ?? sample.column;
      const index = registration.rows[drawingRow][column];
      const selected = selectCompanionSprite(index, drawingRow, column);
      requestSprite.current(selected.src);
      // Prepare only the imminent jump stage, within the shared3-image/
      //2-decode budget. Never fan out all four stages on every pose sample.
      if (action?.kind === "jump" && drawingRow >= 3 && drawingRow <= 5) spriteSources[drawingRow + 1].forEach(src => requestSprite.current(src));
      // Current and immediate jump-stage sources keep their request priority.
      // Only then prepare one later play packet during the real owned route;
      // this remains advisory within the existing cache and onset budgets.
      const imminentPlay = status === action?.kind && !reduced && gfxMode() === "full" && action.personalityScene
        ? personalityDirector.imminentPlay(action.personalityScene,action.kind,effective,brain.current.activeMs) : undefined;
      if (imminentPlay) {
        const first = sampleCompanionPlay(imminentPlay,0);
        const column = Math.max(0,Math.min(15,Math.floor(first.phase*15)));
        requestSprite.current(selectCompanionSprite(registration.rows[first.row][column],first.row,column).src);
      }
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
        visible: !el.hidden && !document.hidden && displayOpacity > .05, cheerBounce: false, foodAftertaste: false };
      // Witness several actual airborne body beats, never a happy face alone.
      if (action?.play === "cheer-rehearsal" && status === "play" && drawingRow === 9 && !washingPose && !interaction
        && !cheerQuiet && observed.visible && observed.decoded && observed.adoptedIndex === observed.requestedIndex && observed.adoptedSrc === observed.requestedSrc) {
        const bounce = sampleCompanionCheer(playProgress);
        if (bounce.airborne && bounce.hop && shape.bob < -3) witnessedCheerHops |= 1 << bounce.hop;
        observed.cheerBounce = playProgress >= .89 && witnessedCheerHops.toString(2).replaceAll("0", "").length >= 3;
      }
      const currentDrawing = observed.visible && observed.decoded && observed.adoptedIndex === observed.requestedIndex && observed.adoptedSrc === observed.requestedSrc;
      const expressionFoodId = companionExpressionFoodId(action, status, personalityDirector.current(), meta => personalityDirector.owns(meta));
      const expressionFood = expressionFoodId ? food.current?.foods().find(item => item.id === expressionFoodId) : undefined;
      const expressionToy = action?.toyPerformance?.kind;
      const privateRoom = support.startsWith("companion-home"), command = action?.personalityScene?.command;
      const lookingOut = privateRoom && status === "look" && (action?.scene?.id === 31 || command?.kind === "watch" && getCompanionHomeTv() === "off");
      const face = expressions.sample({
        token: `${began}:${status}:${action?.play ?? ""}`, status, play: action?.play, pose: drawingRow, phase: clamp((performance.now() - began) / Math.max(1, total), 0, 1),
        personality: effective.personality, atHome: privateRoom, energy: brain.current.energy, food: expressionFood?.kind,
        foodRefused: Boolean(action?.foodRefusal), petting: Boolean(pressure.pressure || hoverPetting || petStarted > 0 && performance.now() < petUntil && performance.now() - petStarted < COMPANION_TIMING.petReward + 100), busy: status === "eat" || status === "sleep" || Boolean(expressionToy),
        userNear: Boolean(pointer && Math.hypot(pointer.x - display.x, pointer.y - display.y) < size * 1.7),
        toyPlaying: Boolean(expressionToy && toys.current?.carried()), toyApproach: Boolean(action?.toyApproach || action?.toy && !toys.current?.carried()),
        reading: Boolean(expressionToy && /(?:card|puzzle|cube|kaleidoscope)/.test(expressionToy) && toys.current?.carried()),
        watching: privateRoom && status === "look" && command?.kind === "watch" && getCompanionHomeTv() !== "off",
        lookingOut, music: Boolean(action?.radio), season: Number(monthKey.split("-")[1]), weather: environment.current.weather, daylight: !environment.current.night,
        outing: action?.personalityScene?.id === "routine-outing" || !privateRoom && status === "walk" && effective.personality === "curious",
        cleanupReceipt: expressionCleanup, meal: expressionMeal, mishap: Boolean(runTrip || action?.toyMishap || heartResult === "removed"),
      }, presentationNow, reduced || gfxMode() === "off" || gfxMode() === "soft" || !currentDrawing || overlayActive || premiereActive || Boolean(pressed || keyboardHeld || placing || interaction || washingPose || aftertaste) || status === "sleep" || status === "held");
      expressionAnimating = Boolean(face);
      if (face) requestSprite.current(COMPANION_EXPRESSION_REFERENCE_SRC);
      const faceVisible = facePainter?.paint(paintedSelection, face);
      if (face && faceVisible) data("expression", face.id); else el.removeAttribute("data-expression");
      const poseMemory = poseWitness({ ...observed, visible: observed.visible && !pause && !overlayActive && !premiereActive }, presentationNow);
      if (poseMemory && recordCompanionObservedPose(poseMemory)) discover({ kind: "behavior", id: poseMemory, source: { x: display.x, y: display.y - size * .4 } });
      if (face && recordCompanionObservedExpression(observed, { ...face, painted: Boolean(faceVisible) }))
        discover({ kind: "behavior", id: `expression:${face.id}`, source: { x: display.x, y: display.y - size * .4 } });

      if (aftertaste && currentDrawing && drawingRow === 23 && !cheerQuiet) {
        const at = presentationNow;
        if (aftertastePaintAt) aftertastePaintMs += Math.min(100, Math.max(0, at - aftertastePaintAt));
        aftertastePaintAt = at;
        observed.foodAftertaste = playProgress >= .8 && aftertastePaintMs >= 400;
      } else aftertastePaintAt = 0;
      if (playingToy && action?.toyPerformance && currentDrawing && playProgress >= .7 && !cheerQuiet && !toyPerformanceWitnessed)
        toyPerformanceWitnessed = toys.current?.witnessPlay(action.toyPerformance.id) ?? false;
      if (action?.kind === "play" && action.play && observed.decoded && observed.visible && observed.adoptedIndex === observed.requestedIndex && observed.adoptedSrc === observed.requestedSrc
        && COMPANION_PLAY_TIMING[action.play].beats.some(beat => beat.row === drawingRow)) {
        if (!action.toyPerformance && (action.toy || action.personalityJobEnd && action.personalityScene?.command.kind === "toy" && action.personalityScene.command.mode === "play" && toys.current?.carried())) toyPerformanceWitnessed = true;
        if (action.toyMishap && COMPANION_PLAY_TIMING[action.play].beats.some(beat => beat.row === drawingRow && beat.beat === "impact")) toyMishapWitnessed = true;
        if (action.foodRefusal) foodRefusalWitnessed = true;
      }
      // Listening is a local performance, not a newly witnessed authored
      // behavior or a care reward. Keep ordinary collection truth separate.
      let discovered = !action?.radio && recordCompanionObservedBehavior(observed), giftDiscovered = false;
      const behaviorId = discovered ? observedCompanionBehavior(observed) : undefined;
      if (behaviorId) discover({ kind: "behavior", id: behaviorId, source: { x: display.x, y: display.y - size * .4 } });
      const projection = { size, display, shape, pressure, response, facing: sample.facing, sway, chew,
        poseOrigin: heldPivot || presentationNow - releasedPivotAt < 100 ? { x: sample.facing < 0 ? size - grip.x : grip.x, y: grip.y } : undefined,
        inertiaOrigin: grip };
      const paintedCurrent = observed.visible && observed.decoded && observed.adoptedIndex === observed.requestedIndex && observed.adoptedSrc === observed.requestedSrc;
      // Reuse this existing paint and active clock. No per-frame storage read,
      // DOM search, route proof, learning reward or second animation loop.
      personalityDirector.observeProgress({ now: brain.current.activeMs, point: { x, y, platformId: support },
        carriedToyId: toys.current?.carried(), carriedFoodId: food.current?.carried(),
        active: observed.visible && observed.decoded && preferences.enabled && preferences.roam && !pause && !document.hidden
          && !pressed && !keyboardHeld && !placing && !pendingMonth && !returning && !overlayActive && !premiereActive
          && !workspaceBusyRef.current && !reduced && gfxMode() !== "off" && presence.phase === "active" });
      if (action?.kind === "look" && action.personalityScene?.command.kind === "watch" && !action.personalityScene.travel
        && paintedCurrent && drawingRow === 1 && status === "look" && effective.enabled && effective.roam
        && !pause && !document.hidden && !pressed && !keyboardHeld && !placing && !pendingMonth && !returning
        && !overlayActive && !premiereActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off" && presence.phase === "active"
        && support === action.target.platformId && Math.hypot(x-action.target.x,y-action.target.y) <= 2) {
        const at = presentationNow;
        if (watchPaintAt) watchPaintMs += Math.min(100, Math.max(0, at-watchPaintAt));
        watchPaintAt = at; watchPainted = true;
      }
      if (action?.kind === "sleep" && paintedCurrent && status === "sleep") {
        const at = performance.now(); if (sleepPaintAt) sleepPaintMs += Math.min(100, Math.max(0, at - sleepPaintAt)); sleepPaintAt = at;
      } else sleepPaintAt = 0;
      const hand = paintedSelection && accessoryModule?.companionHomeContactAnchor(paintedSelection, interaction?.kind === "light" || interaction?.kind === "curtain");
      const actualHand = hand && paintedSelection ? projectCompanionSpritePoint({ ...projection, cell: paintedSelection.frame }, hand) : null;
      const targetContact = interaction?.point;
      const touchingControl = Boolean(reach?.touching && paintedCurrent && actualHand && targetContact && (interaction?.kind === "light"
        ? companionHomeCordTouches(actualHand, targetContact, size) : Math.hypot(actualHand.x - targetContact.x, actualHand.y - targetContact.y) <= size * .5));
      // Lamp contact is shown on the real cord, without rays over the pet's face.
      showLampContact(touchingControl && interaction?.kind === "light" ? interaction.element.closest("button") : null);
      if (interaction?.kind === "light" && interaction.lampPaint) {
        const nodes = interaction.lampPaint, lit = nodes.button.closest(".vc-home-room")?.hasAttribute("data-lamp-lit"), index = lit ? 1 : 0;
        const art = nodes.art[index], feedback = nodes.feedback[index], paint = nodes.paint.getBoundingClientRect(), button = nodes.button.getBoundingClientRect();
        const paintCss = getComputedStyle(nodes.paint), feedbackCss = getComputedStyle(feedback), artRect = art.getBoundingClientRect(), feedbackRect = feedback.getBoundingClientRect();
        const samePlane = (rect: DOMRect) => Math.abs(rect.x-paint.x) <= .75 && Math.abs(rect.y-paint.y) <= .75
          && Math.abs(rect.width-paint.width) <= .75 && Math.abs(rect.height-paint.height) <= .75;
        const path = (value: string) => { try { return new URL(value.replace(/^url\(["']?/, "").replace(/["']?\)$/, ""), location.href).pathname; } catch { return ""; } };
        const source = `/companion/home/155/lamp-${lit ? "on" : "off"}.webp`;
        const active = paintedCurrent && effective.enabled && effective.roam && !pause && !document.hidden && !pressed && !keyboardHeld && !placing
          && !overlayActive && !workspaceBusyRef.current && presence.phase === "active" && canCompanionSetHomeLight();
        homeLampPresentation = observeCompanionLampPresentation(homeLampPresentation, { at: performance.now(), serial: interaction.serial, active, bodyTouch: touchingControl,
          visible: nodes.paint.isConnected && art.isConnected && paint.width > 0 && paint.height > 0
            && nodes.paint.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && art.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
          sourceMatches: path(getComputedStyle(art).borderImageSource) === source && path(feedbackCss.borderImageSource) === source,
          samePlane: samePlane(artRect) && samePlane(feedbackRect) && feedbackCss.clipPath.startsWith("polygon("),
          requestedPull: parseFloat(getComputedStyle(nodes.button).getPropertyValue("--vc-lamp-pull")), height: paint.height, width: paint.width,
          cssWidth: parseFloat(paintCss.width), buttonHeight: button.height,
          feedbackVisible: feedback.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }), feedbackOpacity: Number(feedbackCss.opacity) });
      }
      const paw = interactionTool.current;
      if (paw) {
        paw.hidden = !touchingControl || interaction?.kind === "light";
        if (touchingControl && targetContact) {
          style(paw, "transform", `translate3d(${targetContact.x - 9}px,${targetContact.y - 8}px,0) rotate(${Math.sin((performance.now() - began) / 70) * 6}deg)`);
          style(paw, "--vc-body-room-light", String(roomLight));
        }
      }
      if (reach && interaction) {
        if (el.getAttribute("data-home-reaching") !== interaction.kind) el.setAttribute("data-home-reaching", interaction.kind);
      } else el.removeAttribute("data-home-reaching");
      if (touchingControl) homeInteractionWitness = interaction?.serial;
      const carriedFood = food.current?.carried(), carriedToy = toys.current?.carried();
      if ((carriedFood || carriedToy) && paintedSelection) {
        const carryAnchor = accessoryModule?.companionCarryAnchor(paintedSelection);
        const carryPoint = carryAnchor ? projectCompanionSpritePoint({ ...projection, cell: paintedSelection.frame }, carryAnchor) : null;
        // Transport sits on the registered upper front of the body. The
        // 32px snack foot is8px below that point, leaving real floor clearance.
        if (carryPoint && carriedFood) {
          let point = { x: carryPoint.x, y: carryPoint.y + 8 };
          if (isFoodDisposal(action) && foodDisposalAim) point = sampleCompanionFoodDisposal(point, foodDisposalAim.point, (performance.now() - began) / total);
          food.current?.carry(carriedFood, point, isFoodDisposal(action) ? recordFoodDisposalPaint : undefined);
        }
        if (carriedToy) {
          // The adopted current pose owns transport for both kinds of object.
          // A cold landmark module keeps the same current body, never last tick.
          let point = carryPoint ? { x: carryPoint.x, y: carryPoint.y + 8 } : { x: display.x, y: display.y - size * .32 };
          if (action?.toy?.effect === "stash" && toyReturnAim) {
            point = sampleCompanionToyReturn(point, toyReturnAim.point, (performance.now() - began) / total);
          }
          if (playingToy && action?.toyPerformance?.id === carriedToy) {
            const platform = supportById(support), factor = size / 80;
            const floor = { x: display.x + sample.facing * 26 * factor, y: display.y };
            point = { x: lerp(point.x, floor.x, playingToy.toy.floorMix) + sample.facing * playingToy.toy.x * factor,
              y: lerp(point.y, floor.y, playingToy.toy.floorMix) + playingToy.toy.y * factor };
            if (platform && platform.width >= 32) point.x = clamp(point.x, platform.x + 16, platform.x + platform.width - 16);
          }
          const carried = toys.current?.carry(carriedToy, point, playingToy ? { rotation: playingToy.toy.rotation * sample.facing, scale: playingToy.toy.scale, facing: sample.facing, size, visible: currentDrawing, use: playingToy.use, effect: playingToy.effect } : undefined);
          if (carried && action?.toy?.effect === "stash") toyReturnPainted = point;
        }
      }
      if (aftertaste && effect.current) {
        effect.current.textContent = aftertaste.puff > .28 ? action?.foodAftertaste?.kind === "retch" ? "으엑…" : "켁켁!" : "";
        style(effect.current, "left", "58%"); style(effect.current, "top", "38%");
      }
      if (status === "eat" && action?.kind === "eat") {
        const mouth = paintedSelection ? projectCompanionMouth(paintedSelection, projection) : null;
        if (mouth) { mealAnchored = true; food.current?.nibble(action.foodId, clamp((performance.now() - began) / total, 0, 1), mouth, sample.facing); }
        else food.current?.nibble();
      }
      const washing = action?.personalityScene?.command.kind === "wash" && !action.personalityScene.travel && action.kind === "play" && support === COMPANION_WASH_SUPPORT && supportedNow() && paintedCurrent && !overlayActive && !document.hidden;
      const brush = washTool.current, mouth = washing && paintedSelection ? projectCompanionMouth(paintedSelection, projection) : null;
      if (brush) {
        brush.hidden = !mouth;
        el.toggleAttribute("data-washing", Boolean(mouth));
        if (mouth) {
          const at = performance.now(); if (washPaintAt) washContactMs += Math.min(100, Math.max(0, at - washPaintAt)); washPaintAt = at;
          const angle = -30 + Math.sin((at - began) / 80) * 9;
          style(brush, "transform", `translate3d(${mouth.x - 8 + Math.sin((at - began) / 65) * 2}px,${mouth.y - 7}px,0) rotate(${angle}deg)`);
          style(brush, "--vc-body-room-light", String(roomLight));
        } else washPaintAt = 0;
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
      publishHomeCurtain(status);
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
          if (first) discover({ kind: "moment", id, source: { x: display.x, y: display.y - size * .4 } });
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
      let nativeResident = false;
      if (front && bedScene?.anchor.isConnected && paintedRegistration && !el.hidden && !pause && !premiereActive && !premiereBounce && !isDetailGuest() && !hiding && !homeOccluded) {
        const b = bedScene, right = b.left + b.width, bottom = b.top + b.height;
        const body = projectCompanionSofaBody({ ...projection, cell: paintedRegistration });
        const resident = companionSofaResident({ point: display, seat: support === "companion-home" ? supportById(support) : undefined,
          connected: b.anchor.isConnected && Boolean(localBedFront?.isConnected), held: Boolean(pressed || keyboardHeld || overlayDrag), placing: Boolean(placing || overlayPlacing),
          airborne: Boolean(flight || action?.kind === "jump" || playFalling || returning || homeDeparture),
          pickupTail: recoveringPickup || heldPivot || presentationNow - releasedPivotAt < 100 });
        nativeResident = Boolean(namedSofa?.bed.isConnected && resident);
        const jumping = action?.kind === "jump" && !flight && !returning && !pressed && !keyboardHeld && !placing;
        const progress = jumping ? sofaFlightProgress(performance.now()) : 0;
        const groundY = jumping && action ? lerp(origin.y, action.target.y, sofaPassage(progress)?.horizontal ?? progress) : undefined;
        sofaDepth = companionSofaDepth({ point: display, body, bed: { left: b.left, right, top: b.top, bottom }, seatY: b.anchorY, previous: jumping ? undefined : sofaDepth, resident, groundY });
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
          const nativeCloth = Boolean(namedSofa?.bed.isConnected);
          front.toggleAttribute("data-native-sofa", nativeCloth);
          style(front, "transform", nativeCloth ? "translate3d(0,0,0)" : `translate3d(${b.left.toFixed(3)}px,${b.top.toFixed(3)}px,0)`);
          style(front, "width", `${b.width}px`); style(front, "height", `${b.height}px`);
          style(front, "clip-path", nativeCloth
            ? `inset(${Math.max(0, b.clip.top - b.top)}px ${Math.max(0, right - b.clip.right)}px ${Math.max(0, bottom - b.clip.bottom)}px ${Math.max(0, b.clip.left - b.left)}px)`
            : `inset(${Math.max(0, b.clip.top - b.top, -b.top)}px ${Math.max(0, right - b.clip.right, right - innerWidth)}px ${Math.max(0, bottom - b.clip.bottom, bottom - innerHeight)}px ${Math.max(0, b.clip.left - b.left, -b.left)}px)`);
          if (front.hidden) front.hidden = false;
        } else hideBed();
      } else { sofaDepth = "clear"; data("sofaDepth", "clear"); hideBed(); }
      el.toggleAttribute("data-native-sofa", nativeResident);
      const actorOffset = nativeResident && bedScene ? { x: bedScene.anchorX, y: bedScene.anchorY } : { x: 0, y: 0 };
      style(el, "transform", `translate3d(${(display.x - size / 2 - actorOffset.x).toFixed(3)}px,${(display.y - size - actorOffset.y).toFixed(3)}px,0) scale(${display.scale})`);
      // One owner/write restores a released/outside body to1 immediately and
      // preserves premiere/hide fades without a transient1→room-alpha commit.
      style(el, "opacity", String(displayOpacity));
      if (el.hidden) stopHover();
      } finally {
        if (!watchPainted) watchPaintMs = watchPaintAt = 0;
      }
    };
    const displayedPoint = (): CompanionReturnPoint => {
      // Read before cancelling a finite WAAPI relocation, including its
      // halfway scale. These coordinates reconstruct this carrier transform
      // exactly; child facing/contact/pose never changes the world anchor.
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const anchor = el.hasAttribute("data-native-sofa") && namedSofa?.seat.isConnected ? namedSofa.seat.getBoundingClientRect() : undefined;
      return { x: matrix.m41 + size / 2 + (anchor?.left ?? 0), y: matrix.m42 + size + (anchor?.top ?? 0), scale: matrix.m11 || 1 };
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
      presence.focus(visibleActive(), pickupAt, true);
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
      const followedIds = [...new Set([support, action?.target.platformId, action?.attention?.goal?.targetId, ...(toys.current?.available().map(toy => toy.platformId) ?? [])].filter((id): id is string => Boolean(id)))];
      const keys = followedIds.join("\n");
      // A blocked frame may outlive the tracking window. Still consume its
      // pending layout change once before drawing at the old support point.
      if (!force && !anchorsDirty && (now > followUntil && now > scrollUntil || now === followedAt && keys === followedKeys)) return false;
      anchorsDirty = false;
      followedAt = now; followedKeys = keys;
      let returnMoved = false;
      if (foodDisposalAim && isFoodDisposal(action)) {
        const source = foodDisposalAim.element;
        const point = companionFoodDisposalTarget(source.getBoundingClientRect(), source.isConnected && !source.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]"));
        if (!point) { clearAction(); returnMoved = true; }
        else { returnMoved = point.x !== foodDisposalAim.point.x || point.y !== foodDisposalAim.point.y; foodDisposalAim.point = point; }
      }
      if (toyReturnAim && action?.toy?.effect === "stash") {
        const source = toyReturnAim.element;
        const point = companionToyReturnTarget(source.getBoundingClientRect(), source.isConnected && !source.parentElement?.closest("[hidden],[inert],[aria-hidden='true']"));
        if (!point) { clearAction(); returnMoved = true; }
        else {
          returnMoved = point.x !== toyReturnAim.point.x || point.y !== toyReturnAim.point.y;
          toyReturnAim.point = point;
        }
      }
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
      const shifts = new Map<string, (point: { x: number; y: number }) => { x: number; y: number }>();
      for (const sample of samples) {
        const id = sample.platform.id, before = anchorSeen.get(id), platform = supportById(id) ?? toyHomeContacts.find(p => p.id === id);
        const fromFrame = before?.frame ?? sample.sourceFrame, toFrame = sample.currentFrame;
        const fallback = before ? { x: sample.anchorX - before.x, y: sample.anchorY - before.y }
          : platform ? { x: sample.platform.x - platform.x, y: sample.platform.y - platform.y } : { x: 0, y: 0 };
        const deltaY = platform ? sample.platform.y - platform.y : fallback.y;
        shifts.set(id, point => fromFrame && toFrame ? companionSupportPointDelta(point, fromFrame, toFrame, deltaY) : fallback);
        anchorSeen.set(id, { x: sample.anchorX, y: sample.anchorY, ...(toFrame ? { frame: toFrame } : {}) });
        if (platform) {
          platform.x = sample.platform.x; platform.y = sample.platform.y; platform.width = sample.platform.width;
          if (sample.platform.heart) platform.heart = { ...sample.platform.heart };
        }
      }
      if (pressed || keyboardHeld || placing || flight) { supportMotion.reset(now); toys.current?.sync([...platforms, ...landingPlatforms], { width: innerWidth, height: innerHeight }, now, toyHomeContacts, toyAnchor); return bedMoved || returnMoved; }
      const shift = (id: string | undefined, point: { x: number; y: number }) => shifts.get(id ?? "")?.(point) ?? { x: 0, y: 0 };
      const from = shift(support, action ? origin : { x, y }), to = shift(action?.target.platformId ?? support, action ? action.target : { x, y });
      if (homeContact) { const moved = shift(support, homeContact.point); homeContact.point.x += moved.x; homeContact.point.y += moved.y; }
      let px = 0, py = 0;
      if (action) {
        const age = now - began, p = clamp(age / Math.max(1, total), 0, 1);
        if (action.kind === "jump") { const passage = sofaPassage(progress); px = passage?.horizontal ?? (travel > 0 ? clamp((age - jumpAnticipation()) / travel, 0, 1) : travel === -2 || travel === -4 ? sampleCompanionTravel(p) : travel === -3 ? sampleCompanionTravel(clamp(p / .78, 0, 1)) : p); py = passage ? progress : travel === -1 ? p * p : px; }
        else if (playFalling) py = clamp(age / Math.min(650, total), 0, 1) ** 2;
        else if (action.kind === "walk") px = py = runUpCurve ? sampleCompanionRunUp(p) : sampleCompanionTravel(p);
        else if (action.kind === "heart" || action.kind === "hide") px = py = sampleCompanionTravel(clamp(age / Math.max(1, travel), 0, 1));
        const tripDelta = runTrip && !runTrip.foodId ? shift(support, { x: runTrip.x, y: origin.y }) : undefined;
        const hopDelta = runHop?.target.platformId === support ? shift(support, runHop.target) : undefined;
        origin.x += from.x; origin.y += from.y;
        if (tripDelta && runTrip) runTrip.x += tripDelta.x;
        if (hopDelta && runHop) { runHop.target.x += hopDelta.x; runHop.target.y += hopDelta.y; }
        action.target.x += to.x; action.target.y += to.y;
        if (action.effectPoint) { const effectDelta = shift(action.target.platformId ?? support, action.effectPoint); action.effectPoint.x += effectDelta.x; action.effectPoint.y += effectDelta.y; }
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
      toys.current?.sync([...platforms, ...landingPlatforms], { width: innerWidth, height: innerHeight }, now, toyHomeContacts, toyAnchor);
      return Boolean(dx || dy || bedMoved || returnMoved);
    };
    const continuousMotion = () => Boolean(expressionAnimating || performance.now() < interactionUntil || toys.current?.moving() || action?.toy?.effect === "stash" && toys.current?.carried() || isFoodDisposal(action) && food.current?.carried() || homeDeparture || premiereActive || premiereBounce || overlayDrag?.guest || guestKeyboardHeld || returning || heldInertia.sample(performance.now()).active || pickupScale !== 1 && performance.now() - pickupAt < 200 || pendingMonth || pressed || keyboardHeld || action && (action.accessory || action.radio || ["walk", "jump", "heart", "hide", "stretch", "shake", "eat", "play"].includes(action.kind)));
    const followLayout = (event?: Event) => {
      if (premiereActive && event?.target === window.visualViewport) { viewportResized(); return; }
      // A compact room can unmount while the creature is parked. Drop its
      // front immediately at the topology event, before the120ms rescan.
      if (bedScene && !bedScene.anchor.isConnected) {
        bedScene = undefined; syncRoomItemLight(); hideBed();
        if (isHomeSupport(support) && !pressed && !keyboardHeld && !placing && action?.kind !== "jump" && !playFalling) {
          homeOccluded = true; data("hiddenReason", "home"); el.hidden = true; stopHover();
        }
      }
      if (stopped || pause || premiereActive || isDetailGuest() || hiding) return;
      if (event?.type === "vic:side-panel" || event?.type === "vic:panel-section") sceneLayoutPending = true;
      const motionEvent = event?.type === "vic:layout-motion" || event?.type === "animationstart" || event?.type === "transitionrun";
      const nodes = [...new Set([support, action?.target.platformId, action?.attention?.goal?.targetId]
        .flatMap(id => { const element = id ? geometryTracker?.anchor(id)?.element : undefined; return element ? [element] : []; }))];
      if (bedScene?.anchor.isConnected) nodes.push(bedScene.anchor);
      const duration = companionLayoutMotionMs(event, nodes, event?.type === "scroll" ? 180 : FLIP_MS);
      if (motionEvent && !duration) return;
      // Real scroll/panel events own this short loop. Parked/quiet creatures
      // have no autonomous tracking, timers, geometry scans or brain ticks.
      const now = performance.now();
      // Opening a window can interrupt a real panel FLIP. A resident stays
      // inside that moving room, consuming only the already-open tail; window
      // activity itself never starts or extends background tracking.
      // A real user scroll still moves the room while an editor is open.
      // Only unrelated overlay activity consumes the old layout lease.
      const residentTail = overlayActive && event?.type !== "scroll";
      if (residentTail && now >= followUntil) return;
      anchorsDirty = true;
      if (!residentTail) {
        if (event?.type === "scroll") scrollUntil = now + 180;
        followUntil = Math.max(followUntil, now + duration + 80);
      }
      // Native scrolling already moved the room before this event. Commit its
      // resident and front in that same delivery; waiting for the next rAF
      // leaves the fixed pair separated from the scrolling sofa for a frame.
      const occupiedSofa = bedScene?.anchor.isConnected && (support === "companion-home" || front && !front.hidden);
      if (event?.type === "scroll" || event?.type === "vic:layout-motion" && occupiedSofa) {
        refreshAnchors(now, true, true);
        if (occupiedSofa) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
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
        // A native day may enter while its first scan was clipped. Use
        // the same120ms queue only inside this actual layout-motion lease.
        if (time < followUntil && offGeometry && !overlayActive && !workspaceBusyRef.current
          && [support, action?.target.platformId].some(id => Boolean(id && geometryTracker?.anchor(id)?.element))) offGeometry.revalidate();
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
      interruptedPersonalityItem = personalityDirector.current()?.itemId ?? interruptedPersonalityItem;
      personalityDirector.cancel(); routines.cancel(brain.current.activeMs);
      cancelTravelGoal();
      const revoked = cancelCompanionEpisode(brain.current, action);
      brain.current = revoked.brain; action = revoked.action;
      // Retain the already-selected curve of the current finite walk while
      // revoking its queued hop; changing that curve mid-stride would jump.
      runTrip = runHop = undefined;
      for (const key of ["data-episode", "data-episode-phase", "data-episode-variant", "data-episode-food"]) el.removeAttribute(key);
    };
    const cancelHousehold = () => { household.cancel(); const carried = food.current?.carried(); if (carried) food.current?.releaseCarry(carried); if (action?.household) action = { ...action, household: undefined }; el.removeAttribute("data-household"); };
    const clearAction = (preserveEpisode = false, preserveHousehold = false, preserveScene = false, preserveHomeLife = false) => { if (!preserveHomeLife) cancelHomeLife(); witnessedCheerHops = 0; aftertastePaintAt = aftertastePaintMs = 0; el.removeAttribute("data-food-aftertaste"); activityArrival=undefined; el.dataset.lifePurpose="ordinary"; if (!preserveScene && action?.personalityScene?.id.startsWith("entry-") && !personalityDirector.entryReady()) personalityDirector.cancel(); clearHomeContact(); sleepPaintAt = 0; watchPaintMs = watchPaintAt = 0; if (washTool.current) washTool.current.hidden = true; el.removeAttribute("data-washing"); if (!preserveScene) { scenes.cancel(); toyPlanner.cancel(brain.current.activeMs); toys.current?.cancel(performance.now()); } if (!preserveHousehold) cancelHousehold(); el.removeAttribute("data-food-curiosity"); clearThrow(); sofaTravelActive = false; sofaFlightShape = undefined; ballisticCoefficient = null; el.removeAttribute("data-sofa-flight"); if (!preserveEpisode) { jumpRecoveryContext = undefined; brain.current = { ...brain.current, episode: undefined }; el.removeAttribute("data-episode"); el.removeAttribute("data-episode-phase"); el.removeAttribute("data-episode-variant"); el.removeAttribute("data-episode-food"); el.removeAttribute("data-food-goal"); } else if (brain.current.episode) data("episodePhase", brain.current.episode.phase); if (homeDeparture?.flying) homeDeparture = undefined; action = null; toyReturnAim = undefined; toyReturnPainted = undefined; foodDisposalAim = undefined; foodDisposalPainted = undefined; heldShake.reset(); shakenReleasePending = undefined; shakenGroundColumn = undefined; runTrip = runHop = undefined; runUpCurve = false; el.removeAttribute("data-trip"); el.removeAttribute("data-run-up"); el.removeAttribute("data-held-dizzy"); food.current?.nibble(); heartResult = null; sleeping = false; playImpact = playFalling = panelImpact = false; el.removeAttribute("data-attention"); el.removeAttribute("data-intent"); el.removeAttribute("data-play"); el.removeAttribute("data-play-beat"); el.removeAttribute("data-heart-result"); el.removeAttribute("data-dreaming"); el.removeAttribute("data-grab-ready"); if (effect.current) { effect.current.getAnimations().forEach(animation => animation.cancel()); effect.current.textContent = ""; effect.current.removeAttribute("style"); paintedStyles.delete(effect.current); } };
    const clearForPetting = () => {
      cancelManualWash();
      petResponse = [];
      const invitation = scenes.current()?.id === 10;
      if (invitation && action?.scene?.id === 10) scenes.complete(action as CompanionSceneAction);
      clearAction(false, false, invitation);
    };
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
      resetInertia(); if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming");
      offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true);
      paint(presence.pose.row, 0, presence.pose.status);
      return true;
    };
    const supportedNow = () => { const p = supportById(support); return Boolean(p && Math.abs(y - p.y) <= 2 && x >= p.x && x <= p.x + p.width); };
    const accessorySpace = (id: CompanionAccessoryId) => {
      const occupied = supportById(support);
      const headroom = Math.min(y, ...platforms.filter(p => p.id !== support && p.y < y - 2 && x + size / 2 > p.x && x - size / 2 < p.x + p.width).map(p => y - p.y));
      return canStartCompanionAccessoryMotion({ id, roam: effective.roam, stable: supportedNow(), safe: Boolean(occupied && !occupied.manualOnly && !isHomeSupport(support) && !["hide", "control"].includes(occupied.kind ?? "")), headroom, edgeClearance: occupied ? Math.min(x - occupied.x, occupied.x + occupied.width - x) : 0, energy: brain.current.energy });
    };
    const musicAllowed = () => instrumentAudible && preferences.enabled && radioPreferences.react && effective.roam && visibleActive() && !document.hidden && !pause && !overlayActive && !overlayRef.current && !workspaceBusyRef.current && !blocked && !reduced && !["off", "soft"].includes(gfxMode()) && !premiereActive && !premiereBounce && !(premiereRef.current.cue?.generation && premiereRef.current.cue.phase !== "idle") && presence.phase === "active";
    const radioAllowed = () => musicAllowed() && radioPreferences.enabled && radioPreferences.volume > 0;
    const radioSpace = (foodCount: number, instrument = false) => {
      const occupied = supportById(support);
      const headroom = Math.min(y, ...platforms.filter(p => p.id !== support && p.y < y - 2 && x + size / 2 > p.x && x - size / 2 < p.x + p.width).map(p => y - p.y));
      const mealPriority = companionRadioFoodPriority({ feeding: effective.feeding, hunger: brain.current.hunger, availableFoods: foodCount });
      const busy = Boolean(action && !action.radio || pressed || keyboardHeld || placing || overlayDrag || overlayPlacing || hoverPetting || performance.now() < petUntil || homeJourney || pendingHomeRecall || returning || pendingMonth || waitingForSupport || afterPetLanding || restAfterLanding || mealPriority || brain.current.hunger >= .75 || brain.current.foodGoal || brain.current.intention || brain.current.episode);
      return (instrument ? musicAllowed() : radioAllowed()) && paintedTexture?.complete && paintedTexture.naturalWidth > 0 && canStartCompanionRadioReaction({ enabled: preferences.enabled, react: radioPreferences.react, roam: effective.roam, focused: visibleActive(), hidden: document.hidden, reduced, graphics: gfxMode(), stable: supportedNow(), safe: Boolean(occupied && (!occupied.manualOnly || support === "companion-home") && !["hide", "control"].includes(occupied.kind ?? "")), busy, headroom, edgeClearance: occupied ? Math.min(x - occupied.x, occupied.x + occupied.width - x) : 0, energy: brain.current.energy });
    };
    const releaseHold = () => { resetInertia(); const held = pressed; pressed = null; keyboardHeld = false; if (held && button.hasPointerCapture(held.id)) button.releasePointerCapture(held.id); };
    const startRest = () => {
      const cozy = isHomeSupport(support) && !reduced && gfxMode() !== "off";
      const rest: RuntimeAction = { kind: "sleep", target: { x, y, platformId: support }, duration: 12000, ...(cozy ? { living: "cozy" as const } : {}) };
      if (cozy && effective.enabled && effective.roam && presence.phase === "active") launch(rest, performance.now());
      else { action = rest; began = performance.now(); total = 12000; }
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
      const petOwnership = { brain: brain.current, preferences: effective, carriedToyId: toys.current?.carried(), carriedFoodId: food.current?.carried() };
      if (!guest) { pendingMonth = false; awaitingAtX = false; afterPetLanding = !supportedNow(); restAfterLanding = false; clearForPetting(); personalityDirector.interruptForPetting(petOwnership); }
      petUntil = performance.now() + (reduced ? 650 : COMPANION_TIMING.petReward);
      petResponse = guest || reduced || gfxMode() !== "full" ? [] : [...companionPettingResponse(preferences.personality, effective)];
      petResponseUntil = petUntil + 8000;
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
    // The authored detail guest retains its existing focused-window exception;
    // an ordinary resident follows the shared visible-background permission.
    const hoverEligible = () => !pause && !workspaceBusyRef.current && !premiereActive && !premiereBounce && !returning && !el.hidden && (isDetailGuest() ? document.hasFocus() && !document.hidden : visibleActive()) && preferences.petting && (isDetailGuest() ? !overlayDrag && !guestKeyboardHeld : !hiding && !overlayActive && presence.phase === "active" && !pressed && !keyboardHeld && !placing && !pendingMonth && !awaitingAtX && !(action && ["walk", "jump", "heart", "hide", "eat"].includes(action.kind)));
    const canHover = (point: { x: number; y: number }) => hoverEligible() && pettingWindow.contains(pettingPoint(point), pettingBase, performance.now());
    const stopHover = () => {
      petting.reset(); touch.reset(); pettingWindow.reset(); hoverPetting = false; hoverPoint = undefined;
      interactionUntil = 0; hoverTarget = null;
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
      // Keep every gesture/inertia sample, but commit contact/body once
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
      hoverTarget = target;
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
      if (isDetailGuest() && (moving || touch.sample(now).pressure > 0)) guestUntil = now + 600;
      if (!result.stroking) { inputPaint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); return; }
      if (!hoverPetting) {
        hoverStarted = petStarted = now;
        if (!isDetailGuest()) { afterPetLanding = !supportedNow(); restAfterLanding = false; clearForPetting(); }
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
      cancelManualWash();
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
      else if (reduced) { x = platformLandingX(home, home.x + home.width / 2); y = home.y; support = home.id; cancelHomeJourney(); if (!visibleActive()) presence.focus(false, now); if (preferences.sleep && visibleActive()) startRest(); else nextDecision = now + 1200; }
      else if (!supportedNow()) settle({ x, y });
      cancelAnimationFrame(raf); clearTimeout(timer); schedule();
      setAnnouncement("빅타민이 포근한 자리로 돌아가요.");
    };
    const manualFeedAllowed = () => !stopped && !pause && !overlayActive && !overlayRef.current && !document.hidden && !premiereActive && !hiding && !workspaceBusyRef.current && preferencesRef.current.enabled && preferencesRef.current.feeding;
    const manualFeedSource = (source: HTMLElement) => source.isConnected && source === document.querySelector(".vc-home .vc-dispenser-slot") && !source.parentElement?.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]");
    const emitManualFeed = ({ source, kind }: CompanionFeedCommand<HTMLElement>) => {
      const outlet = source.getBoundingClientRect();
      if (outlet.width <= 0 || outlet.height <= 0) return;
      const id = food.current?.spawn(kind, { x: outlet.left + outlet.width / 2, y: outlet.bottom + 2 }, source, false, undefined, toys.current?.occupied(), (geometryTracker?.landings() ?? []).filter(p => isHomeFloor(p.id)));
      if (id) playCompanionSound("feed", preferencesRef.current);
      return id;
    };
    control.current = {
      place: () => { if (!hiding && !isDetailGuest() && preferences.drag) {
        beginManualTransfer();
        radioInbox.clear();
        instrumentInbox.clear();
        cancelHomeJourney();
        if (overlayActive) { overlayPlacing = true; el.dataset.placing = ""; setAnnouncement("빅타민을 놓을 곳을 한 번 눌러 주세요."); return; }
        interruptReturn(); stopHover(); awaitingAtX = false; pendingMonth = false; clearAction(); releaseHold(); petUntil = 0; afterPetLanding = false; restAfterLanding = false; placing = true; el.dataset.placing = "";
      } },
      rest: () => { cancelManualWash(); if (!hiding && preferences.sleep) { radioInbox.clear(); instrumentInbox.clear(); cancelHomeJourney(); interruptReturn(); pendingMonth = false; clearAction(); releaseHold(); afterPetLanding = false; restAfterLanding = false; petUntil = 0;
        if (!supportedNow()) { settle({ x, y }); if (reduced) startRest(); else restAfterLanding = true; }
        else startRest();
      } },
      home: () => { if (hiding || pause || overlayActive || premiereActive || !document.hasFocus()) return; sceneEvent({ kind: "home-called", wallTime: Date.now() }); playCompanionSound("cushion", preferencesRef.current); recallHome(); },
      radio: () => { if (!pause && !overlayActive && !premiereActive && !workspaceBusyRef.current && document.hasFocus() && !document.hidden) { logActivity("ui.click", { target: getCompanionRadioToggleIntent() === "stop" ? "companion-radio-stop" : "companion-radio-play" }); void toggleCompanionRadio(); } },
      feed: () => {
        if (!manualFeedAllowed()) { pendingFeeds.cancel(); return; }
        radioInbox.clear();
        instrumentInbox.clear();
        pendingHomeRecall = undefined;
        const interruptedCleanup = household.currentCleanup();
        if (interruptedCleanup) sceneEvent({ kind: "cleanup-interrupted", ...interruptedCleanup });
        cancelHomeJourney();
        if (action?.accessory || action?.radio || action?.scene || action?.toy || action?.kind === "sleep") { clearAction(); presence.focus(true, performance.now(), true); nextDecision = performance.now(); }
        const kind = initialFixtureFood.current ?? randomCompanionFood(lastFood.current); initialFixtureFood.current = undefined; lastFood.current = kind;
        const source = document.querySelector<HTMLElement>(".vc-home .vc-dispenser-slot");
        if (!source || !manualFeedSource(source)) { pendingFeeds.cancel(); return; }
        const command = { source, kind, month: monthKey, settings: preferencesRef.current };
        // Do not let a later click overtake an earlier unprepared command.
        // A ready successful placement keeps its immediate input response.
        if (!pendingFeeds.pending() && geometryReady && emitManualFeed(command)) return;
        if (pendingFeeds.enqueue(command)) { connectGeometry(); geometryTracker?.revalidate(true); }
      },
      wash: () => {
        if (stopped || pause || hiding || overlayActive || premiereActive || workspaceBusyRef.current || pendingMonth || returning || pressed || keyboardHeld || placing || !document.hasFocus() || document.hidden || !preferencesRef.current.enabled) return;
        if (reduced || gfxMode() === "off") { setAnnouncement("씻는 동작은 생동감 있는 동작을 켜면 볼 수 있어요."); return; }
        const source = document.querySelector<HTMLElement>(".vc-home [data-home-action='wash']");
        if (!source || !manualWashVisible(source) || manualWashPending || personalityDirector.manualWash()) return;
        const carrying = Boolean(food.current?.carried() || toys.current?.carried() || action?.kind === "eat" || action?.household || action?.toy);
        if (!carrying) {
          radioInbox.clear(); instrumentInbox.clear(); pendingFeeds.cancel(); cancelHomeJourney(); interruptReturn(); stopHover();
          clearAction(); releaseHold(); petUntil = 0; afterPetLanding = restAfterLanding = false;
          brain.current = { ...brain.current, intention: undefined, foodGoal: undefined };
        }
        manualWashSource = source; manualWashPending = true; manualWashUntil = brain.current.activeMs + 30000;
        connectGeometry(); geometryTracker?.revalidate(true);
        const now = performance.now(); presence.focus(true, now, true); nextDecision = now;
        cancelAnimationFrame(raf); clearTimeout(timer); schedule();
        setAnnouncement(carrying ? "지금 하던 일을 마치면 패드에서 씻어요." : "빅타민이 샤워패드로 가서 씻어요.");
      },
      clearFood: () => { pendingHomeRecall = undefined; pendingFeeds.cancel(); food.current?.clear(); },
      toys: () => {
        if (pause || overlayActive || premiereActive || document.hidden) return;
        const box = document.querySelector<HTMLElement>(".vc-home [data-home-action='toys']"), rect = box?.getBoundingClientRect();
        if (!box || !rect || rect.width <= 0 || box.closest("[hidden],[inert]")) return;
        const opening = box.querySelector<HTMLElement>(".vc-toy-box-opening")?.getBoundingClientRect();
        if (!opening || opening.width <= 0 || opening.height <= 0) return;
        toys.current?.sync([...platforms, ...landingPlatforms], { width: innerWidth, height: innerHeight }, performance.now(), toyHomeContacts, toyAnchor);
        const cx = opening.left + opening.width / 2;
        const hint = [...toyHomeContacts, ...landingPlatforms].filter(p => !p.bodyOnly && (isCompanionHomeFloorFoodSupport(p.id) || isHomeFloor(p.id)) && p.y > opening.bottom)
          .sort((a, b) => Math.abs(platformLandingX(a, cx, 9) - cx) - Math.abs(platformLandingX(b, cx, 9) - cx))[0];
        if (!hint) return;
        const id = toys.current?.spawn({ x: cx, y: opening.bottom, platformId: hint.id }, performance.now(), false, food.current?.occupied());
        if (id) { personalityDirector.observeEffect("toy", brain.current.activeMs); humanToyAt = brain.current.activeMs; playCompanionSound("play", preferencesRef.current); nextDecision = performance.now(); schedule(); }
      },
      toyChanged: () => { if (!pause && !document.hidden && !stopped) { nextDecision = Math.min(nextDecision, performance.now() + 100); schedule(); } },
      toyReturned: () => { if (!toys.current?.count()) expressionCleanup++; personalityDirector.event("toy-returned", brain.current.activeMs); },
      toyTouched: () => {
        humanToyAt = brain.current.activeMs;
        const focusedItem = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.toyId : undefined;
        const ownedId = personalityDirector.current()?.itemId;
        if (ownedId && focusedItem === ownedId) yieldedPersonalityItem = interruptedPersonalityItem = ownedId;
        personalityDirector.cancel();
        if (action?.toyMishap) action = { ...action, toyMishap: undefined };
        toyMishapWitnessed = false;
        toyPlanner.cancel(brain.current.activeMs); toys.current?.cancel(performance.now()); toyPlanner.wake(brain.current.activeMs); scenes.cancel();
        if (action?.toy || action?.scene || action?.personalityScene || action?.homeLife) {
          if (["walk", "jump"].includes(action.kind)) { action = { ...action, toy: undefined, toyApproach: undefined, scene: undefined, personalityScene: undefined, personalitySignature: undefined, homeLife: undefined }; cancelHomeLife(); }
          else clearAction(false, false, true);
        }
        if (!pause && !document.hidden) schedule();
      },
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
      const floors = world.platforms.filter(p => isHomeFloor(p.id) && !p.bodyOnly && Math.abs(platformLandingX(p, centre) - centre) < 1)
        .sort((a, b) => Math.hypot(centre - x, a.y - y) - Math.hypot(centre - x, b.y - y)).slice(0, 2);
      for (const floor of floors) {
        const vertical = sampleSofaRoute({ kind: "jump", target: { x: centre, y: home.y, platformId: home.id }, duration: 950 }, { x: centre, y: floor.y }, .5, floor.id);
        if (!vertical?.safe) continue;
        const plan = planCompanionHomeReturn(brain.current, world, { ...effective, jump: !reduced }, { id: floor.id, x: centre });
        if (plan.state === "travel") return { id: floor.id, action: plan.action };
      }
    };
    const homeLifeInput = (phase: CompanionHomeLifePhase, allowBackground = false) => ({
      phase, personality: effective.personality, night: environment.current.night, inside: isHomeSupport(support),
      enabled: preferences.enabled && effective.enabled && effective.roam && !reduced && gfxMode() !== "off",
      active: !stopped && !pause && !document.hidden && !overlayActive && !premiereActive && !workspaceBusyRef.current
        && !pendingMonth && !returning && !homeJourney && geometryReady && presence.phase === "active" && supportedNow(),
      owned: Boolean(pressed || keyboardHeld || placing || overlayDrag || overlayPlacing || food.current?.carried() || toys.current?.carried()),
      lightLit: getCompanionHomeLight(), tv: getCompanionHomeTv(), canLight: canCompanionSetHomeLight(), canTv: canCompanionSetHomeTv(), allowBackground,
    });
    const homeLifeTarget = (original: RuntimeAction, ratio?: number) => {
      const world = homeRouteWorld();
      let target = { ...original.target };
      if (original.foodId) {
        const actual = accessibleCompanionFoods(food.current?.foods() ?? [], [...platforms,...landingPlatforms]).find(item => item.id === original.foodId);
        if (!actual) return;
        target = { x: actual.x, y: actual.y, platformId: actual.platformId };
      } else if (original.toy?.toyId && ["pick", "nudge", "decline"].includes(original.toy.effect ?? "")) {
        const actual = accessibleCompanionToys(toys.current?.available() ?? [], [...platforms,...landingPlatforms]).find(item => item.id === original.toy?.toyId);
        if (!actual) return;
        target = actual.stance ?? { x: actual.x, y: actual.y, platformId: actual.platformId };
      }
      const floor = world.platforms.find(platform => platform.id === target.platformId);
      if (!floor || floor.bodyOnly && original.personalityScene?.command.kind !== "wash") return;
      const cx = original.foodId || original.toy?.toyId ? target.x : ratio === undefined ? target.x : floor.x + floor.width * ratio;
      return { x: platformLandingX(floor, cx), y: floor.y, platformId: floor.id };
    };
    const homeLifeDuration = (step: Pick<CompanionAction, "kind" | "target">) => step.kind === "jump" ? 850
      : Math.max(220, Math.abs(step.target.x - x) / (effective.speed === "relaxed" ? 65 : effective.speed === "lively" ? 135 : 100) * 1000);
    // This finite queue retains the offered life goal while its own physical
    // control trips run. No timer, scene ACK, new food/toy or second agent loop.
    const advanceHomeLife = (now: number): boolean => {
      const pending = homeLifePending;
      if (!pending) return false;
      const input = homeLifeInput(pending.phase, !pending.original.petResponse && !pending.original.foodId && !pending.original.toy && !pending.original.household
        && !pending.original.scene && !pending.original.personalityScene && !pending.original.radio && brain.current.hunger < .65);
      if (!input.enabled || input.owned || pending.personality !== effective.personality || brain.current.activeMs > pending.deadline
        || pending.legs > 12 || pending.failures >= 3
        || pending.original.personalityScene && !pending.original.personalityScene.id.startsWith("working-") && !personalityDirector.owns(pending.original.personalityScene)) {
        cancelHomeLife(); if (!input.enabled) homeLifePolicy.clear(); nextDecision = now + 500; return true;
      }
      if (!input.active || now < pending.retryAt) { nextDecision = Math.max(now + 100, pending.retryAt); return true; }
      const decision = !input.inside && pending.phase === "outside" && pending.controlsReady
        ? { status: "ready" as const, plan: homeLifePolicy.current() } : homeLifePolicy.next(input);
      if (decision.status === "blocked") {
        // A human's fifteen-second control ownership is temporary, not an
        // acknowledgement. Keep this exact phase/exception and retry later.
        pending.retryAt = now + 500; nextDecision = pending.retryAt; return true;
      }
      if (decision.status === "command" && decision.command) {
        const element = homeContactElement(decision.command.kind), contact = element && homeContactPoint(decision.command.kind, element);
        const world = { ...homeRouteWorld(), animated: !reduced && gfxMode() !== "off" };
        const floor = contact && world.platforms.filter(platform => isHomeFloor(platform.id) && !platform.bodyOnly)
          .sort((a,b) => Math.abs(platformLandingX(a,contact.x)-contact.x)-Math.abs(platformLandingX(b,contact.x)-contact.x))[0];
        const stance = floor && contact ? { x: platformLandingX(floor,contact.x), y: floor.y, platformId: floor.id } : undefined;
        const job = planCompanionHomeLifeControl({ decision, world, preferences: effective, stance, contact: contact || undefined });
        if (!job) { pending.failures++; pending.retryAt = now + 500; nextDecision = pending.retryAt; return true; }
        pending.legs++; launch(job, now); return true;
      }
      pending.controlsReady = true;
      const target = homeLifeTarget(pending.original, pending.targetRatio);
      if (!target) { cancelHomeLife(); nextDecision = now + 500; return true; }
      const needsTravel = support !== target.platformId || Math.hypot(x-target.x,y-target.y) > 2;
      const route = needsTravel ? findCompanionToyRoute(homeRouteWorld(), target, homeRouteWorld().platforms, effective.jump)?.[0] : undefined;
      if (needsTravel && !route) { cancelHomeLife(); nextDecision = now + 500; return true; }
      const original = pending.original;
      const finalTravelLeg = route && ["walk", "jump"].includes(original.kind) && route.target.platformId === target.platformId
        && Math.hypot(route.target.x-target.x,route.target.y-target.y) <= 2;
      if (route && !finalTravelLeg) {
        // Resume at the original destination, never at an unconditional sofa
        // reset. Real item IDs and moving support coordinates were rechecked.
        const command = decision.plan?.commands[0];
        if (!command || !decision.plan) { cancelHomeLife(); nextDecision = now + 500; return true; }
        pending.legs++; launch({ ...route, duration: homeLifeDuration(route), pace: effective.personality === "sleepy" ? "amble" : "scoot",
          homeLife: { serial: decision.plan.serial, command, travel: true, returning: true } }, now); return true;
      }
      cancelHomeLife();
      launch(route ? { ...original, ...route, duration: homeLifeDuration(route) }
        : { ...original, target: { x, y, platformId: support }, ...(original.kind === "walk" || original.kind === "jump" ? { kind: "walk", duration: 220 } : {}) }, now);
      return true;
    };
    const offerHomeLife = (next: RuntimeAction, now: number) => {
      // A physical mishap or an actual bite owns its immediate reaction.
      // Household preparation cannot delay a cough, tap response or landing.
      if (next.homeLife || next.foodAftertaste || next.play && ["bonk-sad", "bonk-tears", "dizzy", "tumble", "slip-tumble", "slip", "bump"].includes(next.play)
        || !isHomeSupport(support) || next.personalityScene && (next.personalityScene.id.startsWith("entry-") || ["light", "tv"].includes(next.personalityScene.command.kind))) return false;
      const scene = next.personalityScene && (personalityDirector.homeLifeScene(next.personalityScene) ?? next.personalityScene);
      const phase = companionHomeLifePhaseFor({ action: next, inside: true, night: environment.current.night, scene });
      const input = homeLifeInput(phase, !next.petResponse && !next.foodId && !next.toy && !next.household && !next.scene && !next.personalityScene && !next.radio && brain.current.hunger < .65);
      if (!input.enabled || !input.active || input.owned) return false;
      const decision = homeLifePolicy.next(input);
      const requiredBlocked = decision.status === "blocked" && decision.plan?.commands.some(command => command.required
        && (command.kind === "light" ? command.lit !== input.lightLit : command.state !== input.tv));
      if (decision.status !== "command" && !requiredBlocked) return false;
      const floor = supportById(next.target.platformId ?? "");
      homeLifePending = { original: next, phase, personality: effective.personality, deadline: brain.current.activeMs + 30000,
        retryAt: now, legs: 0, failures: 0, ...(floor && floor.width > 0 ? { targetRatio: clamp((next.target.x-floor.x)/floor.width,0,1) } : {}) };
      // Preserve the coarse authored owner through real household preparation.
      const owner = next.personalityScene;
      if (owner) { data("homeLifeScene", owner.id); data("homeLifeSerial", String(owner.serial)); data("homeLifeBeat", String(owner.beat)); }
      else { el.removeAttribute("data-home-life-scene"); el.removeAttribute("data-home-life-serial"); el.removeAttribute("data-home-life-beat"); }
      data("homeLife", phase); advanceHomeLife(now); return true;
    };
    const launch = (next: RuntimeAction, now: number) => {
      if (offerHomeLife(next, now)) return;
      aftertastePaintMs = aftertastePaintAt = 0;
      const heldToy = toys.current?.carried(), actualToy = heldToy && toys.current?.item(heldToy);
      const toyPerformanceOffer = next.kind === "play" && (next.toy?.kind === "play" && ["put", "toss"].includes(next.toy.effect ?? "")
        || next.personalityJobEnd && next.personalityScene?.command.kind === "toy" && next.personalityScene.command.mode === "play");
      const expectedToy = next.toy?.toyId ?? next.personalityScene?.itemId;
      if (toyPerformanceOffer && actualToy && expectedToy && expectedToy !== actualToy.id) {
        if (next.personalityScene) personalityDirector.resolve(next.personalityScene, false, undefined, brain.current.activeMs);
        toyPlanner.cancel(brain.current.activeMs);
        toyPlanner.returnCarried(actualToy.id, brain.current.activeMs);
        nextDecision = now + 60; return;
      }
      if (toyPerformanceOffer && actualToy) {
        next = { ...next, toyPerformance: { id: actualToy.id, kind: actualToy.kind }, duration: companionToyPlayDuration(actualToy.kind) };
      }
      clearHomeContact();
      curiosityTossed = false;
      if (next.kind === "sniff" && next.toy && ["stash", "spawn"].includes(next.toy.effect ?? "")) {
        const element = document.querySelector<HTMLElement>(".vc-home [data-home-action='toys']"), rect = element?.getBoundingClientRect();
        const available = Boolean(element?.isConnected && !element.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]"));
        const approach = rect && planCompanionToyBoxApproach({ x, y, platformId: support }, supportById(support), rect, size, available);
        if (!element || !approach) { clearAction(); nextDecision = now + 500; return; }
        if (approach.kind === "walk") next = { ...next, kind: "walk", target: approach.target, duration: 220, pace: "amble",
          toy: { ...next.toy, effect: undefined, point: undefined },
          toyApproach: { element, effect: next.toy.effect === "stash" ? "stash" : "spawn", duration: next.duration } };
      }
      if (next.household?.kind === "tidy" || next.toy || next.scene?.effect?.kind === "pick" || next.personalityScene && (toys.current?.carried() || food.current?.carried())) ensureWardrobe(true);
      accessoryWitnessed = 0; accessoryLanded = false;
      verticalRecoveryX = undefined;
      let passage = sampleSofaRoute(next, { x, y }, .5);
      let sofaTransfer = next.kind === "jump" && (support === "companion-home" || next.target.platformId === "companion-home");
      if (sofaTransfer && (next.household || next.toy || next.foodId || next.scene || next.personalityScene || next.homeLife) && support === "companion-home" && (!passage || !passage.safe)) {
        // Leave through the measured cushion opening, then retain the errand
        // for its safe room-floor walk. A direct diagonal exit can cut the rim.
        const detour = planHomeFloorEntry();
        if (detour) {
          const candidate: RuntimeAction = { ...detour.action,
            ...(next.personalityScene ? { personalityScene: { ...next.personalityScene, travel: true }, personalitySignature: next.personalitySignature } : {}),
            ...(next.homeLife ? { homeLife: { ...next.homeLife, travel: true } } : {}),
            ...(next.foodId ? { foodId: next.foodId, intention: next.intention, episode: next.episode } : {}),
            ...(next.scene ? { scene: { ...next.scene, effect: undefined } } : {}),
            ...(next.household ? { household: { ...next.household, effect: undefined, point: undefined } } : {}),
            ...(next.toy ? { toy: { ...next.toy, effect: undefined, point: undefined } } : {}) };
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
            ...(next.personalityScene ? { personalityScene: { ...next.personalityScene, travel: true }, personalitySignature: next.personalitySignature } : {}),
            ...(next.homeLife ? { homeLife: { ...next.homeLife, travel: true } } : {}),
            attention: { kind: "reconsider", ...(goal ? { goal: { ...goal } } : { point: { ...next.target } }) },
            outcomes: [...(next.outcomes ?? []).slice(0, 2), { targetId: goal?.targetId ?? next.target.platformId ?? "", result: "blocked" }] };
          passage = undefined;
        }
      }
      const playful = !homeJourney && !overlayActive && !workspaceBusyRef.current && !premiereActive && presence.phase === "active" && !reduced && gfxMode() !== "off";
      const romp = playful && !next.homeLife && !next.personalityScene && !next.episode && !next.household && !next.scene && !next.toy ? planCompanionRomp({ action: next, from: { x, y }, platform: supportById(support), foods: food.current?.foods() ?? [], toys: toys.current?.available(), energy: brain.current.energy, cooldownReady: (brain.current.cooldowns.mishap ?? -Infinity) <= now }, preferences) : undefined;
      // A verified run-up shortens only this leg. Preserve the ultimate goal
      // and commit its actual duration/budget after selecting the takeoff.
      next = romp?.walk ?? next;
      const retainedLife = next.homeLife ? homeLifePending?.original : undefined;
      clearAction(false, Boolean(next.household || next.scene || next.personalityScene || retainedLife?.household || retainedLife?.scene || retainedLife?.personalityScene), Boolean(next.scene || next.toy || next.personalityScene || retainedLife?.scene || retainedLife?.toy || retainedLife?.personalityScene), Boolean(next.homeLife));
      homeLifeEffectApplied = homeLifeEffectSucceeded = false; householdEffectApplied = false; personalityEffectApplied = false; washContactMs = 0; washPaintAt = 0; sleepPaintMs = 0; sleepPaintAt = 0; toyEffectApplied = toyPerformanceWitnessed = toyMishapWitnessed = foodRefusalWitnessed = sceneEffectApplied = false;
      toyReturnAim = undefined; toyReturnPainted = undefined;
      foodDisposalAim = undefined; foodDisposalPainted = undefined;
      if (isFoodDisposal(next)) {
        const element = document.querySelector<HTMLElement>(".vc-home [data-companion-trash]");
        const point = element && companionFoodDisposalTarget(element.getBoundingClientRect(), element.isConnected && !element.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]"));
        if (element && point) foodDisposalAim = { element, point };
      }
      if (next.toy?.effect === "stash") {
        const element = document.querySelector<HTMLElement>(".vc-home [data-home-action='toys'] .vc-toy-box-opening");
        const point = element && companionToyReturnTarget(element.getBoundingClientRect(), element.isConnected && !element.parentElement?.closest("[hidden],[inert],[aria-hidden='true']"));
        if (element && point) toyReturnAim = { element, point };
      }
      if (next.scene) { data("scene", String(next.scene.id)); data("sceneBeat", String(next.scene.beat)); } else { el.removeAttribute("data-scene"); el.removeAttribute("data-scene-beat"); }
      if (next.toy) data("toyAction", next.toy.kind); else el.removeAttribute("data-toy-action");
      if (next.personalityScene) { data("personalityScene", next.personalityScene.id); data("personalitySerial", String(next.personalityScene.serial)); data("personalityBeat", String(next.personalityScene.beat)); data("personalityCommand", next.personalityScene.command.kind); } else { el.removeAttribute("data-personality-scene"); el.removeAttribute("data-personality-serial"); el.removeAttribute("data-personality-beat"); el.removeAttribute("data-personality-command"); }
      if (next.personalitySignature) data("personalityActivity", next.personalitySignature); else el.removeAttribute("data-personality-activity");
      const sceneKind = next.homeLife && !next.homeLife.travel ? next.homeLife.command.kind
        : next.personalityScene && !next.personalityScene.travel ? next.personalityScene.command.kind : undefined;
      const contactKind: HomeContactKind | undefined = sceneKind && ["tv", "light", "curtain", "radio"].includes(sceneKind) ? sceneKind as HomeContactKind
        : next.toy && ["spawn", "stash"].includes(next.toy.effect ?? "") ? "box"
        : next.household?.effect === "spawn" ? "dispenser" : next.household?.effect === "discard" ? "bin" : undefined;
      const contactElement = contactKind ? homeContactElement(contactKind) : null;
      const actualContact = contactKind && contactElement ? homeContactPoint(contactKind, contactElement) : undefined;
      if (contactKind && contactElement && actualContact) {
        const button = contactKind === "light" ? contactElement.closest<HTMLButtonElement>("button") : null, lampPaint = button?.querySelector<HTMLElement>(".vc-home-lamp-paint");
        homeContact = { serial: ++homeContactSerial, kind: contactKind, element: contactElement, point: actualContact, startedAt: now,
          lampPaint: button && lampPaint ? { button, paint: lampPaint,
            art: ["off","on"].map(state => button.querySelector<HTMLElement>(`.vc-home-lamp-art[data-lamp-state="${state}"]`)!),
            feedback: ["off","on"].map(state => button.querySelector<HTMLElement>(`.vc-home-lamp-cord-feedback[data-lamp-state="${state}"]`)!) } : undefined };
      }
      if (homeContact) ensureWardrobe(true);
      if (next.personalityScene?.command.kind === "wash" || homeContact) spriteSources[9].forEach(src => requestSprite.current(src));
      personalityActivity.record(next, { x, y }, brain.current.activeMs, effective.personality);
      agentActionGeneration = brain.current.habits?.generation ?? 0;
      agentActionPersonality = effective.personality;
      data("lifePurpose",companionLifePurpose(next));
      activityArrival={action:next,from:{x,y,platformId:support}};
      if (next.household) data("household", next.household.kind); action = next; origin = { x, y }; began = now; total = next.duration; travel = 0;
      if (next.living === "social") invitedUntil = now + total + 7000;
      if (next.foodCuriosity) data("foodCuriosity", next.foodCuriosity); else el.removeAttribute("data-food-curiosity");
      pocketCapture = undefined; pocketDrawn = pocketStashed = pocketEjected = false;
      if (next.accessory === "magic-pocket" && effective.rarePrank && next.scene?.id !== 27) {
        const candidate = food.current?.foods().filter(item => Math.abs(item.y - y) < 75 && Math.abs(item.x - x) < 140).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (candidate) pocketCapture = { id: candidate.id, kind: candidate.kind };
      }
      mealAnchored = false; mealWaited = 0;
      playPresentation = { started: false, waited: 0 };
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
        const beats = next.foodAftertaste ? [{ row: 23 }] : next.toyPerformance ? [{ row: 1 }, { row: 9 }] : COMPANION_PLAY_TIMING[next.play].beats;
        for (const row of new Set(beats.slice(0, 2).map(beat => beat.row))) spriteSources[row].forEach(src => requestSprite.current(src));
        preparedPlayRow = beats[0].row;
        preparedNextPlayRow = next.foodAftertaste ? 23 : next.toyPerformance ? 9 : companionNextPlayRow(next.play, 0, reduced || gfxMode() === "off");
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
        hiding = { target: hideCandidate, from: { x, y }, personalityScene: next.personalityScene };
        hideSeek.start(hideCandidate.eventId, presentationNow, next.personalityScene ? Math.min(3000, next.duration) : 12000 + Math.random() * 16000, Boolean(next.personalityScene));
        if (next.personalityScene) { action = { ...next, target: { ...hideCandidate.entry, platformId: support } }; }
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
        if (!visibleActive()) presence.focus(false, now);
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
    // Diagnostic-only snippet: the parent supplies the shared localhost-fixture
    // opt-in diagnostic143 logger and its document-wide24-record ceiling.
    const workDiagnosticLast = diagnostic143Enabled ? new Map<string,string>() : undefined;
    const workDiagnostic = (stage:string,facts:Readonly<Record<string,unknown>>) => {
      if(!workDiagnosticLast||!editingRef.current)return;
      const observed={personality:preferences.personality,...facts};
      const key=JSON.stringify(observed);if(workDiagnosticLast.get(stage)===key)return;
      workDiagnosticLast.set(stage,key);diagnostic143(`work-${stage}`,observed);
    };
    const workExpression = (): RuntimeAction | undefined => {
      const offer=workExpressions.offer();
      if(diagnostic143Enabled)workDiagnostic("offer",{available:Boolean(offer),session:offer?.session??null,ordinal:offer?.ordinal??null,clip:offer?.clip??null});
      if(!offer)return;
      const windows = overlayWindows().map(node => node.getBoundingClientRect());
      const clear = (point: { x: number; y: number }) => !windows.some(rect => point.x + size * .4 > rect.left - 6 && point.x - size * .4 < rect.right + 6 && point.y > rect.top - 6 && point.y - size * .76 < rect.bottom + 6);
      const current = supportById(support), world = homeRouteWorld();
      const meta: PersonalitySceneBeat = { id: `working-${preferences.personality}`, serial: -1, beat: offer.ordinal, command: { kind: "pose", pose: "bow" } };
      const grounded=Boolean(current&&supportedNow());
      if(diagnostic143Enabled)workDiagnostic("support",{current:Boolean(current),grounded,kind:current?.kind??null,currentHome:isHomeSupport(support),manual:current?.manualOnly===true,bodyOnly:current?.bodyOnly===true,x,y,worldPlatforms:world.platforms.length,normalPlatforms:platforms.length,windows:windows.length});
      if (!current || !grounded) return;
      const addressesAudience = !["sleepy", "homebody"].includes(preferences.personality);
      if (!addressesAudience && !clear({ x, y })) {if(diagnostic143Enabled)workDiagnostic("result",{result:"private-current-overlaps-editor"});return;}
      if (addressesAudience && (!companionMayAddressAudience(world) || !clear({ x, y }))) {
        const destinations = platforms.filter(companionOutsideSupport).flatMap(p => {
          const xs = [x, ...windows.flatMap(rect => [rect.left - size * .5 - 8, rect.right + size * .5 + 8])];
          return xs.map(cx => ({ x: platformLandingX(p, cx), y: p.y, platformId: p.id })).filter(clear);
        }).sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
        const tested:Readonly<Record<string,unknown>>[]|undefined=diagnostic143Enabled?[]:undefined;
        for (const point of destinations.slice(0,24)) {
          const route=findCompanionToyRoute(world,point,world.platforms,effective.jump),step=route?.[0];
          tested?.push({ordinal:tested.length,x:point.x,y:point.y,routeSteps:route?.length??null,firstKind:step?.kind??null,firstX:step?.target.x??null,firstY:step?.target.y??null,firstHome:step?isHomeSupport(step.target.platformId):null});
          if (step) {
            if(diagnostic143Enabled)workDiagnostic("result",{result:"travel-offered",candidates:destinations.length,tested});
            return { ...step, duration: step.kind === "jump" ? 900 : Math.max(250, Math.abs(step.target.x-x)/100*1000), pace: "amble", workExpression:offer, personalityScene: { ...meta, travel: true, command: { kind: "go", target: "novel-place" } }, personalitySignature: preferences.personality };
          }
        }
        if(diagnostic143Enabled)workDiagnostic("result",{result:"no-proved-first-hop",candidates:destinations.length,tested});return;
      }
      const clips: Record<CompanionPreferences["personality"], readonly (CompanionPlay | "sniff" | "stretch")[]> = {
        performer: ["cheer-rehearsal", "bow", "celebrate"], curious: ["sniff", "bow", "pounce"], affectionate: ["ask-petting", "lean-nuzzle", "bow"],
        sleepy: ["stretch", "doze-curl", "groom"], tidy: ["groom", "bow", "sniff"], mischievous: ["pounce", "tumble", "bow"],
        gourmet: ["sniff", "bow", "groom"], homebody: ["cozy-nest", "groom", "stretch"], balanced: ["bow", "cheer-rehearsal", "groom"],
      };
      const offered = clips[preferences.personality][offer.clip];
      const pose = companionWorkExpressionPose(offered,effective);
      if(diagnostic143Enabled)workDiagnostic("result",{result:"pose-offered",pose,currentHome:isHomeSupport(support)});
      if (pose === "sniff" || pose === "stretch") return { kind: pose, duration: 1000, target: { x, y, platformId: support }, workExpression:offer, personalityScene: { ...meta, command: { kind: "pose", pose } }, personalitySignature: preferences.personality };
      return { kind: "play", play: pose, duration: companionPlayDuration(pose), target: { x, y, platformId: support }, workExpression:offer, personalityScene: { ...meta, command: { kind: "pose", pose } }, personalitySignature: preferences.personality };
    };
    const tick = (now: number) => {
      if (manualWashSource && (!manualWashVisible(manualWashSource) || brain.current.activeMs > manualWashUntil)) cancelManualWash();
      if (manualWashSource && !manualWashPending && !personalityDirector.manualWash()) manualWashSource = undefined;
      inputPaintQueued = false;
      if (stopped || pause || premiereActive || freshHomePending || pendingPosition.current || hiding && overlayActive && (!hiding.sheet || !hiding.ready)) poseWitness.reset();
      if (stopped || pause) return;
      if (resetSceneSerial !== undefined) {
        const serial = resetSceneSerial; resetSceneSerial = undefined;
        if (action?.scene?.serial === serial) clearAction();
      }
      if (premiereActive) { tickPremiere(now); return; }
      if (freshHomePending) { lastTick = lastNeeds = lastCare = now; return; }
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
        presence.focus(visibleActive(), now, true); el.removeAttribute("data-dreaming");
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
        if (progress >= 1) { premiereBounce = undefined; premiereDisplay = undefined; el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); style(el, "opacity", "1"); nextDecision = now + 650; sceneEvent({ kind: "premiere-return" }); paint(6, 15, "land"); }
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
          if (hiding.personalityScene) personalityDirector.complete(hiding.personalityScene);
          resetHide(); clearAction(false, false, true); returnTargetValid = false;
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
      if (!encounterStarted && presence.phase === "active" && !document.hidden && !overlayActive) { encounterStarted = true; sceneEvent({ kind: "encounter", wallTime: Date.now() }); }
      if (sceneMonthPending && now >= monthReadyAt && geometryReady && supportedNow() && !overlayActive && !pressed && !keyboardHeld && !placing) { sceneMonthPending = false; sceneEvent({ kind: "month", empty: !platforms.some(p => p.kind === "card") }); }
      if (sceneLayoutPending && now >= followUntil && supportedNow() && !pressed && !keyboardHeld && !returning && !overlayActive) { sceneLayoutPending = false; sceneEvent({ kind: "layout" }); }
      if (radioState.playing && radioState.mood && radioAllowed() && presence.phase === "active") {
        if (radioSceneStarted < 0) radioSceneStarted = brain.current.activeMs;
        if (!radioSceneListened && brain.current.activeMs - radioSceneStarted >= 3000) { radioSceneListened = true; sceneEvent({ kind: "radio", mood: radioState.mood, listenedMs: brain.current.activeMs - radioSceneStarted }); }
      } else { radioSceneStarted = -1; radioSceneListened = false; }
      if (presence.phase === "active" && Math.floor(Date.now() / 60000) !== environmentMinute) {
        environmentMinute = Math.floor(Date.now() / 60000);
        const nextEnvironment = resolveCompanionHomeEnvironment(environmentContext.current ?? { slug: "vic", year: Number(monthKey.split("-")[0]), month: Number(monthKey.split("-")[1]) });
        environment.current = nextEnvironment;
        setHomeEnvironment(previous => previous.date.y === nextEnvironment.date.y && previous.date.m === nextEnvironment.date.m && previous.date.d === nextEnvironment.date.d && previous.season === nextEnvironment.season && previous.weather === nextEnvironment.weather && previous.band === nextEnvironment.band && previous.night === nextEnvironment.night && previous.sunlight === nextEnvironment.sunlight ? previous : nextEnvironment);
      }
      if (presence.phase !== "parked") { toys.current?.resume(now); toys.current?.tick(reduced || gfxMode() === "off" ? now + 2000 : now); }
      if (!returning && presence.phase === "active" && now - lastNeeds >= 250) {
        const elapsed = now - lastNeeds;
        brain.current = advanceBrain(brain.current, elapsed, preferences.learnFromYou, preferences);
        advanceCompanionTastes(elapsed, preferences.learnFromYou);
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
        if (overlayActive || supportedNow()) paint(presence.pose.row, (elapsed / (phase === "waking" ? COMPANION_TIMING.presenceWake : COMPANION_TIMING.presenceYawn)) * 15, presence.pose.status);
        else { stopHover(); el.hidden = true; }
        if (phase === "parked") {
          toys.current?.pause(now);
          resetInertia();
          if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming");
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
      if (!action && !personalityDirector.active() && !homeJourney && !overlayActive && presence.phase === "active" && effective.roam && effective.jump && preferences.sleep && preferences.personality === "homebody" && brain.current.hunger < .35 && !(food.current?.foods().length) && brain.current.activeMs >= homeRetryAt && lowPerch) {
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
      for (const [id, scattered] of scatteredFoods) {
        const landed = liveFoods.find(item => item.id === id && item.platformId);
        if (landed && Math.hypot(landed.x - scattered.from.x, landed.y - scattered.from.y) >= 52) { sceneEvent({ kind: "household", effect: "scatter", foodId: id, from: scattered.from, to: { x: landed.x, y: landed.y, platformId: landed.platformId } }); scatteredFoods.delete(id); }
        else if (brain.current.activeMs >= scattered.expires || !food.current?.contains(id)) scatteredFoods.delete(id);
      }
      if (manualLandingPending && !pressed && !keyboardHeld && !placing && supportedNow() && action?.kind !== "jump") {
        sceneEvent({ kind: "manual-land", recovered: manualLandingPending.recovered, point: { x, y, platformId: support }, place: isHomeSupport(support) ? "home" : supportById(support)?.kind === "card" ? "card" : "floor" }); manualLandingPending = undefined;
      }
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
      let cueSignature: ReturnType<typeof personalityActivity.choose>;
      if (brain.current.activeMs >= nextCueProbe) {
      nextCueProbe = brain.current.activeMs + 250;
      const notice = reactive.notice({
        world: { x, y, platformId: support, platforms: [...platforms, ...landingPlatforms.filter(p => p.manualOnly && liveFoods.some(item => item.platformId === p.id))], width: innerWidth, height: innerHeight, foods: liveFoods, pointer: pointer ? { ...pointer, stableMs: Math.max(0, now - pointerStableSince) } : undefined, animated: !reduced && gfxMode() !== "off" },
        brain: brain.current, preferences: effective, action, now: brain.current.activeMs, active: presence.phase === "active", grounded: supportedNow(), held: Boolean(pressed || keyboardHeld || placing), commanded: Boolean(homeJourney === "called" || pendingHomeRecall), busy: Boolean(workspaceBusyRef.current || overlayActive || premiereActive || returning || pendingMonth || action?.foodRefusal),
      });
      if (notice && !action?.personalityScene) { if (homeJourney === "automatic") cancelHomeJourney(); cancelTravelGoal(); clearAction(); nextDecision = now; data("notice", notice); }
      else if (action && !action.personalityScene && !action.foodRefusal && !homeJourney && !workspaceBusyRef.current && !overlayActive && !premiereActive && !returning && !pendingMonth
        && ["idle", "look", "walk"].includes(action.kind) && (toys.current?.count() || personalityActivity.due(brain.current.activeMs))
        && !pressed && !keyboardHeld && !placing && presence.phase === "active" && supportedNow() && !reduced && gfxMode() !== "off") {
        const actualToys = toys.current?.available() ?? [];
        const toyPlatforms = [...platforms, ...landingPlatforms.filter(p => p.manualOnly && (isHomeFloor(p.id) || actualToys.some(toy => toy.platformId === p.id) || liveFoods.some(food => food.platformId === p.id)) && !platforms.some(existing => existing.id === p.id))];
        const toysAvailable = accessibleCompanionToys(actualToys, toyPlatforms);
        const box = toysAvailable.length ? document.querySelector<HTMLElement>(".vc-home [data-home-action='toys']") : null, rect = box?.getBoundingClientRect();
        const boxFloor = rect && toyPlatforms.filter(p => isHomeFloor(p.id) && Math.abs(p.y - rect.bottom) <= 140)
          .sort((a, b) => Math.abs(platformLandingX(a, rect.left + rect.width / 2) - rect.left - rect.width / 2) - Math.abs(platformLandingX(b, rect.left + rect.width / 2) - rect.left - rect.width / 2))[0];
        const boxPoint = box && rect && boxFloor && rect.width > 0 && rect.height > 0 && !box.closest("[hidden],[inert],[aria-hidden='true']")
          ? { x: platformLandingX(boxFloor, rect.left + rect.width / 2), y: boxFloor.y, platformId: boxFloor.id } : undefined;
        const cueWorld = { x, y, platformId: support, platforms: toyPlatforms, width: innerWidth, height: innerHeight, foods: liveFoods, animated: true };
        const toyNotice = toysAvailable.length && toyPlanner.notice({ world: cueWorld, brain: brain.current, preferences: effective, now: brain.current.activeMs,
          toys: toysAvailable, count: toys.current?.count() ?? 0, box: boxPoint, tastes: toyTastes.current ?? undefined, action, active: true, grounded: true });
        if (!toyNotice && ["idle", "look"].includes(action.kind) && !action.foodId && !action.episode && !action.scene && !action.toy && !action.household && !action.radio && !action.accessory && !action.living
          && personalityActivity.due(brain.current.activeMs)) cueSignature = personalityActivity.choose(brain.current, cueWorld, effective, brain.current.activeMs);
        if (toyNotice || cueSignature) { cancelTravelGoal(); clearAction(); nextDecision = now; data("notice", toyNotice ? "toy" : "personality"); }
      }
      }
      // One finite response to an actual acknowledged touch. Urgent care or
      // another accepted task wins; queued expressions never earn a reward.
      if (petResponse.length && (now >= petResponseUntil || !effective.petting || reduced || gfxMode() !== "full" || workspaceBusyRef.current || overlayActive || homeJourney || brain.current.hunger >= .78 || brain.current.energy <= .18)) petResponse = [];
      if (petResponse.length && !action && now >= petUntil && now >= nextDecision && presence.phase === "active" && supportedNow() && !household.active() && !toyPlanner.active() && !food.current?.carried() && !toys.current?.carried()) {
        const [pose, ...remaining] = petResponse; petResponse = remaining;
        const target = { x, y, platformId: support };
        launch(pose === "sniff" || pose === "stretch" || pose === "look" ? { kind: pose, duration: 900, target, petResponse: true }
          : { kind: "play", play: pose, duration: companionPlayDuration(pose), target, petResponse: true }, now);
      }
      const workAvailable=workCanExpress();
      if(diagnostic143Enabled&&overlayActive)workDiagnostic("checkpoint",{workAvailable,editing:editingRef.current,geometryReady,presence:presence.phase,actionKind:action?.kind??null,actionDuration:action?.duration??null,totalMs:action?total:null,actionBegan:action?began:null,actionWorking:Boolean(action?.workExpression),homeJourney:homeJourney??null,workspaceBusy:workspaceBusyRef.current,decisionDue:now>=nextDecision});
      if (workAvailable && overlayActive && !action && !homeJourney && !workspaceBusyRef.current && presence.phase === "active" && geometryReady && now >= nextDecision) {
        const expression = workExpression(); if (expression) launch(expression, now);
      }
      if (!workCanExpress() && overlayActive && action?.personalityScene?.id.startsWith("working-")) { clearAction(); presence.focus(false, now); }
      if (!action && homeLifePending && now >= nextDecision && !overlayActive && !homeJourney && presence.phase === "active") advanceHomeLife(now);
      if (!action && !homeLifePending && !overlayActive && !homeJourney && !workspaceBusyRef.current && presence.phase === "active" && geometryReady && now >= nextDecision && (!isHomeSupport(support) || supportById(support))) {
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
        const householdWorld = { ...world, platforms: householdPlatforms };
        const signatureFirst = preflightCompanionPersonalityActivity(personalityActivity, brain.current, world, effective, brain.current.activeMs,
          { scene: Boolean(scenes.current()), household: household.active(), toy: toyPlanner.active(), home: Boolean(homeJourney), blocked: Boolean(overlayActive || premiereActive || pendingMonth || returning) }, cueSignature);
        const householdHome: CompanionHouseholdHome = {};
        if (!overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off") {
          for (const [key, selector] of [["dispenser", ".vc-home .vc-dispenser"], ["bin", ".vc-home [data-companion-trash]"]] as const) {
            const control = document.querySelector<HTMLElement>(selector), rect = control?.getBoundingClientRect();
            if (!control || control.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]") || !rect || rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight) continue;
            // A carried item reaches the bin through its own finite delivery
            // arc. The body only approaches a real safe floor, never the bin.
            const cx = rect.left + rect.width / 2, reach = size * .6 + rect.width / 2;
            const stance = householdPlatforms.filter(p => isHomeFloor(p.id) && !p.bodyOnly && Math.abs(platformLandingX(p, cx) - cx) <= reach && Math.abs(p.y - rect.bottom) < 100).sort((a, b) => Math.abs(platformLandingX(a, cx) - cx) - Math.abs(platformLandingX(b, cx) - cx))[0];
            if (stance) householdHome[key] = { x: platformLandingX(stance, cx), y: stance.y, platformId: stance.id };
          }
          const room = document.querySelector<HTMLElement>(".vc-home .vc-home-floor"), roomRect = room?.getBoundingClientRect();
          if (room?.isConnected && roomRect && roomRect.width > 0 && roomRect.height > 0 && roomRect.bottom > 0 && roomRect.top < innerHeight
            // The painted floor itself is decorative aria-hidden content.
            // Its visible measured surface remains physical; an inaccessible
            // enclosing home/panel still revokes the pantry immediately.
            && !room.closest("[hidden],[inert],[data-panel-collapsed]") && !room.parentElement?.closest("[aria-hidden='true']")) {
            const pantry = householdPlatforms.filter(p => isHomeFloor(p.id) && !p.bodyOnly && p.manualOnly && Math.abs(p.y - roomRect.bottom + COMPANION_HOME_FLOOR_INSET) < 2)
              .sort((a, b) => b.width - a.width)[0];
            if (pantry) householdHome.pantry = { x: platformLandingX(pantry, pantry.x + pantry.width / 2), y: pantry.y, platformId: pantry.id };
          }
        }
        if (sceneOutfit !== wardrobe.current.equipped) { sceneOutfit = wardrobe.current.equipped; sceneEvent({ kind: "accessory", id: sceneOutfit }); }
        const box = document.querySelector<HTMLElement>(".vc-home [data-home-action='toys']"), boxRect = box?.getBoundingClientRect();
        const boxFloor = boxRect && householdPlatforms.filter(p => isHomeFloor(p.id) && !p.bodyOnly && Math.abs(p.y - boxRect.bottom) <= 140).sort((a, b) => Math.abs(platformLandingX(a, boxRect.left + boxRect.width / 2) - boxRect.left - boxRect.width / 2) - Math.abs(platformLandingX(b, boxRect.left + boxRect.width / 2) - boxRect.left - boxRect.width / 2))[0];
        const toyBox = boxRect && boxFloor && box && !box.closest("[hidden],[inert],[aria-hidden='true']") ? { x: platformLandingX(boxFloor, boxRect.left + boxRect.width / 2), y: boxFloor.y, platformId: boxFloor.id } : undefined;
        const actualToys = toys.current?.available() ?? [];
        const toyPlatforms = [...householdPlatforms, ...landingPlatforms.filter(p => p.manualOnly && actualToys.some(toy => toy.platformId === p.id) && !householdPlatforms.some(existing => existing.id === p.id))];
        const settledToys = accessibleCompanionToys(actualToys, toyPlatforms);
        const toyWorld = { ...world, platforms: toyPlatforms };
        const toyMealPriority = companionToyFoodPriority(brain.current, toyWorld, effective);
        const personalityHome: PersonalityHome = { floor: householdHome.pantry, dispenser: householdHome.dispenser, box: toyBox, contacts: {} };
        const sofa = supportById("companion-home");
        if (sofa) personalityHome.sofa = { x: platformLandingX(sofa, sofa.x + sofa.width / 2), y: sofa.y, platformId: sofa.id };
        const pad = toyPlatforms.find(p => p.id === "companion-home-floor-400");
        if (pad?.bodyOnly) personalityHome.pad = { x: pad.x + pad.width / 2, y: pad.y, platformId: pad.id };
        for (const [key, selector] of [["tv", ".vc-home-tv"], ["light", ".vc-home-lamp"], ["window", ".vc-home-window"], ["radio", ".vc-radio-button"]] as const) {
          const element = document.querySelector<HTMLElement>(".vc-home " + selector), rect = element?.getBoundingClientRect();
          if (!element || !rect?.width || element.closest("[hidden],[inert],[data-panel-collapsed]") || element.parentElement?.closest("[aria-hidden='true']")) continue;
          const cx = rect.left + rect.width / 2;
          const floor = toyPlatforms.filter(p => isHomeFloor(p.id) && !p.bodyOnly)
            .sort((a,b) => Math.abs(platformLandingX(a,cx)-cx)-Math.abs(platformLandingX(b,cx)-cx))[0];
          if (floor) personalityHome[key] = { x: platformLandingX(floor,cx), y: floor.y, platformId: floor.id };
          const kind = key === "window" ? "curtain" : key;
          const contactElement = homeContactElement(kind), contact = contactElement && homeContactPoint(kind, contactElement);
          if (contact) {
            personalityHome.contacts![kind] = contact;
            // Looking through the window keeps its center. Operating its
            // curtain approaches the real cord at the edge of that window.
            const contactFloor = toyPlatforms.filter(p => isHomeFloor(p.id) && !p.bodyOnly)
              .sort((a,b) => Math.abs(platformLandingX(a,contact.x)-contact.x)-Math.abs(platformLandingX(b,contact.x)-contact.x))[0];
            if (contactFloor) personalityHome[kind] = { x: platformLandingX(contactFloor,contact.x), y: contactFloor.y, platformId: contactFloor.id };
          }
        }
        for (const toy of settledToys) {
          const stamp = `${toy.platformId}:${Math.round(toy.x)}:${Math.round(toy.y)}`;
          if (settledPersonalityToys.get(toy.id) !== stamp) {
            settledPersonalityToys.set(toy.id, stamp);
            if (brain.current.activeMs - humanToyAt < 8000) {
              personalityDirector.event("toy-settled", brain.current.activeMs);
              if (toys.current?.carried()) deferredPersonalityToy = toy.id;
            }
          }
        }
        for (const id of settledPersonalityToys.keys()) if (!toys.current?.ids().includes(id)) settledPersonalityToys.delete(id);
        const actualToyIds = toys.current?.ids() ?? [];
        if (deferredPersonalityToy && !actualToyIds.includes(deferredPersonalityToy)) deferredPersonalityToy = undefined;
        for (const id of storedPersonalityFoods) if (!liveFoods.some(food => food.id === id) && food.current?.carried() !== id) storedPersonalityFoods.delete(id);
        let priorityMeal = !manualWashPending && !personalityDirector.manualWash() && !food.current?.carried() && !toys.current?.carried() && !household.active() && !toyPlanner.active() && brain.current.hunger >= .78
          ? getFoodAction(brain.current, householdWorld, effective, now) : undefined;
        let foodSupply: RuntimeAction | undefined;
        const sceneMemory = effective.learnFromYou ? scenes.checkpoint() : undefined;
        // The actual audible source supplies mood; coarse local listening
        // familiarity never borrows unrelated food/toy experience.
        const music = radioState.playing && radioState.mood && radioAllowed() ? { mood: radioState.mood }
          : personalityMusic?.source === "instrument" && brain.current.activeMs - personalityMusic.at < 9000 && musicAllowed() && !radioState.playing ? { mood: personalityMusic.mood } : undefined;
        const sceneInput: PersonalitySceneInput = { world: toyWorld, brain: brain.current, preferences: effective, now: brain.current.activeMs, home: personalityHome, toys: settledToys, flyingToyIds: toys.current?.flyingIds(), experience: agentMemory,
            homeLifeControl: (command, context) => {
              const phase = companionHomeLifePhaseFor({ action: { kind: "look", target: { x,y,platformId:support } }, inside: isHomeSupport(support), night: environment.current.night,
                scene: { ...context, command } });
              const decision = homeLifePolicy.next(homeLifeInput(phase));
              if (decision.reason && ["off","inactive","ownership","outside","invalid"].includes(decision.reason)) return command;
              const desired = decision.plan?.commands.find(item => item.kind === command.kind);
              return command.kind === "light" && desired?.kind === "light" ? { ...command, lit: desired.lit }
                : command.kind === "tv" && desired?.kind === "tv" ? { ...command, state: desired.state } : command;
            },
            curtainPhase: curtainProjection.current.phase, lightLit: getCompanionHomeLight(), toyPlayCounts: effective.learnFromYou ? Object.fromEntries(Object.entries(toyTastes.current?.toyTastes ?? {}).map(([kind, taste]) => [kind, taste?.accepted ?? 0])) : undefined, familiarHour: (sceneMemory?.hours[Math.floor(environment.current.hour)] ?? 0) >= 3, learnedMorning: Boolean(sceneMemory?.hours.slice(7, 11).some(n => n >= 3)),
            favoriteToy: effective.learnFromYou ? summarizeCompanionToyTastes(toyTastes.current).favorite : null, toyCount: actualToyIds.length, carriedToyId: toys.current?.carried(), carriedFoodId: food.current?.carried(), deferredToyId: deferredPersonalityToy, interruptedItemId: interruptedPersonalityItem,
            tv: getCompanionHomeTv(), canTv: canCompanionSetHomeTv(), canCurtain: canCompanionSetCurtain(), radioAllowed: radioAllowed() && canCompanionSetRadio(), radioPlaying: radioState.playing, environment: environment.current, favoriteFood: brain.current.life?.favoriteFood,
            music: music && { ...music, familiar: Boolean(effective.learnFromYou && music.mood && (sceneMemory?.music[music.mood] ?? 0) >= 3) },
            learnedSocial: effective.learnFromYou && Boolean(brain.current.life?.recent.some(reason => reason === "kind-touch" || reason === "reassured")), equipped: Boolean(wardrobe.current.equipped), hasExperience: effective.learnFromYou && Boolean(loadCompanionCollection().foods.length || Object.keys(toyTastes.current?.toyTastes ?? {}).length),
            yieldedItem: Boolean(yieldedPersonalityItem && brain.current.activeMs - humanToyAt < 8000), yieldedItemId: yieldedPersonalityItem, storedFoodIds: [...storedPersonalityFoods] };
        if (manualWashPending && manualWashSource && manualWashVisible(manualWashSource)
          && !food.current?.carried() && !toys.current?.carried() && !household.active() && !toyPlanner.active() && !scenes.current()
          && personalityDirector.startManualWash(sceneInput)) manualWashPending = false;
        const manualWashing = personalityDirector.manualWash();
        const authoredOwnership = personalityDirector.routineOwnership(sceneInput);
        const approvedContinuationReady = personalityDirector.pendingApprovedContinuationReady(sceneInput);
        const authoredReserved = Boolean(authoredOwnership) || approvedContinuationReady;
        if (!manualWashing && !priorityMeal && (!authoredReserved || brain.current.hunger >= .78) && !liveFoods.length && !food.current?.carried() && !toys.current?.carried() && !household.active() && !toyPlanner.active()
          && householdHome.dispenser && brain.current.hunger >= (effective.personality === "gourmet" ? COMPANION_FULL_THRESHOLD : .65) && brain.current.activeMs >= nextSupplyAt) {
          nextSupplyAt = brain.current.activeMs + 2000;
          household.wake(brain.current.activeMs);
          foodSupply = household.next({ brain: brain.current, world: householdWorld, preferences: effective, now: brain.current.activeMs, home: householdHome,
            count: 0, occupied: toys.current?.occupied(), intent: "feed" });
          if (foodSupply) personalityDirector.cancel();
        }
        if (routines.current() && !personalityDirector.current()?.routine) routines.cancel(brain.current.activeMs);
        const routineOwner = Boolean(household.active() || toyPlanner.active() || food.current?.carried() || toys.current?.carried() || personalityDirector.current()?.routine);
        if (!priorityMeal && !foodSupply && !routineOwner) {
          const meal = effective.feeding ? getFoodAction(brain.current, householdWorld, effective, now) : undefined;
          const canSupply = Boolean(effective.feeding && liveFoods.length < 8 && householdHome.dispenser && findCompanionToyRoute(householdWorld, householdHome.dispenser, householdPlatforms, effective.jump));
          const request = routines.next({ ...sceneInput, active: !overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off" && !workspaceBusyRef.current && presence.phase === "active",
            entryReady: personalityDirector.entryReady(), owned: routineOwner, authoredReserved, authoredLeisure: authoredOwnership === "leisure",
            canOuting: !personalityDirector.cleanupPending(sceneInput) && !personalityDirector.cleanupFollowupReady(sceneInput) && !personalityDirector.mealFollowupReady(sceneInput),
            meal: { foodId: meal?.foodId, canSupply } });
          if (request && !personalityDirector.startRoutine(request.recipe, brain.current.activeMs, request.itemId, request.outsideGoal)) routines.cancel(brain.current.activeMs);
        }
        const publicLifeOffer = personalityDirector.entryReady() && !approvedContinuationReady && !priorityMeal && !foodSupply && !personalityDirector.active() && !household.active() && !toyPlanner.active()
          && !food.current?.carried() && !toys.current?.carried() && !personalityDirector.cleanupPending(sceneInput) && !personalityDirector.cleanupFollowupReady(sceneInput) && !scenes.current()
          && !overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off"
          ? publicLife.next({world:householdWorld,brain:brain.current,preferences:effective,now:brain.current.activeMs}) : undefined;
        let authoredOffer = !publicLifeOffer && !priorityMeal && !foodSupply && (personalityDirector.active() || !household.active() && !toyPlanner.active() && !food.current?.carried() && !toys.current?.carried() && !brain.current.foodGoal && !(brain.current.episode && brain.current.episode.remaining > 0 && brain.current.episode.phase !== "finish")) && !overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off"
          ? nextCompanionPersonalityScene(personalityDirector, sceneInput) : undefined;
        let yieldedMeal = false;
        if (!manualWashing && !priorityMeal && !foodSupply) {
          priorityMeal = getCompanionPersonalityMeal(personalityDirector, authoredOffer, { world: householdWorld, brain: brain.current, preferences: effective,
            now: brain.current.activeMs, carriedToy: toys.current?.carried(), carriedFood: food.current?.carried(), ownedJob: household.active() || toyPlanner.active(),
            authoredReserved: personalityDirector.routineReserved(sceneInput) }, now);
          if (priorityMeal) { yieldedMeal = true; personalityDirector.cancel(); authoredOffer = undefined; }
        }
        const authored = authoredOffer ? personalityJobs.next(authoredOffer, { world: toyWorld, brain: brain.current, preferences: effective, now: brain.current.activeMs,
          home: householdHome, box: toyBox, toys: settledToys, toyIds: toys.current?.ids(), carriedToy: toys.current?.carried(), carriedFood: food.current?.carried(),
          toyCount: toys.current?.count() ?? 0, foodCount: liveFoods.length + (food.current?.carried() ? 1 : 0), occupied: toys.current?.occupied(), tastes: toyTastes.current ?? undefined }, now) : undefined;
        const errand = !publicLifeOffer && !foodSupply && !authoredOffer && !priorityMeal && !signatureFirst && !scenes.current() && !toyPlanner.active() && !overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off"
          ? household.next({ brain: brain.current, world: householdWorld, visibleFoods: liveFoods, preferences: effective, now: brain.current.activeMs, home: householdHome, count: liveFoods.length + (food.current?.carried() ? 1 : 0), carried: food.current?.carried(), occupied: toys.current?.occupied() }) : undefined;
        if (!authoredOffer && !errand && !scenes.current() && food.current?.carried()) food.current.releaseCarry(food.current.carried()!);
        if (toyMealPriority && toyPlanner.active() && !authoredOffer) { toyPlanner.cancel(brain.current.activeMs); toys.current?.cancel(now); }
        const toyErrand = !publicLifeOffer && !foodSupply && !authoredOffer && !priorityMeal && !signatureFirst && !toyMealPriority && !errand && !scenes.current() && !overlayActive && !premiereActive && !pendingMonth && !returning && !reduced && gfxMode() !== "off"
          ? toyPlanner.playfulCarry({ x, y, platformId: support }) ?? toyPlanner.next({ world: toyWorld, brain: brain.current, preferences: effective, now: brain.current.activeMs, toys: settledToys, existingIds: toys.current?.ids(), carriedId: toys.current?.carried(), count: toys.current?.count() ?? 0, box: toyBox, tastes: toyTastes.current ?? undefined }) : undefined;
        const offeredRadio = radioInbox.peek(radioState, now);
        const reaction = !publicLifeOffer && !errand && offeredRadio?.mood && radioSpace(availableFood.length) ? getCompanionRadioReaction({ mood: offeredRadio.mood, preferences: effective, habits: brain.current.habits, life: brain.current.life, energy: brain.current.energy }) : undefined;
        const played = !publicLifeOffer && !errand && !radioState.playing && radioSpace(availableFood.length, true) ? instrumentInbox.take(now) : undefined;
        const instrumentReaction = played && getCompanionInstrumentReaction({ mood: played.pulse.mood, quality: played.quality, preferences: effective, life: brain.current.life, energy: brain.current.energy });
        const musical: RuntimeAction | undefined = !authoredOffer && reaction && reaction !== "ignore" && offeredRadio ? { kind: "look", radio: { generation: offeredRadio.generation, reaction, bpm: offeredRadio.bpm }, target: { x, y, platformId: support }, duration: COMPANION_RADIO_REACTION_MS }
          : instrumentReaction && instrumentReaction !== "ignore" && played ? { kind: "look", radio: { generation: 0, reaction: "sway", instrument: instrumentReaction, bpm: played.pulse.bpm }, target: { x, y, platformId: support }, duration: COMPANION_RADIO_REACTION_MS } : undefined;
        const equipped = wardrobe.current.equipped;
        const pocketAllowed = equipped === "magic-pocket" && effective.rarePrank && !companionRadioFoodPriority({ feeding: effective.feeding, hunger: brain.current.hunger, availableFoods: availableFood.length });
        const specialAllowed = !["magic-pocket", "propeller-hat"].includes(equipped ?? "") || effective.rarePrank;
        const safeTrick = !publicLifeOffer && !errand && !musical && equipped && specialAllowed && effective.roam && wardrobePainter?.accessoryReady() && paintedTexture?.complete && paintedTexture.naturalWidth > 0 && brain.current.activeMs >= accessoryReadyAt && (!availableFood.length || pocketAllowed) && brain.current.hunger < .75 && !brain.current.foodGoal && !brain.current.intention && !brain.current.episode && !returning && !pendingMonth && !reduced && !["off", "soft"].includes(gfxMode()) && (!isCompanionHat(equipped) || effective.jump)
          && accessorySpace(equipped);
        const refusal = !publicLifeOffer && !errand && !toyErrand && !musical && !safeTrick && !scenes.current() && !household.active() && !toyPlanner.active()
          ? personalityActivity.refuseFood(brain.current, world, effective, toyTastes.current, loadCompanionCollection().foods, brain.current.activeMs) : undefined;
        const signature = !publicLifeOffer && !authoredOffer && !refusal && !errand && !toyErrand && !musical && !safeTrick && !scenes.current() && !household.active() && !toyPlanner.active()
          ? cueSignature ?? signatureFirst ?? personalityActivity.choose(brain.current, world, effective, brain.current.activeMs) : undefined;
        const story = !publicLifeOffer && !authoredOffer && !refusal && !signature && !errand && !toyErrand && !household.active() && !toyPlanner.active() && !overlayActive && !premiereActive && !returning
          ? scenes.next({ brain: brain.current, world: householdWorld, preferences: effective, now: brain.current.activeMs, pantry: householdHome.pantry, bin: householdHome.bin, visibleFoods: liveFoods, occupied: toys.current?.occupied(), knownFoods: loadCompanionCollection().foods, knownBehaviors: loadCompanionCollection().behaviors, owned: loadCompanionCollection().gifts.unlocked, equipped, radio: radioState, environment: environment.current, home: supportById("companion-home") ? { x: platformLandingX(supportById("companion-home")!, supportById("companion-home")!.x + supportById("companion-home")!.width / 2), y: supportById("companion-home")!.y, platformId: "companion-home" } : undefined, toyCount: toys.current?.count() ?? 0, carriedFoodId: food.current?.carried() }) : undefined;
        const validStory = story?.accessory && !accessorySpace(story.accessory) ? undefined : story;
        if (story && !validStory) scenes.cancel();
        const offered: RuntimeAction = priorityMeal ?? foodSupply ?? authored ?? errand ?? toyErrand ?? publicLifeOffer ?? refusal ?? validStory ?? musical ?? signature ?? (safeTrick ? { kind: "look", accessory: equipped!, target: { x, y, platformId: support }, duration: COMPANION_ACCESSORY_MOTION_MS } : getAction(brain.current, world, effective, now));
        const progressed: RuntimeAction = boundCompanionStationaryProgress(offered, brain.current, householdWorld, effective, brain.current.activeMs,
          personalityDirector.progressDeadline(), boundary => personalityActivity.choose(brain.current, householdWorld, effective, brain.current.activeMs, boundary),
          Boolean(priorityMeal || foodSupply || authored || errand || toyErrand || publicLifeOffer || refusal || validStory || musical || signature || safeTrick
            || personalityDirector.active() || household.active() || toyPlanner.active() || food.current?.carried() || toys.current?.carried()
            || homeJourney || overlayActive || premiereActive || pendingMonth || returning || reduced || gfxMode() === "off" || workspaceBusyRef.current || presence.phase !== "active"));
        const diverse: RuntimeAction = personalityActivity.diversifyTravel(progressed,brain.current,householdWorld,effective,brain.current.activeMs,
          ()=>personalityActivity.choose(brain.current,householdWorld,effective,brain.current.activeMs,{deadline:brain.current.activeMs,nextDuration:1}),
          Boolean(priorityMeal || foodSupply || authored || errand || toyErrand || publicLifeOffer || refusal || validStory || musical || safeTrick
            || personalityDirector.active() || household.active() || toyPlanner.active() || food.current?.carried() || toys.current?.carried()
            || homeJourney || pressed || keyboardHeld || placing || pause || document.hidden || overlayActive || premiereActive || pendingMonth || returning || reduced || ["off","soft"].includes(gfxMode()) || workspaceBusyRef.current || presence.phase !== "active"));
        const chosen = personalityActivity.boundWander(diverse, world, effective, brain.current.activeMs);
        if (chosen !== offered) cancelTravelGoal();
        if (chosen.radio && reaction) radioInbox.take(radioState, now);
        if (musical?.radio) {
          const rows = musical.radio.reaction === "bored" ? [10, 1] : musical.radio.reaction === "sway" ? [1, 9] : musical.radio.reaction === "bounce" ? [9] : [1];
          const instrumentRow = musical.radio.instrument === "tease" ? 28 : musical.radio.instrument === "encourage" ? 29 : undefined;
          (instrumentRow === undefined ? rows : [instrumentRow]).forEach(row => spriteSources[row].forEach(src => requestSprite.current(src)));
        }
        if (safeTrick && !errand) { accessoryReadyAt = brain.current.activeMs + 45000; pendingCue = "play"; (isCompanionHat(equipped!) ? [3, 4] : [9]).forEach(row => spriteSources[row].forEach(src => requestSprite.current(src))); }
        const chosenFood = availableFood.find(item => item.id === chosen.foodId);
        if (chosenFood) lastFoodPoint = { id: chosenFood.id, x: chosenFood.x, y: chosenFood.y };
        const consumedFoods = chosenFood ? loadCompanionCollection().foods : [];
        const curiousMeal = !errand && !toyErrand && !validStory && !musical && !safeTrick && !reduced && gfxMode() !== "off"
          ? foodCuriosity.consider(chosen, chosenFood, Boolean(chosenFood && consumedFoods.includes(chosenFood.kind)), brain.current.hunger, effective, consumedFoods) : chosen;
        const curiousIntent = curiousMeal.foodCuriosity === "tease" && pointer ? { ...curiousMeal, direction: pointer.x < x ? -1 as const : 1 as const, attention: { kind: "social" as const, point: { ...pointer } } } : curiousMeal;
        // A nonurgent meal inherited from the ordinary planner keeps its
        // bounded first-food inspection. Urgent care/authored jobs still own
        // their existing actions, and no encounter is silently consumed.
        const ownedIntent = yieldedMeal ? curiousIntent : chosen;
        launch(priorityMeal || foodSupply || authored || errand || toyErrand || publicLifeOffer || refusal || validStory || musical || safeTrick || signature ? ownedIntent : deliberateCompanionAction(brain.current, world, effective, curiousIntent, !reduced && gfxMode() !== "off"), now);
        if (hiding) { paint(14, 0, "hide"); schedule(); return; }
      }
      let row = 0, frame = 0, status = "idle";
      if (action) {
        if (homeContact && ["light","tv","curtain","radio"].includes(homeContact.kind)) {
          const presentation = advanceCompanionHomeContactPresentation({ now, began, startedAt: homeContact.startedAt, delta, duration: total,
            active: homeContact.element.isConnected && effective.enabled && effective.roam && !pause && !document.hidden && !pressed && !keyboardHeld && !placing
              && !overlayActive && !workspaceBusyRef.current && presence.phase === "active" });
          began = presentation.began;
          if (presentation.expired || presentation.cancelled) {
            const failed = action;
            if (failed.personalityScene && !failed.personalityScene.travel) personalityDirector.resolve(failed.personalityScene, false, undefined, brain.current.activeMs);
            if (failed.homeLife && homeLifePending) { homeLifePending.failures++; homeLifePending.retryAt = now+500; }
            const retained = failed.homeLife ? homeLifePending?.original : undefined;
            clearAction(false, Boolean(failed.household || retained?.household || retained?.scene || retained?.personalityScene),
              Boolean(failed.scene || failed.toy || failed.personalityScene || retained?.scene || retained?.toy || retained?.personalityScene), Boolean(failed.homeLife));
            nextDecision = now+500; paint(1,0,"look"); schedule(); return;
          }
        }
        let age = now - began, p = clamp(age / total, 0, 1); status = action.kind;
        // Only the exact current required basic pose/TV watch owns this
        // first-packet wait. General look, intro, travel, contact, wash and
        // sleep keep their existing clocks and cancellation paths.
        const finitePoseOwner = action.personalityScene;
        const finitePose = finitePoseOwner && personalityDirector.finitePosePresentation(finitePoseOwner,action.kind);
        // The readiness wait owns no extra time. Check throughout playback,
        // on the director's existing active clock, including the final tick.
        if (finitePoseOwner && finitePose && brain.current.activeMs > finitePose.expiresAt) {
          personalityDirector.resolve(finitePoseOwner,false,undefined,brain.current.activeMs);
          clearAction(); nextDecision = now+480; paint(1,0,"look"); schedule(); return;
        }
        if (finitePoseOwner && finitePose && !playPresentation.started) {
          const selected = selectCompanionSprite(registration.rows[finitePose.row][0],finitePose.row,0);
          requestSprite.current(selected.src);
          const texture = peekDecodedCompanionSprite(selected.src);
          const usable = Boolean(texture?.complete && texture.naturalWidth && texture.getAttribute("src") === selected.src
            && (!texture.isConnected || texture.parentElement === image));
          const presentation = advanceCompanionPlayPresentation({ now,began,delta,presentation:playPresentation,usable });
          playPresentation = presentation.presentation; began = presentation.began;
          age = now-began; p = clamp(age/total,0,1);
          if (presentation.expired) {
            personalityDirector.resolve(finitePoseOwner,false,undefined,brain.current.activeMs);
            clearAction(); nextDecision = now+480; paint(1,0,"look"); schedule(); return;
          }
          if (!playPresentation.started) { paint(lastPoseSample.row,lastPoseSample.frame,lastPoseSample.status); schedule(); return; }
        }
        // Keep the preceding body visible while a cold first packet decodes,
        // then play the whole onset from phase0. A late texture must not turn
        // a bow into its held final key or earn an invisible completion.
        // Actual falling and calibrated home-contact poses keep their own
        // physical/witness clocks; this wait never parks a body in midair.
        if (action.kind === "play" && action.play && !playPresentation.started) {
          if (playFalling || homeContact || action.personalityScene?.command.kind === "wash" && !action.personalityScene.travel) playPresentation = { started: true, waited: 0 };
          else {
            const quiet = reduced || ["off", "soft"].includes(gfxMode());
            const first = action.foodAftertaste ? sampleCompanionFoodAftertaste(action.foodAftertaste.kind, 0, quiet)
              : action.toyPerformance ? sampleCompanionToyPlay(action.toyPerformance.kind, 0, quiet)
                : sampleCompanionPlay(action.play, 0, reduced || gfxMode() === "off");
            const column = Math.max(0, Math.min(15, Math.floor(first.phase * 15)));
            const selected = selectCompanionSprite(registration.rows[first.row][column], first.row, column);
            requestSprite.current(selected.src);
            const texture = peekDecodedCompanionSprite(selected.src);
            const usable = Boolean(texture?.complete && texture.naturalWidth && texture.getAttribute("src") === selected.src
              && (!texture.isConnected || texture.parentElement === image));
            const presentation = advanceCompanionPlayPresentation({ now, began, delta, presentation: playPresentation, usable });
            playPresentation = presentation.presentation; began = presentation.began;
            age = now - began; p = clamp(age / total, 0, 1);
            if (presentation.expired) {
              if (action.personalityScene) personalityDirector.resolve(action.personalityScene, false, undefined, brain.current.activeMs);
              clearAction(); nextDecision = now + 480; paint(1, 0, "look"); schedule(); return;
            }
            if (!playPresentation.started) {
              // The old body is still the actual drawing. Keep its public
              // presentation until synchronous adoption can show this play;
              // never label an idle/fall texture as the new cheer or bow.
              paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); schedule(); return;
            }
          }
        }
        const authoredBeat = action.personalityScene;
        const lifeBeat = action.homeLife;
        if (lifeBeat && !lifeBeat.travel && !homeLifeEffectApplied && p >= .5
          && (homeContact && homeInteractionWitness === homeContact.serial || p >= .9)
          && (lifeBeat.command.kind !== "light" || homeContact && companionLampPresentationReady(homeLampPresentation,homeContact.serial,now,
            canCompanionSetHomeLight() && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && homeContact.element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })))) {
          homeLifeEffectApplied = true;
          const input = homeLifeInput(homeLifePending?.phase ?? "awake");
          const allowed = input.enabled && input.active && !input.owned && homeLifePending
            && homeLifePolicy.current()?.serial === lifeBeat.serial && homeContact?.kind === lifeBeat.command.kind
            && homeInteractionWitness === homeContact.serial && homeContact.element.isConnected && isHomeFloor(support);
          const previous = lifeBeat.command.kind === "light" ? getCompanionHomeLight() : getCompanionHomeTv();
          if (allowed && lifeBeat.command.kind === "light" && canCompanionSetHomeLight()) setCompanionHomeLight(lifeBeat.command.lit, { source: "companion" });
          if (allowed && lifeBeat.command.kind === "tv" && canCompanionSetHomeTv()) setCompanionHomeTv(lifeBeat.command.state, { source: "companion" });
          const actual = lifeBeat.command.kind === "light" ? getCompanionHomeLight() : getCompanionHomeTv();
          homeLifeEffectSucceeded = Boolean(allowed && actual === (lifeBeat.command.kind === "light" ? lifeBeat.command.lit : lifeBeat.command.state));
          if (homeLifeEffectSucceeded && previous !== actual) {
            data("personalityEffect", lifeBeat.command.kind);
            learnAgent("home-control", undefined, true, { generation:agentActionGeneration, personality:agentActionPersonality });
          }
        }
        // A first audio stream may decode after the short physical gesture.
        // Keep this same owned contact briefly; cancellation/OFF still aborts
        // the request and neither a timer nor an unbounded wait is added.
        if (homeRadioPending && p >= .72) {
          if (now - homeRadioRequestedAt < 2500) { began += delta; age = now - began; p = clamp(age / total, 0, 1); }
          else { homeRadioPending.abort(); homeRadioPending = undefined; if (authoredBeat) personalityDirector.resolve(authoredBeat, false, undefined, brain.current.activeMs); }
        }
        if (authoredBeat && !authoredBeat.travel && !personalityEffectApplied && p >= .5 && ["tv", "light", "curtain", "radio"].includes(authoredBeat.command.kind)
          && (homeContact && homeInteractionWitness === homeContact.serial || p >= .9)
          && (authoredBeat.command.kind !== "light" || homeContact && companionLampPresentationReady(homeLampPresentation,homeContact.serial,now,
            canCompanionSetHomeLight() && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && homeContact.element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })))) {
          personalityEffectApplied = true;
          let accepted = false;
          const previousControl = authoredBeat.command.kind === "tv" ? getCompanionHomeTv() : authoredBeat.command.kind === "light" ? getCompanionHomeLight() : authoredBeat.command.kind === "curtain" ? getCompanionCurtainChoice() : getCompanionRadioSnapshot().playing;
          const learningEpoch = { generation: agentActionGeneration, personality: agentActionPersonality };
          const allowed = Boolean(homeContact && homeInteractionWitness === homeContact.serial && homeContact.element.isConnected && !workspaceBusyRef.current && !overlayActive && !pause && !document.hidden && supportedNow() && presence.phase === "active" && isHomeFloor(support));
          if (allowed && authoredBeat.command.kind === "tv") accepted = setCompanionHomeTv(authoredBeat.command.state === "next" ? companionHomeTvControl(getCompanionHomeTv()).next : authoredBeat.command.state, { source: "companion" });
          if (allowed && authoredBeat.command.kind === "light") accepted = canCompanionSetHomeLight() && setCompanionHomeLight(authoredBeat.command.lit, { source: "companion" });
          if (allowed && authoredBeat.command.kind === "curtain") { accepted = setCompanionCurtainChoice(authoredBeat.command.phase, "companion"); publishHomeCurtain(status); }
          if (allowed && authoredBeat.command.kind === "radio") {
            const controller = new AbortController(); homeRadioPending = controller; homeRadioRequestedAt = now;
            void setCompanionRadioPlaying(authoredBeat.command.playing, controller.signal).then(success => {
              if (homeRadioPending !== controller || controller.signal.aborted) return;
              homeRadioPending = undefined; personalityDirector.resolve(authoredBeat, success, undefined, brain.current.activeMs);
              if (success) { data("personalityEffect", "radio"); if (previousControl !== getCompanionRadioSnapshot().playing) {
                personalityDirector.observeProgress({ now: brain.current.activeMs, active: !pause && !document.hidden && presence.phase === "active", controls: { radio: getCompanionRadioSnapshot().playing },
                  carriedToyId: toys.current?.carried(), carriedFoodId: food.current?.carried() });
                learnAgent("home-control", undefined, true, learningEpoch);
              } if (authoredBeat.command.kind === "radio" && authoredBeat.command.playing) observeRoutine("music-started"); }
            });
          } else personalityDirector.resolve(authoredBeat, accepted, undefined, brain.current.activeMs);
          if (accepted) data("personalityEffect", authoredBeat.command.kind);
          if (accepted && previousControl !== (authoredBeat.command.kind === "tv" ? getCompanionHomeTv() : authoredBeat.command.kind === "light" ? getCompanionHomeLight() : getCompanionCurtainChoice())) {
            const controls = authoredBeat.command.kind === "tv" ? { tv: getCompanionHomeTv() }
              : authoredBeat.command.kind === "light" ? { light: getCompanionHomeLight() } : { curtain: getCompanionCurtainChoice() };
            personalityDirector.observeProgress({ now: brain.current.activeMs, active: allowed, controls,
              carriedToyId: toys.current?.carried(), carriedFoodId: food.current?.carried() });
            learnAgent("home-control");
          }
        }
        if (action.scene?.effect && !sceneEffectApplied && p >= .5
          && (action.scene.effect.kind !== "discard" || p >= 1 || companionFoodDisposalDelivered(foodDisposalPainted, foodDisposalAim?.point))) {
          sceneEffectApplied = true;
          const effect = action.scene.effect;
          let success = false;
          const allowed = !workspaceBusyRef.current && !overlayActive && !pause && presence.phase === "active" && !document.hidden;
          if (allowed && effect.kind === "pick") {
            const targetFood = accessibleCompanionFoods(food.current?.foods().filter(item => item.id === effect.foodId) ?? [], [...platforms, ...landingPlatforms]).find(item => item.platformId === support);
            success = Boolean(targetFood && withinCompanionFoodReach(Math.hypot(targetFood.x - x, targetFood.y - y))
              && paintedSelection && accessoryModule?.companionCarryAnchor(paintedSelection) && food.current?.beginCarry(effect.foodId));
          }
          else if (allowed && effect.kind === "put") success = Boolean(isHomeFloor(support) && supportedNow() && food.current?.releaseCarry(effect.foodId, { x, y }));
          else if (allowed && effect.kind === "discard") {
            const bin = document.querySelector<HTMLElement>(".vc-home [data-companion-trash]");
            const target = bin && companionFoodDisposalTarget(bin.getBoundingClientRect(), bin.isConnected && !bin.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]"));
            success = Boolean(brain.current.hunger < COMPANION_FULL_THRESHOLD && bin && bin === foodDisposalAim?.element && target && isHomeFloor(support) && supportedNow()
              && companionFoodDisposalDelivered(foodDisposalPainted, target) && food.current?.discardCarry(effect.foodId, bin));
          }
          scenes.resolve(action as CompanionSceneAction, success);
        }
        const toyBeat = action.toy;
        if (toyBeat?.effect && !toyEffectApplied && p >= (action.toyPerformance && ["put", "toss"].includes(toyBeat.effect) ? 1 : .5) && (toyBeat.effect !== "spawn" || homeContact && homeInteractionWitness === homeContact.serial || p >= .9) && (toyBeat.effect !== "stash" || p >= 1 || companionToyReturnDelivered(toyReturnPainted, toyReturnAim?.point))) {
          toyEffectApplied = true;
          let success: boolean | string = false;
          const allowed = !workspaceBusyRef.current && !overlayActive && !pause && presence.phase === "active" && !document.hidden;
          if (allowed && toyBeat.effect === "pick" && toyBeat.toyId) success = Boolean(toys.current?.pick(toyBeat.toyId, { x, y }));
          else if (allowed && toyBeat.effect === "nudge" && toyBeat.toyId) success = Boolean(toys.current?.nudge(toyBeat.toyId, { x, y }, now));
          else if (allowed && toyBeat.effect === "decline" && toyBeat.toyId) success = Boolean(toys.current?.decline(toyBeat.toyId, { x, y }, now));
          else if (allowed && ((toyBeat.effect === "stash" && toyBeat.toyId) || toyBeat.effect === "spawn")) {
            const currentBox = document.querySelector<HTMLElement>(".vc-home [data-home-action='toys']"), rect = currentBox?.getBoundingClientRect();
            const openingElement = currentBox?.querySelector<HTMLElement>(".vc-toy-box-opening"), opening = openingElement?.getBoundingClientRect();
            const close = currentBox && rect && rect.width > 0 && rect.height > 0 && !currentBox.closest("[hidden],[inert],[aria-hidden='true']") && isHomeFloor(support) && supportedNow() && Math.abs(x - rect.left - rect.width / 2) <= size + rect.width / 2 && Math.abs(y - rect.bottom) <= 140;
            if (close && opening && opening.width > 0 && opening.height > 0 && (toyBeat.effect === "stash" || homeContact?.kind === "box" && homeInteractionWitness === homeContact.serial)) {
              const cx = opening.left + opening.width / 2;
              const hint = toyHomeContacts.filter(p => p.y > opening.bottom).sort((a, b) => Math.abs(platformLandingX(a, cx, 9) - cx) - Math.abs(platformLandingX(b, cx, 9) - cx))[0];
              success = toyBeat.effect === "stash" ? Boolean(toyBeat.toyId && openingElement === toyReturnAim?.element && companionToyReturnDelivered(toyReturnPainted, companionToyReturnTarget(opening)) && toys.current?.stash(toyBeat.toyId)) : toys.current?.spawn({ x: cx, y: opening.bottom, platformId: hint?.id ?? support }, now, true, food.current?.occupied()) ?? false;
            }
          }
          else if (allowed && (toyBeat.effect === "toss" || toyBeat.effect === "put") && toyBeat.toyId) success = Boolean(toys.current?.put(toyBeat.toyId, { x, y: toyBeat.effect === "toss" ? y - 22 : y, platformId: support }, now, toyBeat.effect === "toss", true));
          toyPlanner.resolve(toyBeat, success, brain.current.activeMs);
          if (allowed && success && toyBeat.effect === "stash") learnAgent("toy-returned");
          else if (allowed && !success && ["spawn", "stash"].includes(toyBeat.effect)) learnAgent("route-failed", toyBeat.effect === "stash" ? "cleanup" : "play");
          if (authoredBeat && !["pick", "decline"].includes(toyBeat.effect)) {
            personalityDirector.resolve(authoredBeat, Boolean(success), typeof success === "string" ? success : toyBeat.toyId, brain.current.activeMs);
            const owner = personalityDirector.current();
            if (!owner || owner.id !== authoredBeat.id || owner.beat !== authoredBeat.beat) toyPlanner.cancel(brain.current.activeMs);
            if (success && toyBeat.effect === "stash") {
              personalityDirector.event("toy-returned", brain.current.activeMs);
              if (authoredBeat.id === "T09") deferredPersonalityToy = undefined;
              else if (deferredPersonalityToy) personalityDirector.event("toy-settled", brain.current.activeMs);
            }
          }
          if (success) pendingCue = "play";
        }
        const householdBeat = action.household;
        if (householdBeat?.effect && !householdEffectApplied && p >= (action.kind === "walk" ? .82 : .48) && (householdBeat.effect !== "spawn" || homeContact && homeInteractionWitness === homeContact.serial || p >= .9) && (householdBeat.effect !== "discard" || p >= 1 || companionFoodDisposalDelivered(foodDisposalPainted, foodDisposalAim?.point)) && (householdBeat.effect !== "scatter" || !householdBeat.point || Math.hypot(x - householdBeat.point.x, y - householdBeat.point.y) <= 64)) {
          householdEffectApplied = true;
          let result: boolean | string = false;
          if (householdBeat.effect === "pick" && householdBeat.foodId) {
            const item = liveFoods.find(item => item.id === householdBeat.foodId);
            result = Boolean(item && withinCompanionFoodReach(Math.hypot(item.x - x, item.y - y)) && paintedSelection && accessoryModule?.companionCarryAnchor(paintedSelection) && food.current?.beginCarry(householdBeat.foodId));
          }
          else if (householdBeat.effect === "put" && householdBeat.foodId) result = Boolean(isHomeFloor(support) && supportedNow() && householdBeat.point
            && isHomeFloor(householdBeat.point.platformId ?? "") && withinCompanionFoodReach(Math.hypot(x - householdBeat.point.x, y - householdBeat.point.y))
            && food.current?.releaseCarry(householdBeat.foodId, { x, y }));
          else if (householdBeat.effect === "discard" && householdBeat.foodId) {
            const bin = document.querySelector<HTMLElement>(".vc-home [data-companion-trash]");
            const target = bin && companionFoodDisposalTarget(bin.getBoundingClientRect(), bin.isConnected && !bin.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]"));
            result = Boolean(brain.current.hunger < COMPANION_FULL_THRESHOLD && bin && bin === foodDisposalAim?.element && target && isHomeFloor(support) && supportedNow() && companionFoodDisposalDelivered(foodDisposalPainted, target) && food.current?.discardCarry(householdBeat.foodId, bin));
          } else if (householdBeat.effect === "spawn") {
            const slot = document.querySelector<HTMLElement>(".vc-home .vc-dispenser-slot"), outlet = slot?.getBoundingClientRect(), dispenser = slot?.closest<HTMLElement>(".vc-dispenser")?.getBoundingClientRect();
            // Approach and contact share the actual dispenser base. The inner
            // outlet is above that base and cannot define a floor-foot reach.
            if (slot && manualFeedSource(slot) && outlet && outlet.width > 0 && dispenser && isHomeFloor(support) && supportedNow() && homeContact?.kind === "dispenser" && homeInteractionWitness === homeContact.serial && Math.abs(x - (outlet.left + outlet.width / 2)) <= size * .6 + outlet.width / 2 && Math.abs(y - dispenser.bottom) < 100) {
              const kind = randomCompanionFood(lastFood.current);
              result = food.current?.spawn(kind, { x: outlet.left + outlet.width / 2, y: outlet.bottom + 2 }, undefined, true, { x, y }) ?? false;
              if (result) { lastFood.current = kind; pendingCue = "feed"; slot.closest("button")?.animate([{ transform: "scale(1)" }, { transform: "scale(.93)" }, { transform: "scale(1)" }], { duration: 280 }); }
            }
          } else if (householdBeat.effect === "scatter") {
            const centre = householdBeat.point ?? { x, y }, before = liveFoods.filter(item => Math.hypot(item.x - centre.x, item.y - centre.y) <= 110);
            result = Boolean(food.current?.scatter(centre, 110, 1.4));
            if (result) { pendingCue = "play"; for (const item of before) scatteredFoods.set(item.id, { from: { x: item.x, y: item.y }, expires: brain.current.activeMs + 10000 }); }
          }
          household.resolve(householdBeat, result, brain.current.activeMs);
          if (result && householdBeat.effect === "put") learnAgent("food-stored");
          else if (result && householdBeat.effect === "discard") learnAgent("food-discarded");
          if (authoredBeat && householdBeat.effect !== "pick" && householdBeat.effect !== "scatter") {
            personalityDirector.resolve(authoredBeat, Boolean(result), typeof result === "string" ? result : householdBeat.foodId, brain.current.activeMs);
            if (result && householdBeat.effect === "put" && householdBeat.foodId) storedPersonalityFoods.add(householdBeat.foodId);
            const owner = personalityDirector.current(); if (!owner || owner.beat !== authoredBeat.beat) household.cancel();
          }
          if (result && ["put", "discard", "spawn"].includes(householdBeat.effect)) sceneEvent({ kind: "household", effect: householdBeat.effect as "put" | "discard" | "spawn", foodId: typeof result === "string" ? result : householdBeat.foodId });
        }
        if (action.foodCuriosity === "toss" && !curiosityTossed && p >= .4) { curiosityTossed = true; if (action.effectPoint) food.current?.jostle(action.effectPoint, 38, 2.5); }
        if (action.kind === "walk") {
          x = lerp(origin.x, action.target.x, runUpCurve ? sampleCompanionRunUp(p) : sampleCompanionTravel(p)); row = action.pace === "scoot" ? 20 : 2;
          if (runTrip) {
            const tripToys = runTrip.toyId ? toys.current?.available() ?? [] : [];
            const point = companionRunTripContact(runTrip, origin, action.target, supportById(support), liveFoods, tripToys);
            if (point === null || overlayActive || homeJourney || workspaceBusyRef.current || presence.phase !== "active" || reduced || gfxMode() === "off") runTrip = undefined;
            else if ((x - point) * (action.target.x < origin.x ? -1 : 1) >= 0) {
              const contact = runTrip; x = point; rememberMishapPlace();
              const wasRunning = action.pace === "scoot";
              const trippedFood = liveFoods.find(item => item.id === contact.foodId);
              const trippedToy = tripToys.find(item => item.id === contact.toyId);
              if (trippedFood) { rememberLife({ kind: "food-mishap", food: trippedFood.kind }); sceneEvent({ kind: "food-mishap", food: trippedFood.kind }); }
              const reaction = action.episode ? companionEpisodeMishap(action, { x, y }, supportById(support), brain.current, now, preferences) : undefined;
              const mishap = reaction ?? { kind: "play" as const, play: contact.play, target: { x, y, platformId: support }, duration: companionPlayDuration(contact.play), direction: action.direction, intention: brain.current.intention };
              launch({ ...mishap, ...(trippedToy ? { toyMishap: { toyId: trippedToy.id, kind: trippedToy.kind, platformId: support, generation: brain.current.habits?.generation ?? 0 } } : {}) }, now);
              const contactPlay = reaction?.play ?? contact.play;
              data("trip", contact.cause); data("play", contactPlay); data("playBeat", "impact");
              const situation = companionRunContactSituation({ cause: contact.cause === "food" ? "food" : "stumble", running: wasRunning, foodPresent: Boolean(trippedFood) });
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
          el.toggleAttribute("data-dreaming", preferences.sleep && (row === 11 || row === 40));
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
          const quietPlay = reduced || ["off", "soft"].includes(gfxMode());
          const play = action.foodAftertaste ? sampleCompanionFoodAftertaste(action.foodAftertaste.kind, p, quietPlay)
            : action.toyPerformance ? { ...sampleCompanionToyPlay(action.toyPerformance.kind, p, quietPlay), beat: "play" }
              : sampleCompanionPlay(action.play, p, reduced || gfxMode() === "off");
          row = play.row; frame = play.phase * 15;
          if (preparedPlayRow !== play.row) {
            preparedPlayRow = play.row;
            preparedNextPlayRow = action.foodAftertaste ? 23 : action.toyPerformance ? 9 : companionNextPlayRow(action.play, p, reduced || gfxMode() === "off");
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
          let afterMealReaction: CompanionFoodAftertaste | undefined;
          if(completed.workExpression && workExpressions.complete(completed.workExpression,{eligible:workAllowed()&&overlayActive&&!pressed&&!keyboardHeld&&!placing,
            kind:completed.kind,pose:completed.personalityScene?.command.kind==="pose",travel:Boolean(completed.personalityScene?.travel)})) {
            if(!workExpressions.available()){
              for(const attribute of ["data-working","data-personality-scene","data-personality-serial","data-personality-beat","data-personality-command","data-personality-activity"])el.removeAttribute(attribute);
              presence.focus(false,now);
            }
          }
          if (completed.toyMishap && completed.kind === "play") {
            const kind = companionToyTripExperience(completed.toyMishap, toys.current?.available() ?? [], { point: { x, y }, platformId: support, generation: brain.current.habits?.generation ?? 0,
              observed: toyMishapWitnessed, completed: true, active: effective.enabled && !pressed && !keyboardHeld && !placing && !reduced && gfxMode() !== "off" && !pause && !document.hidden && !overlayActive && !workspaceBusyRef.current && !premiereActive && presence.phase === "active",
              learn: preferencesRef.current.learnFromYou !== false });
            if (kind) recordCompanionToyExperience(kind, "tripped", preferencesRef.current.learnFromYou !== false);
          }
          if (completed.toy?.toyId && ["toss", "put", "decline", "nudge"].includes(completed.toy.effect ?? "")) toys.current?.completePlay(completed.toy.toyId, toyPerformanceWitnessed);
          const performedToy = toys.current?.carried();
          if (performedToy && completed.personalityJobEnd && completed.kind === "play" && completed.personalityScene?.command.kind === "toy" && completed.personalityScene.command.mode === "play") toys.current?.completeCarriedPlay(performedToy, toyPerformanceWitnessed);
          if (completed.foodRefusal && completed.kind === "play" && foodRefusalWitnessed) {
            const refused = food.current?.foods().find(item => item.id === completed.foodRefusal!.foodId && item.platformId === support && Math.hypot(item.x - x, item.y - y) <= 24);
            if (refused && shouldDeclineCompanionFood(refused.kind, toyTastes.current, preferences, brain.current, loadCompanionCollection().foods)) {
              rememberLife({ kind: "food-declined", food: refused.kind });
            }
          }
          if (homeJourney && (completed.kind === "walk" || completed.kind === "jump")) homeLegs++;
          const rested = completed.kind === "sleep", ejected = Boolean(homeDeparture?.flying);
          const continueRoute = Boolean(action.foodId && (action.kind === "walk" || action.kind === "jump") || brain.current.intention?.kind === "explore" && ["consider", "travel"].includes(brain.current.intention.stage) && brain.current.intention.remaining > 0);
          const eatenFood = action.kind === "eat" && action.foodId ? liveFoods.find(item => item.id === action!.foodId) : undefined;
          if (action.kind === "eat" && action.foodId && food.current?.consume(action.foodId)) {
            if (eatenFood) afterMealReaction = aftertastes.consume({ foodId: eatenFood.id, food: eatenFood.kind, consumed: true },
              Boolean(effective.enabled && !reduced && !["off", "soft"].includes(gfxMode()) && !pause && !document.hidden && !overlayActive && !workspaceBusyRef.current && !premiereActive && supportedNow() && presence.phase === "active"));
            const taste = eatenFood ? evaluateCompanionFoodTaste(eatenFood.kind, brain.current.life, Math.random()) : undefined;
            const firstFood = eatenFood && recordCompanionConsumedFood(eatenFood.kind, true);
            if (firstFood && eatenFood) discover({ kind: "food", id: eatenFood.kind, source: { x, y: y - size * .4 } });
            queueSituation("meal-finished", [0, 9, 29]); pendingCue = firstFood ? "discover" : "eat";
            const previousFavorite = brain.current.life?.favoriteFood;
            brain.current = recordCompanionEvent(brain.current, "ate"); observeRoutine("ate"); if (!experience("fed", eatenFood?.kind, taste)) persistCare(true);
            // Profile subscribers read canonical care when taste memory emits.
            // Both stores receive this one real meal's identical impression.
            if (taste) recordCompanionFoodTasteOutcome(taste, preferencesRef.current.learnFromYou !== false);
            if (eatenFood) expressionMeal = { serial: (expressionMeal?.serial ?? 0) + 1, food: eatenFood.kind, full: brain.current.hunger <= COMPANION_FULL_THRESHOLD, last: !food.current?.foods().length };
            if (eatenFood) sceneEvent({ kind: "meal", foodId: eatenFood.id, food: eatenFood.kind, favoriteChanged: previousFavorite !== brain.current.life?.favoriteFood, first: Boolean(firstFood) });
            if (completed.personalityScene) personalityDirector.resolve(completed.personalityScene, true, eatenFood?.id, brain.current.activeMs);
            if (eatenFood) storedPersonalityFoods.delete(eatenFood.id);
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
          if (["walk", "jump"].includes(completed.kind) && !isHomeSupport(support) && supportedNow() && Math.hypot(x - completedOrigin.x, y - completedOrigin.y) >= 24) {
            if (activityArrival?.action===completed && !pause && !document.hidden && !overlayActive && !premiereActive && !workspaceBusyRef.current
              && !returning && !homeJourney && presence.phase === "active" && !reduced && gfxMode() !== "off")
              publicLife.arrive(completed,activityArrival.from,{world:{...homeRouteWorld(),animated:true},brain:brain.current,preferences:effective,now:brain.current.activeMs});
            observeRoutine("went-out");
            const place = `${support}:${Math.floor(x / 96)}`;
            if (!learnedPlaces.has(place)) { learnedPlaces.add(place); if (learnedPlaces.size > 64) learnedPlaces.delete(learnedPlaces.values().next().value!); learnAgent("went-out"); }
          }
          if (activityArrival?.action===completed && supportedNow() && !pause && !document.hidden && !overlayActive && !premiereActive && !workspaceBusyRef.current && !returning && !homeJourney && presence.phase === "active" && !reduced && gfxMode() !== "off"
            && !food.current?.carried() && !toys.current?.carried() && !household.active() && !toyPlanner.active()) {
            personalityActivity.recordArrival(completed,activityArrival.from,{...homeRouteWorld(),animated:!reduced && !["off","soft"].includes(gfxMode())},effective,brain.current.activeMs);
          }
          activityArrival=undefined;
          if (rested && isHomeSupport(support) && sleepPaintMs >= 500) observeRoutine("slept");
          if (completed.kind === "jump" && verticalLanding) verticalRecoveryX = undefined;
          let arrivalPlay: CompanionAction["play"] = undefined;
          if (completed.kind === "jump" && !completed.homeLife && shakenReleasePending && supportedNow() && !homeJourney && !ejected && !overlayActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off") arrivalPlay = "dizzy";
          else if (completed.kind === "jump" && !completed.homeLife && !completed.foodId && !completed.episode && !completed.scene && !completed.toy && !completed.personalityScene && !homeJourney && !restAfterLanding && !ejected && !overlayActive && !workspaceBusyRef.current && !reduced && gfxMode() !== "off" && presence.phase === "active") {
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
          const continueEpisode = Boolean(!completed.homeLife && !completed.episodeCancelled && (completed.episode || brain.current.episode?.phase === "ate") && !homeJourney && !overlayActive && !restAfterLanding && !ejected && !workspaceBusyRef.current && !premiereActive && !reduced && gfxMode() !== "off" && presence.phase === "active");
          const episodeMishap = continueEpisode && completed.kind === "jump" ? companionEpisodeMishap(completed, { x, y }, supportById(support), brain.current, now, preferences, true) : undefined;
          const nextHop = completed.kind === "walk" && !completed.homeLife && !completed.episodeCancelled && runHop && supportedNow() && !homeJourney && !overlayActive && !restAfterLanding && !ejected && !workspaceBusyRef.current && !premiereActive && !reduced && gfxMode() !== "off" && presence.phase === "active" && validCompanionRunHop(runHop, { x, y }, supportById(support)) && (!runHop.episode || companionEpisodeHopAvailable(runHop, supportById(support), liveFoods)) ? runHop : undefined;
          if (completed.scene) scenes.complete(completed as CompanionSceneAction);
          if (completed.personalityScene) {
            if (completed.personalityScene.command.kind === "wash" && !completed.personalityScene.travel) { personalityDirector.resolve(completed.personalityScene, washContactMs >= 500, undefined, brain.current.activeMs); if (washContactMs >= 500) observeRoutine("washed"); }
            else if (completed.personalityJobEnd) personalityDirector.resolve(completed.personalityScene, true, completed.personalityScene.itemId ?? toys.current?.carried(), brain.current.activeMs);
            else if (completed.kind === "look" && completed.personalityScene.command.kind === "watch" && !completed.personalityScene.travel)
              personalityDirector.complete(completed.personalityScene, { at: brain.current.activeMs, success: true,
                active: effective.enabled && effective.roam && !pause && !document.hidden && !pressed && !keyboardHeld && !placing
                  && !pendingMonth && !returning && !overlayActive && !premiereActive && !workspaceBusyRef.current && !reduced
                  && gfxMode() !== "off" && presence.phase === "active" && supportedNow() && canCompanionSetHomeTv(),
                tv: getCompanionHomeTv(), point: { x, y, platformId: support }, duration: completed.duration, elapsedMs: age, paintedMs: watchPaintMs });
            else personalityDirector.complete(completed.personalityScene);
            if (completed.play && ["tumble", "dizzy", "slip-tumble"].includes(completed.play)) personalityDirector.event("recovered", brain.current.activeMs);
          }
          const pendingLifeOwner = completed.homeLife ? homeLifePending?.original : undefined;
          const lifeSucceeded = homeLifeEffectSucceeded;
          clearAction(continueEpisode, Boolean(completed.household && household.active() || completed.scene || completed.personalityScene || pendingLifeOwner?.household || pendingLifeOwner?.scene || pendingLifeOwner?.personalityScene), Boolean(completed.scene || completed.toy || completed.personalityScene || pendingLifeOwner?.scene || pendingLifeOwner?.toy || pendingLifeOwner?.personalityScene), Boolean(completed.homeLife));
          if (completed.homeLife) {
            if (homeLifePending && !completed.homeLife.travel && !lifeSucceeded) {
              const command = completed.homeLife.command;
              if (command.kind === "light" ? canCompanionSetHomeLight() : canCompanionSetHomeTv()) homeLifePending.failures++;
              homeLifePending.retryAt = now + 500;
            }
            nextDecision = now; advanceHomeLife(now);
            if (action) { status = action.kind; row = action.kind === "walk" ? action.pace === "scoot" ? 20 : 2 : action.kind === "jump" ? 3 : action.kind === "sleep" ? 10 : 1; frame = 0; }
          }
          if (completed.toyApproach && completed.toy) {
            const marker = completed.toyApproach, element = marker.element;
            const available = element.isConnected && element === document.querySelector(".vc-home [data-home-action='toys']")
              && !element.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]");
            const ready = planCompanionToyBoxApproach({ x, y, platformId: support }, supportById(support), element.getBoundingClientRect(), size, available);
            const owns = !homeJourney && !restAfterLanding && !overlayActive && !pause && !document.hidden && !premiereActive && !workspaceBusyRef.current
              && !pressed && !keyboardHeld && !placing && effective.enabled && effective.roam && !reduced && gfxMode() !== "off" && presence.phase === "active"
              && toyPlanner.active() && !companionToyFoodPriority(brain.current, { x, y, platformId: support, platforms, width: innerWidth, height: innerHeight, foods: liveFoods }, effective);
            // Resume this offered beat once. Replanning its generic12px
            // landing would walk back out of the valid close intersection.
            if (owns && ready?.kind === "ready") {
              launch({ kind: "sniff", target: { x, y, platformId: support }, duration: marker.duration,
                toy: { ...completed.toy, effect: marker.effect, point: { x, y, platformId: support } },
                personalityScene: completed.personalityScene, personalitySignature: completed.personalitySignature }, now);
              status = "sniff"; row = 1; frame = 0;
            } else { clearAction(); nextDecision = now + 500; }
          }
          if (!completed.homeLife && ejected && presence.phase === "parked") { row = presence.pose.row; frame = 0; status = presence.pose.status; if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming"); offGeometry?.(); offGeometry = undefined; geometryReady = false; hearts.pause(true); }
          if (rested) { brain.current = recordCompanionEvent(brain.current, "rested"); rememberLife({ kind: "rested" }); sceneEvent({ kind: "rested", equipped: wardrobe.current.equipped, place: isHomeSupport(support) ? "home" : supportById(support)?.kind === "card" ? "card" : "floor" }); } if (completed.episodeCancelled) brain.current = { ...brain.current, episode: undefined }; if (!completed.homeLife) nextDecision = now + (homeJourney || continueRoute || continueEpisode || completed.household && household.active() ? 0 : completed.attention && completed.attention.kind !== "social" ? 60 : 220);
          if (!completed.homeLife && homeJourney && !overlayActive && (presence.phase === "active" || homeJourney === "called" && presence.phase === "finishing")) {
            advanceHomeJourney(now);
            if (action) { status = action.kind; row = action.kind === "walk" ? action.pace === "scoot" ? 20 : 2 : action.kind === "jump" ? 3 : action.kind === "sleep" ? 10 : 1; frame = 0; }
          }
          if (!completed.homeLife && restAfterLanding) { restAfterLanding = false; if (presence.phase === "active") control.current?.rest(); }
          if (nextHop) { launch(nextHop, now); row = 4; frame = 0; status = "jump"; }
          if (episodeMishap) { rememberMishapPlace(); const trippedFood = liveFoods.find(item => item.id === episodeMishap.foodId); if (trippedFood) { rememberLife({ kind: "food-mishap", food: trippedFood.kind }); sceneEvent({ kind: "food-mishap", food: trippedFood.kind }); } launch(episodeMishap, now); const contact = sampleCompanionPlay(episodeMishap.play!, 0); row = contact.row; frame = 0; status = "play"; data("trip", "landing"); queueSituation("landing-mishap", [21, 24, 25], began); }
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
          if (afterMealReaction) {
            petUntil = now;
            launch({ kind: "play", play: "dizzy", foodAftertaste: afterMealReaction, target: { x, y, platformId: support }, duration: afterMealReaction.duration }, now);
            data("foodAftertaste", afterMealReaction.kind); row = 23; frame = 8; status = "play";
          } else if (completed.foodAftertaste) el.removeAttribute("data-food-aftertaste");
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
      if (freshHomePending && !premiereActive) return;
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
      poseWitness.reset();
      graphicsMode = readGfxMode();
      publishHomeCurtain(lastPoseSample.status, Boolean(document.hidden || overlayRef.current || workspaceBusyRef.current || premiereRef.current.cue?.phase && !["idle", "return", "prelude"].includes(premiereRef.current.cue.phase)));
      if (!radioAllowed()) { radioInbox.clear(); if (action?.radio && !(action.radio.instrument ? musicAllowed() : radioAllowed())) clearAction(); }
      if (!musicAllowed()) instrumentInbox.clear();
      if (graphicsMode === "off" || blocked || document.hidden || overlayRef.current || workspaceBusyRef.current || premiereRef.current.cue?.phase && !["idle", "return", "prelude"].includes(premiereRef.current.cue.phase)) cancelEpisode();
      if (blocked || document.hidden || overlayRef.current || premiereRef.current.cue?.phase && !["idle", "return", "prelude"].includes(premiereRef.current.cue.phase)) cardPlay.clear();
      if (syncPremiere()) { pendingFeeds.cancel(); return; }
      hideClock(performance.now());
      const html = document.documentElement;
      const wantsOverlay = overlayRef.current;
      const livePrelude = preludeCue();
      const next = blocked || document.hidden || page.inert || html.hasAttribute("data-showcase") || html.hasAttribute("data-ambient-pause") && hasAmbientPauseOutside("poster-window", livePrelude ? [livePrelude.owner] : []);
      if (next || wantsOverlay) cancelManualWash();
      if (next || wantsOverlay) { watchPaintMs = watchPaintAt = 0; pendingHomeRecall = undefined; pendingFeeds.cancel(); clearTimeout(parkedLayoutTimer); clearSupportWait(); }
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
          overlayPerch = undefined; presence.focus(homeJourney === "called" || visibleActive(), performance.now(), homeJourney === "called");
          lastTick = lastNeeds = lastCare = lastPaint = performance.now();
          el.removeAttribute("data-dreaming");
        }
        if (overlayActive) followLayout();
      }
      if (!next && overlayActive && workCanExpress() && !workspaceBusyRef.current) {
        if (homeJourney === "automatic") cancelHomeJourney();
        presence.focus(true, performance.now(), true); connectGeometry();
        el.setAttribute("data-working", "");
      } else {
        el.removeAttribute("data-working");
        if(overlayActive&&!workCanExpress())presence.focus(false,performance.now());
        if (action?.personalityScene?.id.startsWith("working-")) {
          const landing = action.kind === "jump" || playFalling;
          clearAction();
          if (landing) { needsLanding = true; if (!next) { needsLanding = false; settle({ x, y }); } }
          presence.focus(!overlayActive && visibleActive(), performance.now());
        }
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
      if (pause) { clearTimeout(preludeTimer); preludeDeadline = 0; homeDeparture = undefined; returning = undefined; el.removeAttribute("data-returning"); pickupScale = 1; perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf); overlayRaf = 0; stopHover(); needsLanding = needsLanding || action?.kind === "jump" || playFalling || Boolean(pressed) || keyboardHeld || afterPetLanding; afterPetLanding = false; restAfterLanding = false; supportMotion.reset(); style(reactionLayer, "transform", "translate3d(0,0px,0) scale(1,1)"); persistCare(true); clearAction(); clearTimeout(parkedLayoutTimer); offGeometry?.(); offGeometry = undefined; geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(followRaf); followRaf = 0; geometryReady = false; hearts.pause(true); releaseHold(); placing = false; delete el.dataset.placing; setHomeExpanded(false); }
      else { presence.focus((!overlayActive || workCanExpress()) && (homeJourney === "called" || visibleActive()), lastTick, !overlayActive && homeJourney === "called"); if (overlayActive) { if (workAllowed()) connectGeometry(); else updateOverlayPerch(); } else connectGeometry(); hearts.pause(overlayActive || presence.phase === "parked"); if (needsLanding) { needsLanding = false; settle({ x, y }); } nextDecision = performance.now() + 600; if (presence.phase !== "parked") schedule(); armPrelude(); }
    };
    const focusChanged = () => {
      if (!document.hasFocus()) { radioInbox.clear(); instrumentInbox.clear(); if (action?.radio) clearAction(); cancelEpisode(); pointer = pointerAnchor = undefined; pointerStableSince = 0; }
      if (premiereActive) return;
      if (pause) return;
      if (isDetailGuest()) { if (!document.hasFocus()) { cancelGuestInput(); paint(9, 0, "watch"); } lastTick = lastNeeds = lastCare = performance.now(); return; }
      if (hiding) { presence.focus(!overlayActive && visibleActive(), performance.now()); lastNeeds = lastCare = performance.now(); return; }
      const now = performance.now(), wasParked = presence.phase === "parked";
      presence.focus((!overlayActive || workCanExpress()) && visibleActive(), now);
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
      if (event.button === 0 && !pressed && !overlayDrag) beginManualTransfer();
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
      presence.focus(visibleActive(), now, true); data("presence", presence.phase);
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
      clearForPetting(); pressed = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dx: event.clientX - x, dy: event.clientY - y, dragged: false, grabbed: false, cancelled: false };
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
        if (!pressed.grabbed) { scenes.cancel(); playCompanionSound("lift", preferencesRef.current); }
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
      if (owns) { presence.focus(visibleActive(), performance.now(), true); data("presence", presence.phase); }
      if (event.repeat && (event.key === " " || event.key === "Enter")) return;
      if (event.key === "Enter" && preferences.petting) { event.preventDefault(); affection(); }
      else if (event.key.toLowerCase() === "p" && preferences.drag && !event.repeat) control.current?.place();
      else if (event.key.toLowerCase() === "n" && preferences.sleep && !event.repeat) { control.current?.rest(); logActivity("ui.click", { target: "companion-rest" }); }
      else if (event.key === " " && preferences.drag) { event.preventDefault(); if (!keyboardHeld) beginManualTransfer(); cancelHomeJourney(); awaitingAtX = false; pendingMonth = false; if (!keyboardHeld && action?.accessory) y -= sampleCompanionAccessoryMotion(action.accessory, performance.now() - began).bodyLift; if (!keyboardHeld && action?.radio) y += sampleWorldMusic(action.radio, performance.now() - began).bob; clearAction(); supportMotion.reset(); keyboardHeld = !keyboardHeld; if (keyboardHeld) playCompanionSound("lift", preferencesRef.current); else { settle({ x, y }); if (keyboardMoved) transferred(); } keyboardMoved = false; }
      else if (event.key === "Escape") { event.preventDefault(); const moved = keyboardHeld && keyboardMoved; pendingMonth = false; keyboardHeld = false; keyboardMoved = false; placing = false; delete el.dataset.placing; settle({ x, y }); if (moved) transferred(); }
      else if (keyboardHeld && event.key.startsWith("Arrow")) { event.preventDefault(); const previous = { x, y }; x = clamp(x + (event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0), size / 2 + 4, innerWidth - size / 2 - 4); y = clamp(y + (event.key === "ArrowUp" ? -24 : event.key === "ArrowDown" ? 24 : 0), size + 8, innerHeight - 12); keyboardMoved ||= x !== previous.x || y !== previous.y; }
      if (owns) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastPaint = performance.now(); schedule(); }
    };
    const keyboardModality = () => { pendingHomeRecall = undefined; el.removeAttribute("data-pointer-focus"); };
    const place = (event: PointerEvent) => {
      const inputItem = event.target instanceof Element ? event.target.closest<HTMLElement>(".vc-toy[data-toy-id],.vc-food[data-food]") : null;
      const inputId = inputItem?.dataset.toyId ?? inputItem?.dataset.food;
      if (!pause && !overlayActive && inputId && inputId === personalityDirector.current()?.itemId) {
        yieldedPersonalityItem = interruptedPersonalityItem = inputId; humanToyAt = brain.current.activeMs;
        control.current?.toyTouched(); cancelHousehold();
      }
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
      // Explicit placement also owns a click on the current resident. A
      // fresh home-floor start can already cover the chosen destination;
      // that click must finish placing rather than bonk the resident.
      if (pause || overlayActive || !placing) return;
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
    const restartSupportState = () => ({
      enabled: preferences.enabled && preferencesRef.current.enabled, visible: !document.hidden,
      blocked: blocked || workspaceBusyRef.current, reduced: reduced || gfxMode() === "off",
      held: Boolean(pressed || keyboardHeld || placing || guestKeyboardHeld || overlayDrag),
      airborne: Boolean(action?.kind === "jump" || playFalling || afterPetLanding || needsLanding),
      carrying: Boolean(food.current?.carried() || toys.current?.carried()),
      owned: Boolean(household.active() || toyPlanner.active() || homeJourney || returning || hiding || premiereActive || pendingMonth),
      resting: Boolean(sleeping || action?.kind === "sleep" || presence.dreaming || !overlayActive && presence.phase !== "active" && presence.phase !== "finishing"),
    });
    const applyGeometry = (next: Platform[], validationOnly = false) => {
      if (premiereActive || hiding || overlayActive && !workAllowed() && !needsOverlayWorldSeed()) return;
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
      toyHomeContacts = [...(geometryTracker?.landings(32) ?? [])].filter(p => isCompanionHomeFloorFoodSupport(p.id)).slice(0, 8);
      const viewportChanged = viewportRecovery.take({ validationOnly, hasSafePlatforms: platforms.length > 0, inputOwned: Boolean(pressed || keyboardHeld || placing) });
      measureBed();
      if (homeContact) { const currentContact = homeContactPoint(homeContact.kind, homeContact.element); if (currentContact) homeContact.point = currentContact; else clearHomeContact(); }
      food.current?.sync(platforms, id => geometryTracker?.anchor(id), geometryTracker?.landings(32));
      toys.current?.sync([...platforms, ...landingPlatforms], { width: innerWidth, height: innerHeight }, geometryAt, toyHomeContacts, toyAnchor);
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
        presence.focus(visibleActive(), now, true); data("presence", presence.phase); el.removeAttribute("data-dreaming");
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
      // Preference changes dispose the controller, not the occupied card.
      // Manual card tops live in landings, so a normal-only nearest search
      // cannot preserve them. Retain only freshly verified exact DOM geometry.
      if (restartSupport) {
        const candidate = !support && !action ? supportById(restartSupport.platform.id) : undefined;
        const restartContext = { point: { x, y }, monthKey, root: page,
          platform: candidate, anchor: candidate ? geometryTracker?.anchor(candidate.id) : undefined,
          viewport: { width: innerWidth, height: innerHeight }, size, state: restartSupportState() };
        const retained = resolveCompanionRestartSupport(restartSupport, restartContext);
        if (!retained && !support && !action && deferCompanionRestartSupport(restartSupport, restartContext, overlayActive && !workAllowed())) {
          // A modal's controls can clip/remove this same card's safe span. Preserve
          // the old point without adopting it or choosing a nearer date.
          // Closing the window reconnects the existing geometry subscription;
          // only that fresh strict resolve may restore this checkpoint.
          hideBed(); stopHover(); el.hidden = true; return;
        }
        restartSupport = undefined;
        if (retained) support = retained.id;
      }
      homeOccluded = false;
      if (freshHomePending) {
        const point = companionInitialHomePoint(platforms, landingPlatforms, initialHome.current.roll ?? .5);
        if (!point) { homeOccluded = true; hideBed(); el.hidden = true; return; }
        clearAction(); supportMotion.reset(); resetInertia();
        x = point.x; y = point.y; support = point.platformId; worldSeeded = true;
        freshHomePending = false; initialHome.current.entered = true;
        awaitingAtX = false; needsLanding = false;
      }
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
          const safe = floor ? companionHomeResidentFloor(support, { x, y }, landingPlatforms, rect.bottom - COMPANION_HOME_FLOOR_INSET) : platforms.find(p => p.id === "companion-home");
          // The bath mat's deliberate stance has a different height. Losing
          // that measured anchor revokes the wash; it never snaps to the bin
          // or to an unrelated ordinary floor fragment.
          if (support === COMPANION_WASH_SUPPORT && !safe) { occludeResident(); return; }
          const homeX = safe ? platformLandingX(safe, x) : clamp(x, rect.left + rect.width * .25, rect.right - rect.width * .25);
          const homeY = floor ? safe?.y ?? y : rect.top;
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
        return group ? nearestVerticalCompanionSupport(point, [...platforms, ...landingPlatforms].filter(p => (p.id === group || p.id.startsWith(`${group}-`)) && Math.abs(point.y - p.y) <= 3)) : undefined;
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
          else { paint(presence.pose.row, 0, presence.pose.status); if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming"); offGeometry?.(); offGeometry = undefined; geometryReady = false; }
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
          else { paint(presence.pose.row, 0, presence.pose.status); if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming"); }
          return;
        }
        clearSupportWait();
        if (!old && !viewportChanged && Math.abs(p.y - y) > .5) {
          // An unsupported quiet sleeper gets the same finite gravity landing,
          // then returns to CSS-only sleep instead of jumping to a new date.
          settle({ x, y }, false, true); lastTick = lastPaint = geometryAt; schedule(); return;
        }
        support = p.id; if (viewportChanged) x = platformLandingX(p, x); y = p.y; paint(presence.pose.row, 0, presence.pose.status); if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming");
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
          if (action.toyApproach) {
            const element = action.toyApproach.element, rect = element.getBoundingClientRect();
            const available = element.isConnected && element === document.querySelector(".vc-home [data-home-action='toys']")
              && !element.closest("[hidden],[inert],[aria-hidden='true'],[data-panel-collapsed]");
            const exact = { x: action.target.x, y: target.y, platformId: target.id };
            if (!validCompanionToyBoxApproach({ x, y, platformId: support }, exact, p, rect, size, available)) {
              clearAction(); nextDecision = geometryAt + 500;
              if (!p || x < p.x || x > p.x + p.width || Math.abs(y - p.y) > 2) settle({ x, y }, viewportChanged, !viewportChanged);
            } else action.target = exact;
          } else {
            action.target.platformId = target.id;
            if (!verticalLanding) action.target.x = platformLandingX(target, action.target.x);
            action.target.y = target.y;
          }
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
      const wasFreshHomePending = freshHomePending;
      const seedingOverlay = needsOverlayWorldSeed();
      const resumeHome = Boolean(homeJourney && homeWaitingGeometry && !premiereActive && !overlayActive && !hiding && !workspaceBusyRef.current);
      if (resumeHome) { homeWaitingGeometry = false; el.removeAttribute("data-home-waiting"); el.removeAttribute("data-home-wait-pose"); }
      applyGeometry(next, validationOnly);
      // applyGeometry has published matching immutable body/food/anchor tiers,
      // even if a parked actor then releases its observer. Consume this batch
      // exactly once; a still-unavailable physical floor remains fail closed.
      if (pendingFeeds.pending()) {
        const source = document.querySelector<HTMLElement>(".vc-home .vc-dispenser-slot");
        pendingFeeds.complete({ source: source && manualFeedSource(source) ? source : undefined, month: monthKey, settings: preferencesRef.current, active: manualFeedAllowed() }, command => { if (manualFeedAllowed()) emitManualFeed(command); });
      }
      // A nonempty scan may still be waiting for an existing panel intro to
      // finish before restoring staff handoff coordinates. Neither that scan
      // nor an empty visibility snapshot completes the initial world seed.
      initialGeometryMeasured ||= !pendingPosition.current && !pendingMonth && Boolean(supportById(support));
      if (wasFreshHomePending && !freshHomePending && !stopped && !pause && !overlayActive && !premiereActive && !hiding) {
        lastTick = lastNeeds = lastCare = lastPaint = performance.now(); nextDecision = lastTick + 1100;
        paint(presence.pose.row, 0, presence.pose.status); cancelAnimationFrame(raf); clearTimeout(timer); schedule();
      }
      if (seedingOverlay && initialGeometryMeasured && overlayActive && !workAllowed()) {
        // The actual ledge, including an empty calendar's real viewport floor,
        // owns visibility. Then return to the ordinary window's quiet lifetime.
        paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status);
        offGeometry?.(); offGeometry = undefined; geometryReady = false;
      }
      if (!stopped && !pause && !overlayActive && !hiding && !premiereActive && !pendingPosition.current && !pendingMonth && !pressed && !keyboardHeld && !placing && !isHomeSupport(support)) {
        if (awaitingAtX || !platforms.length && !supportById(support) && !action) waitForSupport();
        else if (wasWaiting) {
          clearSupportWait(); cancelAnimationFrame(raf); clearTimeout(timer); lastTick = lastNeeds = lastCare = lastPaint = performance.now();
          if (presence.phase === "parked" && !action) { paint(presence.pose.row, 0, presence.pose.status); if (presence.dreaming) el.dataset.dreaming = ""; else el.removeAttribute("data-dreaming"); }
          else schedule();
        }
      }
      const requestedHome = pendingHomeRecall;
      pendingHomeRecall = undefined;
      if (requestedHome && !stopped && !pause && !overlayActive && !overlayRef.current && !premiereActive && !hiding && !pressed && !keyboardHeld && !placing && !workspaceBusyRef.current && requestedHome === openHomeRecallTarget()) recallHome(false);
      if (resumeHome && !homeWaitingGeometry && !stopped && !pause && !overlayActive) { cancelAnimationFrame(raf); clearTimeout(timer); lastTick = performance.now(); nextDecision = lastTick; schedule(); }
    };
    const connectGeometry = () => {
      if (!premiereActive && !hiding && (!overlayActive || workAllowed() || needsOverlayWorldSeed()) && !offGeometry) {
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
        pendingFeeds.cancel();
        bedScene = undefined; hideBed();
        if (isHomeSupport(support)) { homeOccluded = true; el.hidden = true; stopHover(); }
      }
      parkedLayout(); followLayout(event);
    };
    const spriteDecoded = () => { if (!pause) paint(lastPoseSample.row, lastPoseSample.frame, lastPoseSample.status); };
    const workspaceChanged = () => {
      if (workspaceBusyRef.current) { pendingFeeds.cancel(); radioInbox.clear(); instrumentInbox.clear(); if (action?.radio) clearAction(); cancelEpisode(); stopHover(); cardPlay.clear(); return; }
      if (pause || overlayActive && !workAllowed() || hiding || premiereActive) return;
      if (workCanExpress() && overlayActive) { presence.focus(true, performance.now(), true); el.setAttribute("data-working", ""); }
      else if(overlayActive){el.removeAttribute("data-working");presence.focus(false,performance.now());}
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
      const previousGeneration = radioState.generation;
      radioState = getCompanionRadioSnapshot();
      if (radioState.playing && radioState.mood && radioState.generation !== previousGeneration) { radioSceneStarted = brain.current.activeMs; radioSceneListened = false; sceneEvent({ kind: "radio", mood: radioState.mood }); }
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
      const admitted = instrumentInbox.offer((event as CustomEvent<CompanionInstrumentPulse>).detail, now, musicAllowed() && !radioState.playing);
      if (admitted) observeInstrumentScene(admitted);
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
    window.addEventListener("vic:layout-motion", followLayout);
    document.addEventListener("animationstart", followLayout, true); document.addEventListener("transitionrun", followLayout, true);
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
      // Repeated choices inside the same modal restart this controller too.
      // An unadopted checkpoint still belongs to its original measured card;
      // an empty support must not overwrite it with a nearer-date capture.
      const pendingRestart = !support && !action ? restartSupport : undefined;
      const checkpointId = pendingRestart?.platform.id ?? support;
      const restartContext = { point: { x, y }, monthKey, root: page,
        platform: supportById(checkpointId), anchor: geometryTracker?.anchor(checkpointId),
        viewport: { width: innerWidth, height: innerHeight }, size, state: restartSupportState() };
      const retainedSupport = pendingRestart
        ? deferCompanionRestartSupport(pendingRestart, restartContext, overlayActive && !workAllowed())
        : captureCompanionRestartSupport(restartContext);
      lastPose.current = { x, y, monthKey, seeded: worldSeeded || Boolean(supportById(support)), atHome: isHomeSupport(support) && (homeOccluded || supportedNow()) && !pressed && !keyboardHeld && action?.kind !== "jump" && !playFalling, homeSupportId: isHomeSupport(support) ? support : undefined, restartSupport: retainedSupport };
      if (capturePosition.current === captureForSurface) capturePosition.current = null;
      persistCare(true);
      sceneDepart();
      stopped = true; routineEvent.current = () => {}; pendingFeeds.cancel(); clearSupportWait(); cancelTravelGoal(); cancelHomeJourney(); clearTimeout(preludeTimer); homeDeparture = undefined; el.removeAttribute("data-home-window"); resetHide(); resetInertia(); returning = undefined; premiereDisplay = undefined; premiereBounce = undefined; premiereExit = undefined; el.inert = false; el.removeAttribute("aria-hidden"); el.removeAttribute("data-premiere-companion"); el.removeAttribute("data-premiere-source"); el.removeAttribute("data-returning"); stopHover(); cancelAnimationFrame(followRaf); geometryTracker = undefined; anchorSeen.clear(); cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(clickGuard); clearTimeout(parkedLayoutTimer); clearAction(); control.current = null; observer.disconnect(); offGeometry?.(); hearts.dispose();
      cardPlay.clear();
      releaseOverlayDrag(); perchAnimation?.cancel(); disconnectOverlay(); cancelAnimationFrame(overlayRaf);
      window.removeEventListener("vic:companion-overlay", sync); window.removeEventListener("vic:companion-workspace", workspaceChanged); window.removeEventListener("resize", viewportResized); document.removeEventListener("animationend", queueOverlayPerch, true);
      window.removeEventListener("scroll", detailScrolled, true);
      window.removeEventListener("vic:companion-premiere", sync);
      window.removeEventListener("vic:companion-sprite", spriteDecoded);
      window.removeEventListener("vic:gfx-pref", sync); window.removeEventListener("vic:gfx-auto", sync); window.removeEventListener("storage", graphicsStored);
      window.removeEventListener(COMPANION_DETAIL_EVENT, detailChanged);
      window.removeEventListener(COMPANION_SCENE_SIGNAL, sceneSignal);
      window.removeEventListener(COMPANION_WORK_SIGNAL, workSignal);
      window.removeEventListener("pagehide", sceneDepart);
      window.removeEventListener("storage", syncAgentMemory);
      foodDiscarded.current = () => {};
      window.removeEventListener("blur", focusChanged); window.removeEventListener("focus", focusChanged);
      window.removeEventListener("resize", parkedLayout); window.removeEventListener("scroll", parkedLayout, true); window.removeEventListener("vic:companion-home", parkedLayout);
      window.removeEventListener("scroll", followLayout, true); window.removeEventListener("vic:companion-home", followLayout); window.removeEventListener("vic:side-panel", followLayout); window.visualViewport?.removeEventListener("scroll", followLayout);
      window.visualViewport?.removeEventListener("resize", viewportResized);
      window.removeEventListener("vic:panel-section", panelChanged);
      window.removeEventListener(COMPANION_CARD_PLAY_EVENT, followLayout);
      window.removeEventListener("vic:layout-motion", followLayout);
      document.removeEventListener("animationstart", followLayout, true); document.removeEventListener("transitionrun", followLayout, true);
      document.removeEventListener("visibilitychange", sync); document.removeEventListener("pointerdown", place, true); window.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", placementReleased, true); document.removeEventListener("pointercancel", placementReleased, true);
      document.removeEventListener("pointermove", sensePointer);
      document.removeEventListener("pointerout", outsideDocument);
      document.removeEventListener("keydown", keyboardModality, true);
      button.removeEventListener("pointerdown", down); button.removeEventListener("pointermove", move); button.removeEventListener("pointerleave", leave); button.removeEventListener("pointerup", up); button.removeEventListener("pointercancel", up); button.removeEventListener("lostpointercapture", lostCapture); button.removeEventListener("keydown", key);
      if (pressed && button.hasPointerCapture(pressed.id)) button.releasePointerCapture(pressed.id);
      el.hidden = true;
      hideBed();
      el.removeAttribute("data-native-sofa"); front?.removeAttribute("data-native-sofa"); clearSofaNames();
    };
  }, [ready, root, worldPreferencesKey, blocked, agenda, monthKey, reduced, geometryIdentity, positionMemory, discover, workExpressions]);

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
  // The room and its foreground receive the same material object in one React
  // commit. A geometry/rAF copy must never stage the two sofa surfaces.
  const homeLighting = companionRoomLighting(homeEnvironment, homeCurtain.phase, homeLampLit) as CSSProperties;
  const house = <CompanionHome lighting={homeLighting} care={care} preferences={preferences} inactive={overlayOpen || performanceActive} owner={premiereCue?.owner} unreadCollection={unreadCollection} radioPlaying={radioPlaying} environment={homeEnvironment} curtain={homeCurtain} toyCount={toyCount} onToyBox={() => { logActivity("ui.click", { target: "companion-home-toys" }); control.current?.toys(); }} onPersonality={() => onOpenBook("personality")} onAction={act} onClose={homeVisible ? undefined : closeHome} />;
  return createPortal(<>
    {/* This portal already owns body. Keep the floating room before its fixed
        resident so native CSS anchors also work when the short house scrolls. */}
    {compactActive && compactHost ? <div id={`${actorId}-home`} className="vc-compact-home" ref={compactHome} hidden={!homeExpanded} data-companion-home-owner={premiereCue?.owner} data-pm-exit="5" inert={overlayOpen || performanceActive ? true : undefined} aria-hidden={overlayOpen || performanceActive ? true : undefined} data-sfx="off" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (homeExpanded) logActivity("ui.click", { target: "companion-home-close" }); closeHome(); } }}>
      {/* The stable room carrier is moved here by the layout handoff. */}
    </div> : null}
    <span className="vc-wash-tool" ref={washTool} hidden aria-hidden="true"><svg width="24" height="38" viewBox="0 0 24 38" focusable="false"><path d="M6 12h5l2 20q-3 6-7 0Z" fill="#e6a052" stroke="#78522e" strokeWidth="1.5" /><path d="M4 3q4-3 9 0v10H4Z" fill="#fff5df" stroke="#78522e" strokeWidth="1.5" /><path d="M6 4v7m3-7v7m3-7v7" stroke="#76a79a" strokeWidth="1.4" /><g fill="#fffdf6" stroke="#b1cbd1" strokeWidth=".8"><circle cx="15" cy="8" r="3" /><circle cx="19" cy="4" r="2" /><circle cx="19" cy="11" r="2" /></g><path d="m20 17 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="#f8db89" /></svg></span>
    <span className="vc-home-touch-tool" ref={interactionTool} hidden aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18" focusable="false"><path d="M9 3v3M3 8l3 1M13 8l3-1" fill="none" stroke="#b48144" strokeWidth="1.6" strokeLinecap="round" /></svg></span>
    <CompanionDiscoveryFlight notice={discovery} enabled={preferences.enabled && !blocked && !overlayOpen && !performanceActive && !suspended} onComplete={finishDiscovery} />
    <div className="vc-companion" ref={body} hidden data-sfx="off" data-size="large" data-overlay={overlayOpen ? "quiet" : undefined} data-workspace-busy={workspaceBusy ? "" : undefined}>
    <span className="vc-contact-shadow" ref={shadow} aria-hidden="true" />
    <button id={actorId} className="vc-actor" ref={actor} type="button" tabIndex={overlayOpen ? -1 : 0} data-sfx="off" data-activity-manual="" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-help" aria-keyshortcuts="Enter Space P N ArrowUp ArrowDown ArrowLeft ArrowRight Escape" onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); }}>
      <span className="vc-inertia" ref={inertia} aria-hidden="true"><span className="vc-facing" ref={facing}><span className="vc-reaction" ref={reaction}><span className="vc-contact" ref={contact}><span className="vc-pose" ref={pose}>
        <span className="vc-wearable vc-wearable-back" ref={accessoryBack} hidden />
        <span className="vc-sprite" ref={sprite} />
        <canvas className="vc-expression-face" ref={expressionCanvas} hidden aria-hidden="true" />
        <span className="vc-wearable vc-wearable-front" ref={accessoryFront} hidden />
        <span className="vc-wearable vc-gift-prop" ref={giftProp} hidden />
      </span></span></span></span></span>
      <span className="vc-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>
    </button>
    {pendingGift && <button className="vc-gift-open" ref={giftButton} hidden type="button" aria-label="빅타민이 가져온 선물 열기" title="선물 열기" data-activity-manual="" data-sfx="off" disabled={blocked || overlayOpen || performanceActive} tabIndex={overlayOpen || performanceActive ? -1 : 0} onPointerDown={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); unwrapGift(); }} />}
    <span className="vc-effect" ref={effect} aria-hidden="true" />
    <span className="vc-affection-hearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></span>
    <span className="sr-only" id="vc-help">빅타민의 몸 위에서 마우스를 좌우로 움직여 쓰다듬기. 짧게 누르면 톡 치기. 끌어서 옮기기. Enter 쓰다듬기. 스페이스로 집고 방향키로 옮긴 뒤 스페이스나 Escape로 놓기. P로 위치 선택. N으로 낮잠.</span>
    <span className="sr-only" role="status">{announcement}</span>
  </div>
    {openedGift && preferences.enabled && !blocked && !overlayOpen && !performanceActive && <aside className="vc-keepsake-notice" aria-label="받은 선물">
      <div className="vc-keepsake-art"><CompanionCollectionArt kind="gift" id="gift-open" /><CompanionCollectionArt kind="accessory" id={openedGift} /></div>
      <div><strong>{COMPANION_ACCESSORY_NAMES[openedGift]} 선물!</strong><button className="button" type="button" data-sfx="off" data-act="companion-accessory-equip" data-act-opt="on" onClick={() => { if (equipCompanionAccessory(openedGift)) { hapticSuccess(); playCompanionSound("equip", preferencesRef.current); setOpenedGift(null); actor.current?.focus({ preventScroll: true }); } }}>착용하기</button></div>
      <button className="vc-keepsake-close" type="button" aria-label="받은 선물 닫기" data-act="companion-gift-dismiss" onClick={() => { setOpenedGift(null); actor.current?.focus({ preventScroll: true }); }}><X size={17} aria-hidden="true" /></button>
    </aside>}
    <div className="vc-bed-foreground" style={homeLighting} ref={bedForeground} hidden aria-hidden="true"><CompanionBedForeground /></div><CompanionFood ref={food} enabled={preferences.feeding} blocked={blocked || overlayOpen} monthKey={monthKey} onDiscard={id => foodDiscarded.current(id)} onLanded={() => { playCompanionSound("land", preferencesRef.current); }} returnFocus={() => { if (!overlayRef.current && !body.current?.hidden) actor.current?.focus({ preventScroll: true }); }} />
    <CompanionToys ref={toys} hidden={!preferences.enabled} blocked={!preferences.enabled || blocked || overlayOpen || workspaceBusy || suspended || performanceActive} onCount={setToyCount} onExperience={(kind, outcome, point) => {
      if (outcome === "played") routineEvent.current("played");
      const known = loadCompanionTastes().toys.includes(kind);
      const committed = recordCompanionToyExperience(kind, outcome, preferencesRef.current.learnFromYou !== false);
      if (committed && !known && outcome === "played" && point && loadCompanionTastes().toys.includes(kind)) discover({ kind: "toy", id: kind, source: point });
    }} onActivity={direct => control.current?.[direct ? "toyTouched" : "toyChanged"]()} onReturned={() => { control.current?.toyReturned(); playCompanionSound("play", preferencesRef.current); }} />
    {homeCarrier ? createPortal(house, homeCarrier) : null}
    {compactActive && launcherHost ? createPortal(<button ref={homeLauncher} data-act={homeExpanded ? "companion-home-close" : "companion-home-open"} data-home-action="launcher" type="button" className="button vc-home-launcher" aria-label={homeExpanded ? "빅타민 집 닫기" : "빅타민 집 열기"} aria-expanded={homeExpanded} aria-controls={`${actorId}-home`} data-companion-home-owner={premiereCue?.owner} data-pm-exit="5" inert={overlayOpen || performanceActive ? true : undefined} aria-hidden={overlayOpen || performanceActive ? true : undefined} onClick={() => homeExpanded ? closeHome() : homeShelf.open()} onKeyDown={event => { if (event.key === "Escape" && homeExpanded) { event.preventDefault(); event.stopPropagation(); logActivity("ui.click", { target: "companion-home-close" }); closeHome(); } }}><Home size={16} aria-hidden="true" /><span className="lbl vc-home-launcher-label">빅타민 집</span></button>, launcherHost) : null}
  </>, document.body);
}
