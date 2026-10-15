import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Surface = "viewer" | "studio";
type Frame = { at: number; scrollY: number; footY: number; anchorY: number; error: number; platform: string; sameNode: boolean; hidden: boolean; state: string };
type AnchorProbe = Window & { companionAnchorProbe: { pet: HTMLElement; card: HTMLElement; offset: number } };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();

test.use({ viewport: { width: 1920, height: 780 } });
test.beforeEach(async ({ page }) => {
  const attempted: string[] = [], failures: string[] = []; posts.set(page, attempted); errors.set(page, failures);
  page.on("pageerror", error => failures.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST"
    ? (attempted.push(new URL(route.request().url()).pathname), route.fulfill({ status: 500, body: "" }))
    : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); expect(errors.get(page)).toEqual([]); });

async function setup(page: Page, surface: Surface) {
  // The sparse public month fits a taller window. A real shorter desktop
  // viewport supplies scroll without manufacturing any document geometry.
  if (surface === "viewer") await page.setViewportSize({ width: 1920, height: 640 });
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "active");
  if (surface === "studio") {
    const calendar = page.locator(".studio-calendar-panel"), rect = (await calendar.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, Math.max(150, Math.min(650, rect.y + 80)));
    await page.keyboard.down("Control");
    try {
      // The actual app handler owns this wheel: CSS calendar zoom, never the
      // browser's page zoom. Each input clears its existing220ms step cooldown.
      for (let step = 0; step < 4 && await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY) <= 120; step++) {
        await page.mouse.wheel(0, -120); await page.waitForTimeout(250);
      }
    } finally { await page.keyboard.up("Control"); }
  }
  // This is the real document's available scroll, with no spacer, transformed
  // stand-in, injected platforms, application state or clock substitution.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY)).toBeGreaterThan(120);
  if (surface === "studio") await expect(page.locator(".studio-shell")).toHaveCSS("zoom", "0.9");
  else await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
  // Allow the event-coalesced initial geometry to finish before explicit input.
  await page.waitForTimeout(180);
}

async function placeOnRealCard(page: Page, surface: Surface) {
  await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  const selector = surface === "studio" ? ".studio-event-pill[data-companion-event='ordinary'][data-eventid]" : ".public-event[data-eventid]:not(.teaser):not(.teaser-revealing)";
  const target = await page.locator(selector).evaluateAll((nodes, selector) => {
    const cards = nodes.map((node, index) => ({ node, index, rect: node.getBoundingClientRect() }));
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role='button'],.vc-home")]
      .filter(node => !node.matches(`${selector},.public-day,.agenda-day,.studio-day`) && !node.closest(".vc-companion"))
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    for (const card of cards) {
      const r = card.rect;
      // After a96px downward scroll the complete92px cell must remain below
      // the actual sticky chrome. This ray belongs to an ordinary real card.
      if (r.width < 92 || r.height <= 0 || r.top < 300 || r.top > innerHeight - 140) continue;
      for (const fraction of [.5, .75, .25]) {
        const x = r.left + r.width * fraction, releaseY = r.top - 24;
        if (x < 50 || x > innerWidth - 50) continue;
        const body = { left: x - 92 * .38 - 3, right: x + 92 * .38 + 3, top: r.top - 3 - 92 * .76 - 3, bottom: r.top - 3 };
        if (controls.some(c => c.left < body.right && c.right > body.left && c.top < body.bottom && c.bottom > body.top)) continue;
        const first = cards.filter(c => c.rect.width > 0 && c.rect.height > 0 && x >= c.rect.left && x <= c.rect.right && c.rect.top > releaseY).sort((a, b) => a.rect.top - b.rect.top)[0];
        if (first?.node === card.node) return { index: card.index, x, releaseY, cardTop: r.top };
      }
    }
    return null;
  }, selector);
  expect(target, "a genuine visible first-card ray with complete-body/control clearance").not.toBeNull();
  const card = page.locator(selector).nth(target!.index);
  const selectedCard = await card.elementHandle(); expect(selectedCard).not.toBeNull();
  await page.mouse.click(target!.x, target!.releaseY);
  // A visible viewport-floor seed is exactly the old studio failure. It must
  // never satisfy this test's setup or its subsequent scrolling assertions.
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => {
    const foot = await pet(page).evaluate(node => node.getBoundingClientRect().bottom);
    return Math.abs(foot - await selectedCard!.evaluate(node => node.getBoundingClientRect().top) + 3);
  }).toBeLessThan(2);
  const initial = await selectedCard!.evaluate(node => {
    const body = document.querySelector<HTMLElement>(".vc-companion")!, b = body.getBoundingClientRect(), r = node.getBoundingClientRect();
    (window as unknown as AnchorProbe).companionAnchorProbe = { pet: body, card: node as HTMLElement, offset: b.bottom - r.top };
    return { platform: body.dataset.platform!, footY: b.bottom, cardY: r.top, scrollY, offset: b.bottom - r.top };
  });
  expect(Math.abs(initial.offset + 3)).toBeLessThan(2);
  return initial;
}

