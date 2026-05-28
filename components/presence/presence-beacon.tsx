"use client";

import { useEffect } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { detectDevice, startPresence } from "@/lib/presence/presence-client";
import { logVisitAction } from "@/lib/insights/actions";

// 모든 로그인 사용자 화면에 1개 깔리는 보이지 않는 컴포넌트.
// 1) 실시간 프레즌스에 자기 역할만 등록(개발자 창의 실시간 패널 합산용).
// 2) "방문 추이"용으로 브라우저당 하루 1회 익명 방문을 기록(역할·기기·날짜만, 개인정보 없음).
const VISIT_KEY = "vic:visitDay";

export function PresenceBeacon({ role }: { role: MembershipRole }) {
  useEffect(() => {
    startPresence(role);
    // 하루 1회만 방문 기록(같은 브라우저의 중복 방문은 안 센다 = 일 단위 고유 방문).
    try {
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      if (window.localStorage.getItem(VISIT_KEY) !== today) {
        const sessionHash =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        // 플래그는 '성공했을 때만' 찍는다 → 한 번 실패하면 다음 방문에 다시 시도(누락 방지).
        logVisitAction(detectDevice(), sessionHash)
          .then((r) => {
            if (r?.ok) {
              try {
                window.localStorage.setItem(VISIT_KEY, today);
              } catch {
                /* ignore */
              }
            }
          })
          .catch(() => {});
      }
    } catch {
      // localStorage 차단 환경 등 — 방문 기록은 보조 기능이라 조용히 무시.
    }
  }, [role]);
  return null;
}
