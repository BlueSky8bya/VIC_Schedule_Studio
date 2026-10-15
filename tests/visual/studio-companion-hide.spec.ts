import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const editor = (page: Page) => page.locator(".event-editor-panel.is-edit");
const CARD = '.studio-event-pill[data-companion-event="ordinary"][data-eventid]';
const transport = new WeakMap<Page, { posts: string[]; errors: string[] }>();

test.afterEach(async ({ page }) => {
  const observed = transport.get(page)!;
  writeFileSync(".scratch-pw/companion-063-studio-hide-transport.json", JSON.stringify(observed, null, 2));
  expect(observed.posts).toEqual([]); expect(observed.errors).toEqual([]);
});

test.use({ viewport: { width: 1920, height: 1100 } });
test("a real public editor discovers its hidden guest in the content field and native extraction preserves the editor", async ({ page }) => {
  test.setTimeout(110000);
  const posts: string[] = [], errors: string[] = [];
  transport.set(page, { posts, errors });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { posts.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    // Only the rare utility draw is controlled. The45s grace, native card
    // placement, editor entrance and every pointer action use real browser time.
    let draw = 0; Math.random = () => (++draw % 3 ? 0 : .999999);
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: true },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1, curiosity: .9 } });
  await page.goto("/visual-fixture/studio?role=owner"); await page.bringToFront();
  await page.evaluate(() => document.fonts.ready); await expect(actor(page)).toBeVisible();
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  const target = await page.locator(CARD).evaluateAll((nodes, selector) => {
    const cards = nodes.map((node, index) => ({ node, index, r: node.getBoundingClientRect() }));
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button],.vc-home")]
      .filter(node => !node.matches(`${selector},.studio-day`) && !node.closest(".vc-companion"))
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    for (const card of cards) {
      const r = card.r; if (r.width < 92 || r.height <= 0 || r.top < 260 || r.top > innerHeight - 140) continue;
      for (const f of [.5, .75, .25]) {
        const x = r.left + r.width * f, y = r.top - 24;
        const body = { left: x - 38, right: x + 38, top: r.top - 76, bottom: r.top - 3 };
        if (x < 50 || x > innerWidth - 50 || controls.some(c => c.left < body.right && c.right > body.left && c.top < body.bottom && c.bottom > body.top)) continue;
        const first = cards.filter(c => c.r.width > 0 && c.r.height > 0 && x >= c.r.left && x <= c.r.right && c.r.top > y).sort((a, b) => a.r.top - b.r.top)[0];
        if (first?.node === card.node) return { index: card.index, x, y, id: (card.node as HTMLElement).dataset.eventid! };
      }
    }
    return null;
  }, CARD);
  expect(target, "a real ordinary card top with full-body/control clearance").not.toBeNull();
  await page.mouse.click(target!.x, target!.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden", { timeout: 75000 });
  await expect(pet(page)).toHaveAttribute("data-hide-event", target!.id); await expect(pet(page)).toBeHidden();

  const card = page.locator(CARD).nth(target!.index);
  await card.locator(".pill-main strong").dblclick();
  await expect(editor(page)).toBeVisible();
  await expect(editor(page)).toHaveAttribute("data-companion-detail-event", target!.id);
  await expect(editor(page)).toHaveAttribute("data-companion-detail-ready", "");
  await expect(pet(page)).toHaveAttribute("data-detail-guest", ""); await expect(pet(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-hide-perch", "inside");
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect(pet(page)).toHaveAttribute("data-dreaming", "");
  const input = editor(page).locator("[data-companion-editor-perch][contenteditable=true]");
  const value = await input.innerText();
  await expect(input.locator(".vc-companion,.vc-actor,.vc-dream")).toHaveCount(0);
  const geometry = await input.evaluate(node => {
    const field = node.getBoundingClientRect(), cell = document.querySelector(".vc-companion")!.getBoundingClientRect();
    const body = { left: cell.left + cell.width * .12, right: cell.right - cell.width * .12, top: cell.top + cell.height * .24, bottom: cell.bottom };
    const text: DOMRect[] = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) { range.selectNodeContents(n); text.push(...range.getClientRects()); }
    return { field: { left: field.left, top: field.top, right: field.right, bottom: field.bottom }, body,
      textOverlap: text.reduce((sum, r) => sum + Math.max(0, Math.min(r.right, body.right) - Math.max(r.left, body.left)) * Math.max(0, Math.min(r.bottom, body.bottom) - Math.max(r.top, body.top)), 0),
      ownsActor: document.querySelector(".event-editor-panel")!.getAttribute("aria-owns")?.split(/\s+/).includes(document.querySelector(".vc-actor")!.id),
      autoFocusedActor: document.activeElement === document.querySelector(".vc-actor") };
  });
  expect(geometry.body.left).toBeGreaterThanOrEqual(geometry.field.left); expect(geometry.body.right).toBeLessThanOrEqual(geometry.field.right);
  expect(geometry.body.top).toBeGreaterThanOrEqual(geometry.field.top); expect(geometry.body.bottom).toBeLessThanOrEqual(geometry.field.bottom);
  expect(geometry.textOverlap).toBeLessThan(.25); expect(geometry.ownsActor).toBe(true); expect(geometry.autoFocusedActor).toBe(false);
  await page.screenshot({ path: ".scratch-pw/companion-063-studio-editor-doze.png" });

  const start = (await actor(page).boundingBox())!, panel = (await editor(page).boundingBox())!;
  const grip = { x: start.x + start.width / 2, y: start.y + start.height * .55 };
  const destination = { x: panel.x > 150 ? panel.x - 70 : panel.x + panel.width + 70, y: grip.y };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 18 }); await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
  await page.mouse.up(); await expect(editor(page)).toBeVisible(); await expect(pet(page)).toBeVisible();
  await expect(input).toHaveText(value); await expect(input.locator(".vc-companion,.vc-actor,.vc-dream")).toHaveCount(0);
  await input.click(); await expect(input).toBeFocused();
  // Native keyboard activation permits the existing editor and settings to
  // coexist. The lower guest must yield to the foreground window immediately.
  const settingsGear = page.locator(".stool-settings"); await settingsGear.focus(); await settingsGear.press("Enter");
  const settings = page.getByRole("dialog", { name: "설정", exact: true }); await expect(settings).toBeVisible();
  await expect(editor(page)).not.toHaveAttribute("data-companion-detail-event");
  await expect(pet(page)).not.toHaveAttribute("data-detail-guest");
  // Match the keyboard-opened coexistence path. An unrelated pointer outside
  // the editor retains its pre-existing dismissal policy (gear tests cover X).
  const settingsClose = settings.locator(".modal-head .modal-close"); await settingsClose.focus(); await settingsClose.press("Enter");
  await expect(settings).toHaveCount(0);
  await expect(editor(page)).toBeVisible(); await expect(editor(page)).toHaveAttribute("data-companion-detail-event", target!.id);
  await expect(pet(page)).not.toHaveAttribute("data-detail-guest");
  await expect(input).toHaveText(value);
  await editor(page).getByRole("button", { name: /^옵션/ }).click();
  await editor(page).getByRole("button", { name: "일정 최초공개", exact: true }).click();
  await expect(editor(page)).not.toHaveAttribute("data-companion-detail-event");
  await expect(pet(page)).not.toHaveAttribute("data-detail-guest");
  await expect(editor(page)).toBeVisible(); await expect(input).toHaveText(value);
  expect(posts).toEqual([]); expect(errors).toEqual([]);
  writeFileSync(".scratch-pw/companion-063-studio-hide.json", JSON.stringify({ controlledRandom: true, clockControlled: false, nativePublicEditor: true, geometry, extractionKeepsEditor: true, foregroundRevokesGuestWithoutReentry: true, teaserRevokesGuest: true, posts, errors }, null, 2));
});
