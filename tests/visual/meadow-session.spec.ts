import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { enterCompanionMeadow, placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";

const output = process.env.MEADOW_SESSION_OUTPUT ?? ".scratch-pw/meadow-session-proof";
const fonts = new Set([...readFileSync("app/fonts.css", "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", video: { mode: "on", size: { width: 1920, height: 1080 } }, trace: "retain-on-failure" });
test.setTimeout(110000);
test.beforeEach(async ({ page, context, baseURL }) => {
  mkdirSync(output, { recursive: true }); const origin = new URL(baseURL!).origin;
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, []);
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Credential-free meadow ownership fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, epoch, epochKey }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", v: 3, at: Date.now() }));
    localStorage.setItem("vic.ambient", "on"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.premiereStage", "off"); localStorage.setItem("vic_avatar_side", "left");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false, activeWhileVisible: true, personality: "balanced", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care, fullness: .98, energy: .95 }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY });
});

async function dragTo(page: Page, item: Locator, point: { x: number; y: number }) {
  const bounds = (await item.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 14 }); await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2);
}
async function foot(item: Locator) { const box = (await item.boundingBox())!; return { x: box.x + box.width / 2, y: box.y + box.height }; }
async function settledBox(item: Locator) {
  let previous: Awaited<ReturnType<Locator["boundingBox"]>>, stable = 0;
  await expect.poll(async () => {
    const current = await item.boundingBox();
    stable = current && previous && Math.max(Math.abs(current.x - previous.x), Math.abs(current.y - previous.y), Math.abs(current.width - previous.width), Math.abs(current.height - previous.height)) < .25 ? stable + 1 : 0;
    previous = current; return stable;
  }, { intervals: [60], timeout: 5000 }).toBeGreaterThanOrEqual(3);
  return previous!;
}
async function layoutCovers(page: Page) {
  return page.evaluate(() => {
    const selector = ".public-calendar-area,.public-calendar-header,.studio-calendar-panel,.studio-topbar,.studio-titlebar,.weekday-row,.studio-weekdays,.panel-section,.rail-info-card,.soop-live-beacon,.vc-home,.event-editor-panel,[role=dialog],button,a[href],input,select,textarea";
    return [...document.querySelectorAll<HTMLElement>(selector)].filter(node => {
      if (node.closest("[hidden],[aria-hidden=true],.vc-companion,.vc-meadow-walk,.vc-food-layer,.vc-toys,.gs-season,.gs-tide,.showcase-surface")) return false;
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) { const s = getComputedStyle(parent); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity || 1) <= .05) return false; }
      return true;
    }).map(node => { const r = node.getBoundingClientRect(); return { className: node.className, label: node.getAttribute("aria-label"), x: r.x, y: r.y, width: r.width, height: r.height }; }).filter(r => r.width > 0 && r.height > 0);
  });
}
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > .5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > .5;

