// 보상 분해(보고서 5.1). 항목별 raw 값 + 가중합. tacticFidelity가 가장 큰 weight.
// 지금은 skeleton — 각 항목을 채우는 실제 계산(xT/EPV/pitch-control)은 Step 3 analytics에서.

export type RewardBreakdown = {
  tacticFidelity: number;
  score: number;
  progression: number;
  chanceQuality: number;
  possessionValue: number;
  defensiveValue: number;
  ruleCompliance: number;
  roleFidelity: number;
  viewerQuality: number;
};

/** 기본 weight(보고서 5.1) — 합 1.0. tacticFidelity 최대. */
export const REWARD_WEIGHTS: RewardBreakdown = {
  tacticFidelity: 0.3,
  score: 0.2,
  progression: 0.12,
  chanceQuality: 0.1,
  possessionValue: 0.08,
  defensiveValue: 0.08,
  ruleCompliance: 0.07,
  roleFidelity: 0.03,
  viewerQuality: 0.02
};

export function emptyBreakdown(): RewardBreakdown {
  return {
    tacticFidelity: 0,
    score: 0,
    progression: 0,
    chanceQuality: 0,
    possessionValue: 0,
    defensiveValue: 0,
    ruleCompliance: 0,
    roleFidelity: 0,
    viewerQuality: 0
  };
}

/** 항목 raw × weight 합. ruleCompliance는 weight와 별개로 hard penalty도 가능(별도 처리). */
export function weightedReward(
  b: RewardBreakdown,
  weights: RewardBreakdown = REWARD_WEIGHTS
): number {
  let total = 0;
  (Object.keys(weights) as (keyof RewardBreakdown)[]).forEach((k) => {
    total += b[k] * weights[k];
  });
  return total;
}

/** 두 분해 합(에피소드 누적 등). */
export function addBreakdown(a: RewardBreakdown, b: RewardBreakdown): RewardBreakdown {
  const out = emptyBreakdown();
  (Object.keys(out) as (keyof RewardBreakdown)[]).forEach((k) => {
    out[k] = a[k] + b[k];
  });
  return out;
}
