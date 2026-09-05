"use client";

// 바이옴 fixture(2026-09-05, PLAN-20260905-005 P0) — 달력·크롬 없이 계절 배경 캔버스 하나를 **결정적으로** 띄운다.
// `/visual-fixture/biome?biome=&season=&band=&weather=&seed=&t=&load=&pointer=&camera=`(VISUAL_TEST_FIXTURE=1일 때만).
// 엔진은 `force.freeze`로 얼려 rAF 루프를 돌리지 않고, 여기서 `ready()` → `advance(t)`로 t까지만 시간을 흘린 뒤
// `__vicAmbient.settledT`에 도달한 t를 적는다 — 캡처 스크립트(scripts/ambient-qa)는 그 신호를 기다린다.
// 같은 URL = 같은 프레임(시드·dt·경로 순서가 같다). 사람이 열어도 그 프레임이 정지 화면으로 보인다.
//
// fixture 전용 부작용: 배경 게이트를 여는 설정(vic.ambient on · vic.gfxPref max)을 이 기기 localStorage에 쓴다 —
// 실제 화면(/, /studio)은 이 컴포넌트를 쓰지 않는다.

import { useEffect, useLayoutEffect } from "react";
import { AmbientLayer } from "@/components/shared/ambient/ambient-layer";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";
import { enterShowcase, exitShowcase, ShowcaseExit } from "@/components/shared/ambient/showcase";
import { setGfxPref } from "@/lib/ui/gfx";
import { setAmbientMode } from "@/lib/ui/motion";

/** 계절 → fixture가 보는 달(계절 판정·날씨 표·흔적이 전부 달에서 나온다). 봄 4 · 여름 8 · 가을 10 · 겨울 1. */
export const SEASON_MONTH: Record<SeasonKey, number> = { spring: 4, summer: 8, autumn: 10, winter: 1 };

export type BiomeFixtureProps = {
  season: SeasonKey;
  year: number;
  /** 달력 달(1~12) — 없으면 계절의 대표 달. 달 위상·흔적 스윕 검증용. */
  month?: number;
  /** 엔진 강제값 — biome·band·weather·seed·load·pointer + freeze·pin은 페이지가 늘 true로 준다. */
  force: NonNullable<WorldCtx["force"]>;
  /** 도달할 애니메이션 시각(ms). 0 = 굽기만 한 첫 프레임. */
  t: number;
  /** showcase = 감상 모드(내비 오버레이 포함, 기본) · plain = 캔버스만. 캔버스 픽셀은 둘이 같다. */
  camera: "showcase" | "plain";
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const waitFor = <T,>(get: () => T | undefined, timeoutMs: number): Promise<T | undefined> =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const poll = () => {
      const v = get();
      if (v !== undefined) return resolve(v);
      if (performance.now() - t0 > timeoutMs) return resolve(undefined);
      window.setTimeout(poll, 30);
    };
    poll();
  });

export function BiomeFixture({ season, year, month, force, t, camera }: BiomeFixtureProps) {
  const forceKey = JSON.stringify(force);
  // 자식(SeasonCanvas)의 마운트 효과보다 **먼저** 게이트를 연다 — 레이아웃 효과는 패시브 효과 전에 전부 돈다.
  // 페인트-전 스크립트는 vic.ambient 미설정 → data-ambient="off"(캔버스 display:none)라, 그대로 두면 엔진이 0×0을 잰다.
  useIsoLayoutEffect(() => {
    setAmbientMode("on");
    setGfxPref("max");
    if (camera === "showcase") enterShowcase();
    return () => exitShowcase();
  }, [camera]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dbg = await waitFor(() => window.__vicAmbient, 15000);
      if (!dbg || cancelled) return;
      await dbg.ready(12000);
      if (cancelled) return;
      const reached = await dbg.advance(t);
      if (!cancelled) dbg.settledT = reached;
    })();
    return () => {
      cancelled = true;
    };
    // forceKey = 값 비교(객체 정체성이 아니라) — 서버가 준 force는 매 렌더 새 객체일 수 있다.
  }, [t, season, forceKey]);
  return (
    <>
      <AmbientLayer force={season} month={month ?? SEASON_MONTH[season]} slug="vic" worldForce={force} year={year} />
      {camera === "showcase" ? <ShowcaseExit /> : null}
    </>
  );
}
