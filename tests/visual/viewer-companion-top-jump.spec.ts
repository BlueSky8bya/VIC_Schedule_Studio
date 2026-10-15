import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import registration from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import { openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const posts = new WeakMap<Page, string[]>();
type Frame = { at: number; x: number; y: number; width: number; top: number; left: number; right: number; bottom: number; hidden: boolean; row: number; state: string; journey: string; platform: string };
type Probe = { frames: Frame[]; journey: string; start: Frame | null; end: Frame | null; hiddenMutation: boolean; done: boolean; raf: number; observer: MutationObserver };
type ProbeWindow = Window & { topJumpProbe?: Probe };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, roaming: boolean, offeredFood = false) {
  await page.addInitScript(({ preferences, care }) => {
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // The real brain still chooses and proves its route. Seed randomness for
    // repeatable decisions, never a clock, world geometry or action/debug port.
    Math.random = () => .8;
  }, { preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: roaming, jump: roaming, sleep: !roaming, feeding: offeredFood, heartPrank: false, ambientPrank: false, speed: "lively" }, care: { ...DEFAULT_COMPANION_CARE, hunger: offeredFood ? .8 : .05, energy: .95, curiosity: .9 } });
  await page.goto("/visual-fixture/poster"); await page.bringToFront();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180); // Existing event-coalesced full geometry.
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
}

async function topCard(page: Page) {
  return page.locator(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]").evaluateAll(nodes => {
    const cards = nodes.map((node, index) => ({ r: node.getBoundingClientRect(), index }))
      .filter(({ r }) => r.width > 80 && r.height > 0 && r.top - 3 > 116 && r.top - 3 < 235)
      .sort((a, b) => a.r.top - b.r.top);
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")]
      .filter(node => !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") && !node.closest(".vc-companion,.vc-cushion-button"))
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    for (const card of cards) for (const offset of [.5, .86, .14]) {
      const x = card.r.left + card.r.width * offset, y = card.r.top - 3;
      if (x < 51 || x > innerWidth - 51) continue;
      const body = { left: x - 92 * .38 - 3, right: x + 92 * .38 + 3, top: y - 92 * .76 - 3, bottom: y + 3 };
      if (controls.some(r => r.left < body.right && r.right > body.left && r.top < body.bottom && r.bottom > body.top)) continue;
      // The ray must hit this physical card first. No supplied platform list,
      // invented ledge, global style override or content move is involved.
      const earlier = cards.some(other => other.index !== card.index && x >= other.r.left && x <= other.r.right && other.r.top < card.r.top && other.r.top >= y - 21);
      if (!earlier) return { index: card.index, x, y, releaseY: y - 20 };
    }
    return null;
  });
}

async function placeOnCard(page: Page, mobile: boolean) {
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  let card = await topCard(page);
  if (!card && mobile) {
    // Agenda's first card sits at103px, directly under the month header; the
    // next actual card is at318px. Bring that real source into the upper test
    // band through a native wheel scroll, preserving every control and glyph.
    const lower = await page.locator(".agenda-event[data-eventid],.agenda-item[data-eventid]").evaluateAll(nodes => nodes
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 80 && r.height > 0 && r.top > 238 && r.top < innerHeight - 100)
      .sort((a, b) => a.top - b.top)[0]?.top);
    expect(lower, "an actual agenda card must exist below the upper band").toBeDefined();
    await page.mouse.wheel(0, lower! - 190);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await page.waitForTimeout(180); // The same existing120ms geometry coalescing.
    card = await topCard(page);
  }
  expect(card, "a real upper card must have a clear92px receiving point").not.toBeNull();
  if (mobile) await page.touchscreen.tap(card!.x, card!.releaseY); else await page.mouse.click(card!.x, card!.releaseY);
  return card!;
}

