import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const posts = new WeakMap<Page, string[]>();
const expectedBlockedPosts = new WeakMap<Page, string[]>();
type ProbeWindow = Window & { panelRanges: number; panelWrites: number };
const section = (page: Page, key: string) => page.locator(`[data-panel-section="${key}"]:visible`);
const title = (section: Locator, name: string) => section.getByRole("button", { name, exact: true });

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ preferences, epoch, key }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "on");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.removeItem("vic.viewerCompanionCare");
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
  }, { preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, heartPrank: false, ambientPrank: false }, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
});
test.afterEach(async ({ page }) => expect(posts.get(page)).toEqual(expectedBlockedPosts.get(page) ?? []));

async function expectCenteredHeading(panel: Locator, name: string) {
  await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
  const distance = await panel.evaluate(node => {
    const header = node.querySelector<HTMLElement>(".panel-section-heading")!;
    const label = node.querySelector<HTMLElement>(".panel-section-title span")!;
    const text = document.createRange(); text.selectNodeContents(label);
    const a = header.getBoundingClientRect(), b = text.getBoundingClientRect();
    return Math.abs((a.left + a.right - b.left - b.right) / 2);
  });
  expect(distance).toBeLessThan(1);
}

async function expectWholeWordHeading(panel: Locator) {
  const words = await panel.locator(".panel-section-title span").evaluate(label => {
    const text = label.firstChild!, value = text.textContent!;
    return ["태그", "필터"].map(word => {
      const range = document.createRange(), start = value.indexOf(word);
      range.setStart(text, start); range.setEnd(text, start + word.length);
      return [...range.getClientRects()].map(rect => ({ top: rect.top, left: rect.left, right: rect.right }));
    });
  });
  // Real glyph geometry: each Korean word occupies one line, and the narrow
  // rail wraps at the space instead of splitting "필터" into two fragments.
  expect(words.map(rects => rects.length)).toEqual([1, 1]);
  expect(words[1][0].top).toBeGreaterThan(words[0][0].top);
  expect(Math.abs((words[0][0].left + words[0][0].right - words[1][0].left - words[1][0].right) / 2)).toBeLessThan(1);
}

test("anonymous desktop cards fold independently, retain state and keep the resident's home", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  const tag = section(page, "tag-filter"), ambient = section(page, "season"), home = section(page, "companion-home");
  for (const [panel, name] of [[tag, "태그 필터"], [ambient, "계절 배경"], [home, "빅타민 집"]] as const) {
    await expect(panel).toHaveCount(1); await expectCenteredHeading(panel, name);
    await expect(title(panel, name)).toHaveAttribute("aria-expanded", "true");
  }
  const selected = tag.locator(".legend-item").first(); await selected.click();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  const ambientBytes = await page.evaluate(() => localStorage.getItem("vic.ambient"));
  const expandedHeight = (await tag.boundingBox())!.height;
  await title(tag, "태그 필터").focus(); await title(tag, "태그 필터").press("Enter");
  await expect(title(tag, "태그 필터")).toHaveAttribute("aria-expanded", "false");
  await expect(tag.locator(".panel-section-body")).toHaveAttribute("hidden", "");
  await expect(selected).toHaveCount(1); await expect(selected).toBeHidden();
  expect((await tag.boundingBox())!.height).toBeLessThan(expandedHeight - 50);
  await expect(title(ambient, "계절 배경")).toHaveAttribute("aria-expanded", "true");
  await title(ambient, "계절 배경").click();
  await expect(ambient.getByRole("radiogroup", { includeHidden: true })).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("vic.ambient"))).toBe(ambientBytes);
  await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  const pet = page.locator(".vc-companion");
  await expect(pet).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
  await title(home, "빅타민 집").click();
  await expect(home.locator(".vc-home-cushion")).toHaveCount(1);
  await expect(home.locator(".vc-home-cushion")).toBeHidden(); await expect(pet).toBeHidden();
  await expect(pet).toHaveAttribute("data-platform", "companion-home");
  await title(home, "빅타민 집").press("Space");
  await expect(pet).toBeVisible(); await expect(pet).toHaveAttribute("data-platform", "companion-home");
  await title(tag, "태그 필터").click(); await expect(selected).toBeVisible();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(title(ambient, "계절 배경")).toHaveAttribute("aria-expanded", "false");
  // Exercise the focus-event branch explicitly; this is not native OS blur or
  // an OBS benchmark. The clock and the actual geometry observer remain real.
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
    dispatchEvent(new FocusEvent("blur"));
  });
  // The existing cushion command owns a finite12s nap. Visible blur honours
  // that action before its700ms rest +900ms yawn, rather than cancelling it.
  await expect(pet).toHaveAttribute("data-presence", "parked", { timeout: 18_000 });
  await page.evaluate(() => {
    const probe = window as unknown as ProbeWindow; probe.panelRanges = 0; probe.panelWrites = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.panelRanges++; return original.call(this); };
    new MutationObserver(records => { probe.panelWrites += records.length; }).observe(document.querySelector(".vc-companion")!, { subtree: true, attributes: true, attributeFilter: ["style", "data-state", "data-presence", "data-platform", "data-dreaming", "hidden"] });
  });
  for (const expanded of [false, true]) {
    await title(home, "빅타민 집").click();
    await expect(title(home, "빅타민 집")).toHaveAttribute("aria-expanded", String(expanded));
    await expect(pet).toHaveAttribute("data-platform", "companion-home");
    if (expanded) await expect(pet).toBeVisible(); else await expect(pet).toBeHidden();
    await page.waitForTimeout(1400); // allow the finite900ms follow + final120ms scan
    await page.evaluate(() => { const probe = window as unknown as ProbeWindow; probe.panelRanges = 0; probe.panelWrites = 0; });
    await page.locator(".public-event .event-main p").first().evaluate((node, spacing) => { (node as HTMLElement).style.letterSpacing = spacing; }, expanded ? ".02em" : ".01em");
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => ({ ranges: (window as unknown as ProbeWindow).panelRanges, writes: (window as unknown as ProbeWindow).panelWrites, hidden: document.hidden, focused: document.hasFocus() }))).toEqual({ ranges: 0, writes: 0, hidden: false, focused: false });
    await expect(pet).toHaveAttribute("data-presence", "parked");
  }
  await page.evaluate(() => { Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true }); dispatchEvent(new FocusEvent("focus")); });
  await expect(pet).toHaveAttribute("data-presence", "active");
  expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
  await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-companion")).toHaveCount(0);
  await page.screenshot({ path: ".scratch-pw/panel-section-desktop.png" });
});

