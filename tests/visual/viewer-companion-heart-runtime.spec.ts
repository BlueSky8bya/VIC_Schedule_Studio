import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const heart = (page: Page) => page.locator("#companion-runtime-heart");

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(preferences => {
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.sound", "off");
    // Deterministic utility draw, with the real monotonic clock untouched.
    Math.random = () => .999999;
  }, { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, heartPrank: true, ambientPrank: false, feeding: false });
});

async function addSyntheticHeart(page: Page, humanPressed: boolean) {
  const card = page.locator(".public-event[data-eventid]:visible").filter({ hasNot: page.locator(".teaser") }).first();
  const id = await card.getAttribute("data-eventid");
  expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/);
  await card.evaluate((card, pressed) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "event-heart"; button.id = "companion-runtime-heart";
    button.setAttribute("aria-label", "Synthetic human heart");
    button.setAttribute("aria-pressed", String(pressed)); button.setAttribute("data-native-clicks", "0");
    button.style.cssText = "position:absolute;right:4px;top:4px;width:24px;height:24px;display:block;opacity:1;pointer-events:auto;z-index:5";
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21 3 11a5 5 0 0 1 9-6 5 5 0 0 1 9 6Z"/></svg>';
    const count = document.createElement("span"); count.id = "companion-runtime-human-count"; count.textContent = "17";
    count.style.cssText = "position:absolute;right:32px;top:4px;font-size:10px";
    button.addEventListener("click", () => {
      button.setAttribute("data-native-clicks", String(Number(button.getAttribute("data-native-clicks")) + 1));
      button.setAttribute("aria-pressed", "true"); count.textContent = String(Number(count.textContent) + 1);
    });
    card.append(count, button);
  }, humanPressed);
  return { card, id: id! };
}

async function standOnCard(page: Page) {
  await expect(actor(page)).toBeVisible();
  const { card } = await addSyntheticHeart(page, false);
  await actor(page).focus();
  await page.getByRole("button", { name: "빅타민 메뉴", exact: true }).click();
  await page.getByRole("button", { name: "옮길 곳 고르기", exact: true }).click();
  const box = (await card.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 1);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-/, { timeout: 5000 });
}

test("the real companion leaves a violet souvenir without a native vote, and remembers it after reload", async ({ page }) => {
  test.setTimeout(55_000);
  await page.goto("/visual-fixture/poster");
  await standOnCard(page);
  await expect(pet(page)).toHaveAttribute("data-heart-result", "added", { timeout: 45_000 });
  await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  const colors = await heart(page).evaluate(button => {
    const probe = document.createElement("span"); probe.style.color = "var(--teaser)"; button.append(probe);
    const violet = getComputedStyle(probe).color; probe.remove();
    return { actual: getComputedStyle(button).color, violet };
  });
  expect(colors.actual).toBe(colors.violet);
  await page.screenshot({ path: ".scratch-pw/companion-heart-runtime-added.png" });
  await page.reload();
  await expect(actor(page)).toBeVisible();
  await addSyntheticHeart(page, false);
  await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
  await expect(heart(page)).toHaveAttribute("data-companion-heart-blocked", "");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
});

test("the real companion bumps an existing human heart and cannot replace or increment it", async ({ page }) => {
  test.setTimeout(55_000);
  await page.goto("/visual-fixture/poster");
  await standOnCard(page);
  await heart(page).evaluate(button => button.setAttribute("aria-pressed", "true"));
  const humanColor = await heart(page).evaluate(button => getComputedStyle(button).color);
  await expect(pet(page)).toHaveAttribute("data-heart-result", "blocked", { timeout: 45_000 });
  await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  expect(await heart(page).evaluate(button => getComputedStyle(button).color)).toBe(humanColor);
  await expect(page.locator(".vc-effect")).toHaveText("◌");
  await page.screenshot({ path: ".scratch-pw/companion-heart-runtime-blocked.png" });
});