async function startProbe(page: Page, ballistic: boolean) {
  await pet(page).evaluate((element, { ballistic, rows }) => {
    const win = window as ProbeWindow;
    if (win.topJumpProbe) { cancelAnimationFrame(win.topJumpProbe.raf); win.topJumpProbe.observer.disconnect(); }
    const probe: Probe = { frames: [], journey: "", start: null, end: null, hiddenMutation: false, done: false, raf: 0, observer: new MutationObserver(records => {
      if (records.some(record => record.attributeName === "hidden")) probe.hiddenMutation = true;
    }) };
    probe.observer.observe(element, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true });
    const began = performance.now();
    const record = (now: number) => {
      const box = element.getBoundingClientRect(), node = element as HTMLElement;
      const frame: Frame = { at: now - began, x: box.left + box.width / 2, y: box.bottom, width: box.width, top: box.top, left: box.left, right: box.right, bottom: box.bottom,
        hidden: node.hidden || getComputedStyle(node).display === "none", row: Math.round(parseFloat(node.style.getPropertyValue("--vc-row")) * (rows - 1) / 100), state: node.dataset.state ?? "", journey: node.dataset.journey ?? "", platform: node.dataset.platform ?? "" };
      probe.frames.push(frame);
      if (!probe.start && frame.state === "jump" && frame.journey && (!ballistic || frame.row === 3)) { probe.start = frame; probe.journey = frame.journey; }
      else if (probe.start && (frame.state !== "jump" || frame.journey !== probe.journey)) { probe.end = frame; probe.done = true; }
      if (probe.done || now - began > 15000) return;
      probe.raf = requestAnimationFrame(record);
    };
    win.topJumpProbe = probe; probe.raf = requestAnimationFrame(record);
  }, { ballistic, rows: registration.rows.length });
}

async function finishProbe(page: Page, label: string) {
  try {
    await expect.poll(() => page.evaluate(() => Boolean((window as ProbeWindow).topJumpProbe?.done)), { timeout: 15000, intervals: [16, 32, 50] }).toBe(true);
  } catch (error) {
    const failed = await page.evaluate(() => {
      const p = (window as ProbeWindow).topJumpProbe!; cancelAnimationFrame(p.raf); p.observer.disconnect();
      return { frames: p.frames, start: p.start, end: p.end, journey: p.journey, hiddenMutation: p.hiddenMutation };
    });
    await writeFile(`.scratch-pw/companion-054-${label}-failed-frames.json`, JSON.stringify(failed, null, 2));
    throw error;
  }
  const probe = await page.evaluate(() => {
    const p = (window as ProbeWindow).topJumpProbe!; cancelAnimationFrame(p.raf); p.observer.disconnect();
    return { frames: p.frames, start: p.start!, end: p.end!, journey: p.journey, hiddenMutation: p.hiddenMutation };
  });
  await writeFile(`.scratch-pw/companion-054-${label}-frames.json`, JSON.stringify(probe, null, 2));
  expect(probe.hiddenMutation, "even a between-rAF hidden/visible flicker is a regression").toBe(false);
  const flight = probe.frames.filter(frame => frame.journey === probe.journey);
  expect(flight.length).toBeGreaterThan(8);
  expect(flight.every(frame => frame.state === "jump" && !frame.hidden)).toBe(true);
  expect(flight.every(frame => frame.width > 91.99 && frame.width < 92.01 && frame.top >= 7.99 && frame.left >= 3.99 && frame.right <= page.viewportSize()!.width - 3.99 && frame.bottom <= page.viewportSize()!.height - 11.99)).toBe(true);
  // A requested home flight immediately starts its separate finite sleep
  // action. Its new clock is valid; the completed flight's clock must end.
  expect(probe.end.hidden).toBe(false); expect(probe.end.journey).not.toBe(probe.journey);
  expect(Math.max(...flight.map(frame => frame.y)) - Math.min(...flight.map(frame => frame.y))).toBeGreaterThan(10);
  console.log(JSON.stringify({ check: `top-jump-${label}`, frames: flight.length, journey: probe.journey, start: probe.start, end: probe.end, minimumFeet: Math.min(...flight.map(frame => frame.y)), hiddenMutation: probe.hiddenMutation }));
  return probe;
}

