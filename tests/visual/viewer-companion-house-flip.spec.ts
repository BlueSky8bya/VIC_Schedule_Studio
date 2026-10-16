import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { PREMIERE_STAGE_KEY, SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Surface = "viewer" | "studio";
type Frame = { at: number; phase: string; bedY: number; alignment: number; bedVisible: boolean; depth: string; frontVisible: boolean; frontHidden: boolean; frontOpacity: number; localFronts: number; localFrontVisible: boolean; localFrontOpacity: number; petVisible: boolean; sameDom: boolean; support: string; presence: string; state: string; foot: number; ground: number | null; footError: number | null };
type ProbeWindow = Window & { houseFlipFocused?: boolean; houseFlipPanelAt?: number; houseFlipSearchAt?: number; houseFlip?: { node: Element; frames: Frame[]; phase: string; raf: number; timers: Set<ReturnType<typeof setTimeout>>; stopped: boolean } };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const prefix = process.env.COMPANION_HOUSE_FLIP_PREFIX ?? ".scratch-pw/companion-067-house-flip";
const attempts = new WeakMap<Page, { blocked: string[]; errors: string[]; reads: number }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false });
test.beforeEach(async ({ page }) => {
  const proof = { blocked: [] as string[], errors: [] as string[], reads: 0 }; attempts.set(page, proof);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const reads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(reads.size).toBe(1);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && reads.has(request.headers()["next-action"])) {
      proof.reads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.blocked.push(`${request.method()} ${pathname}`); return route.fulfill({ status: 500, body: "" });
    }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.route("**/api/public/*/search/trending", route => route.request().method() === "GET" ? route.fulfill({ json: { trends: [] } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(attempts.get(page)?.blocked).toEqual([]); expect(attempts.get(page)?.errors).toEqual([]); });

async function settle(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
}
async function setup(page: Page, surface: Surface, options: { lite?: boolean; reduced?: boolean; controlledFocus?: boolean } = {}) {
  await page.addInitScript(({ key, epoch, premiereKey, preferences, care, options }) => {
    for (const [k, value] of Object.entries({ [key]: epoch, [premiereKey]: "off", "vic.ambient": "off", "vic.sound": "off", "vic.reduceMotion": options.reduced ? "on" : "off", "vic.gfxPref": options.lite ? "lite" : "max", "vic_avatar_side": "left" })) localStorage.setItem(k, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    if (options.controlledFocus) {
      // Explicit focus-branch fixture, not proof of OS focus loss. Time,
      // native disclosure input and real layout/FLIP remain unmodified.
      const probe = window as ProbeWindow; probe.houseFlipFocused = true;
      Object.defineProperty(document, "hasFocus", { configurable: true, value: () => probe.houseFlipFocused });
    }
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, premiereKey: PREMIERE_STAGE_KEY,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, ambientPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 }, options });
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster?avatar=1");
  await page.bringToFront(); await settle(page);
  await expect(home(page)).toBeVisible(); await expect(actor(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  // The optional home and its HD actor mount after the initial page pass.
  // Await their real finite entrance, then observe an unchanged house across
  // the existing 120ms geometry coalescing window before issuing a command.
  await settle(page);
  let previous: { x: number; y: number; width: number; height: number } | null = null, stableSince = 0;
  await expect.poll(async () => {
    const next = await home(page).boundingBox(), now = Date.now();
    if (!next || !previous || Math.max(Math.abs(next.x - previous.x), Math.abs(next.y - previous.y), Math.abs(next.width - previous.width), Math.abs(next.height - previous.height)) > .01) stableSince = now;
    previous = next;
    return next ? now - stableSince : 0;
  }, { intervals: [40], timeout: 5000 }).toBeGreaterThanOrEqual(140);
  if (options.lite) await expect(page.locator("html")).toHaveAttribute("data-gfx", "lite");
  if (options.reduced) await expect(page.locator("html")).toHaveAttribute("data-reduce-motion");
  if (surface === "studio") {
    const order = await page.locator(".avatar-rail:visible").evaluate(rail => {
      const tools = rail.querySelector<HTMLElement>(":scope > .studio-tools-wrap")!, filter = rail.querySelector<HTMLElement>(":scope > .avatar-rail-filter")!, slot = rail.querySelector<HTMLElement>(":scope > .avatar-slot")!;
      const season = slot.querySelector<HTMLElement>("[data-panel-section='season']")!, house = slot.querySelector<HTMLElement>("[data-panel-section='companion-home']")!;
      return { children: [...rail.children].filter(node => node === tools || node === filter || node === slot).map(node => node.className),
        sections: [...slot.querySelectorAll<HTMLElement>("[data-panel-section]")].map(node => node.dataset.panelSection),
        // The tag section can scroll beyond its allotted flex budget. Its
        // actual wrapper is the neighboring card's layout boundary.
        boxes: [tools, filter, season, house].map(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }) };
    });
    await writeFile(`${prefix}-studio-order-${test.info().title.replace(/[^a-z0-9]+/gi, "-").slice(0, 72)}.json`, JSON.stringify(order, null, 2));
    expect(order.children).toEqual(["studio-tools-wrap", "avatar-rail-filter", "avatar-slot"]);
    expect(order.sections).toEqual(["season", "companion-home"]);
    for (const box of order.boxes) { expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThan(0); }
    for (let i = 1; i < order.boxes.length; i++) expect(order.boxes[i].top).toBeGreaterThanOrEqual(order.boxes[i - 1].bottom - .5);
  }
}
async function recall(page: Page) {
  const button = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await button.focus(); await button.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(page.locator(".vc-bed-foreground")).toBeVisible();
}
async function onFloor(page: Page) {
  const point = await home(page).evaluate(node => { const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom }; });
  await actor(page).focus(); await page.keyboard.press("p"); await page.mouse.click(point.x, point.y - COMPANION_HOME_FLOOR_INSET - 8);
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
}
async function outside(page: Page, surface: Surface) {
  const selector = surface === "studio" ? ".studio-event-pill[data-companion-event='ordinary'][data-eventid]" : ".public-event[data-eventid]:not(.teaser):not(.teaser-revealing)";
  const point = await page.locator(selector).evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()).filter(rect => rect.left > 500 && rect.top > 200 && rect.top < innerHeight - 180 && rect.width > 100).map(rect => ({ x: rect.left + rect.width / 2, y: rect.top - 24 }))[0] ?? null);
  expect(point, "use a real calendar card, never a fictitious floor").not.toBeNull();
  await actor(page).focus(); await page.keyboard.press("p"); await page.mouse.click(point!.x, point!.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
}
async function startProbe(page: Page) {
  await pet(page).evaluate((node, floorInset) => {
    const probe = window as ProbeWindow;
    const proof = probe.houseFlip = { node, frames: [] as Frame[], phase: "start", raf: 0, timers: new Set<ReturnType<typeof setTimeout>>(), stopped: false };
    const frame = () => {
      if (proof.stopped) return;
      const timer = setTimeout(() => {
        proof.timers.delete(timer); if (proof.stopped) return;
        const bed = document.querySelector<SVGSVGElement>(".vc-home:not([data-panel-collapsed]) .vc-plush-bed"), front = document.querySelector<HTMLElement>(".vc-bed-foreground"), current = document.querySelector<HTMLElement>(".vc-companion");
        if (!bed || !front || !current) return;
        const b = bed.getBoundingClientRect(), f = front.getBoundingClientRect(), style = getComputedStyle(front), foot = current.getBoundingClientRect().bottom;
        const localFronts = bed.querySelectorAll(".vc-bed-local-front"), localFront = localFronts[0]?.querySelector(".vc-bed-front-shape");
        const localStyle = localFront ? getComputedStyle(localFront) : undefined;
        let localFrontOpacity = 1;
        for (let element: Element | null = localFront ?? null; element; element = element.parentElement) localFrontOpacity *= Number(getComputedStyle(element).opacity);
        const support = current.dataset.platform ?? "", state = current.dataset.state ?? "";
        const seat = document.querySelector(".vc-home .vc-home-cushion"), floor = document.querySelector(".vc-home .vc-home-floor");
        const ground = support === "companion-home" && seat ? seat.getBoundingClientRect().top : /^companion-home-floor(?:-\d+)?$/.test(support) && floor ? floor.getBoundingClientRect().bottom - floorInset : null;
        proof.frames.push({ at: performance.now(), phase: proof.phase, bedY: b.top,
          alignment: Math.max(Math.abs(b.left - f.left), Math.abs(b.top - f.top), Math.abs(b.width - f.width), Math.abs(b.height - f.height)),
          bedVisible: b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight,
          depth: current.dataset.sofaDepth ?? "", frontHidden: front.hidden, frontOpacity: Number(style.opacity),
          frontVisible: !front.hidden && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0,
          localFronts: localFronts.length, localFrontVisible: Boolean(localStyle && localStyle.display !== "none" && localStyle.visibility !== "hidden" && localFrontOpacity > 0), localFrontOpacity,
          petVisible: !current.hidden, sameDom: current === proof.node, support, presence: current.dataset.presence ?? "", state, foot, ground, footError: ground === null ? null : Math.abs(foot - ground) });
      }, 0);
      proof.timers.add(timer); proof.raf = requestAnimationFrame(frame);
    };
    // Observe a task after the mounted renderer's complete rAF batch. Reading
    // before its paint would compare this frame's FLIP with last frame's clone.
    proof.raf = requestAnimationFrame(frame);
  }, COMPANION_HOME_FLOOR_INSET);
}
async function finishProbe(page: Page, label: string) {
  const proof = await page.evaluate(() => { const state = (window as ProbeWindow).houseFlip!; state.stopped = true; cancelAnimationFrame(state.raf); for (const timer of state.timers) clearTimeout(timer); return { frames: state.frames,
    condition: { gfx: document.documentElement.dataset.gfx ?? "full", reduced: document.documentElement.hasAttribute("data-reduce-motion"), controlledFocus: typeof (window as ProbeWindow).houseFlipFocused === "boolean", hasFocus: document.hasFocus() } }; });
  await writeFile(`${prefix}-${label}.json`, JSON.stringify({ ...proof, transport: attempts.get(page) }, null, 2));
  return proof.frames;
}
async function disclosures(page: Page, label: string, instant = false) {
  for (const section of ["tag-filter", "season"]) {
    const button = page.locator(`[data-panel-section-toggle='${section}']:visible`);
    await expect(button).toHaveCount(1);
    for (const expanded of [false, true]) {
      await page.evaluate(phase => { (window as ProbeWindow).houseFlip!.phase = phase; }, `${label}-${section}-${expanded ? "expand" : "fold"}`);
      await button.click(); await expect(button).toHaveAttribute("aria-expanded", String(expanded));
      await page.waitForTimeout(instant ? 240 : 1050);
    }
  }
}
function verify(proof: Frame[], requireHome = false, minPhases = 4, checkFoot = true, requireInterior = false) {
  expect(proof.length).toBeGreaterThan(8);
  expect(proof.every(frame => frame.sameDom)).toBe(true);
  const phases = [...new Set(proof.map(frame => frame.phase).filter(phase => phase !== "start"))];
  expect(phases.length).toBeGreaterThanOrEqual(minPhases);
  expect(Math.max(...proof.map(frame => frame.bedY)) - Math.min(...proof.map(frame => frame.bedY)), "native disclosures must genuinely move the house").toBeGreaterThan(20);
  const visible = proof.filter(frame => frame.petVisible && frame.bedVisible);
  expect(visible.length).toBeGreaterThan(4);
  expect(visible.every(frame => frame.localFronts === 1), "the moving room keeps one local shared front group").toBe(true);
  expect(visible.every(frame => ["clear", "front", "seat", "back"].includes(frame.depth))).toBe(true);
  const interior = visible.filter(frame => ["seat", "back"].includes(frame.depth));
  if (requireInterior) expect(interior.length, "the cushion foreground positive must include an actual interior resident").toBeGreaterThan(4);
  for (const frame of interior) {
    expect(frame.frontVisible).toBe(true); expect(frame.frontHidden).toBe(false); expect(frame.frontOpacity).toBeGreaterThan(.99);
    expect(frame.alignment, "the sole external front follows the actual moving bed").toBeLessThan(1);
    expect(frame.localFrontVisible, "the local front yields paint to the resident's foreground").toBe(false);
  }
  for (const frame of visible.filter(frame => ["clear", "front"].includes(frame.depth))) {
    expect(frame.frontHidden, "outside and floor bodies do not need a fixed sofa clone").toBe(true); expect(frame.frontVisible).toBe(false);
    expect(frame.localFrontVisible).toBe(true); expect(frame.localFrontOpacity).toBeGreaterThan(.99);
  }
  if (requireHome && checkFoot) {
    const contact = proof.filter(frame => frame.bedVisible && frame.petVisible && frame.state !== "jump" && frame.footError !== null);
    expect(contact.length).toBeGreaterThan(4);
    expect(Math.max(...contact.map(frame => frame.footError!)), "a settled resident follows the real seat/floor, not only the sofa clone").toBeLessThan(1);
  }
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} independently follows the moving sofa while the pet is outside, on the floor and in the cushion`, async ({ page }) => {
  test.setTimeout(45_000); await setup(page, surface);
  for (const state of ["outside", "floor", "cushion"] as const) {
    if (state === "outside") await outside(page, surface); else if (state === "floor") await onFloor(page); else await recall(page);
    await startProbe(page);
    let proof: Frame[] = [];
    try { await disclosures(page, state); } finally { proof = await finishProbe(page, `${surface}-${state}`); }
    await page.screenshot({ path: `${prefix}-${surface}-${state}.png` }); verify(proof, state !== "outside", 4, true, state === "cushion");
    if (state === "outside") {
      const toggle = page.locator("[data-panel-section-toggle='companion-home']:visible"), original = await pet(page).getAttribute("data-platform");
      await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
      const folded = await page.evaluate(() => ({ frontHidden: document.querySelector<HTMLElement>(".vc-bed-foreground")!.hidden, petVisible: !document.querySelector<HTMLElement>(".vc-companion")!.hidden }));
      await writeFile(`${prefix}-${surface}-home-fold.json`, JSON.stringify(folded, null, 2));
      expect(folded).toEqual({ frontHidden: true, petVisible: true });
      await expect(pet(page)).toHaveAttribute("data-platform", original!);
      await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true"); await settle(page); await page.waitForTimeout(180);
      await expect(page.locator(".vc-bed-foreground")).toBeHidden();
      await expect(home(page).locator(".vc-bed-local-front")).toHaveCount(1);
      await expect(home(page).locator(".vc-bed-local-front .vc-bed-front-shape")).toBeVisible();
      await expect(pet(page)).toHaveAttribute("data-platform", original!);
    }
  }
});

for (const mode of [{ surface: "viewer" as const, name: "lite-parked", lite: true, reduced: false }, { surface: "studio" as const, name: "reduced-parked", lite: false, reduced: true }]) test(`${mode.surface} ${mode.name} follows finite native panel changes and returns to quiet`, async ({ page }) => {
  test.setTimeout(30_000); await setup(page, mode.surface, { ...mode, controlledFocus: true }); await onFloor(page);
  await page.evaluate(() => { (window as ProbeWindow).houseFlipFocused = false; window.dispatchEvent(new FocusEvent("blur")); });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await startProbe(page); let proof: Frame[] = [];
  try { await disclosures(page, mode.name, mode.reduced); } finally { proof = await finishProbe(page, `${mode.surface}-${mode.name}`); }
  await page.screenshot({ path: `${prefix}-${mode.surface}-${mode.name}.png` }); verify(proof, true);
  expect(proof.every(frame => frame.presence === "parked")).toBe(true);
  await page.waitForTimeout(300);
  const writes = await page.evaluate(async () => {
    let writes = 0; const observer = new MutationObserver(records => { writes += records.length; });
    for (const node of document.querySelectorAll(".vc-companion,.vc-bed-foreground")) observer.observe(node, { subtree: true, attributes: true });
    await new Promise(resolve => setTimeout(resolve, 900)); observer.disconnect(); return writes;
  });
  expect(writes, "event-owned following must stop after the real FLIP").toBe(0);
});

for (const surface of ["viewer", "studio"] as const) test(`${surface} opening native search within80ms of a resident house FLIP keeps the foreground attached through quieting and close`, async ({ page }) => {
  test.setTimeout(20_000); await setup(page, surface); await recall(page);
  const section = page.locator("[data-panel-section-toggle='season']:visible"), search = page.locator("[data-act='open-search']:visible,[data-act='stool-search']:visible");
  await expect(section).toHaveCount(1); await expect(search).toHaveCount(1);
  const [toggleRect, searchRect] = await Promise.all([section.boundingBox(), search.boundingBox()]);
  expect(toggleRect).not.toBeNull(); expect(searchRect).not.toBeNull();
  // Season is below the stationary search control on both real panels.
  // Measure before FLIP, then use actual native clicks without force/waits.
  const togglePoint = { x: toggleRect!.x + toggleRect!.width / 2, y: toggleRect!.y + toggleRect!.height / 2 }, searchPoint = { x: searchRect!.x + searchRect!.width / 2, y: searchRect!.y + searchRect!.height / 2 };
  expect(await search.evaluate((node, point) => { const hit = document.elementFromPoint(point.x, point.y); return Boolean(hit && (hit === node || node.contains(hit))); }, searchPoint)).toBe(true);
  await startProbe(page);
  await section.evaluate(() => { const probe = window as ProbeWindow; probe.houseFlip!.phase = "season-fold-open-search"; window.addEventListener("vic:panel-section", () => { probe.houseFlipPanelAt = performance.now(); }, { once: true }); });
  await search.evaluate(node => { node.addEventListener("click", () => { (window as ProbeWindow).houseFlipSearchAt = performance.now(); }, { once: true }); });
  let proof: Frame[] = [];
  try {
    await page.mouse.click(togglePoint.x, togglePoint.y); await page.mouse.click(searchPoint.x, searchPoint.y);
    const timing = await page.evaluate(() => ({ panel: (window as ProbeWindow).houseFlipPanelAt, search: (window as ProbeWindow).houseFlipSearchAt }));
    await writeFile(`${prefix}-${surface}-modal-timing.json`, JSON.stringify(timing, null, 2));
    expect(timing.panel).toBeDefined(); expect(timing.search).toBeDefined(); expect(timing.search! - timing.panel!).toBeGreaterThanOrEqual(0); expect(timing.search! - timing.panel!).toBeLessThanOrEqual(80);
    const dialog = page.getByRole("dialog", { name: "검색", exact: true }); await expect(dialog).toBeVisible();
    await page.waitForTimeout(1100); await page.screenshot({ path: `${prefix}-${surface}-modal.png` });
    await page.evaluate(() => { (window as ProbeWindow).houseFlip!.phase = "search-close"; });
    await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(pet(page)).not.toHaveAttribute("data-returning"); await page.waitForTimeout(350);
  } finally { proof = await finishProbe(page, `${surface}-modal`); }
  // Modal display perches can differ from the retained logical support;
  // strict foot contact belongs to the floor/cushion world cases above.
  verify(proof, true, 1, false, true); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).toBeVisible();
});
