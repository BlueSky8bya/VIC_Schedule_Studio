import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { chooseCompanionCare } from "./helpers/companion-home";
import registration from "@/lib/ui/viewer-companion/fluid-sprite.json";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const posts = new WeakMap<Page, string[]>();
type Frame = { t: number; x: number; y: number; state: string; facing: string; mirror: number; row: number; column: number; pose: number };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, graphics: "max" | "lite" = "max", sentinel = false) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(({ graphics, preferences, care }) => {
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.gfxPref", graphics);
    localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    Math.random = () => .9999;
  }, { graphics, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, animalMode: "dog", roam: true, jump: false, sleep: false, heartPrank: false, ambientPrank: false, feeding: false, speed: "lively" }, care: { ...DEFAULT_COMPANION_CARE, hunger: .1 } });
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (sentinel) await page.locator(".public-event[data-eventid]:visible").first().evaluate(card => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "event-heart"; button.id = "motion-heart-sentinel";
    button.setAttribute("aria-pressed", "false"); button.textContent = "♥";
    button.style.cssText = "position:absolute;right:4px;top:4px;width:24px;height:24px;display:block;opacity:1";
    card.append(button);
  });
}

async function walkOnFloor(page: Page, startX: number, pointerX: number) {
  const home = page.getByRole("region", { name: "빅타민 집", exact: true });
  if (!(await home.isVisible())) {
    const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
    await launcher.focus(); await launcher.press("Enter");
  }
  await chooseCompanionCare(page, "옮길 곳 고르기");
  const height = page.viewportSize()!.height;
  await page.mouse.click(startX, height - 20);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await page.mouse.move(pointerX, height - 18);
  await expect(pet(page)).toHaveAttribute("data-state", "walk", { timeout: 5000 });
}