async function actualSupportError(page: Page, point: { x: number; y: number }) {
  return page.evaluate(point => {
    const selector = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";
    const supports: { left: number; right: number; y: number }[] = [];
    const range = document.createRange();
    for (const node of document.querySelectorAll(selector)) { range.selectNodeContents(node); for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) supports.push({ left: r.left, right: r.right, y: r.top - 3 }); }
    range.detach();
    for (const node of document.querySelectorAll(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],.vc-home-cushion")) {
      const r = node.getBoundingClientRect(); if (r.width > 0 && r.height > 0) supports.push({ left: r.left, right: r.right, y: r.top - (node.matches(".vc-home-cushion") ? 0 : 3) });
    }
    // New structural ledges use actual band tops and header bottoms. A header
    // match must also clear every visible glyph/control at the landing x;
    // merely widening the old glyph-height tolerance would hide a real error.
    const visible = (element: Element | null): boolean => { if (!element) return true; const style = getComputedStyle(element); return !element.hasAttribute("hidden") && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > .05 && visible(element.parentElement); };
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const root = document.querySelector(".poster-page")!;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), glyph = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement; if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion,.vc-food-layer")) continue;
      glyph.selectNodeContents(node); for (const r of glyph.getClientRects()) if (r.width > .5 && r.height > .5) obstacles.push(r);
    }
    glyph.detach();
    for (const node of root.querySelectorAll("button,a[href],input,select,textarea,[role=button]")) {
      if (!visible(node) || node.matches(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],.public-day,.agenda-day") || node.closest(".vc-companion,.vc-cushion-button")) continue;
      const r = node.getBoundingClientRect(); if (r.width > 0 && r.height > 0) obstacles.push(r);
    }
    for (const node of root.querySelectorAll(".support-bar[data-supportid],.agenda-event[data-supportid],.agenda-item[data-supportid],.weekday-row,.public-calendar-header,.agenda-header")) {
      if (!visible(node)) continue;
      const r = node.getBoundingClientRect(), header = node.matches(".weekday-row,.public-calendar-header,.agenda-header"), y = (header ? r.bottom : r.top) - 3;
      const half = 92 * .76 / 2, body = { left: point.x - half, right: point.x + half, top: y - half * 2, bottom: y };
      if (r.width <= 0 || r.height <= 0 || y - 92 < 4 || y > innerHeight - 12 || point.x - 46 < 4 || point.x + 46 > innerWidth - 4 || obstacles.some(o => body.left < o.right && body.right > o.left && body.top < o.bottom && body.bottom > o.top)) continue;
      supports.push({ left: r.left, right: r.right, y });
    }
    return Math.min(...supports.filter(s => point.x >= s.left - .5 && point.x <= s.right + .5).map(s => Math.abs(point.y - s.y)));
  }, point);
}

async function holdAtCeiling(page: Page) {
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  for (let i = 0; i < 10; i++) await actor(page).press("ArrowUp");
  await expect.poll(() => pet(page).evaluate(node => Math.abs(node.getBoundingClientRect().bottom - 100))).toBeLessThan(.01);
}

