import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { safeCompanionSurfaces } from "@/lib/ui/viewer-companion/geometry";
import { chooseCompanionCare } from "./helpers/companion-home";

const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const heart = (page: Page) => page.locator("#companion-runtime-heart");
const posts = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
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
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function cardAnchor(page: Page, card: Locator) {
  const geometry = await card.evaluate(element => {
    const root = element.closest(".poster-page")!;
    const rect = (box: DOMRect) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom });
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,svg,.sr-only,[hidden]")) continue;
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (box.width > 0 && box.height > 0) obstacles.push(rect(box));
    }
    const lines: { x: number; y: number; width: number }[] = [];
    for (const title of element.querySelectorAll(".event-main p,.event-subs li")) {
      range.selectNodeContents(title);
      for (const box of range.getClientRects()) if (box.width > 0 && box.height > 0) lines.push({ x: box.left, y: box.top - 3, width: box.width });
    }
    range.detach();
    return { obstacles, lines, viewport: { width: innerWidth, height: innerHeight } };
  });
  // Reuse the pure clearance helper to select a reachable fixture anchor; this
  // runtime test verifies binding/heart behavior, not a second geometry engine.
  return geometry.lines.flatMap(line => safeCompanionSurfaces(line, geometry.obstacles, 76, geometry.viewport))
    .sort((a, b) => b.width - a.width)[0];
}

async function addSyntheticHeart(page: Page, humanPressed: boolean) {
  await page.evaluate(() => document.fonts.ready);
  let card: Locator | undefined;
  for (const candidate of await page.locator(".public-event[data-eventid]:visible:not(.teaser)").all()) {
    if (await cardAnchor(page, candidate)) { card = candidate; break; }
  }
  expect(card, "fixture must expose an actual safe title ledge for the companion").toBeTruthy();
  const target = card!;
  const id = await target.getAttribute("data-eventid");
  expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/);
  await target.evaluate((card, pressed) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "event-heart"; button.id = "companion-runtime-heart";
    button.setAttribute("aria-label", "Synthetic human heart");
    button.setAttribute("aria-pressed", String(pressed)); button.setAttribute("data-native-clicks", "0");
    button.style.cssText = "position:absolute;right:4px;top:4px;width:24px;height:24px;display:block;opacity:1;pointer-events:auto;z-index:5";
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21 3 11a5 5 0 0 1 9-6 5 5 0 0 1 9 6Z"/></svg>';
    const count = document.createElement("span"); count.id = "companion-runtime-human-count"; count.textContent = "17";
    count.style.cssText = "position:absolute;right:32px;top:32px;font-size:10px";
    button.addEventListener("click", () => {
      button.setAttribute("data-native-clicks", String(Number(button.getAttribute("data-native-clicks")) + 1));
      button.setAttribute("aria-pressed", "true"); count.textContent = String(Number(count.textContent) + 1);
    });
    card.append(count, button);
  }, humanPressed);
  return { card: target, id: id! };
}

async function standOnCard(page: Page) {
  await expect(actor(page)).toBeVisible();
  const { card } = await addSyntheticHeart(page, false);
  const home = page.getByRole("region", { name: "빅타민 집", exact: true });
  if (!(await home.isVisible())) await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await chooseCompanionCare(page, "옮길 곳 고르기");
  const anchor = (await cardAnchor(page, card))!;
  expect(anchor).toBeTruthy();
  await page.mouse.click(anchor.x + anchor.width / 2, anchor.y);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-/, { timeout: 5000 });
}

test("the real companion toggles only its violet souvenir and remembers both states after reload", async ({ page }) => {
  test.setTimeout(95_000);
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
  expect(await heart(page).evaluate(button => getComputedStyle(button, "::before").content)).toBe("none");
  await page.screenshot({ path: ".scratch-pw/companion-heart-runtime-added.png" });
  await page.reload();
  await expect(actor(page)).toBeVisible();
  await standOnCard(page);
  await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
  await expect(heart(page)).not.toHaveAttribute("data-companion-heart-blocked");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  await expect(pet(page)).toHaveAttribute("data-heart-result", "removed", { timeout: 45_000 });
  await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
  await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
  await page.reload();
  await expect(actor(page)).toBeVisible();
  await addSyntheticHeart(page, false);
  await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
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

for (const input of ["pointer", "keyboard"] as const) {
  test(`the bundled adapter consumes the first purple ${input} click and preserves the following human handler`, async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await expect(actor(page)).toBeVisible();
    await page.evaluate(() => {
      const preferences = { ...JSON.parse(localStorage.getItem("vic.viewerCompanion")!), roam: false, heartPrank: false };
      localStorage.setItem("vic.viewerCompanion", JSON.stringify(preferences));
      window.dispatchEvent(new CustomEvent("vic:viewer-companion", { detail: preferences }));
    });
    const { id } = await addSyntheticHeart(page, false);
    await page.evaluate(id => {
      const value = JSON.stringify({ version: 1, ids: [id] });
      localStorage.setItem("vic.viewerCompanion.hearts", value);
      window.dispatchEvent(new StorageEvent("storage", { key: "vic.viewerCompanion.hearts", newValue: value }));
    }, id);
    await expect(heart(page)).toHaveAttribute("data-companion-hearted", "");
    if (input === "pointer") await heart(page).locator("svg path").click();
    else { await heart(page).focus(); await page.keyboard.press("Enter"); }
    await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "false");
    await expect(heart(page)).toHaveAttribute("data-native-clicks", "0");
    await expect(page.locator("#companion-runtime-human-count")).toHaveText("17");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!))).toEqual({ version: 1, ids: [] });
    expect(posts.get(page)).toEqual([]);

    // The fixture has no authenticated real-heart prop. Its inserted native
    // sentinel verifies original-handler delivery, not server authorization.
    if (input === "pointer") { await heart(page).focus(); await page.keyboard.press("Enter"); }
    else await heart(page).locator("svg path").click();
    await expect(heart(page)).toHaveAttribute("data-native-clicks", "1");
    await expect(heart(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#companion-runtime-human-count")).toHaveText("18");
    await expect(heart(page)).not.toHaveAttribute("data-companion-hearted");
  });
}
