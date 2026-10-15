import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Point = { x: number; y: number };
type PursuitWindow = Window & { pursuitWitness: { x: number; state: string; mood: string; at: number }[] };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const point = (item: Locator) => item.evaluate(node => {
  // Food transforms locate its foot directly; the companion carrier locates
  // the top-left of its92px cell. Measure the latter's real centre/bottom.
  if (node.matches(".vc-companion")) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; }
  const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: m.m41, y: m.m42 };
});

test.use({ viewport: { width: 1920, height: 1100 } });

/** Read actual ink and complete controls, independently of the product graph.
 * A long, clear physical floor is necessary for this walking-only experiment.
 * No extra platforms, product state or schedule content are injected. */
async function floorCorridor(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".poster-page")!;
    let y = innerHeight - 18;
    const styles = new Map<Element, CSSStyleDeclaration>();
    const css = (node: Element) => { const value = styles.get(node) ?? getComputedStyle(node); styles.set(node, value); return value; };
    const visible = (node: Element | null): boolean => !node || !node.hasAttribute("hidden") && css(node).display !== "none" && !["hidden", "collapse"].includes(css(node).visibility) && Number(css(node).opacity || 1) > .05 && visible(node.parentElement);
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const r = bar.getBoundingClientRect();
      if (visible(bar) && css(bar).position === "fixed" && r.width > 0 && r.height > 0 && r.top >= innerHeight * .65 && r.bottom <= innerHeight + 1) y = Math.min(y, r.top - 8);
    }
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const add = (r: DOMRect, parent: Element | null) => {
      const clip = { left: Math.max(0, r.left), right: Math.min(innerWidth, r.right), top: Math.max(0, r.top), bottom: Math.min(innerHeight, r.bottom) };
      for (let node = parent; node; node = node.parentElement) {
        const s = css(node), cx = /^(auto|scroll|hidden|clip)$/.test(s.overflowX), cy = /^(auto|scroll|hidden|clip)$/.test(s.overflowY);
        if (!cx && !cy) continue;
        const bounds = node.getBoundingClientRect();
        if (cx) { clip.left = Math.max(clip.left, bounds.left); clip.right = Math.min(clip.right, bounds.right); }
        if (cy) { clip.top = Math.max(clip.top, bounds.top); clip.bottom = Math.min(clip.bottom, bounds.bottom); }
      }
      if (clip.right > clip.left && clip.bottom > clip.top) obstacles.push(clip);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
      range.selectNodeContents(node); for (const rect of range.getClientRects()) add(rect, parent);
    }
    range.detach();
    const controls = new Set(root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"));
    for (const node of document.querySelectorAll<HTMLElement>(".vc-home,.vc-home-launcher")) controls.add(node);
    for (const node of controls) if (visible(node) && !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") && !node.closest(".vc-companion")) add(node.getBoundingClientRect(), node.parentElement);
    const spans: { left: number; right: number }[] = [];
    let start: number | undefined;
    for (let x = 52; x <= innerWidth - 52; x++) {
      const clear = obstacles.every(r => x + 50 <= r.left || x - 50 >= r.right || y + 4 <= r.top || y - 96 >= r.bottom);
      if (clear && start === undefined) start = x;
      if ((!clear || x === innerWidth - 52) && start !== undefined) { spans.push({ left: start, right: clear ? x : x - 1 }); start = undefined; }
    }
    const span = spans.sort((a, b) => b.right - b.left - (a.right - a.left))[0];
    return { y, span, size: document.querySelector<HTMLElement>(".vc-companion")!.getBoundingClientRect().width };
  });
}

async function grabFood(page: Page, item: Locator) {
  const r = (await item.boundingBox())!, at = await point(item), centre = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  await page.mouse.move(centre.x, centre.y); await page.mouse.down();
  return { centre, offset: { x: centre.x - at.x, y: centre.y - at.y } };
}
async function moveFood(page: Page, target: Point, offset: Point) {
  await page.mouse.move(target.x + offset.x, target.y + offset.y, { steps: 12 });
}

