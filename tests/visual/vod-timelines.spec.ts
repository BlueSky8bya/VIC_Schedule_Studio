import { test, expect } from "@playwright/test";

for (const width of [1440, 390]) test(`timeline selection and management at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/activity", (r) => r.fulfill({ status: 200, body: '{"ok":true}' }));
  await page.route("**/api/developer/presence", (r) => r.fulfill({ json: {
    observedAt: "2026-09-21T12:00:00Z", windowSeconds: 90, total: 8,
    roles: { owner: 1, viewer: 3, anon: 3, developer: 1 },
    devices: { desktop: 5, android: 2, ios: 1, mobile: 0 }
  } }));
  const variants = [
    { id: "root:1", authorNick: "팬 하나", entries: [{ sec: 0, label: "시작", section: null }, { sec: 300, label: "게임", section: null }, { sec: 590, label: "마무리", section: null }] },
    { id: "root:2", authorNick: "팬 둘", entries: [{ sec: 10, label: "다른 시작", section: null }, { sec: 310, label: "전투", section: null }, { sec: 599, label: "끝", section: null }] }
  ];
  await page.route("**/api/public/fixture/vod-timeline?*", (r) => r.fulfill({ json: { authorNick: variants[0].authorNick, entries: variants[0].entries, variants } }));
  const writes: { op: string; payload: { action: string; key: string; titleNo: number } }[] = [];
  await page.route("**/api/studio-write", (r) => { writes.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }); });
  await page.goto("/visual-fixture/timelines");
  await expect(page.getByRole("region", { name: "개발자 접속 상태" })).toContainText("활성 화면");
  await expect(page.locator(".dp-live-tile strong")).toHaveText("8");
  const rail = page.getByRole("region", { name: "공개 타임라인" });
  await rail.getByRole("button", { name: "타임라인 선택" }).click();
  await expect(page.getByRole("listbox", { name: "타임라인 선택" })).toBeVisible();
  await page.getByRole("option", { name: /다른 타임라인 1/ }).click();
  await expect(rail.getByText("전투", { exact: true })).toBeVisible();
  await expect(rail.getByText("메모 작성자")).toHaveCount(0);
  await rail.getByText("전투", { exact: true }).click();
  await expect(page.getByLabel("이동 시각")).toHaveText("310");
  await page.getByRole("button", { name: "대표로 지정" }).nth(1).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ op: "vodTimeline", payload: { titleNo: 42, key: "root:2", action: "pin" } });
  await expect(page.locator(".timeline-board [role=status]")).toContainText("저장했어요");
  await page.getByRole("button", { name: "노출 제외", exact: true }).first().click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].payload.action).toBe("hide");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `.scratch-pw/timelines-${width}.png`, fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await rail.getByRole("button", { name: "타임라인 선택" }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({ path: `.scratch-pw/timelines-dark-${width}.png`, fullPage: true, animations: "disabled" });
});
