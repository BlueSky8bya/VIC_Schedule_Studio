import { expect, test, type Page } from "@playwright/test";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY, PREMIERE_STAGE_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

type Probe = Window & { popoverLayoutProbe?: { reads: number; original: typeof Element.prototype.getBoundingClientRect } };
const proof = new WeakMap<Page, { posts: string[]; errors: string[] }>();
test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const result = { posts: [] as string[], errors: [] as string[] }; proof.set(page, result);
  page.on("pageerror", error => result.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      result.posts.push(url.pathname); return route.fulfill({ status: 500, body: "blocked fixture mutation" });
    }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { isLive: false } });
    if (url.pathname.includes("/teaser-state")) return route.fulfill({ json: { ok: true, schemaVersion: 1, sampledAtDbMs: Date.now(), entries: [] } });
    return route.continue();
  });
  await page.addInitScript(({ epoch, epochKey, stageKey, preferences }) => {
    localStorage.setItem(epochKey, epoch);
    for (const [key, value] of Object.entries({ "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", [stageKey]: "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false }));
    // Count real DOM geometry calls on the actual selected card/panel. This
    // observer never changes coordinates, product callbacks or elapsed time.
    const original = Element.prototype.getBoundingClientRect;
    const state = { reads: 0, original }; (window as Probe).popoverLayoutProbe = state;
    Element.prototype.getBoundingClientRect = function () {
      if (this.hasAttribute("data-popover-budget")) state.reads++;
      return original.call(this);
    };
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, stageKey: PREMIERE_STAGE_KEY, preferences: DEFAULT_COMPANION_PREFERENCES });
});
test.afterEach(async ({ page }) => { expect(proof.get(page)).toEqual({ posts: [], errors: [] }); });

async function reads(page: Page) { return page.evaluate(() => (window as Probe).popoverLayoutProbe!.reads); }
async function reset(page: Page) { await page.evaluate(() => { (window as Probe).popoverLayoutProbe!.reads = 0; }); }

for (const surface of ["viewer", "studio"] as const) test(`${surface} open popover has no idle geometry loop and preserves native scroll, resize and drag`, async ({ page }) => {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator(surface === "viewer" ? ".public-event[data-eventid]:not(.teaser)" : '.studio-event-pill[data-companion-event="ordinary"]').first();
  await card.scrollIntoViewIfNeeded(); await expect(card).toBeVisible();
  await card.evaluate(node => node.setAttribute("data-popover-budget", ""));
  if (surface === "viewer") await card.locator(".event-main p").first().click();
  else await card.locator(".pill-main strong").dblclick();
  const panel = page.locator(surface === "viewer" ? ".agenda-detail-sheet" : ".event-editor-panel.is-edit");
  await expect(panel).toBeVisible();
  await panel.evaluate(node => node.setAttribute("data-popover-budget", ""));
  await page.waitForTimeout(1500); // actual entrance/ResizeObserver/spring lease
  await reset(page); await page.waitForTimeout(700);
  expect(await reads(page), "settled open windows must not keep reading card/panel geometry").toBe(0);

  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto";
    document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.style.height = "1200px"; spacer.setAttribute("aria-hidden", "true"); document.body.append(spacer);
  });
  await reset(page);
  await page.mouse.wheel(0, 90);
  await expect.poll(() => reads(page)).toBeGreaterThan(0);
  await page.waitForTimeout(1200); await reset(page); await page.waitForTimeout(500);
  expect(await reads(page)).toBe(0);

  await page.setViewportSize({ width: 1760, height: 1080 });
  await expect.poll(() => reads(page)).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  const grip = panel.locator(surface === "viewer" ? ".detail-grab" : ".editor-grab");
  const before = await panel.boundingBox(), handle = await grip.boundingBox();
  expect(before).not.toBeNull(); expect(handle).not.toBeNull();
  // Move inward, avoiding viewport clamps on either surface.
  const dx = before!.x > 850 ? -65 : 65;
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down(); await page.mouse.move(handle!.x + handle!.width / 2 + dx, handle!.y + handle!.height / 2 + 24, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(1200);
  const after = await panel.boundingBox(); expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x - dx)).toBeLessThan(4);
  expect(Math.abs(after!.y - before!.y - 24)).toBeLessThan(4);
  await reset(page); await page.waitForTimeout(700); expect(await reads(page)).toBe(0);
  await page.screenshot({ path: `.scratch-pw/platform-080-popover-${surface}.png` });
});
