// 결정적 시드(2026-09-04, Phase A) — 연대기·날씨·소품 배치가 "누가 어디서 보든 같은 세계"이려면 난수가 아니라 (달력·날짜·
// 용도) 문자열에서 나오는 시드가 필요하다. FNV-1a 32bit → scenes/util의 mulberry32.

import { rng, type Rng } from "@/components/shared/ambient/scenes/util";

export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 여러 조각(문자·숫자)을 이어 만든 결정적 난수 생성기. 같은 조각 = 같은 수열. */
export function hashSeed(...parts: (string | number)[]): Rng {
  return rng(fnv1a(parts.join("|")));
}
