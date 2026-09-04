// 희귀도·스폰 감독(2026-09-04, Phase A) — 동물의 숲 방식: 스폰 풀 × 가중치 × 동시 상한 × 쿨다운 × 자비 타이머 × 전설은 세션당 1회
// (소유자 결정 ②: 전설은 **순수 확률** — 사용자 행동으로 부르지 않는다). 감독은 '한 화면에 이목을 끄는 사건은 하나'(검이불누)를 지킨다:
// 드묾 이상이 살아 있는 동안 다른 드묾 이상은 뜨지 않는다. 자비 타이머: 오래 조용하면 다음 굴림을 드묾 이상으로만 채운다(감상 모드에서
// 15분을 봤는데 흔한 것만 나오는 실망 방지).

import type { DayBand } from "./time";
import type { Weather } from "./weather";

export type Tier = "common" | "uncommon" | "rare" | "epic" | "legend";
export const TIER_ORDER: readonly Tier[] = ["common", "uncommon", "rare", "epic", "legend"];
export const TIER_WEIGHT: Record<Tier, number> = { common: 40, uncommon: 20, rare: 6, epic: 1.5, legend: 0.2 };
export const TIER_DOTS: Record<Tier, string> = { common: "●○○○○", uncommon: "●●○○○", rare: "●●●○○", epic: "●●●●○", legend: "●●●●●" };
export const TIER_LABEL: Record<Tier, string> = { common: "흔함", uncommon: "보통", rare: "드묾", epic: "희귀", legend: "전설" };
const tierRank = (t: Tier) => TIER_ORDER.indexOf(t);

export type SpawnCtx = {
  band: DayBand;
  weather: Weather;
  month: number;
  load: number;
  /** 지금 살아 있는 개체 수(종 id별) */
  active: ReadonlyMap<string, number>;
  /** 초(장면 시계) */
  now: number;
};
export type SpawnEntry = {
  id: string;
  tier: Tier;
  /** 동시 상한 */
  max: number;
  /** 최소 여력 */
  minLoad?: number;
  /** 조건(시각대·날씨·월) */
  ok?: (ctx: SpawnCtx) => boolean;
  /** 같은 종 재등장 최소 간격(초) */
  cooldown?: number;
};

export type SpawnDirectorOptions = { pity?: number; eventGap?: number };

export class SpawnDirector {
  private lastAt = new Map<string, number>();
  private lastRareAt: number;
  private legendUsed = false;
  private readonly pity: number;
  private readonly eventGap: number;
  private lastEventAt = -Infinity;
  constructor(
    private readonly rand: () => number,
    opts: SpawnDirectorOptions = {},
    now = 0
  ) {
    this.pity = opts.pity ?? 15 * 60;
    this.eventGap = opts.eventGap ?? 90;
    this.lastRareAt = now;
  }
  /** 살아 있는 드묾 이상이 있나(감독은 사건을 겹치지 않는다). */
  private rareActive(entries: readonly SpawnEntry[], ctx: SpawnCtx): boolean {
    return entries.some((e) => tierRank(e.tier) >= tierRank("rare") && (ctx.active.get(e.id) ?? 0) > 0);
  }
  private eligible(e: SpawnEntry, ctx: SpawnCtx, rareBusy: boolean): boolean {
    if ((ctx.active.get(e.id) ?? 0) >= e.max) return false;
    if (e.minLoad !== undefined && ctx.load < e.minLoad) return false;
    if (e.ok && !e.ok(ctx)) return false;
    const last = this.lastAt.get(e.id);
    if (last !== undefined && e.cooldown !== undefined && ctx.now - last < e.cooldown) return false;
    if (tierRank(e.tier) >= tierRank("rare")) {
      if (rareBusy) return false;
      if (ctx.now - this.lastEventAt < this.eventGap) return false;
      if (e.tier === "legend" && this.legendUsed) return false;
    }
    return true;
  }
  /** 한 번 굴린다 — 뜰 종의 id 또는 null. 가중치는 등급표, 자비 타이머가 지났으면 드묾 이상만 후보. */
  roll(entries: readonly SpawnEntry[], ctx: SpawnCtx): string | null {
    const rareBusy = this.rareActive(entries, ctx);
    let pool = entries.filter((e) => this.eligible(e, ctx, rareBusy));
    if (pool.length === 0) return null;
    const starving = ctx.now - this.lastRareAt > this.pity;
    if (starving) {
      const rares = pool.filter((e) => tierRank(e.tier) >= tierRank("rare"));
      if (rares.length) pool = rares;
    }
    const total = pool.reduce((s, e) => s + TIER_WEIGHT[e.tier], 0);
    let r = this.rand() * total;
    let picked = pool[pool.length - 1];
    for (const e of pool) {
      r -= TIER_WEIGHT[e.tier];
      if (r <= 0) {
        picked = e;
        break;
      }
    }
    this.lastAt.set(picked.id, ctx.now);
    if (tierRank(picked.tier) >= tierRank("rare")) {
      this.lastRareAt = ctx.now;
      this.lastEventAt = ctx.now;
      if (picked.tier === "legend") this.legendUsed = true;
    }
    return picked.id;
  }
  debug() {
    return { legendUsed: this.legendUsed, lastRareAt: this.lastRareAt, spawned: Object.fromEntries(this.lastAt) };
  }
}
