"use client";

import { useEffect, useState } from "react";
import { reduceMotionEnabled } from "@/lib/ui/motion";
import type { SoopLive } from "@/components/poster/use-soop-live";

// 데스크탑 전용 라이브 카드(우하단 플로팅) — 생방송 중이면 SOOP 임베드 플레이어(음소거
// 자동재생) + LIVE 배지 + 방송 제목이 뜬다(2026-07-31, 예전 좌상단 알약 비콘을 대체).
// 폴링은 useSoopLive 훅. 모바일에선 CSS로 숨기고 하단 '오늘' 버튼이 LIVE로 변신(기존 유지).
// fixed라 export 표면 밖 → 공식 PNG엔 안 들어간다(실시간 정보). 임베드가 안 뜨는 환경에서도
// 배지·제목·보러가기 링크는 남는다.

export function SoopLiveBeacon({ live }: { live: SoopLive | null }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(reduceMotionEnabled()), []);

  if (!live?.isLive) return null;
  const embedSrc = live.bjId
    ? `https://play.sooplive.co.kr/${live.bjId}${live.bno ? `/${live.bno}` : ""}/embed?autoPlay=true&mutePlay=true&showChat=false`
    : null;

  return (
    <div className="soop-live-card" data-reduce={reduce ? "" : undefined}>
      <div className="slc-player">
        {embedSrc ? (
          <iframe
            allow="autoplay; encrypted-media; picture-in-picture"
            scrolling="no"
            src={embedSrc}
            title={`라이브 방송: ${live.title ?? ""}`}
          />
        ) : null}
        <span className="slc-badge">
          <i aria-hidden="true" />
          LIVE
        </span>
      </div>
      <a
        aria-label={`지금 방송 중: ${live.title ?? ""} — SOOP에서 보기`}
        className="slc-caption"
        href={live.watchUrl ?? undefined}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="slc-title">{live.title ?? "방송 중"}</span>
        <span className="slc-go" aria-hidden="true">
          보러가기 →
        </span>
      </a>
    </div>
  );
}
