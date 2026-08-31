import { describe, expect, it } from "vitest";
import {
  attributeBroadcastDay,
  kstStringToIso,
  mapApiItem,
  parseThumbRowKey
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

describe("attributeBroadcastDay — 방송 '시작일' 귀속", () => {
  it("rowKey 날짜가 있으면 그게 정답", () => {
    expect(attributeBroadcastDay("2026-08-30", "2026-08-30T18:52:13.000Z", 1)).toBe("2026-08-30");
  });
  it("rowKey가 없으면 등록시각-길이의 KST 날짜 — 자정 넘긴 방송이 시작한 날로 붙는다", () => {
    // 뱅종(등록) 08-31 03:52 KST, 길이 10.9시간 → 시작 08-30 16:59 KST
    expect(attributeBroadcastDay(null, "2026-08-30T18:52:13.000Z", 39135834)).toBe("2026-08-30");
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
      readCnt: 9972
    });
  });
  it("title_no가 없으면 버린다", () => {
    expect(mapApiItem({ ...item, title_no: undefined })).toBeNull();
  });
  it("날짜 귀속이 안 되면 버린다", () => {
    expect(mapApiItem({ ...item, reg_date: undefined, ucc: { total_file_duration: 1000 } })).toBeNull();
  });
});
