import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

// Owner 2026-11-20 "창이 떠 있어도 놀기". OFF (default): an ordinary window lets
// the current action finish, then the creature rests quietly. ON: it keeps its
// ordinary life underneath the window and its backdrop, and takes no input.
const pet = (page: Page) => page.locator(".vc-companion");
const shots = ".scratch-pw/play-behind";
test.use({ viewport: { width: 1920, height: 1000 } });

async function seed(page: Page, { on, dark, pranks = false }: { on: boolean; dark: boolean; pranks?: boolean }) {
  const posts: string[] = [];
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST") { posts.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (request.method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, body: "unused fixture navigation" });
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.route("**/api/public/*/broadcast?**", route => route.request().method() === "GET" ? route.fulfill({ json: { months: [], daily: Array(30).fill(0) } }) : route.fallback());
  await page.addInitScript(({ prefs, care, key, epoch, dark, hunger }) => {
    // The page is the focused window: only the open in-site window differs.
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
    // Witness of anything the creature does to the page while a window is open.
    const probe = (window as unknown as ProbeWindow).behindProbe = { open: false, events: [] as string[] };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) { if (probe.open) probe.events.push("media-play"); return play.apply(this, args); };
    new MutationObserver(records => {
      if (!probe.open) return;
      for (const record of records) {
        const node = record.target as HTMLElement, name = record.attributeName!;
        if (name === "data-vc-ruffled" && node.hasAttribute(name)) probe.events.push("card-tilt");
        if (name === "data-hide-event" && node.hasAttribute(name)) probe.events.push("hide");
        if (name === "data-state" && node.classList.contains("vc-companion") && ["heart", "hide", "panel", "eat"].includes(node.dataset.state ?? "")) probe.events.push(`state-${node.dataset.state}`);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-vc-ruffled", "data-hide-event", "data-state"] });
    const store = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) { if (probe.open && name === "vic_avatar_side") probe.events.push(`panel-side-${value}`); return store.call(this, name, value); };
    localStorage.setItem(key, epoch); localStorage.setItem("vic.dark", dark ? "on" : "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.premiereStage", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, energy: .95, hunger }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
  }, { prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, playBehindWindows: on, sleep: false, feeding: pranks, heartPrank: pranks, cardPrank: pranks, ambientPrank: pranks, panelPrank: pranks, rarePrank: pranks, learnFromYou: false }, care: DEFAULT_COMPANION_CARE, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, dark, hunger: pranks ? .85 : .05 });
  return posts;
}
type ProbeWindow = Window & { behindProbe: { open: boolean; events: string[] } };
const openProbe = (page: Page, open: boolean) => page.evaluate(open => { const probe = (window as unknown as ProbeWindow).behindProbe; probe.open = open; return [...probe.events]; }, open);
const railLeft = (page: Page) => page.locator(".vc-home-host").first().evaluate(node => Math.round(node.getBoundingClientRect().left));

async function settle(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await expect(pet(page).locator(".vc-actor")).toBeVisible();
}

/** Samples the drawn body for a while: where it stood and what it was doing. */
async function watch(page: Page, ms: number) {
  return page.evaluate(async ms => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!, samples: { x: number; y: number; state: string; presence: string }[] = [];
    const end = performance.now() + ms;
    while (performance.now() < end) {
      const r = node.getBoundingClientRect();
      samples.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom), state: node.dataset.state ?? "", presence: node.dataset.presence ?? "" });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const xs = samples.map(s => s.x), ys = samples.map(s => s.y);
    return { travel: Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys), states: [...new Set(samples.map(s => s.state))], presences: [...new Set(samples.map(s => s.presence))], last: samples.at(-1)! };
  }, ms);
}

