"use client";

import { useEffect } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { detectDevice, startPresence } from "@/lib/presence/presence-client";
import { logPresencePingAction, logVisitAction } from "@/lib/insights/actions";

// 모든 로그인 사용자 화면에 1개 깔리는 보이지 않는 컴포넌트.
// 1) 실시간 프레즌스에 자기 역할만 등록(개발자 창의 실시간 패널 합산용).
// 2) "방문 추이"용으로 브라우저당 하루 1회 익명 방문을 기록(역할·기기·날짜만, 개인정보 없음).
// 3) "동시 접속(체류)"용으로 화면이 보이는 동안 60초마다 핑(역할·기기·분만, 개인정보 없음).
const VISIT_KEY = "vic:visitDay2";
const SESSION_KEY = "vic:presenceKey"; // presence-client과 같은 키 — 브라우저당 1세션.

// 동시 접속 집계용 세션 식별자(브라우저당 고정, PII 아님). 실시간 프레즌스와 같은 키를 공유한다.
function getSessionHash(): string {
  try {
    let k = window.localStorage.getItem(SESSION_KEY);
    if (!k) {
      k =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      window.localStorage.setItem(SESSION_KEY, k);
    }
    return k;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

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

    // 동시 접속(체류) 핑 — 화면이 보이는 동안 60초마다 1핑. 숨기면(다른 탭·최소화) 중단하고,
    // 다시 보이면 재개하며 즉시 1핑. (세션, 분) 단위로 서버가 1줄만 남기므로 중복은 자동 합쳐지고,
    // 켜두고 잊은 백그라운드 탭은 세지 않는다. 평균 동시 접속 = 그 시간 핑 수 / 60.
    const device = detectDevice();
    const session = getSessionHash();
    let timer: number | null = null;
    const ping = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      logPresencePingAction(device, session).catch(() => {});
    };
    const start = () => {
      if (timer !== null) return;
      ping(); // 보이기 시작하면 즉시 1핑(짧은 방문도 기록).
      timer = window.setInterval(ping, 60_000);
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") start();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [role]);
  return null;
}
