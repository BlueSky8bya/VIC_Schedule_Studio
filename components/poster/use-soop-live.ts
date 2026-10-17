"use client";

import { useEffect, useState } from "react";
import { startForegroundPoll } from "@/lib/ui/foreground-poll";

// 토리님 SOOP 라이브 상태 폴링 훅 — /api/soop-live(서버가 20초 캐시 폴링)만 호출.
// 한 페이지에서 한 번만 호출해 데스크탑 비콘·모바일 '오늘' 버튼이 같은 상태를 공유한다.
export type SoopLive = {
  isLive: boolean;
  bjId?: string; // 임베드 플레이어용(서버 응답에 포함 — 공개 채널 id)
  bjNick: string | null;
  title: string | null;
  category: string | null;
  bno?: string | null; // 방송 번호(임베드 주소용)
  watchUrl: string | null;
  build?: string | null; // 서버 배포 커밋 — 옛 빌드로 떠 있는 시청자 탭의 자동 새로고침용
};

// 60s(2026-08-27, 25s에서 완화 — 서버가 20s 캐시라 체감 지연은 최대 ~80s, 방송 시작 알림은 분 단위면 충분).
const POLL_MS = 60_000;
let current: SoopLive | null = null;
let sampledAt = -Infinity;
let attemptedAt = -Infinity;
const listeners = new Set<(live: SoopLive) => void>();
let polling: ReturnType<typeof startForegroundPoll> | null = null;

export function useSoopLive(enabled = true): SoopLive | null {
  const [live, setLive] = useState<SoopLive | null>(current);

  useEffect(() => {
    if (!enabled) return;
    listeners.add(setLive);
    if (current) setLive(current);
    if (!polling) polling = startForegroundPoll({
      initialDelay: Math.max(0, POLL_MS - (performance.now() - sampledAt)),
      delay: () => Math.max(1000, POLL_MS - (performance.now() - Math.max(sampledAt, attemptedAt))),
      run: async (signal) => {
        if (current && performance.now() - sampledAt < POLL_MS) return;
        attemptedAt = performance.now();
        const res = await fetch("/api/soop-live", { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
        if (!res.ok) return;
        const data = (await res.json()) as SoopLive;
        if (signal.aborted) return;
        current = data; sampledAt = performance.now();
        for (const listener of listeners) listener(data);
      },
    });
    return () => {
      listeners.delete(setLive);
      if (!listeners.size) { polling?.stop(); polling = null; }
    };
  }, [enabled]);

  return enabled ? live : null;
}
