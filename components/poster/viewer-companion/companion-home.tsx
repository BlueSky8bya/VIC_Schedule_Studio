"use client";

import { Utensils, X } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import { PanelSection } from "@/components/shared/panel-section";
import type { CompanionCare } from "@/lib/ui/viewer-companion/care";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

export type CompanionHomeAction = "home" | "feed" | "clearFood";
type Props = { care: CompanionCare; preferences: CompanionPreferences; inactive?: boolean; owner?: string; onAction: (action: CompanionHomeAction) => void; onClose?: () => void };

// The open U is shared by the room drawing and the separate foreground layer.
// Its centre begins at54/100: the actual seat stays behind14–18px of cloth at
// current rail/compact sizes, with the upper body and face left unobstructed.
const BED_FRONT = "M8 49C8 35 17 23 31 19l3 12C22 47 49 54 90 54s68-7 56-23l3-12c14 4 23 16 23 30v18c0 23-35 29-82 29S8 90 8 67Z";
const BED_OUTER = "M8 50C8 19 42 7 90 7s82 12 82 43v17c0 23-35 29-82 29S8 90 8 67Z";
const BED_SEAT = "M149 48a59 27 0 1 1-118 0 59 27 0 1 1 118 0Z";
// A separate inset keeps complete rounded rib strokes away from the opening,
// outer contour and welt. The unchanged U above remains the occlusion mask.
const BED_FRONT_INSET = "M13 49c0-11 9-20 15-23l1 6C21 50 50 59 90 59s69-9 61-27l1-6c6 3 15 12 15 23v17c0 18-32 26-77 26S13 84 13 66Z";
function BedFront({ gradientId, clipId }: { gradientId: string; clipId: string }) {
  return <>
    <defs><clipPath id={clipId}><path d={BED_FRONT} /></clipPath><clipPath id={`${clipId}-ribs`}><path d={BED_FRONT_INSET} /></clipPath></defs>
    <path className="vc-bed-front-shape" d={BED_FRONT} fill={`url(#${gradientId})`} />
    <g clipPath={`url(#${clipId})`}>
      <g clipPath={`url(#${clipId}-ribs)`}><path className="vc-bed-front-ribs" d="M28 47C21 60 24 74 34 81M42 56C37 67 40 79 48 86M58 60C54 70 56 82 61 89M74 62C72 73 73 83 75 90M90 62v28M106 62c2 11 1 21-1 28M122 60c4 10 2 22-3 29M138 56c5 11 2 23-6 30M152 47c7 13 4 27-6 34" /></g>
      <path className="vc-bed-front-welt" d="M34 31C22 47 49 54 90 54s68-7 56-23" />
    </g>
  </>;
}

/** Pointer-free cloth drawn over a grounded resident by the single runtime.
 * The caller carries the actual bed SVG rectangle and copies its four cloth
 * tokens; neither this art nor the portal invents a second landing anchor. */
export function CompanionBedForeground({ idPrefix = "companion-front" }: { idPrefix?: string }) {
  const instance = useId().replace(/:/g, ""), id = `${idPrefix}-${instance}`;
  return <svg className="vc-bed-front-art" width="180" height="100" viewBox="0 0 180 100" fill="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="27" y2="100"><stop stopColor="var(--vc-bed-light)" /><stop offset=".55" stopColor="var(--vc-bed-cloth)" /><stop offset="1" stopColor="var(--vc-bed-shade)" /></linearGradient></defs>
    <g className="vc-sofa-feedback"><BedFront gradientId={`${id}-rim`} clipId={`${id}-clip`} /></g>
  </svg>;
}

/** One small room, shared by the desktop rail and compact portal. The cushion
 * is a real landing anchor; food and care stay in the existing single runtime. */
