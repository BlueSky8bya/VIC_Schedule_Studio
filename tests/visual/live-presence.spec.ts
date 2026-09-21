import { expect, test } from "@playwright/test";

test("live counts recover from errors and disappear when developer access is lost", async ({ page, request }) => {
  test.setTimeout(70_000);
  // Real route, no actor fixture or auth bypass. Anonymous never receives metrics.
  const denied = await request.get("/api/developer/presence");
  expect(denied.status()).toBe(401);
  expect(denied.headers()["cache-control"]).toContain("no-store");
  expect(await denied.json()).toEqual({ error: "unauthorized" });
  let mode: "ok" | "error" | "denied" = "ok";
  let calls = 0;
  await page.route("**/api/developer/presence", (route) => {
    calls++;
    if (mode !== "ok") return route.fulfill({ status: mode === "error" ? 503 : 403, json: { error: "unavailable" } });
    return route.fulfill({ json: {
      observedAt: "2026-09-21T15:00:00Z", windowSeconds: 90, total: 8,
      roles: { owner: 1, viewer: 3, anon: 3, developer: 1 },
      devices: { desktop: 5, android: 2, ios: 1, mobile: 0 }
    } });
  });
  await page.goto("/visual-fixture/timelines");
  const panel = page.getByRole("region", { name: "개발자 접속 상태" });
  await expect(panel.locator(".dp-live-tile strong")).toHaveText("8");
  await expect(panel.getByRole("status")).toContainText(/(?:00:00:00|0시 0분 0초) \(KST\)/);
  mode = "error";
  await expect(panel.getByRole("status")).toContainText("자동으로 다시 시도", { timeout: 20_000 });
  await expect(panel.locator(".dp-live-tile strong")).toHaveText("…");
  mode = "ok";
  await expect(panel.locator(".dp-live-tile strong")).toHaveText("8", { timeout: 20_000 });
  mode = "denied";
  await expect(panel.getByRole("status")).toContainText("개발자 권한이 필요", { timeout: 20_000 });
  await expect(panel.locator(".dp-live-tile strong")).toHaveText("…");
  const stoppedAt = calls;
  await page.waitForTimeout(16_000);
  expect(calls).toBe(stoppedAt);
});
