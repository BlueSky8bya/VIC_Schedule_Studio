"use client";

// 계절 캔버스(2026-09-04, ADR-0017 개정 2) — 계절 장면을 전체 화면 캔버스 하나에 그린다(엔진: scene-engine.ts,
// 장면: scenes/*). 봄·가을·겨울은 장면 전부, 여름은 CSS 물결 위의 마우스 잔물결만. 장면 코드는 동적 import — 시청자
// 첫 로드 번들에 안 들어간다. 보이는 조건은 CSS(app/ambient.css `.gs-season`)가 쥐고, 엔진은 html 속성(생동감·gfx·
// 계절 스위치)을 지켜보며 루프를 멈춘다.

import { useEffect, useRef } from "react";
import { mountScene, type SceneFactory, type WorldCtx } from "@/components/shared/ambient/scene-engine";
import type { SeasonKey } from "@/components/shared/ambient/registry";

const LOADERS: Record<SeasonKey, () => Promise<SceneFactory>> = {
  spring: () => import("@/components/shared/ambient/scenes/spring").then((m) => m.createSpring),
  summer: () => import("@/components/shared/ambient/scenes/summer").then((m) => m.createSummer),
  autumn: () => import("@/components/shared/ambient/scenes/autumn").then((m) => m.createAutumn),
  winter: () => import("@/components/shared/ambient/scenes/winter").then((m) => m.createWinter)
};

export function SeasonCanvas({ season, slug, year, month, force }: { season: SeasonKey; slug: string; year: number; month: number; force?: WorldCtx["force"] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // 강제값은 검증용(fixture) — 객체 정체성이 아니라 값으로 비교해 불필요한 재마운트를 막는다.
  const forceKey = force ? JSON.stringify(force) : "";
  const forceRef = useRef(forceKey);
  forceRef.current = forceKey;
  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    const parsed = forceRef.current ? (JSON.parse(forceRef.current) as WorldCtx["force"]) : undefined;
    void LOADERS[season]().then((factory) => {
      if (!alive || !ref.current) return;
      dispose = mountScene(ref.current, factory, { slug, season, year, month, force: parsed });
    });
    return () => {
      alive = false;
      dispose?.();
    };
  }, [season, slug, year, month]);
  // 강제값이 바뀌면 장면을 다시 만들지 않고 엔진에 바로 넣는다(개발자 시간 여행 — 바탕을 다시 굽지 않는다).
  useEffect(() => {
    const parsed = forceKey ? (JSON.parse(forceKey) as WorldCtx["force"]) : null;
    window.__vicAmbient?.forceWorld(parsed);
  }, [forceKey]);
  return <canvas aria-hidden="true" className={`gs-season gs-season-${season}`} data-season={season} ref={ref} />;
}
