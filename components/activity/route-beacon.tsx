"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logActivity } from "@/lib/activity/client";

// 어느 화면을 얼마나 봤는지(0062). PresenceBeacon과 분리한 이유: 프레즌스 effect의 deps에
// pathname을 넣으면 SPA 라우팅마다 방문 세션이 끊겼다 다시 시작된다(0061에서 고친 문제의 재발).
//
// 남기는 것은 경로와 월 파라미터뿐 — 쿼리스트링·해시는 자유 입력이 섞일 수 있어 버린다.
// route.leave의 dur_ms가 그 화면의 실제 체류다(탭을 숨긴 시간도 포함되지만, 방문 자체가
// hidden에서 끊기므로 한 방문 안에서는 대체로 실제 시선 시간이다).

// /studio/calendar/2026/08 → { path: "/studio/calendar", month: "2026-08" }
// 월을 경로에서 떼어내야 "어느 화면"과 "어느 달"을 따로 셀 수 있다.
function parseRoute(pathname: string): { path: string; month: string | null } {
  const m = pathname.match(/^(.*)\/(\d{4})\/(\d{1,2})$/);
  if (!m) return { path: pathname, month: null };
  return { path: m[1] || "/", month: `${m[2]}-${m[3].padStart(2, "0")}` };
}

export function RouteBeacon() {
  const pathname = usePathname();
  // 직전 화면의 진입 시각 — 언마운트/이동 시점에 체류를 계산해 route.leave로 닫는다.
  const openedRef = useRef<{ path: string; month: string | null; at: number } | null>(null);

  useEffect(() => {
    const { path, month } = parseRoute(pathname);
    openedRef.current = { path, month, at: Date.now() };
    logActivity("route.enter", { target: path, meta: month ? { month } : null });

    return () => {
      const prev = openedRef.current;
      openedRef.current = null;
      if (!prev) return;
      logActivity("route.leave", {
        target: prev.path,
        meta: prev.month ? { month: prev.month } : null,
        durMs: Date.now() - prev.at
      });
    };
  }, [pathname]);

  return null;
}
