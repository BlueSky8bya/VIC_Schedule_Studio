import { describe, expect, it } from "vitest";
import { fixLatinTypo, qwertyToHangul } from "@/lib/search/hangul";

describe("영타 → 한글(두벌식)", () => {
  it("음절을 조립한다 — shfo=노래, dkdldb=아이유, gkffhdnskdlxm=할로우나이트", () => {
    expect(qwertyToHangul("shfo")).toBe("노래");
    expect(qwertyToHangul("dkdldb")).toBe("아이유");
    expect(qwertyToHangul("gkffhdnskdlxm")).toBe("할로우나이트");
    expect(qwertyToHangul("qorm")).toBe("배그");
    expect(qwertyToHangul("qorrm")).toBe("백그"); // 받침 ㄱ이 붙고 ㄱㅡ가 다음 음절
    expect(qwertyToHangul("akzm")).toBe("마크");
  });

  it("받침이 다음 초성으로 넘어가고, 이중모음·겹받침을 만든다", () => {
    expect(qwertyToHangul("dhk")).toBe("와");
    expect(qwertyToHangul("dlfr")).toBe("읽");
    expect(qwertyToHangul("rhtprn")).toBe("고세구");
  });

  it("fixLatinTypo: 영타면 한글, 진짜 영어면 null", () => {
    expect(fixLatinTypo("shfo")).toBe("노래");
    expect(fixLatinTypo("whdrpa")).toBe("종겜");
    expect(fixLatinTypo("zelda")).toBeNull();
    expect(fixLatinTypo("pubg")).toBeNull();
    expect(fixLatinTypo("노래")).toBeNull();
  });
});
