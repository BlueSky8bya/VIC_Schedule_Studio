import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { settlePanelLayout } from "./helpers/panel-layout";

type Surface = "anonymous" | "signed-in" | "studio" | "preview";
type Theme = "light" | "dark";
type Proof = { writes: string[]; errors: string[]; reads: number; samples: unknown[] };
const proof = new WeakMap<Page, Proof>();
const output = ".scratch-pw/099-panel-chrome";
const room = (page: Page) => page.locator(".vc-home:visible");
const launcher = (page: Page) => page.locator(".vc-home-launcher:visible");
const scope = (page: Page, surface: Surface) => page.locator(surface === "preview" ? ".viewer-fullscreen .poster-page" : surface === "studio" ? ".studio-shell" : ".poster-page");
const card = (page: Page, surface: Surface, key: string) => scope(page, surface).locator(`[data-panel-section="${key}"]:visible`);

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  proof.set(page, { writes: [], errors: [], reads: 0, samples: [] });
  page.on("pageerror", error => proof.get(page)!.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const publicReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/visual-fixture/studio" && publicReads.has(request.headers()["next-action"])) {
      proof.get(page)!.reads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.get(page)!.writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const directory = `${output}/${build}`, label = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 140);
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/${label}.json`, JSON.stringify({ title: info.title, build, status: info.status, ...proof.get(page) }, null, 2));
  await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true }).catch(() => {});
  expect(proof.get(page)!.writes).toEqual([]); expect(proof.get(page)!.errors).toEqual([]);
});

async function seed(page: Page, theme: Theme) {
  await page.addInitScript(({ theme, key, epoch, preferences, care }) => {
    // Device preferences only. No clocks, RNG, focus, product state or DOM
    // geometry is overridden. Retain native disclosure changes on reload.
    const firstVisit = localStorage.getItem(key) !== epoch;
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    if (firstVisit) localStorage.setItem("vic.panelSections", JSON.stringify({ version: 1, "tag-filter": true, season: true, "companion-home": false }));
    localStorage.removeItem("vic_panel_collapsed");
  }, { theme, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
}
async function settled(page: Page) {
  await settlePanelLayout(page);
}
async function enter(page: Page, surface: Surface) {
  await page.goto(surface === "studio" || surface === "preview" ? "/visual-fixture/studio?role=owner" : `/visual-fixture/poster?avatar=1&signedIn=${surface === "signed-in" ? "1" : "0"}`);
  await page.bringToFront(); await settled(page);
  if (surface === "preview") {
    const before = proof.get(page)!.reads;
    await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click();
    await expect(scope(page, surface)).toBeVisible();
    expect(proof.get(page)!.reads).toBe(before + 1); await settled(page);
  }
  await expect(scope(page, surface)).toBeVisible(); await expect(page.locator(".vc-companion")).toHaveCount(1);
}
async function nativeActivate(target: Locator) {
  await target.focus(); await expect(target).toBeFocused(); await target.press("Enter");
}
async function savedFold(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("vic.panelSections") ?? "null") as { "companion-home": boolean } | null);
}

async function material(page: Page, surface: Surface) {
  const samples = [];
  for (const key of ["tag-filter", "season", "companion-home"]) {
    const panel = card(page, surface, key);
    await expect(panel).toHaveCount(1);
    const sample = await panel.evaluate(node => {
      const heading = node.querySelector<HTMLElement>(".panel-section-heading")!, title = node.querySelector<HTMLElement>(".panel-section-title")!, label = title.querySelector<HTMLElement>("button > span, :scope > span")!;
      const style = getComputedStyle(node), ink = getComputedStyle(heading), text = getComputedStyle(title), h = heading.getBoundingClientRect(), range = document.createRange();
      range.selectNodeContents(label); const glyphs = range.getBoundingClientRect(); range.detach();
      const rgb = (value: string) => {
        const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
        return value.startsWith("color(srgb") ? numbers.slice(0, 3) : numbers.slice(0, 3).map(value => value / 255);
      };
      const luminance = (value: string) => rgb(value).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
      const a = luminance(ink.color), b = luminance(style.backgroundColor);
      return { key: node.getAttribute("data-panel-section"), background: style.backgroundColor, border: style.borderTopColor, shadow: style.boxShadow, ink: ink.color, titleAlign: text.textAlign, titleWeight: text.fontWeight, titleCenterDelta: Math.abs((glyphs.left + glyphs.right - h.left - h.right) / 2), toggleHeight: node.querySelector(".panel-section-toggle")!.getBoundingClientRect().height, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
    samples.push(sample);
  }
  proof.get(page)!.samples.push({ phase: "rail-material", samples });
  for (const item of samples) {
    expect(item.background).toBe(samples[0].background); expect(item.border).toBe(samples[0].border); expect(item.shadow).toBe(samples[0].shadow); expect(item.ink).toBe(samples[0].ink);
    expect(item.titleAlign).toBe("center"); expect(item.titleWeight).toBe("600"); expect(item.titleCenterDelta).toBeLessThan(1.25); expect(item.contrast).toBeGreaterThanOrEqual(4.5);
    expect(item.toggleHeight, "fine-pointer rail title stays 36 physical pixels").toBeCloseTo(36, 1);
  }
}
async function headerEntry(page: Page, surface: Surface) {
  await expect(launcher(page)).toHaveCount(1); await expect(launcher(page)).toHaveAttribute("aria-expanded", "false");
  const sample = await launcher(page).evaluate(node => {
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const shown = (element: Element) => { const r = element.getBoundingClientRect(); for (let p: Element | null = element; p; p = p.parentElement) { const s = getComputedStyle(p); if (p.hasAttribute("hidden") || s.display === "none" || s.visibility !== "visible" || Number(s.opacity) <= .01) return false; } return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    const header = node.closest(".studio-topbar,.public-calendar-header,.agenda-header"), own = rect(node), style = getComputedStyle(node);
    const peers = header ? [...header.querySelectorAll("button,a,h1")].filter(element => element !== node && !element.contains(node) && shown(element)).map(rect) : [];
    // An authenticated email/account card owns its outer material and the
    // inner36px action. Compare only standalone header controls with the house.
    const family = header ? [...header.querySelectorAll(".vc-home-launcher,.viewer-settings-open,.insights-open,.account-form:not(:has(.account-email)) .button")].filter(shown).map(element => {
      const s = getComputedStyle(element);
      const labelInks = [...element.querySelectorAll(".lbl,.vc-home-launcher-label")].filter(shown).map(label => getComputedStyle(label).color);
      return { action: element.getAttribute("data-act") ?? element.className, background: s.backgroundColor, image: s.backgroundImage, ink: s.color, labelInks, radius: s.borderRadius, height: rect(element).height };
    }) : [];
    const overlap = (b: ReturnType<typeof rect>) => Math.max(0, Math.min(own.right, b.right) - Math.max(own.left, b.left)) * Math.max(0, Math.min(own.bottom, b.bottom) - Math.max(own.top, b.top));
    const id = node.getAttribute("aria-controls"), controlled = id ? [...document.querySelectorAll(`#${CSS.escape(id)}`)] : [];
    return { own, viewport: { width: innerWidth, height: innerHeight }, header: Boolean(header), peers, family, overlap: peers.reduce((sum, peer) => sum + overlap(peer), 0), background: style.backgroundColor, image: style.backgroundImage, color: style.color, radius: style.borderRadius, pill: style.getPropertyValue("--r-pill").trim(), shadow: style.boxShadow, fontWeight: style.fontWeight, id, controlled: controlled.length, retainedHidden: controlled[0] instanceof HTMLElement && controlled[0].hidden };
  });
  proof.get(page)!.samples.push({ phase: "compact-header", sample });
  expect(sample.header).toBe(true); expect(sample.peers.length).toBeGreaterThan(0); expect(sample.overlap).toBe(0);
  expect(sample.own.width).toBeGreaterThanOrEqual(43.5); expect(sample.own.height).toBeGreaterThanOrEqual(43.5); expect(sample.own.height).toBeLessThanOrEqual(44.5);
  expect(sample.own.left).toBeGreaterThanOrEqual(0); expect(sample.own.top).toBeGreaterThanOrEqual(0); expect(sample.own.right).toBeLessThanOrEqual(sample.viewport.width); expect(sample.own.bottom).toBeLessThanOrEqual(sample.viewport.height);
  expect(sample.id).toBeTruthy(); expect(sample.controlled).toBe(1); expect(sample.retainedHidden).toBe(true); expect(sample.fontWeight).toBe("600");
  expect(sample.family.length).toBeGreaterThan(0); expect(sample.radius).toBe(sample.pill); expect(sample.image).toBe("none");
  if (surface !== "studio") expect(sample.family.length).toBeGreaterThanOrEqual(4);
  for (const control of sample.family) {
    expect(control.background, `${control.action}: shared header surface`).toBe(sample.background);
    expect(control.image, `${control.action}: no metal utility gradient`).toBe("none");
    expect(control.ink, `${control.action}: shared header ink`).toBe(sample.color);
    for (const ink of control.labelInks) expect(ink, `${control.action}: visible label shares the actual control ink`).toBe(sample.color);
    expect(control.radius, `${control.action}: shared pill radius`).toBe(sample.pill);
    expect(control.height, `${control.action}: physical44px header control`).toBeGreaterThanOrEqual(43.5);
    expect(control.height, `${control.action}: physical44px header control`).toBeLessThanOrEqual(44.5);
  }
  if (surface === "anonymous") {
    expect(sample.family.filter(control => control.action === "login")).toHaveLength(1);
    const login = page.locator(".public-calendar-header .account-form:not(:has(.account-email)) .button:visible");
    const hovered = [];
    for (const control of [launcher(page), login]) {
      await control.hover(); await settled(page);
      hovered.push(await control.evaluate(node => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        return { background: style.backgroundColor, image: style.backgroundImage, ink: style.color, radius: style.borderRadius, height: rect.height };
      }));
    }
    proof.get(page)!.samples.push({ phase: "anonymous-header-hover", hovered });
    expect(hovered[1]).toEqual(hovered[0]); expect(hovered[0].image).toBe("none");
    await page.mouse.move(2, 2); await settled(page);
  }
}
async function compact(page: Page, surface: Surface, theme: Theme) {
  await page.setViewportSize({ width: 1280, height: 720 }); await settled(page); await headerEntry(page, surface);
  // Keep visual baselines on the changed chrome, without capturing the live
  // calendar or avatar. Native assertions still cover all four surfaces.
  const snapshotPrefix = surface === "anonymous" || surface === "studio" ? `${surface}-${theme}` : null;
  if (snapshotPrefix) {
    const entry = scope(page, surface).locator(surface === "studio" ? ".studio-topbar .studio-left" : ".public-calendar-header .header-left");
    await expect(entry).toHaveScreenshot(`${snapshotPrefix}-compact-entry.png`, {
      mask: surface === "studio" ? [entry.locator(".studio-build-tag")] : []
    });
  }
  const before = await savedFold(page); expect(before?.["companion-home"]).toBe(false);
  await nativeActivate(launcher(page)); await expect(room(page)).toHaveAttribute("data-home-presentation", "compact");
  const close = room(page).getByRole("button", { name: "빅타민 집 닫기", exact: true });
  await expect(close).toBeFocused(); await expect(room(page).locator(".vc-home-room")).toBeVisible();
  await expect(room(page)).not.toHaveAttribute("data-panel-collapsible"); await expect(room(page)).not.toHaveAttribute("data-panel-collapsed");
  await expect(room(page).locator("[data-panel-section-toggle],[data-home-action='fold'],.panel-section-chevron")).toHaveCount(0);
  await expect(room(page).getByRole("heading", { name: "빅타민 집", exact: true })).toBeVisible();
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "true"); expect(await savedFold(page)).toEqual(before);
  const layout = await room(page).evaluate(node => {
    const room = node.getBoundingClientRect(), inside = node.querySelector(".vc-home-room")!.getBoundingClientRect(), close = node.querySelector(".vc-home-close")!.getBoundingClientRect();
    return { left: room.left, right: room.right, top: room.top, bottom: room.bottom, height: inside.height, closeWidth: close.width, closeHeight: close.height, width: innerWidth, viewportHeight: innerHeight };
  });
  proof.get(page)!.samples.push({ phase: "compact-expanded", surface, layout });
  expect(layout.height).toBeCloseTo(132, 1); expect(layout.closeWidth).toBeGreaterThanOrEqual(43.5); expect(layout.closeHeight).toBeGreaterThanOrEqual(43.5);
  expect(layout.left).toBeGreaterThanOrEqual(0); expect(layout.top).toBeGreaterThanOrEqual(0); expect(layout.right).toBeLessThanOrEqual(layout.width); expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
  if (snapshotPrefix) await expect(room(page).locator(".panel-section-heading")).toHaveScreenshot(`${snapshotPrefix}-compact-heading.png`);
  await close.click(); await expect(room(page)).toHaveCount(0); await expect(launcher(page)).toBeFocused(); await headerEntry(page, surface);
  await nativeActivate(launcher(page)); await expect(close).toBeFocused(); await page.keyboard.press("Escape");
  await expect(room(page)).toHaveCount(0); await expect(launcher(page)).toBeFocused(); expect(await savedFold(page)).toEqual(before);
}