test("a hungry companion pursues a distant real snack in finite walks, yields while it is held, then resumes the same meal", async ({ page, context }) => {
  test.setTimeout(35000);
  const posts: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => route.request().method() === "POST" ? (posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ key, epoch, prefs, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    // Deterministic authored idle choice before food appears; no fake clock.
    Math.random = () => 0; Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false, animalMode: "default", speed: "lively" }, care: { ...DEFAULT_COMPANION_CARE, hunger: .8 } });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await openCompanionHome(page);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180); // Existing finite geometry delivery after native layout.
  const floor = await floorCorridor(page);
  expect(floor.size).toBeCloseTo(92, 2); expect(floor.span, "the fixture needs a real long clear floor").toBeDefined();
  if (!floor.span) throw new Error("No real clear floor corridor");
  expect(floor.span.right - floor.span.left).toBeGreaterThan(480);
  const start = { x: floor.span.left + 12, y: floor.y }, target = { x: start.x + 440, y: floor.y };
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(start.x, start.y); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => Math.hypot((await point(pet(page))).x - start.x, (await point(pet(page))).y - start.y)).toBeLessThan(2);
  const feed = page.getByRole("button", { name: "밥 꺼내기", exact: true }); await feed.click();
  const item = food(page).last(); await expect(food(page)).toHaveCount(1); const id = await item.getAttribute("data-food");
  const grip = await grabFood(page, item); await moveFood(page, target, grip.offset); await page.mouse.up();
  await expect(item).not.toHaveAttribute("data-falling");
  await expect.poll(async () => Math.hypot((await point(item)).x - target.x, (await point(item)).y - target.y)).toBeLessThan(2);
  await expect(pet(page)).toHaveAttribute("data-state", "walk", { timeout: 5000 });
  await expect.poll(async () => (await point(pet(page))).x - start.x).toBeGreaterThan(25);

  // Native re-grabbing makes this same source temporarily unavailable. It is
  // not deleted, earns no meal credit, and produces no disappointment event.
  const held = await grabFood(page, item); await moveFood(page, { x: target.x + 8, y: target.y - 8 }, held.offset);
  await expect(pet(page)).not.toHaveAttribute("data-state", "walk");
  const yielded = await point(pet(page)); await page.waitForTimeout(1100);
  expect(Math.hypot((await point(pet(page))).x - yielded.x, (await point(pet(page))).y - yielded.y)).toBeLessThan(2);
  await expect(food(page)).toHaveCount(1); await expect(pet(page)).not.toHaveAttribute("data-state", "eat");
  await expect(pet(page)).not.toHaveAttribute("data-mood", /disappointed|sulky/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number)).toBeGreaterThan(.75);
  await moveFood(page, target, held.offset); await page.mouse.up();
  expect(id).not.toBeNull(); await expect(item).toHaveAttribute("data-food", id!);
  await expect(item).not.toHaveAttribute("data-falling");

  // Observe public renderer metadata and actual coordinates, never private
  // brain state. More than180px remaining requires multiple finite actions.
  await page.evaluate(() => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!, samples: PursuitWindow["pursuitWitness"] = []; (window as unknown as PursuitWindow).pursuitWitness = samples;
    const began = performance.now();
    const sample = (now: number) => { const m = new DOMMatrixReadOnly(node.style.transform); samples.push({ x: m.m41, state: node.dataset.state ?? "", mood: node.dataset.mood ?? "", at: now - began }); if (now - began < 10000 && node.dataset.state !== "eat") requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  });
  await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
  const arrived = await point(pet(page)); expect(Math.abs(arrived.x - target.x)).toBeLessThanOrEqual(36); expect(Math.abs(arrived.y - target.y)).toBeLessThan(2);
  const samples = await page.evaluate(() => (window as unknown as PursuitWindow).pursuitWitness);
  expect(samples.filter(sample => sample.state === "walk").length).toBeGreaterThan(20);
  expect(samples.at(-1)!.x - samples[0].x).toBeGreaterThan(180);
  for (let i = 1; i < samples.length; i++) expect(samples[i].x).toBeGreaterThanOrEqual(samples[i - 1].x - .1);
  await page.screenshot({ path: ".scratch-pw/companion-food-pursuit.png" });
  await expect(food(page)).toHaveCount(0, { timeout: 6000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number)).toBeLessThan(.5);
  await expect(page.locator("[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
  expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
  expect(posts).toEqual([]); expect(errors).toEqual([]);
});