async function offerLowerCardFood(page: Page, origin: { x: number; y: number }) {
  // Dense agenda date rails can have no autonomous safe glyph span near the
  // upper card. A genuine offered snack makes the next actual card top an
  // explicit reachable destination; it does not invent a roaming platform.
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 4000 });
  await expect.poll(() => pet(page).evaluate((node, origin) => Math.abs(node.getBoundingClientRect().bottom - origin.y), origin)).toBeLessThan(2);
  const target = await page.locator(".agenda-event[data-eventid],.agenda-item[data-eventid]").evaluateAll((nodes, origin) => nodes
    .map(node => node.getBoundingClientRect()).filter(r => r.width > 80 && r.height > 0 && r.left <= origin.x && r.right >= origin.x && r.top - 3 > origin.y + 30 && r.top - 3 < origin.y + 240)
    .sort((a, b) => a.top - b.top).map(r => ({ x: origin.x, y: r.top - 24, landingY: r.top - 3 }))[0], origin);
  expect(target, "the offered destination must be a real lower card within one jump").toBeDefined();
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).tap();
  const food = page.locator(".vc-food").last(); await expect(food).toBeVisible();
  const r = (await food.boundingBox())!, start = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] });
    await page.waitForTimeout(60);
    for (let step = 1; step <= 12; step++) {
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (target!.x - start.x) * step / 12, y: start.y + (target!.y - start.y) * step / 12, id: 1 }] });
      await page.waitForTimeout(16);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await client.detach(); }
  await expect(food).not.toHaveAttribute("data-selected");
  console.log(JSON.stringify({ check: "top-jump-native-offered-card", origin, target }));
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "agenda top flights" : "desktop top flights", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("a real reachable upper-card transfer stays visible through its entire ballistic arc", async ({ page }) => {
    test.setTimeout(25000); await setup(page, true, mobile);
    if (mobile) await openCompanionHome(page, "touch");
    const original = await pet(page).elementHandle();
    const card = await placeOnCard(page, mobile); await startProbe(page, true);
    if (mobile) await offerLowerCardFood(page, card);
    const probe = await finishProbe(page, `ballistic-${mobile ? 390 : 1920}`);
    expect(Math.abs(probe.start.y - card.y)).toBeLessThan(2);
    expect(probe.start.y).toBeLessThan(235); expect(probe.start.y).toBeGreaterThan(116);
    expect(probe.frames.some(frame => frame.journey === probe.journey && frame.row === 4)).toBe(true);
    expect(probe.frames.some(frame => frame.journey === probe.journey && frame.row === 5)).toBe(true);
    expect(probe.start.y - Math.min(...probe.frames.filter(frame => frame.journey === probe.journey).map(frame => frame.y))).toBeGreaterThan(10);
    expect(probe.end.platform).not.toBe(probe.start.platform);
    expect(await actualSupportError(page, probe.end)).toBeLessThan(2);
    if (mobile) {
      const after = [];
      for (const delay of [0, 100, 400]) {
        if (delay) await page.waitForTimeout(delay);
        after.push(await pet(page).evaluate(node => {
          const box = node.getBoundingClientRect(), sprite = node.querySelector<HTMLElement>(".vc-sprite")!, image = getComputedStyle(sprite), actor = node.querySelector(".vc-actor")!, pose = node.querySelector(".vc-pose")!;
          return { at: performance.now(), hidden: (node as HTMLElement).hidden, data: { ...(node as HTMLElement).dataset }, box: box.toJSON(), transform: (node as HTMLElement).style.transform, sprite: { background: image.backgroundImage, position: image.backgroundPosition, size: image.backgroundSize, clip: image.clipPath, transform: image.transform, visibility: image.visibility, opacity: image.opacity, rect: sprite.getBoundingClientRect().toJSON() }, actor: { opacity: getComputedStyle(actor).opacity, visibility: getComputedStyle(actor).visibility }, pose: { transform: getComputedStyle(pose).transform, opacity: getComputedStyle(pose).opacity }, focused: document.hasFocus(), scrollY };
        }));
        await page.screenshot({ path: `.scratch-pw/companion-054-ballistic-390-after-${after.length - 1}.png` });
      }
      await writeFile(".scratch-pw/companion-054-ballistic-390-after.json", JSON.stringify(after, null, 2));
      console.log(JSON.stringify({ check: "top-jump-post-landing-390", after }));
      expect(after.every(frame => !frame.hidden && frame.data.platform === probe.end.platform && Math.abs(frame.box.bottom - probe.end.y) < 2 && frame.sprite.opacity === "1" && frame.sprite.visibility === "visible")).toBe(true);
    }
    expect(await original!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    await page.screenshot({ path: `.scratch-pw/companion-054-ballistic-${mobile ? 390 : 1920}.png` });
  });

  test("ceiling-height release and a real home return keep their sine paths visible", async ({ page }) => {
    test.setTimeout(25000); await setup(page, false);
    // The compact room legitimately occludes the initial viewport-floor pet.
    // Place it on the actual upper card before opening the separate home UI.
    const card = await placeOnCard(page, mobile);
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 4000 });
    await expect.poll(() => pet(page).evaluate((node, card) => Math.abs(node.getBoundingClientRect().bottom - card.y), card)).toBeLessThan(2);
    await openCompanionHome(page, mobile ? "touch" : "pointer");
    await holdAtCeiling(page); await startProbe(page, false); await actor(page).press("Space");
    const near = await finishProbe(page, `near-${mobile ? 390 : 1920}`);
    expect(Math.abs(near.start.y - 100)).toBeLessThan(2); expect(Math.abs(near.end.y - card.y)).toBeLessThan(2);
    await holdAtCeiling(page); await startProbe(page, false);
    const cushion = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
    if (mobile) await cushion.tap(); else await cushion.click();
    const home = await finishProbe(page, `home-${mobile ? 390 : 1920}`);
    expect(Math.abs(home.start.y - 100)).toBeLessThan(2); expect(home.end.platform).toBe("companion-home");
    expect(await actualSupportError(page, home.end)).toBeLessThan(2);
    await expect(pet(page)).toHaveAttribute("data-state", "sleep");
    await page.screenshot({ path: `.scratch-pw/companion-054-sine-${mobile ? 390 : 1920}.png` });
  });
});
