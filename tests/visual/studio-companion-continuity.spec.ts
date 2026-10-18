import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Role = "owner" | "developer";
type Surface = "studio" | "viewer";
type Point = { x: number; y: number };
type Frame = { at: number; count: number; visible: boolean; surface: Surface; point: Point | null; platform: string; state: string; homeJourney: boolean; bounds: { left: number; top: number; right: number; bottom: number } | null; viewport: { width: number; height: number } };
type ProbeWindow = Window & { companionContinuity: { frames: Frame[]; raf: number } };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const ordinaryCard = (page: Page, surface: Surface) => page.locator(surface === "studio"
  ? ".studio-event-pill[data-companion-event='ordinary'][data-eventid]"
  : ".public-event[data-eventid]:not(.teaser):not(.teaser-revealing)");
const blocked = new WeakMap<Page, string[]>(), failures = new WeakMap<Page, string[]>(), reads = new WeakMap<Page, number[]>(), assets = new WeakMap<Page, string[]>();
const artifactPrefix = process.env.COMPANION_CONTINUITY_ARTIFACT_PREFIX ?? "companion-065-continuity";

test.use({ viewport: { width: 1920, height: 1100 } });
test.beforeEach(async ({ page }) => {
  const posts: string[] = [], errors: string[] = [], snapshots: number[] = [], requests: string[] = [];
  blocked.set(page, posts); failures.set(page, errors); reads.set(page, snapshots); assets.set(page, requests);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const publicReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(publicReads.size).toBe(1);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (/\/(?:companion\/|premiere\/vitamin-audience\.webp)/.test(path)) requests.push(path); });
  await page.route("**/*", route => {
    const request = route.request();
    // This existing read uses POST transport. Its exact build-manifest action
    // receives only the public fixture; every mutation/unknown POST is blocked.
    if (request.method() === "POST" && new URL(request.url()).pathname === "/visual-fixture/studio" && publicReads.has(request.headers()["next-action"])) {
      snapshots.push(Date.now());
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (request.method() === "POST") { posts.push(new URL(request.url()).pathname); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed"); localStorage.removeItem("vic.panelSections");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});
test.afterEach(async ({ page }) => { expect(blocked.get(page)).toEqual([]); expect(failures.get(page)).toEqual([]); });

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await page.waitForTimeout(180); // Existing event-coalesced geometry delivery.
}
async function setup(page: Page, role: Role) {
  await page.goto(`/visual-fixture/studio?role=${role}`); await page.bringToFront();
  await expect(page.locator(".studio-shell")).toBeVisible(); await settle(page);
  await expect(pet(page)).toHaveCount(1); await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
}
async function enterViewer(page: Page, role: Role, finish = true) {
  const count = reads.get(page)!.length;
  if (role === "developer") {
    await page.locator(".preview-dd-trigger").click(); await page.getByRole("menuitem", { name: "시청자 화면", exact: true }).click();
  } else await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click();
  await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
  await expect.poll(() => reads.get(page)!.length).toBe(count + 1);
  if (finish) await settle(page);
  const exposed = await ordinaryCard(page, "viewer").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-eventid")));
  expect(exposed.length).toBeGreaterThan(0); expect(exposed.every(id => samplePublicScheduleData.events.some(event => event.id === id))).toBe(true);
  await expect(page.locator(".viewer-fullscreen")).not.toContainText("비공개 합방 리허설");
}
async function enterStudio(page: Page, finish = true) {
  await page.getByRole("button", { name: "편집실로 가기", exact: true }).click();
  await expect(page.locator(".studio-shell")).toBeVisible(); await expect(page.locator(".viewer-fullscreen")).toHaveCount(0);
  if (finish) await settle(page);
}
async function point(page: Page) {
  await expect(pet(page)).toHaveCount(1); await expect(actor(page)).toBeVisible();
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; });
}
async function startProbe(page: Page) {
  await page.evaluate(() => {
    const began = performance.now(), probe: ProbeWindow["companionContinuity"] = { frames: [], raf: 0 };
    const frame = () => {
      const nodes = document.querySelectorAll<HTMLElement>(".vc-companion"), node = nodes[0], r = node?.getBoundingClientRect();
      probe.frames.push({ at: performance.now() - began, count: nodes.length, visible: Boolean(node && !node.hidden && getComputedStyle(node).display !== "none"), surface: document.querySelector(".viewer-fullscreen") ? "viewer" : "studio", point: r ? { x: r.left + r.width / 2, y: r.bottom } : null, platform: node?.dataset.platform ?? "", state: node?.dataset.state ?? "", homeJourney: Boolean(node?.hasAttribute("data-home-journey")), bounds: r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null, viewport: { width: innerWidth, height: innerHeight } });
      probe.raf = requestAnimationFrame(frame);
    };
    (window as unknown as ProbeWindow).companionContinuity = probe; probe.raf = requestAnimationFrame(frame);
  });
}
async function finishProbe(page: Page, label: string) {
  const frames = await page.evaluate(() => { const p = (window as unknown as ProbeWindow).companionContinuity; cancelAnimationFrame(p.raf); return p.frames; });
  expect(frames.length).toBeGreaterThan(12); expect(frames.every(frame => frame.count <= 1)).toBe(true);
  expect(frames.filter(frame => frame.visible).every(frame => frame.bounds && frame.bounds.left >= -.1 && frame.bounds.top >= -.1 && frame.bounds.right <= frame.viewport.width + .1 && frame.bounds.bottom <= frame.viewport.height + .1)).toBe(true);
  await test.info().attach(`${artifactPrefix}-${label}-frames`, { body: JSON.stringify(frames), contentType: "application/json" });
  console.log(JSON.stringify({ check: "studio-viewer-continuity", label, frames: frames.length, duplicateFrames: frames.filter(frame => frame.count > 1).length, publicSnapshotReads: reads.get(page)?.length, posts: blocked.get(page), errors: failures.get(page) }));
  await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-${label}.png` });
}
async function cardWitness(page: Page, role: Role) {
  // A real preview visit supplies the second layout's actual card bounds.
  // Pick a shared x inside both real cards, rather than inventing a platform
  // or treating their intentionally different vertical layouts as a reset.
  await enterViewer(page, role);
  const viewer = await ordinaryCard(page, "viewer").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { id: node.getAttribute("data-eventid")!, left: r.left, right: r.right, top: r.top }; }));
  await enterStudio(page);
  const target = await ordinaryCard(page, "studio").evaluateAll((nodes, viewer) => {
    for (const node of nodes) {
      const r = node.getBoundingClientRect(), other = viewer.find(card => card.id === node.getAttribute("data-eventid"));
      if (!other || r.width < 100 || r.top < 260 || r.top > innerHeight - 120 || other.top < 140 || other.top > innerHeight - 120) continue;
      const left = Math.max(r.left, other.left) + 44, right = Math.min(r.right, other.right) - 44;
      if (right > left) { const x = (left + right) / 2; return { id: other.id, x, u: (x - r.left) / r.width, releaseY: r.top - 24 }; }
    }
    return null;
  }, viewer);
  expect(target, "one visible ordinary public card with an actual shared x").not.toBeNull();
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(target!.x, target!.releaseY); await assertCard(page, "studio", target!.id, target!.u);
  return target!;
}
async function assertCard(page: Page, surface: Surface, id: string, u: number) {
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const card = ordinaryCard(page, surface).locator(`xpath=self::*[@data-eventid='${id}']`);
  await expect(card).toHaveCount(1);
  await expect.poll(async () => Math.abs((await point(page)).y - await card.evaluate(node => node.getBoundingClientRect().top) + 3)).toBeLessThan(2);
  // Layouts own different card widths. Preserve the occupied public card's
  // relative horizontal position, not an unrelated raw viewport coordinate.
  const mappedX = await card.evaluate((node, u) => { const r = node.getBoundingClientRect(); return r.left + r.width * u; }, u);
  expect(Math.abs((await point(page)).x - mappedX)).toBeLessThan(3);
}
async function assertHome(page: Page, kind: "seat" | "floor") {
  await expect(home(page)).toBeVisible(); await expect(home(page)).toHaveCount(1);
  // A distant native recall follows its finite real floor/ledge route. Its
  // arrival budget is 20s; ordinary local assertions retain the default 5s.
  await expect(pet(page)).toHaveAttribute("data-platform", kind === "seat" ? "companion-home" : /^companion-home-floor(?:-\d+)?$/, { timeout: 20000 });
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => {
    const y = await home(page).evaluate((node, kind) => kind === "seat" ? node.querySelector(".vc-home-cushion")!.getBoundingClientRect().top : node.querySelector(".vc-home-floor")!.getBoundingClientRect().bottom, kind);
    return Math.abs((await point(page)).y - y + (kind === "floor" ? COMPANION_HOME_FLOOR_INSET : 0));
  }).toBeLessThan(2);
}
async function clearFloor(page: Page, surface: Surface) {
  return page.locator(surface === "studio" ? ".studio-shell" : ".poster-page").evaluate(root => {
    const visible = (node: Element) => { const s = getComputedStyle(node), r = node.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > .05 && r.width > 0 && r.height > 0; };
    let y = innerHeight - 18;
    for (const bar of root.querySelectorAll(".agenda-monthbar")) { const r = bar.getBoundingClientRect(); if (visible(bar) && getComputedStyle(bar).position === "fixed" && r.top > innerHeight * .65 && r.bottom <= innerHeight + 1) y = Math.min(y, r.top - 8); }
    const obstacles = [...document.querySelectorAll("button,a[href],input,select,textarea,[role='button'],.vc-home")].filter(node => visible(node) && !node.matches(".studio-day,.public-day,.agenda-day,[data-companion-event='ordinary'],.public-event[data-eventid],.agenda-event[data-eventid]") && !node.closest(".vc-companion")).map(node => node.getBoundingClientRect());
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let text: Node | null;
    while ((text = walker.nextNode())) { if (!text.textContent?.trim() || !text.parentElement || !visible(text.parentElement)) continue; const range = document.createRange(); range.selectNodeContents(text); obstacles.push(...range.getClientRects()); }
    const xs: number[] = [];
    for (let x = innerWidth * .75; x >= 60; x -= 12) if (!obstacles.some(r => r.left < x + 38 && r.right > x - 38 && r.top < y + 3 && r.bottom > y - 73)) xs.push(x);
    return { xs, y };
  });
}

for (const role of ["owner", "developer"] as const) test(`${role} native viewer round trips retain the same public card and relative horizontal position`, async ({ page }) => {
  await setup(page, role); const target = await cardWitness(page, role), saved = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"));
  await startProbe(page);
  for (let round = 0; round < (role === "developer" ? 3 : 1); round++) {
    await enterViewer(page, role, round === 0); await assertCard(page, "viewer", target.id, target.u);
    await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
    await enterStudio(page, round === 0); await assertCard(page, "studio", target.id, target.u);
  }
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(saved);
  expect(reads.get(page)).toHaveLength(role === "developer" ? 4 : 2);
  await finishProbe(page, `${role}-card-roundtrip`);
});

test("the actual cushion and room floor stay at home across owner viewer transitions", async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, "owner"); await home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).focus();
  await startProbe(page);
  await home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).press("Enter"); await assertHome(page, "seat");
  for (const kind of ["seat", "floor"] as const) {
    if (kind === "floor") {
      const at = await home(page).evaluate(node => { const r = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: r.left + r.width * .3, y: r.bottom }; });
      await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(at.x, at.y - COMPANION_HOME_FLOOR_INSET - 8); await assertHome(page, "floor");
    }
    await enterViewer(page, "owner"); await assertHome(page, kind); await enterStudio(page); await assertHome(page, kind);
  }
  expect(reads.get(page)).toHaveLength(2);
  await finishProbe(page, "home-seat-floor");
});

test("a folded home resident waits invisibly through owner preview and recovers only when the actual panel reopens", async ({ page }) => {
  test.setTimeout(60000);
  await setup(page, "owner");
  const cushion = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await cushion.focus(); await startProbe(page); await cushion.press("Enter"); await assertHome(page, "seat");
  await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settle(page);
  await expect(home(page)).toHaveCount(0); await expect(pet(page)).toHaveCount(1); await expect(pet(page)).toBeHidden();
  await enterViewer(page, "owner");
  await expect(home(page)).toHaveCount(0); await expect(pet(page)).toHaveCount(1); await expect(pet(page)).toBeHidden();
  const pending = await pet(page).evaluate(async node => {
    let writes = 0; const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(node, { attributes: true, subtree: true });
    await new Promise(resolve => setTimeout(resolve, 350)); observer.disconnect();
    return { writes, platform: (node as HTMLElement).dataset.platform ?? "", transfer: (node as HTMLElement).dataset.positionTransfer ?? "" };
  });
  expect(pending.writes, "a hidden resident awaiting a real house has no ticking paint mutations").toBe(0);
  expect(pending.platform === "" || pending.platform === "companion-home").toBe(true);
  expect(pending.transfer).not.toBe("nearby");
  const hiddenFrames = await page.evaluate(() => (window as unknown as ProbeWindow).companionContinuity.frames.filter(frame => frame.surface === "viewer"));
  expect(hiddenFrames.length).toBeGreaterThan(12); expect(hiddenFrames.every(frame => !frame.visible && frame.count <= 1)).toBe(true);
  await page.getByRole("button", { name: "패널 펼치기", exact: true }).click(); await settle(page); await assertHome(page, "seat");
  await expect(pet(page)).toHaveAttribute("data-position-transfer", "home");
  await enterStudio(page); await assertHome(page, "seat"); await expect(pet(page)).toHaveAttribute("data-position-transfer", "home");
  expect(reads.get(page)).toHaveLength(1);
  console.log(JSON.stringify({ check: "folded-home-pending", pending, hiddenFrames: hiddenFrames.length }));
  await finishProbe(page, "folded-home-recovery");
});

test("a closed home keeps a genuine safe floor placement through developer preview without opening a house", async ({ page }) => {
  await setup(page, "developer"); await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settle(page); await expect(home(page)).toHaveCount(0);
  // Observe both untouched layouts first. A shared clear x makes preservation
  // meaningful without declaring a legitimate target-side clamp a failure.
  await enterViewer(page, "developer"); await expect(home(page)).toHaveCount(0); const viewerFloor = await clearFloor(page, "viewer");
  await enterStudio(page); const studioFloor = await clearFloor(page, "studio"), x = studioFloor.xs.find(x => viewerFloor.xs.includes(x));
  expect(x, "a genuine shared clear floor ray, with actual text and controls intact").toBeDefined();
  await actor(page).focus(); await actor(page).press("p");
  await page.mouse.click(x!, studioFloor.y - 1); await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await startProbe(page); const before = await point(page);
  await enterViewer(page, "developer"); await expect(home(page)).toHaveCount(0); await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  expect(Math.abs((await point(page)).x - before.x)).toBeLessThan(3);
  expect(reads.get(page)).toHaveLength(2);
  await enterStudio(page); await expect(home(page)).toHaveCount(0); await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  expect(Math.abs((await point(page)).x - before.x)).toBeLessThan(3);
  await finishProbe(page, "closed-home-floor");
});

test.describe("mobile remains companion-free during real role transitions", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("owner and developer viewer controls preserve stored desktop ON without loading a companion", async ({ page }) => {
    const selector = ".vc-companion,.vc-home,.vc-food,.vc-food-layer,.vc-compact-home,.vc-bed-foreground,.pm-fan,.pm-cast-row";
    for (const role of ["owner", "developer"] as const) {
      await page.goto(`/visual-fixture/studio?role=${role}`); await page.bringToFront(); await settle(page); await expect(page.locator(selector)).toHaveCount(0);
      const preferences = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion")); expect(JSON.parse(preferences!).enabled).toBe(true);
      if (role === "developer") { await page.locator(".preview-dd-trigger").tap(); await page.getByRole("menuitem", { name: "시청자 화면", exact: true }).tap(); }
      else await page.getByRole("button", { name: "시청자 화면", exact: true }).tap();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settle(page); await expect(page.locator(selector)).toHaveCount(0);
      await page.getByRole("button", { name: "편집실로 가기", exact: true }).tap(); await expect(page.locator(".studio-shell")).toBeVisible(); await settle(page); await expect(page.locator(selector)).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(preferences);
    }
    expect(assets.get(page)).toEqual([]); expect(reads.get(page)).toHaveLength(2);
    await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-native390-off.png` });
  });
});
