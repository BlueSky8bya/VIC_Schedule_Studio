"use client";

import { useEffect, useState } from "react";
import { reduceMotionEnabled } from "@/lib/ui/motion";
import type { SoopLive } from "@/components/poster/use-soop-live";

// 데스크탑 전용 떠 있는 LIVE 비콘(표현 전용 — 폴링은 useSoopLive 훅이 한다).
// 모바일에선 CSS로 숨기고 대신 하단 '오늘' 버튼이 LIVE로 변신한다(상단이 버튼으로 붐벼서).
// fixed라 export 표면 밖 → 공식 PNG엔 안 들어간다(실시간 정보).

export function SoopLiveBeacon({ live }: { live: SoopLive | null }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(reduceMotionEnabled()), []);

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
