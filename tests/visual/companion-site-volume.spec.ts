import { expect, test, type Locator, type Page } from "@playwright/test";

// Owner 2026-11-19: the companion sound card shows the site's own volume ("전체 음량") right above 빅타민 음량.
// It is the same control and the same stored value as 설정 › 소리 › 음량, so moving either one moves the other.
const output = process.env.COMPANION_SITE_VOLUME_OUTPUT ?? ".scratch-pw/companion-site-volume";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 204 }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

async function open(page: Page, dark: boolean, soundOn = true) {
  await page.addInitScript(({ dark, soundOn }) => {
    if (localStorage.getItem("fixture.siteVolume")) return;
    localStorage.setItem("fixture.siteVolume", "1");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: true }));
    localStorage.setItem("vic.dark", dark ? "on" : "off"); localStorage.setItem("vic.sound", soundOn ? "on" : "off"); localStorage.setItem("vic.soundVol", "40");
  }, { dark, soundOn });
  await page.goto("/visual-fixture/poster");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const tab = page.getByRole("tab", { name: "빅타민", exact: true });
  if (await tab.isVisible()) await tab.click();
  return page.locator("#rhh-tab-companion-panel");
}
const setRange = (slider: Locator, value: number) => slider.evaluate((input: HTMLInputElement, value) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; set.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
}, value);

for (const dark of [false, true]) test(`site volume on the companion card is the 소리 tab's volume (${dark ? "dark" : "light"})`, async ({ page }) => {
  const panel = await open(page, dark);
  const card = panel.locator(".rhh-companion-sound");
  // The settings page is loaded on first show; wait for its sound card.
  await expect(card.getByRole("slider", { name: "전체 음량", exact: true })).toBeVisible();
  const rows = card.locator(".role-help-haptics");
  // Directly above 빅타민 음량, with the shared slider and its number at the right.
  const labels = await rows.evaluateAll(nodes => nodes.map(node => node.querySelector(".rhh-label")?.textContent?.trim() ?? node.textContent?.trim() ?? ""));
  const at = labels.findIndex(text => text.startsWith("전체 음량"));
  expect(at, JSON.stringify(labels)).toBeGreaterThanOrEqual(0);
  expect(labels[at + 1]).toMatch(/^빅타민 음량/);
  const site = card.getByRole("slider", { name: "전체 음량", exact: true });
  await expect(site).toHaveAttribute("data-act", "sound-volume");
  await expect(site).toHaveValue("40");
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${output}/card-${dark ? "dark" : "light"}.png` });
  // Card → 소리 tab.
  await setRange(site, 70);
  await expect(card.locator(".rhh-sound-status")).toContainText("소리가 나요");
  await setRange(site, 0);
  await expect(card.locator(".rhh-sound-status")).toContainText("사이트 음량이 0이에요");
  await setRange(site, 65);
  expect(await page.evaluate(() => localStorage.getItem("vic.soundVol"))).toBe("65");
  await page.getByRole("tab", { name: "소리", exact: true }).click();
  // One name for the one control in both places.
  const tabSlider = page.locator("#rhh-tab-sound-panel, section:has(#rhh-tab-sound-title)").first().getByRole("slider", { name: "전체 음량", exact: true });
  await expect(tabSlider).toHaveValue("65");
  // 소리 tab → card.
  await setRange(tabSlider, 25);
  await page.getByRole("tab", { name: "빅타민", exact: true }).click();
  await expect(panel.locator(".rhh-companion-sound").getByRole("slider", { name: "전체 음량", exact: true })).toHaveValue("25");
});

test("with the site sound off the row is dimmed and says why", async ({ page }) => {
  const panel = await open(page, false, false);
  const card = panel.locator(".rhh-companion-sound");
  const site = card.getByRole("slider", { name: "전체 음량", exact: true });
  // Blocked rows stay operable with their value: dimmed and explained, not disabled.
  await expect(site).toBeEnabled(); await expect(site).toHaveValue("40");
  await expect(card.locator(".role-help-haptics.is-blocked").filter({ has: page.getByRole("slider", { name: "전체 음량", exact: true }) })).toHaveCount(1);
  await expect(card.getByText("사이트 효과음이 꺼져 있어요", { exact: true })).toBeVisible();
  await card.screenshot({ path: `${output}/card-sound-off.png` });
});