/** The window paints and hit-tests over the creature; the creature is not interactive. */
async function expectUnderWindow(page: Page, dialog: Locator) {
  const stack = await dialog.evaluate(windowNode => {
    const z = (node: Element) => Number(getComputedStyle(node).zIndex) || 0;
    // The window's own stacking layer: its highest positioned ancestor (the backdrop).
    let layer = 0; for (let node: Element | null = windowNode; node && node !== document.body; node = node.parentElement) layer = Math.max(layer, z(node));
    const petNode = document.querySelector(".vc-companion")!, actor = petNode.querySelector<HTMLElement>(".vc-actor")!;
    return { pet: z(petNode), window: layer, pointer: getComputedStyle(actor).pointerEvents, tab: actor.tabIndex };
  });
  expect(stack.pet).toBeGreaterThan(0); expect(stack.pet).toBeLessThan(stack.window);
  expect(stack.pointer).toBe("none"); expect(stack.tab).toBe(-1);
  // Wherever body and window overlap, the window is what the pointer hits.
  const body = (await pet(page).locator(".vc-actor").boundingBox())!, pane = (await dialog.boundingBox())!;
  const left = Math.max(body.x, pane.x), right = Math.min(body.x + body.width, pane.x + pane.width), top = Math.max(body.y, pane.y), bottom = Math.min(body.y + body.height, pane.y + pane.height);
  if (right - left > 2 && bottom - top > 2) expect(await dialog.evaluate((node, p) => node.contains(document.elementFromPoint(p.x, p.y)), { x: (left + right) / 2, y: (top + bottom) / 2 })).toBe(true);
  return stack;
}

for (const dark of [false, true]) for (const on of [false, true]) {
  const name = `${dark ? "dark" : "light"}-${on ? "on" : "off"}`;
  test(`viewer ${name}: schedule detail ${on ? "keeps the creature living behind it" : "lets the creature rest"}`, async ({ page }) => {
    test.setTimeout(90_000); mkdirSync(shots, { recursive: true });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const posts = await seed(page, { on, dark });
    await page.goto("/visual-fixture/poster"); await settle(page);
    if (dark) await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // Put it on the calendar beside the first schedule with the real keyboard placement (P, then a click).
    const spot = await page.locator(".public-event:visible").nth(1).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 4 }; });
    const actor = pet(page).locator(".vc-actor");
    await actor.focus(); await actor.press("p"); await page.mouse.click(spot.x, spot.y); await page.mouse.move(1880, 980);
    await expect(pet(page)).not.toHaveAttribute("data-placing", ""); await page.waitForTimeout(600);
    await page.locator(".public-event:visible").first().click();
    const detail = page.getByRole("dialog", { name: "일정 상세", exact: true });
    await expect(detail).toBeVisible(); await waitForOverlayEntrance(detail);
    await expect(pet(page)).toHaveAttribute("data-overlay", on ? "behind" : "quiet");
    if (on) {
      const seen = await watch(page, 12_000);
      expect(seen.presences).not.toContain("parked");
      expect(seen.travel > 8 || seen.states.length > 1, JSON.stringify(seen)).toBe(true);
      await expectUnderWindow(page, detail);
    } else {
      await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 20_000 });
    }
    await page.screenshot({ path: `${shots}/viewer-detail-${name}.png` });
    // A click inside the window reaches the window, and closing it continues seamlessly.
    const identity = await pet(page).elementHandle();
    await detail.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(detail).toHaveCount(0);
    expect(await identity!.evaluate(node => node.isConnected && !(node as HTMLElement).hidden)).toBe(true);
    await expect(pet(page)).not.toHaveAttribute("data-overlay", /.+/);
    await expect.poll(() => pet(page).locator(".vc-actor").evaluate(node => getComputedStyle(node).pointerEvents)).toBe("auto");
    if (on) {
      // A dimming window: the backdrop covers the creature together with the calendar.
      await page.locator(".viewer-settings-open").first().click();
      const settings = page.getByRole("dialog", { name: "설정", exact: true });
      await expect(settings).toBeVisible(); await waitForOverlayEntrance(settings);
      await expect(pet(page)).toHaveAttribute("data-overlay", "behind");
      const seen = await watch(page, 6_000); expect(seen.presences).not.toContain("parked");
      await expectUnderWindow(page, settings);
      await page.screenshot({ path: `${shots}/viewer-settings-${name}.png` });
      // The new row and its one-line hint, in 빅타민 › 더 보기, beside "다른 일 할 때도 놀기".
      await settings.getByRole("tab", { name: "빅타민" }).or(settings.getByRole("button", { name: "빅타민", exact: true })).first().click();
      await settings.locator(".rhh-companion-more summary").click();
      const row = settings.locator(".rhh-companion-more .role-help-haptics").filter({ hasText: "창이 떠 있어도 놀기" });
      await expect(row).toHaveAttribute("data-tip", "일정·설정 창이 떠 있어도 뒤에서 놀아요.");
      await expect(row.getByRole("switch", { name: "빅타민 창이 떠 있어도 놀기 켜기/끄기", exact: true })).toBeChecked();
      await expect(settings.locator(".rhh-companion-more .role-help-haptics").filter({ hasText: "다른 일 할 때도 놀기" })).toHaveAttribute("data-tip", "일정표가 보이면, 다른 프로그램을 써도 놀아요.");
      await row.scrollIntoViewIfNeeded(); await row.hover(); await page.waitForTimeout(700);
      await settings.screenshot({ path: `${shots}/settings-row-${dark ? "dark" : "light"}.png` });
    }
    expect(posts).toEqual([]); expect(errors).toEqual([]);
  });
}

