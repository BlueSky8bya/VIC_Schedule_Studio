// 한국 공휴일/대체공휴일/절기/기념일 표기 데이터.
// 2027년까지의 빨간날은 손으로 넣은 표(HOLIDAYS_YEARLY, 임시공휴일·선거일 포함),
// 2028년부터는 사람이 해마다 채우지 않아도 되게 규칙으로 계산한다(2026-11-22):
//  - 음력 명절(설날·부처님오신날·추석)과 24절기(2032~)는 calendar-tables.generated.ts(2100년까지),
//  - 대체공휴일은 「관공서의 공휴일에 관한 규정」 규칙, 국회의원선거·지방선거는 공직선거법 날짜 규칙,
//  - 삼복·정월대보름은 절기·설날에서 계산.
// 정부가 그 해에만 정하는 임시공휴일과 규칙이 바뀐 뒤의 날짜는 계산으로 알 수 없다(그때만 표에 더한다).
import { LUNAR_HOLIDAY_TABLE, SOLAR_TERM_NAMES, SOLAR_TERM_TABLE } from "./calendar-tables.generated";

export type DayMark = {
  name: string; // 헤더(날짜숫자 옆) 표기 — 공휴일/절기/복날/기념일
  isHoliday: boolean; // true면 빨간날(공휴일/대체공휴일), false면 단순 표기(기념일/절기)
};
// (월드컵 단계/경기 표기(MarkKind·match·withoutWorldCupMark)는 2026-08-27 월드컵 기능 삭제로 제거 —
//  ADR-0009 Superseded.)

// 매년 고정(양력) 공휴일 — 빨간날
const HOLIDAYS_FIXED: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-01": "근로자의 날",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절"
};

// 특정 연도부터 매년 고정(양력) 공휴일 — 빨간날.
// 제헌절은 2008년 공휴일에서 제외됐다가 2026년부터 재지정되어, fromYear 이전엔 빨간날이 아니다.
const HOLIDAYS_FIXED_FROM: Record<string, { name: string; fromYear: number }> = {
  "07-17": { name: "제헌절", fromYear: 2026 }
};

// 연도별 음력 공휴일 + 대체공휴일 + 임시공휴일 + 선거일 — 모두 빨간날.
// (양력 고정 공휴일은 HOLIDAYS_FIXED, 제헌절·그 대체공휴일은 HOLIDAYS_FIXED_FROM이 자동 처리.)
// 선거일은 「관공서의 공휴일에 관한 규정」상 공휴일이고, 임시공휴일은 정부가 그 해에만 지정한 날.
const HOLIDAYS_YEARLY: Record<string, string> = {
  // 2023
  "2023-01-21": "설날 연휴",
  "2023-01-22": "설날",
  "2023-01-23": "설날 연휴",
  "2023-01-24": "대체공휴일",
  "2023-05-27": "부처님오신날",
  "2023-05-29": "대체공휴일",
  "2023-09-28": "추석 연휴",
  "2023-09-29": "추석",
  "2023-09-30": "추석 연휴",
  "2023-10-02": "임시공휴일",
  // 2024
  "2024-02-09": "설날 연휴",
  "2024-02-10": "설날",
  "2024-02-11": "설날 연휴",
  "2024-02-12": "대체공휴일",
  "2024-04-10": "국회의원선거",
  "2024-05-06": "대체공휴일",
  "2024-05-15": "부처님오신날",
  "2024-09-16": "추석 연휴",
  "2024-09-17": "추석",
  "2024-09-18": "추석 연휴",
  // 2025
  "2025-01-27": "임시공휴일",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-03": "대체공휴일",
  "2025-05-06": "대체공휴일",
  "2025-06-03": "대통령선거",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "대체공휴일",
  // 2026
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-02": "대체공휴일",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-03": "지방선거",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-05": "대체공휴일",
  // 2027
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "대체공휴일",
  "2027-05-03": "대체공휴일",
  "2027-05-13": "부처님오신날",
  "2027-08-16": "대체공휴일",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-04": "대체공휴일",
  "2027-10-11": "대체공휴일",
  "2027-12-27": "대체공휴일"
};

