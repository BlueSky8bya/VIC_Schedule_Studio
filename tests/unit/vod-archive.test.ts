import { describe, expect, it } from "vitest";
import {
  attributeBroadcastDay,
  chainBroadcastDays,
  kstStringToIso,
  mapApiItem,
  parseThumbRowKey,
  type VodArchiveRow
} from "@/lib/broadcast/vod-archive";

// 다시보기 아카이브(0068) 파싱 규칙 — 시청자 화면의 '날짜 → 다시보기' 매핑이 여기서 갈린다.
// rowKey의 날짜(방송 시작일 KST)가 1순위 귀속 근거다: reg_date(≈뱅종)만 쓰면 새벽까지 이어진
// 방송이 '다음 날'로 붙는다(실측: 08-30 시작 방송의 reg_date가 08-31 03:52).

describe("parseThumbRowKey", () => {
  it("실제 thumb에서 날짜와 bno를 뽑는다", () => {
    const thumb =
      "//videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20260830_304937F2_296752157_2_r";
    expect(parseThumbRowKey(thumb)).toEqual({ day: "2026-08-30", bno: "296752157" });
  });
  it("쿼리 꼬리(&column=...)가 붙어도 동일", () => {
    const thumb =
      "//videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20260829_0A277D6A_296727223_1_r&column=2&t=1788067561";
    expect(parseThumbRowKey(thumb)).toEqual({ day: "2026-08-29", bno: "296727223" });
  });
  it("형식이 다르거나 없으면 null", () => {
    expect(parseThumbRowKey(undefined)).toBeNull();
    expect(parseThumbRowKey("https://example.com/x.jpg")).toBeNull();
  });
});

describe("kstStringToIso", () => {
  it("KST 문자열을 UTC ISO로", () => {
    expect(kstStringToIso("2026-08-31 03:52:13")).toBe("2026-08-30T18:52:13.000Z");
  });
  it("깨진 값은 null", () => {
    expect(kstStringToIso("어제쯤")).toBeNull();
    expect(kstStringToIso(null)).toBeNull();
  });
});

describe("attributeBroadcastDay — 방송 '시작일' 귀속(방송일 경계 = 새벽 6시 KST)", () => {
  it("rowKey가 실측 시작 날짜와 다르면 rowKey가 정답(SOOP이 이미 세션 기준으로 준 값)", () => {
    // 실측 사례: 8/25 01:17 시작 VOD의 rowKey가 8/24 — 그대로 믿는다.
    expect(attributeBroadcastDay("2026-08-24", "2026-08-24T19:03:00.000Z", 166 * 60_000)).toBe(
      "2026-08-24"
    );
    expect(attributeBroadcastDay("2026-08-30", "2026-08-30T18:52:13.000Z", 1)).toBe("2026-08-30");
  });
  it("새벽(6시 이전) 시작은 전날로 — 1/6 00:03 별별랭킹은 1/5 밤 방송(실측 사례)", () => {
    // 뱅종 1/6 02:38 KST, 길이 155분 → 시작 1/6 00:03 KST. rowKey는 달력 그대로 1/6이었다.
    expect(attributeBroadcastDay("2026-01-06", "2026-01-05T17:38:00.000Z", 155 * 60_000)).toBe(
      "2026-01-05"
    );
  });
  it("6시 정각 시작은 그 날, 5:59는 전날(경계)", () => {
    // 시작 06:00 KST = 21:00Z 전날. 길이 60분 → 뱅종 07:00 KST.
    expect(attributeBroadcastDay("2026-01-06", "2026-01-05T22:00:00.000Z", 60 * 60_000)).toBe(
      "2026-01-06"
    );
    expect(attributeBroadcastDay("2026-01-06", "2026-01-05T21:59:00.000Z", 60 * 60_000)).toBe(
      "2026-01-05"
    );
  });
  it("rowKey가 없으면 등록시각-길이 + 6시 경계 — 자정 넘긴 방송이 시작한 날로 붙는다", () => {
    // 뱅종(등록) 08-31 03:52 KST, 길이 10.9시간 → 시작 08-30 16:59 KST
    expect(attributeBroadcastDay(null, "2026-08-30T18:52:13.000Z", 39135834)).toBe("2026-08-30");
    // 뱅종 08-31 02:00 KST, 길이 1시간 → 시작 08-31 01:00 KST(새벽) → 08-30
    expect(attributeBroadcastDay(null, "2026-08-30T17:00:00.000Z", 3600_000)).toBe("2026-08-30");
  });
  it("둘 다 없으면 null(귀속 불가 행은 버린다)", () => {
    expect(attributeBroadcastDay(null, null, 0)).toBeNull();
  });
});

