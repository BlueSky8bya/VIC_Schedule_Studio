// 태양 위치(2026-09-07, PLAN-20260907-006) — 계절표 대신 **실제 궤도**로 하루의 골격을 만든다.
// 황도가 기울어 있으니 적위(declination)가 날마다 달라지고, 그래서 겨울은 밤이 길고 해가 낮게 지나간다.
// 출처: NOAA Solar Calculator의 표준 근사(General Solar Position Calculations) — 분 단위 오차로 충분하다(띠는 '느낌'이지만
// 계절 차이는 진짜여야 한다: 서울 남중고도 동지 ≈ 29°, 하지 ≈ 76°).
// 시간의 진실은 KST(Non-negotiable 1) — 위도·경도·시간대가 상수라 서버·클라이언트 어디서 계산해도 같은 값이다.

/** 서울(달력 세계의 기준 자리). */
export const SITE = { lat: 37.5665, lon: 126.978, tz: 9 };

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** 그 해의 몇 번째 날인가(1~366). */
export function dayOfYear(y: number, m: number, d: number): number {
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(y, 0, 1);
  return Math.round((a - b) / 86400000) + 1;
}

/** 태양의 적위(도)와 균시차(분) — NOAA 근사. hour는 KST 소수 시간(하루 안의 변화를 조금 반영). */
function solarTerms(y: number, m: number, d: number, hour: number) {
  const doy = dayOfYear(y, m, d);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (doy - 1 + (hour - 12) / 24);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g); // 라디안
  return { eqTime, decl };
}

export type SunPos = {
  /** 고도(도) — 지평선 위가 양수. */
  alt: number;
  /** 방위(도) — 북 0, 동 90, 남 180, 서 270. */
  az: number;
};

/** 그 날 그 시각(KST)의 해 고도·방위. */
export function sunPos(y: number, m: number, d: number, hour: number): SunPos {
  const { eqTime, decl } = solarTerms(y, m, d, hour);
  // 진태양시(분) — 경도 보정 + 균시차 − 시간대.
  const tst = hour * 60 + eqTime + 4 * SITE.lon - 60 * SITE.tz;
  const ha = (tst / 4 - 180) * RAD; // 시간각(라디안), 남중 = 0
  const lat = SITE.lat * RAD;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const z = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const alt = 90 - z * DEG;
  // 방위 — 남을 기준으로 재고 북 기준으로 옮긴다.
  const denom = Math.cos(lat) * Math.sin(z);
  let az = 180;
  if (Math.abs(denom) > 1e-9) {
    const cosAz = (Math.sin(decl) - Math.sin(lat) * cosZ) / denom;
    az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * DEG;
    if (ha > 0) az = 360 - az; // 오후 = 서쪽
  }
  return { alt, az };
}

export type SunDay = {
  /** 남중 시각(KST 소수 시간). */
  noon: number;
  /** 일출·일몰(고도 −0.833°, 대기 굴절 포함). 극단적으로 해가 안 지는 날은 없는 위도라 항상 존재한다. */
  rise: number;
  set: number;
  /** 시민박명 시작·끝(고도 −6°) — 새벽의 첫 빛, 저녁의 마지막 빛. */
  dawnCivil: number;
  duskCivil: number;
  /** 남중고도(도) — 겨울이 낮다. 하루의 '밝기 천장'으로도 쓴다. */
  maxAlt: number;
  /** 낮 길이(시간). */
  dayLen: number;
};

/** 고도 h(도)에 해당하는 시간각(시간). 없으면 null(그 날 그 고도에 안 닿는다). */
function hourAngleFor(decl: number, altDeg: number): number | null {
  const lat = SITE.lat * RAD;
  const cosH = (Math.cos((90 - altDeg) * RAD) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  return (Math.acos(cosH) * DEG) / 15; // 시간
}

const dayCache = new Map<string, SunDay>();

/** 그 날의 태양 골격(남중·일출·일몰·박명·남중고도). 날짜별로 한 번만 센다. */
export function sunDay(y: number, m: number, d: number): SunDay {
  const key = `${y}-${m}-${d}`;
  const hit = dayCache.get(key);
  if (hit) return hit;
  const { eqTime, decl } = solarTerms(y, m, d, 12);
  // 남중 = 12시 − 균시차 − 경도 보정(분 → 시간).
  const noon = 12 - (eqTime + 4 * SITE.lon - 60 * SITE.tz) / 60;
  const h0 = hourAngleFor(decl, -0.833);
  const h6 = hourAngleFor(decl, -6);
  // 서울 위도에선 늘 값이 있지만, 없으면 백야/극야 대신 안전한 기본값(해가 거의 안 뜬 날)으로.
  const half = h0 ?? 0.5;
  const halfCivil = h6 ?? half + 0.6;
  const maxAlt = 90 - Math.abs(SITE.lat * RAD - decl) * DEG;
  const out: SunDay = {
    noon,
    rise: noon - half,
    set: noon + half,
    dawnCivil: noon - halfCivil,
    duskCivil: noon + halfCivil,
    maxAlt,
    dayLen: half * 2
  };
  if (dayCache.size > 400) dayCache.clear();
  dayCache.set(key, out);
  return out;
}
