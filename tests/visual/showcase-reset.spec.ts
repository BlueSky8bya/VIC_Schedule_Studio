import { test, expect } from "@playwright/test";

test("showcase experiments end on exit; calendar months control seasons again", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  await page.route("**/api/studio-write", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3");
  await page.waitForFunction(() => window.__vicAmbient?.season === "spring");
  await page.locator('[data-act="ambient-showcase"]').first().click();
  await page.getByRole("button", { name: "배경 설정", exact: true }).click();
  await page.getByRole("radiogroup", { name: "방향", exact: true }).getByRole("radio", { name: "북", exact: true }).click();
  await page.getByRole("button", { name: "다음 날", exact: true }).click();
  await page.getByRole("slider", { name: "하루 시각" }).focus();
  await page.keyboard.press("Home");
  await page.locator(".sc-set-more summary").click();
  await page.getByRole("radiogroup", { name: "계절", exact: true }).getByRole("radio", { name: "겨울", exact: true }).click();
  await page.waitForFunction(() => window.__vicAmbient?.season === "winter");
  await page.keyboard.press("Escape");
  await expect(page.locator("html[data-showcase]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-showcase") && window.__vicAmbient?.season === "spring");
  const restored = await page.evaluate(() => window.__vicAmbient!.world());
  expect(restored.skyBearing).toBe("south");
  expect(restored.date).toMatch(/^2026-3-/);
  const kst = new Date(Date.now()+9*3600000);
  expect(Math.abs(restored.hour-(kst.getUTCHours()+kst.getUTCMinutes()/60))).toBeLessThan(.05);
  for (let month = 4; month <= 12; month++) {
    await page.locator('[data-act="month-next"]:visible').first().click();
    await page.waitForFunction(m => window.__vicAmbient?.world().date.startsWith(`2026-${m}-`), month);
    expect(await page.evaluate(() => window.__vicAmbient!.season)).toBe(month <= 5 ? "spring" : month <= 8 ? "summer" : month <= 11 ? "autumn" : "winter");
  }
});

test("calendar stays interactive while backdrop images are pending", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requested = 0;
  await page.route("**/ambient/art/backdrop-meadow-*.png", async route => {
    requested++;
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3", {waitUntil:"domcontentloaded"});
    await expect.poll(() => requested).toBeGreaterThan(0);
    for(let i=0;i<3;i++)await page.locator('[data-act="month-next"]:visible').first().click();
    await page.waitForFunction(() => window.__vicAmbient?.season === "summer");
    await page.locator('[data-act="ambient-showcase"]').first().click();
    await page.getByRole("button", {name:"배경 설정",exact:true}).click();
    await expect(page.getByRole("dialog",{name:"배경 설정",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator("html[data-showcase]")).toHaveCount(0);
  } finally { release(); }
  await page.waitForFunction(() => window.__vicAmbient?.pending() === 0);
  expect(await page.evaluate(() => window.__vicAmbient?.season)).toBe("summer");
});
