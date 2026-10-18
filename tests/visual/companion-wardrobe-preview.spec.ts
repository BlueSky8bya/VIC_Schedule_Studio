import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";

const regressionOutput = process.env.COMPANION112_COLLECTION_REGRESSION_OUTPUT ?? ".scratch-pw/companion-112/collection/regression";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block", headless: Boolean(process.env.CI) });
type Surface = "viewer" | "studio" | "preview";
async function fixture(page: Page, { found = true, reduce = false, graphics = "max", enabled = true, theme = "light", allOwned = false }: { found?: boolean; reduce?: boolean; graphics?: "max" | "off" | "soft"; enabled?: boolean; theme?: "light" | "dark"; allOwned?: boolean } = {}) {
  const writes: string[] = [], errors: string[] = [], bodies: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/companion/hd/")) bodies.push(request.url()); });
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(pathname); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (request.method() === "GET" && (pathname === "/" || pathname === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    return route.continue();
  });
  const collection: CompanionCollection = { version: 1, foods: [], behaviors: found ? ["groom"] : [], situations: [], gifts: { pending: null, unlocked: allOwned ? [...COMPANION_WEARABLE_IDS] : ["sunglasses", "beret"], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 } };
  await page.addInitScript(({ prefs, collection, key, epoch, reduce, graphics, enabled, theme }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": reduce ? "on" : "off", "vic.gfxPref": graphics === "soft" ? "auto" : graphics })) localStorage.setItem(name, value);
    if (graphics === "soft") localStorage.setItem("vic.gfx", JSON.stringify({ mode: "soft", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled, roam: false, jump: false, sleep: false, petting: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify(collection));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, collection, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, reduce, graphics, enabled, theme });
  return { writes, errors, bodies };
}
async function openWardrobe(page: Page, surface: Surface = "viewer") {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
  if (!await page.getByRole("button", { name: "설정", exact: true }).isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  const profile = dialog.locator(".rhh-companion-profile");
  await profile.getByRole("tab", { name: "옷장", exact: true }).click();
  return { dialog, profile, preview: profile.locator(".rhh-wardrobe-detail").getByRole("img", { name: "빅타민 미리보기", exact: true }) };
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CompanionCollection, COMPANION_COLLECTION_KEY);

for (const surface of ["viewer", "studio"] as const) test(`114 ${surface}: every active fitting renders, retired tiles stay absent and native removal clears the preview`, async ({ page }) => {
  const safety = await fixture(page, { allOwned: true, found: false, reduce: true, theme: surface === "studio" ? "dark" : "light" });
  const { dialog, profile, preview } = await openWardrobe(page, surface);
  await expect(preview).toHaveAttribute("data-preview-ready", "");
  await expect(profile.locator(".rhh-collection-heading")).toContainText(`25/${COMPANION_WEARABLE_IDS.length}`);
  for (const id of COMPANION_WEARABLE_IDS) {
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-accessory-grid"), COMPANION_WEARABLE_IDS.indexOf(id));
    await expect(profile.locator(`[data-accessory="${id}"]`)).toHaveAttribute("data-found", "true");
    await expect(profile.locator(".rhh-wardrobe-detail-copy strong")).not.toHaveText("???");
    await expect(preview.locator(".vc-wearable-front")).toBeVisible();
    expect((await saved(page)).gifts.equipped).toBe("sunglasses");
  }
  await expect(profile.locator('[data-accessory="star-pin"],[data-accessory="satchel"],[data-accessory="leaf-umbrella"],[data-accessory="heart-badge"],[data-accessory="lemon-badge"],[data-accessory="bandage"],[data-accessory="mushroom-hat"]')).toHaveCount(0);
  await profile.getByRole("button", { name: "장착하기", exact: true }).click();
  await expect(profile.getByRole("button", { name: "벗기기", exact: true })).toBeVisible();
  await profile.getByRole("button", { name: "벗기기", exact: true }).click();
  await expect(preview.locator(".vc-wearable-front")).toBeHidden();
  await expect(preview.locator(".vc-wearable-back")).toBeHidden();
  expect((await saved(page)).gifts.equipped).toBeNull();
  await expect(dialog).not.toContainText("이 브라우저에만 보관해요.");
  mkdirSync(`${regressionOutput}/wardrobe`, { recursive: true });
  await page.screenshot({ path: `${regressionOutput}/wardrobe/inventory-${surface}.png` });
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

for (const surface of ["viewer", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) test(`${surface} ${theme}: selected owned accessory previews only a discovered gesture without equipping`, async ({ page }) => {
  const safety = await fixture(page, { theme });
  const { profile, preview } = await openWardrobe(page, surface);
  await expect(preview).toHaveAttribute("data-preview-ready", "");
  await expect.poll(() => preview.getAttribute("data-preview-row")).toBe("30");
  await profile.locator('[data-accessory="beret"]').click();
  await expect(profile.locator(".rhh-wardrobe-detail-copy strong")).toHaveText("베레모");
  await expect(preview.locator(".vc-wearable-front")).toBeVisible();
  // Measure the final selected style after its real finite transitions. The
  // native click intentionally starts from the previous unselected colors.
  await expect.poll(() => profile.locator('[data-accessory="beret"]').evaluate(element => element.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).length)).toBe(0);
  const selection = await profile.locator('[data-accessory="beret"]').evaluate(element => {
    const selected = getComputedStyle(element), other = getComputedStyle(element.closest("ul")!.querySelector('[data-accessory="sunglasses"]')!);
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    // CSS transitions may serialize modern color() values; let the browser
    // resolve them instead of assuming every computed color is 255-based rgb.
    const channels = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const luminance = (values: number[]) => values.map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const border = luminance(channels(selected.borderTopColor)), background = luminance(channels(selected.backgroundColor));
    return { background: selected.backgroundColor, otherBackground: other.backgroundColor, border: selected.borderTopColor, otherBorder: other.borderTopColor, shadow: selected.boxShadow, boundaryContrast: (Math.max(border, background) + .05) / (Math.min(border, background) + .05) };
  });
  expect(selection.background).not.toBe(selection.otherBackground); expect(selection.border).not.toBe(selection.otherBorder);
  expect(selection.shadow).toContain("inset"); expect(selection.boundaryContrast).toBeGreaterThanOrEqual(3);
  // The real world may persist its pre-dialog active milliseconds within the
  // existing5s budget. Settle that pending write before checking preview purity.
  await page.waitForTimeout(5500);
  await profile.getByRole("button", { name: "다시 보기", exact: true }).click();
  await expect.poll(() => preview.getAttribute("data-preview-row")).toBe("30");
  const before = await saved(page), pictures = new Set<string>(), rows = new Set<string>();
  for (let index = 0; index < 12; index++) { pictures.add(await preview.locator("canvas").evaluate(node => (node as HTMLCanvasElement).toDataURL())); rows.add(await preview.getAttribute("data-preview-row") ?? ""); await page.waitForTimeout(140); }
  expect([...rows].every(row => ["0", "30"].includes(row))).toBe(true); expect(pictures.size).toBeGreaterThan(1);
  expect(await saved(page)).toEqual(before); expect(before.gifts.equipped).toBe("sunglasses");
  await profile.getByRole("button", { name: "다시 보기", exact: true }).click();
  await expect.poll(() => preview.getAttribute("data-preview-row")).toBe("30");
  await selectCompanionCollectionIndex(page, profile.locator(".rhh-accessory-grid"), COMPANION_WEARABLE_IDS.indexOf("bucket-hat"));
  await expect(profile.locator(".rhh-wardrobe-detail-copy strong")).toHaveText("???");
  await expect(preview.locator(".vc-wearable-front")).toBeHidden(); await expect(preview.locator(".vc-wearable-back")).toBeHidden();
  await expect(profile.locator(".rhh-wardrobe-detail")).toBeInViewport({ ratio: 1 });
  const tile = profile.locator('[data-accessory="bucket-hat"]');
  expect(await tile.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  await selectCompanionCollectionIndex(page, profile.locator(".rhh-accessory-grid"), COMPANION_WEARABLE_IDS.indexOf("beret"));
  await settlePanelLayout(page);
  mkdirSync(`${regressionOutput}/wardrobe`, { recursive: true });
  await page.screenshot({ path: `${regressionOutput}/wardrobe/wardrobe-${surface}-${theme}.png` });
  await profile.getByRole("tab", { name: "함께 지내기", exact: true }).click();
  await expect(preview).toHaveCount(0); expect(await saved(page)).toEqual(before);
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

for (const mode of ["empty", "reduced", "graphics-off", "graphics-soft", "disabled"] as const) test(`wardrobe ${mode}: stays neutral or unstarted`, async ({ page }) => {
  const safety = await fixture(page, { found: mode !== "empty", reduce: mode === "reduced", graphics: mode === "graphics-off" ? "off" : mode === "graphics-soft" ? "soft" : "max", enabled: mode !== "disabled" });
  const { dialog, profile, preview } = await openWardrobe(page);
  await page.waitForTimeout(5500);
  const before = await saved(page);
  await expect(profile.getByRole("button", { name: "다시 보기", exact: true })).toBeDisabled();
  await expect(preview).toHaveAttribute("data-preview-row", "0"); const pixels = await preview.locator("canvas").evaluate(node => (node as HTMLCanvasElement).toDataURL()); await page.waitForTimeout(1500); expect(await preview.locator("canvas").evaluate(node => (node as HTMLCanvasElement).toDataURL())).toBe(pixels);
  if (mode === "disabled") {
    const paused = profile.locator(".rhh-wardrobe-preview-wrap > .rhh-wardrobe-preview-paused");
    await expect(paused).toBeVisible();
    const imageRect = await preview.boundingBox(), pausedRect = await paused.boundingBox();
    expect(pausedRect!.y).toBeGreaterThanOrEqual(imageRect!.y + imageRect!.height);
    mkdirSync(`${regressionOutput}/wardrobe`, { recursive: true });
    await dialog.screenshot({ path: `${regressionOutput}/wardrobe/off-badge.png` });
    await profile.getByRole("tab", { name: "환경설정", exact: true }).click();
    await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
    await profile.getByRole("tab", { name: "옷장", exact: true }).click();
    await expect.poll(() => preview.getAttribute("data-preview-row")).toBe("30");
    await profile.getByRole("tab", { name: "환경설정", exact: true }).click();
    await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
    await profile.getByRole("tab", { name: "옷장", exact: true }).click();
    await expect(preview).toHaveAttribute("data-preview-row", "0");
  }
  expect(await saved(page)).toEqual(before); expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("narrow desktop keeps the real preview and deep selection visible, and outer tab departure unmounts it", async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 1100 });
  const safety = await fixture(page);
  const { dialog, profile, preview } = await openWardrobe(page);
  await expect(preview).toHaveAttribute("data-preview-ready", "");
  await selectCompanionCollectionIndex(page, profile.locator(".rhh-accessory-grid"), COMPANION_WEARABLE_IDS.indexOf("bucket-hat"));
  const last = profile.locator('[data-accessory="bucket-hat"]');
  await last.click();
  await expect(profile.locator(".rhh-wardrobe-detail")).toBeInViewport({ ratio: 1 });
  expect(await profile.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(await last.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  mkdirSync(`${regressionOutput}/wardrobe`, { recursive: true });
  await page.screenshot({ path: `${regressionOutput}/wardrobe/wardrobe-narrow.png` });
  await dialog.locator('[data-tab="sound"]').click();
  await expect(preview).toHaveCount(0);
  await dialog.locator('[data-tab="companion"]').click();
  await expect(preview).toHaveAttribute("data-preview-ready", "");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const reopenedDialog = page.getByRole("dialog", { name: "설정", exact: true });
  await reopenedDialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await reopenedDialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "옷장", exact: true }).click();
  await expect(reopenedDialog.getByRole("img", { name: "빅타민 미리보기", exact: true })).toHaveAttribute("data-preview-ready", "");
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("native minimized window cancels the current preview and resumes from a fresh discovered clip", async ({ page, context }) => {
  test.skip(Boolean(process.env.CI), "Native OS window visibility requires a headed desktop; CI covers cancellation in the lifecycle unit harness.");
  const safety = await fixture(page);
  const { preview } = await openWardrobe(page);
  await expect.poll(() => preview.getAttribute("data-preview-row")).toBe("30");
  // Playwright pages can occupy separate browser windows, so fronting a sibling
  // does not prove this document is hidden. Minimize the actual native window.
  const browser = await context.newCDPSession(page);
  // Remove Playwright's default forced-focus mode before observing native OS
  // visibility. This restores browser behavior; it never sets hidden/focus data.
  await browser.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  const { windowId } = await browser.send("Browser.getWindowForTarget");
  await browser.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
  await page.waitForTimeout(250);
  if (!await page.evaluate(() => document.hidden)) {
    await browser.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await browser.detach();
    test.skip(true, "Environment unverified: the actual minimized window still reports document.hidden=false after removing automation's forced-focus mode. No document visibility field is patched.");
  }
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
  const paused = await preview.locator("canvas").evaluate(node => (node as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(1700);
  expect(await preview.locator("canvas").evaluate(node => (node as HTMLCanvasElement).toDataURL())).toBe(paused);
  await browser.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  await browser.detach(); await page.bringToFront();
  await expect.poll(() => preview.getAttribute("data-preview-row")).toBe("30");
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});
