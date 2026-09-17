"use client";

import { ArrowLeftToLine, ArrowRightToLine, PanelLeft, PanelRight } from "lucide-react";
import type { PanelSide } from "@/lib/ui/use-side-panel";
import "./panel-place-control.css";

// 하단 중앙 알약 [⇤ | 패널 | ⇥] — 편집실·시청자·시청자 미리보기가 같은 부품을 쓴다(2026-09-17 소유자: 통일).
//  · 양옆 화살표 = 패널을 그쪽에 세운다(옛 편집실 '패널 자리'와 같은 기능).
//  · 가운데 '패널' = 접기/펼치기 토글. 좁은 화면에서 자동으로 접힌 패널도 이 버튼으로 연다(달력 위에 떠서).
//  · 화면 중앙 고정인 이유는 편집실 것과 같다 — 패널이 어느 쪽에 있든 같은 거리(Fitts).
//  · showSide=false(비로그인·일반 시청자): 자리 선택은 관리자 것이라 토글만 남긴다.
export function PanelPlaceControl({
  side,
  open,
  showSide = true,
  onSide,
  onToggle
}: {
  side: PanelSide;
  open: boolean;
  showSide?: boolean;
  onSide?: (side: PanelSide) => void;
  onToggle: () => void;
}) {
  const ToggleIcon = side === "right" ? PanelRight : PanelLeft;
  return (
    <div className="panel-place-ctl" role="group" aria-label="패널 자리" title="달력 옆 패널">
      {showSide ? (
        <button
          type="button"
          className={side === "left" ? "on" : ""}
          aria-label="패널을 왼쪽에 두기"
          aria-pressed={side === "left"}
          onClick={() => onSide?.("left")}
          data-act="avatar-ctl-toggle"
        >
          <ArrowLeftToLine aria-hidden="true" size={18} strokeWidth={2.4} />
        </button>
      ) : null}
      <button
        type="button"
        className={`ppc-toggle${open ? " on" : ""}`}
        aria-label={open ? "패널 접기" : "패널 펼치기"}
        aria-pressed={open}
        onClick={onToggle}
        data-act="panel-toggle"
      >
        <ToggleIcon aria-hidden="true" size={16} strokeWidth={2.4} />
        <span className="ppc-label">패널</span>
      </button>
      {showSide ? (
        <button
          type="button"
          className={side === "right" ? "on" : ""}
          aria-label="패널을 오른쪽에 두기"
          aria-pressed={side === "right"}
          onClick={() => onSide?.("right")}
          data-act="avatar-ctl-toggle"
        >
          <ArrowRightToLine aria-hidden="true" size={18} strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}