for (const on of [false, true]) test(`studio light-${on ? "on" : "off"}: search window ${on ? "keeps the creature living behind it" : "lets the creature rest"}`, async ({ page }) => {
  test.setTimeout(90_000); mkdirSync(shots, { recursive: true });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await seed(page, { on, dark: false });
  await page.goto("/visual-fixture/studio?role=developer"); await settle(page);
  await page.locator("[data-act=stool-search]").click();
  const search = page.getByRole("dialog").filter({ visible: true }).last();
  await expect(search).toBeVisible(); await waitForOverlayEntrance(search);
  await expect(pet(page)).toHaveAttribute("data-overlay", on ? "behind" : "quiet");
  if (on) {
    const seen = await watch(page, 12_000);
    expect(seen.presences).not.toContain("parked");
    expect(seen.travel > 8 || seen.states.length > 1, JSON.stringify(seen)).toBe(true);
    await expectUnderWindow(page, search);
  } else await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 20_000 });
  await page.screenshot({ path: `${shots}/studio-search-light-${on ? "on" : "off"}.png` });
  await page.keyboard.press("Escape"); await expect(search).toHaveCount(0);
  await expect(pet(page)).not.toHaveAttribute("data-overlay", /.+/);
  // The public-event editor keeps its own working companion with either choice.
  await page.locator(".studio-event-pill .pill-main strong").first().dblclick();
  const editor = page.locator(".event-editor-panel.is-edit"); await expect(editor).toBeVisible(); await waitForOverlayEntrance(editor);
  await expect(pet(page)).toHaveAttribute("data-overlay", "quiet");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${shots}/studio-editor-light-${on ? "on" : "off"}.png` });
  expect(errors).toEqual([]);
});

test("viewer ON with every prank and a hungry creature: behind a window it only moves, rests and plays", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await seed(page, { on: true, dark: false, pranks: true });
  await page.goto("/visual-fixture/poster"); await settle(page);
  const side = await railLeft(page);
  await page.locator(".public-event:visible").first().click();
  const detail = page.getByRole("dialog", { name: "일정 상세", exact: true });
  await expect(detail).toBeVisible(); await waitForOverlayEntrance(detail);
  await expect(pet(page)).toHaveAttribute("data-overlay", "behind");
  await openProbe(page, true);
  const seen = await watch(page, 20_000);
  const events = await openProbe(page, false);
  expect(seen.presences).not.toContain("parked");
  expect(seen.travel > 8 || seen.states.length > 1, JSON.stringify(seen)).toBe(true);
  // No panel side change, card tilt, hide, heart/meal action or radio start while the window is open.
  expect(events).toEqual([]);
  expect(await railLeft(page)).toBe(side);
  await expect(pet(page)).not.toHaveAttribute("data-hide-event", /.*/);
  await expect(page.locator("[data-vc-ruffled]")).toHaveCount(0);
  await expectUnderWindow(page, detail);
  expect(errors).toEqual([]);
});

test("viewer: switching it on inside the open settings window turns the quiet rest into play behind it", async ({ page }) => {
  test.setTimeout(120_000); mkdirSync(shots, { recursive: true });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await seed(page, { on: false, dark: false });
  await page.goto("/visual-fixture/poster"); await settle(page);
  await page.locator(".viewer-settings-open").first().click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(settings).toBeVisible(); await waitForOverlayEntrance(settings);
  await expect(pet(page)).toHaveAttribute("data-overlay", "quiet");
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 20_000 });
  await settings.getByRole("tab", { name: "빅타민" }).or(settings.getByRole("button", { name: "빅타민", exact: true })).first().click();
  await settings.locator(".rhh-companion-more summary").click();
  const toggle = settings.getByRole("switch", { name: "빅타민 창이 떠 있어도 놀기 켜기/끄기", exact: true });
  await expect(toggle).not.toBeChecked(); await toggle.click(); await expect(toggle).toBeChecked();
  await expect(pet(page)).toHaveAttribute("data-overlay", "behind");
  await openProbe(page, true);
  const seen = await watch(page, 14_000);
  expect(await openProbe(page, false)).toEqual([]);
  expect(seen.presences.at(-1)).not.toBe("parked");
  expect(seen.travel > 8 || seen.states.length > 1, JSON.stringify(seen)).toBe(true);
  await expectUnderWindow(page, settings);
  // Switching it off again, still inside the window, goes back to the quiet rest.
  await toggle.click(); await expect(toggle).not.toBeChecked();
  await expect(pet(page)).toHaveAttribute("data-overlay", "quiet");
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("studio ON: the in-flow editor of a schedule turned into a teaser keeps the creature living behind it", async ({ page }) => {
  test.setTimeout(120_000); mkdirSync(shots, { recursive: true });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await seed(page, { on: true, dark: false, pranks: true });
  await page.goto("/visual-fixture/studio?role=developer"); await settle(page);
  const side = await railLeft(page);
  await page.locator(".studio-event-pill .pill-main strong").first().dblclick();
  const editor = page.locator(".event-editor-panel.is-edit"); await expect(editor).toBeVisible(); await waitForOverlayEntrance(editor);
  // A public schedule's editor keeps its working companion (owner 2026-11-20).
  await expect(pet(page)).toHaveAttribute("data-overlay", "quiet");
  await editor.locator("[data-act=fold-head]").first().click();
  await editor.locator(".opt-chip.teaser").first().click();
  await expect(editor.locator(".opt-chip.teaser").first()).toHaveAttribute("aria-pressed", "true");
  await expect(pet(page)).toHaveAttribute("data-overlay", "behind");
  await openProbe(page, true);
  const seen = await watch(page, 16_000);
  const events = await openProbe(page, false);
  expect(seen.presences).not.toContain("parked");
  expect(seen.travel > 8 || seen.states.length > 1, JSON.stringify(seen)).toBe(true);
  expect(events).toEqual([]); expect(await railLeft(page)).toBe(side);
  await expectUnderWindow(page, editor);
  await page.screenshot({ path: `${shots}/studio-teaser-editor-light-on.png` });
  expect(errors).toEqual([]);
});
