import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { expectQuietCompanionTail, waitForOverlayEntrance } from "./helpers/companion-overlay";

const pet = (page: Page) => page.locator(".vc-companion");
const proof = new WeakMap<Page, { writes: string[]; errors: string[] }>();
test.use({ viewport: { width: 1440, height: 1200 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const result = { writes: [] as string[], errors: [] as string[] }; proof.set(page, result);
  page.on("pageerror", error => result.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const reads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/visual-fixture/studio" && reads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { result.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => { expect(proof.get(page)).toEqual({ writes: [], errors: [] }); });

async function openDisabledCompanionSettings(page: Page, surface: "viewer" | "studio") {
  // Device settings only. No clock, RNG, focus or geometry overrides.
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false, roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner"); await page.bringToFront();
  await expect(pet(page)).toHaveCount(0);
  if (surface === "studio") {
    const expandPanel = page.getByRole("button", { name: "패널 펼치기", exact: true });
    if (await expandPanel.isVisible()) await expandPanel.click();
    await expect(page.locator(".stool-settings:visible")).toBeVisible();
  }
  const settingsButton = surface === "studio" ? page.locator(".stool-settings:visible") : page.getByRole("button", { name: "설정", exact: true });
  await settingsButton.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  const toggle = dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true });
  return { dialog, toggle };
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} Settings can start and restart a supported quiet companion without moving it on close`, async ({ page }) => {
  const { dialog, toggle } = await openDisabledCompanionSettings(page, surface);
  for (const startup of ["cold", "restart"]) {
    await toggle.click(); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /\S+/);
    await expect(pet(page)).not.toHaveAttribute("data-hidden-reason"); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
    await expect(pet(page)).toHaveAttribute("data-overlay", "quiet"); await expect(dialog).toBeVisible();
    if (startup === "cold") { await toggle.click(); await expect(pet(page)).toHaveCount(0); }
  }
  await expectQuietCompanionTail(page, toggle);
  const point = () => pet(page).evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom }; });
  const before = await point(); await page.screenshot({ path: `.scratch-pw/companion-101-overlay-start-${surface}.png` });
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0);
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-returning");
  await expect.poll(async () => { const after = await point(); return Math.hypot(after.x - before.x, after.y - before.y); }).toBeLessThan(1);
});

for (const surface of ["viewer", "studio"] as const) test(`${surface} an actual transient CSS-empty snapshot does not consume Settings startup`, async ({ page }) => {
  const { dialog, toggle } = await openDisabledCompanionSettings(page, surface);
  const selector = surface === "viewer" ? ".poster-page" : ".studio-shell", root = page.locator(selector);
  const previous = await root.evaluate(node => ({ value: (node as HTMLElement).style.getPropertyValue("opacity"), priority: (node as HTMLElement).style.getPropertyPriority("opacity") }));
  const restore = () => root.evaluate((node, before) => { const style = (node as HTMLElement).style; if (before.value) style.setProperty("opacity", before.value, before.priority); else style.removeProperty("opacity"); }, previous);
  // Explicit fault injection: the native ON click temporarily makes the
  // actual calendar transparent before its first geometry frame. Geometry,
  // focus, RNG and clocks remain real; restoration is a real style mutation.
  await toggle.evaluate((node, rootSelector) => {
    node.addEventListener("click", () => { document.querySelector<HTMLElement>(rootSelector)!.style.setProperty("opacity", "0", "important"); }, { capture: true, once: true });
  }, selector);
  try {
    await toggle.click(); await expect(toggle).toBeChecked();
    await page.waitForTimeout(250); // Allow the real coalesced geometry pass.
    await expect(pet(page)).toBeHidden(); await expect(pet(page)).toHaveAttribute("data-hidden-reason", "support");
    await restore();
    await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /\S+/);
    await expect(pet(page)).not.toHaveAttribute("data-hidden-reason"); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
    await expect(dialog).toBeVisible(); await expect(toggle).toBeChecked(); await expect(pet(page)).toHaveCount(1);
    await expectQuietCompanionTail(page, toggle);
    await page.screenshot({ path: `.scratch-pw/companion-101-overlay-empty-${surface}.png` });
  } finally { await restore(); }
});
