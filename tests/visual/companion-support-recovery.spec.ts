import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Frame = { at: number; phase: string; x: number; y: number; hidden: boolean; reason: string; state: string; support: string; same: boolean; count: number; focused: boolean; documentHidden: boolean };
type Probe = { frames: Frame[]; inputs: { type: string; trusted: boolean; key: string; x: number; y: number }[]; phase: string; stopped: boolean; raf: number; input: (event: Event) => void; sample: () => Frame };
type ProbeWindow = Window & { supportRecoveryProbe: Probe };
type Proof = { writes: string[]; errors: string[]; facts: unknown[] };
type Ray = { eventId: string; rect: Rect };
type Geometry = { scrollY: number; width: number; height: number; maxScroll: number; cards: Ray[]; text: Rect[]; surfaces: Rect[]; controls: Rect[]; floorY: number };
const proofs = new WeakMap<Page, Proof>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });

test.use({ viewport: { width: 1480, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.setTimeout(40_000);
  const proof: Proof = { writes: [], errors: [], facts: [] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (/\/api\/public\/[^/]+\/search\/trending$/.test(path)) return route.fulfill({ json: { trends: [] } });
    return route.continue();
  });
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    // Device choices and care only: no application state/callback, focus,
    // clock, random source, synthetic ledge or DOM rectangle is overridden.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const folder = `.scratch-pw/098-support-recovery/${build}`, name = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 120); mkdirSync(folder, { recursive: true });
  const live = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).supportRecoveryProbe;
    if (!probe) return null;
    probe.stopped = true; cancelAnimationFrame(probe.raf);
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.removeEventListener(type, probe.input, true);
    return { frames: probe.frames, inputs: probe.inputs, focused: document.hasFocus(), hidden: document.hidden };
  }).catch(error => ({ observationError: String(error) }));
  writeFileSync(`${folder}/${name}.json`, JSON.stringify({ build, title: info.title, status: info.status, ...proofs.get(page), live }, null, 2));
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true }).catch(() => {});
  expect(proofs.get(page)?.writes).toEqual([]); expect(proofs.get(page)?.errors).toEqual([]);
  if (live && "inputs" in live) expect(live.inputs.every(input => input.trusted), "the reproduction must use trusted native input").toBe(true);
});