for (const surface of ["anonymous", "signed-in", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) {
  test(`${surface} ${theme}: shared rail chrome, persisted fold, compact complete room and native header focus`, async ({ page }) => {
    test.setTimeout(60_000); await seed(page, theme); await enter(page, surface);
    if (theme === "dark") await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    const home = card(page, surface, "companion-home"), toggle = home.getByRole("button", { name: "빅타민 집", exact: true });
    await expect(home).toHaveAttribute("data-home-presentation", "panel"); await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await nativeActivate(toggle); await expect(toggle).toHaveAttribute("aria-expanded", "true"); await page.mouse.move(2, 2); await settled(page); await material(page, surface);
    await nativeActivate(toggle); await expect(toggle).toHaveAttribute("aria-expanded", "false"); expect((await savedFold(page))?.["companion-home"]).toBe(false);
    if (surface === "anonymous" || surface === "studio") {
      await settled(page);
      await expect(home).toHaveScreenshot(`${surface}-${theme}-rail-home-folded.png`);
    }
    // Reload is a real persistence test: the init script only seeds this key
    // on the first epoch visit, so it cannot restore a lost native choice.
    await page.reload(); await page.bringToFront(); await settled(page);
    if (surface === "preview") { await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click(); await settled(page); }
    await expect(card(page, surface, "companion-home").getByRole("button", { name: "빅타민 집", exact: true })).toHaveAttribute("aria-expanded", "false");
    await compact(page, surface, theme);
    await page.setViewportSize({ width: 1920, height: 1100 }); await settled(page);
    await expect(card(page, surface, "companion-home")).toHaveAttribute("data-home-presentation", "panel");
    await expect(card(page, surface, "companion-home").getByRole("button", { name: "빅타민 집", exact: true })).toHaveAttribute("aria-expanded", "false");
    expect((await savedFold(page))?.["companion-home"]).toBe(false);
  });
}

test.describe("wide touch panel title targets", () => {
  test.use({ hasTouch: true, isMobile: false });
  const cases = [
    { surface: "anonymous", theme: "light", width: 1920, height: 1100 },
    { surface: "preview", theme: "dark", width: 1920, height: 1100 },
    { surface: "studio", theme: "light", width: 1920, height: 1100, zoom: "0.9" },
    { surface: "studio", theme: "dark", width: 2560, height: 1440, zoom: "0.8" }
  ] as const;
  for (const view of cases) test(`${view.surface} ${view.theme} coarse ${view.width}: real rail titles retain 44px before and after native taps`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: view.width, height: view.height }); await seed(page, view.theme); await enter(page, view.surface);
    const capability = await page.evaluate(() => ({ coarse: matchMedia("(pointer: coarse)").matches, fine: matchMedia("(pointer: fine)").matches, touchPoints: navigator.maxTouchPoints }));
    proof.get(page)!.samples.push({ phase: "coarse-capability", capability });
    expect(capability.coarse, "PRECONDITION: actual wide touch context, without a media-query override").toBe(true); expect(capability.fine).toBe(false); expect(capability.touchPoints).toBeGreaterThan(0);
    if ("zoom" in view) await expect(page.locator(".studio-shell")).toHaveCSS("zoom", view.zoom);
    await expect(card(page, view.surface, "companion-home")).toHaveAttribute("data-home-presentation", "panel");
    for (const key of ["tag-filter", "season", "companion-home"]) {
      const panel = card(page, view.surface, key), toggle = panel.locator("[data-panel-section-toggle]");
      await expect(panel).not.toHaveClass(/agenda-legend/); await expect(toggle).toHaveCount(1); await expect(toggle).toBeVisible();
      const expanded = await toggle.getAttribute("aria-expanded"); expect(["true", "false"]).toContain(expanded);
      for (const phase of ["before", "after"] as const) {
        if (phase === "after") { await toggle.tap(); await expect(toggle).toHaveAttribute("aria-expanded", expanded === "true" ? "false" : "true"); await settled(page); }
        const size = await toggle.evaluate(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, cssMinimum: getComputedStyle(node).minHeight }; });
        proof.get(page)!.samples.push({ phase: `coarse-title-${phase}`, surface: view.surface, viewport: view.width, key, size });
        // Allow only subpixel arithmetic error from CSS zoom, not a smaller
        // target. The unfixed36px cascade fails the physical height check.
        expect(size.width).toBeGreaterThanOrEqual(44 - .01); expect(size.height).toBeGreaterThanOrEqual(44 - .01);
      }
    }
  });
});

for (const surface of ["anonymous", "studio"] as const) test(`${surface} mobile dark: companion chrome remains excluded`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page, "dark");
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster?avatar=1&signedIn=0"); await page.bringToFront(); await settled(page);
  await expect(scope(page, surface)).toBeVisible(); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const selector of [".vc-companion", ".vc-home-launcher", ".vc-home", ".vc-compact-home", ".vc-food-layer"]) await expect(page.locator(selector)).toHaveCount(0);
  await expect(scope(page, surface).locator(".public-month-grid:visible,.agenda-flow:visible,.studio-month-grid:visible,.studio-agenda:visible").first()).toBeVisible();
});
