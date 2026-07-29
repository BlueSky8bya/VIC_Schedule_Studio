import { expect, test } from "@playwright/test";

test("public event API excludes private planning data", async ({ request }) => {
  const response = await request.get("/api/public/vic/events");
  expect(response.ok()).toBe(true);

  const payload = JSON.stringify(await response.json());

  expect(payload).not.toContain("privateTitle");
  expect(payload).not.toContain("privateMemo");
  expect(payload).not.toContain("codename");
  expect(payload).not.toContain("embargoUntil");
  expect(payload).not.toContain("editorNote");
  expect(payload).not.toContain("workState");
  expect(payload).not.toContain("PRIVATE");
  expect(payload).not.toContain("owner_private");
  expect(payload).not.toContain("embargo");
  expect(payload).not.toContain("work");
});

// P2-PROTO-1: 가짜 proposals 엔드포인트 제거 — 어디에도 저장 안 되면서 202를 돌려줘
// 실기능으로 오인될 수 있었다. 라우트가 사라졌음을 계약으로 고정한다.
test("removed synthetic proposals endpoint stays gone", async ({ request }) => {
  const response = await request.post("/api/public/vic/proposals", {
    data: { type: "content", content: "테스트" }
  });
  expect(response.status()).toBe(404);
});