async function setup(page: Page) {
  await page.goto("/visual-fixture/poster?avatar=1&signedIn=0"); await page.bringToFront(); await settle(page);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(() => {
    const original = document.querySelector<HTMLElement>(".vc-companion")!;
    const probe: Probe = { frames: [], inputs: [], phase: "setup", stopped: false, raf: 0, input: () => {}, sample: () => { throw new Error("not initialized"); } };
    probe.sample = () => {
      const node = document.querySelector<HTMLElement>(".vc-companion"), matrix = new DOMMatrixReadOnly(node?.style.transform || "none"), size = parseFloat(node?.style.getPropertyValue("--vc-size") || "92");
      return { at: performance.now(), phase: probe.phase, x: matrix.m41 + size / 2, y: matrix.m42 + size, hidden: !node || node.hidden || getComputedStyle(node).display === "none", reason: node?.dataset.hiddenReason ?? "", state: node?.dataset.state ?? "", support: node?.dataset.platform ?? "", same: node === original && original.isConnected, count: document.querySelectorAll(".vc-companion").length, focused: document.hasFocus(), documentHidden: document.hidden };
    };
    probe.input = event => { const p = event as PointerEvent; probe.inputs.push({ type: event.type, trusted: event.isTrusted, key: event instanceof KeyboardEvent ? event.key : "", x: p.clientX ?? 0, y: p.clientY ?? 0 }); };
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.addEventListener(type, probe.input, true);
    const tick = () => { if (probe.stopped) return; if (probe.frames.length < 3500) probe.frames.push(probe.sample()); probe.raf = requestAnimationFrame(tick); };
    (window as unknown as ProbeWindow).supportRecoveryProbe = probe; probe.raf = requestAnimationFrame(tick);
  });
}
async function settle(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180);
}
async function mark(page: Page, phase: string) { return page.evaluate(phase => { const probe = (window as unknown as ProbeWindow).supportRecoveryProbe; probe.phase = phase; return probe.sample(); }, phase); }
async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const root = document.querySelector(".poster-page")!;
    const rect = (node: Element | DOMRect): Rect => { const r = node instanceof Element ? node.getBoundingClientRect() : node; return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const shown = (node: Element): boolean => {
      for (let parent: Element | null = node; parent; parent = parent.parentElement) { const css = getComputedStyle(parent); if (parent.hasAttribute("hidden") || css.display === "none" || css.visibility === "hidden" || Number(css.opacity) < .05) return false; }
      const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    };
    const text: Rect[] = [], range = document.createRange(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement; if (!p || !shown(p) || p.closest("script,style,svg,.sr-only,.vc-home,.vc-companion,.vc-food-layer")) continue;
      range.selectNodeContents(n); for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) text.push(rect(r));
    }
    range.detach();
    const controls = [...root.querySelectorAll("button,a[href],input,select,textarea,[role='button']")].filter(n => shown(n) && !n.matches(".public-day,.public-event") && !n.closest(".vc-home,.vc-companion" )).map(rect);
    let floorY = innerHeight - 18;
    for (const node of root.querySelectorAll(".agenda-monthbar")) { const r = node.getBoundingClientRect(); if (getComputedStyle(node).position === "fixed" && shown(node) && r.top >= innerHeight * .65 && r.bottom <= innerHeight + 1) floorY = Math.min(floorY, r.top - 8); }
    // Measure the rendered glyph fragments, not their full-width paragraph
    // boxes: the reported x can be beside a short label inside a wide card.
    const surfaces: Rect[] = [], inkRange = document.createRange();
    for (const node of root.querySelectorAll(".public-day .day-strip > strong,.public-event .event-main p,.public-event .event-subs li")) {
      if (!shown(node)) continue;
      const ink = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let n = ink.nextNode(); n; n = ink.nextNode()) { inkRange.selectNodeContents(n); for (const r of inkRange.getClientRects()) if (r.width > 0 && r.height > 0) surfaces.push(rect(r)); }
    }
    inkRange.detach();
    for (const node of root.querySelectorAll(".weekday-row,.public-calendar-header,.support-bar[data-supportid]")) {
      if (!shown(node)) continue;
      const r = rect(node); surfaces.push(node.matches(".support-bar") ? r : { ...r, top: r.bottom });
    }
    return { scrollY, width: innerWidth, height: innerHeight, maxScroll: document.documentElement.scrollHeight - innerHeight, cards: [...root.querySelectorAll<HTMLElement>(".public-event[data-eventid]:not(.teaser):not(.teaser-revealing):not(.is-support)")].filter(shown).map(n => ({ eventId: n.dataset.eventid!, rect: rect(n) })), text, surfaces, controls, floorY };
  });
}
function clearAt(x: number, y: number, geometry: Geometry) {
  if (x < 50 || x > geometry.width - 50 || y < 100 || y > geometry.height - 12) return false;
  return [...geometry.text, ...geometry.controls].every(r => r.right <= x - 92 * .38 - 3 || r.left >= x + 92 * .38 + 3 || r.bottom <= y - 92 * .76 - 3 || r.top >= y + 3);
}
function ordinaryRay(x: number, g: Geometry) {
  return [...g.surfaces.map(r => ({ x: r.left, right: r.right, y: r.top - 3 })), { x: 50, right: g.width - 50, y: g.floorY }].filter(p => x >= p.x && x <= p.right && clearAt(x, p.y, g));
}

