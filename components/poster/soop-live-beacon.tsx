"use client";

import { useEffect, useState } from "react";
import { reduceMotionEnabled } from "@/lib/ui/motion";

// 토리님이 SOOP에서 방송 중이면 시청자 화면 위에 빨간 LIVE 비콘을 띄운다.
// fixed 요소라 export 표면([data-export-surface]) 밖 → 공식 포스터 PNG엔 안 들어간다(실시간 정보).
// /api/soop-live(서버가 60초 캐시 폴링)만 호출 — 비공식 SOOP 엔드포인트는 서버가 가린다.

type LiveState = {
  isLive: boolean;
  bjNick: string | null;
  title: string | null;
  category: string | null;
  watchUrl: string | null;
};

// 클라가 서버(/api/soop-live)를 이 간격으로 확인. 서버 캐시(20초)와 합쳐 뱅온/뱅종이
// 최대 ~20–45초 안에 반영된다. 진짜 0초 즉시는 비공식 API론 불가(아래 커밋 메시지/설명 참고).
const POLL_MS = 25_000;

export function SoopLiveBeacon() {
  const [live, setLive] = useState<LiveState | null>(null);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(reduceMotionEnabled());
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/soop-live", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LiveState;
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
  }, []);

  if (!live?.isLive) return null;

  return (
    <a
      className="soop-live-beacon"
      data-reduce={reduce ? "" : undefined}
      href={live.watchUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`지금 방송 중: ${live.title ?? ""} — SOOP에서 보기`}
    >
      <span className="slb-dot" aria-hidden="true" />
      <strong className="slb-label">LIVE</strong>
      <span className="slb-title">{live.title ?? "방송 중"}</span>
      <span className="slb-go" aria-hidden="true">보러가기 →</span>
    </a>
  );
}
