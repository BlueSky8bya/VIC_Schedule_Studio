"use client";

// 배경 감상 모드(2026-09-04 사용자: "누가 봐도 한 번은 눌러보고 싶게, 설정 밖에") — 편집실·시청자 공용.
// 켜면 `<html data-showcase>`가 붙고 CSS가 배경 레이어(.gs-tide/.gs-season)만 남기고 크롬을 전부 투명·클릭 통과로
// 만든다(studio-shell.css / public-poster.css). 화면 전체가 '바탕'이 되어 잎 집기·발자국·잔물결이 어디서든 된다.
// 상태는 모듈 전역(속성 하나) — 어느 화면의 버튼이든 같은 스위치. 나가기 = Esc 또는 상단 알약(body 포털이라 숨김
// 규칙에 안 걸린다). 버튼은 계절 아이콘으로 "지금 계절을 보러 가자"를 말한다.

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Eye, Flower2, Haze, Leaf, Power, Snowflake, Sparkles, Waves } from "lucide-react";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { type AmbientMode, ambientMode, setAmbientMode } from "@/lib/ui/motion";

let active = false;
const listeners = new Set<() => void>();

function set(on: boolean): void {
  if (typeof document === "undefined" || active === on) return;
  active = on;
  if (on) document.documentElement.setAttribute("data-showcase", "1");
  else document.documentElement.removeAttribute("data-showcase");
  for (const l of listeners) l();
}
export const enterShowcase = () => set(true);
export const exitShowcase = () => set(false);
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const get = () => active;
const getServer = () => false;

export function useShowcase(): boolean {
  return useSyncExternalStore(subscribe, get, getServer);
}

const ICON: Record<SeasonKey, typeof Leaf> = { spring: Flower2, summer: Waves, autumn: Leaf, winter: Snowflake };
const WORD: Record<SeasonKey, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };

/** 진입 버튼 — 계절 아이콘 + "가을 감상하기". className으로 자리별 모양(편집실 아바타 자리 · 시청자 레일). */
export function ShowcaseButton({ season, className = "", compact = false }: { season: SeasonKey; className?: string; compact?: boolean }) {
  const Icon = ICON[season];
  return (
    <button
      aria-label={`${WORD[season]} 배경 감상 모드`}
      className={`showcase-btn showcase-btn-${season} ${className}`.trim()}
      data-act="ambient-showcase"
      onClick={() => enterShowcase()}
      title="달력·패널을 잠시 숨기고 계절 배경만 크게 봅니다 (Esc로 돌아오기)"
      type="button"
    >
      <span className="showcase-btn-glow" aria-hidden="true" />
      <Icon aria-hidden="true" size={compact ? 16 : 18} />
      <span className="showcase-btn-label">{compact ? "감상" : `${WORD[season]} 감상하기`}</span>
    </button>
  );
}

/** 배경 세 상태 세그먼트 [켜기 | 흐리게 | 끄기] — 2026-09-04 사용자: "흐리게에서 바로 켜기, 켜기에서 바로 끄기가 되게, 버튼 셋으로
 *  말끔히". 순환 버튼(다음 동작이 라벨) 대신 **상태 셋이 늘 다 보이고 지금 상태가 채워진** 라디오 묶음. 시청자 레일·편집실
 *  아바타 자리(유리 알약)와 편집실 설정 줄(금 문법, .metal)이 같은 컴포넌트를 쓴다 — 상태의 진실은 <html data-ambient>. */
const MODES: { value: AmbientMode; label: string; word: string; Icon: typeof Leaf }[] = [
  { value: "on", label: "켜기", word: "켜짐", Icon: Sparkles },
  { value: "dim", label: "흐리게", word: "흐리게", Icon: Haze },
  { value: "off", label: "끄기", word: "끔", Icon: Power }
];
export function AmbientModeSegment({
  mode,
  onChange,
  dataAct,
  className = "",
  ariaLabel = "계절 배경 상태"
}: {
  mode: AmbientMode;
  onChange: (mode: AmbientMode) => void;
  dataAct: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className={`ambient-seg ${className}`.trim()} role="radiogroup">
      {MODES.map(({ value, label, word, Icon }) => {
        const on = value === mode;
        return (
          <button
            aria-checked={on}
            className={`ambient-seg-btn mode-${value}${on ? " on" : ""}`}
            data-act={dataAct}
            data-mode={value}
            key={value}
            onClick={() => {
              if (!on) onChange(value);
            }}
            role="radio"
            title={on ? `지금 ${word}` : `계절 배경 ${label}`}
            type="button"
          >
            <Icon aria-hidden="true" size={13} />
            <span className="lbl">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 레일·아바타 자리용: [계절 감상하기 | 켜기·흐리게·끄기] — 시청자는 설정 화면이 없어 여기서 바꾼다(2026-09-04 사용자). 같은 기기
 *  저장값(vic.ambient)이라 편집실 설정과 한 상태(편집실은 속성 변화를 지켜보며 설정·배경 효과 잠금을 맞춘다). 배경 OFF면
 *  감상 버튼은 숨고(볼 게 없다) 세그먼트만 남는다(다시 켜는 손잡이). */
export function ViewerAmbientControl({
  season,
  className = "",
  onChange
}: {
  season: SeasonKey;
  className?: string;
  /** 바꾼 뒤 알림(편집실은 설정 상태·배경 효과 잠금을 맞춘다). 저장·속성은 여기서 이미 처리한다. */
  onChange?: (mode: AmbientMode) => void;
}) {
  const [mode, setMode] = useState<AmbientMode>("on");
  useEffect(() => {
    const read = () => setMode(ambientMode());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ambient"] });
    return () => mo.disconnect();
  }, []);
  return (
    <div className={`viewer-ambient-ctl ${className}`.trim()} role="group" aria-label="계절 배경">
      {mode !== "off" ? <ShowcaseButton season={season} /> : null}
      <AmbientModeSegment
        dataAct="ambient-toggle-viewer"
        mode={mode}
        onChange={(next) => {
          setAmbientMode(next);
          setMode(next);
          if (next === "off") exitShowcase();
          onChange?.(next);
        }}
      />
    </div>
  );
}

/** 감상 중 상단 알약(나가기) + Esc. 한 화면에 하나만 두면 된다(body 포털). */
export function ShowcaseExit() {
  const on = useShowcase();
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        exitShowcase();
        return;
      }
      // 감상 중엔 다른 단축키를 전부 삼킨다 — ←/→ 달 이동이 계절(배경)을 바꿔 감상이 깨졌다(2026-09-04 사용자). 브라우저
      // 기본 동작(새로고침·탭 이동)은 막지 않는다(stopPropagation만).
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [on]);
  // 언마운트(화면 전환)되면 감상 모드도 끝낸다 — 속성이 남아 다음 화면이 빈 채로 뜨지 않게.
  useEffect(() => () => set(false), []);
  if (!on || typeof document === "undefined") return null;
  return createPortal(
    <button className="showcase-exit" data-act="ambient-showcase-exit" onClick={() => exitShowcase()} title="배경 감상 모드 나가기 (Esc)" type="button">
      <Eye aria-hidden="true" size={14} />
      배경 감상 중 · Esc 또는 여기를 눌러 돌아가기
    </button>,
    document.body
  );
}
