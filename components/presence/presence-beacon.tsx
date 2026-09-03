"use client";

import { useEffect } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { detectDevice, startPresence } from "@/lib/presence/presence-client";
import { isContentReady, onContentReady } from "@/lib/presence/content-ready";
import { skipAnalyticsClient } from "@/lib/analytics/guard";

// 모든 로그인 사용자 화면에 1개 깔리는 보이지 않는 컴포넌트.
// 1) 실시간 프레즌스에 자기 역할만 등록(개발자 창의 실시간 패널 합산용).
// 2) 방문/체류를 '세션 이벤트'로 기록 — 화면이 보이기 시작하면 세션 생성(start), 보이는 동안
//    하트비트로 last_seen 갱신(touch), 숨기거나 떠나면 종료(end). 재진입하면 새 세션(여러 번 기록).
//    체류는 started_at~ended_at의 초 단위로 정확. 모두 keepalive fetch라 떠나며 보낸 end도 끝까지 간다.
//    화면이 '보일 때만' 기록하므로 프리렌더·백그라운드 로드(안 본 유령 방문)는 잡히지 않는다.
//    KST 자정을 넘기면(켜둔 채 날짜 변경) 현재 세션을 끝내고 새 날짜로 새 세션 — 안 그러면 다음날
//    방문기록에 안 잡힌다(day는 start 시점에만 박힌다).
// 60s(2026-08-27, 25s에서 완화) — 체류 = ended_at 기준이라 정확도 손실 없음. 비정상 종료(end 못 보냄)만
// last_seen 해상도가 60s로 거칠어진다. 요청 수 −58%.
const HEARTBEAT_MS = 60_000;

// 현재 KST 날짜(YYYY-MM-DD). 서버 ymd(kstNow())와 동일 규칙(+9h).
const kstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// 방문 = '탭 수명'(0061). sessionStorage는 탭이 닫히면 사라지고, 사이트 안 문서 이동·하드 리로드·
// 탭 숨김/복귀에는 살아남는다 → "탭 닫았다 다시 오면 새 방문"이 시간 임계값 없이 정확해진다.
// 값에 KST 날짜를 함께 박아, 켜둔 채 자정을 넘기면 새 방문으로 끊는다(day는 start 시점에만
// 박히므로 안 끊으면 일별 집계가 샌다 — 세션 롤오버(tick)와 같은 이유·같은 경계).
// sessionStorage를 못 쓰면(사생활 모드 등) 매번 새 키 = 구간마다 1방문 — 이 컬럼 도입 전과 동일.
const VISIT_KEY_STORE = "vic:visitKey";
function visitKeyFor(day: string): string {
  const fresh = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  try {
    const raw = window.sessionStorage.getItem(VISIT_KEY_STORE) ?? "";
    const sep = raw.indexOf("|");
    if (sep > 0 && raw.slice(0, sep) === day) return raw.slice(sep + 1);
    const key = fresh();
    window.sessionStorage.setItem(VISIT_KEY_STORE, `${day}|${key}`);
    return key;
  } catch {
    return fresh();
  }
}

// 비로그인 방문자 기기 식별자(고유 방문자 dedup용) — 하트와 같은 localStorage 키를 재사용한다.
const ANON_ID_KEY = "vic:anonId:v1";
function deviceAnonId(): string {
  try {
    let t = window.localStorage.getItem(ANON_ID_KEY);
    if (!t || t.length < 8) {
      t =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_ID_KEY, t);
    }
    return t;
  } catch {
    return "";
  }
}

export function PresenceBeacon({ role }: { role: MembershipRole | "anon" }) {
  useEffect(() => {
    // 자동화 브라우저·로컬 호스트는 기록하지 않는다(lib/analytics/guard.ts — 2026-09-04 검증 트래픽이 운영 통계를 오염).
    if (skipAnalyticsClient()) return;
    startPresence(role);

    const device = detectDevice();
    // 비로그인이면 고유 방문자 dedup용 기기 토큰을 함께 보낸다(서버가 해시해 account_hash로).
    const anonId = role === "anon" ? deviceAnonId() : undefined;
    let sessionId: string | null = null;
    let sessionDay: string | null = null; // 이 세션이 기록된 KST 날짜(자정 롤오버 감지용)
    let starting = false;
    let timer: number | null = null;

    const post = (op: string, extra?: Record<string, unknown>) =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ op, device, ...extra })
      });

    const begin = async () => {
      if (sessionId || starting) return;
      starting = true;
      const day = kstDay();
      try {
        // visitKey는 day와 함께 계산한다 — 자정 롤오버로 begin()이 다시 불리면 키도 새로 발급된다.
        const res = await post("start", { visitKey: visitKeyFor(day), ...(anonId ? { anonId } : {}) });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
        if (data?.ok && data.id) {
          sessionId = data.id;
          sessionDay = day;
        }
      } catch {
        /* 보조 기능 — 조용히 무시 */
      } finally {
        starting = false;
      }
    };
    const touch = () => {
      if (sessionId) post("touch", { id: sessionId }).catch(() => {});
    };
    const finish = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      if (sessionId) {
        post("end", { id: sessionId }).catch(() => {});
        sessionId = null; // 다음에 다시 보이면 새 세션
        sessionDay = null;
      }
    };
    // 하트비트 한 틱: KST 자정을 넘겼으면 현재 세션 종료 + 새 날짜 세션 시작, 아니면 last_seen 갱신.
    const tick = () => {
      if (sessionId && sessionDay && kstDay() !== sessionDay) {
        post("end", { id: sessionId }).catch(() => {}); // 어제 세션은 어제 day로 닫는다
        sessionId = null;
        sessionDay = null;
        void begin(); // 보이는 동안만 timer가 돌므로 항상 visible — 새 날짜로 새 세션
        return;
      }
      touch();
    };
    const start = () => {
      if (timer !== null) return;
      void begin(); // 세션 생성(짧은 방문도 기록)
      timer = window.setInterval(tick, HEARTBEAT_MS);
    };

    // 실제 달력 콘텐츠가 떴고(contentReady) + 화면이 보일 때만 시작. 로딩 스켈레톤 중에 백그라운드로
    // 빼면 contentReady가 안 와서 방문 0, 달력이 떠야 방문 1.
    let contentReady = isContentReady();
    const maybeStart = () => {
      if (contentReady && document.visibilityState === "visible") start();
    };
    const offReady = onContentReady(() => {
      contentReady = true;
      maybeStart();
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeStart();
      else finish();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", finish);
    maybeStart();

    return () => {
      offReady();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", finish);
      finish();
    };
  }, [role]);
  return null;
}
