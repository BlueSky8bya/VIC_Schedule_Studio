import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const pet = (page: Page) => page.locator(".vc-companion");
const stage = (page: Page) => page.locator(".pm-stage");
const PUBLIC_ID = "00000000-0000-4000-8000-000000000001";
const CARD = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const blockedPosts = new WeakMap<Page, string[]>(), pageErrors = new WeakMap<Page, string[]>();
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Frame = { at: number; remaining: number; visible: boolean; x: number; y: number; width: number; height: number; state: string | null; attributes: Record<string, string>; entry: string | null; joined: number; card: Rect | null };
type Probe = { node: Element; target: number; frames: Frame[]; transitions: { name: string; value: string | null; at: number }[]; raf: number; observer: MutationObserver };
type ProbeWindow = Window & { companionPremiereProbe?: Probe };
type ViewportWindow = Window & { premiereViewportSamples?: unknown[] };

test.beforeEach(async ({ page }) => {
  const posts: string[] = [], errors: string[] = []; blockedPosts.set(page, posts); pageErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { if (route.request().method() === "POST") { posts.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); } return route.continue(); });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    const diagnostic = await page.evaluate(() => ({ innerWidth, innerHeight, scrollX, scrollY, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, scrollWidth: document.documentElement.scrollWidth,
      viewportClip: document.documentElement.getAttribute("data-pm-viewport-clip"), htmlOverflowX: getComputedStyle(document.documentElement).overflowX, htmlOverflowY: getComputedStyle(document.documentElement).overflowY, bodyOverflowX: getComputedStyle(document.body).overflowX, bodyOverflowY: getComputedStyle(document.body).overflowY,
      visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop, scale: visualViewport.scale } : null,
      pet: Object.fromEntries([...document.querySelector(".vc-companion")?.attributes ?? []].map(a => [a.name, a.value])), stage: document.querySelector(".pm-stage")?.className,
      regions: [...document.querySelectorAll<HTMLElement>("[data-pm-region-active]")].map(node => { const r = node.getBoundingClientRect(); return { name: node.className, progress: node.style.getPropertyValue("--pm-region"), opacity: getComputedStyle(node).opacity, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }),
      frames: (window as ProbeWindow).companionPremiereProbe?.frames.slice(-20), initialViewportSamples: (window as ViewportWindow).premiereViewportSamples,
    }));
    await writeFile(info.outputPath("diagnostic.json"), JSON.stringify(diagnostic, null, 2)); await page.screenshot({ path: info.outputPath("failure.png") });
  }
  expect(blockedPosts.get(page)).toEqual([]); expect(pageErrors.get(page)).toEqual([]);
});

async function preferences(page: Page, enabled = true) {
  await page.addInitScript(({ epoch, key, prefs, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs })); localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // Passive finite diagnostics: no styles, application state or clock change.
    const samples: unknown[] = []; (window as ViewportWindow).premiereViewportSamples = samples;
    const snapshot = () => {
      const clientWidth = document.documentElement.clientWidth;
      samples.push({ at: performance.now(), innerWidth, innerHeight, clientWidth, clientHeight: document.documentElement.clientHeight, scrollWidth: document.documentElement.scrollWidth, viewportClip: document.documentElement.getAttribute("data-pm-viewport-clip"), htmlOverflowX: getComputedStyle(document.documentElement).overflowX, htmlOverflowY: getComputedStyle(document.documentElement).overflowY, bodyOverflowX: getComputedStyle(document.body).overflowX, bodyOverflowY: getComputedStyle(document.body).overflowY, visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale } : null,
        overflow: [...document.querySelectorAll<HTMLElement>("[data-pm-region-active],.vc-compact-home,.poster-stage,.agenda-monthbar")].map(node => { const r = node.getBoundingClientRect(); return { name: node.className, active: node.hasAttribute("data-pm-region-active"), opacity: getComputedStyle(node).opacity, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }).filter(r => r.right > clientWidth + 1 || r.left < -1),
      });
      if (samples.length < 20) setTimeout(snapshot, 100);
    };
    document.addEventListener("DOMContentLoaded", snapshot, { once: true });
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
}

