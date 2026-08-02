"use client";

import { useEffect, useState } from "react";
import { reduceMotionEnabled } from "@/lib/ui/motion";
import type { SoopLive } from "@/components/poster/use-soop-live";

// 데스크탑 전용 라이브 카드(우하단 플로팅) — 생방송 중이면 SOOP 라이브 썸네일(정지 이미지,
// 주기 갱신) + LIVE 배지 + 방송 제목이 뜬다(2026-08-01, 임베드 플레이어를 대체).
// 임베드는 실제 스트림 접속이라 일정표를 열어둔 것만으로 시청자 수에 중복 집계되던 문제가
// 있었다 — 썸네일 이미지는 방송 접속이 아니므로 집계에 안 잡힌다.
// 폴링은 useSoopLive 훅. 모바일에선 CSS로 숨기고 하단 '오늘' 버튼이 LIVE로 변신(기존 유지).
// fixed라 export 표면 밖 → 공식 PNG엔 안 들어간다(실시간 정보). 썸네일이 안 뜨는 환경에서도
// 배지·제목·보러가기 링크는 남는다.

const THUMB_REFRESH_MS = 60_000;

export function SoopLiveBeacon({ live, inRail = false }: { live: SoopLive | null; inRail?: boolean }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(reduceMotionEnabled()), []);

  // 썸네일 캐시버스트 틱 — 라이브 썸네일 서버가 주기적으로 새 프레임을 주므로
  // 1분마다 쿼리를 바꿔 최신 장면으로 갱신한다(스트림 접속 없음).
  const [thumbTick, setThumbTick] = useState(0);
  const isLive = live?.isLive ?? false;
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setThumbTick((t) => t + 1), THUMB_REFRESH_MS);
    return () => clearInterval(id);
  }, [isLive]);

  if (!live?.isLive) return null;
  // 방송번호(bno)가 있을 때만 썸네일 — liveimg 서버가 bno 기준으로 현재 방송 장면을 준다.
  // bno 없으면 어두운 판 + LIVE 배지만.
  const thumbSrc = live.bno
    ? `https://liveimg.sooplive.co.kr/m/${live.bno}?t=${thumbTick}`
    : null;

  return (
    <div
      className={`soop-live-card${inRail ? " in-rail" : ""}`}
      data-reduce={reduce ? "" : undefined}
    >
      <div className="slc-player">
        {thumbSrc ? (
          // 외부 라이브 썸네일(수십 초마다 갱신되는 서명 없는 원격 이미지)이라 next/image
          // 최적화 대상이 아니다 — 프록시 캐시가 오히려 낡은 장면을 보여준다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`라이브 방송 미리보기: ${live.title ?? ""}`}
            src={thumbSrc}
          />
        ) : null}
        <span className="slc-badge">
          <i aria-hidden="true" />
          LIVE
        </span>
        {/* 투명 클릭 레이어 — 화면 어디를 눌러도 방송으로 이동한다. */}
        <a
          aria-label="방송 보러 가기"
          className="slc-cover"
          href={live.watchUrl ?? undefined}
          rel="noopener noreferrer"
          target="_blank"
        />
      </div>
      {/* 캡션 전체가 링크 — '보러가기' 라벨은 뺐다(2026-07-31): 제목이 폭을 다 쓴다. */}
      <a
        aria-label={`지금 방송 중: ${live.title ?? ""} — SOOP에서 보기`}
        className="slc-caption"
        href={live.watchUrl ?? undefined}
        rel="noopener noreferrer"
        target="_blank"
        title={live.title ?? "방송 중"}
      >
        <span className="slc-title">{live.title ?? "방송 중"}</span>
      </a>
    </div>
  );
}
