"use client";

// 앰비언트 배경(2026-09-04, ADR-0017) — 편집실·시청자 화면 공용 진입점. **보고 있는 달력의 달**이 계절을
// 정한다(registry.ts). 여름 = 물결(.gs-tide), 봄/가을/겨울 = 물 없이 그 계절 레이어만. 계절 배경 스위치가
// OFF면(html[data-ambient="off"]) 계절 레이어는 CSS가 숨기고 물결이 사철 남는다 — 그래서 물결은 늘
// 마운트하고, 여름이 아닐 땐 `data-off-season`을 달아 CSS가 스위치 ON일 때만 숨긴다(app/ambient.css).
// 달을 넘기면 useMemo가 다시 골라 레이어가 갈리고, 새 레이어는 CSS 페이드로 들어온다.
// `force`는 fixture/검증용(계절 강제) — 실제 화면은 넘기지 않는다.

import { useMemo } from "react";
import { WaterTide } from "@/components/shared/water-tide";
import { pickAmbient, type SeasonKey } from "@/components/shared/ambient/registry";
import { SeasonAutumn } from "@/components/shared/ambient/season-autumn";
import { SeasonSpring } from "@/components/shared/ambient/season-spring";
import { SeasonWinter } from "@/components/shared/ambient/season-winter";

export function AmbientLayer({ month, force }: { month: number; force?: SeasonKey | null }) {
  const pick = useMemo(() => pickAmbient(month, force ?? null), [month, force]);
  const summer = pick.season === "summer";
  return (
    <>
      <WaterTide offSeason={!summer} />
      {pick.season === "autumn" ? (
        <SeasonAutumn key="autumn" />
      ) : pick.season === "winter" ? (
        <SeasonWinter key="winter" />
      ) : pick.season === "spring" ? (
        <SeasonSpring key="spring" />
      ) : null}
    </>
  );
}
