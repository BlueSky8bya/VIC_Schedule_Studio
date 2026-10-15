"use client";

import { Hand, Heart, Home, Moon, MoreHorizontal, Move, Sprout, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flipSpring } from "@/lib/ui/flip-motion";
import type { CompanionCare } from "@/lib/ui/viewer-companion/care";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { CompanionFruit } from "./companion-fruit";
import "./companion-home.css";

export type CompanionHomeAction = "pet" | "place" | "rest" | "home" | "apple" | "lemon" | "clearFood";
type Props = { care: CompanionCare; preferences: CompanionPreferences; onAction: (action: CompanionHomeAction) => void; onClose?: () => void };

/** A single set of care controls, portalled into the shared rail or the compact
 * home. No second brain, care store or pet sprite lives inside this room. */
export function CompanionHome({ care, preferences, onAction, onClose }: Props) {
  const room = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId(), triggerId = `${menuId}-trigger`;
  // The shared panel already owns its FLIP. This tiny entry only acknowledges
  // the room mounting; it never scales/reflows the calendar or repeats on care.
  useLayoutEffect(() => { if (room.current) flipSpring(room.current, "translateY(3px)"); }, []);
  const closeness = care.affection >= .75 ? "마음이 통해요" : care.affection >= .45 ? "제법 친해졌어요" : "알아가는 중";
  const mood = care.energy < .35 ? "졸려요" : care.hunger >= .7 ? "배고파요" : care.hunger < .35 ? "든든해요" : "간식 생각";
  const actions: { action: CompanionHomeAction; label: string; icon: ReactNode }[] = [
    ...(preferences.petting ? [{ action: "pet" as const, label: "쓰다듬기", icon: <Hand size={15} aria-hidden="true" /> }] : []),
    ...(preferences.drag ? [{ action: "place" as const, label: "옮길 곳 고르기", icon: <Move size={15} aria-hidden="true" /> }] : []),
    ...(preferences.sleep ? [{ action: "rest" as const, label: "여기서 낮잠", icon: <Moon size={15} aria-hidden="true" /> }] : []),
    ...(preferences.feeding ? [{ action: "clearFood" as const, label: "남은 밥 치우기", icon: <Sprout size={15} aria-hidden="true" /> }] : []),
  ];
  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus({ preventScroll: true }));
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMenuOpen(false); trigger.current?.focus({ preventScroll: true }); } };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", escape, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape, true); };
  }, [menuOpen]);
  const choose = (action: CompanionHomeAction) => {
    setMenuOpen(false); onAction(action);
    // The placement action deliberately transfers focus to the real creature.
    if (action !== "place") trigger.current?.focus({ preventScroll: true });
  };
  return <section ref={room} className="vc-home" aria-label="빅타민 집" data-size={preferences.size} data-sfx="off" data-pm-exit="5">
    <header className="vc-home-heading">
      <span className="vc-home-title"><Home size={15} aria-hidden="true" /> 빅타민 집</span>
      <div className="vc-home-tools">
        {actions.length ? <button ref={trigger} id={triggerId} type="button" data-home-action="care-menu" data-tip="돌보기" className="vc-home-tool" aria-label="빅타민 돌보기" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={() => setMenuOpen(open => !open)} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); event.stopPropagation(); setMenuOpen(true); } }}><MoreHorizontal size={19} aria-hidden="true" /></button> : null}
        {onClose ? <button type="button" data-home-action="close" className="vc-home-tool vc-home-close" onClick={onClose} aria-label="빅타민 집 닫기"><X size={16} /></button> : null}
      </div>
    </header>
    <div className="vc-home-room">
      <div className="vc-home-window" aria-hidden="true"><span className="vc-home-sky" /><i /><i /><span className="vc-home-window-sill" /></div>
      <span className="vc-home-lamp" aria-hidden="true"><i /></span>
      <span className="vc-home-rug" aria-hidden="true" />
      <button type="button" data-home-action="home" className="vc-cushion-button" disabled={!preferences.sleep} onClick={() => onAction("home")} aria-label="쿠션으로 돌아가 쉬기"><span className="vc-home-cushion"><i /></span><span className="vc-cushion-label">포근한 자리</span></button>
      {preferences.feeding ? <div className="vc-dispenser" role="group" aria-label="간식 자판기">
        <button type="button" data-home-action="apple" onClick={() => onAction("apple")} aria-label="사과 밥 꺼내기"><CompanionFruit kind="apple" /><span>사과</span></button>
        <button type="button" data-home-action="lemon" onClick={() => onAction("lemon")} aria-label="레몬 밥 꺼내기"><CompanionFruit kind="lemon" /><span>레몬</span></button>
        <span className="vc-dispenser-slot" aria-hidden="true" />
      </div> : null}
    </div>
    <div className="vc-home-status"><span className="vc-home-bond"><Heart size={12} aria-hidden="true" /><span>{closeness}</span></span><span className="vc-home-mood">{mood}</span></div>
    <div className="sr-only"><meter min="0" max="1" value={care.affection} aria-label="빅타민 친밀도" /><meter min="0" max="1" value={1 - care.hunger} aria-label="빅타민 포만감" /><meter min="0" max="1" value={care.energy} aria-label="빅타민 기력" /></div>
    {menuOpen ? <div ref={menu} id={menuId} role="menu" aria-labelledby={triggerId} className="vc-home-menu" onKeyDown={event => {
      if (event.key === "Tab") { setMenuOpen(false); trigger.current?.focus({ preventScroll: true }); return; }
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']")];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index + items.length - 1) % items.length : index;
      items[next]?.focus({ preventScroll: true });
    }}>
      {actions.map(item => <button key={item.action} type="button" role="menuitem" data-home-action={item.action} onClick={() => choose(item.action)}>{item.icon}<span>{item.label}</span></button>)}
    </div> : null}
  </section>;
}
