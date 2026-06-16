"use client";

import { useEffect, useState } from "react";

// 토리님 SOOP 라이브 상태 폴링 훅 — /api/soop-live(서버가 20초 캐시 폴링)만 호출.
// 한 페이지에서 한 번만 호출해 데스크탑 비콘·모바일 '오늘' 버튼이 같은 상태를 공유한다.
export type SoopLive = {
  isLive: boolean;
  bjNick: string | null;
  title: string | null;
  category: string | null;
  watchUrl: string | null;
};

const POLL_MS = 25_000;

export function useSoopLive(enabled = true): SoopLive | null {
  const [live, setLive] = useState<SoopLive | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/soop-live", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SoopLive;
        if (alive) setLive(data);
      } catch {
        /* 네트워크 실패 시 직전 상태 유지 */
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled]);

  return live;
}
