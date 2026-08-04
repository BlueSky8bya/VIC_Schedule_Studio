import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// autoId(lib/activity/client.ts)가 무엇을 id로 삼는지에 대한 계약.
//
// ⚠ aria-label·textContent는 절대 쓰지 않는다. 사용자·외부 내용이 들어오는 자리다:
//   `${s.publicTitle} 도와주러 가기` (일정 공개 제목)
//   `지금 방송 중: ${live.title}` (외부 방송 제목)
//   `${asset.name} 삭제` / `${l.name} 삭제` (사용자가 지은 이름)
//   일정 카드의 textContent = 일정 제목 그 자체
// 그대로 쓰면 제목이 activity_event.target에 저장된다 — 최우선 제약(제목 비저장) 위반.
const SRC = fs.readFileSync(path.join(process.cwd(), "lib/activity/client.ts"), "utf8");
const AUTO_ID = SRC.slice(SRC.indexOf("function autoId"), SRC.indexOf("function wireClicks"));

describe("autoId — 사용자 내용을 id로 쓰지 않는다", () => {
  it("aria-label을 읽지 않는다", () => {
    expect(AUTO_ID).not.toContain("aria-label");
  });
  it("textContent를 읽지 않는다", () => {
    expect(AUTO_ID).not.toContain("textContent");
  });
  it("className만 본다", () => {
    expect(AUTO_ID).toContain("className");
  });
});

describe("autoId — 공통 클래스로 뭉치지 않는다", () => {
  it("button/primary 같은 공통 토큰은 건너뛴다", () => {
    // `className="button io-accent io-preview"`가 `.button`이 되면 서로 다른 버튼이
    // 전부 한 항목으로 합쳐진다(실측: '일반 버튼(합계)').
    const generic = SRC.slice(SRC.indexOf("const GENERIC_CLASS"), SRC.indexOf("function autoId"));
    for (const token of ["button", "primary", "danger", "icon-only", "io-accent"]) {
      expect(generic).toContain(token);
    }
  });
});
