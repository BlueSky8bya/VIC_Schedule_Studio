import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Sample = { at: number; x: number; y: number; falling: boolean };
type FallProbe = { released?: { x: number; y: number }; began: number; seen: boolean; done: boolean; frames: Sample[]; raf: number };
type ProbedWindow = Window & { foodFirstContact?: FallProbe };
const proof = new WeakMap<Page, { writes: string[]; errors: string[]; samples: unknown[] }>();
const point = (item: Locator) => item.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 }; });

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  proof.set(page, { writes: [], errors: [], samples: [] });
  page.on("pageerror", error => proof.get(page)!.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.get(page)!.writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
      return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (new URL(request.url()).pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const directory = `.scratch-pw/100-food-contact/${build}`, label = info.title.replace(/[^a-z0-9]+/gi, "-");
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/${label}.json`, JSON.stringify({ build, status: info.status, ...proof.get(page) }, null, 2));
  await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true }).catch(() => {});
  expect(proof.get(page)!.writes).toEqual([]); expect(proof.get(page)!.errors).toEqual([]);
});

async function setup(page: Page, surface: Surface) {
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, feeding: true, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.setItem("vic.panelSections", JSON.stringify({ version: 1, "tag-filter": true, season: true, "companion-home": true }));
    localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
  // Existing synthetic stacked cards, with no authenticated actions or DB.
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner&tent=1" : "/visual-fixture/poster?tent=1");
  await page.bringToFront(); await expect(page.locator(".vc-companion")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await openCompanionHome(page);
}

async function actualCard(page: Page, surface: Surface) {
  return page.evaluate(surface => {
    const root = document.querySelector(surface === "studio" ? ".studio-shell" : ".poster-page")!;
    const selector = surface === "studio" ? "[data-companion-event='ordinary'][data-eventid]" : ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
    const shown = (node: Element) => {
      const rect = node.getBoundingClientRect();
      for (let current: Element | null = node; current; current = current.parentElement) { const style = getComputedStyle(current); if (current.hasAttribute("hidden") || style.display === "none" || style.visibility !== "visible" || Number(style.opacity) <= .05) return false; }
      return rect.width > 0 && rect.height > 0;
    };
    const controls = [...root.querySelectorAll("button,a[href],input,select,textarea,[role='button']")].filter(node => shown(node) && !node.matches(`${selector},.public-day,.agenda-day,.studio-day`) && !node.closest(".vc-companion,.vc-cushion-button")).map(node => node.getBoundingClientRect());
    for (const node of root.querySelectorAll<HTMLElement>(selector)) {
      if (!shown(node)) continue;
      const rect = node.getBoundingClientRect(), y = rect.top - 3;
      if (rect.width < 120 || y < 145 || rect.bottom > innerHeight - 80) continue;
      let spans: [number, number][] = [[Math.max(rect.left, 26), Math.min(rect.right, innerWidth - 26)]];
      const relevant = controls.filter(control => control.top < y + 3 && control.bottom > y - 41);
      for (const control of relevant) spans = spans.flatMap(([a, b]) => control.right + 25 <= a || control.left - 25 >= b ? [[a, b] as [number, number]] : [[a, Math.min(b, control.left - 25)], [Math.max(a, control.right + 25), b]].filter(([left, right]) => right - left >= 1) as [number, number][]);
      if (!spans.length) continue;
      const x = (spans[0][0] + spans[0][1]) / 2;
      if (document.elementFromPoint(x, rect.top + 2)?.closest(selector) !== node) continue;
      const precedingTops = [...root.querySelectorAll<HTMLElement>(selector)].filter(other => other !== node && shown(other)).map(other => other.getBoundingClientRect()).filter(other => x >= other.left && x <= other.right && other.top < y && other.top > y - 65).map(other => other.top - 3);
      const releaseY = Math.max(y - 65, ...precedingTops.map(top => top + 3));
      if (y - releaseY < 8) continue;
      node.setAttribute("data-test-first-food-card", "");
      return { x, y, spans, releaseY, source: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } };
    }
    return null;
  }, surface);
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} food lands on its first real card without skipping to the floor`, async ({ page }) => {
  await setup(page, surface);
  const target = await actualCard(page, surface);
  expect(target, "fixture needs a real first card with a visible fall and protected landing").not.toBeNull();
  const feed = page.getByRole("button", { name: "밥 꺼내기", exact: true }); await feed.click();
  const food = page.locator(".vc-food").last(); await expect(food).toBeVisible();
  await page.waitForTimeout(180); // Finish the real home/food geometry delivery.
  await food.evaluate(node => {
    const probe: FallProbe = { began: 0, seen: false, done: false, frames: [], raf: 0 };
    node.addEventListener("pointerup", () => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); probe.released = { x: matrix.m41, y: matrix.m42 }; probe.began = performance.now(); }, { capture: true, once: true });
    const sample = (now: number) => {
      if (probe.released) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform), falling = node.hasAttribute("data-falling");
        probe.frames.push({ at: now - probe.began, x: matrix.m41, y: matrix.m42, falling }); probe.seen ||= falling;
        if (probe.seen && !falling) { probe.done = true; return; }
      }
      probe.raf = requestAnimationFrame(sample);
    };
    (window as ProbedWindow).foodFirstContact = probe; probe.raf = requestAnimationFrame(sample);
  });
  const box = (await food.boundingBox())!, origin = await point(food), offset = { x: box.x + box.width / 2 - origin.x, y: box.y + box.height / 2 - origin.y };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(target!.x + offset.x, target!.releaseY + offset.y, { steps: 10 });
  await expect.poll(async () => { const shown = await point(food); return Math.hypot(shown.x - target!.x, shown.y - target!.releaseY); }).toBeLessThan(1);
  await page.mouse.up(); await page.mouse.move(2, 2);
  await expect.poll(() => page.evaluate(() => Boolean((window as ProbedWindow).foodFirstContact?.done)), { timeout: 4000 }).toBe(true);
  const motion = await page.evaluate(() => { const probe = (window as ProbedWindow).foodFirstContact!; cancelAnimationFrame(probe.raf); return { released: probe.released!, frames: probe.frames }; });
  const landed = await point(food), current = (await page.locator("[data-test-first-food-card]").boundingBox())!;
  proof.get(page)!.samples.push({ target, motion, landed, current });
  expect(Math.abs(landed.y - (current.y - 3))).toBeLessThan(2);
  expect(landed.x).toBeGreaterThanOrEqual(current.x); expect(landed.x).toBeLessThanOrEqual(current.x + current.width);
  expect(Math.abs(landed.x - target!.x), "an already safe release must retain its column").toBeLessThan(2);
  const contact = motion.frames.findIndex(frame => frame.y >= target!.y - .7);
  expect(contact).toBeGreaterThan(1);
  expect(Math.abs(motion.frames[contact].x - motion.released.x)).toBeLessThan(2);
  for (const frame of motion.frames.slice(0, contact)) expect(Math.abs(frame.x - motion.released.x)).toBeLessThan(2);
  const overlaps = await food.evaluate(node => {
    const rect = node.getBoundingClientRect(), root = document.querySelector(".studio-shell,.poster-page")!;
    return [...root.querySelectorAll("button,a[href],input,select,textarea,[role='button']")].filter(control => !control.matches(".public-event,.public-day,.agenda-event,.agenda-item,.agenda-day,.studio-day,[data-companion-event='ordinary']") && !control.closest(".vc-companion,.vc-food-layer")).filter(control => {
      const other = control.getBoundingClientRect(); return other.width > 0 && other.height > 0 && rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top;
    }).length;
  });
  expect(overlaps, "landed native44px food target must leave real controls clear").toBe(0);
});