// 매년 고정 기념일 — 표기만(빨간날 아님)
const MARKS_FIXED: Record<string, string> = {
  "02-14": "발렌타인데이",
  "03-14": "화이트데이",
  "04-01": "만우절",
  "04-05": "식목일",
  "05-08": "어버이날",
  "05-15": "스승의 날",
  "10-31": "할로윈",
  "11-11": "빼빼로데이",
  "12-24": "크리스마스이브"
};

// 삼복(초복·중복·말복) — 표기만(빨간날 아님). 하지/입추 기준 경일(庚日)이라 매년 날짜가 달라
// 연도별 전체 날짜로 넣는다(24절기 MARKS_YEARLY와 같은 방식). 삼계탕 먹는 복날, 시청자와 공유.
// 2026: 월복(중복7/25~말복8/14 20일)이라 삼복더위가 길다. (초복 7/15는 그해 월드컵 4강과 겹쳐
// 우선순위상 4강이 표시된다 — 삼복은 다른 해엔 그대로 뜬다.)
// → 해마다 넣지 않고 sambokMark()가 절기에서 계산한다(2026년 값 7/15·7/25·8/14와 일치 확인).
// 정월대보름(음력 1/15, 오곡밥·부럼)도 daeboreumMark()가 설날+14일로 계산한다.

// 스트리머 데뷔일(이 날부터 D+ 기록)
const DEBUT_ISO = "2025-10-01";

