// 달력 연도별 표(음력 명절·24절기)를 계산해 lib/calendar/calendar-tables.generated.ts 로 쓴다.
//   node scripts/generate-calendar-tables.mjs            → 파일 생성
//   node scripts/generate-calendar-tables.mjs --check    → 손으로 넣은 옛 표(2023~2031)와 대조만
// 사람이 해마다 표를 채우지 않아도 되게 2100년까지 한 번에 만든다(2026-11-22).
//  - 음력: Node 내장 ICU의 한국 음력(dangi). 설날(1/1)·부처님오신날(4/8)·추석(8/15), 윤달은 건너뛴다.
//  - 절기: 태양 황경(Meeus 25장 저정밀식, 오차 약 0.01° ≈ 15분)이 15° 배수가 되는 순간의 KST 날짜.
//    자정 30분 안쪽에 걸린 절기는 하루 어긋날 수 있어 실행할 때 목록으로 알려 준다.
import { readFileSync, writeFileSync } from "node:fs";

const FIRST_YEAR = 2028;
const LAST_YEAR = 2100;
const TERM_FIRST_YEAR = 2032;

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// ── 음력 ────────────────────────────────────────────────────────────────
const dangi = new Intl.DateTimeFormat("en-u-ca-dangi", { timeZone: "UTC", month: "numeric", day: "numeric" });
function lunarOf(date) {
  const parts = dangi.formatToParts(date);
  const month = parts.find((p) => p.type === "month").value;
  const day = Number(parts.find((p) => p.type === "day").value);
  return { month: Number.parseInt(month, 10), leap: /bis|[^0-9]/.test(month), day };
}
function findLunar(year, lunarMonth, lunarDay, fromMonth) {
  for (let t = Date.UTC(year, fromMonth - 1, 1); t < Date.UTC(year + 1, 0, 1); t += 86400000) {
    const d = new Date(t);
    const l = lunarOf(d);
    if (!l.leap && l.month === lunarMonth && l.day === lunarDay) return d;
  }
  throw new Error(`lunar ${lunarMonth}/${lunarDay} not found in ${year}`);
}
function lunarYear(year) {
  return {
    seollal: findLunar(year, 1, 1, 1),
    buddha: findLunar(year, 4, 8, 4),
    chuseok: findLunar(year, 8, 15, 8)
  };
}

