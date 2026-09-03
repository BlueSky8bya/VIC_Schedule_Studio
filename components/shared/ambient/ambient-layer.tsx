"use client";

// 앰비언트 배경(2026-09-04, ADR-0017) — 편집실·시청자 화면 공용 진입점. 물결(.gs-tide)은 사철 상수로
// 깔고, 오늘(KST)의 계절 레이어 하나를 그 위에 얹는다(레지스트리 registry.ts가 판정). 여름은 물결
// 그대로(추가 레이어 없음). 레이어는 전부 fixed z:-1·pointer-events 없음·transform/opacity만 애니.
// 계절 판정은 첫 렌더에 한 번(useState 초기화) — 서버·클라이언트가 같은 KST 날짜를 보므로 하이드레이션이
// 맞는다(자정 절기 경계에 걸리는 1회 불일치는 React가 클라이언트 값으로 다시 그린다).
// `force`는 fixture/검증용(계절 강제) — 실제 화면은 넘기지 않는다.

import { useState } from "react";
import { WaterTide } from "@/components/shared/water-tide";
import { kstToday, pickAmbient, type SeasonKey } from "@/components/shared/ambient/registry";
import { SeasonAutumn } from "@/components/shared/ambient/season-autumn";
import { SeasonSpring } from "@/components/shared/ambient/season-spring";
import { SeasonWinter } from "@/components/shared/ambient/season-winter";

export function AmbientLayer({ force }: { force?: SeasonKey | null }) {
  const [pick] = useState(() => pickAmbient(kstToday(), force ?? null));
  return (
    <>
      <WaterTide />
      {pick.season === "autumn" ? (
        <SeasonAutumn />
      ) : pick.season === "winter" ? (
        <SeasonWinter />
      ) : pick.season === "spring" ? (
        <SeasonSpring />
      ) : null}
    </>
  );
}