async function begin(page: Page, seconds: number, enabled = true, count = 1) {
  await preferences(page, enabled); await page.goto(`/visual-fixture/poster?avatar=1&premiere=${seconds}&count=${count}`); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(stage(page)).toHaveCount(1); if (enabled) await expect(pet(page)).toHaveCount(1);
  const target = await page.locator(CARD.split(",").map(selector => `${selector}[data-eventid='${PUBLIC_ID}'][data-teaser-at]`).join(",")).first().getAttribute("data-teaser-at");
  expect(target).toBeTruthy(); return Date.parse(target!);
}
async function showActualSource(page: Page, mobile: boolean, target: number) {
  const card = page.locator(CARD.split(",").map(selector => `${selector}[data-eventid='${PUBLIC_ID}'][data-teaser-at]`).join(",")).first();
  const visible = () => card.evaluate(node => { const r = node.getBoundingClientRect(), width = Math.min(document.documentElement.clientWidth, visualViewport?.width ?? innerWidth), height = Math.min(document.documentElement.clientHeight, visualViewport?.height ?? innerHeight); return r.width > 12 && r.height > 8 && r.left >= 0 && r.right <= width && r.top >= 25 && r.bottom <= height - 25; });
  for (let attempt = 0; attempt < 5 && !await visible(); attempt++) {
    const r = (await card.boundingBox())!, viewport = page.viewportSize()!, direction = r.y < 25 ? -1 : 1;
    if (mobile) {
      const session = await page.context().newCDPSession(page), x = viewport.width * .38, fromY = direction > 0 ? viewport.height * .78 : viewport.height * .28, toY = direction > 0 ? viewport.height * .28 : viewport.height * .78;
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x, y: fromY }] });
      for (let step = 1; step <= 12; step++) { await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x, y: fromY + (toY - fromY) * step / 12 }] }); await page.waitForTimeout(16); }
      await page.waitForTimeout(160); // A real stationary finger stops fling; keep the chosen source in view.
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await session.detach();
    } else {
      await page.mouse.move(Math.min(viewport.width - 60, Math.max(60, r.x + r.width / 2)), viewport.height * .65); await page.mouse.wheel(0, direction * Math.min(460, Math.abs(r.y - viewport.height * .5)));
    }
    await page.waitForTimeout(100);
  }
  expect(await visible(), "the actual June18 placeholder must be fully visible before its dive").toBe(true);
  const proof = await card.evaluate((node, target) => { const r = node.getBoundingClientRect(), hit = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find(el => !el.closest(".vc-companion,.vc-food-layer")); return { remaining: target - Date.now(), scrollY, innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, scrollWidth: document.documentElement.scrollWidth, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom, nativeHit: Boolean(hit && node.contains(hit)) }; }, target);
  expect(proof.remaining).toBeGreaterThan(73_000); expect(proof.nativeHit).toBe(true); console.log(JSON.stringify({ check: "premiere-visible-native-source", mobile, ...proof }));
}
async function startProbe(page: Page, target: number) {
  await pet(page).evaluate((node, { target, publicId }) => {
    const began = performance.now(), p: Probe = { node, target, frames: [], transitions: [], raf: 0, observer: new MutationObserver(records => {
      records.filter(record => record.type === "attributes" && /^data-.*premiere/.test(record.attributeName ?? "")).forEach(record => p.transitions.push({ name: record.attributeName!, value: node.getAttribute(record.attributeName!), at: performance.now() - began }));
    }) };
    p.observer.observe(node, { attributes: true });
    const sample = () => {
      const sourceId = node.getAttribute("data-premiere-source") ?? publicId;
      const r = node.getBoundingClientRect(), css = getComputedStyle(node), card = [...document.querySelectorAll<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]")].find(el => el.dataset.eventid === sourceId)?.getBoundingClientRect();
      p.frames.push({ at: performance.now() - began, remaining: target - Date.now(), visible: !(node as HTMLElement).hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity) > .01, x: r.left + r.width / 2, y: r.bottom, width: r.width, height: r.height, state: node.getAttribute("data-state"),
        attributes: Object.fromEntries(node.getAttributeNames().filter(name => /^data-.*premiere/.test(name)).map(name => [name, node.getAttribute(name)!])), entry: document.querySelector(".pm-stage")?.getAttribute("data-pm-entry") ?? null, joined: document.querySelectorAll(".pm-fan[data-companion-joined]").length,
        card: card ? { left: card.left, top: card.top, right: card.right, bottom: card.bottom, width: card.width, height: card.height } : null });
      p.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).companionPremiereProbe = p; p.raf = requestAnimationFrame(sample);
  }, { target, publicId: PUBLIC_ID });
}
async function finishProbe(page: Page, label: string) {
  const result = await page.evaluate(() => { const p = (window as ProbeWindow).companionPremiereProbe!; cancelAnimationFrame(p.raf); p.observer.disconnect(); return { sameDom: p.node === document.querySelector(".vc-companion"), realClock: true, frames: p.frames, transitions: p.transitions }; });
  await writeFile(`.scratch-pw/companion-062-${label}.json`, JSON.stringify(result, null, 2)); expect(result.sameDom).toBe(true); expect(result.frames.length).toBeGreaterThan(20); return result;
}
async function layout(page: Page, mobile: boolean) {
  if (!mobile) expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const ended = await page.evaluate(() => ({ at: performance.now(), clipped: document.documentElement.hasAttribute("data-pm-viewport-clip") }));
  await expect(page.locator("html")).not.toHaveAttribute("data-pm-viewport-clip", { timeout: 3000 });
  const normal = await page.evaluate(() => ({ at: performance.now(), innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight, scrollWidth: document.documentElement.scrollWidth }));
  expect(normal.innerWidth).toBe(page.viewportSize()!.width); expect(normal.innerHeight).toBe(page.viewportSize()!.height); expect(normal.clientWidth).toBe(normal.innerWidth); expect(normal.scrollWidth).toBeLessThanOrEqual(normal.innerWidth);
  console.log(JSON.stringify({ check: "premiere-clip-tail-restored", ended, normal, leaseTailMs: normal.at - ended.at }));
}

