import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDayMark, hasFullHolidayData } from "@/lib/calendar/holidays";

// 2028년부터 빨간날을 규칙으로 계산한다. 같은 규칙을 손으로 넣은 2023~2027년 표에 돌려
// (임시공휴일·선거일 제외) 똑같이 나오는지 본다 — 규칙이 표와 어긋나면 2028년부터 달력이 틀린다.
const source = readFileSync("lib/calendar/holidays.ts", "utf8");
const handTable = [...source.matchAll(/"(\d{4}-\d{2}-\d{2})": "([^"]+)"/g)].map((m) => ({ date: m[1], name: m[2] }));

const dayMs = 86400000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dow = (date: string) => new Date(ms(date)).getUTCDay();
const holidaysOf = (year: number) => {
  const out: Record<string, string> = {};
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += dayMs) {
    const mark = getDayMark(iso(t));
    if (mark?.isHoliday) out[iso(t)] = mark.name;
  }
  return out;
};

describe("computed holidays (2028+)", () => {
  it("re-derives every hand-entered substitute holiday of 2023–2027 from the rule", () => {
    // 규칙만으로 다시 계산: 표의 설날·추석·부처님오신날 날짜 + 양력 공휴일에서 대체공휴일을 낸다.
    const fixed = ["03-01", "05-01", "05-05", "08-15", "10-03", "10-09", "12-25"];
    for (let year = 2023; year <= 2027; year += 1) {
      const rows = handTable.filter((r) => r.date.startsWith(`${year}-`));
      const names = new Map<string, number>();
      const bump = (d: string) => names.set(d, (names.get(d) ?? 0) + 1);
      const blockEnd = new Map<string, number>();
      for (const label of ["설날", "추석"]) {
        const center = ms(rows.find((r) => r.name === label)!.date);
        for (const off of [-1, 0, 1]) {
          bump(iso(center + off * dayMs));
          blockEnd.set(iso(center + off * dayMs), center + dayMs);
        }
      }
      // 2025년 부처님오신날은 어린이날(5/5)과 같은 날이라 표에 따로 없다.
      bump(rows.find((r) => r.name === "부처님오신날")?.date ?? "2025-05-05");
      for (const md of ["01-01", "06-06", ...fixed]) bump(`${year}-${md}`);
      if (year >= 2026) bump(`${year}-07-17`);
      const subs = new Set<string>();
      for (const date of [...names.keys()].sort()) {
        const end = blockEnd.get(date);
        const overlap = (names.get(date) ?? 0) > 1;
        const noSub = date.endsWith("-01-01") || date.endsWith("-06-06");
        const trigger = end !== undefined ? dow(date) === 0 || overlap : !noSub && (dow(date) === 0 || dow(date) === 6 || overlap);
        if (!trigger) continue;
        let t = (end ?? ms(date)) + dayMs;
        while ([0, 6].includes(new Date(t).getUTCDay()) || names.has(iso(t)) || subs.has(iso(t))) t += dayMs;
        subs.add(iso(t));
      }
      const expected = rows.filter((r) => r.name === "대체공휴일").map((r) => r.date);
      // 2026년부터의 제헌절 대체공휴일은 표가 아니라 기존 코드가 내므로 실제 달력에서 대조한다.
      const actual = Object.entries(holidaysOf(year)).filter(([, n]) => n === "대체공휴일").map(([d]) => d);
      expect([...subs].sort(), `${year}`).toEqual(actual.sort());
      for (const d of expected) expect(subs.has(d), `${d}`).toBe(true);
    }
  });

  it("2028: Korean Seollal is Jan 27 and Chuseok overlapping 개천절 yields one substitute day", () => {
    const h = holidaysOf(2028);
    expect(h["2028-01-26"]).toBe("설날 연휴");
    expect(h["2028-01-27"]).toBe("설날");
    expect(h["2028-01-28"]).toBe("설날 연휴");
    expect(h["2028-04-12"]).toBe("국회의원선거");
    expect(h["2028-05-02"]).toBe("부처님오신날");
    expect(h["2028-10-02"]).toBe("추석 연휴");
    expect(h["2028-10-03"]).toBe("추석");
    expect(h["2028-10-04"]).toBe("추석 연휴");
    expect(h["2028-10-05"]).toBe("대체공휴일");
    expect(Object.values(h).filter((n) => n === "대체공휴일")).toHaveLength(1);
  });

  it("2029: 어린이날 on Saturday and 설 연휴 ending on a weekday", () => {
    const h = holidaysOf(2029);
    expect(h["2029-02-13"]).toBe("설날");
    expect(h["2029-05-07"]).toBe("대체공휴일");
    expect(h["2029-09-22"]).toBe("추석");
    // 추석 연휴 9/21(금)~9/23(일) → 일요일과 겹쳐 9/24(월).
    expect(h["2029-09-24"]).toBe("대체공휴일");
  });

  it("local election moves a week when 현충일 is the day after (2018 rule), stays otherwise", () => {
    // 2030: 첫 수요일 6/5의 다음 날이 현충일이라 6/12로 밀린다.
    expect(getDayMark("2030-06-12")?.name).toBe("지방선거");
    expect(getDayMark("2030-06-05")?.isHoliday).not.toBe(true);
    expect(getDayMark("2034-05-31")?.name).toBe("지방선거");
    expect(getDayMark("2032-04-14")?.name).toBe("국회의원선거");
  });

  it("keeps every year red for Seollal and Chuseok through 2100", () => {
    for (let year = 2028; year <= 2100; year += 1) {
      const names = Object.values(holidaysOf(year));
      expect(names.filter((n) => n === "설날"), `${year}`).toHaveLength(1);
      expect(names.filter((n) => n === "추석"), `${year}`).toHaveLength(1);
      expect(hasFullHolidayData(year)).toBe(true);
    }
    expect(hasFullHolidayData(2101)).toBe(false);
    expect(hasFullHolidayData(2022)).toBe(false);
  });
});

