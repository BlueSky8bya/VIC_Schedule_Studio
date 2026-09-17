"use client";

import { ArrowLeftToLine, ArrowRightToLine, PanelLeft, PanelRight } from "lucide-react";
import type { RefObject } from "react";
import type { PanelSide } from "@/lib/ui/use-side-panel";
import "./panel-place-control.css";

// 하단 중앙 알약 [⇤ | 패널 | ⇥] — 편집실·시청자·시청자 미리보기가 같은 부품을 쓴다(2026-09-17 소유자: 통일).
//  · 양옆 화살표 = 패널을 그쪽에 세운다(옛 편집실 '패널 자리'와 같은 기능). 비로그인 시청자에게도 있다.
//  · 가운데 '패널' = 접기/펼치기 토글. 좁은 화면에서 자동으로 접힌 패널도 이 버튼으로 연다(달력 위에 떠서).
//  · 확대(Ctrl+휠) 직후엔 가운데 칸이 잠시 배율(🔍 125%)로 바뀌고 누르면 100%로 돌아간다 — 옛 별도 배율 배지를
//    이 알약에 합쳤다(2026-09-17 소유자). 배지가 잠들면(useIdleAfter) 다시 '패널'. 근접하면 깨어나 배율이 돌아온다.
//  · 화면 중앙 고정인 이유는 편집실 것과 같다 — 패널이 어느 쪽에 있든 같은 거리(Fitts).
export function PanelPlaceControl({
  side,
  open,
  showSide = true,
  onSide,
  onToggle,
  zoomPct = null,
  zoomAwake = false,
  onZoomReset,
  rootRef
}: {
  side: PanelSide;
  open: boolean;
  showSide?: boolean;
  onSide?: (side: PanelSide) => void;
  onToggle: () => void;
  /** 현재 달력 배율(%). 100이면 배율 표시 없음. */
  zoomPct?: number | null;
  /** 배율 배지가 깨어 있는가(useIdleAfter) — 깨어 있을 때만 가운데 칸이 배율로 바뀐다. */
  zoomAwake?: boolean;
  onZoomReset?: () => void;
  rootRef?: RefObject<HTMLDivElement | null>;
}) {
  const ToggleIcon = side === "right" ? PanelRight : PanelLeft;
  const showZoom = zoomPct !== null && zoomPct !== 100 && zoomAwake && !!onZoomReset;
  return (
    <div className="panel-place-ctl" ref={rootRef} role="group" aria-label="패널 자리" title="달력 옆 패널">
      {showSide ? (
        <button
          type="button"
          className={`ppc-side${side === "left" ? " on" : ""}`}
          aria-label="패널을 왼쪽에 두기"
          aria-pressed={side === "left"}
          onClick={() => onSide?.("left")}
          data-act="avatar-ctl-toggle"
        >
          <ArrowLeftToLine aria-hidden="true" size={18} strokeWidth={2.4} />
        </button>
      ) : null}
      {showZoom ? (
        <button
          type="button"
          className="ppc-toggle ppc-zoom"
          aria-label={`달력 확대 ${zoomPct}% — 눌러서 100%로 되돌리기`}
          title="100%로 되돌리기"
          onClick={onZoomReset}
          data-act="확대 초기화"
        >
          <span aria-hidden="true" className="ppc-zoom-ic">🔍</span>
          <span className="ppc-label ppc-zoom-pct">{zoomPct}%</span>
        </button>
      ) : (
        <button
          type="button"
          className="ppc-toggle"
          aria-label={open ? "패널 접기" : "패널 펼치기"}
          aria-pressed={open}
          onClick={onToggle}
          data-act="panel-toggle"
        >
          <ToggleIcon aria-hidden="true" size={16} strokeWidth={2.4} />
          <span className="ppc-label">패널</span>
        </button>
      )}
      {showSide ? (
        <button
          type="button"
          className={`ppc-side${side === "right" ? " on" : ""}`}
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
