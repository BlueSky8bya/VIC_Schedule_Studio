import { describe, expect, it } from "vitest";
import { extractMessages, laughScore, tokenize, topBinTerms } from "@/lib/broadcast/vod-chat";

describe("다시보기 채팅 수집 — 파싱·토큰(원문·닉은 남기지 않는다)", () => {
  it("XML 조각에서 본문·발화자 표식·시각을 뽑고 닉은 버린다", () => {
    const xml =
      `<?xml version="1.0"?><root><version>1.0.0</version>` +
      `<chat><m><![CDATA[/빅하//빅하/]]></m><u>user1</u><n><![CDATA[닉네임]]></n><t>18.6</t></chat>` +
      `<chat><m><![CDATA[이쁘다 ㅋㅋㅋ]]></m><u>user2</u><n><![CDATA[닉2]]></n><t>601</t></chat></root>`;
    const msgs = extractMessages(xml);
    expect(msgs.map((m) => m.m)).toEqual(["/빅하//빅하/", "이쁘다 ㅋㅋㅋ"]);
    expect(msgs.map((m) => m.t)).toEqual([18.6, 601]);
    expect(JSON.stringify(msgs)).not.toContain("닉네임");
  });

  it("이모티콘(/…/)은 통째로 버리고(0089), 자모 반복·숫자도 버리고, 한글 2~6자·라틴 3~12자만", () => {
    expect(tokenize("/빅하//빅하/ 토리야 안녕 ㅋㅋㅋ 123 gg wow 노래해줘요")).toEqual([
      "토리야",
      "안녕",
      "wow",
      "노래해줘요"
    ]);
  });

  it("'○○님'은 아는 스트리머 이름일 때만 이름으로 남기고, 모르는 이름(시청자)은 버린다(0090)", () => {
    const known = new Set(["샬롯", "쵸로키"]);
    expect(tokenize("샬롯님 하이 김철수님 안녕 쵸로키님", known)).toEqual(["샬롯", "하이", "안녕", "쵸로키"]);
    // 아는 이름 표가 없으면 '님' 꼴은 전부 버린다
    expect(tokenize("샬롯님 하이")).toEqual(["하이"]);
  });

  it("웃음 점수 = ㅋ 개수(12 캡) + ㅎ 절반; 구간 상위 단어는 불용어·1회 단어 제외 상위 3개", () => {
    expect(laughScore("ㅋㅋㅋㅋㅋ")).toBe(5);
    expect(laughScore("ㅋ".repeat(40))).toBe(12);
    expect(laughScore("ㅎㅎㅎㅎ 재밌다")).toBe(2);
    const terms = new Map<string, number>([
      ["토리님", 9],
      ["고카상사", 5],
      ["라이츄", 4],
      ["안녕", 7],
      ["룰렛", 2],
      ["한번", 1],
      ["wow", 6]
    ]);
    expect(topBinTerms(terms)).toEqual(["고카상사", "라이츄", "룰렛"]);
  });
});
