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

test("public proposal intake accepts viewer suggestions without event writes", async ({
  request
}) => {
  const response = await request.post("/api/public/vic/proposals", {
    data: {
      type: "content",
      content: "다음 달 첫 주에 시참 게임 후보를 받고 싶어요",
      suggestedDate: "2026-06-05"
    }
  });

  expect(response.status()).toBe(202);
  const payload = await response.json();
  expect(payload.proposal.state).toBe("new");
  expect(JSON.stringify(payload)).not.toContain("privateMemo");
});
