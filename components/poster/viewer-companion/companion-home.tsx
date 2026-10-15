"use client";

import { Utensils, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import { PanelSection } from "@/components/shared/panel-section";
import type { CompanionCare } from "@/lib/ui/viewer-companion/care";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import "./companion-home.css";

export type CompanionHomeAction = "home" | "feed" | "clearFood";
type Props = { care: CompanionCare; preferences: CompanionPreferences; inactive?: boolean; onAction: (action: CompanionHomeAction) => void; onClose?: () => void };

/** One small room, shared by the desktop rail and compact portal. The cushion
 * is a real landing anchor; food and care stay in the existing single runtime. */
export function CompanionHome({ care, preferences, inactive, onAction, onClose }: Props) {
  const room = useRef<HTMLElement>(null);
  // Its host already owns the panel FLIP. A tiny entry never resizes the room,
  // repeats on care changes, or creates an autonomous animation loop.
  useLayoutEffect(() => { if (room.current) flipSpring(room.current, "translateY(3px)"); }, []);
  return <PanelSection inert={inactive ? true : undefined} aria-hidden={inactive ? true : undefined} ref={room} title="빅타민 집" sectionKey="companion-home" collapsible headingData={{ "data-home-action": "fold" }} actions={onClose ? <button type="button" data-home-action="close" data-tip="닫기" className="vc-home-close" onClick={onClose} aria-label="빅타민 집 닫기"><X size={15} strokeWidth={1.7} /></button> : undefined} className="vc-home" aria-label="빅타민 집" data-size={preferences.size} data-sfx="off" data-pm-exit="5">
    <div className="vc-home-room">
      <svg className="vc-home-window" viewBox="0 0 76 66" aria-hidden="true" focusable="false">
        <rect className="vc-window-frame" x="3" y="3" width="70" height="58" rx="15" />
        <rect className="vc-window-sky" x="8" y="8" width="60" height="48" rx="11" />
        <circle className="vc-window-sun" cx="51" cy="23" r="7" />
        <path className="vc-window-hill" d="M8 45c14-14 20-3 30-5 13-12 22-11 30-5v10a11 11 0 0 1-11 11H19A11 11 0 0 1 8 45Z" />
        <path className="vc-window-mullion" d="M38 9v46M9 32h58" />
        <path className="vc-window-curtain" d="M8 9h13c-1 12-5 17-12 18V9Zm47 0h13v18c-8-2-12-8-13-18Z" />
        <path className="vc-window-sill" d="M3 62h70" />
      </svg>
      <svg className="vc-home-shelf" viewBox="0 0 108 55" aria-hidden="true" focusable="false">
        <rect className="vc-shelf-frame" x="12" y="4" width="24" height="30" rx="4" />
        <path className="vc-shelf-picture" d="m17 26 6-9 5 5 3-3v10H17Z" />
        <circle className="vc-shelf-picture-sun" cx="28" cy="12" r="3" />
        <path className="vc-shelf-stem" d="M76 27V11m0 10c-9 0-13-5-12-10 7-1 12 3 12 10Zm0-4c8 0 12-5 11-10-7 0-11 3-11 10Z" />
        <path className="vc-shelf-pot" d="m65 25 3 13h16l3-13Z" />
        <rect className="vc-shelf-board" x="6" y="37" width="96" height="5" rx="2.5" />
        <path className="vc-shelf-bracket" d="M16 42v5m76-5v5" />
      </svg>
      <span className="vc-home-light" aria-hidden="true" />
      <span className="vc-home-floor" aria-hidden="true" />
      <span className="vc-home-rug" aria-hidden="true" />
      <button type="button" data-home-action="home" data-tip="집으로 부르기" className="vc-cushion-button" disabled={!preferences.sleep} onClick={() => onAction("home")} aria-label="쿠션으로 돌아가 쉬기"><span className="vc-home-cushion" aria-hidden="true"><i /></span></button>
      {preferences.feeding ? <>
        <button type="button" data-home-action="feed" data-tip="밥 꺼내기" className="vc-dispenser" onClick={() => onAction("feed")} aria-label="밥 꺼내기"><span className="vc-dispenser-face" aria-hidden="true"><Utensils size={19} strokeWidth={1.5} /><span className="vc-dispenser-dot" /></span><span className="vc-dispenser-slot" aria-hidden="true" /></button>
        <button type="button" data-home-action="clearFood" data-companion-trash="" data-tip="음식 버리기" className="vc-home-trash" onClick={() => onAction("clearFood")} aria-label="음식 버리기"><svg viewBox="0 0 28 32" aria-hidden="true" focusable="false"><g className="vc-trash-lid"><path d="M5 9h18M10 9V6.5A1.5 1.5 0 0 1 11.5 5h5A1.5 1.5 0 0 1 18 6.5V9" /></g><path className="vc-trash-body" d="m7 12 1.3 14.2A2 2 0 0 0 10.3 28h7.4a2 2 0 0 0 2-1.8L21 12" /><path className="vc-trash-lines" d="m12 15 .5 9m3.5-9-.5 9" /></svg><span className="vc-trash-progress" aria-hidden="true" /></button>
      </> : null}
    </div>
    <div className="sr-only"><meter min="0" max="1" value={care.affection} aria-label="빅타민 친밀도" /><meter min="0" max="1" value={1 - care.hunger} aria-label="빅타민 포만감" /><meter min="0" max="1" value={care.energy} aria-label="빅타민 기력" /></div>
  </PanelSection>;
}