export function CompanionHome({ care, preferences, inactive, owner, onAction, onClose }: Props) {
  const room = useRef<HTMLElement>(null);
  const bedId = useId().replace(/:/g, "");
  // Its host already owns the panel FLIP. A tiny entry never resizes the room,
  // repeats on care changes, or creates an autonomous animation loop.
  useLayoutEffect(() => { if (room.current) flipSpring(room.current, "translateY(3px)"); }, []);
  return <PanelSection inert={inactive ? true : undefined} aria-hidden={inactive ? true : undefined} ref={room} title="빅타민 집" sectionKey="companion-home" headingAction="companion-home-fold" collapsible headingData={{ "data-home-action": "fold" }} actions={onClose ? <button type="button" data-home-action="close" data-act="companion-home-close" data-tip="닫기" className="vc-home-close" onClick={onClose} aria-label="빅타민 집 닫기"><X size={15} strokeWidth={1.7} /></button> : undefined} className="vc-home" aria-label="빅타민 집" data-size={preferences.size} data-sfx="off" data-pm-exit="5" data-companion-home-owner={owner}>
    <div className="vc-home-room">
      <svg className="vc-home-window" width="64" height="56" viewBox="0 0 76 66" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${bedId}-window`} x1=".15" x2=".85" y2="1"><stop stopColor="var(--vc-wood-light)" /><stop offset=".5" stopColor="var(--vc-wood)" /><stop offset="1" stopColor="var(--vc-wood-edge)" /></linearGradient>
          <linearGradient id={`${bedId}-curtain`} x2="1" y2=".5"><stop stopColor="var(--vc-linen-edge)" /><stop offset=".45" stopColor="var(--vc-linen)" /><stop offset="1" stopColor="var(--vc-linen-edge)" /></linearGradient>
        </defs>
        <rect className="vc-window-shadow" x="3" y="6" width="70" height="56" rx="12" />
        <rect className="vc-window-frame" x="3" y="3" width="70" height="58" rx="12" fill={`url(#${bedId}-window)`} />
        <rect className="vc-window-sky" x="8" y="8" width="60" height="48" rx="8" />
        <circle className="vc-window-sun" cx="50" cy="23" r="6.5" />
        <path className="vc-window-hill" d="M10 44c13-14 20-4 29-6 11-11 20-8 27-5v11c0 6-5 9-12 9H22c-8 0-12-3-12-9Z" />
        <path className="vc-window-mullion-shadow" d="M39 9v46M9 33h58" />
        <path className="vc-window-mullion" d="M38 8v47M8 32h60" />
        <path className="vc-window-curtain" fill={`url(#${bedId}-curtain)`} d="M8 8h14c-1 13-5 22-14 26Zm60 0H54c1 13 5 22 14 26Z" />
        <path className="vc-window-curtain-fold" d="M15 10c0 7-2 14-5 19m51-19c0 7 2 14 5 19" />
        <rect className="vc-window-sill" x="1" y="57" width="74" height="5" rx="2" fill={`url(#${bedId}-window)`} />
        <rect className="vc-window-edge" x="4.5" y="4.5" width="67" height="54" rx="10.5" />
      </svg>
      <svg className="vc-home-shelf" width="108" height="55" viewBox="0 0 108 55" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${bedId}-shelf`} x2=".15" y2="1"><stop stopColor="var(--vc-wood-light)" /><stop offset=".5" stopColor="var(--vc-wood)" /><stop offset="1" stopColor="var(--vc-wood-edge)" /></linearGradient>
          <linearGradient id={`${bedId}-pot`} x2=".8" y2="1"><stop stopColor="var(--vc-ceramic-light)" /><stop offset=".65" stopColor="var(--vc-ceramic)" /><stop offset="1" stopColor="var(--vc-ceramic-edge)" /></linearGradient>
          <linearGradient id={`${bedId}-leaf`} x2="1" y2="1"><stop stopColor="var(--vc-leaf-light)" /><stop offset=".55" stopColor="var(--vc-sage)" /><stop offset="1" stopColor="var(--vc-leaf-shade)" /></linearGradient>
        </defs>
        <rect className="vc-shelf-frame-shadow" x="10" y="6" width="28" height="33" rx="4" />
        <rect className="vc-shelf-frame" x="10" y="3" width="28" height="34" rx="4" fill={`url(#${bedId}-shelf)`} />
        <rect className="vc-shelf-picture-base" x="14" y="7" width="20" height="26" rx="2" />
        <path className="vc-shelf-picture" d="M16 26c4-9 7-9 10-2 3-5 5-5 7-2v5c0 3-2 4-5 4h-7c-4 0-5-1-5-5Z" />
        <circle className="vc-shelf-picture-sun" cx="28" cy="14" r="3" />
        <path className="vc-shelf-stem" d="M76 32c0-8-2-15-1-22m1 15 8-8m-9 8-8-5" />
        <path className="vc-shelf-leaf" fill={`url(#${bedId}-leaf)`} d="M73 23c-10 0-15-6-14-13 9 1 15 5 14 13Zm4-3c-2-9 3-14 11-16 1 9-2 15-11 16Zm2 7c1-7 6-11 15-10-3 8-8 11-15 10Z" />
        <path className="vc-shelf-leaf-vein" d="m63 14 7 7m15-12-6 8m11 4-8 4" />
        <path className="vc-shelf-pot" fill={`url(#${bedId}-pot)`} d="M65 25h23l-1.5 10c-.5 7-19.5 7-20 0Z" />
        <ellipse className="vc-shelf-pot-lip" cx="76.5" cy="25" rx="12" ry="2.5" />
        <path className="vc-shelf-bracket" d="M16 43v5m76-5v5" />
        <rect className="vc-shelf-board-shadow" x="4" y="42" width="100" height="7" rx="3.5" />
        <rect className="vc-shelf-board" x="3" y="37" width="102" height="7" rx="2.5" fill={`url(#${bedId}-shelf)`} />
      </svg>
      <span className="vc-home-light" aria-hidden="true" />
      <span className="vc-home-floor" aria-hidden="true" />
      <button type="button" data-home-action="home" data-activity-manual="" data-tip="집으로 부르기" className="vc-cushion-button" onClick={() => onAction("home")} aria-label="쿠션으로 돌아가 쉬기">
        <svg className="vc-plush-bed" width="180" height="100" viewBox="0 0 180 100" fill="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={`${bedId}-rim`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="27" y2="100"><stop stopColor="var(--vc-bed-light)" /><stop offset=".55" stopColor="var(--vc-bed-cloth)" /><stop offset="1" stopColor="var(--vc-bed-shade)" /></linearGradient>
            <radialGradient id={`${bedId}-nest`} cx=".48" cy=".6" r=".65"><stop stopColor="var(--vc-bed-cloth)" /><stop offset=".65" stopColor="var(--vc-bed-cloth)" /><stop offset="1" stopColor="var(--vc-bed-shade)" /></radialGradient>
            <mask id={`${bedId}-body-surface`} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="100"><path d={BED_OUTER} fill="white" /><path d={BED_FRONT} fill="black" /></mask>
            <mask id={`${bedId}-back-surface`} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="100"><path d={BED_OUTER} fill="white" /><path d={BED_SEAT} fill="black" /><path d={BED_FRONT} fill="black" /></mask>
            <mask id={`${bedId}-seat-surface`} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="100"><path d={BED_SEAT} fill="white" /><path d={BED_FRONT} fill="black" /></mask>
          </defs>
          <g className="vc-sofa-feedback">
          <ellipse className="vc-bed-ground" cx="90" cy="89" rx="77" ry="8" />
          <path fill={`url(#${bedId}-rim)`} d={BED_OUTER} mask={`url(#${bedId}-body-surface)`} />
          <g mask={`url(#${bedId}-seat-surface)`}><ellipse fill={`url(#${bedId}-nest)`} cx="90" cy="48" rx="59" ry="27" /><ellipse className="vc-bed-centre" cx="90" cy="58" rx="51" ry="18" /></g>
          {/* Each back rib ends inside its own exposed surface. The seat and
              entire foreground are explicitly subtracted, not painted over. */}
          <path className="vc-bed-back-ribs" mask={`url(#${bedId}-back-surface)`} d="M54.6 28.4Q48.3 20.2 42 12M63.45 25.89Q58.73 17.08 54 8.28M72.3 24.24Q69.15 15.04 66 5.84M81.15 23.31Q79.58 13.88 78 4.45M90 23Q90 13.5 90 4M98.85 23.31Q100.42 13.88 102 4.45M107.7 24.24Q110.85 15.04 114 5.84M116.55 25.89Q121.28 17.08 126 8.28M125.4 28.4Q131.7 20.2 138 12" />
          {/* The full local sofa owns this cloth except while the one runtime
              portal must place it over an interior resident. */}
          <g className="vc-bed-local-front"><BedFront gradientId={`${bedId}-rim`} clipId={`${bedId}-front-clip`} /></g>
          </g>
        </svg>
        <span className="vc-home-cushion" aria-hidden="true" />
      </button>
      {preferences.feeding ? <>
        <button type="button" data-home-action="feed" data-activity-manual="" data-tip="밥 꺼내기" className="vc-dispenser" onClick={() => onAction("feed")} aria-label="밥 꺼내기"><svg className="vc-dispenser-container" width="48" height="62" fill="none" viewBox="0 0 48 62" aria-hidden="true" focusable="false"><defs><linearGradient id={`${bedId}-dispenser`} x2=".8" y2="1"><stop stopColor="var(--vc-container-light)" /><stop offset=".5" stopColor="var(--vc-container)" /><stop offset="1" stopColor="var(--vc-container-edge)" /></linearGradient></defs><ellipse className="vc-object-ground" cx="24" cy="58" rx="21" ry="3" /><rect className="vc-dispenser-body" fill={`url(#${bedId}-dispenser)`} x="2" y="2" width="44" height="58" rx="11" /><path className="vc-dispenser-top" d="M10 6h28" /><rect className="vc-dispenser-panel" x="9" y="11" width="30" height="29" rx="7" /><path className="vc-dispenser-base" d="M8 56h32" /></svg><span className="vc-dispenser-face" aria-hidden="true"><Utensils size={19} strokeWidth={1.5} /><span className="vc-dispenser-dot" /></span><span className="vc-dispenser-slot" aria-hidden="true" /></button>
        <button type="button" data-home-action="clearFood" data-activity-manual="" data-companion-trash="" data-tip="음식 버리기" className="vc-home-trash" onClick={() => onAction("clearFood")} aria-label="음식 버리기"><svg width="36" height="44" fill="none" viewBox="0 0 28 32" aria-hidden="true" focusable="false"><defs><linearGradient id={`${bedId}-basket`} x2=".8" y2="1"><stop stopColor="var(--vc-bin-light)" /><stop offset=".5" stopColor="var(--vc-bin)" /><stop offset="1" stopColor="var(--vc-bin-edge)" /></linearGradient></defs><ellipse className="vc-object-ground" cx="14" cy="29" rx="11" ry="2" /><path className="vc-trash-body" fill={`url(#${bedId}-basket)`} d="M4 11h20l-1 14c0 3-3 4-9 4s-9-1-9-4Z" /><path className="vc-trash-rim" d="M5 12h18" /><g className="vc-trash-lid"><path className="vc-trash-handle" d="M10 7c0-5 8-5 8 0" /><path className="vc-trash-lid-surface" fill={`url(#${bedId}-basket)`} d="M4 6h20a2 2 0 0 1 2 2v2H2V8a2 2 0 0 1 2-2Z" /><path className="vc-trash-lid-edge" d="M5 7.5h18" /></g></svg><span className="vc-trash-progress" aria-hidden="true" /></button>
      </> : null}
    </div>
    <div className="sr-only"><meter min="0" max="1" value={care.affection} aria-label="빅타민 친밀도" /><meter min="0" max="1" value={1 - care.hunger} aria-label="빅타민 포만감" /><meter min="0" max="1" value={care.energy} aria-label="빅타민 기력" /></div>
  </PanelSection>;
}