test.describe("real touch disclosures", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("agenda and compact home keep the same heading and independent touch disclosure", async ({ page }) => {
    await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
    const tag = section(page, "tag-filter"); await expectCenteredHeading(tag, "태그 필터"); await expectWholeWordHeading(tag);
    const heading = title(tag, "태그 필터"), height = (await tag.boundingBox())!.height;
    expect((await heading.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await heading.tap(); await expect(heading).toHaveAttribute("aria-expanded", "false");
    expect((await tag.boundingBox())!.height).toBeLessThan(height - 50);
    await openCompanionHome(page, "touch");
    const home = section(page, "companion-home"); await expectCenteredHeading(home, "빅타민 집");
    await title(home, "빅타민 집").tap(); await expect(home).toBeVisible();
    await expect(home.locator(".vc-home-cushion")).toHaveCount(1); await expect(home.locator(".vc-home-cushion")).toBeHidden();
    await expect(home.getByRole("button", { name: "빅타민 집 닫기", exact: true })).toBeVisible();
    await expect(heading).toHaveAttribute("aria-expanded", "false");
    await title(home, "빅타민 집").tap(); await expect(home.locator(".vc-home-cushion")).toBeVisible();
    await heading.tap(); await expect(tag.locator(".agenda-legend-tag").first()).toBeVisible();
    await page.screenshot({ path: ".scratch-pw/panel-section-touch.png" });
  });
});

test("studio headings are centered without folding while its viewer preview uses the same disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/studio"); await page.evaluate(() => document.fonts.ready);
  let tag = section(page, "tag-filter"); await expectCenteredHeading(tag, "태그 필터");
  await expect(title(tag, "태그 필터")).toHaveCount(0);
  await expect(tag.locator(".tag-legend-filter").first()).toBeVisible();
  await page.screenshot({ path: ".scratch-pw/panel-section-studio.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  tag = section(page, "tag-filter"); await expectCenteredHeading(tag, "태그 필터");
  await expectWholeWordHeading(tag);
  await expect(title(tag, "태그 필터")).toHaveCount(0); await expect(tag.locator(".agenda-legend-tag").first()).toBeVisible();
  await page.screenshot({ path: ".scratch-pw/panel-section-studio-agenda.png" });
  await page.setViewportSize({ width: 1920, height: 1100 });
  // Studio preview refreshes its public snapshot through one read-only server
  // action. Block that POST as well: the initial sanitized fixture is enough
  // for this UI check, and no request is ever forwarded to a real database.
  expectedBlockedPosts.set(page, ["http://127.0.0.1:3100/visual-fixture/studio?viewer=1"]);
  await page.goto("/visual-fixture/studio?viewer=1");
  tag = section(page, "tag-filter"); await expectCenteredHeading(tag, "태그 필터");
  await title(tag, "태그 필터").click(); await expect(title(tag, "태그 필터")).toHaveAttribute("aria-expanded", "false");
  const ambient = section(page, "season"); await title(ambient, "계절 배경").click();
  await expect(title(ambient, "계절 배경")).toHaveAttribute("aria-expanded", "false");
  await expect(section(page, "companion-home").getByRole("heading", { name: "빅타민 집", exact: true })).toBeVisible();
  await page.screenshot({ path: ".scratch-pw/panel-section-preview.png" });
});
