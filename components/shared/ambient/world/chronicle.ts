// 연대기(2026-09-04, PLAN-20260904-003 Phase A) — "달력은 시간의 흐름이다": 지난 가을 다람쥐가 묻은 도토리가 이듬해 봄 같은 자리에
// 싹으로 나고, 여름에 묘목, 가을에 작은 나무가 되어 잎과 도토리를 떨군다(숲이 자란다). 겨울엔 보이지 않는 손님이 며칠에 걸쳐 눈사람을
// 세우고 2월에 녹는다. 봄엔 두더지 흙더미가 밤마다 하나씩, 여름엔 연잎이 넓어진다.
//
// **결정적 순수 함수**: chronicle(slug, y, m, d) — 기원(2024)부터 그 달까지 달 단위로 조립한다(프레임 아님, µs). 같은 입력 = 같은
// 흔적·좌표 → 편집실·시청자 화면·기기 어디서나 한 세계(DB 없음). 사용자가 남긴 흔적(파낸 저장소 등)은 별도 로컬 저장(Phase B).
// 좌표는 정규화(u,v ∈ 0~1) — 달력(핫 존)이 덮지 않는 **띠**(위 헤지로우·아래·좌우 여백)에서만 태어난다. 나무는 위 띠에만(헤지로우).
// 시간 규칙: 보고 있는 달이 현재 달이면 오늘까지, 과거 달은 말일, 미래 달은 1일(아직 오지 않은 시간엔 예고만) — 호출자가 d를 정한다.
//
// 근거: 다람쥐 분산 저장 뒤 도토리는 가을에 뿌리·봄에 싹(2~4주 발아, 8~14주 새순), 첫해 30~60cm(MSU Extension·Harvard Arboretum).

import { hashSeed } from "./seed";

// 세계의 시간표(소유자, 2026-09-04): **2023년 5월** 세계가 생긴다(토리님이 처음 나온 달) — 그 달 씨앗 하나가 묻힌다(데뷔 나무).
// **2025년 10월 1일**(스트리머 데뷔일) 그 씨앗에서 싹이 트고, 이후 **실제 시간**의 참나무 생장 속도로 자란다(백참나무는 가을에
// 발아한다 — MSU Extension). 도토리 순환(다람쥐 저장소 → 싹 → 나무)은 데뷔 뒤 첫 가을(2025)부터 돈다. 2023-05 이전엔 흔적이 없다.
export const WORLD_BIRTH = { y: 2023, m: 5 };
export const DEBUT = { y: 2025, m: 10, d: 1 };
export const CHRONICLE_EPOCH = 2025; // 도토리 순환의 첫 가을
export const TREE_CAP = 6;
export const TREE_LIFESPAN = 6; // 나무는 여섯 주기 서 있다가 떠난다 — 상한이 차도 세대가 돌아 숲이 멈추지 않는다
/** 데뷔 나무 자리(정규화) — 위 띠 오른쪽, 두 화면 모두 달력 밖. */
export const DEBUT_TREE_POS = { u: 0.78, v: 0.062 };

export type TraceKind = "cache" | "sprout" | "sapling" | "tree" | "molehill" | "snowman" | "lilypad" | "debut";
export type Trace = {
  kind: TraceKind;
  id: string;
  u: number; // 0~1 정규화 가로
  v: number; // 0~1 정규화 세로
  /** 나무: 나이(년, ≥1) · 눈사람: 단계(1~3) · 흙더미: 0 흙 / 1 풀 얼룩 · 연잎: 크기 배율 · 데뷔 나무: 키(cm, 0 = 아직 씨앗) · 그 외 0 */
  stage: number;
  /** 태어난 주기(가을 시작 연도) */
  cycle: number;
};

// 띠 위치 — 위(50%) · 아래(30%) · 왼쪽(10%) · 오른왽(10%). 나무는 위 띠만. 연잎 같은 물 위 소품은 위 띠(여름의 기슭)를 뺀다.
function bandPos(r: () => number, mode: "any" | "top" | "water" = "any"): [number, number] {
  const k = mode === "top" ? 0 : mode === "water" ? 0.5 + r() * 0.5 : r();
  if (k < 0.5) return [0.04 + r() * 0.92, 0.02 + r() * 0.08];
  if (k < 0.8) return [0.04 + r() * 0.92, 0.9 + r() * 0.08];
  if (k < 0.9) return [0.02 + r() * 0.08, 0.16 + r() * 0.7];
  return [0.9 + r() * 0.08, 0.16 + r() * 0.7];
}

/** 가을(9월 1일 = 0)·봄(3월 1일 = 0)·여름(6월 1일 = 0) 안의 날 번호(대략 30일/월). */
const dayIn = (m: number, d: number, startMonth: number) => (m - startMonth) * 30 + (d - 1);

type Cache = { cycle: number; i: number; u: number; v: number; day: number; survives: boolean; sproutDay: number };

