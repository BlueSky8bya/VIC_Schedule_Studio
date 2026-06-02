"use client";

import { useEffect } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { detectDevice, startPresence } from "@/lib/presence/presence-client";
import { isContentReady, onContentReady } from "@/lib/presence/content-ready";

// 모든 로그인 사용자 화면에 1개 깔리는 보이지 않는 컴포넌트.
// 1) 실시간 프레즌스에 자기 역할만 등록(개발자 창의 실시간 패널 합산용).
// 2) 방문/체류를 '세션 이벤트'로 기록 — 화면이 보이기 시작하면 세션 생성(start), 보이는 동안
//    하트비트로 last_seen 갱신(touch), 숨기거나 떠나면 종료(end). 재진입하면 새 세션(여러 번 기록).
//    체류는 started_at~ended_at의 초 단위로 정확. 모두 keepalive fetch라 떠나며 보낸 end도 끝까지 간다.
//    화면이 '보일 때만' 기록하므로 프리렌더·백그라운드 로드(안 본 유령 방문)는 잡히지 않는다.
const HEARTBEAT_MS = 25_000;

export function PresenceBeacon({ role }: { role: MembershipRole }) {
  useEffect(() => {
    startPresence(role);

    const device = detectDevice();
    let sessionId: string | null = null;
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
      try {
        const res = await post("start");
        const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null;
        if (data?.ok && data.id) sessionId = data.id;
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
      }
    };
    const start = () => {
      if (timer !== null) return;
      void begin(); // 세션 생성(짧은 방문도 기록)
      timer = window.setInterval(touch, HEARTBEAT_MS);
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
