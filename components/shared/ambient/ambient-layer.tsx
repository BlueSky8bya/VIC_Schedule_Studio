"use client";

// 앰비언트 배경(2026-09-04, ADR-0017 개정 2) — 편집실·시청자 화면 공용 진입점. **보고 있는 달력의 달**이 계절을
// 정한다(registry.ts): 여름 = 물결(.gs-tide, CSS/SVG), 봄·가을·겨울 = 상호작용 캔버스 장면(season-canvas.tsx).
// 계절 배경 스위치 OFF(html[data-ambient="off"])면 **전부** 내려간다 — 물결은 여름의 것이라 OFF에서 사철 물결로
// 남지 않는다(사용자 2026-09-04). 게이트(생동감·gfx·계절 스위치·≥641px)는 CSS(app/metal-water.css `.gs-tide`,
// app/ambient.css `.gs-season`)가 쥔다. `force`는 fixture/검증용(계절 강제).

import { useMemo } from "react";
import { WaterTide } from "@/components/shared/water-tide";
import { pickAmbient, type SeasonKey } from "@/components/shared/ambient/registry";
import { SeasonCanvas } from "@/components/shared/ambient/season-canvas";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";

// year·slug(Phase A, 연대기): 세계는 "어느 달력의 어느 해·달"로 결정된다 — 지난 가을의 도토리가 이 봄의 싹이 되려면 해가 필요하다.
// worldForce는 fixture 전용(시각·날씨·날 강제) — 실제 화면은 넘기지 않는다.
export function AmbientLayer({
  month,
  year,
  slug = "vic",
  force,
  worldForce
}: {
  month: number;
  year: number;
  slug?: string;
  force?: SeasonKey | null;
  worldForce?: WorldCtx["force"];
}) {
  const pick = useMemo(() => pickAmbient(month, force ?? null), [month, force]);
  if (pick.season === "summer") {
    // 여름 = CSS 물결 + 그 위의 마우스 잔물결 캔버스(DOM 뒤에 있어 같은 z:-1에서 물결 위에 그려진다).
    return (
      <>
        <WaterTide key="summer" />
        <SeasonCanvas key="summer-ripple" season="summer" slug={slug} year={year} month={month} force={worldForce} />
      </>
    );
  }
  return <SeasonCanvas key={pick.season} season={pick.season} slug={slug} year={year} month={month} force={worldForce} />;
}
