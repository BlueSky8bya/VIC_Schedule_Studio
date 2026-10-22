import { describe, expect, it } from "vitest";
import { attributeUploadDay, mapUploadItem } from "@/lib/broadcast/vod-upload";

const iso = (kst: string) => new Date(`${kst.replace(" ", "T")}+09:00`).toISOString();

describe("subscription upload day attribution (0155)", () => {
  it("prefers the M월 D일 date in the title", () => {
    expect(attributeUploadDay("[비방] 12월 18일 맹든링!", iso("2025-12-19 03:00:00"))).toBe("2025-12-18");
  });
  it("rolls the title date into the previous year across New Year", () => {
    expect(attributeUploadDay("[비방] 12월 31일 카운트다운", iso("2026-01-02 12:00:00"))).toBe("2025-12-31");
  });
  it("ignores impossible title dates", () => {
    expect(attributeUploadDay("2월 30일 영상", iso("2026-03-01 12:00:00"))).toBe("2026-03-01");
  });
  it("uses the 6am KST boundary without a title date", () => {
    expect(attributeUploadDay("불멍임니다!", iso("2026-09-06 01:13:21"))).toBe("2026-09-05");
    expect(attributeUploadDay("[기타] 스프 먹는 영상!", iso("2025-10-28 19:31:36"))).toBe("2025-10-28");
  });
  it("returns null without a registration time", () => {
    expect(attributeUploadDay("영상", null)).toBeNull();
  });
});

describe("subscription upload mapping", () => {
  const base = { title_no: 176158317, title_name: "[기타] 스프 먹는 영상!", reg_date: "2025-10-28 19:31:36", auth_no: 107,
    ucc: { file_type: "NORMAL", total_file_duration: 210516, thumb: "//iflv14.sooplive.com/x.jpg" } };
  it("keeps only subscriber-only uploads", () => {
    expect(mapUploadItem(base)).toMatchObject({ titleNo: 176158317, uploadDay: "2025-10-28", durationMs: 210516, authNo: 107 });
    expect(mapUploadItem({ ...base, auth_no: 101 })).toBeNull();
    expect(mapUploadItem({ ...base, ucc: { ...base.ucc, file_type: "REVIEW" } })).toBeNull();
  });
  it("marks a malformed upload as bad instead of silently dropping it", () => {
    expect(mapUploadItem({ ...base, title_no: undefined })).toBe("bad");
    expect(mapUploadItem({ ...base, reg_date: "nope" })).toBe("bad");
  });
});