async function sampleFrames(page: Page, duration = 1000): Promise<Frame[]> {
  return page.evaluate(duration => new Promise(resolve => {
    const element = document.querySelector<HTMLElement>(".vc-companion")!;
    const facing = element.querySelector<HTMLElement>(".vc-facing")!;
    const result: Frame[] = [], start = performance.now();
    const sample = (now: number) => {
      const matrix = new DOMMatrixReadOnly(element.style.transform);
      const mirror = new DOMMatrixReadOnly(getComputedStyle(facing).transform);
      result.push({ t: now - start, x: matrix.m41, y: matrix.m42, state: element.dataset.state ?? "", facing: element.dataset.facing ?? "", mirror: mirror.a, row: Math.round(parseFloat(element.style.getPropertyValue("--vc-row")) * .15), column: Math.round(parseFloat(element.style.getPropertyValue("--vc-column")) * .15), pose: Number(element.dataset.pose) });
      if (now - start >= duration) resolve(result);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), duration);
}

async function geometry(page: Page) {
  return pet(page).evaluate(element => {
    const outer = element.getBoundingClientRect();
    return [".vc-actor", ".vc-effect", ".vc-contact-shadow"].map(selector => {
      const node = element.querySelector<HTMLElement>(selector)!;
      const box = node.getBoundingClientRect();
      return { selector, localX: box.left - outer.left, localY: box.top - outer.top, width: box.width, mirror: new DOMMatrixReadOnly(getComputedStyle(node).transform).a, insideFacing: element.querySelector(".vc-facing")!.contains(node) };
    });
  });
}

async function contactStrip(page: Page, label: string) {
  const captures: { input: Buffer; left: number; top: number }[] = [];
  const frames: { t: number; column: string }[] = [];
  const start = Date.now();
  for (let index = 0; index < 6; index++) {
    const box = (await pet(page).boundingBox())!;
    const clip = { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: 96, height: 96 };
    const input = await page.screenshot({ clip, animations: "allow" });
    captures.push({ input, left: index * 96, top: 0 });
    frames.push({ t: Date.now() - start, column: await pet(page).evaluate(node => (node as HTMLElement).style.getPropertyValue("--vc-column")) });
    await page.waitForTimeout(120);
  }
  await sharp({ create: { width: 576, height: 96, channels: 4, background: "#faf8f2" } }).composite(captures).png().toFile(`.scratch-pw/companion-motion-${label}-strip.png`);
  await writeFile(`.scratch-pw/companion-motion-${label}-strip.json`, JSON.stringify(frames, null, 2));
}

test("left and right travel face their movement while controls stay unmirrored", async ({ page }) => {
  test.setTimeout(35_000);
  await setup(page);
  // The bottom controls split the floor into safe left/right intervals. Start
  // with room to travel in one interval rather than landing against its end.
  await walkOnFloor(page, 60, 550);
  await expect(pet(page)).toHaveAttribute("data-facing", "right");
  const right = await sampleFrames(page, 650), rightGeometry = await geometry(page);
  expect(right.at(-1)!.x - right[0].x).toBeGreaterThan(20);
  expect(right.every(frame => frame.facing === "right" && frame.mirror === 1)).toBe(true);
  await contactStrip(page, "right");
  await page.mouse.move(80, page.viewportSize()!.height - 18);
  await expect(pet(page)).toHaveAttribute("data-facing", "left", { timeout: 12_000 });
  await expect(pet(page)).toHaveAttribute("data-state", "walk");
  const left = await sampleFrames(page, 650), leftGeometry = await geometry(page);
  expect(left.at(-1)!.x - left[0].x).toBeLessThan(-20);
  expect(left.every(frame => frame.facing === "left" && frame.mirror === -1)).toBe(true);
  for (const [index, before] of rightGeometry.entries()) {
    const after = leftGeometry[index];
    expect(before.mirror).toBeGreaterThan(0); expect(after.mirror).toBeGreaterThan(0);
    expect(before.insideFacing).toBe(false); expect(after.insideFacing).toBe(false);
    expect(after.localX).toBeCloseTo(before.localX, 1);
    expect(after.width).toBeCloseTo(before.width, 1);
  }
  await contactStrip(page, "left");
  await writeFile(".scratch-pw/companion-motion-directions.json", JSON.stringify({ right, left, rightGeometry, leftGeometry }, null, 2));
});

for (const graphics of ["max", "lite"] as const) {
  test(`${graphics} renders smooth position independently from the16-frame authored gait`, async ({ page }) => {
    await setup(page, graphics);
    // Full hit-target avoidance leaves a shorter left floor interval than the
    // old text-only geometry. Its whole continuous walk still exceeds1s.
    await walkOnFloor(page, 60, 1300);
    const frames = await sampleFrames(page);
    expect(frames.length).toBeGreaterThan(15);
    const steps = frames.slice(1).map((frame, index) => ({ dx: Math.abs(frame.x - frames[index].x), dt: frame.t - frames[index].t, changedColumn: frame.column !== frames[index].column }));
    const changedPosition = steps.filter(step => step.dx > .01).length;
    const changedColumn = steps.filter(step => step.changedColumn).length;
    const fraction = changedPosition / steps.length;
    const observedPositionRate = changedPosition / ((frames.at(-1)!.t - frames[0].t) / 1000);
    await writeFile(`.scratch-pw/companion-motion-${graphics}.json`, JSON.stringify({ displayCallbacks: frames.length, changedPosition, changedColumn, fraction, observedPositionRate, frames }, null, 2));
    // A fraction of this browser's own display callbacks, not an absolute60fps
    // promise for every device or a result manufactured with a fake clock.
    expect(fraction).toBeGreaterThan(graphics === "max" ? .7 : .35);
    // Lite's policy is a30Hz upper budget. This is a cap check against the
    // measured duration, not an assumption about the display's refresh rate.
    if (graphics === "lite") expect(observedPositionRate).toBeLessThanOrEqual(34);
    const gait = registration.rows[2];
    expect(gait).toHaveLength(16);
    expect(frames.every(frame => frame.state === "walk" && frame.row === 2 && frame.column >= 0 && frame.column < gait.length && frame.pose === gait[frame.column])).toBe(true);
    expect(new Set(frames.map(frame => frame.column)).size).toBeGreaterThanOrEqual(6);
    expect(changedColumn).toBeGreaterThanOrEqual(5);
    expect(changedColumn).toBeLessThanOrEqual(Math.ceil((frames.at(-1)!.t - frames[0].t) / 1000 * 14) + 1);
    expect(changedColumn).toBeLessThan(changedPosition * .65);
    expect(frames.some(frame => Math.abs(frame.x - Math.round(frame.x)) > .01)).toBe(true);
    expect(frames.at(-1)!.x - frames[0].x).toBeGreaterThan(60);
    // Quintic travel has a1.875 peak/mean speed ratio; the lively scoot's
    // shortest .85 duration factor gives a221px/s upper speed, not the retired
    // constant100px/s walk. Keep a small sampling/rounding margin above that.
    for (const step of steps) expect(step.dx).toBeLessThanOrEqual(Math.max(12, step.dt * .24 + 2));
  });
}

test("a human-heart geometry update does not insert an idle pose into a walk", async ({ page }) => {
  await setup(page, "max", true);
  await walkOnFloor(page, 60, 1300);
  const states = await page.evaluate(() => new Promise<string[]>(resolve => {
    const element = document.querySelector<HTMLElement>(".vc-companion")!;
    const button = document.getElementById("motion-heart-sentinel")!;
    const states = [element.dataset.state ?? ""];
    const observer = new MutationObserver(records => {
      for (const record of records) states.push(record.oldValue ?? "", element.dataset.state ?? "");
    });
    observer.observe(element, { attributes: true, attributeFilter: ["data-state"], attributeOldValue: true });
    setTimeout(() => button.setAttribute("aria-pressed", "true"), 250);
    setTimeout(() => button.setAttribute("aria-pressed", "false"), 750);
    setTimeout(() => { observer.disconnect(); resolve(states); }, 1000);
  }));
  // Equal state writes are now elided: attribute traffic must not be used as
  // proof that the animation is alive. Check both ends across the updates.
  expect(await pet(page).getAttribute("data-state")).toBe("walk");
  expect(states.every(state => state === "walk")).toBe(true);
  await writeFile(".scratch-pw/companion-motion-heart-observation.json", JSON.stringify(states, null, 2));
});