// ── 24절기 ──────────────────────────────────────────────────────────────
const TERMS = ["소한", "대한", "입춘", "우수", "경칩", "춘분", "청명", "곡우", "입하", "소만", "망종", "하지", "소서", "대서", "입추", "처서", "백로", "추분", "한로", "상강", "입동", "소설", "대설", "동지"];
const rad = Math.PI / 180;
function sunLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * rad;
  const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lon % 360) + 360) % 360;
}
const jdOf = (ms) => ms / 86400000 + 2440587.5;
// 지구시(TT)−세계시(UT) 근사(초). 2005~2150 다항식(Espenak·Meeus) — 절기 순간을 1분쯤 옮긴다.
function deltaTSeconds(year) {
  const t = year - 2000;
  if (year < 2050) return 62.92 + 0.32217 * t + 0.005589 * t * t;
  return -20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year);
}
// i번째 절기(소한=0): 황경 285° + 15°·i. 대략 날짜에서 이분법으로 순간을 찾는다.
function termInstant(year, i) {
  const target = (285 + 15 * i) % 360;
  const approx = Date.UTC(year, Math.floor(i / 2), i % 2 === 0 ? 6 : 21);
  let lo = approx - 6 * 86400000;
  let hi = approx + 6 * 86400000;
  const diff = (ms) => {
    const jd = jdOf(ms) + deltaTSeconds(year) / 86400;
    return ((sunLongitude(jd) - target + 540) % 360) - 180;
  };
  for (let k = 0; k < 50; k += 1) {
    const mid = (lo + hi) / 2;
    if (diff(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function termsOfYear(year) {
  return TERMS.map((name, i) => {
    const ms = termInstant(year, i);
    const kst = new Date(ms + 9 * 3600000);
    const minutesFromMidnight = kst.getUTCHours() * 60 + kst.getUTCMinutes();
    const edge = Math.min(minutesFromMidnight, 1440 - minutesFromMidnight);
    return { name, date: iso(kst), day: kst.getUTCDate(), month: kst.getUTCMonth() + 1, edge };
  });
}

// ── 옛 표와 대조 ─────────────────────────────────────────────────────────
function check() {
  const src = readFileSync(new URL("../lib/calendar/holidays.ts", import.meta.url), "utf8");
  const entries = [...src.matchAll(/"(\d{4}-\d{2}-\d{2})": "([^"]+)"/g)].map((m) => [m[1], m[2]]);
  let bad = 0;
  const termRows = entries.filter(([, n]) => TERMS.includes(n));
  for (const [date, name] of termRows) {
    const got = termsOfYear(Number(date.slice(0, 4))).find((t) => t.name === name);
    if (got.date !== date) { bad += 1; console.log(`절기 불일치 ${name}: 표 ${date} / 계산 ${got.date} (자정까지 ${got.edge}분)`); }
  }
  for (const [date, name] of entries) {
    if (name !== "설날" && name !== "추석" && name !== "부처님오신날") continue;
    const y = lunarYear(Number(date.slice(0, 4)));
    const got = iso(name === "설날" ? y.seollal : name === "추석" ? y.chuseok : y.buddha);
    if (got !== date) { bad += 1; console.log(`음력 불일치 ${name}: 표 ${date} / 계산 ${got}`); }
  }
  console.log(`대조: 절기 ${termRows.length}건 포함, 불일치 ${bad}건`);
  return bad;
}

const bad = check();
if (process.argv.includes("--check")) process.exit(bad ? 1 : 0);
if (bad) { console.error("옛 표와 어긋나 생성을 멈춘다."); process.exit(1); }

// ── 생성 ────────────────────────────────────────────────────────────────
const mmdd = (d) => `${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const lunarLines = [];
for (let y = FIRST_YEAR; y <= LAST_YEAR; y += 1) {
  const l = lunarYear(y);
  lunarLines.push(`  ${y}: "${mmdd(l.seollal)}${mmdd(l.buddha)}${mmdd(l.chuseok)}"`);
}
const termLines = [];
const edges = [];
for (let y = TERM_FIRST_YEAR; y <= LAST_YEAR; y += 1) {
  const terms = termsOfYear(y);
  terms.forEach((t, i) => {
    if (t.month !== Math.floor(i / 2) + 1) throw new Error(`${y} ${t.name} 달이 예상과 다르다: ${t.date}`);
    if (t.edge < 30) edges.push(`${t.date} ${t.name} (자정까지 ${t.edge}분)`);
  });
  termLines.push(`  ${y}: "${terms.map((t) => pad(t.day)).join("")}"`);
}
const out = `// 자동 생성 — 손으로 고치지 않는다. 다시 만들기: node scripts/generate-calendar-tables.mjs
// 음력 명절(${FIRST_YEAR}~${LAST_YEAR}): 해마다 "설날MMDD 부처님오신날MMDD 추석MMDD" 12글자.
// 24절기(${TERM_FIRST_YEAR}~${LAST_YEAR}): 해마다 소한부터 동지까지 '일' 두 글자씩 48글자(달은 순서로 정해진다: 1월 둘, 2월 둘, …).

export const LUNAR_HOLIDAY_TABLE: Record<number, string> = {
${lunarLines.join(",\n")}
};

export const SOLAR_TERM_NAMES = ${JSON.stringify(TERMS)} as const;

export const SOLAR_TERM_TABLE: Record<number, string> = {
${termLines.join(",\n")}
};
`;
writeFileSync(new URL("../lib/calendar/calendar-tables.generated.ts", import.meta.url), out, "utf8");
console.log(`생성: 음력 ${lunarLines.length}해, 절기 ${termLines.length}해`);
console.log(`자정 30분 안쪽 절기 ${edges.length}건${edges.length ? ":\n  " + edges.join("\n  ") : ""}`);