for (const surface of ["viewer", "owner", "preview"] as const) {
  test(`meadow ${surface}: only exposed real objects travel and covered placements remain until screen departure`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1920, height: 1100 });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : `/visual-fixture/studio?role=owner&y=2026&m=4${surface === "preview" ? "&viewer=1" : ""}`);
    await page.bringToFront(); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const home = await openCompanionHome(page), fold = home.locator('[data-home-action="fold"]');
    if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
    await placeCompanionOnHomeFloor(page);
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    const food = page.locator(".vc-food").first(), toy = page.locator(".vc-toy").first(), pet = page.locator(".vc-meadow-walk"), drawing = pet.locator(".vc-meadow-walk-body");
    await expect(food).toBeVisible(); await expect(food).not.toHaveAttribute("data-falling");
    await expect(toy).toBeVisible(); await expect(toy).toHaveAttribute("data-falling", "false");
    const identity = { food: await food.getAttribute("data-food"), toy: await toy.getAttribute("data-toy-id") };
    await enterCompanionMeadow(page);
    await expect(pet).toHaveCount(0); await expect(food).toBeHidden(); await expect(toy).toBeHidden();
    await expect(food).not.toHaveAttribute("data-showcase-lease"); await expect(toy).not.toHaveAttribute("data-showcase-lease");
    await page.keyboard.press("Escape"); await expect(food).toBeVisible(); await expect(toy).toBeVisible();

    // Native drag throws settle on the actual screen floor before admission.
    await dragTo(page, food, { x: 90, y: 990 }); await expect(food).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/, { timeout: 7000 });
    await dragTo(page, toy, { x: 180, y: 990 }); await expect(toy).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/, { timeout: 7000 });
    await placeCompanionOnExposedBackground(page, 280);
    await enterCompanionMeadow(page); await expect(pet).toBeVisible(); await expect(food).toBeVisible(); await expect(toy).toBeVisible();
    await expect(food).toHaveAttribute("data-showcase-lease", ""); await expect(toy).toHaveAttribute("data-showcase-lease", "");
    const keyboard: Record<string, { before: { x: number; y: number }; after: { x: number; y: number } }> = {};
    for (const [kind, item] of [["food", food], ["toy", toy], ["pet", drawing]] as const) {
      await item.focus(); const before = await foot(item); await item.press("ArrowRight"); const after = await foot(item);
      expect(after.x - before.x).toBeCloseTo(16, 1); expect(after.y - before.y).toBeCloseTo(0, 1);
      keyboard[kind] = { before, after };
    }
    const calendar = page.locator(surface === "owner" ? ".studio-calendar-panel" : ".public-calendar-area").first();
    const cover = (await calendar.boundingBox())!, target = { x: cover.x + cover.width * .52, y: Math.min(900, cover.y + cover.height * .55) };
    await dragTo(page, food, { x: target.x - 90, y: target.y }); await dragTo(page, toy, { x: target.x + 90, y: target.y }); await dragTo(page, drawing, { x: target.x, y: target.y - 100 });
    const placed = { food: await foot(food), toy: await foot(toy), pet: await foot(drawing) };
    await page.keyboard.press("Escape"); await expect(food).toBeHidden(); await expect(toy).toBeHidden(); await expect(pet).toBeHidden(); await expect(page.locator(".vc-companion")).toBeHidden();
    await expect(home).toBeVisible(); await expect(home.locator('[data-home-action="toys"]')).toBeEnabled();
    const beforeDispense = { foods: await page.locator(".vc-food").count(), toys: await page.locator(".vc-toy").count() };
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    await expect(page.locator(".vc-food")).toHaveCount(beforeDispense.foods + 1);
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    await expect(page.locator(".vc-toy")).toHaveCount(beforeDispense.toys + 1);
    await expect(page.locator(".vc-toy").last()).toHaveAttribute("data-falling", "false", { timeout: 7000 });
    await expect(pet).toBeHidden(); await expect(page.locator(".vc-companion")).toBeHidden();
    await page.waitForTimeout(1200); await enterCompanionMeadow(page);
    await expect(food).toBeVisible(); await expect(toy).toBeVisible(); await expect(pet).toBeVisible();
    const restored = { food: await foot(food), toy: await foot(toy), pet: await foot(drawing) };
    for (const kind of ["food", "toy", "pet"] as const) expect(Math.hypot(placed[kind].x - restored[kind].x, placed[kind].y - restored[kind].y)).toBeLessThan(2);
    await expect(food).toHaveAttribute("data-food", identity.food!); await expect(toy).toHaveAttribute("data-toy-id", identity.toy!);
    await page.screenshot({ path: `${output}/${surface}-restored-placements.png` });
    let dynamicCover: unknown;
    if (surface === "viewer") {
      // At 1280px the ordinary calendar fills x20..1260. There was no
      // exposed grass at x220, so that earlier fixture correctly hid items.
      // Instead measure a real layout change: expanding the native tag card
      // pushes the house over a previously exposed band of grass.
      await page.keyboard.press("Escape"); await expect(home).toBeVisible();
      const tags = page.locator('[data-panel-section-toggle="tag-filter"]:visible').first();
      if (await tags.getAttribute("aria-expanded") === "true") await tags.click();
      const oldHome = await settledBox(home);
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "true");
      const expandedHome = await settledBox(home);
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "false");
      const collapsedHome = await settledBox(home), viewport = page.viewportSize()!;
      const firstFoot = Math.max(collapsedHome.y + collapsedHome.height + 56, expandedHome.y + 56), lastFoot = Math.min(expandedHome.y + expandedHome.height - 8, viewport.height - 32);
      expect(lastFoot - firstFoot).toBeGreaterThan(4);
      const chosenFoot = (firstFoot + lastFoot) / 2;
      await enterCompanionMeadow(page); await expect(food).toBeVisible(); await expect(toy).toBeVisible();
      for (const [item, fraction] of [[food, .25], [toy, .65]] as const) {
        const box = (await item.boundingBox())!;
        await dragTo(page, item, { x: collapsedHome.x + collapsedHome.width * fraction, y: chosenFoot - box.height / 2 });
      }
      await page.keyboard.press("Escape"); await expect(food).toBeVisible(); await expect(toy).toBeVisible();
      await expect(food).toHaveJSProperty("hidden", false); await expect(toy).toHaveJSProperty("hidden", false);
      const exposed = { food: (await food.boundingBox())!, toy: (await toy.boundingBox())! };
      const beforeCovers = await layoutCovers(page);
      for (const item of Object.values(exposed)) {
        expect(item.x >= 0 && item.y >= 0 && item.x + item.width <= viewport.width && item.y + item.height <= viewport.height).toBe(true);
        expect(beforeCovers.filter(cover => overlaps(item, cover))).toEqual([]);
      }
      await page.screenshot({ path: `${output}/viewer-before-dynamic-cover.png` });
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "true");
      const coveringHome = await settledBox(home);
      for (const item of Object.values(exposed)) expect(overlaps(item, coveringHome)).toBe(true);
      // These are the real item nodes' geometry visibility flags. A hidden
      // ancestor alone (for example a global modal pause) cannot satisfy this.
      await expect(food).toHaveJSProperty("hidden", true); await expect(toy).toHaveJSProperty("hidden", true);
      await expect(food).toBeHidden(); await expect(toy).toBeHidden();
      await page.screenshot({ path: `${output}/viewer-dynamic-cover.png` });
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "false"); await settledBox(home);
      await expect(food).toBeVisible(); await expect(toy).toBeVisible();
      await expect(food).toHaveJSProperty("hidden", false); await expect(toy).toHaveJSProperty("hidden", false);
      const uncovered = { food: (await food.boundingBox())!, toy: (await toy.boundingBox())! };
      for (const kind of ["food", "toy"] as const) expect(Math.hypot(exposed[kind].x - uncovered[kind].x, exposed[kind].y - uncovered[kind].y)).toBeLessThan(2);
      dynamicCover = { kind: "native-tag-expansion-shifts-real-house", viewport, oldHome, expandedHome, collapsedHome, beforeCovers, exposed, coveringHome, uncovered, childHiddenDuringCover: true, childHiddenAfterClose: false };
      await enterCompanionMeadow(page);
    }
    await page.keyboard.press("Escape");
    await expect(home).toBeVisible();
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
    await expect(pet).toHaveCount(0);
    await expect(page.locator(".vc-companion")).toBeVisible({ timeout: 7000 });
    const homeRecall = { releasedLease: true, actualVisible: true, platform: await page.locator(".vc-companion").getAttribute("data-platform"), state: await page.locator(".vc-companion").getAttribute("data-state") };
    const next = page.getByRole("button", { name: "다음 달", exact: true }).filter({ visible: true }).first();
    await next.click();
    await expect(page.locator(`[data-food="${identity.food}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${identity.toy}"]`)).toHaveCount(0); await expect(pet).toHaveCount(0);
    await page.reload(); await expect(page.locator(".vc-food,.vc-toy,.vc-meadow-walk")).toHaveCount(0);
    expect(errors).toEqual([]);
    writeFileSync(`${output}/${surface}-ownership.json`, JSON.stringify({ test: info.title, identity, keyboard, beforeDispense, placed, restored, dynamicCover, homeRecall, actual: "Native home dispense, actual drag and floor contact, pre-entry exclusion, each real object keyboard 16px movement, covered exit/re-entry with independently working home dispense, viewer native tag expansion moves the actual house over previously proven exposed objects (each child.hidden true then false), direct home recall releases lease and resumes visible ordinary actor, month departure and reload. No engine/RNG/clock/position patch; home arrival itself is not asserted.", fullCertification: false }, null, 2));
  });
}
