import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { enterCompanionMeadow, placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import { companionTraceMode } from "./helpers/companion-evidence-policy";

const fonts = new Set([...readFileSync("app/fonts.css", "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
// These native frame/latency oracles measure one active seasonal world.
// Concurrent full worlds contend for this machine's GPU and input queue;
// serialize this file without changing its timing, motion or contact limits.
test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", video: { mode: "on", size: { width: 1920, height: 1080 } }, trace: companionTraceMode() });
test.setTimeout(90000);
test.beforeEach(async ({ page, context, baseURL }, info) => {
  const origin = new URL(baseURL!).origin;
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, []);
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Credential-free seasonal transition fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, epoch, key, reduced }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", v: 3, at: Date.now() }));
    localStorage.setItem("vic.ambient", "on"); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.premiereStage", "off"); localStorage.setItem("vic_avatar_side", "left");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: false, feeding: true, activeWhileVisible: true, heartPrank: false, ambientPrank: false, personality: "balanced", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care, fullness: .99, energy: .95 }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, reduced: info.title.includes("reduced") });
});

async function placeItem(page: Page, item: Locator, point: { x: number; y: number }) {
  await expect(item).toBeVisible();
  const rect = (await item.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 16 }); await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2);
}

async function expectHomecoming(page: Page) {
  const pet = page.locator(".vc-companion");
  await expect(page.locator(".vc-meadow-walk")).toHaveCount(0);
  await expect(pet).toBeVisible(); await expect(pet).toHaveAttribute("data-platform", "companion-home-floor-400");
  await expect(pet).not.toHaveAttribute("data-state", "jump");
  const contact = await page.evaluate(() => {
    const body = document.querySelector(".vc-companion")!.getBoundingClientRect(), mat = document.querySelector(".vc-home-wash-stance")!.getBoundingClientRect();
    return { x: body.left + body.width / 2, y: body.bottom, mat: { left: mat.left, right: mat.right, top: mat.top, bottom: mat.bottom } };
  });
  expect(contact.x).toBeGreaterThanOrEqual(contact.mat.left - 2); expect(contact.x).toBeLessThanOrEqual(contact.mat.right + 2);
  expect(contact.y).toBeGreaterThanOrEqual(contact.mat.top - 2); expect(contact.y).toBeLessThanOrEqual(contact.mat.bottom + 2);
}

async function recordHomecoming(page: Page) {
  return page.evaluate(() => {
    const departureFoot = () => {
      const actor = document.querySelector<HTMLElement>(".vc-meadow-walk");
      if (actor && !actor.hidden) return { x: Number(actor.dataset.x), y: Number(actor.dataset.y), state: actor.dataset.state ?? "", lift: Number(actor.dataset.groundY) - Number(actor.dataset.y) };
      const ordinary = document.querySelector<HTMLElement>(".vc-companion")!, box = ordinary.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.bottom, state: ordinary.dataset.state ?? "", lift: 0 };
    };
    const setupDeparture = departureFoot();
    const probe = { setupDeparture, departure: setupDeparture, entrySource: null as { x: number; y: number } | null,
      armedAt: performance.now(), inputAt: null as number | null, transitionAt: null as number | null,
      frames: [] as { x: number; y: number; state: string; at: number; fromSetupMs: number }[] };
    // Browser-native input delivery is the latency origin. The preceding
    // evaluate/keyboard controller round trip is retained separately.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || !event.isTrusted || probe.inputAt !== null) return;
      probe.inputAt = event.timeStamp;
      // The shared window capture handler can synchronously dispatch its
      // transition before this later key listener. Keep that pre-exit foot.
      if (probe.transitionAt === null) probe.departure = departureFoot();
    };
    const onEntryPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-act="ambient-showcase"]')) return;
      const box = document.querySelector(".vc-companion")!.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) probe.entrySource = { x: box.left + box.width / 2, y: box.bottom };
    };
    const onTransition = (event: Event) => {
      const detail = (event as CustomEvent<{ active: boolean; phase: string }>).detail;
      if (!detail || detail.phase !== "before") return;
      if (detail.active) {
        // Opening the season controls can move the real house. The source
        // belongs to this actual entry frame, not an earlier setup layout.
        const box = document.querySelector(".vc-companion")!.getBoundingClientRect();
        if (!probe.entrySource && box.width > 0 && box.height > 0) probe.entrySource = { x: box.left + box.width / 2, y: box.bottom };
        return;
      }
      if (probe.transitionAt !== null) return;
      probe.transitionAt = performance.now();
      if (probe.inputAt === null) probe.departure = departureFoot();
    };
    document.addEventListener("pointerdown", onEntryPointer, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("vic:showcase-transition", onTransition, true);
    (window as Window & { homecoming?: typeof probe }).homecoming = probe;
    const sample = () => {
      const now = performance.now(), origin = probe.inputAt ?? probe.transitionAt;
      const pet = document.querySelector<HTMLElement>(".vc-companion");
      if (origin !== null && pet && !pet.hidden && getComputedStyle(pet).display !== "none") {
        const box = pet.getBoundingClientRect();
        probe.frames.push({ x: box.left + box.width / 2, y: box.bottom, state: pet.dataset.state ?? "", at: now - origin, fromSetupMs: now - probe.armedAt });
      }
      if (now - (origin ?? probe.armedAt) < (origin === null ? 10000 : 3500)) requestAnimationFrame(sample);
      else { document.removeEventListener("pointerdown", onEntryPointer, true); window.removeEventListener("keydown", onKey, true); window.removeEventListener("vic:showcase-transition", onTransition, true); }
    }; requestAnimationFrame(sample);
  });
}

