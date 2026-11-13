import { describe, expect, it } from "vitest";
import { buildMime } from "@/lib/reports/gmail";

const decodeWord = (w: string) => Buffer.from(w.replace(/^=\?UTF-8\?B\?|\?=$/g, ""), "base64").toString("utf8");

describe("제보함 답장 메일(Gmail API raw)", () => {
  it("한글 제목·보내는 이름·본문을 UTF-8 base64로 싣는다", () => {
    const mime = buildMime("viewer@example.com", "[빅토리 방송 일정표] 버그 제보 답변", "안녕하세요\n고쳤어요 🎉");
    const [head, body] = mime.split("\r\n\r\n");
    const lines = head.split("\r\n");
    expect(lines).toContain("To: viewer@example.com");
    expect(lines).toContain("Content-Type: text/plain; charset=UTF-8");
    const subject = lines.find((l) => l.startsWith("Subject: "))!.slice(9);
    expect(decodeWord(subject)).toBe("[빅토리 방송 일정표] 버그 제보 답변");
    const from = lines.find((l) => l.startsWith("From: "))!;
    expect(from).toContain("<3blackspacegames@gmail.com>");
    expect(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe("안녕하세요\r\n고쳤어요 🎉");
    // 헤더에 날 한글이 없어야 한다(메일 서버가 깨뜨린다).
    expect([...head].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
  });
});
