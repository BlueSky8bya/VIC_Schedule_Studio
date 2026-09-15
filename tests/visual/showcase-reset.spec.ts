import { test, expect } from "@playwright/test";

test("showcase background clicks cannot activate hidden studio controls", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  await page.route("**/api/studio-write", route => route.fulfill({json:{ok:true}}));
  await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3");
  const hiddenButton=page.locator('.tag-legend-filter').first();
  await expect(hiddenButton).toBeVisible();
  await hiddenButton.evaluate(el=>{
    el.setAttribute('data-test-clicks','0');
    el.addEventListener('click',()=>el.setAttribute('data-test-clicks',String(Number(el.getAttribute('data-test-clicks'))+1)));
  });
  await page.evaluate(()=>{
    const preserved=document.createElement('div');preserved.id='already-inert';preserved.inert=true;document.body.append(preserved);
  });
  const trigger=page.locator('[data-act="ambient-showcase"]').first();
  await trigger.click();
  await page.evaluate(()=>{
    const portal=document.createElement('button');portal.id='late-background-portal';portal.textContent='background portal';document.body.append(portal);
  });
  await expect(page.locator('#late-background-portal')).toHaveAttribute('inert','');
  const box=await hiddenButton.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);
  await expect(hiddenButton).toHaveAttribute('data-test-clicks','0');
  // Releasing after Escape must not activate the button revealed underneath.
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(hiddenButton).toHaveAttribute('data-test-clicks','0');
  await expect(trigger).toBeFocused();
  await expect(page.locator('#late-background-portal')).not.toHaveAttribute('inert','');
  await expect(page.locator('#already-inert')).toHaveAttribute('inert','');
  await hiddenButton.click();
  await expect(hiddenButton).toHaveAttribute('data-test-clicks','1');
});

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

for (const entry of ["mouse", "keyboard"] as const) {
  test(`showcase accepts immediate arrows after ${entry} entry and restores focus`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
    await page.goto("/visual-fixture/studio?role=developer&y=2026&m=3");
    await page.waitForFunction(() => window.__vicAmbient?.biome() === "meadow");
    const trigger = page.locator('[data-act="ambient-showcase"]').first();
    if (entry === "mouse") await trigger.click();
    else { await trigger.focus(); await page.keyboard.press("Enter"); }
    await expect(page.getByRole("region", { name: "배경 감상", exact: true })).toBeFocused();
    // No background click: the first key must reach navigation even on cold assets.
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => window.__vicAmbient?.biome() === "forest", undefined, { timeout: 30000 });
    await page.getByRole("button", { name: "배경 설정", exact: true }).click();
    const slider = page.getByRole("slider", { name: "하루 시각" });
    await slider.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toBeFocused();
    expect(await page.evaluate(() => window.__vicAmbient!.biome())).toBe("forest");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator("html[data-showcase]")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
