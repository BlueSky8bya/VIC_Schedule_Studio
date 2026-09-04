// 세계 기능 스위치(2026-09-04) — 코드는 남기고 화면에서만 뺀 것들. 되살릴 때 여기 한 줄만 바꾼다.
//
// treeChain = false (소유자 2026-09-04 밤): "지금 나무 한 그루씩 들어가 있는 거 일단은 뺐다가 나중에 다시 넣자. 토리님 첫 방송일(23.05)이랑
// 데뷔일(25.10)에 해당하는 새싹이랑 씨앗 심은 그것도 아카이브에 기록해 두고 일단은 빼 두자." → 도토리 순환(저장소 흙더미 → 싹 → 묘목 → 나무)과
// 데뷔 나무(2023-05 씨앗 → 2025-10-01 싹 → 실제 참나무 생장)를 화면에서 내린다. 연대기 계산(chronicle.ts)·렌더(traces-draw.ts)·
// 단위 테스트는 그대로 — 바이옴 세계(PLAN-20260904-004 P1)에서 초원의 자리·축척이 정해지면 다시 켠다. 기록: docs/ux/ambient-debut-tree-archive.md.
// 두더지 흙더미·눈사람·연잎은 나무가 아니라 그대로 남는다.

import type { Trace, TraceKind } from "./chronicle";

export const WORLD_FLAGS = {
  /** 도토리 순환 + 데뷔 나무를 화면에 그릴까 */
  treeChain: false
} as const;

const TREE_CHAIN: ReadonlySet<TraceKind> = new Set<TraceKind>(["cache", "sprout", "sapling", "tree", "debut"]);

/** 화면에 그릴 흔적만 — 스위치가 꺼진 계열은 뺀다(연대기 자체는 건드리지 않는다). */
export function visibleTraces(traces: Trace[]): Trace[] {
  if (WORLD_FLAGS.treeChain) return traces;
  return traces.filter((t) => !TREE_CHAIN.has(t.kind));
}
