import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const calls = new WeakMap<Page, { posts: string[]; errors: string[] }>();

test.use({ viewport: { width: 1920, height: 1100 } });
test.beforeEach(async ({ page }, info) => {
  const observed = { posts: [] as string[], errors: [] as string[] }; calls.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "unused fixture navigation" });
    if (route.request().method() === "POST") { observed.posts.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ prefs, care, key, epoch, automatic }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 } }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    if (automatic) Math.random = () => .5;
  }, { prefs: { ...DEFAULT_COMPANION_PREFERENCES, roam: info.title.startsWith("an active companion"), jump: !info.title.startsWith("manual recall"), ambientPrank: false, heartPrank: false, cardPrank: false, panelPrank: false }, care: { ...DEFAULT_COMPANION_CARE, energy: .85, hunger: .1 }, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, automatic: info.title.startsWith("an active companion") });
});
test.afterEach(async ({ page }) => { expect(calls.get(page)).toEqual({ posts: [], errors: [] }); });

async function ready(page: Page, url: string) {
  await page.goto(url); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible();
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
}
async function dropAtFloor(page: Page) {
  await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  const view = page.viewportSize()!;
  await page.mouse.click(Math.min(850, view.width - 150), view.height - 50); await page.mouse.move(view.width - 100, view.height - 200);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
}

test("an active companion recovers from an empty month's isolated bottom without a recall click", async ({ page }) => {
  test.setTimeout(80000);
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11");
  await dropAtFloor(page);
  // Fixture-only unavailable arrows isolate the reported empty-floor case.
  // Otherwise the ordinary planner successfully climbs a real arrow first,
  // which is upward progress rather than a failed automatic home recovery.
  await page.locator("[data-companion-panel-side]").evaluateAll(nodes => nodes.forEach(node => {
    (node as HTMLButtonElement).disabled = true; node.classList.add("fixture-unavailable-perch");
  }));
  await expect(pet(page)).toHaveAttribute("data-home-journey", "", { timeout: 45000 });
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 30000 });
  await expect(page.locator("[data-home-step]")).toHaveCount(0);
});

test("native pickup and folding interrupt a return without stale waypoints", async ({ page }) => {
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11"); await dropAtFloor(page);
  const recall = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await recall.click(); await expect(pet(page)).toHaveAttribute("data-state", "walk");
  await actor(page).focus(); await actor(page).press(" ");
  await expect(pet(page)).not.toHaveAttribute("data-home-journey"); await expect(page.locator("[data-home-step]")).toHaveCount(0);
  await actor(page).press("ArrowRight"); await actor(page).press(" ");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await recall.click(); await expect(pet(page)).toHaveAttribute("data-home-journey", "");
  await page.getByRole("button", { name: "빅타민 집", exact: true }).click();
  await expect(pet(page)).not.toHaveAttribute("data-home-journey", { timeout: 6000 });
  await expect(page.locator("[data-home-step]")).toHaveCount(0); await expect(actor(page)).toBeVisible();
});

test("a right-side compact room stays reachable in a short viewport", async ({ page }) => {
  test.setTimeout(65000); await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(() => localStorage.setItem("vic_avatar_side", "right"));
  await ready(page, "/visual-fixture/poster");
  const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  if (await launcher.isVisible()) await launcher.click();
  await dropAtFloor(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 45000 });
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await page.screenshot({ path: ".scratch-pw/companion-084-short-right-home.png" });
});

test("opening and closing settings preserves the finite return goal", async ({ page }) => {
  test.setTimeout(65000);
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11"); await dropAtFloor(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "walk");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-home-journey", "");
  await dialog.locator(".modal-head .modal-close").click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 45000 });
  await expect(page.locator("[data-home-step]")).toHaveCount(0); await expect(actor(page)).toBeVisible();
});

test("manual recall still moves naturally with autonomous hopping off", async ({ page }) => {
  test.setTimeout(65000);
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11"); await dropAtFloor(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-home-journey", "");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 45000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!));
  expect(saved.jump).toBe(false); expect(saved.roam).toBe(false);
});

test("resizing a return remeasures the real home without leaving phantom steps", async ({ page }) => {
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11"); await dropAtFloor(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "walk");
  await page.setViewportSize({ width: 2000, height: 1180 });
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 35000 });
  await expect(page.locator("[data-home-step],.vc-home-route")).toHaveCount(0);
  await expect(actor(page)).toBeVisible();
});

test("a resize that folds the room cancels safely and allows a fresh compact-room recall", async ({ page }) => {
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11"); await dropAtFloor(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "walk");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(pet(page)).not.toHaveAttribute("data-home-journey");
  await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(page.locator(".vc-companion [role='status']")).not.toContainText("집을 펼쳐 주세요");
  await expect.poll(async () => await pet(page).getAttribute("data-home-journey") !== null || await pet(page).getAttribute("data-platform") === "companion-home").toBe(true);
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 35000 });
  await expect(page.locator("[data-home-step],.vc-home-route")).toHaveCount(0);
});

