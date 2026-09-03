"use client";

// 계절 캔버스(2026-09-04, ADR-0017 개정 2) — 봄·가을·겨울 장면을 전체 화면 캔버스 하나에 그린다(엔진:
// scene-engine.ts, 장면: scenes/*). 장면 코드는 동적 import — 시청자 첫 로드 번들에 안 들어간다. 보이는 조건은
// CSS(app/ambient.css `.gs-season`)가 쥐고, 엔진은 html 속성(생동감·gfx·계절 스위치)을 지켜보며 루프를 멈춘다.

import { useEffect, useRef } from "react";
import { mountScene, type SceneFactory } from "@/components/shared/ambient/scene-engine";
import type { SeasonKey } from "@/components/shared/ambient/registry";

type CanvasSeason = Exclude<SeasonKey, "summer">;

const LOADERS: Record<CanvasSeason, () => Promise<SceneFactory>> = {
  spring: () => import("@/components/shared/ambient/scenes/spring").then((m) => m.createSpring),
  autumn: () => import("@/components/shared/ambient/scenes/autumn").then((m) => m.createAutumn),
  winter: () => import("@/components/shared/ambient/scenes/winter").then((m) => m.createWinter)
};

export function SeasonCanvas({ season }: { season: CanvasSeason }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    void LOADERS[season]().then((factory) => {
      if (!alive || !ref.current) return;
      dispose = mountScene(ref.current, factory);
    });
    return () => {
      alive = false;
      dispose?.();
    };
  }, [season]);
  return <canvas aria-hidden="true" className={`gs-season gs-season-${season}`} data-season={season} ref={ref} />;
}
