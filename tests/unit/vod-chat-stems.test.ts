import { describe, expect, it } from "vitest";
import { docWordSet, nicknameStems } from "@/lib/broadcast/vod-chat";

describe("별명 변형 어간(0093) — ○○토리·빅○○ → 검색 가능한 말", () => {
  const words = docWordSet(["예스노 탐정 해보기! ㅡ 1주년 굿즈 판매중!", "탐정 추리 시작", "야키토리 먹방"]);
  it("탐정토리·바보토리는 어간을, 탐토리는 방송 낱말(탐정)로 푼다", () => {
    expect(nicknameStems("탐정토리", words)).toEqual(["탐정"]);
    expect(nicknameStems("바보토리", words)).toEqual(["바보"]);
    expect(nicknameStems("탐토리", words)).toEqual(["탐정"]);
  });
  it("빅○○ 접두형도 어간을 남기고, 토리·빅토리 자체는 아무것도 안 낸다", () => {
    expect(nicknameStems("빅드럭", words)).toEqual(["드럭"]);
    expect(nicknameStems("빅토리", words)).toEqual([]);
    expect(nicknameStems("토리", words)).toEqual([]);
    expect(nicknameStems("굿즈", words)).toEqual([]);
  });
});
