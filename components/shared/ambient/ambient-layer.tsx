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

export function AmbientLayer({ month, force }: { month: number; force?: SeasonKey | null }) {
  const pick = useMemo(() => pickAmbient(month, force ?? null), [month, force]);
  if (pick.season === "summer") {
    // 여름 = CSS 물결 + 그 위의 마우스 잔물결 캔버스(DOM 뒤에 있어 같은 z:-1에서 물결 위에 그려진다).
    return (
      <>
        <WaterTide key="summer" />
        <SeasonCanvas key="summer-ripple" season="summer" />
      </>
    );
  }
  return <SeasonCanvas key={pick.season} season={pick.season} />;
}
