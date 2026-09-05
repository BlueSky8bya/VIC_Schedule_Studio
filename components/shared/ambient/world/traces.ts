// 달의 흔적(2026-09-05) — **연대기(chronicle) 철거**. 소유자: "연대기 시스템 없애고 걍 월별로만 구분하자."
//
// 옛 연대기는 세계의 탄생(2023-05)부터 달·날 단위로 되감아 도토리 순환·데뷔 나무·눈사람 단계를 조립했다. 그 규칙은
// ① 날까지 봐야 답이 갈려 설정에 '월드 날짜'라는 줄이 필요했고 ② 나무 계열은 이미 스위치로 화면에서 내려가 있어
// 실제로는 두더지 흙더미·눈사람·연잎 셋만 그리고 있었다. 그 셋은 **보고 있는 달만으로** 정해진다.
//
// 이 파일이 하는 일: (slug, 연, 달) → 그 달에 화면에 놓이는 것들. 순수·결정적이라 편집실·시청자·기기 어디서나
// 같은 그림이다(DB 없음). 자리는 정규화(u, v ∈ 0~1)이고 달력(핫 존)이 덮지 않는 **띠**에서만 태어난다.
// (옛 연대기의 도토리 순환·데뷔 나무 기록: docs/ux/ambient-debut-tree-archive.md)

import { hashSeed } from "./seed";

export type TraceKind = "molehill" | "snowman" | "lilypad";
export type Trace = {
  kind: TraceKind;
  id: string;
  u: number; // 0~1 정규화 가로
  v: number; // 0~1 정규화 세로
  /** 눈사람: 단계(1~3) · 흙더미: 0 흙 / 1 풀 얼룩 · 연잎: 크기 배율 */
  stage: number;
  /** 해(자리 시드) — 해가 바뀌면 배치가 새로 뽑힌다. */
  cycle: number;
};

// 띠 위치 — 위(50%) · 아래(30%) · 왼쪽(10%) · 오른쪽(10%). 물 위 소품(연잎)은 위 띠(기슭)를 뺀다.
function bandPos(r: () => number, mode: "any" | "water" = "any"): [number, number] {
  const k = mode === "water" ? 0.5 + r() * 0.5 : r();
  if (k < 0.5) return [0.04 + r() * 0.92, 0.02 + r() * 0.08];
  if (k < 0.8) return [0.04 + r() * 0.92, 0.9 + r() * 0.08];
  if (k < 0.9) return [0.02 + r() * 0.08, 0.16 + r() * 0.7];
  return [0.9 + r() * 0.08, 0.16 + r() * 0.7];
}

const id = (kind: string, ...parts: (number | string)[]) => `${kind}:${parts.join(":")}`;

/** 두더지 흙더미 — 봄에 하나씩 늘고(3월 3 → 4월 6 → 5월 8), 여름엔 풀이 덮어 얼룩이 된다(6~8월 8). */
function molehills(slug: string, y: number, m: number): Trace[] {
  if (m < 3 || m > 8) return [];
  const r = hashSeed(slug, "mole", y);
  const spots: [number, number][] = [];
  for (let i = 0; i < 8; i++) spots.push(bandPos(r));
  const n = m === 3 ? 3 : m === 4 ? 6 : 8;
  const stage = m <= 5 ? 0 : 1; // 0 = 새 흙 / 1 = 풀 얼룩
  return spots.slice(0, n).map((s, i) => ({ kind: "molehill" as const, id: id("molehill", y, i), u: s[0], v: s[1], stage, cycle: y }));
}

/** 눈사람 — 12월에 쌓이는 중(2단), 1월에 완성(3단), 2월엔 녹는 중(1단). 자리는 그 겨울에 하나. */
function snowman(slug: string, y: number, m: number): Trace[] {
  if (m !== 12 && m !== 1 && m !== 2) return [];
  // 12월과 이듬해 1·2월은 **같은 겨울**이다 — 자리가 해를 넘으며 튀지 않게 시드를 겨울로 묶는다.
  const winter = m === 12 ? y : y - 1;
  const r = hashSeed(slug, "snowman", winter);
  const [u, v] = bandPos(r);
  const stage = m === 12 ? 2 : m === 1 ? 3 : 1;
  return [{ kind: "snowman" as const, id: id("snowman", winter), u, v, stage, cycle: winter }];
}

/** 연잎 — 6월 5장 → 7월 9장 → 8월 12장. 서로 겹치지 않게 자리를 벌린다. */
function lilypads(slug: string, y: number, m: number): Trace[] {
  if (m < 6 || m > 8) return [];
  const r = hashSeed(slug, "lily", y);
  const n = m === 6 ? 5 : m === 7 ? 9 : 12;
  const out: Trace[] = [];
  const placed: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    // 앞선 잎과 가로 .045·세로 .06 안이면 다시 뽑는다(최대 8회) — 다 겹치면 "개구리밥"이 된다(2026-09-04 소유자).
    let u = 0;
    let v = 0;
    for (let tryN = 0; tryN < 8; tryN++) {
      const p = bandPos(r, "water");
      u = p[0];
      v = p[1];
      if (!placed.some(([pu, pv]) => Math.abs(pu - u) < 0.045 && Math.abs(pv - v) < 0.06)) break;
    }
    placed.push([u, v]);
    const k = 0.7 + r() * 0.6;
    if (i < n) out.push({ kind: "lilypad", id: id("lilypad", y, i), u, v, stage: k, cycle: y });
  }
  return out;
}

/** (slug, 연, 달) → 그 달에 화면에 놓이는 흔적들. 날은 보지 않는다. */
export function monthTraces(slug: string, y: number, m: number): Trace[] {
  return [...molehills(slug, y, m), ...snowman(slug, y, m), ...lilypads(slug, y, m)];
}