async function wheelFrames(page: Page): Promise<Frame[]> {
  const recording = page.evaluate(() => new Promise<Frame[]>(resolve => {
    const probe = (window as unknown as AnchorProbe).companionAnchorProbe, frames: Frame[] = [];
    const began = performance.now();
    const frame = (now: number) => {
      // Read after this animation-frame batch, so the observer does not report
      // a pre-paint ordering difference before the shared anchor follower ran.
      setTimeout(() => {
        const b = probe.pet.getBoundingClientRect(), c = probe.card.getBoundingClientRect();
        frames.push({ at: now - began, scrollY, footY: b.bottom, anchorY: c.top, error: Math.abs(b.bottom - c.top - probe.offset), platform: probe.pet.dataset.platform ?? "", sameNode: document.querySelector(".vc-companion") === probe.pet && probe.card.isConnected, hidden: probe.pet.hidden || getComputedStyle(probe.pet).visibility === "hidden", state: probe.pet.dataset.state ?? "" });
        if (now - began >= 1200) resolve(frames); else requestAnimationFrame(frame);
      }, 0);
    };
    requestAnimationFrame(frame);
  }));
  // Native wheel input is deliberately gradual: the actual document moves,
  // while all frame errors are measured against its actual retained DOM card.
  await page.mouse.move(1000, page.viewportSize()!.height - 90);
  for (let step = 0; step < 16; step++) { await page.mouse.wheel(0, 6); await page.waitForTimeout(16); }
  return recording;
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} real event support follows genuine wheel scroll in the same coordinate space`, async ({ page }) => {
  await setup(page, surface);
  const initial = await placeOnRealCard(page, surface), frames = await wheelFrames(page);
  expect(frames.length).toBeGreaterThan(25);
  expect(frames.at(-1)!.scrollY - initial.scrollY).toBeGreaterThan(60);
  expect(initial.cardY - frames.at(-1)!.anchorY).toBeGreaterThan(60);
  expect(frames.every(frame => frame.sameNode && !frame.hidden && frame.state !== "jump")).toBe(true);
  expect([...new Set(frames.map(frame => frame.platform))]).toEqual([initial.platform]);
  const sortedErrors = frames.map(frame => frame.error).sort((a, b) => a - b), p95 = sortedErrors[Math.floor(sortedErrors.length * .95)], max = sortedErrors.at(-1)!;
  expect(p95).toBeLessThanOrEqual(4.5); expect(max).toBeLessThanOrEqual(8); expect(frames.at(-1)!.error).toBeLessThan(2);
  await expect(pet(page)).toHaveCount(1); await expect(actor(page)).toBeVisible();
  await expect(page.locator('[role="dialog"],.event-editor-panel.is-edit')).toHaveCount(0);
  await expect(page.locator("[data-export-surface] .vc-companion,[data-export-surface] .vc-home")).toHaveCount(0);
  if (surface === "viewer") await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
  console.log(JSON.stringify({ check: "actual-card-wheel-parity", surface, initial, samples: frames.length, scrollDelta: frames.at(-1)!.scrollY - initial.scrollY, anchorDelta: initial.cardY - frames.at(-1)!.anchorY, p95, max, endError: frames.at(-1)!.error, posts: posts.get(page), errors: errors.get(page) }));
  await test.info().attach(`${surface}-actual-card-wheel`, { body: JSON.stringify({ initial, frames }), contentType: "application/json" });
  await page.screenshot({ path: `.scratch-pw/companion-063-${surface}-anchor-wheel.png` });
});
