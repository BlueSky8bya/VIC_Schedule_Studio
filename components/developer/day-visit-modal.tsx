"use client";

import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";
import { ActivityTimeline } from "@/components/developer/activity-timeline";
import { ActivityUsage } from "@/components/developer/activity-usage";

// 개발자가 달력에서 날짜를 고르고 '이용 기록'을 누르면 뜨는 창 — 개발자 본인의 행동 기록(activity_event)만.
// 2026-11-13 소유자 결정: 방문·체류 세션, 역할·사람 구분, 관리자 방문 기록, 동접은 모두 철수했다
// (기록은 개발자의 오류 추적용). 남은 것 = 그날 행동 타임라인 + 기간 누적 '적게 쓰인 기능'.
// 모달 골격은 부모(studio-shell)가 제공한다.

// 마지막 조작에서 이만큼 지나야 자동 갱신을 재개한다. 30초 주기보다 넉넉해야 '읽는 중'이
// 한 번의 스크롤로 끊기지 않는다.
const HOLD_MS = 120_000;

export function DayVisitModal({ dateKey }: { dateKey: string }) {
  // 갱신 신호 — 창을 열어둔 채 시간이 지나도 방금 남은 기록이 보이게 30초마다 조용히 다시 받는다
  // (내용은 제자리에서 바뀐다).
  const [reloadKey, setReloadKey] = useState(0);
  // 살펴보는 중에는 갱신하지 않는다(2026-09-11 소유자: "탭을 눌러서 보는데 갑자기 새로고침 돼서
  // 불편하다"). 행동 타임라인·적게 쓰인 기능(data-hold-refresh) 안을 만지면 그 시각을 찍어두고,
  // 손을 뗀 뒤 HOLD_MS가 지나야 다시 받는다.
  const holdAtRef = useRef(0);
  const touchHold = useCallback((e: SyntheticEvent) => {
    if (!(e.target as HTMLElement | null)?.closest?.("[data-hold-refresh]")) return;
    holdAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - holdAtRef.current < HOLD_MS) return; // 살펴보는 중 — 건드리지 않는다
      setReloadKey((k) => k + 1);
    }, 30000);
    return () => window.clearInterval(id);
  }, [dateKey]);

  return (
    // 웹: 카드 그리드(.dayvisit→grid) — 타임라인·사용량을 좌우로. 모바일: 같은 마크업이 세로 스택.
    <div className="dayvisit-wrap">
      <div
        className="dayvisit"
        onKeyDownCapture={touchHold}
        onPointerDownCapture={touchHold}
        onScrollCapture={touchHold}
        onWheelCapture={touchHold}
      >
        {/* 그날 무엇을 했는지(0062). */}
        <ActivityTimeline dateKey={dateKey} reloadKey={reloadKey} />
        {/* 하루가 아니라 기간 누적 — "어떤 버튼이 안 쓰이나"는 하루로는 안 보인다. */}
        <ActivityUsage anchor={dateKey} reloadKey={reloadKey} />
      </div>
    </div>
  );
}
