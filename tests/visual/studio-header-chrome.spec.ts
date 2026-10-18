import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { settlePanelLayout } from "./helpers/panel-layout";

type Role = "owner" | "developer";
type Proof = { writes: string[]; errors: string[]; reads: number; samples: unknown[] };
const proof = new WeakMap<Page, Proof>();
const output = ".scratch-pw/102-studio-header";
const copy = (page: Page) => page.locator(".studio-shell .studio-build-copy");
const launcher = (page: Page) => page.locator(".studio-topbar .vc-home-launcher:visible");
const room = (page: Page) => page.locator(".vc-home:visible");

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000);
  const evidence: Proof = { writes: [], errors: [], reads: 0, samples: [] }; proof.set(page, evidence);
  page.on("pageerror", error => evidence.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const publicReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(publicReads.size).toBe(1);
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    // A public preview read uses POST transport. Only this exact built action
    // receives the public fixture; no action or mutation reaches Supabase.
    if (request.method() === "POST" && path === "/visual-fixture/studio" && publicReads.has(request.headers()["next-action"])) {
      evidence.reads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      evidence.writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (path.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
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

async function seed(page: Page, dark: boolean) {
  await page.addInitScript(({ dark, key, epoch, preferences }) => {
    // Saved device choices only. The real media queries, clock, random source,
    // focus, geometry and product callbacks remain untouched.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": dark ? "on" : "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left", "vic_panel_collapsed": "1" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
  }, { dark, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES });
}
async function nativeActivate(target: Locator) {
  await target.focus(); await expect(target).toBeFocused(); await target.press("Enter");
}
async function clickVisibleMenuItem(page: Page, name: string) {
  const item = page.getByRole("menuitem", { name, exact: true });
  await expect(item).toBeVisible(); await settlePanelLayout(page);
  const bounds = await item.boundingBox(); expect(bounds).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(await item.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(hit && node.contains(hit)); })).toBe(true);
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
}
async function sample(page: Page, phase: string) {
  const value = await page.evaluate(() => {
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const visible = (element: Element) => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.visibility === "visible" && s.display !== "none"; };
    const hit = (element: Element) => { const r = element.getBoundingClientRect(), target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return Boolean(target && (element === target || element.contains(target))); };
    const shell = document.querySelector<HTMLElement>(".studio-shell")!, root = getComputedStyle(shell), header = shell.querySelector(".studio-topbar"), badge = shell.querySelector(".studio-build-copy"), home = header?.querySelector(".vc-home-launcher"), left = header?.querySelector(".studio-left");
    const calendar = shell.querySelector(".studio-month-grid,.agenda-studio")!;
    const overlap = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const cells = [...shell.querySelectorAll(".studio-role-tools .actor-badge,.studio-role-tools .io-preview,.studio-role-tools .preview-dd-trigger,.studio-role-tools .io-logout")].filter(visible).map(element => {
      const style = getComputedStyle(element);
      return { action: element.getAttribute("data-act") ?? "role-label", rect: rect(element), radius: style.borderRadius, background: style.backgroundColor, image: style.backgroundImage, shadow: style.boxShadow, weight: style.fontWeight, nativeHit: element.matches(".actor-badge") ? null : hit(element) };
    });
    const chrome = header ? [...header.querySelectorAll(".studio-month-label,.studio-role-tools")].filter(visible).map(rect) : [];
    return { calendar: rect(calendar), scrollY, height: document.documentElement.scrollHeight, viewport: { width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, zoom: root.zoom, radius: root.getPropertyValue("--r-md").trim(), pill: root.getPropertyValue("--r-pill").trim(), cells,
      badge: badge ? { ...rect(badge), nativeHit: hit(badge), position: getComputedStyle(badge).position, z: Number(getComputedStyle(badge).zIndex), inHeader: Boolean(badge.closest(".studio-topbar")), popupZ: Number(root.getPropertyValue("--z-cal-pop").trim() || 12) } : null,
      home: home && visible(home) ? { ...rect(home), nativeHit: hit(home), radius: getComputedStyle(home).borderRadius, weight: getComputedStyle(home).fontWeight, leftEdge: left ? rect(left).left : null, firstChild: Boolean(left?.firstElementChild?.contains(home)), overlap: chrome.reduce((sum, peer) => sum + overlap(rect(home), peer), 0) } : null };
  });
  proof.get(page)!.samples.push({ phase, value }); return value;
}
function sameCalendar(before: Awaited<ReturnType<typeof sample>>, after: Awaited<ReturnType<typeof sample>>) {
  for (const key of ["left", "top", "width", "height"] as const) expect(Math.abs(after.calendar[key] - before.calendar[key]), `calendar ${key} remains stable`).toBeLessThan(1);
  expect(after.scrollY).toBe(before.scrollY); expect(after.height).toBe(before.height);
}
async function previewRoundTrip(page: Page, role: Role, agenda: boolean, nativeBack = false) {
  const before = proof.get(page)!.reads;
  const step = async (phase: string) => { proof.get(page)!.samples.push({ phase, value: await page.evaluate(() => ({ scrollY, menu: document.querySelector(".preview-dd-menu")?.getBoundingClientRect().toJSON() })) }); };
  await step("before-preview-controls");
  if (role === "developer") {
    const trigger = page.locator(".preview-dd-trigger:visible");
    await nativeActivate(trigger); await expect(page.getByRole("menu")).toBeVisible();
    await step("owner-menu-open");
    await clickVisibleMenuItem(page, "관리자 화면");
    await step("owner-mode-picked");
    await expect(trigger).toHaveClass(/previewing/); await expect(page.getByRole("menu")).toHaveCount(0);
    await nativeActivate(trigger); await clickVisibleMenuItem(page, "개발자 화면");
    await step("developer-mode-picked");
    await expect(trigger).not.toHaveClass(/previewing/);
    await nativeActivate(trigger); await step("viewer-menu-open"); await clickVisibleMenuItem(page, "시청자 화면");
  } else await page.locator(agenda ? ".m-io-preview" : ".io-preview").click();
  await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
  await expect.poll(() => proof.get(page)!.reads).toBe(before + 1);
  await expect(page.locator(".viewer-fullscreen .studio-build-copy,.viewer-fullscreen .studio-role-tools")).toHaveCount(0);
  const observeReturn = role === "developer" && !agenda && (await page.viewportSize())?.width === 1280;
  if (observeReturn) await page.evaluate(() => {
    const rows: unknown[] = [];
    const record = (event: Event | string) => {
      const calendar = document.querySelector(".studio-month-grid"), r = calendar?.getBoundingClientRect();
      rows.push({ at: performance.now(), event: typeof event === "string" ? event : event.type, scrollY, top: r?.top, documentTop: r ? r.top + scrollY : null, height: document.documentElement.scrollHeight, overlay: Boolean(history.state?.vicOverlay), active: document.activeElement?.getAttribute("data-act") });
    };
    const stop = () => { window.removeEventListener("scroll", record); window.removeEventListener("popstate", record); record("end"); return rows; };
    (window as Window & { __headerReturnProbe?: () => unknown[] }).__headerReturnProbe = stop;
    window.addEventListener("scroll", record, { passive: true }); window.addEventListener("popstate", record); record("before-return");
  });
  if (nativeBack) await page.goBack();
  else await page.getByRole("button", { name: "편집실로 가기", exact: true }).click();
  await expect(page.locator(".viewer-fullscreen")).toHaveCount(0); await expect(page.locator(".studio-shell")).toBeVisible();
  await settlePanelLayout(page);
  if (observeReturn) {
    // Bounded diagnostic observation only: never restore or override scroll.
    await page.waitForTimeout(1200);
    const timeline = await page.evaluate(() => {
      const target = window as Window & { __headerReturnProbe?: () => unknown[] }, rows = target.__headerReturnProbe?.();
      delete target.__headerReturnProbe; return rows;
    });
    proof.get(page)!.samples.push({ phase: "native-preview-return-timeline", timeline });
  }
}

for (const view of [
  { name: "wide-light", width: 1920, height: 1100, dark: false, zoom: "0.9" },
  { name: "compact-dark", width: 1280, height: 720, dark: true, zoom: "1" },
  { name: "large-zoom", width: 2560, height: 1440, dark: false, zoom: "0.8" },
]) for (const role of (view.name === "large-zoom" ? ["developer"] : ["owner", "developer"]) as Role[]) test(`${role} ${view.name}: rounded account cells, leftmost home, quiet footer copy and preview return`, async ({ page, context }) => {
  await page.setViewportSize({ width: view.width, height: view.height }); await seed(page, view.dark);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/visual-fixture/studio?role=${role}`); await page.bringToFront();
  await expect(launcher(page)).toBeVisible(); await settlePanelLayout(page); await page.mouse.move(2, 2);
  const initial = await sample(page, "initial");
  expect(initial.zoom).toBe(view.zoom); expect(initial.viewport.scrollWidth).toBeLessThanOrEqual(initial.viewport.clientWidth);
  expect(initial.cells).toHaveLength(3);
  for (const cell of initial.cells) {
    expect(cell.radius, cell.action).toBe(initial.radius); expect(cell.image, cell.action).toBe("none"); expect(cell.shadow, cell.action).toBe("none"); expect(cell.weight).toBe("600");
    // The non-interactive role label retains its semantic dark-mode tint;
    // actual preview/logout buttons share the transparent card surface.
    if (cell.action !== "role-label") expect(cell.background, cell.action).toBe("rgba(0, 0, 0, 0)");
    if (cell.nativeHit !== null) expect(cell.nativeHit, cell.action).toBe(true);
  }
  const hoverMaterials = [];
  for (const action of [page.locator(".studio-role-tools .io-preview,.studio-role-tools .preview-dd-trigger"), page.locator(".studio-role-tools .io-logout")]) {
    await action.hover(); await settlePanelLayout(page);
    hoverMaterials.push(await action.evaluate(node => { const s = getComputedStyle(node); return { radius: s.borderRadius, background: s.backgroundColor, image: s.backgroundImage, shadow: s.boxShadow }; }));
  }
  proof.get(page)!.samples.push({ phase: "account-hover", hoverMaterials });
  expect(hoverMaterials[0]).toEqual(hoverMaterials[1]); expect(hoverMaterials[0].radius).toBe(initial.radius);
  await page.mouse.move(2, 2); await settlePanelLayout(page);
  expect(initial.home).not.toBeNull(); const home = initial.home!;
  expect(home.firstChild).toBe(true); expect(home.left).toBeCloseTo(home.leftEdge!, 1); expect(home.overlap).toBe(0); expect(home.nativeHit).toBe(true);
  expect(home.width).toBeGreaterThanOrEqual(43.5); expect(home.height).toBeCloseTo(44, 0); expect(home.radius).toBe(initial.pill); expect(home.weight).toBe("600");
  expect(initial.badge).not.toBeNull(); const badge = initial.badge!;
  expect(badge.position).toBe("fixed"); expect(badge.inHeader).toBe(false); expect(badge.nativeHit).toBe(true); expect(badge.z).toBeLessThan(badge.popupZ);
  expect(badge.left).toBeCloseTo(16, 0); expect(initial.viewport.height - badge.bottom).toBeCloseTo(16, 0); expect(badge.top).toBeGreaterThan(home.bottom);
  const label = (await copy(page).textContent())!.trim();
  await copy(page).click(); await expect(copy(page)).toHaveText("복사됨 ✓");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(label);
  await settlePanelLayout(page); const copied = await sample(page, "copied"); sameCalendar(initial, copied);
  expect(copied.home!.left).toBeCloseTo(home.left, 1); expect(copied.home!.width).toBeCloseTo(home.width, 1);
  await expect(copy(page)).toHaveText(label, { timeout: 2500 });
  await nativeActivate(launcher(page)); await expect(room(page)).toBeVisible(); await settlePanelLayout(page);
  sameCalendar(initial, await sample(page, "home-open")); await expect(launcher(page)).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape"); await expect(room(page)).toHaveCount(0); await expect(launcher(page)).toBeFocused();
  await previewRoundTrip(page, role, false); sameCalendar(initial, await sample(page, "returned"));
  if (view.name === "compact-dark" && role === "developer") {
    await previewRoundTrip(page, role, false, true);
    sameCalendar(initial, await sample(page, "native-back-returned"));
  }
  if (view.name === "wide-light" && role === "owner") {
    await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
    const rail = page.locator(".avatar-rail:visible"); await expect(rail).toBeVisible(); await settlePanelLayout(page);
    const layering = await rail.evaluate(node => {
      const badge = document.querySelector(".studio-build-copy")!, badgeRect = badge.getBoundingClientRect();
      const intersections = [...node.querySelectorAll(".panel-section,.studio-tools")].map(panel => {
        const r = panel.getBoundingClientRect(), left = Math.max(r.left, badgeRect.left), right = Math.min(r.right, badgeRect.right), top = Math.max(r.top, badgeRect.top), bottom = Math.min(r.bottom, badgeRect.bottom);
        const style = getComputedStyle(panel);
        if (style.display === "none" || style.visibility !== "visible") return null;
        if (right <= left || bottom <= top) return null;
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        return { panel: panel.className, nativePanelHit: Boolean(hit && panel.contains(hit)), badgeHit: Boolean(hit && badge.contains(hit)) };
      }).filter(value => value !== null);
      return { badgeZ: Number(getComputedStyle(badge).zIndex), railZ: Number(getComputedStyle(node).zIndex), intersections };
    });
    proof.get(page)!.samples.push({ phase: "wide-left-panel-layering", layering });
    expect(layering.badgeZ).toBeLessThan(layering.railZ);
    for (const overlap of layering.intersections) { expect(overlap.nativePanelHit, overlap.panel).toBe(true); expect(overlap.badgeHit, overlap.panel).toBe(false); }
  }
});

for (const view of [
  { name: "mobile390", width: 390, height: 844 },
  { name: "coarse-landscape", width: 1120, height: 600 },
]) test.describe(view.name, () => {
  test.use({ viewport: { width: view.width, height: view.height }, isMobile: true, hasTouch: true });
  for (const role of (view.name === "mobile390" ? ["owner", "developer"] : ["owner"]) as Role[]) test(`${role}: agenda excludes deployment metadata and compact companion chrome`, async ({ page }) => {
    await seed(page, true); await page.goto(`/visual-fixture/studio?role=${role}`); await page.bringToFront();
    await expect(page.locator(".studio-mobile")).toBeVisible(); await settlePanelLayout(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    for (const selector of [".studio-build-copy", ".studio-build-tag-m", ".vc-home-launcher", ".vc-home", ".vc-companion"]) await expect(page.locator(selector)).toHaveCount(0);
    const initial = await sample(page, "agenda"); expect(initial.viewport.scrollWidth).toBeLessThanOrEqual(initial.viewport.clientWidth);
    const account = page.locator(".m-head-logout button:visible"); await expect(account).toHaveAccessibleName("로그아웃");
    const size = await account.boundingBox(); expect(size!.width).toBeGreaterThanOrEqual(44); expect(size!.height).toBeGreaterThanOrEqual(44);
    await previewRoundTrip(page, role, true);
    for (const selector of [".studio-build-copy", ".studio-build-tag-m", ".vc-home-launcher"]) await expect(page.locator(selector)).toHaveCount(0);
  });
});