async function expectReturnJump(page: Page, info: TestInfo, attachment = "return-frames") {
  // Preserve the observed frames even when a later timing/contact assertion
  // fails. The bounded wait observes product DOM without changing its clock.
  let observationError: unknown;
  try {
    await page.waitForFunction(() => {
      const pet = document.querySelector<HTMLElement>(".vc-companion");
      return pet && !pet.hidden && pet.dataset.platform === "companion-home-floor-400" && pet.dataset.state !== "jump" && !document.querySelector(".vc-meadow-walk");
    }, undefined, { timeout: 7000 });
  } catch (error) { observationError = error; }
  const record = await page.evaluate(() => {
    const probe = (window as Window & { homecoming?: { setupDeparture: { x: number; y: number }; entrySource: { x: number; y: number } | null; departure: { x: number; y: number; state: string; lift: number }; armedAt: number; inputAt: number | null; transitionAt: number | null; frames: { x: number; y: number; state: string; at: number; fromSetupMs: number }[] } }).homecoming!;
    return { ...probe, inputFromSetupMs: probe.inputAt === null ? null : probe.inputAt - probe.armedAt,
      transitionFromInputMs: probe.inputAt === null || probe.transitionAt === null ? null : probe.transitionAt - probe.inputAt };
  });
  await info.attach(attachment, { body: JSON.stringify(record), contentType: "application/json" });
  if (observationError) throw observationError;
  await expectHomecoming(page);
  expect(record.inputAt).not.toBeNull(); expect(record.transitionAt).not.toBeNull();
  const { frames, departure } = record;
  const jump = frames.filter(frame => frame.state === "jump");
  expect(jump.length).toBeGreaterThan(5);
  expect(Math.hypot(jump[0].x - departure.x, jump[0].y - departure.y)).toBeLessThan(30);
  expect(jump[0].at).toBeLessThan(350);
  for (let index = 1; index < jump.length; index++) expect(Math.hypot(jump[index].x - jump[index - 1].x, jump[index].y - jump[index - 1].y)).toBeLessThan(180);
  return record;
}

