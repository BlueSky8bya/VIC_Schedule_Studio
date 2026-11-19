import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { chooseCompanionCare } from "./helpers/companion-home";
import { companionSpriteMetadata as registration } from "@/lib/ui/viewer-companion/sprite-quality";

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

async function setup(page: Page, graphics: "max" | "lite" = "max", sentinel = false, animalMode: "dog" | "default" = "dog") {
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
  }, { graphics, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, animalMode, roam: true, jump: false, sleep: false, heartPrank: false, ambientPrank: false, feeding: false, speed: "lively" }, care: { ...DEFAULT_COMPANION_CARE, hunger: .1 } });
  // A fixed daytime hour: unpinned, the fixture follows the real clock and this gait check failed when run at night.
  await page.goto("/visual-fixture/poster?hour=12");
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
  // P is the native placement command; opening a house is unrelated to gait
  // and can cover the old hard-coded floor point. Keep any already visible
  // house/controls intact and choose a real clear point around them.
  await chooseCompanionCare(page, "옮길 곳 고르기", "keyboard");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await page.waitForTimeout(180); // final native layout and coalesced geometry
  const floor = await page.evaluate(requestedX => {
    const root = document.querySelector<HTMLElement>(".poster-page")!;
    const cell = document.querySelector<HTMLElement>(".vc-companion")!.getBoundingClientRect();
    const body = document.querySelector<HTMLElement>(".vc-actor")!.getBoundingClientRect();
    let y = innerHeight - 18;
    const half = Math.max(body.width, cell.width * .76) / 2, height = Math.max(body.height, cell.height * .76), gap = 4;
    type Rect = { left: number; top: number; right: number; bottom: number };
    const obstacles: Rect[] = [], styles = new Map<Element, CSSStyleDeclaration>();
    const style = (node: Element) => { const value = styles.get(node) ?? getComputedStyle(node); styles.set(node, value); return value; };
    const visible = (node: Element | null): boolean => !node || !node.hasAttribute("hidden") && style(node).display !== "none" && !["hidden", "collapse"].includes(style(node).visibility) && Number(style(node).opacity || 1) > .05 && visible(node.parentElement);
    // The shared fixed month bar can occupy the bottom on either layout.
    // Its actual top, rather than viewport height alone, defines this floor.
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      if (!visible(bar) || style(bar).position !== "fixed") continue;
      const box = bar.getBoundingClientRect();
      if (box.width > 0 && box.height > 0 && box.top >= innerHeight * .65 && box.bottom <= innerHeight + 1) y = Math.min(y, box.top - 8);
    }
    const add = (rect: Rect, parent: Element | null) => {
      const clipped = { left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom) };
      for (let node = parent; node; node = node.parentElement) {
        const css = style(node), clipX = /^(auto|scroll|hidden|clip)$/.test(css.overflowX), clipY = /^(auto|scroll|hidden|clip)$/.test(css.overflowY);
        if (!clipX && !clipY) continue;
        const box = node.getBoundingClientRect();
        if (clipX) { clipped.left = Math.max(clipped.left, box.left); clipped.right = Math.min(clipped.right, box.right); }
        if (clipY) { clipped.top = Math.max(clipped.top, box.top); clipped.bottom = Math.min(clipped.bottom, box.bottom); }
      }
      if (clipped.right > clipped.left && clipped.bottom > clipped.top) obstacles.push(clipped);
    };
    const range = document.createRange(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) add(rect, parent);
    }
    range.detach();
    const controls = new Set(root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"));
    for (const node of document.querySelectorAll<HTMLElement>(".vc-home,.vc-home-launcher")) controls.add(node);
    for (const node of controls) {
      if (!visible(node) || node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") || node.closest(".vc-companion")) continue;
      add(node.getBoundingClientRect(), node.parentElement);
    }
    // Independent rendered-body collision oracle: no product platform helper,
    // injected geometry or fake floor. Scan viewport pixels nearest the request.
    const min = Math.ceil(cell.width / 2 + gap), max = Math.floor(innerWidth - cell.width / 2 - gap);
    const candidates = Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index).sort((a, b) => Math.abs(a - requestedX) - Math.abs(b - requestedX) || a - b);
    const x = candidates.find(x => obstacles.every(rect => x + half + gap <= rect.left || x - half - gap >= rect.right || y + gap <= rect.top || y - height - gap >= rect.bottom));
    return { x: y >= cell.height + 8 && y <= innerHeight - 12 ? x : undefined, y, cell: cell.width, obstacles: obstacles.length };
  }, startX);
  expect(floor.cell).toBeCloseTo(92, 2);
  expect(floor.x, "the actual floor needs a clear92px companion point").toBeDefined();
  console.log(JSON.stringify({ check: "motion-native-floor", requestedX: startX, ...floor }));
  await page.mouse.click(floor.x!, floor.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await page.mouse.move(pointerX, floor.y);
  // A dog greets the pointer first: a few walk frames (up to about 5px), a 1.5s play bow, then the run to it
  // (4b4dc01f). The walk under test is the one that keeps travelling: half a second of unbroken walk that is
  // still moving, read per display frame in the page.
  const travelling = await pet(page).evaluate(node => new Promise<boolean>(resolve => {
    const body = node as HTMLElement, began = performance.now(); let since = 0, from = 0;
    const tick = (now: number) => {
      const x = body.getBoundingClientRect().left;
      if (body.dataset.state !== "walk") since = 0; else if (!since) { since = now; from = x; }
      if (since && now - since >= 500 && Math.abs(x - from) > 1) resolve(true); else if (now - began > 12_000) resolve(false); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  expect(travelling, "the companion must settle into one continuous walk toward the pointer").toBe(true);
}

/** With `walkRow`, wait (up to 12 s) for a walk on that gait row and record only that one unbroken walk, ending at its
 * last frame or after `duration`; resolves [] if no such walk starts. */
async function sampleFrames(page: Page, duration = 1000, walkRow?: number): Promise<Frame[]> {
  return page.evaluate(({ duration, rowCount, walkRow }) => new Promise(resolve => {
    const element = document.querySelector<HTMLElement>(".vc-companion")!;
    const facing = element.querySelector<HTMLElement>(".vc-facing")!;
    const result: Frame[] = [], began = performance.now(); let start = walkRow === null ? began : -1;
    const sample = (now: number) => {
      const matrix = new DOMMatrixReadOnly(element.style.transform);
      const mirror = new DOMMatrixReadOnly(getComputedStyle(facing).transform);
      const frame = { t: 0, x: matrix.m41, y: matrix.m42, state: element.dataset.state ?? "", facing: element.dataset.facing ?? "", mirror: mirror.a, row: Math.round(parseFloat(element.style.getPropertyValue("--vc-row")) * (rowCount - 1) / 100), column: Math.round(parseFloat(element.style.getPropertyValue("--vc-column")) * .15), pose: Number(element.dataset.pose) };
      if (walkRow !== null) {
        const onWalk = frame.state === "walk" && frame.row === walkRow;
        // The walk's onset frame still carries the previous clip's data-pose (the dog case never samples an onset):
        // recording starts on the walk's second frame.
        if (start < 0) { if (!onWalk) { if (now - began > 12_000) resolve(result); else requestAnimationFrame(sample); return; } start = 0; requestAnimationFrame(sample); return; }
        if (start === 0) { if (!onWalk) { start = -1; requestAnimationFrame(sample); return; } start = now; }
        else if (!onWalk) { resolve(result); return; }
      }
      frame.t = now - start; result.push(frame);
      if (now - start >= duration) resolve(result);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), { duration, rowCount: registration.rows.length, walkRow: walkRow ?? null });
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

for (const graphics of ["max", "lite"] as const) for (const animal of ["dog", "default"] as const) {
  test(`${graphics} renders smooth position independently from the16-frame authored gait${animal === "default" ? " (default animal)" : ""}`, async ({ page }) => {
    await setup(page, graphics, false, animal);
    // Full hit-target avoidance leaves a shorter left floor interval than the
    // old text-only geometry. Its whole continuous walk still exceeds1s.
    await walkOnFloor(page, 60, 1300);
    // The run to the pointer eases in over its first second: watch long enough to see it travel. The default animal
    // does not chase the pointer (living.ts promptSocial is dog/affectionate only): after a short scoot and a shake it
    // roams on the 16-cell amble, so its case records exactly that one row-2 walk.
    const frames = await sampleFrames(page, 2500, animal === "default" ? 2 : undefined);
    expect(frames.length).toBeGreaterThan(15);
    const steps = frames.slice(1).map((frame, index) => ({ dx: Math.abs(frame.x - frames[index].x), dt: frame.t - frames[index].t, changedColumn: frame.column !== frames[index].column }));
    const changedPosition = steps.filter(step => step.dx > .01).length;
    const changedColumn = steps.filter(step => step.changedColumn).length;
    const fraction = changedPosition / steps.length;
    const observedPositionRate = changedPosition / ((frames.at(-1)!.t - frames[0].t) / 1000);
    await writeFile(`.scratch-pw/companion-motion-${graphics}${animal === "default" ? "-default" : ""}.json`, JSON.stringify({ displayCallbacks: frames.length, changedPosition, changedColumn, fraction, observedPositionRate, frames }, null, 2));
    // A fraction of this browser's own display callbacks, not an absolute60fps
    // promise for every device or a result manufactured with a fake clock.
    expect(fraction).toBeGreaterThan(graphics === "max" ? .7 : .35);
    // Lite's policy is a30Hz upper budget. This is a cap check against the
    // measured duration, not an assumption about the display's refresh rate.
    if (graphics === "lite") expect(observedPositionRate).toBeLessThanOrEqual(34);
    // Two authored travelling clips (ceaefc3a, 2026-10-16): the 16-cell amble on row 2 (80px stride) and the
    // two-key scoot on row 20 (54px stride). A dog's approach to the pointer is the scoot (living.ts, 4b4dc01f);
    // the default animal keeps the amble. Either way the cell is owned by distance travelled, never by the display frame.
    const row = frames[0].row, gait = registration.rows[row], travelled = Math.abs(frames.at(-1)!.x - frames[0].x);
    expect(row).toBe(animal === "dog" ? 20 : 2); expect(gait).toHaveLength(16);
    expect(frames.every(frame => frame.state === "walk" && frame.row === row && frame.column >= 0 && frame.column < gait.length && frame.pose === gait[frame.column])).toBe(true);
    const cells = new Set(frames.map(frame => frame.column));
    if (row === 2) { expect(cells.size).toBeGreaterThanOrEqual(6); expect(changedColumn).toBeGreaterThanOrEqual(5); }
    else {
      // Scoot: its two keys alternate once per half stride (27px), within one cell of the distance actually covered.
      expect([...cells].sort()).toEqual([0, 1]);
      expect(changedColumn).toBeGreaterThanOrEqual(2);
      expect(Math.abs(changedColumn - travelled / 27)).toBeLessThanOrEqual(1.5);
    }
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