describe("mapApiItem", () => {
  const item = {
    title_no: 205801207,
    title_name: "라이츄후열~",
    reg_date: "2026-08-31 03:52:13",
    auth_no: 101,
    ucc: {
      thumb: "//videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20260830_304937F2_296752157_2_r",
      total_file_duration: 39135834
    },
    count: { comment_cnt: 3, like_cnt: 10, read_cnt: 9972 }
  };
  it("실제 응답 한 건을 저장 행으로", () => {
    expect(mapApiItem(item)).toEqual({
      titleNo: 205801207,
      bno: "296752157",
      broadcastDay: "2026-08-30",
      title: "라이츄후열~",
      durationMs: 39135834,
      regDate: "2026-08-30T18:52:13.000Z",
      commentCnt: 3,
      likeCnt: 10,
      readCnt: 9972,
      authNo: 101,
      thumb: "//videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=20260830_304937F2_296752157_2_r"
    });
  });
  it("구독(플러스) 전용은 auth_no=107로 남고, 값이 없으면 0(미상 — 공개 칩에서 자동 제외)", () => {
    expect(mapApiItem({ ...item, auth_no: 107 })?.authNo).toBe(107);
    expect(mapApiItem({ ...item, auth_no: undefined })?.authNo).toBe(0);
  });
  it("title_no가 없으면 버린다", () => {
    expect(mapApiItem({ ...item, title_no: undefined })).toBeNull();
  });
  it("날짜 귀속이 안 되면 버린다", () => {
    expect(mapApiItem({ ...item, reg_date: undefined, ucc: { total_file_duration: 1000 } })).toBeNull();
  });
});

// 30분 체인(2026-08-31 사용자 결정) — 방송이 터져 자정 넘어 재시작해도(새 bno·새 VOD)
// 직전 종료와 30분 이내면 같은 방송: 앞 방송의 날짜를 잇는다. 실사례 04-13 밤 방송 →
// 04-14 00시 "방송터짐!!!" + 재시작이 사람 감각으론 전부 13일 밤 방송.
describe("chainBroadcastDays — 30분 이내 재시작은 같은 방송", () => {
  const row = (titleNo: number, day: string, endIsoUtc: string, durMin: number): VodArchiveRow => ({
    titleNo,
    bno: String(titleNo),
    broadcastDay: day,
    title: "",
    durationMs: durMin * 60_000,
    regDate: endIsoUtc,
    commentCnt: 0,
    likeCnt: 0,
    readCnt: 0,
    authNo: 101,
    thumb: ""
  });

  it("자정 넘은 재시작(간격 10분)이 앞 방송 날짜를 잇는다 — 이행적", () => {
    // 13일 21시(KST)~14일 00:10 방송 → 00:20 터짐 21분 → 00:45 재시작 4시간
    const a = row(1, "2026-04-13", "2026-04-13T15:10:00.000Z", 190); // 종료 00:10 KST
    const b = row(2, "2026-04-14", "2026-04-13T15:41:00.000Z", 21); // 시작 00:20, 종료 00:41
    const c = row(3, "2026-04-14", "2026-04-13T19:45:00.000Z", 240); // 시작 00:45
    const changed = chainBroadcastDays([a, b, c]);
    expect(changed).toBe(2);
    expect(b.broadcastDay).toBe("2026-04-13");
    expect(c.broadcastDay).toBe("2026-04-13");
  });

  it("간격이 30분을 넘으면 새 방송 — 제 날짜 유지", () => {
    const a = row(1, "2026-04-13", "2026-04-13T15:00:00.000Z", 120);
    const b = row(2, "2026-04-14", "2026-04-14T10:00:00.000Z", 60);
    expect(chainBroadcastDays([a, b])).toBe(0);
    expect(b.broadcastDay).toBe("2026-04-14");
  });

  it("겹침(음수 간격)도 같은 방송으로 잇는다", () => {
    const a = row(1, "2026-04-13", "2026-04-13T15:10:00.000Z", 190);
    const b = row(2, "2026-04-14", "2026-04-13T16:00:00.000Z", 55); // 시작이 a 종료보다 5분 이전
    expect(chainBroadcastDays([a, b])).toBe(1);
    expect(b.broadcastDay).toBe("2026-04-13");
  });

  it("regDate 없는 행은 체인을 끊는다(보수적) + 이미 같은 날이면 변경 0", () => {
    const a = row(1, "2026-04-13", "2026-04-13T15:10:00.000Z", 190);
    const noReg = { ...row(2, "2026-04-14", "x", 10), regDate: null };
    const c = row(3, "2026-04-13", "2026-04-13T15:30:00.000Z", 10);
    expect(chainBroadcastDays([a, noReg, c])).toBe(0);
    expect(noReg.broadcastDay).toBe("2026-04-14");
  });
});
