"use client";

import { useEffect, useState } from "react";

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