function daysSinceDebut(isoDate: string): number {
  const [y1, m1, d1] = DEBUT_ISO.split("-").map(Number);
  const [y2, m2, d2] = isoDate.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// 정보 카드의 해설 줄용 — 데뷔 날짜 "2025.10.01"(2026-09-17 소유자: D+ 옆에 같은 숫자를 되풀이하지 않는다).
export function debutDateLabel(): string {
  return DEBUT_ISO.replaceAll("-", ".");
}

// 시청자 레일 정보 카드용 — 오늘의 D+ 값(데뷔일=D+1). 데뷔 전이면 null.
export function debutDPlus(isoDate: string): number | null {
  const days = daysSinceDebut(isoDate);
  return days < 0 ? null : days + 1;
}

// 스트리머(빅토리) 기념일 — 매년 같은 양력 날짜에 표기.
const STREAMER_ANNUAL: Record<string, (isoDate: string) => string | null> = {
  "02-19": () => "🎂 토리님 생일"
};

// 데뷔 표기: 데뷔 당일, 매년 데뷔일(10/1)은 "N년차", 그 외 100일 단위는 "D+".
// 데뷔 이전(음수)엔 표기하지 않는다. 데뷔일 = D+1 기준.
function debutMark(isoDate: string): string | null {
  const days = daysSinceDebut(isoDate);
  if (days < 0) {
    return null;
  }
  if (days === 0) {
    return "🎉 스트리머 데뷔"; // 데뷔 당일(= 1년차 시작, D+1)
  }
  // 매년 데뷔일(10/1)은 N주년으로 표기 (2026=1주년)
  if (isoDate.slice(5) === "10-01") {
    return `🎉 데뷔 ${Number(isoDate.slice(0, 4)) - 2025}주년`;
  }
  // 그 외에는 100일 단위 D+ 마일스톤 (데뷔일 D+1 기준)
  const dplus = days + 1;
  if (dplus % 100 === 0) {
    return `🎉 데뷔 D+${dplus}`;
  }
  return null;
}

// 스트리머 기념일 — 그 해 그 날짜에만 한 번 표기(과거 기록).
const STREAMER_ONCE: Record<string, string> = {
  "2023-05-08": "아카데미 인턴 합격",
  "2023-05-24": "🎈 첫 방송일",
  "2023-07-10": "아카데미 합격",
  "2024-06-30": "사이다뱅/아바타 공개"
};

// 연도별 24절기 — 표기만(빨간날 아님). 천문 계산(태양 황경)으로 KST 날짜 산출, 2023~2031.
const MARKS_YEARLY: Record<string, string> = {
  // 2023
  "2023-01-05": "소한",
  "2023-01-20": "대한",
  "2023-02-04": "입춘",
  "2023-02-19": "우수",
  "2023-03-06": "경칩",
  "2023-03-21": "춘분",
  "2023-04-05": "청명",
  "2023-04-20": "곡우",
  "2023-05-06": "입하",
  "2023-05-21": "소만",
  "2023-06-06": "망종",
  "2023-06-22": "하지",
  "2023-07-07": "소서",
  "2023-07-23": "대서",
  "2023-08-08": "입추",
  "2023-08-23": "처서",
  "2023-09-08": "백로",
  "2023-09-23": "추분",
  "2023-10-08": "한로",
  "2023-10-24": "상강",
  "2023-11-08": "입동",
  "2023-11-22": "소설",
  "2023-12-07": "대설",
  "2023-12-22": "동지",
  // 2024
  "2024-01-06": "소한",
  "2024-01-20": "대한",
  "2024-02-04": "입춘",
  "2024-02-19": "우수",
  "2024-03-05": "경칩",
  "2024-03-20": "춘분",
  "2024-04-04": "청명",
  "2024-04-19": "곡우",
  "2024-05-05": "입하",
  "2024-05-20": "소만",
  "2024-06-05": "망종",
  "2024-06-21": "하지",
  "2024-07-06": "소서",
  "2024-07-22": "대서",
  "2024-08-07": "입추",
  "2024-08-22": "처서",
  "2024-09-07": "백로",
  "2024-09-22": "추분",
  "2024-10-08": "한로",
  "2024-10-23": "상강",
  "2024-11-07": "입동",
  "2024-11-22": "소설",
  "2024-12-07": "대설",
  "2024-12-21": "동지",
  // 2025
  "2025-01-05": "소한",
  "2025-01-20": "대한",
  "2025-02-03": "입춘",
  "2025-02-18": "우수",
  "2025-03-05": "경칩",
  "2025-03-20": "춘분",
  "2025-04-04": "청명",
  "2025-04-20": "곡우",
  "2025-05-05": "입하",
  "2025-05-21": "소만",
  "2025-06-05": "망종",
  "2025-06-21": "하지",
  "2025-07-07": "소서",
  "2025-07-22": "대서",
  "2025-08-07": "입추",
  "2025-08-23": "처서",
  "2025-09-07": "백로",
  "2025-09-23": "추분",
  "2025-10-08": "한로",
  "2025-10-23": "상강",
  "2025-11-07": "입동",
  "2025-11-22": "소설",
  "2025-12-07": "대설",
  "2025-12-22": "동지",
  // 2026
  "2026-01-05": "소한",
  "2026-01-20": "대한",
  "2026-02-04": "입춘",
  "2026-02-19": "우수",
  "2026-03-05": "경칩",
  "2026-03-20": "춘분",
  "2026-04-05": "청명",
  "2026-04-20": "곡우",
  "2026-05-05": "입하",
  "2026-05-21": "소만",
  "2026-06-06": "망종",
  "2026-06-21": "하지",
  "2026-07-07": "소서",
  "2026-07-23": "대서",
  "2026-08-07": "입추",
  "2026-08-23": "처서",
  "2026-09-07": "백로",
  "2026-09-23": "추분",
  "2026-10-08": "한로",
  "2026-10-23": "상강",
  "2026-11-07": "입동",
  "2026-11-22": "소설",
  "2026-12-07": "대설",
  "2026-12-22": "동지",
  // 2027
  "2027-01-05": "소한",
  "2027-01-20": "대한",
  "2027-02-04": "입춘",
  "2027-02-19": "우수",
  "2027-03-06": "경칩",
  "2027-03-21": "춘분",
  "2027-04-05": "청명",
  "2027-04-20": "곡우",
  "2027-05-06": "입하",
  "2027-05-21": "소만",
  "2027-06-06": "망종",
  "2027-06-21": "하지",
  "2027-07-07": "소서",
  "2027-07-23": "대서",
  "2027-08-08": "입추",
  "2027-08-23": "처서",
  "2027-09-08": "백로",
  "2027-09-23": "추분",
  "2027-10-08": "한로",
  "2027-10-24": "상강",
  "2027-11-08": "입동",
  "2027-11-22": "소설",
  "2027-12-07": "대설",
  "2027-12-22": "동지",
  // 2028
  "2028-01-06": "소한",
  "2028-01-20": "대한",
  "2028-02-04": "입춘",
  "2028-02-19": "우수",
  "2028-03-05": "경칩",
  "2028-03-20": "춘분",
  "2028-04-04": "청명",
  "2028-04-19": "곡우",
  "2028-05-05": "입하",
  "2028-05-20": "소만",
  "2028-06-05": "망종",
  "2028-06-21": "하지",
  "2028-07-06": "소서",
  "2028-07-22": "대서",
  "2028-08-07": "입추",
  "2028-08-22": "처서",
  "2028-09-07": "백로",
  "2028-09-22": "추분",
  "2028-10-08": "한로",
  "2028-10-23": "상강",
  "2028-11-07": "입동",
  "2028-11-22": "소설",
  "2028-12-06": "대설",
  "2028-12-21": "동지",
  // 2029
  "2029-01-05": "소한",
  "2029-01-20": "대한",
  "2029-02-03": "입춘",
  "2029-02-18": "우수",
  "2029-03-05": "경칩",
  "2029-03-20": "춘분",
  "2029-04-04": "청명",
  "2029-04-20": "곡우",
  "2029-05-05": "입하",
  "2029-05-21": "소만",
  "2029-06-05": "망종",
  "2029-06-21": "하지",
  "2029-07-07": "소서",
  "2029-07-22": "대서",
  "2029-08-07": "입추",
  "2029-08-23": "처서",
  "2029-09-07": "백로",
  "2029-09-23": "추분",
  "2029-10-08": "한로",
  "2029-10-23": "상강",
  "2029-11-07": "입동",
  "2029-11-22": "소설",
  "2029-12-07": "대설",
  "2029-12-21": "동지",
  // 2030
  "2030-01-05": "소한",
  "2030-01-20": "대한",
  "2030-02-04": "입춘",
  "2030-02-18": "우수",
  "2030-03-05": "경칩",
  "2030-03-20": "춘분",
  "2030-04-05": "청명",
  "2030-04-20": "곡우",
  "2030-05-05": "입하",
  "2030-05-21": "소만",
  "2030-06-05": "망종",
  "2030-06-21": "하지",
  "2030-07-07": "소서",
  "2030-07-23": "대서",
  "2030-08-07": "입추",
  "2030-08-23": "처서",
  "2030-09-07": "백로",
  "2030-09-23": "추분",
  "2030-10-08": "한로",
  "2030-10-23": "상강",
  "2030-11-07": "입동",
  "2030-11-22": "소설",
  "2030-12-07": "대설",
  "2030-12-22": "동지",
  // 2031
  "2031-01-05": "소한",
  "2031-01-20": "대한",
  "2031-02-04": "입춘",
  "2031-02-19": "우수",
  "2031-03-06": "경칩",
  "2031-03-21": "춘분",
  "2031-04-05": "청명",
  "2031-04-20": "곡우",
  "2031-05-06": "입하",
  "2031-05-21": "소만",
  "2031-06-06": "망종",
  "2031-06-21": "하지",
  "2031-07-07": "소서",
  "2031-07-23": "대서",
  "2031-08-08": "입추",
  "2031-08-23": "처서",
  "2031-09-08": "백로",
  "2031-09-23": "추분",
  "2031-10-08": "한로",
  "2031-10-23": "상강",
  "2031-11-07": "입동",
  "2031-11-22": "소설",
  "2031-12-07": "대설",
  "2031-12-22": "동지"
};

// ── 2028년부터: 규칙 계산 ─────────────────────────────────────────────────
const COMPUTED_FROM_YEAR = 2028;
const DAY_MS = 86400000;
const pad2 = (n: number) => String(n).padStart(2, "0");
const utcOf = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const isoOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const dowOf = (ms: number) => new Date(ms).getUTCDay();

// 그 해 설날·부처님오신날·추석(없으면 null). 2027년까지는 손 표에서, 그 뒤는 생성 표에서.
function lunarDays(year: number): { seollal: string; buddha: string; chuseok: string } | null {
  const row = LUNAR_HOLIDAY_TABLE[year];
  if (row) {
    const at = (i: number) => `${year}-${row.slice(i, i + 2)}-${row.slice(i + 2, i + 4)}`;
    return { seollal: at(0), buddha: at(4), chuseok: at(8) };
  }
  const find = (name: string) => Object.keys(HOLIDAYS_YEARLY).find((k) => k.startsWith(`${year}-`) && HOLIDAYS_YEARLY[k] === name);
  const seollal = find("설날");
  const buddha = find("부처님오신날");
  const chuseok = find("추석");
  return seollal && buddha && chuseok ? { seollal, buddha, chuseok } : null;
}

// 그 해 절기 이름 → 날짜. 2031년까지는 손 표(MARKS_YEARLY), 그 뒤는 생성 표.
const termCache = new Map<number, Map<string, string>>();
function solarTerms(year: number): Map<string, string> {
  const hit = termCache.get(year);
  if (hit) return hit;
  const out = new Map<string, string>();
  const row = SOLAR_TERM_TABLE[year];
  if (row) {
    SOLAR_TERM_NAMES.forEach((name, i) => out.set(name, `${year}-${pad2(Math.floor(i / 2) + 1)}-${row.slice(i * 2, i * 2 + 2)}`));
  } else {
    for (const [date, name] of Object.entries(MARKS_YEARLY)) if (date.startsWith(`${year}-`)) out.set(name, date);
  }
  termCache.set(year, out);
  return out;
}

function solarTermMark(isoDate: string): string | null {
  if (MARKS_YEARLY[isoDate]) return MARKS_YEARLY[isoDate];
  const year = Number(isoDate.slice(0, 4));
  if (!SOLAR_TERM_TABLE[year]) return null;
  for (const [name, date] of solarTerms(year)) if (date === isoDate) return name;
  return null;
}

// 삼복: 초복 = 하지부터 셋째 경일(庚日), 중복 = 넷째 경일, 말복 = 입추부터 첫 경일. 경일은 10일마다 온다.
const GYEONG_DAY_REF = Date.UTC(2026, 6, 15); // 2026-07-15 = 경일(그해 초복)
function gyeongOnOrAfter(ms: number): number {
  const off = (((ms - GYEONG_DAY_REF) / DAY_MS) % 10 + 10) % 10;
  return off === 0 ? ms : ms + (10 - off) * DAY_MS;
}
function sambokMark(isoDate: string): string | null {
  const md = isoDate.slice(5);
  if (md < "07-01" || md > "08-31") return null;
  const terms = solarTerms(Number(isoDate.slice(0, 4)));
  const haji = terms.get("하지");
  const ipchu = terms.get("입추");
  if (!haji || !ipchu) return null;
  const chobok = gyeongOnOrAfter(utcOf(haji)) + 20 * DAY_MS;
  const ms = utcOf(isoDate);
  if (ms === chobok) return "🍗 초복";
  if (ms === chobok + 10 * DAY_MS) return "🍗 중복";
  if (ms === gyeongOnOrAfter(utcOf(ipchu))) return "🍗 말복";
  return null;
}

function daeboreumMark(isoDate: string): string | null {
  const md = isoDate.slice(5);
  if (md < "02-01" || md > "03-10") return null;
  const lunar = lunarDays(Number(isoDate.slice(0, 4)));
  return lunar && utcOf(lunar.seollal) + 14 * DAY_MS === utcOf(isoDate) ? "🌕 정월대보름" : null;
}

// 대체공휴일이 없는 양력 공휴일(규정 제3조): 신정·현충일.
const NO_SUBSTITUTE = new Set(["01-01", "06-06"]);

// 선거일(공직선거법 제34조): 기준일 이후 첫 수요일. 그날이나 앞뒤 날이 공휴일이면 그다음 주 수요일.
function electionDay(year: number, month: number, day: number, isHoliday: (ms: number) => boolean): string {
  let ms = Date.UTC(year, month - 1, day);
  while (dowOf(ms) !== 3) ms += DAY_MS;
  if (isHoliday(ms) || isHoliday(ms - DAY_MS) || isHoliday(ms + DAY_MS)) ms += 7 * DAY_MS;
  return isoOf(ms);
}

const computedCache = new Map<number, Map<string, string>>();
// 2028년 이후 그 해의 빨간날 전부(양력 고정 포함) — 날짜 → 이름.
function computedHolidays(year: number): Map<string, string> {
  const hit = computedCache.get(year);
  if (hit) return hit;
  const names = new Map<string, string[]>(); // 날짜 → 그날 겹친 공휴일 이름들
  const add = (date: string, name: string) => names.set(date, [...(names.get(date) ?? []), name]);
  const blockEnd = new Map<string, number>(); // 설·추석 연휴 날짜 → 연휴 마지막 날
  const lunar = lunarDays(year);
  if (lunar) {
    for (const [center, label] of [[lunar.seollal, "설날"], [lunar.chuseok, "추석"]] as const) {
      const c = utcOf(center);
      for (const off of [-1, 0, 1]) {
        const date = isoOf(c + off * DAY_MS);
        add(date, off === 0 ? label : `${label} 연휴`);
        blockEnd.set(date, c + DAY_MS);
      }
    }
    add(lunar.buddha, "부처님오신날");
  }
  for (const [md, name] of Object.entries(HOLIDAYS_FIXED)) add(`${year}-${md}`, name);
  for (const [md, info] of Object.entries(HOLIDAYS_FIXED_FROM)) if (year >= info.fromYear) add(`${year}-${md}`, info.name);

  const isBase = (ms: number) => names.has(isoOf(ms));
  const out = new Map<string, string>();
  for (const [date, list] of names) out.set(date, list[0]);
  // 대체공휴일: 설·추석 연휴는 일요일·다른 공휴일과 겹칠 때, 그 밖(신정·현충일 제외)은 토·일·다른 공휴일과 겹칠 때
  // 그 공휴일(연휴) 다음의 첫 번째 비공휴일. 같은 날 겹친 것은 하루만 준다.
  const taken = (ms: number) => dowOf(ms) === 0 || dowOf(ms) === 6 || out.has(isoOf(ms));
  for (const date of [...names.keys()].sort()) {
    const ms = utcOf(date);
    const dow = dowOf(ms);
    const overlap = (names.get(date)?.length ?? 0) > 1;
    const end = blockEnd.get(date);
    const trigger = end !== undefined
      ? dow === 0 || overlap
      : !NO_SUBSTITUTE.has(date.slice(5)) && (dow === 0 || dow === 6 || overlap);
    if (!trigger) continue;
    let sub = (end ?? ms) + DAY_MS;
    while (taken(sub)) sub += DAY_MS;
    out.set(isoOf(sub), "대체공휴일");
  }
  // 선거일 — 임기가 4년으로 고정된 국회의원선거(임기만료 5/29의 50일 전 = 4/9)·지방선거(6/30의 30일 전 = 5/31).
  // 대통령선거는 임기 중 변동(궐위)이 잦아 규칙으로 두지 않는다.
  if (year % 4 === 0) out.set(electionDay(year, 4, 9, isBase), "국회의원선거");
  if (year % 4 === 2) out.set(electionDay(year, 5, 31, isBase), "지방선거");
  computedCache.set(year, out);
  return out;
}

// 이 연도의 빨간날(음력 명절·대체공휴일)을 알고 있는가 — 모르는 해는 화면이 '일부만 제공'이라고 알린다.
export function hasFullHolidayData(year: number): boolean {
  return year >= 2023 && (year < COMPUTED_FROM_YEAR || Boolean(LUNAR_HOLIDAY_TABLE[year]));
}

// HOLIDAYS_FIXED_FROM 공휴일이 토/일과 겹칠 때의 대체공휴일(다음 월요일)인지 검사.
// 대체공휴일은 월요일에만 생기므로, 해당 월요일 직전의 토(2일 전)·일(1일 전)이
// 적용 연도의 고정 공휴일이면 이 날을 대체공휴일로 본다.
function substituteFixedFromHoliday(isoDate: string): string | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  if (day.getUTCDay() !== 1) {
    return null; // 월요일이 아니면 대체공휴일 아님
  }
  for (const back of [1, 2]) {
    const prev = new Date(Date.UTC(y, m - 1, d - back));
    const pdow = prev.getUTCDay();
    if (pdow !== 0 && pdow !== 6) {
      continue; // 일(1일 전) 또는 토(2일 전)만
    }
    const pmd = `${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
    const info = HOLIDAYS_FIXED_FROM[pmd];
    if (info && prev.getUTCFullYear() >= info.fromYear) {
      return "대체공휴일";
    }
  }
  return null;
}

// 헤더(날짜숫자 옆)에 뜰 마크 — 우선순위 순. 월드컵 '경기'(스코어 있는 날)는 여기서 제외하고
// 칸 본문 칩으로 따로 낸다(아래 getDayMark). 단, 월드컵 '단계표기'(개막/32강/…)는 헤더에 남긴다.
export function getDayMark(isoDate: string): DayMark | null {
  const md = isoDate.slice(5);
  const year = Number(isoDate.slice(0, 4));

  if (HOLIDAYS_YEARLY[isoDate]) return { name: HOLIDAYS_YEARLY[isoDate], isHoliday: true };
  if (year >= COMPUTED_FROM_YEAR) {
    const computed = computedHolidays(year).get(isoDate);
    if (computed) return { name: computed, isHoliday: true };
  }
  if (HOLIDAYS_FIXED[md]) return { name: HOLIDAYS_FIXED[md], isHoliday: true };
  const fixedFrom = HOLIDAYS_FIXED_FROM[md];
  if (fixedFrom && Number(isoDate.slice(0, 4)) >= fixedFrom.fromYear) {
    return { name: fixedFrom.name, isHoliday: true };
  }
  const sub = substituteFixedFromHoliday(isoDate);
  if (sub) return { name: sub, isHoliday: true };
  if (STREAMER_ONCE[isoDate]) return { name: STREAMER_ONCE[isoDate], isHoliday: false };
  const annual = STREAMER_ANNUAL[md];
  if (annual) {
    const name = annual(isoDate);
    if (name) return { name, isHoliday: false };
  }
  const debut = debutMark(isoDate);
  if (debut) return { name: debut, isHoliday: false };
  const daeboreum = daeboreumMark(isoDate);
  if (daeboreum) return { name: daeboreum, isHoliday: false };
  const sambok = sambokMark(isoDate);
  if (sambok) return { name: sambok, isHoliday: false };
  const term = solarTermMark(isoDate);
  if (term) return { name: term, isHoliday: false };
  if (MARKS_FIXED[md]) return { name: MARKS_FIXED[md], isHoliday: false };
  return null;
}

