import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

type Surface = "viewer" | "studio";
type Mode = "full" | "lite";
type Point = { x: number; y: number };
type Frame = Point & { at: number; visible: boolean; decoded: boolean; state: string; platform: string; pose: number; source: string; width: number; height: number };
type Witness = { node: HTMLElement; frames: Frame[]; raf: number; captures: number; capture: () => void; hiddenChanges: number; observer: MutationObserver };
type WitnessWindow = Window & { companionAuditInput?: Witness };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const evidence = new WeakMap<Page, { mutations: string[]; errors: string[] }>();
const prefix = process.env.VIC_AUDIT_INPUT_PREFIX ?? ".scratch-pw/companion-077-input";

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof = { mutations: [] as string[], errors: [] as string[] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  // These are June fixtures. Every possible write is intercepted before it
  // reaches the network; native calendar/input controls remain real.
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.mutations.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "fixture mutation blocked" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const remaining = await page.evaluate(() => { const witness = (window as WitnessWindow).companionAuditInput; if (!witness) return null; cancelAnimationFrame(witness.raf); witness.observer.disconnect(); document.removeEventListener("gotpointercapture", witness.capture, true); return { frames: witness.frames, captures: witness.captures, hiddenChanges: witness.hiddenChanges, sameDom: witness.node.isConnected && witness.node === document.querySelector(".vc-companion") }; });
  // A failed landing assertion must retain the original disappearance/warp,
  // rather than losing its frame evidence before the normal final checkpoint.
  if (remaining && info.status !== info.expectedStatus) await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}-failure.json`, JSON.stringify({ ...remaining, network: evidence.get(page) }, null, 2));
  expect(evidence.get(page)).toEqual({ mutations: [], errors: [] });
});

async function setup(page: Page, surface: Surface, mode: Mode) {
  await page.addInitScript(({ key, epoch, preferences, care, mode }) => {
    localStorage.setItem(key, epoch);
    for (const [name, value] of Object.entries({ "vic.reduceMotion": "off", "vic.gfxPref": mode === "full" ? "max" : "lite", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // Pick the authored idle while the user owns this interaction. This does
    // not replace time, pose sampling, native pointer input or geometry.
    Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, mode, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }, care: { ...DEFAULT_COMPANION_CARE, energy: 1, hunger: .05 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=6");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await expect.poll(() => pet(page).locator(".vc-texture").evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  let previous: { x: number; y: number; support: string } | undefined, stable = 0;
  // Initial calendar reflow can invalidate its first text ledge and start a
  // real finite landing. Do not aim a native grip at that moving old position.
  await expect.poll(async () => {
    const current = await pet(page).evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform), el = node as HTMLElement; return { x: matrix.m41 + 46, y: matrix.m42 + 92, support: el.dataset.platform ?? "", idle: !el.hidden && el.dataset.presence === "active" && !el.hasAttribute("data-returning") && ["idle", "look", "sniff"].includes(el.dataset.state ?? "") }; });
    stable = current.idle && current.support && previous?.support === current.support && Math.hypot(current.x - previous.x, current.y - previous.y) < .05 ? stable + 1 : 0;
    previous = current; return stable;
  }, { intervals: [80], timeout: 5000 }).toBeGreaterThanOrEqual(2);
  expect(await pet(page).evaluate(node => parseFloat((node as HTMLElement).style.getPropertyValue("--vc-size")))).toBe(92);
  if (surface === "viewer") await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
}

async function chooseCard(page: Page, surface: Surface): Promise<Point> {
  const selector = surface === "studio" ? '.studio-event-pill[data-companion-event="ordinary"]' : ".public-event[data-eventid]:not(.teaser):not(.is-support)";
  const point = await page.evaluate(selector => {
    const cell = document.querySelector(".vc-companion")!.getBoundingClientRect(), half = cell.width * .38 + 4, height = cell.height * .76 + 4;
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.matches(selector) && !node.closest(".vc-companion") && !node.matches(".public-day,.agenda-day,.studio-day")).map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = node.getBoundingClientRect();
      if (rect.width < cell.width || rect.top < cell.height + 160 || rect.bottom > innerHeight - 150) continue;
      for (const fraction of [.5, .25, .75]) {
        const x = rect.left + rect.width * fraction, y = rect.top - 18;
        if (controls.some(control => control.left < x + half && control.right > x - half && control.top < rect.top && control.bottom > y - height)) continue;
        if (document.elementFromPoint(x, rect.top + Math.min(4, rect.height / 2))?.closest(selector) !== node) continue;
        node.dataset.auditInputAnchor = ""; return { x, y };
      }
    }
    return null;
  }, selector);
  expect(point, "fixture must expose a real public card with a clear body-sized landing").not.toBeNull();
  return point!;
}

async function beginFrames(page: Page) {
  await pet(page).evaluate(node => {
    const witness: Witness = { node: node as HTMLElement, frames: [], raf: 0, captures: 0, capture: () => { witness.captures++; }, hiddenChanges: 0, observer: new MutationObserver(records => { witness.hiddenChanges += records.filter(record => record.attributeName === "hidden").length; }) };
    witness.observer.observe(node, { attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("gotpointercapture", witness.capture, true);
    const began = performance.now();
    const sample = (now: number) => {
      const el = node as HTMLElement, rect = node.getBoundingClientRect(), css = getComputedStyle(node), texture = node.querySelector<HTMLImageElement>(".vc-texture"), matrix = new DOMMatrixReadOnly(css.transform);
      witness.frames.push({ at: now - began, x: matrix.m41 + 46, y: matrix.m42 + 92, width: rect.width, height: rect.height, visible: !el.hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity || 1) > .05, decoded: Boolean(texture?.complete && texture.naturalWidth > 0), state: el.dataset.state ?? "", platform: el.dataset.platform ?? "", pose: Number(el.dataset.pose), source: texture?.currentSrc || texture?.src || "" });
      witness.raf = requestAnimationFrame(sample);
    };
    (window as WitnessWindow).companionAuditInput = witness; witness.raf = requestAnimationFrame(sample);
  });
}
async function finishFrames(page: Page, label: string) {
  const proof = await page.evaluate(() => { const witness = (window as WitnessWindow).companionAuditInput!; cancelAnimationFrame(witness.raf); witness.observer.disconnect(); document.removeEventListener("gotpointercapture", witness.capture, true); return { sameDom: witness.node.isConnected && witness.node === document.querySelector(".vc-companion"), frames: witness.frames, captures: witness.captures, hiddenChanges: witness.hiddenChanges }; });
  await writeFile(`${prefix}-${label}.json`, JSON.stringify({ ...proof, network: evidence.get(page) }, null, 2));
  expect(proof.sameDom).toBe(true); expect(proof.hiddenChanges).toBe(0);
  expect(proof.frames.length).toBeGreaterThan(4);
  // A translated desktop root can report91.999969px for a92px CSS box.
  // Keep the visual geometry invariant to .01px without rounding visibility,
  // texture readiness or the no-hidden-mutation ownership checks.
  expect(proof.frames.every(frame => frame.visible && frame.decoded && Math.abs(frame.width - 92) < .01 && Math.abs(frame.height - 92) < .01)).toBe(true);
  for (const frame of proof.frames) expect(new URL(frame.source).pathname).toBe(selectCompanionSprite(frame.pose).src);
  return proof;
}
async function checkpoint(page: Page, label: string) {
  await expect(pet(page)).toBeVisible();
  const actual = await pet(page).evaluate(node => { const image = node.querySelector<HTMLImageElement>(".vc-texture")!; return { pose: Number((node as HTMLElement).dataset.pose), src: image.currentSrc || image.src, decoded: image.complete && image.naturalWidth > 0 }; });
  expect(actual.decoded).toBe(true); expect(new URL(actual.src).pathname).toBe(selectCompanionSprite(actual.pose).src);
  await page.screenshot({ path: `${prefix}-${label}.png`, animations: "allow" });
}
async function expectLanding(page: Page) {
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => page.locator("[data-audit-input-anchor]").evaluate(node => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 3))).toBeLessThan(2);
}
async function nativeGrip(page: Page) {
  const box = (await actor(page).boundingBox())!, point = { x: box.x + box.width / 2, y: box.y + box.height * .30 };
  expect(await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest(".vc-actor")), point)).toBe(true);
  const world = await pet(page).evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41 + 46, y: matrix.m42 + 92 }; });
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  return { point, offset: { x: point.x - world.x, y: point.y - world.y } };
}
async function bottomRecipient(page: Page) {
  const target = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".studio-shell,.poster-page")!;
    const visible = (node: Element | null): boolean => {
      for (let current = node; current; current = current.parentElement) { const css = getComputedStyle(current); if (current.hasAttribute("hidden") || css.display === "none" || ["hidden", "collapse"].includes(css.visibility) || Number(css.opacity || 1) <= .05) return false; }
      return true;
    };
    let floorY = innerHeight - 18;
    const fixedBars = [...root.querySelectorAll<HTMLElement>(".agenda-monthbar")].filter(node => visible(node) && getComputedStyle(node).position === "fixed").map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1);
    for (const rect of fixedBars) floorY = Math.min(floorY, rect.top - 8);
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const controls = new Set([...root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role=button]"), ...document.querySelectorAll<HTMLElement>(".vc-home,.vc-compact-home,.vc-home button,.vc-home-launcher")]);
    for (const node of controls) {
      if (!visible(node) || node.closest(".vc-companion") || node.matches(".public-day,.agenda-day,.studio-day,.public-event,.agenda-event,.agenda-item,.studio-event-pill")) continue;
      const rect = node.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) obstacles.push(rect);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement; if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
      range.selectNodeContents(node); for (const rect of range.getClientRects()) if (rect.width > .5 && rect.height > .5 && rect.bottom > floorY - 92) obstacles.push(rect);
    }
    range.detach();
    // Independently prove an exposed same-x92px body corridor. No product
    // platform IDs, synthetic ledges or nearest-column fallback choose it.
    const half = 92 * .38 + 4, top = floorY - 92 * .76 - 4;
    for (let x = 92; x < innerWidth - 92; x += 24) {
      if (obstacles.some(rect => rect.left < x + half && rect.right > x - half && rect.top < floorY + 1 && rect.bottom > top)) continue;
      const hit = document.elementFromPoint(x, innerHeight - 1); if (!hit || hit.closest("button,a[href],input,select,textarea,.vc-home,.vc-compact-home")) continue;
      return { x, y: innerHeight - 1, floorY, fixedBars: fixedBars.map(rect => ({ top: rect.top, bottom: rect.bottom })), viewport: { width: innerWidth, height: innerHeight } };
    }
    return null;
  });
  expect(target, "a real safe same-x bottom corridor must remain clear of controls, text and the house").not.toBeNull();
  expect(target!.floorY).toBeLessThan(target!.y); return target!;
}
async function expectBottomLanding(page: Page, target: { x: number; floorY: number }) {
  await expect(pet(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => pet(page).evaluate((node, target) => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return Math.hypot(matrix.m41 + 46 - target.x, matrix.m42 + 92 - target.floorY); }, target)).toBeLessThan(2);
}

for (const surface of ["viewer", "studio"] as const) for (const mode of ["full", "lite"] as const) {
  test(`${surface} ${mode}: bottom-edge drag and explicit placement recover the same protected floor without disappearing`, async ({ page }) => {
    test.setTimeout(30000);
    await setup(page, surface, mode); const target = await bottomRecipient(page);
    await writeFile(`${prefix}-${surface}-${mode}-bottom-target.json`, JSON.stringify(target, null, 2));
    await beginFrames(page); await nativeGrip(page);
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await expect(pet(page)).toHaveAttribute("data-state", "held");
    await expect.poll(() => pet(page).evaluate((node, x) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).m41 + 46 - x), target.x)).toBeLessThan(2);
    await checkpoint(page, `${surface}-${mode}-bottom-held`);
    const releasedAt = await page.evaluate(() => (window as WitnessWindow).companionAuditInput!.frames.length);
    await page.mouse.up(); await page.mouse.move(4, 4);
    await expectBottomLanding(page, target);
    await checkpoint(page, `${surface}-${mode}-bottom-drag-release`);
    const dragged = await finishFrames(page, `${surface}-${mode}-bottom-drag-release`);
    const afterRelease = dragged.frames.slice(releasedAt);
    expect(afterRelease.length).toBeGreaterThan(3);
    expect(afterRelease.every(frame => frame.visible && Math.abs(frame.x - target.x) < 2)).toBe(true);
    // A finite landing retains its old origin support ID until contact. Its
    // measured x and terminal floor, rather than that transitional ID, prove
    // that recovery never warps into another date/column.
    expect(dragged.captures).toBeGreaterThan(0);

    await beginFrames(page); await actor(page).focus(); await actor(page).press("p");
    await expect(pet(page)).toHaveAttribute("data-placing", "");
    // The explicit native placement is below the protected floor as well.
    // It must consume its click without opening a calendar/editor control.
    await page.mouse.click(target.x, target.y); await page.mouse.move(4, 4);
    await expectBottomLanding(page, target); await expect(pet(page)).not.toHaveAttribute("data-placing");
    await checkpoint(page, `${surface}-${mode}-bottom-explicit-release`);
    const placed = await finishFrames(page, `${surface}-${mode}-bottom-explicit-release`);
    expect(placed.frames.every(frame => Math.abs(frame.x - target.x) < 2 && !/^(?:date-|card-)/.test(frame.platform))).toBe(true);
    await expect(page.locator(".agenda-detail-sheet,.event-editor-panel.is-edit")).toHaveCount(0);
  });

  test(`${surface} ${mode}: cold held texture survives native move then immediate release onto the first real card`, async ({ page }) => {
    test.setTimeout(30000);
    let unblock = () => {}, requested = false;
    const gate = new Promise<void>(resolve => { unblock = resolve; });
    for (const src of companionSpriteSources(8)) await page.route(`**${src}`, async route => { requested = true; await gate; await route.continue(); });
    await setup(page, surface, mode); const destination = await chooseCard(page, surface);
    await beginFrames(page);
    try {
      const grip = await nativeGrip(page);
      // Native pointerdown legitimately replaces idle with its decoded touch
      // packet before movement requests the cold held packet. The texture
      // owned immediately before that request, rather than an older idle
      // node, must remain visible throughout the blocked held decode.
      await expect.poll(() => pet(page).locator(".vc-texture").evaluate(node => { const image = node as HTMLImageElement; return image.complete && image.naturalWidth > 0 ? new URL(image.currentSrc || image.src).pathname : ""; })).toBe(companionSpriteSources(1)[0]);
      const initial = await pet(page).locator(".vc-texture").elementHandle(); expect(initial).not.toBeNull();
      await page.mouse.move(grip.point.x + 24, grip.point.y - 18, { steps: 8 });
      await expect(pet(page)).toHaveAttribute("data-state", "held"); await expect.poll(() => requested).toBe(true);
      expect(await initial!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion .vc-texture"))).toBe(true);
      await checkpoint(page, `${surface}-${mode}-cold-held`);
      expect(await initial!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion .vc-texture"))).toBe(true);
      unblock();
      await expect.poll(() => pet(page).locator(".vc-texture").evaluate(node => new URL((node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src).pathname)).toBe(companionSpriteSources(8)[0]);
      // No sleep, frame wait or app callback between the final native move and
      // release: the display batch may still be queued at this boundary.
      await page.mouse.move(destination.x + grip.offset.x, destination.y + grip.offset.y);
      await page.mouse.up(); await page.mouse.move(4, 4);
      await expectLanding(page);
      const final = await pet(page).evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41 + 46);
      expect(Math.abs(final - destination.x)).toBeLessThan(2);
      await checkpoint(page, `${surface}-${mode}-cold-release`);
      const proof = await finishFrames(page, `${surface}-${mode}-cold-release`);
      expect(proof.captures).toBeGreaterThan(0); expect(proof.frames.some(frame => frame.state === "held")).toBe(true);
    } finally { unblock(); await page.mouse.up(); }
  });

  test(`${surface} ${mode}: placement Escape and lifted settings preserve keyboard and immediate pointer control`, async ({ page }) => {
    test.setTimeout(30000);
    await setup(page, surface, mode); const destination = await chooseCard(page, surface);
    await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(destination.x, destination.y); await expectLanding(page);
    await beginFrames(page);
    await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
    await actor(page).press("Escape"); await expect(pet(page)).not.toHaveAttribute("data-placing"); await expectLanding(page);
    await actor(page).press("Space"); await actor(page).press("ArrowUp"); await actor(page).press("ArrowUp");
    await expect(pet(page)).toHaveAttribute("data-state", "held");
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
    await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
    await expect(pet(page)).toHaveAttribute("data-dreaming", ""); await checkpoint(page, `${surface}-${mode}-lifted-settings`);
    await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0);
    // Grab as soon as the native sheet is gone, during its ordinary wake. A
    // pending keyboard lift must not swallow this new pointer capture.
    const grip = await nativeGrip(page);
    await page.mouse.move(destination.x + grip.offset.x, destination.y + grip.offset.y - 28);
    await page.mouse.up(); await page.mouse.move(4, 4);
    await expectLanding(page); await expect(pet(page)).not.toHaveAttribute("data-placing");
    await expect(actor(page)).toBeFocused();
    await checkpoint(page, `${surface}-${mode}-keyboard-pointer-restored`);
    const proof = await finishFrames(page, `${surface}-${mode}-keyboard-pointer-restored`);
    expect(proof.captures).toBeGreaterThan(0); expect(proof.frames.some(frame => frame.state === "sleep")).toBe(true);
  });
}