test("reduced motion recalls quietly without the stronger spring", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.reduceMotion", "on"));
  await ready(page, "/visual-fixture/studio?role=owner&y=2025&m=11"); await dropAtFloor(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 2000 });
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect(page.locator("[data-home-step],.vc-home-route")).toHaveCount(0);
});

test("recall from an actual calendar card leaves that card directly and follows real nearby ledges", async ({ page }) => {
  await ready(page, "/visual-fixture/poster");
  const point = await page.locator(".public-event[data-eventid]").evaluateAll(nodes => {
    const card = nodes.map(node => node.getBoundingClientRect()).find(r => r.top > 500 && r.top < 750 && r.left > 500 && r.left < 750);
    return card ? { x: card.left + 70, y: card.top - 7 } : null;
  });
  expect(point).not.toBeNull();
  await actor(page).focus(); await actor(page).press("p");
  await page.mouse.click(point!.x, point!.y); await page.mouse.move(1800, 800);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "jump", { timeout: 2000 });
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 30000 });
  await expect(page.locator("[data-home-step],.vc-home-route")).toHaveCount(0);
  await page.screenshot({ path: ".scratch-pw/companion-085-card-home.png" });
});

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} returns through real supports without visible or invisible temporary steps`, async ({ page }) => {
    test.setTimeout(65000);
    await ready(page, surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster");
    await dropAtFloor(page);
    await page.evaluate(() => {
      const samples: { at: number; platform?: string; state?: string; journey?: string; x: number; y: number; steps: number }[] = [];
      Object.assign(window, { homeRouteSamples: samples });
      const until = performance.now() + 40000;
      const sample = () => {
        const node = document.querySelector<HTMLElement>(".vc-companion")!;
        const m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        samples.push({ at: performance.now(), platform: node.dataset.platform, state: node.dataset.state, journey: node.dataset.journey, x: m.m41 + 46, y: m.m42 + 92, steps: document.querySelectorAll("[data-home-step],.vc-home-route").length });
        if (performance.now() < until && node.dataset.platform !== "companion-home") requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
    await expect(pet(page)).toHaveAttribute("data-home-journey", "");
    await expect(pet(page)).toHaveAttribute("data-state", "jump", { timeout: 35000 });
    await page.screenshot({ path: `.scratch-pw/companion-085-${surface}-jump.png` });
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 45000 });
    await expect(pet(page)).toHaveAttribute("data-state", "sleep");
    await expect(page.locator("[data-home-step]")).toHaveCount(0);
    const samples = await page.evaluate(() => (window as unknown as { homeRouteSamples: { at: number; platform?: string; state?: string; journey?: string; x: number; y: number; steps: number }[] }).homeRouteSamples);
    expect(new Set(samples.filter(s => s.state === "jump").map(s => s.journey)).size).toBeGreaterThanOrEqual(1);
    expect(samples.some(s => s.state === "walk")).toBe(true);
    expect(samples.every(s => !s.platform?.startsWith("companion-home-step-") && s.steps === 0)).toBe(true);
    expect(Math.min(...samples.map(s => s.y))).toBeGreaterThanOrEqual(99);
    for (let i = 1; i < samples.length; i++) if (samples[i].at - samples[i - 1].at < 80) expect(Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y)).toBeLessThan(160);
    writeFileSync(`.scratch-pw/companion-085-${surface}-route.json`, JSON.stringify(samples, null, 2));
    await page.screenshot({ path: `.scratch-pw/companion-085-${surface}-home.png` });
    // A real native pickup supersedes recall without reappearing at an old waypoint.
    const box = (await actor(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(700, 700, { steps: 12 }); await expect(pet(page)).toHaveAttribute("data-state", "held");
    await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-home-journey");
  });
  test(`${surface} describes actual local habits and refreshes after native reset`, async ({ page }) => {
    await ready(page, surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster");
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
    await dialog.getByRole("tab", { name: "프로필", exact: true }).click();
    await expect(dialog.getByText("쓰다듬기와 곁에 있기", { exact: true })).toBeVisible();
    await expect(dialog.getByText("장난치고 탐험하기", { exact: true })).toBeVisible();
    await expect(dialog.getByText("낯선 곳도 씩씩하게", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await expect(dialog.getByText(/아직 뚜렷한 습관은 없어요/)).toBeVisible();
    await page.screenshot({ path: `.scratch-pw/companion-084-${surface}-habits.png` });
    await dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true }).click();
    await expect(dialog.getByText(/배우기 끔 · 습관은 보관, 행동은 고른 성격대로/)).toBeVisible();
  });
}
