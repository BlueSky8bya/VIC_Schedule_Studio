// '아직 진행 중인 구간'을 완료된 구간과 구별하기 위한 순수 계산(KST). 서버·클라 공용.
//
// 왜 필요한가: 6개월 추이의 마지막 칸은 이번 달인데, 매달 초에는 며칠치밖에 없다. 그걸 지난달
// '전체'와 그대로 비교하면 1~10일 사이엔 늘 `▼ 70%` 같은 배지가 뜬다 — 실제로는 아무 일도
// 일어나지 않았는데 "망했다"로 읽힌다(2026-08-07 시간대 차트 오독과 같은 계열의 문제).
// 그래서 ① 진행 중이라는 사실을 화면에 적고 ② 비교는 지난달의 '같은 페이스' 환산치와 한다.

const KST_MS = 9 * 3600_000;

export type MonthProgress = {
  elapsedDays: number; // 사람이 읽는 값 — 오늘을 포함한 날짜(8월 7일이면 7)
  totalDays: number; // 그 달 전체 일수
  frac: number; // 페이스 환산 비율(0~1) — 오늘의 지나간 시간까지 반영
};

/** 지금(KST)의 YYYY-MM. */
export function kstYm(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_MS).toISOString().slice(0, 7);
}

/** 지금(KST)의 YYYY-MM-DD. */
export function kstDay(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_MS).toISOString().slice(0, 10);
}

/**
 * 그 달(YYYY-MM)이 아직 진행 중이면 진행도, 아니면 null(과거·미래 달은 '완료'로 본다).
 * 미래 달은 데이터가 아예 없어 배지가 뜨지 않으므로 여기서 구분하지 않는다.
 */
export function monthProgress(ym: string, nowMs: number = Date.now()): MonthProgress | null {
  if (ym !== kstYm(nowMs)) return null;
  const k = new Date(nowMs + KST_MS);
  const totalDays = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsedDays = k.getUTCDate();
  // 페이스는 '지나간 시간'이다 — 1일 0시에 하루치를 다 지난 것으로 치면 환산치가 부풀어
  // 이번 달이 늘 미달로 보인다. 오늘은 시(hour)까지 쪼개 센다.
  const frac = Math.min(1, (elapsedDays - 1 + k.getUTCHours() / 24) / totalDays);
  return { elapsedDays, totalDays, frac };
}

export type TrendDelta = {
  pct: number | null; // null = 비교 기준이 0(신규)
  pace: boolean; // true면 '지난달 같은 페이스' 환산치와 비교한 값(≈)
  base: number; // 실제 비교에 쓴 기준값
};

/**
 * 추이 배지 값. 진행 중인 달이면 지난달 전체가 아니라 **같은 페이스 환산치**와 비교한다.
 * (달 안에서 활동이 고르다는 가정이다 — 그래서 화면에는 `≈`를 붙이고 근거를 title에 적는다.)
 */
export function trendDelta(cur: number, prev: number, prog: MonthProgress | null): TrendDelta {
  const base = prog ? prev * prog.frac : prev;
  if (base <= 0) return { pct: null, pace: Boolean(prog), base };
  return { pct: Math.round(((cur - base) / base) * 100), pace: Boolean(prog), base };
}