// 주기 C(가을 C년)의 저장소들 — 4~6개, 나타나는 날, 살아남아 싹이 되는지(60%), 싹 트는 봄날(3~4월).
function cachesOf(slug: string, cycle: number): Cache[] {
  const r = hashSeed(slug, "cache", cycle);
  const n = 4 + Math.floor(r() * 3);
  const out: Cache[] = [];
  for (let i = 0; i < n; i++) {
    const [u, v] = bandPos(r, "top");
    out.push({ cycle, i, u, v, day: Math.floor(r() * 75), survives: r() < 0.6, sproutDay: 5 + Math.floor(r() * 40) });
  }
  return out;
}

/** 주기 upTo까지 살아남아 나무가 된(될) 저장소 중 upTo에 **서 있는** 것. 싹이 트는 판정은 그 주기 시점의 살아 있는 나무 수로 —
 *  상한(TREE_CAP)이 차 있으면 그 주기의 저장소는 싹이 나지 않고, 여섯 주기가 지난 나무는 떠나 자리를 비운다(판정은 언제 계산해도 같다). */
function treesUpTo(slug: string, upTo: number): Cache[] {
  const accepted: Cache[] = [];
  for (let c = CHRONICLE_EPOCH; c <= upTo; c++) {
    let living = accepted.filter((a) => c - a.cycle < TREE_LIFESPAN).length;
    for (const k of cachesOf(slug, c)) {
      if (!k.survives || living >= TREE_CAP) continue;
      accepted.push(k);
      living++;
    }
  }
  return accepted.filter((a) => upTo - a.cycle < TREE_LIFESPAN);
}

/** 주기 = 가을이 시작된 해. 9~12월은 그 해, 1~8월은 전 해. */
export const cycleOf = (y: number, m: number) => (m >= 9 ? y : y - 1);

const dayNumber = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86400_000);

/** 데뷔 나무의 키(cm). 2025-10-01 이전 = 0(씨앗), 이후 실제 참나무 생장: 첫 가을 싹 4→14cm, 이후 생장기(4~9월)에만 자란다 —
 *  1년째 ~45cm, 2년째 ~110cm, 5년째 ~3m, 20년째 ~11m, 그 뒤 완만(상한 20m). 겨울엔 자라지 않는다(실제처럼). */
export function debutHeightCm(y: number, m: number, d: number): number {
  const since = dayNumber(y, m, d) - dayNumber(DEBUT.y, DEBUT.m, DEBUT.d);
  if (since < 0) return 0;
  // 첫 90일(2025 가을) — 발아·첫 잎: 4cm에서 14cm까지.
  if (since <= 90) return 4 + (10 * since) / 90;
  // 그 뒤는 '생장기 연수' — 4~9월만 자란다(월마다 1/6년). 2025-10 이후의 생장기 달을 센다.
  let seasons = 0;
  let yy = 2026;
  let mm = 1;
  for (;;) {
    if (yy > y || (yy === y && mm > m)) break;
    if (mm >= 4 && mm <= 9) {
      if (yy === y && mm === m) seasons += (d - 1) / 30 / 6;
      else seasons += 1 / 6;
    }
    mm++;
    if (mm > 12) {
      mm = 1;
      yy++;
    }
  }
  let h: number;
  if (seasons <= 1) h = 14 + 31 * seasons; // 1년째 45cm
  else if (seasons <= 5) h = 45 + 64 * (seasons - 1); // 5년째 301cm
  else if (seasons <= 20) h = 301 + 55 * (seasons - 5); // 20년째 1126cm
  else h = 1126 + 20 * (seasons - 20);
  return Math.min(2000, Math.round(h));
}