for (const surface of ["viewer", "studio", "preview"] as const) {
  test(`${surface}: home departure jumps during fade and covered physical items are removed on shower-pad return`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : `/visual-fixture/studio?role=developer&y=2026&m=3${surface === "preview" ? "&viewer=1" : ""}`);
    await page.bringToFront(); const home = await openCompanionHome(page);
    const fold = home.locator('[data-home-action="fold"]'); if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
    await placeCompanionOnHomeFloor(page);
    const petIdentity = await page.locator(".vc-companion").elementHandle();
    for (const [kind, x] of [["food", 90], ["toy", 170], ["food", 250], ["toy", 330]] as const) {
      const items = page.locator(kind === "food" ? ".vc-food" : ".vc-toy"), before = await items.count();
      await home.getByRole("button", { name: kind === "food" ? "밥 꺼내기" : "장난감 상자 열기", exact: true }).click();
      await expect(items).toHaveCount(before + 1); const item = items.nth(before);
      if (kind === "food") await expect(item).not.toHaveAttribute("data-falling"); else await expect(item).toHaveAttribute("data-falling", "false");
      await placeItem(page, item, { x, y: 990 }); await expect(item).toHaveAttribute("data-platform", /^viewport-floor/);
    }
    const foodIds = await page.locator(".vc-food").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food!));
    const toyIds = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.toyId!));
    const cover = await page.locator(surface === "viewer" || surface === "preview" ? ".public-calendar-area:visible" : ".studio-calendar-panel:visible").first().boundingBox(); expect(cover).not.toBeNull();
    const source = await page.locator(".vc-companion").evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom }; });
    await page.evaluate(() => {
      const frames: { at: number; state: string; opacity: number; lift: number; x: number; y: number; ordinaryVisible: boolean }[] = [];
      let started = performance.now();
      window.addEventListener("vic:showcase-transition", event => { const detail = (event as CustomEvent<{ active: boolean; phase: string }>).detail; if (detail.active && detail.phase === "before") started = performance.now(); });
      (window as Window & { seasonFrames?: typeof frames }).seasonFrames = frames;
      const sample = () => {
        const actor = document.querySelector<HTMLElement>(".vc-meadow-walk"), ordinary = document.querySelector<HTMLElement>(".vc-companion"), layout = document.querySelector(".public-calendar-area,.studio-calendar-panel");
        let opacity = 1; for (let node = layout; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        if (actor && !actor.hidden) frames.push({ at: performance.now() - started, state: actor.dataset.state ?? "", opacity, lift: Number(actor.dataset.groundY) - Number(actor.dataset.y), x: Number(actor.dataset.x), y: Number(actor.dataset.y), ordinaryVisible: Boolean(ordinary && !ordinary.hidden && getComputedStyle(ordinary).display !== "none") });
        if (performance.now() - started < 4000) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
    await expect(meadow).toBeVisible(); await expect(meadow).toHaveAttribute("data-state", "idle", { timeout: 7000 });
    const frames = await page.evaluate(() => (window as Window & { seasonFrames?: { at: number; state: string; opacity: number; lift: number; x: number; y: number; ordinaryVisible: boolean }[] }).seasonFrames ?? []);
    await info.attach("departure-frames", { body: JSON.stringify(frames), contentType: "application/json" });
    expect(frames[0]?.at).toBeLessThan(200);
    expect(frames.some(frame => frame.state === "jump" && frame.lift > 30 && frame.opacity > .05 && frame.opacity < 1)).toBe(true);
    expect(frames.every(frame => !frame.ordinaryVisible)).toBe(true);
    expect(frames.every(frame => Math.abs(frame.x - source.x) < 2)).toBe(true);
    expect(frames.at(-1)!.y).toBeGreaterThanOrEqual(source.y - 2);
    const covered = { x: cover!.x + cover!.width / 2, y: cover!.y + cover!.height * .6 };
    await placeItem(page, page.locator(`[data-food="${foodIds[0]}"]`), covered);
    await placeItem(page, page.locator(`[data-toy-id="${toyIds[0]}"]`), { x: covered.x + 70, y: covered.y });
    await recordHomecoming(page);
    await page.keyboard.press("Escape");
    await expectReturnJump(page, info);
    await expect(page.locator(`[data-food="${foodIds[0]}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${toyIds[0]}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-food="${foodIds[1]}"]`)).toBeVisible(); await expect(page.locator(`[data-toy-id="${toyIds[1]}"]`)).toBeVisible();
    expect(await petIdentity!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    await page.screenshot({ path: info.outputPath("homecoming.png") });
    await enterCompanionMeadow(page); await expect(meadow).toHaveAttribute("data-state", "idle");
    await expect(page.locator(`[data-food="${foodIds[0]}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${toyIds[0]}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape"); await expectHomecoming(page); expect(errors).toEqual([]);
  });
}

test("reduced motion: quiet meadow entry and immediate shower-pad homecoming", async ({ page }) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
  await expect(meadow).toBeVisible(); await expect(meadow).toHaveAttribute("data-state", "idle");
  expect(await meadow.evaluate(node => Number((node as HTMLElement).dataset.y) === Number((node as HTMLElement).dataset.groundY))).toBe(true);
  await page.keyboard.press("Escape"); await expectHomecoming(page);
});

test("folded house opens on return and compact house restores its shower pad", async ({ page }, info) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); const home = await openCompanionHome(page);
  await placeCompanionOnExposedBackground(page, 180);
  const fold = home.locator('[data-home-action="fold"]'); if (await fold.getAttribute("aria-expanded") === "true") await fold.click();
  await enterCompanionMeadow(page); await expect(page.locator(".vc-meadow-walk")).toBeVisible();
  await recordHomecoming(page);
  await page.keyboard.press("Escape"); await expectReturnJump(page, info); await expect(fold).toHaveAttribute("aria-expanded", "true");
  await enterCompanionMeadow(page); await expect(page.locator(".vc-meadow-walk")).toBeVisible();
  await page.setViewportSize({ width: 1380, height: 900 });
  await expect(page.locator(".vc-meadow-walk")).toBeVisible();
  await page.keyboard.press("Escape"); await expectHomecoming(page);
  await expect(page.locator(".vc-compact-home")).toBeVisible();
});

test("local low landing keeps its horizontal position and an airborne exit jumps from the painted foot", async ({ page }, info) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); await openCompanionHome(page);
  // A genuine home departure still jumps. An already exposed resident now
  // enters quietly by owner instruction, so it cannot set up an airborne exit.
  await placeCompanionOnHomeFloor(page);
  await recordHomecoming(page); await enterCompanionMeadow(page);
  await page.waitForFunction(() => { const actor = document.querySelector<HTMLElement>(".vc-meadow-walk"); return actor?.dataset.state === "jump" && Number(actor.dataset.groundY) - Number(actor.dataset.y) > 65; });
  await page.keyboard.press("Escape"); const record = await expectReturnJump(page, info, "airborne-return-frames");
  expect(record.departure.state).toBe("jump"); expect(record.departure.lift).toBeGreaterThan(40);
  expect(record.entrySource).not.toBeNull();
  expect(record.departure.x).toBeCloseTo(record.entrySource!.x, 0); expect(record.departure.y).toBeLessThan(record.entrySource!.y - 40);
  await placeCompanionOnExposedBackground(page, 90);
  const exposedSource = await page.locator(".vc-companion").evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom }; });
  await page.evaluate(() => {
    const frames: { x: number; y: number; state: string }[] = [], began = performance.now();
    (window as Window & { exposedEntryFrames?: typeof frames }).exposedEntryFrames = frames;
    const sample = () => {
      const actor = document.querySelector<HTMLElement>(".vc-meadow-walk");
      if (actor && !actor.hidden) frames.push({ x: Number(actor.dataset.x), y: Number(actor.dataset.y), state: actor.dataset.state ?? "" });
      if (performance.now() - began < 5000) requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
  let entryObservationError: unknown;
  try { await page.waitForFunction(() => ((window as Window & { exposedEntryFrames?: unknown[] }).exposedEntryFrames?.length ?? 0) >= 6, undefined, { timeout: 5000 }); }
  catch (error) { entryObservationError = error; }
  const entryFrames = await page.evaluate(() => (window as Window & { exposedEntryFrames?: { x: number; y: number; state: string }[] }).exposedEntryFrames ?? []);
  await info.attach("exposed-quiet-entry-frames", { body: JSON.stringify({ exposedSource, frames: entryFrames }), contentType: "application/json" });
  if (entryObservationError) throw entryObservationError;
  expect(entryFrames.every(frame => frame.state !== "jump")).toBe(true);
  expect(entryFrames.every(frame => Math.abs(frame.x - exposedSource.x) < 1 && Math.abs(frame.y - exposedSource.y) < 1)).toBe(true);
  await expect(meadow).toHaveAttribute("data-state", "idle");
  const foot = await meadow.evaluate(node => ({ x: Number((node as HTMLElement).dataset.x), y: Number((node as HTMLElement).dataset.y) }));
  expect(foot.x).toBeCloseTo(exposedSource.x, 0); expect(foot.y).toBeCloseTo(exposedSource.y, 0);
});

test("slow jump packets keep the resident painted through immediate departure", async ({ page }) => {
  await page.goto("/visual-fixture/poster?ambient=spring");
  // Decoder/startup contention is a separate precondition from the held jump
  // packets below. Keep the packet visibility/ink/1s/2s assertions unchanged.
  const resident = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  const room = page.getByRole("region", { name: "빅타민 집", exact: true }), launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  await expect.poll(async () => await resident.isVisible() && (await room.isVisible() || await launcher.isVisible()), { timeout: 20000 }).toBe(true);
  await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  let release!: () => void, requested = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/companion\/hd\/vitamin-action-0[3456]-/, async route => { requested++; await pending; await route.continue(); });
  try {
    await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
    await expect(meadow).toBeVisible({ timeout: 1000 });
    await expect(meadow).toHaveAttribute("data-state", "jump");
    const ink = await meadow.locator("canvas").evaluate(node => {
      const canvas = node as HTMLCanvasElement;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return data.some((value, index) => index % 4 === 3 && value > 0);
    }); expect(ink).toBe(true);
    await expect(meadow).toHaveAttribute("data-state", "idle", { timeout: 2000 });
    expect(requested).toBeGreaterThan(0);
  } finally { release(); }
  await page.keyboard.press("Escape"); await expectHomecoming(page);
});

for (const surface of ["viewer", "studio", "preview"] as const) {
  test(`${surface}: surviving food and toy hand their actual foot back to normal home drag and storage`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : `/visual-fixture/studio?role=developer&y=2026&m=3${surface === "preview" ? "&viewer=1" : ""}`);
    const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    const food = page.locator(".vc-food").last(); await expect(food).not.toHaveAttribute("data-falling");
    const foodId = await food.getAttribute("data-food"); await placeItem(page, food, { x: 90, y: 990 }); await expect(food).toHaveAttribute("data-platform", /^viewport-floor/);
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false");
    await placeItem(page, toy, { x: 170, y: 990 }); await expect(toy).toHaveAttribute("data-platform", /^viewport-floor/);
    await enterCompanionMeadow(page); await expect(page.locator(".vc-meadow-walk")).toHaveAttribute("data-state", "idle");
    // Different from the pre-entry world position, so old owner coordinates
    // cannot accidentally satisfy a first-grab continuity check.
    await placeItem(page, food, { x: 90, y: 900 }); await placeItem(page, toy, { x: 170, y: 950 });
    await page.keyboard.press("Escape"); await expectHomecoming(page);
    const take = async (item: Locator) => {
      await expect(item).toBeVisible(); await expect(item).toHaveAttribute("data-showcase-lease", "");
      const before = (await item.boundingBox())!;
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down();
      await expect(item).not.toHaveAttribute("data-showcase-lease");
      const after = (await item.boundingBox())!;
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(2);
    };
    await take(food);
    const floor = (await home.locator(".vc-home-floor").boundingBox())!;
    await page.mouse.move(floor.x + floor.width * .18, floor.y + floor.height - 20, { steps: 18 });
    await expect(food).toBeVisible(); await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2);
    await expect(food).toBeVisible(); await expect(food).toHaveAttribute("data-platform", /^companion-home-floor/);
    await take(toy);
    const box = home.locator('[data-home-action="toys"]'), target = (await box.boundingBox())!;
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 18 });
    await expect(toy).toBeVisible(); await expect(box).toHaveAttribute("data-toy-over", "");
    await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2); await expect(toy).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("survivor-home-drop.png") });
    await enterCompanionMeadow(page); await page.keyboard.press("Escape"); await expectHomecoming(page);
    await expect(page.locator(`[data-food="${foodId}"]`)).toBeVisible(); await expect(food).toHaveAttribute("data-platform", /^companion-home-floor/);
    expect(errors).toEqual([]);
  });
}

test("surviving items use their ordinary keyboard hold and move from the painted outdoor position", async ({ page }) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const food = page.locator(".vc-food").last();
  await expect(food).not.toHaveAttribute("data-falling"); await placeItem(page, food, { x: 90, y: 990 }); await expect(food).toHaveAttribute("data-platform", /^viewport-floor/);
  await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click(); const toy = page.locator(".vc-toy").last();
  await expect(toy).toHaveAttribute("data-falling", "false"); await placeItem(page, toy, { x: 170, y: 990 }); await expect(toy).toHaveAttribute("data-platform", /^viewport-floor/);
  await enterCompanionMeadow(page); await expect(page.locator(".vc-meadow-walk")).toHaveAttribute("data-state", "idle");
  await placeItem(page, food, { x: 90, y: 900 }); await placeItem(page, toy, { x: 170, y: 950 });
  await page.keyboard.press("Escape"); await expectHomecoming(page);
  const foodBefore = (await food.boundingBox())!; await food.focus(); await food.press("Enter");
  await expect(food).not.toHaveAttribute("data-showcase-lease"); await expect(food).toHaveAttribute("data-selected", "");
  expect(Math.abs((await food.boundingBox())!.y - foodBefore.y)).toBeLessThan(2);
  await food.press("ArrowRight"); expect((await food.boundingBox())!.x - foodBefore.x).toBeCloseTo(24, 0); await food.press("Enter");
  const toyBefore = (await toy.boundingBox())!; await toy.focus(); await toy.press("Enter");
  await expect(toy).not.toHaveAttribute("data-showcase-lease"); await expect(toy).toHaveAttribute("data-held", "true");
  expect(Math.abs((await toy.boundingBox())!.y - toyBefore.y)).toBeLessThan(2);
  await toy.press("ArrowRight"); expect((await toy.boundingBox())!.x - toyBefore.x).toBeCloseTo(16, 0);
  await toy.press("Escape"); await expect(toy).toHaveAttribute("data-held", "false");
});