for (const mobile of [false, true]) test.describe(mobile ? "native compact premiere" : "pointer panel premiere", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });

  test("one companion enters the actual placeholder before gather and bounces from its released card only after the calendar action", async ({ page }) => {
    test.setTimeout(35_000); let release = false;
    // The only synthetic change is the existing public fixture endpoint's
    // response. Wall/performance/animation clocks and native input stay real.
    await page.route("**/api/visual-fixture/premiere**", async route => {
      const response = await route.fetch(), data = await response.json();
      if (release) for (const item of data.entries) { item.state = "released"; item.event = { ...item.event, publicTitle: "합성 공개 후 동행 귀환", teaser: undefined, teaserRevealAt: undefined }; }
      await route.fulfill({ response, json: data });
    });
    const target = await begin(page, 80, true, mobile ? 1 : 2); await showActualSource(page, mobile, target); await startProbe(page, target);
    const preludeCare = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
    await expect(pet(page)).toHaveAttribute("data-premiere-companion", "enter", { timeout: 8000 }); await expect(pet(page)).toHaveAttribute("data-premiere-source", /^00000000-0000-4000-8000-00000000000[12]$/);
    //062 keeps ordinary life active through the prelude. Only actual card
    // entry hands the creature to the performance and pauses its needs.
    const careBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
    const enteredId = (await pet(page).getAttribute("data-premiere-source"))!;
    await expect(pet(page)).toBeVisible(); await page.screenshot({ path: `.scratch-pw/companion-062-entry-${mobile ? "390" : "1920"}.png` });
    await expect(pet(page)).toHaveAttribute("data-premiere-companion", "joined", { timeout: 5500 });
    await expect(stage(page)).toHaveAttribute("data-pm-entry", "gather", { timeout: 2500 }); await expect(page.locator(".pm-fan[data-companion-joined]")).toHaveCount(1);
    await expect(pet(page)).toBeHidden(); await expect(pet(page)).toHaveCount(1); await expect(page.getByRole("timer")).toHaveCount(1);
    await page.screenshot({ path: `.scratch-pw/companion-062-joined-${mobile ? "390" : "1920"}.png` });
    release = true; await expect(page.locator(".pm-complete")).toBeVisible({ timeout: 5000 });
    const exit = page.getByRole("button", { name: "일정표 보기", exact: true }); if (mobile) await exit.tap(); else await exit.click();
    await expect(pet(page)).toHaveAttribute("data-premiere-companion", "return", { timeout: 5000 }); await expect(pet(page)).toHaveAttribute("data-premiere-source", enteredId);
    await expect(pet(page)).toBeVisible(); await page.screenshot({ path: `.scratch-pw/companion-062-return-${mobile ? "390" : "1920"}.png` });
    await expect(pet(page)).not.toHaveAttribute("data-premiere-companion", /enter|joined|return/, { timeout: 3500 }); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /\S+/);
    await expect(page.locator(".poster-page")).not.toHaveAttribute("inert"); await expect(page.locator("[data-companion-premiere-owner]")).toHaveCount(0);
    const result = await finishProbe(page, mobile ? "handoff-390" : "handoff-1920");
    const entering = result.frames.filter(f => f.attributes["data-premiere-companion"] === "enter"), joined = result.frames.filter(f => f.attributes["data-premiere-companion"] === "joined"), gathered = result.frames.find(f => f.entry === "gather");
    expect(entering.length).toBeGreaterThan(10); expect(entering[0].remaining).toBeLessThanOrEqual(73_500); expect(entering.at(-1)!.remaining).toBeGreaterThanOrEqual(68_500);
    expect(joined.length).toBeGreaterThan(0); expect(gathered).toBeDefined(); expect(joined[0].at).toBeLessThan(gathered!.at);
    const flown = entering.filter(f => f.visible); expect(flown.length).toBeGreaterThan(5); expect(Math.max(...flown.map(f => f.width)) - Math.min(...flown.map(f => f.width))).toBeGreaterThan(20);
    const returning = result.frames.filter(f => f.attributes["data-premiere-companion"] === "return" && f.visible); expect(returning.length).toBeGreaterThan(8);
    const first = returning[0]; expect(first.card).not.toBeNull(); expect(first.x).toBeGreaterThanOrEqual(first.card!.left - 12); expect(first.x).toBeLessThanOrEqual(first.card!.right + 12); expect(first.y).toBeGreaterThanOrEqual(first.card!.top - 12); expect(first.y).toBeLessThanOrEqual(first.card!.bottom + 12);
    expect(Math.min(...returning.map(f => f.width))).toBeLessThan(60); expect(Math.max(...returning.map(f => f.width))).toBeGreaterThan(90);
    const returnEdges = result.frames.filter((f, i, all) => f.attributes["data-premiere-companion"] === "return" && all[i - 1]?.attributes["data-premiere-companion"] !== "return"); expect(returnEdges).toHaveLength(1);
    const careAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
    // Ordinary active time resumes once the800ms bounce ends. Its documented
    // affection decay is1/2400 per second; permit at most2.4s of that ordinary
    // tail while rejecting an increase, reset or the whole performance aging.
    const affectionDelta = careAfter.affection - careBefore.affection;
    expect(affectionDelta).toBeGreaterThanOrEqual(-.001); expect(affectionDelta).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(careAfter.hunger - careBefore.hunger)).toBeLessThan(.01); expect(Math.abs(careAfter.energy - careBefore.energy)).toBeLessThan(.01);
    console.log(JSON.stringify({ check: "premiere-preserved-care", mobile, affectionDelta, ordinaryEquivalentMs: -affectionDelta * 2_400_000, lastReturnAt: returning.at(-1)!.at, lastObservedAt: result.frames.at(-1)!.at, preludeCare, careBefore, careAfter }));
    await layout(page, mobile); console.log(JSON.stringify({ check: "premiere-handoff-real-clock", mobile, enteredId, firstEnter: entering[0], firstJoin: joined[0], firstGather: gathered, firstReturn: first, returnFrames: returning.length, returnEdges: returnEdges.length, careBefore, careAfter }));
  });

  test("the real house control withdraws with group5 and returns without changing its saved choices", async ({ page }) => {
    test.setTimeout(35_000); await begin(page, 167);
    const home = page.locator(mobile ? ".vc-compact-home" : ".vc-home"); await expect(home).toHaveCount(1); await expect(home).toBeVisible(); await expect(home).toHaveAttribute("data-pm-exit", "5");
    const before = await home.evaluate(node => { (window as Window & { premiereHome?: Element }).premiereHome = node; return { pref: localStorage.getItem("vic.viewerCompanion"), exit: node.getAttribute("data-pm-exit") }; });
    const values: { progress: number; opacity: number; transform: string }[] = [];
    for (let step = 0; step < 70; step++) {
      values.push(await home.evaluate(node => ({ progress: Number((node as HTMLElement).style.getPropertyValue("--pm-region")), opacity: Number(getComputedStyle(node).opacity), transform: getComputedStyle(node).transform })));
      if (values.at(-1)!.progress > .99 && values.at(-1)!.opacity < .02) break;
      await page.waitForTimeout(250);
    }
    expect(values.some(value => value.progress > .1 && value.progress < .9)).toBe(true); expect(values.at(-1)!.progress).toBeGreaterThan(.99); expect(values.at(-1)!.opacity).toBeLessThan(.02);
    await expect(home).toHaveAttribute("inert"); await expect(home).toHaveAttribute("aria-hidden", "true");
    expect(await home.evaluate(node => node === (window as Window & { premiereHome?: Element }).premiereHome)).toBe(true);
    await page.screenshot({ path: `.scratch-pw/companion-062-house-departed-${mobile ? "390" : "1920"}.png` });
    await page.keyboard.press("Escape"); await expect(stage(page)).not.toBeVisible();
    await expect(home).toHaveAttribute("data-pm-exit", before.exit!); await expect(home).toBeVisible(); await expect(home).not.toHaveAttribute("inert"); await expect(home).not.toHaveAttribute("aria-hidden", "true");
    expect(await home.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(before.pref);
    expect(await home.evaluate(node => (node as HTMLElement).style.getPropertyValue("--pm-region"))).toBe("");
    expect(await home.evaluate(node => node === (window as Window & { premiereHome?: Element }).premiereHome)).toBe(true);
    await layout(page, mobile); console.log(JSON.stringify({ check: "premiere-house-shared-exit", mobile, samples: values }));
  });
});