test("a real clipped card recovers vertically onto its next actual card top instead of disappearing", async ({ page }) => {
  await setup(page); const first = await geometry(page); proofs.get(page)!.facts.push({ phase: "initial-real-geometry", geometry: first });
  // Plan from the existing document only. Native viewport height/wheel are
  // then applied, and the physical precondition is re-proved before success.
  let plan: { eventId: string; x: number; wheel: number; height: number } | undefined;
  for (const card of first.cards) {
    if (card.rect.top < 110 || card.rect.top > 450) continue;
    for (const u of [.94, .88, .82, .75]) {
      const x = card.rect.left + card.rect.width * u, wheel = card.rect.top - 90;
      const later = first.cards.filter(c => c.rect.top > card.rect.top + 60 && c.rect.left <= x && c.rect.right >= x);
      if (!later.length || x < 50 || x > first.width - 50) continue;
      for (let height = 500; height <= 900; height += 20) {
        const shift = (r: Rect): Rect => ({ ...r, top: r.top - wheel, bottom: r.bottom - wheel });
        const predicted = { ...first, height, floorY: height - (first.height - first.floorY), text: first.text.map(shift), controls: first.controls.map(shift), surfaces: first.surfaces.map(shift) };
        if (ordinaryRay(x, predicted).length || !later.some(c => c.rect.top - wheel - 3 >= 100 && c.rect.top - wheel - 3 < height - 80)) continue;
        plan = { eventId: card.eventId, x, wheel, height }; break;
      }
      if (plan) break;
    }
    if (plan) break;
  }
  expect(plan, "PRECONDITION: unchanged fixture needs a same-column card ray with no ordinary text/floor ledge; absence is a coverage failure, not a product PASS").toBeDefined();
  await page.setViewportSize({ width: 1480, height: plan!.height }); await settle(page);
  const card = page.locator(`.public-event[data-eventid="${plan!.eventId}"]`), source = (await card.boundingBox())!;
  await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(plan!.x, source.y - 10);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const placed = await mark(page, "placed-on-real-card"); expect(Math.abs(placed.y - source.y + 3)).toBeLessThan(2);
  await mark(page, "native-scroll-recovery"); await page.mouse.move(1000, plan!.height - 100); await page.mouse.wheel(0, plan!.wheel);
  await page.waitForTimeout(180);
  const live = await geometry(page), lostCard = live.cards.find(c => c.eventId === plan!.eventId)!;
  const ray = ordinaryRay(plan!.x, live), lower = live.cards.filter(c => c.rect.left <= plan!.x && c.rect.right >= plan!.x && c.rect.top - 3 >= 100 && c.rect.top - 3 <= live.height - 12).sort((a, b) => a.rect.top - b.rect.top)[0];
  proofs.get(page)!.facts.push({ phase: "actual-precondition", plan, geometry: live, ray, lower, lostCard });
  expect(lostCard.rect.top - 3, "PRECONDITION: the original physical card top must leave the whole-body safe viewport").toBeLessThan(100);
  expect(ray, "PRECONDITION: a normal same-x text/floor ledge would bypass the reported missing-card-top case").toEqual([]);
  expect(lower, "PRECONDITION: a genuine same-x lower card top must exist").toBeDefined();
  // Old096/097 fails this physical outcome: hidden=true forever. The new
  // renderer must complete one real finite landing without a modal rescue.
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 2500 });
  const recovered = await mark(page, "recovered-without-modal");
  expect(Math.abs(recovered.x - placed.x), "recovery must never move to another column").toBeLessThan(1);
  expect(Math.abs(recovered.y - (lower.rect.top - 3)), "the first real lower card owns the contact").toBeLessThan(2);
  expect(recovered.hidden).toBe(false); expect(recovered.reason).toBe(""); expect(recovered.same).toBe(true);
  const frames = await page.evaluate(() => (window as unknown as ProbeWindow).supportRecoveryProbe.frames.filter(f => f.phase === "native-scroll-recovery"));
  expect(frames.some(f => f.state === "jump" && !f.hidden), "actual intermediate airborne frames are required, not an endpoint teleport").toBe(true);
  expect(frames.every(f => Math.abs(f.x - placed.x) < 1 && f.same && f.count === 1)).toBe(true);
  const topRecovery = frames.filter(f => f.y >= 92 * .82 + 8 && f.y < 100);
  expect(topRecovery.length, "the actual scroll must expose the transparent-cell top-edge case").toBeGreaterThan(2);
  expect(topRecovery.every(f => !f.hidden), "fully visible registered art must not blink behind its empty cell padding").toBe(true);
});

test("an intentionally folded home stays hidden across a real settings modal and restores its own resident", async ({ page }) => {
  //099 keeps disclosure only on the actual rail. The compact room now has
  // title/X and intentionally cannot be folded.
  await page.setViewportSize({ width: 1920, height: 900 });
  await setup(page);
  if (!await home(page).isVisible()) await page.locator(".vc-home-launcher").click();
  await expect(home(page)).toBeVisible(); await settle(page);
  await expect(home(page)).toHaveAttribute("data-home-presentation", "panel");
  const point = await home(page).evaluate(node => { const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom - 14 }; });
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", ""); await page.mouse.click(point.x, point.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor/);
  const sofa = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }); await sofa.focus(); await sofa.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 8000 }); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const resident = await mark(page, "actual-sofa-resident"); expect(resident.hidden).toBe(false);
  await home(page).getByRole("button", { name: "빅타민 집", exact: true }).click();
  await expect(pet(page)).toHaveJSProperty("hidden", true); await mark(page, "folded-before-modal");
  await page.getByRole("button", { name: "설정", exact: true }).click(); await expect(page.locator(".modal-card-settings")).toBeVisible();
  await mark(page, "folded-modal-open"); await page.waitForTimeout(800);
  const during = await mark(page, "folded-modal-end");
  proofs.get(page)!.facts.push({ resident, during });
  expect(during.hidden, "opening an ordinary modal must never reveal a hidden world point").toBe(true);
  const modalFrames = await page.evaluate(() => (window as unknown as ProbeWindow).supportRecoveryProbe.frames.filter(f => f.phase === "folded-modal-open"));
  expect(modalFrames.length).toBeGreaterThan(8); expect(modalFrames.every(f => f.hidden && f.same && f.count === 1)).toBe(true);
  await page.locator(".modal-card-settings .modal-close").click(); await settle(page); await expect(pet(page)).toHaveJSProperty("hidden", true);
  if (!await home(page).isVisible()) await page.locator(".vc-home-launcher").click();
  const title = home(page).getByRole("button", { name: "빅타민 집", exact: true }); await expect(title).toHaveAttribute("aria-expanded", "false"); await title.click(); await settle(page);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  const restored = await mark(page, "same-home-restored"); expect(restored.same).toBe(true); expect(restored.count).toBe(1); expect(restored.reason).toBe("");
});
