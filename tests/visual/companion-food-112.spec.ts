import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { CAL_ZOOM_STEPS } from "@/lib/ui/calendar-zoom";
import { COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

type Surface = "viewer" | "studio";
type ReceiptWindow = Window & { food112Receipt?: { observer: MutationObserver; steps: Array<{ state: string; curiosity: string; at: number }> } };
type RenderProbeWindow = Window & { food112RenderProbe?: { frames: unknown[]; mutations: unknown[]; done: boolean; stop: () => void } };
const output = process.env.VIC_FOOD112_OUTPUT ?? ".scratch-pw/companion-112/food/native";
const renderProbe = process.env.VIC_FOOD112_PROBE === "1";
const food = (page: Page) => page.locator(".vc-food");
const point = (item: Locator) => item.evaluate(node => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: m.m41, y: m.m42, hidden: (node as HTMLElement).hidden }; });
const proofs = new WeakMap<Page, { build: string; writes: string[]; errors: string[]; samples: unknown[] }>();
test.use({ headless: true, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.setTimeout(45000);
test.beforeEach(async ({ page }) => {
  const proof = { build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), writes: [] as string[], errors: [] as string[], samples: [] as unknown[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!; mkdirSync(output, { recursive: true }); const label = info.title.replace(/[^a-z0-9]+/gi, "-");
  proof.samples.push({ exitCompanion: await page.locator(".vc-companion").evaluateAll(nodes => nodes.map(node => { const el = node as HTMLElement, r = el.getBoundingClientRect(); return { attributes: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, viewport: { width: innerWidth, height: innerHeight }, focused: document.hasFocus(), hidden: document.hidden }; })) });
  const steps = await page.evaluate(() => { const receipt = (window as ReceiptWindow).food112Receipt; receipt?.observer.disconnect(); return receipt?.steps ?? []; }); if (steps.length) proof.samples.push({ curiosity: steps });
  if (renderProbe) { const captured = await page.evaluate(() => { const probe = (window as RenderProbeWindow).food112RenderProbe; probe?.stop(); return probe && { frames: probe.frames, mutations: probe.mutations, done: probe.done }; }); if (captured) writeFileSync(`${output}/${label}-render-probe.json`, JSON.stringify(captured, null, 2)); }
  writeFileSync(`${output}/${label}.json`, JSON.stringify({ ...proof, url: page.url(), status: info.status, afterBuild: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim() }, null, 2));
  await page.screenshot({ path: `${output}/${label}.png` }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.errors).toEqual([]);
});
async function snapshot(page: Page) {
  const shot = await page.evaluate(() => {
    const floorBars = [...document.querySelectorAll<HTMLElement>(".agenda-monthbar")].filter(node => getComputedStyle(node).position === "fixed").map(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
    const floorY = Math.min(innerHeight - 18, ...floorBars.filter(r => r.top >= innerHeight * .65 && r.bottom <= innerHeight + 1).map(r => r.top - 8));
    const bands = [...document.querySelectorAll<HTMLElement>(".support-bar[data-supportid],.agenda-event[data-supportid],[data-companion-band='public']")].map(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, attributes: [...node.attributes].map(a => [a.name, a.value]) }; });
    const snacks = [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => { const m = new DOMMatrixReadOnly(node.style.transform); return { x: m.m41, y: m.m42, hidden: node.hidden, falling: node.hasAttribute("data-falling") }; });
    return { width: innerWidth, height: innerHeight, scroll: scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight, floorY, bands, snacks, focused: document.hasFocus(), hidden: document.hidden };
  }); proofs.get(page)!.samples.push(shot); return shot;
}
async function setup(page: Page, surface: Surface, { hungry = false, spawn = true } = {}) {
  await page.addInitScript(({ key, epoch, prefs, care, hungry, collectionKey }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    localStorage.removeItem(collectionKey);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: hungry, jump: hungry, sleep: false, feeding: true, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, energy: 1, hunger: hungry ? .55 : .05 }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, hungry, collectionKey: COMPANION_COLLECTION_KEY });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?links=1" : "/visual-fixture/studio?role=owner&companionDrag=1"); await page.bringToFront(); await settlePanelLayout(page);
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3117"); await expect(page.locator(".vc-companion")).toBeVisible(); await openCompanionHome(page);
  const calendar = page.locator(surface === "viewer" ? ".public-calendar-area" : ".studio-calendar-panel").first();
  // Actual existing zoom gesture exposes scrolling; no spacer, pose/RNG patch
  // or fake geometry is inserted into the document.
  const box = (await calendar.boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + 12); await page.keyboard.down("Control");
  try { for (let step = 1; step < CAL_ZOOM_STEPS.length; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(250); } } finally { await page.keyboard.up("Control"); }
  await page.setViewportSize({ width: 1920, height: 700 }); await settlePanelLayout(page);
  if (spawn) { await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(food(page)).toBeVisible(); }
  const measured = await snapshot(page); expect(measured.maxScroll).toBeGreaterThan(200); expect(measured.focused && !measured.hidden).toBe(true);
}
async function drag(page: Page, x: number, y: number) {
  const item = food(page), rect = (await item.boundingBox())!, at = await point(item), grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(x + grip.x - at.x, y + grip.y - at.y, { steps: 14 }); await page.mouse.up(); await page.mouse.move(1880, 50);
  await expect(item).not.toHaveAttribute("data-falling");
}
async function startReceiptRenderProbe(page: Page) {
  await page.evaluate(() => {
    const frames: unknown[] = [], prelude: unknown[] = [], mutations: unknown[] = [], nodes = new WeakMap<Node, number>();
    let sequence = 0, request = 0, last = -Infinity, firstTaste = -1, meal = false, stopped = false;
    const started = performance.now(), identity = (node: Node | null) => { if (!node) return null; if (!nodes.has(node)) nodes.set(node, ++sequence); return nodes.get(node)!; };
    const describe = (node: Element | null) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node), el = node as HTMLElement, texture = node instanceof HTMLImageElement ? node : null;
      return { id: identity(node), parent: identity(node.parentNode), connected: node.isConnected, className: node.getAttribute("class"), hidden: el.hidden, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, style: el.getAttribute("style"), css: { display: css.display, visibility: css.visibility, opacity: css.opacity, transform: css.transform, clipPath: css.clipPath, width: css.width, height: css.height, overflow: css.overflow, filter: css.filter }, ...(texture ? { src: texture.currentSrc || texture.src, complete: texture.complete, naturalWidth: texture.naturalWidth, naturalHeight: texture.naturalHeight } : {}) };
    };
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (!target?.closest(".vc-companion,.vc-first-taste") && ![...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches(".vc-companion,.vc-first-taste") || node.querySelector(".vc-companion,.vc-first-taste")))) continue;
        mutations.push({ at: performance.now() - started, target: identity(record.target), added: [...record.addedNodes].map(node => ({ id: identity(node), type: node.nodeName, className: node instanceof Element ? node.getAttribute("class") : null })), removed: [...record.removedNodes].map(node => ({ id: identity(node), type: node.nodeName, className: node instanceof Element ? node.getAttribute("class") : null })) });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const probe = { frames, mutations, done: false, stop: () => { stopped = true; cancelAnimationFrame(request); observer.disconnect(); } };
    (window as RenderProbeWindow).food112RenderProbe = probe;
    const tick = (now: number) => {
      if (stopped) return;
      if (now - last >= 1000 / 30) {
        last = now; const body = document.querySelector<HTMLElement>(".vc-companion"), stamp = document.querySelector(".vc-first-taste");
        if (stamp && firstTaste < 0) firstTaste = now;
        const captured = { at: now - started, sinceFirstTaste: firstTaste < 0 ? null : now - firstTaste, state: body?.dataset.state, pose: body?.dataset.pose, atlas: body?.dataset.atlas, facing: body?.dataset.facing, row: body?.style.getPropertyValue("--vc-row"), focused: document.hasFocus(), hidden: document.hidden, layers: Object.fromEntries([".vc-companion", ".vc-actor", ".vc-inertia", ".vc-facing", ".vc-reaction", ".vc-contact", ".vc-pose", ".vc-sprite", ".vc-texture", ".vc-first-taste"].map(selector => [selector, describe(document.querySelector(selector))])) };
        if (body?.dataset.state === "eat" && !meal) { meal = true; frames.push(...prelude); prelude.length = 0; }
        if (meal || firstTaste >= 0) frames.push(captured); else { prelude.push(captured); if (prelude.length > 90) prelude.shift(); }
        if (firstTaste >= 0 && now - firstTaste >= 3000) { probe.done = true; probe.stop(); return; }
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
  });
}
for (const surface of ["viewer", "studio"] as const) test(`${surface} floor food stays on the actual viewport floor through scroll`, async ({ page }) => {
  await setup(page, surface); const measured = await snapshot(page);
  const release = await page.evaluate(floorY => {
    const cards = [...document.querySelectorAll(".public-event[data-eventid],.agenda-event[data-eventid],[data-companion-event='ordinary'],.support-bar[data-supportid]")].map(node => node.getBoundingClientRect());
    const y = floorY - 5;
    for (const x of [1750, 1550, 1350, 1150, 750, 550]) if (cards.every(r => x < r.left || x > r.right || r.top - 3 < y || r.top - 3 > floorY)) return { x, y };
    return null;
  }, measured.floorY);
  expect(release).not.toBeNull(); await drag(page, release!.x, release!.y); const before = await snapshot(page); expect(before.snacks[0].y).toBeCloseTo(before.floorY, 1);
  await page.screenshot({ path: `${output}/${surface}-floor-before-scroll.png` });
  await page.mouse.wheel(0, 360); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.scroll + 100); await settlePanelLayout(page);
  const after = await snapshot(page); await expect(food(page)).toBeVisible(); expect(after.snacks[0].y).toBeCloseTo(after.floorY, 1);
  await page.mouse.wheel(0, -360); await settlePanelLayout(page); const back = await snapshot(page); expect(back.snacks[0].y).toBeCloseTo(back.floorY, 1);
});
for (const surface of ["viewer", "studio"] as const) test(`${surface} actual first meal yields a finite stamp and selects the matching recent discovered snack without reload`, async ({ page }) => {
  test.setTimeout(110000);
  await setup(page, surface, { hungry: true, spawn: false }); const floor = await snapshot(page), actor = page.locator(".vc-actor"), pet = page.locator(".vc-companion");
  await expect(actor).toBeVisible(); await actor.focus(); await expect(actor).toBeFocused(); await actor.press("p"); await expect(pet).toHaveAttribute("data-placing", ""); await page.mouse.click(740, floor.floorY); await page.mouse.move(1880, 50);
  await expect(pet).not.toHaveAttribute("data-state", "jump"); await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(food(page)).toBeVisible(); const kind = await food(page).getAttribute("data-kind") as CompanionFoodKind;
  expect(COMPANION_FOOD_KINDS).toContain(kind); await expect(page.locator(".vc-first-taste")).toHaveCount(0);
  await drag(page, 1100, floor.floorY - 5);
  await pet.evaluate(node => {
    const el = node as HTMLElement, steps: Array<{ state: string; curiosity: string; at: number }> = [], began = performance.now();
    const sample = () => { const state = el.dataset.state ?? "", curiosity = el.dataset.foodCuriosity ?? ""; if (steps.at(-1)?.state !== state || steps.at(-1)?.curiosity !== curiosity) steps.push({ state, curiosity, at: performance.now() - began }); };
    const observer = new MutationObserver(sample); observer.observe(el, { attributes: true, attributeFilter: ["data-state", "data-food-curiosity"] }); sample(); (window as ReceiptWindow).food112Receipt = { observer, steps };
  });
  if (renderProbe) await startReceiptRenderProbe(page);
  await actor.focus(); await actor.press("Space"); await page.mouse.move(1880, 50);
  await expect(food(page)).toHaveCount(0, { timeout: 85000 });
  const stamp = page.locator(".vc-first-taste"); await expect(stamp).toBeVisible(); await expect(stamp.locator('[data-collection-art="food-stamp"]')).toHaveAttribute("data-collection-art-id", kind);
  // An element screenshot waits for a stable box and could outlive this
  // intentionally moving1500ms receipt. Capture the actual page frame.
  await page.screenshot({ path: `${output}/${surface}-actual-first-taste.png` }); await expect(stamp).toHaveCount(0, { timeout: 3000 });
  if (renderProbe) {
    await page.waitForFunction(() => (window as RenderProbeWindow).food112RenderProbe?.done, undefined, { timeout: 5000 });
    await page.screenshot({ path: `${output}/${surface}-actual-after-consume-3s.png` });
    const missing = await page.evaluate(() => {
      const probe = (window as RenderProbeWindow).food112RenderProbe;
      return (probe?.frames as Array<{ at: number; state?: string; pose?: string; layers: Record<string, { hidden: boolean; connected: boolean; naturalWidth?: number; css: { display: string; opacity: string; visibility: string } } | null> }> ?? []).filter(frame => {
        const body = frame.layers[".vc-companion"], texture = frame.layers[".vc-texture"];
        return frame.pose && body?.connected && !body.hidden && body.css.display !== "none" && body.css.visibility === "visible" && Number(body.css.opacity) > .05 && (!texture?.connected || !texture.naturalWidth);
      }).map(frame => ({ at: frame.at, state: frame.state, pose: frame.pose }));
    });
    expect(missing, "the actual visible body must retain its decoded texture before, during and after first consume").toEqual([]);
  }
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).foods, COMPANION_COLLECTION_KEY)).toContain(kind);
  let settings = page.getByRole("button", { name: "설정", exact: true });
  if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  settings = page.getByRole("button", { name: "설정", exact: true }); await settings.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "도감", exact: true }).click();
  const grid = dialog.locator(".rhh-food-grid"), recent = grid.locator("[data-recent][data-found]");
  await expect(recent).toHaveCount(1); await expect(recent).toHaveAttribute("data-food-index", String(COMPANION_FOOD_KINDS.indexOf(kind))); await expect(recent).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator(".rhh-food-detail[data-recent] strong")).toHaveText(COMPANION_FOOD_NAMES[kind]);
  await expect(recent.locator('[data-collection-art="food-stamp"]')).toHaveAttribute("data-collection-art-id", kind);
  proofs.get(page)!.samples.push({ actualConsumedKind: kind, index: COMPANION_FOOD_KINDS.indexOf(kind), reload: false, nativeRngUnchanged: true });
});
for (const [surface, kind] of [["viewer", "period"], ["studio", "period"], ["studio", "up"]] as const) test(`${surface} ${kind} band catches the first food ray and retains its source on scroll`, async ({ page }) => {
  await setup(page, surface);
  const band = page.locator(surface === "viewer" ? ".support-bar.sb-period[data-supportid]" : kind === "period" ? "[data-companion-band='public'].sb-period" : "[data-companion-band='public']:not(.sb-period)").first();
  await expect(band).toBeVisible(); const box = (await band.boundingBox())!;
  expect(box.y).toBeGreaterThan(100); expect(box.y).toBeLessThan(620);
  await drag(page, box.x + box.width / 2, box.y - 8); const before = await snapshot(page);
  expect(before.snacks[0].y).toBeCloseTo(box.y - 3, 1);
  await page.mouse.wheel(0, 120); await settlePanelLayout(page); const after = await snapshot(page), moved = (await band.boundingBox())!;
  expect(after.scroll).toBeGreaterThan(before.scroll + 50); expect(after.snacks[0].y).toBeCloseTo(moved.y - 3, 1);
  expect(after.snacks[0].x).toBeCloseTo(before.snacks[0].x + moved.x - box.x, 1);
});