test("companion OFF keeps the ordinary six spectators and requests no companion sprites", async ({ page }) => {
  test.setTimeout(18_000); await page.setViewportSize({ width: 1920, height: 1100 }); const assets: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/companion/")) assets.push(request.url()); });
  await begin(page, 75, false); await expect(page.locator(".pm-focused")).toBeVisible({ timeout: 12_000 }); await expect(page.locator(".pm-fan:visible")).toHaveCount(6);
  await expect(pet(page)).toHaveCount(0); await expect(page.locator(".pm-fan[data-companion-joined]")).toHaveCount(0); expect(assets).toEqual([]);
  await page.keyboard.press("Escape"); await expect(pet(page)).toHaveCount(0); await layout(page, false);
});

test("a real deadline change during the dive cancels that source and Escape cannot request a released-card return", async ({ page }) => {
  test.setTimeout(25_000); await page.setViewportSize({ width: 1920, height: 1100 }); let targetOverride = 0;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), data = await response.json();
    if (targetOverride) for (const item of data.entries) { item.revealAt = new Date(targetOverride).toISOString(); item.event.teaserRevealAt = item.revealAt; }
    await route.fulfill({ response, json: data });
  });
  const target = await begin(page, 80); await showActualSource(page, false, target); await startProbe(page, target);
  await expect(pet(page)).toHaveAttribute("data-premiere-companion", "enter", { timeout: 8000 }); await page.waitForTimeout(500);
  targetOverride = Date.now() + 160_000;
  await expect(stage(page)).toHaveClass(/pm-phase-prelude/, { timeout: 3000 }); await expect(pet(page)).not.toHaveAttribute("data-premiere-companion", /enter|joined|return/);
  await page.keyboard.press("Escape"); await expect(page.locator(".poster-page")).not.toHaveAttribute("inert"); await expect(pet(page)).toBeVisible();
  await expect(page.locator("[data-companion-premiere-owner]")).toHaveCount(0); await page.waitForTimeout(1000);
  const result = await finishProbe(page, "deadline-cancel"); expect(result.frames.some(frame => frame.attributes["data-premiere-companion"] === "return")).toBe(false); await layout(page, false);
});
