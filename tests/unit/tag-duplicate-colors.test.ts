import { describe, expect, it } from "vitest";
import { hasDuplicateVisibleColor } from "@/lib/tags/duplicate-colors";

// 태그 저장의 같은 색 검사는 '보이는 실제 색'으로(2026-11-17 소유자 — 형식 기타 색을 바꿨는데 저장이 막혔다).
const palette = new Map([
  ["gray", "#d9d9d9"],
  ["gen-a", "#ff0000"]
]);

describe("hasDuplicateVisibleColor", () => {
  it("팔레트 번호가 같아도 직접 고른 색이 다르면 중복이 아니다(휴뱅 gray · 기타 gray+#d8d0c2)", () => {
    expect(
      hasDuplicateVisibleColor(
        [
          { colorKey: "gray", bgHex: null, kind: "content" },
          { colorKey: "gray", bgHex: "#d8d0c2", kind: "content" }
        ],
        palette
      )
    ).toBe(false);
  });

  it("보이는 색이 같으면 중복 — 직접 고른 색이 다른 태그의 팔레트 색과 같아도(대소문자 무시)", () => {
    expect(
      hasDuplicateVisibleColor(
        [
          { colorKey: "gen-a", kind: "modifier" },
          { colorKey: "gray", bgHex: "#FF0000", kind: "modifier" }
        ],
        palette
      )
    ).toBe(true);
  });

  it("콘텐츠와 형식은 같은 색을 써도 된다", () => {
    expect(
      hasDuplicateVisibleColor(
        [
          { colorKey: "gen-a", kind: "content" },
          { colorKey: "gen-a", kind: "modifier" }
        ],
        palette
      )
    ).toBe(false);
  });
});
