"use client";

// 앰비언트 배경(2026-09-04, ADR-0017 개정 2 → PLAN-20260904-004) — 편집실·시청자 화면 공용 진입점. **보고 있는 달력의 달**이 계절을
// 정하고(registry.ts), 화면은 사철 **초원**(달력 뒤·감상 첫 화면)이다. 감상 모드에서 방향키로 다른 바이옴(연못·숲·언덕·해안·바다…)으로
// 카메라가 미끄러진다(world/world-scene.ts). 옛 "여름 = CSS 물결(.gs-tide)"은 더 마운트하지 않는다 — 물은 연못·바다 바이옴이 캔버스로
// 그린다(소유자 2026-09-04: 사철 초원, 여름의 억지 기슭 폐기). 계절 배경 스위치 OFF(html[data-ambient="off"])면 전부 내려간다.
// 게이트(생동감·gfx·계절 스위치·≥641px)는 CSS(app/ambient.css `.gs-season`)가 쥔다. `force`는 fixture/검증용(계절 강제).

import { useMemo } from "react";
import { pickAmbient, type SeasonKey } from "@/components/shared/ambient/registry";
import { SeasonCanvas } from "@/components/shared/ambient/season-canvas";
import type { WorldCtx } from "@/components/shared/ambient/scene-engine";

// year·slug(Phase A, 연대기): 세계는 "어느 달력의 어느 해·달"로 결정된다 — 지난 가을의 도토리가 이 봄의 싹이 되려면 해가 필요하다.
// worldForce는 fixture 전용(시각·날씨·날·시작 바이옴 강제) — 실제 화면은 넘기지 않는다.
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
  return <SeasonCanvas key={pick.season} season={pick.season} slug={slug} year={year} month={month} force={worldForce} />;
}
