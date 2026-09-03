"use client";

// 배경 효과 일시정지(2026-09-04) — 무거운 미디어가 떠 있는 동안(VOD 다시보기 창의 숲 플레이어, 인사이트 시트, 편집실
// 모달의 blur 백드롭) 계절 캔버스 루프와 물결 애니메이션을 멈춘다. 왜: 전체 화면 캔버스가 매 프레임 갱신되면 그 위의
// `backdrop-filter: blur`가 프레임마다 다시 흐려지고, GPU를 영상 디코딩과 나눠 써 재생이 뚝뚝 끊겼다(관리자 실사고).
// 여러 곳이 동시에 잡을 수 있어 키 집합으로 참조 계수한다. `<html data-ambient-pause>`를 scene-engine(루프 정지)과
// metal-water.css(물결 animation-play-state: paused)가 본다. 정지 = 마지막 프레임 그대로(사라지지 않는다).

import { useEffect } from "react";

const holders = new Set<string>();

function apply(): void {
  const root = document.documentElement;
  if (holders.size) root.setAttribute("data-ambient-pause", "1");
  else root.removeAttribute("data-ambient-pause");
}

export function holdAmbient(key: string): void {
  if (typeof document === "undefined") return;
  holders.add(key);
  apply();
}

export function releaseAmbient(key: string): void {
  if (typeof document === "undefined") return;
  holders.delete(key);
  apply();
}

/** active인 동안 배경을 멈춘다(언마운트·비활성에 자동 해제). */
export function useAmbientPause(active: boolean, key: string): void {
  useEffect(() => {
    if (!active) return;
    holdAmbient(key);
    return () => releaseAmbient(key);
  }, [active, key]);
}
