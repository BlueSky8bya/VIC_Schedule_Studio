"use client";

/* eslint-disable @next/next/no-img-element -- Local game art already has bounded WebP derivatives; no second image pipeline. */

import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import { PanelSection } from "@/components/shared/panel-section";
import type { CompanionCare } from "@/lib/ui/viewer-companion/care";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import type { CompanionHomeEnvironment } from "@/lib/ui/viewer-companion/home-environment";
import { resolveCompanionWindowScene } from "@/lib/ui/viewer-companion/home-window-scene";
import { INITIAL_COMPANION_HOME_CURTAIN, type CompanionHomeCurtain } from "@/lib/ui/viewer-companion/home-curtain";
import { HomeWindow } from "./companion-home-window";

export type CompanionHomeAction = "home" | "feed" | "clearFood" | "radio" | "book";
type Props = { care: CompanionCare; preferences: CompanionPreferences; inactive?: boolean; owner?: string; radioPlaying?: boolean; unreadCollection?: boolean; onAction: (action: CompanionHomeAction) => void; onClose?: () => void; onToyBox?: () => void; toyCount?: number; environment?: CompanionHomeEnvironment; curtain?: CompanionHomeCurtain };

function HomeObjectArt({ kind, className = "" }: { kind: "radio" | "book" | "dispenser" | "trash" | "toy-box"; className?: string }) {
  const [width, height] = { radio: [256, 164], book: [244, 256], dispenser: [256, 256], trash: [256, 229], "toy-box": [256, 134] }[kind];
  const image = <img className={`${kind === "book" ? "" : "vc-object-paint "}vc-home-object-image ${className}`} src={`/companion/home/${kind === "trash" ? "122" : "125"}/furniture-${kind}.webp`} width={width} height={height} alt="" aria-hidden="true" draggable={false} decoding="async" loading="lazy" />;
  // The cover uses the exact whole neutral sprite cell already shown by the
  // resident. Its identity is printed without generating another mascot.
  return kind === "book" ? <span className="vc-object-paint vc-book-paint" aria-hidden="true">{image}<span className="vc-book-cover-mascot" /></span> : image;
}

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
export function CompanionHome({ care, preferences, inactive, owner, radioPlaying = false, unreadCollection = false, onAction, onClose, onToyBox, toyCount = 0, environment, curtain = INITIAL_COMPANION_HOME_CURTAIN }: Props) {
  const room = useRef<HTMLElement>(null);
  const bedId = useId().replace(/:/g, "");
  // Its host already owns the panel FLIP. A tiny entry never resizes the room,
  // repeats on care changes, or creates an autonomous animation loop.
  useLayoutEffect(() => { if (room.current) flipSpring(room.current, "translateY(3px)"); }, []);
  return <PanelSection inert={inactive ? true : undefined} aria-hidden={inactive ? true : undefined} ref={room} title="빅타민 집" sectionKey="companion-home" headingAction="companion-home-fold" collapsible={!onClose} headingData={{ "data-home-action": "fold" }} actions={onClose ? <button type="button" data-home-action="close" data-act="companion-home-close" data-tip="닫기" className="vc-home-close" onClick={onClose} aria-label="빅타민 집 닫기"><X size={15} strokeWidth={1.7} /></button> : undefined} className="vc-home" aria-label="빅타민 집" data-home-presentation={onClose ? "compact" : "panel"} data-size={preferences.size} data-sfx="off" data-pm-exit="5" data-companion-home-owner={owner}>
    <div className="vc-home-room" data-season={environment?.season} data-weather={environment?.weather} data-band={environment?.band} data-phase={resolveCompanionWindowScene(environment).phase} data-night={environment?.night || undefined}>
      <HomeWindow environment={environment} curtain={curtain} inactive={inactive} />
      <div className="vc-home-shelf">
      <svg className="vc-home-shelf-art" width="108" height="55" viewBox="0 0 108 55" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${bedId}-shelf`} x2=".15" y2="1"><stop stopColor="var(--vc-wood-light)" /><stop offset=".5" stopColor="var(--vc-wood)" /><stop offset="1" stopColor="var(--vc-wood-edge)" /></linearGradient>
        </defs>
        <path className="vc-shelf-bracket" d="M16 43v5m76-5v5" />
        <rect className="vc-shelf-board-shadow" x="4" y="42" width="100" height="7" rx="3.5" />
        <rect className="vc-shelf-board" x="3" y="37" width="102" height="7" rx="2.5" fill={`url(#${bedId}-shelf)`} />
      </svg>
      <button type="button" className="vc-book-button" data-home-action="book" data-act="companion-book-open" data-sfx="off" data-tip="빅타민 수첩" data-unread={unreadCollection || undefined} aria-label="빅타민 수첩 열기" aria-describedby={unreadCollection ? `${bedId}-unread` : undefined} onClick={() => onAction("book")}>
        <HomeObjectArt kind="book" />
        {unreadCollection && <><span className="vc-book-unread" aria-hidden="true">!</span><span className="sr-only" id={`${bedId}-unread`}>새 발견이 있어요</span></>}
      </button>
      <button type="button" className="vc-radio-button" data-home-action="radio" data-activity-manual="" data-sfx="off" data-tip={radioPlaying ? "라디오 끄기" : "라디오 켜기"} aria-label={radioPlaying ? "라디오 끄기" : "라디오 켜기"} aria-pressed={radioPlaying} onClick={() => onAction("radio")}>
        <HomeObjectArt kind="radio" />
      </button>
      {radioPlaying && preferences.enabled && !inactive && <span className="vc-radio-notes" aria-hidden="true">
        {[0, 1, 2].map(note => <svg className="vc-radio-note" key={note} width="9" height="14" viewBox="0 0 12 18" focusable="false"><path d="M5 3v10c-1.1-.4-3.1.1-3.8 1.3-.7 1.3 0 2.4 1.5 2.4 1.7 0 3.7-1.3 3.7-3V6l4-1V1.8Z" /></svg>)}
      </span>}
      </div>
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
      <button type="button" data-home-action="toys" data-act="companion-home-toys" data-activity-manual="" data-tip="장난감 상자" className="vc-toy-box" onClick={onToyBox} disabled={!onToyBox} aria-label="장난감 상자 열기" data-toy-count={Math.max(0, Math.trunc(toyCount))}>
        <HomeObjectArt kind="toy-box" />
        <span className="vc-toy-box-opening" aria-hidden="true" />
      </button>
      {preferences.feeding ? <>
        <button type="button" data-home-action="feed" data-activity-manual="" data-tip="밥 꺼내기" className="vc-dispenser" onClick={() => onAction("feed")} aria-label="밥 꺼내기">
          <HomeObjectArt kind="dispenser" className="vc-dispenser-paint" />
          {/* Actual outlet geometry stays fixed while the complete paint moves. */}
          <span className="vc-dispenser-slot" aria-hidden="true" />
        </button>
        <button type="button" data-home-action="clearFood" data-activity-manual="" data-companion-trash="" data-tip="음식 버리기" className="vc-home-trash" onClick={() => onAction("clearFood")} aria-label="음식 버리기"><HomeObjectArt kind="trash" /></button>
      </> : null}
    </div>
    <div className="sr-only"><meter min="0" max="1" value={care.affection} aria-label="빅타민 친밀도" /><meter min="0" max="1" value={1 - care.hunger} aria-label="빅타민 포만감" /><meter min="0" max="1" value={care.energy} aria-label="빅타민 기력" /></div>
  </PanelSection>;
}