describe("computed seasonal marks", () => {
  it("삼복 matches the hand-entered 2026 dates and exists every later year", () => {
    expect(getDayMark("2026-07-15")?.name).toBe("🍗 초복");
    expect(getDayMark("2026-07-25")?.name).toBe("🍗 중복");
    expect(getDayMark("2026-08-14")?.name).toBe("🍗 말복");
    // 공개 자료의 2027·2028년 복날.
    expect(getDayMark("2027-07-20")?.name).toBe("🍗 초복");
    expect(getDayMark("2027-07-30")?.name).toBe("🍗 중복");
    expect(getDayMark("2027-08-09")?.name).toBe("🍗 말복");
    for (let year = 2027; year <= 2100; year += 1) {
      let count = 0;
      for (let t = Date.UTC(year, 6, 1); t < Date.UTC(year, 8, 1); t += dayMs) if (getDayMark(iso(t))?.name.startsWith("🍗")) count += 1;
      // 복날이 공휴일(제헌절·광복절)이나 데뷔 D+ 기념일과 겹치면 그 이름이 먼저 보인다.
      expect(count, `${year}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("정월대보름 is Seollal + 14 days", () => {
    expect(getDayMark("2026-03-03")?.name).toBe("🌕 정월대보름");
    expect(getDayMark("2027-02-21")?.name).toBe("🌕 정월대보름");
    expect(getDayMark("2027-02-20")?.name).not.toBe("🌕 정월대보름");
    expect(getDayMark("2028-02-10")?.name).toBe("🌕 정월대보름");
    expect(getDayMark("2040-02-26")?.name).toBe("🌕 정월대보름");
  });

  it("24절기 continue past the hand table (2032+)", () => {
    expect(getDayMark("2031-12-22")?.name).toBe("동지");
    expect(getDayMark("2032-02-04")?.name).toBe("입춘");
    expect(getDayMark("2032-12-21")?.name).toBe("동지");
    for (let year = 2032; year <= 2100; year += 1) {
      let count = 0;
      const terms = ["소한", "대한", "입춘", "우수", "경칩", "춘분", "청명", "곡우", "입하", "소만", "망종", "하지", "소서", "대서", "입추", "처서", "백로", "추분", "한로", "상강", "입동", "소설", "대설", "동지"];
      for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += dayMs) {
        const name = getDayMark(iso(t))?.name;
        if (name && terms.includes(name)) count += 1;
      }
      // 절기가 공휴일·기념일·복날에 가려지는 날이 있어 24보다 적을 수 있다(예: 입춘=설 연휴).
      expect(count, `${year}`).toBeGreaterThanOrEqual(18);
    }
  });
});
