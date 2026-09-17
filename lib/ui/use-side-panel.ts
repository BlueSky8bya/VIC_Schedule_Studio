"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { PANEL_WIDE_QUERY } from "@/lib/ui/breakpoints";
import { hapticTick } from "@/lib/ui/haptics";

// 달력 옆 패널의 상태(단일 출처, 2026-09-17 소유자 결정) — 편집실·시청자·시청자 미리보기가 같은 훅을 쓴다.
//
//  · side   — 패널이 서는 쪽. localStorage `vic_avatar_side`(옛 아바타 자리 키를 그대로 이어받아 예전 선택이 유지된다).
//  · wide   — 창 폭 ≥ PANEL_WIDE_MIN. 넓으면 패널이 달력을 **밀어내며**(push) 옆에 서고, 좁으면 자동으로 접힌다.
//  · open   — 지금 펼쳐져 있는가. 넓을 땐 기본 펼침(사용자가 접으면 `vic_panel_collapsed`로 기억), 좁을 땐 기본 접힘이고
//             '패널' 버튼으로 열면 달력 **위에 떠서**(overlay) 열린다 — 좁은 화면의 열림은 기억하지 않는다(새로고침하면 접힘).
//  · ready  — 저장값·창 폭을 읽기 전엔 false. 이때는 패널을 그리지 않는다: SSR HTML(패널 없음)과 하이드레이션이 일치하고,
//             기본값(왼쪽·펼침)으로 한 번 그렸다가 저장값(오른쪽·접힘)으로 점프하는 깜빡임이 없다(useLayoutEffect = 페인트 전).
//
// enabled=false(모바일 아젠다·고정 scene 등)면 아무 것도 읽지 않고 기본값만 돌려준다.
export type PanelSide = "left" | "right";
export type PanelMode = "push" | "overlay";

const SIDE_KEY = "vic_avatar_side";
const COLLAPSED_KEY = "vic_panel_collapsed";

function readSide(): PanelSide {
  try {
    return window.localStorage.getItem(SIDE_KEY) === "right" ? "right" : "left";
  } catch {
    return "left";
  }
}
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useSidePanel(opts: { enabled: boolean; fixedSide?: PanelSide }) {
  const { enabled, fixedSide } = opts;
  const [ready, setReady] = useState(false);
  const [wide, setWide] = useState(true);
  const [side, setSide] = useState<PanelSide>(fixedSide ?? "left");
  const [open, setOpen] = useState(true);

  useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const mq = window.matchMedia(PANEL_WIDE_QUERY);
    setSide(fixedSide ?? readSide());
    setWide(mq.matches);
    // 고정 scene(/onair)은 창 폭과 무관하게 항상 펼침 — OBS 브라우저 소스는 사람이 접을 일이 없다.
    setOpen(fixedSide ? true : mq.matches ? !readCollapsed() : false);
    setReady(true);
    const sync = () => {
      const w = mq.matches;
      setWide(w);
      // 폭 기준을 넘나들면 자동값으로 되돌린다 — 좁아지면 접히고, 다시 넓어지면 기억한 대로 펼친다.
      setOpen(fixedSide ? true : w ? !readCollapsed() : false);
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [enabled, fixedSide]);

  const pickSide = useCallback(
    (next: PanelSide) => {
      if (fixedSide) return;
      hapticTick();
      setSide(next);
      try {
        window.localStorage.setItem(SIDE_KEY, next);
      } catch {
        /* 저장 불가 환경 무시 */
      }
    },
    [fixedSide]
  );

  const toggle = useCallback(() => {
    if (fixedSide) return;
    hapticTick();
    setOpen((cur) => {
      const next = !cur;
      if (wide) {
        try {
          if (next) window.localStorage.removeItem(COLLAPSED_KEY);
          else window.localStorage.setItem(COLLAPSED_KEY, "1");
        } catch {
          /* 무시 */
        }
      }
      return next;
    });
  }, [fixedSide, wide]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const mode: PanelMode = wide ? "push" : "overlay";
  // 떠 있는 패널은 Esc로도 닫힌다(밖을 누르는 것과 같은 결).
  useEffect(() => {
    if (!enabled || mode !== "overlay" || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, mode, open]);

  return { ready: enabled && ready, wide, side, open, mode, pickSide, toggle, close };
}

// 셸(main)에 붙는 클래스 — 편집실·시청자가 같은 이름을 써서 CSS 문법이 하나다.
//   avatar-scene avatar-{side}  : 패널이 밖에 선 데스크톱 레이아웃(이름은 옛 '아바타 scene'을 이어받았다)
//   panel-open / panel-closed   : 펼침·접힘
//   panel-overlay               : 좁은 화면 — 열려도 달력을 밀지 않고 위에 뜬다
export function sidePanelClasses(p: { ready: boolean; side: PanelSide; open: boolean; mode: PanelMode }): string {
  if (!p.ready) return "";
  return ` avatar-scene avatar-${p.side}${p.open ? " panel-open" : " panel-closed"}${p.mode === "overlay" ? " panel-overlay" : ""}`;
}
