import { expect, test } from "@playwright/test";

test("public event API excludes private planning data", async ({ request }) => {
  const response = await request.get("/api/public/vic/events");
  expect(response.ok()).toBe(true);

  const payload = JSON.stringify(await response.json());

  expect(payload).not.toContain("privateTitle");
  expect(payload).not.toContain("privateNotes");
  expect(payload).not.toContain("codename");
  expect(payload).not.toContain("embargoUntil");
});
