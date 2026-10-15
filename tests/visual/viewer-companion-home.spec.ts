import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const posts = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => { if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); } return route.continue(); });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ prefs, care, epoch, key }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
  }, { prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function showHome(page: Page) {
  if (!await house(page).isVisible()) await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await expect(house(page)).toBeVisible();
  await expect(house(page)).toHaveCount(1);
  await page.waitForTimeout(180); // coalesced support measurement
}

test("one home follows the shared panel and keeps the same creature and care", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await expect(page.locator(".avatar-slot .vc-home")).toHaveCount(1);
  await house(page).getByRole("button", { name: "쓰다듬기", exact: true }).click();
  const affection = Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"));
  expect(affection).toBeGreaterThan(.36);
  await page.evaluate(() => { localStorage.setItem("vic_avatar_side", "right"); dispatchEvent(new Event("vic:side-panel")); });
  await expect(page.locator(".avatar-right .avatar-slot .vc-home")).toHaveCount(1);
  await expect(pet(page)).toHaveCount(1);
  await page.setViewportSize({ width: 900, height: 900 }); await showHome(page);
  await expect(page.locator(".vc-compact-home .vc-home")).toHaveCount(1);
  expect(Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"))).toBeGreaterThan(.36);
  await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-companion")).toHaveCount(0);
  await page.screenshot({ path: ".scratch-pw/companion-home-responsive.png" });
});

test("compact home stays reachable in landscape and transfers keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible();
  const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  await launcher.focus(); await launcher.press("Enter"); await expect(house(page)).toBeVisible();
  await expect(house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true })).toBeFocused();
  const box = (await house(page).boundingBox())!; expect(box.y).toBeGreaterThanOrEqual(10); expect(box.y + box.height).toBeLessThan(390);
  await house(page).getByRole("button", { name: "옮길 곳 고르기", exact: true }).click();
  await expect(actor(page)).toBeFocused(); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.keyboard.press("Escape"); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await showHome(page); await house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).click(); await expect(launcher).toBeFocused();
});

test("reduced-motion tap acknowledges immediately and long hold does not pet", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.reduceMotion", "on"));
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible();
  await actor(page).click();
  const result = await actor(page).evaluate(button => {
    return { state: button.parentElement!.dataset.state, heart: button.parentElement!.querySelector(".vc-effect")!.textContent };
  });
  expect(result).toEqual({ state: "petted", heart: "♡" });
  const box = (await actor(page).boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForTimeout(375); await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
});

for (const width of [1920, 390]) test(`cushion recall and breathing dreams use the same world at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
  await expect(pet(page)).toHaveAttribute("data-dreaming", "", { timeout: 6000 });
  const contact = await page.evaluate(() => {
    const pet = document.querySelector<HTMLElement>(".vc-companion")!.getBoundingClientRect();
    const cushion = document.querySelector<HTMLElement>(".vc-home-cushion")!.getBoundingClientRect();
    const dreams = [...document.querySelectorAll<HTMLElement>(".vc-dream i")];
    return { error: Math.abs(pet.bottom - cushion.top), animations: dreams.map(node => getComputedStyle(node).animationName), shadow: getComputedStyle(document.querySelector(".vc-contact-shadow")!).opacity };
  });
  expect(contact.error).toBeLessThan(3); expect(contact.animations).toEqual(["vc-dream", "vc-dream", "vc-dream"]); expect(Number(contact.shadow)).toBeGreaterThan(.1);
  await page.screenshot({ path: `.scratch-pw/companion-home-cushion-${width}.png` });
  await house(page).getByRole("button", { name: "사과 밥 꺼내기", exact: true }).click();
  await expect(page.locator(".vc-food .vc-fruit")).toHaveCount(1);
  await expect(page.locator(".vc-food")).toHaveAttribute("data-selected", "");
  await page.keyboard.press("Escape");
});

test("tap pets, an early swipe cancels, and a deliberate hold moves without petting", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible();
  await actor(page).click(); await expect(pet(page)).toHaveAttribute("data-state", "petted");
  await expect(page.locator(".vc-effect")).toHaveText("♡");
  const point = async () => { const b = (await actor(page).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  let p = await point();
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 25, p.y, { steps: 2 }); await page.mouse.up();
  await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
  await page.waitForTimeout(850); p = await point();
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(420);
  await expect(pet(page)).toHaveAttribute("data-grab-ready", "");
  await page.mouse.move(p.x + 70, p.y - 25, { steps: 6 }); await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
});