export function chronicle(slug: string, y: number, m: number, d: number): Trace[] {
  const out: Trace[] = [];
  if (y * 12 + m < WORLD_BIRTH.y * 12 + WORLD_BIRTH.m) return out; // 세계가 생기기 전
  // ── 데뷔 나무 — 2023-05 씨앗(흙더미), 2025-10-01 싹, 그 뒤 실제 시간으로 자란다.
  out.push({ kind: "debut", id: "debut", u: DEBUT_TREE_POS.u, v: DEBUT_TREE_POS.v, stage: debutHeightCm(y, m, d), cycle: WORLD_BIRTH.y });
  const cycle = cycleOf(y, m);
  const id = (kind: TraceKind, c: number, i: number) => `${kind}:${c}:${i}`;
  // ── 나무: 이전 주기들에서 살아남은 저장소. 나이 = 현재 주기 − 태어난 주기(봄엔 싹, 여름엔 묘목이라 나무는 나이 ≥1).
  const trees = treesUpTo(slug, cycle - 1);
  const isSpringSummer = m >= 3 && m <= 8;
  for (const t of trees) {
    const age = cycle - t.cycle;
    if (age < 1) continue;
    // 태어난 바로 다음 봄·여름은 싹·묘목 단계(아래에서 그린다) — 나무는 그 다음 가을부터.
    if (age === 1 && isSpringSummer) continue;
    out.push({ kind: "tree", id: id("tree", t.cycle, t.i), u: t.u, v: t.v, stage: age, cycle: t.cycle });
  }
  // ── 이번 주기 가을의 저장소(나타난 날까지) — 가을엔 흙더미, 겨울엔 눈 밑(2월 15일 해빙 뒤 다시 보임).
  const caches = cachesOf(slug, cycle);
  if (m >= 9 && m <= 11) {
    const day = dayIn(m, d, 9);
    for (const k of caches) if (k.day <= day) out.push({ kind: "cache", id: id("cache", k.cycle, k.i), u: k.u, v: k.v, stage: 0, cycle: k.cycle });
  } else if (m === 2 && d >= 15) {
    for (const k of caches) out.push({ kind: "cache", id: id("cache", k.cycle, k.i), u: k.u, v: k.v, stage: 1, cycle: k.cycle });
  }
  // ── 봄 싹·여름 묘목: 지난 가을(이번 주기) 저장소 중 살아남은 것(나무 상한 안에서).
  const eligible = new Set(treesUpTo(slug, cycle).filter((t) => t.cycle === cycle).map((t) => t.i));
  if (m >= 3 && m <= 5) {
    const day = dayIn(m, d, 3);
    for (const k of caches) {
      if (!eligible.has(k.i) || k.sproutDay > day) continue;
      out.push({ kind: "sprout", id: id("sprout", k.cycle, k.i), u: k.u, v: k.v, stage: Math.min(1, (day - k.sproutDay) / 45), cycle: k.cycle });
    }
  } else if (m >= 6 && m <= 8) {
    const day = dayIn(m, d, 6);
    for (const k of caches) {
      if (!eligible.has(k.i)) continue;
      out.push({ kind: "sapling", id: id("sapling", k.cycle, k.i), u: k.u, v: k.v, stage: Math.min(1, day / 90), cycle: k.cycle });
    }
  }
  // ── 두더지 흙더미: 봄 밤마다 하나씩(최대 8), 여름엔 풀 얼룩으로 남다 9월에 사라진다.
  if (m >= 3 && m <= 8) {
    const r = hashSeed(slug, "mole", y);
    const n = 8;
    const spots: [number, number][] = [];
    for (let i = 0; i < n; i++) spots.push(bandPos(r));
    const shown = m <= 5 ? Math.min(n, Math.floor(dayIn(m, d, 3) / 7)) : n;
    for (let i = 0; i < shown; i++) out.push({ kind: "molehill", id: id("molehill", y, i), u: spots[i][0], v: spots[i][1], stage: m <= 5 ? 0 : 1, cycle: y });
  }
  // ── 눈사람: 12월 20일부터 손님이 굴린다(공 1 → +3일 2 → +7일 3), 2월 15일부터 녹아 25일에 사라진다.
  if (m === 12 || m === 1 || m === 2) {
    const r = hashSeed(slug, "snowman", cycle);
    const [u, v] = bandPos(r);
    let stage = 0;
    if (m === 12) stage = d >= 27 ? 3 : d >= 23 ? 2 : d >= 20 ? 1 : 0;
    else if (m === 1) stage = 3;
    else stage = d < 15 ? 3 : d < 20 ? 2 : d < 25 ? 1 : 0;
    if (stage > 0) out.push({ kind: "snowman", id: id("snowman", cycle, 0), u, v, stage, cycle });
  }
  // ── 연잎: 6월 3장에서 8월 12장으로 넓어진다(위치는 해마다 같다).
  if (m >= 6 && m <= 8) {
    const r = hashSeed(slug, "lily", y);
    const n = Math.min(12, 3 + Math.floor(dayIn(m, d, 6) / 8));
    // 자리는 서로 떨어뜨린다(2026-09-04 소유자: "개구리밥이 다 겹쳐 있다, 입체감 없이") — 앞선 잎과 가로 .045·세로 .06 안이면 다시 뽑는다(최대 8회).
    const placed: [number, number][] = [];
    for (let i = 0; i < 12; i++) {
      let u = 0;
      let v = 0;
      for (let tries = 0; tries < 8; tries++) {
        [u, v] = bandPos(r, "water"); // 기슭(위 띠)엔 연잎이 없다
        if (placed.every(([pu, pv]) => Math.abs(pu - u) > 0.045 || Math.abs(pv - v) > 0.06)) break;
      }
      placed.push([u, v]);
      const k = 0.7 + r() * 0.6;
      if (i < n) out.push({ kind: "lilypad", id: id("lilypad", y, i), u, v, stage: k, cycle: y });
    }
  }
  return out;
}

/** 보고 있는 달에 쓸 '날' — 현재 달은 오늘, 과거 달은 말일, 미래 달은 1일(예고만). */
export function chronicleDay(y: number, m: number, today: { y: number; m: number; d: number }): number {
  if (y === today.y && m === today.m) return today.d;
  if (y < today.y || (y === today.y && m < today.m)) return new Date(Date.UTC(y, m, 0)).getUTCDate();
  return 1;
}
