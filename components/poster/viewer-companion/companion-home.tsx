"use client";

import { Hand, Home, Moon, Move, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import type { CompanionCare } from "@/lib/ui/viewer-companion/care";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { CompanionFruit } from "./companion-fruit";

export type CompanionHomeAction = "pet" | "place" | "rest" | "home" | "apple" | "lemon" | "clearFood";
type Props = { care: CompanionCare; preferences: CompanionPreferences; onAction: (action: CompanionHomeAction) => void; onClose?: () => void };

/** A single set of care controls, portalled into the shared rail or the compact
 * home. No second brain, care store or pet sprite lives inside this room. */
export function CompanionHome({ care, preferences, onAction, onClose }: Props) {
  const room = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (room.current) flipSpring(room.current, "translateY(8px) scale(.985)"); }, []);
  const closeness = care.affection >= .75 ? "마음이 잘 통해요" : care.affection >= .45 ? "제법 가까워졌어요" : "조금씩 친해지는 중";
  const mood = care.energy < .35 ? "눈이 스르르 감겨요" : care.hunger >= .7 ? "배가 꼬르륵" : care.hunger < .35 ? "배가 든든해요" : "간식이 생각나요";
  return <section ref={room} className="vc-home" aria-label="빅타민 집" data-size={preferences.size} data-sfx="off" data-pm-exit="5">
    <header className="vc-home-heading"><span><Home size={15} aria-hidden="true" /> 빅타민 집</span>{onClose ? <button type="button" data-home-action="close" className="vc-home-close" onClick={onClose} aria-label="빅타민 집 닫기"><X size={16} /></button> : <span className="vc-home-mood">{mood}</span>}</header>
    <div className="vc-home-room">
      <div className="vc-home-window" aria-hidden="true"><i /><i /></div>
      <button type="button" data-home-action="home" className="vc-cushion-button" disabled={!preferences.sleep} onClick={() => onAction("home")} aria-label="쿠션으로 돌아가 쉬기"><span className="vc-home-cushion" /><span className="vc-cushion-label">포근한 자리</span></button>
      {preferences.feeding ? <div className="vc-dispenser" role="group" aria-label="간식 자판기">
        <button type="button" data-home-action="apple" onClick={() => onAction("apple")} aria-label="사과 밥 꺼내기"><CompanionFruit kind="apple" /><span>사과</span></button>
        <button type="button" data-home-action="lemon" onClick={() => onAction("lemon")} aria-label="레몬 밥 꺼내기"><CompanionFruit kind="lemon" /><span>레몬</span></button>
        <span className="vc-dispenser-slot" aria-hidden="true" />
      </div> : null}
    </div>
    <div className="vc-home-bond"><span>친밀도 <strong>{closeness}</strong></span><meter min="0" max="1" value={care.affection} aria-label="빅타민 친밀도" /></div>
    <div className="vc-home-needs"><span>포만감 <meter min="0" max="1" value={1 - care.hunger} aria-label="빅타민 포만감" /></span><span>기력 <meter min="0" max="1" value={care.energy} aria-label="빅타민 기력" /></span></div>
    <div className="vc-home-actions">
      {preferences.petting ? <button type="button" data-home-action="pet" onClick={() => onAction("pet")}><Hand size={15} aria-hidden="true" />쓰다듬기</button> : null}
      {preferences.drag ? <button type="button" data-home-action="place" onClick={() => onAction("place")}><Move size={15} aria-hidden="true" />옮길 곳 고르기</button> : null}
      {preferences.sleep ? <button type="button" data-home-action="rest" onClick={() => onAction("rest")}><Moon size={15} aria-hidden="true" />여기서 낮잠</button> : null}
      {preferences.feeding ? <button type="button" data-home-action="clearFood" onClick={() => onAction("clearFood")}>남은 밥 치우기</button> : null}
    </div>
    <p className="vc-home-help">톡 누르면 쓰다듬기 · 꾹 누른 뒤 끌면 집기</p>
  </section>;
}
