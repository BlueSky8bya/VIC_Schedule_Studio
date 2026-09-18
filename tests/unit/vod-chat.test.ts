import { describe, expect, it } from "vitest";
import { extractMessages, tokenize } from "@/lib/broadcast/vod-chat";

describe("다시보기 채팅 수집 — 파싱·토큰(원문·닉은 남기지 않는다)", () => {
  it("XML 조각에서 메시지 본문만 뽑는다", () => {
    const xml =
      `<?xml version="1.0"?><root><version>1.0.0</version>` +
      `<chat><m><![CDATA[/빅하//빅하/]]></m><u>user1</u><n><![CDATA[닉네임]]></n><t>18.6</t></chat>` +
      `<chat><m><![CDATA[이쁘다 ㅋㅋㅋ]]></m><u>user2</u><n><![CDATA[닉2]]></n><t>601</t></chat></root>`;
    const msgs = extractMessages(xml);
    expect(msgs).toEqual(["/빅하//빅하/", "이쁘다 ㅋㅋㅋ"]);
    expect(msgs.join(" ")).not.toContain("user1");
    expect(msgs.join(" ")).not.toContain("닉네임");
  });

  it("이모티콘은 슬래시째 한 단어, 자모 반복·숫자는 버리고, 한글 2~6자·라틴 3~12자만", () => {
    expect(tokenize("/빅하//빅하/ 토리야 안녕 ㅋㅋㅋ 123 gg wow 노래해줘요")).toEqual([
      "/빅하/",
      "/빅하/",
      "토리야",
      "안녕",
      "wow",
      "노래해줘요"
    ]);
  });
});
