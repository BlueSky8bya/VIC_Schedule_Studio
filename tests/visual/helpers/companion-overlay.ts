import { expect, type Locator, type Page } from "@playwright/test";

/** Deliberate control focus follows the actual window entrance, rather than
 * racing a sheet's native autofocus while it is still entering. No animation
 * or application clock is stopped or replaced. */
export async function waitForOverlayEntrance(dialog: Locator) {
  await dialog.evaluate(async node => {
    await Promise.allSettled(node.getAnimations({ subtree: true })
      .filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      .map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** Ordinary overlays retain the rendered creature, while direct sleeping lifts remain available.
 * Dialog controls and keyboard navigation keep their own input. Hard visibility locks have
 * separate tests and intentionally do not use this assertion. */
export async function expectQuietCompanionVisible(page: Page) {
  const pet = page.locator(".vc-companion");
  await expect(pet).toHaveCount(1); await expect(pet).toBeVisible();
  await expect.poll(() => pet.locator(".vc-actor").evaluate(node => {
    const actor = node as HTMLButtonElement;
    return { pointer: getComputedStyle(actor).pointerEvents, keyboardExcluded: actor.disabled || Boolean(actor.closest("[inert]")) || actor.tabIndex < 0 };
  })).toEqual({ pointer: "auto", keyboardExcluded: true });
}

type ProbeWindow = Window & { overlayProbe: { ranges: number; rects: number; writes: number; original: typeof Range.prototype.getClientRects; rectOriginal: typeof Element.prototype.getBoundingClientRect; observer: MutationObserver } };

/** Probe only the finite transition's quiet tail. This is an observer/DOM
 * budget check, not an FPS, native OS throttling or OBS benchmark. */
export async function expectQuietCompanionTail(page: Page, focused: Locator) {
  await expectQuietCompanionVisible(page);
  // Ordinary overlays finish a finite current action before parking, just as
  // visible blur does. The longest explicit cushion nap is12s, then1.6s rest.
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-presence", "parked", { timeout: 18_000 });
  await page.waitForTimeout(1100);
  await expect(focused).toBeFocused();
  await page.evaluate(() => {
    const windows = new Set(document.querySelectorAll(".agenda-detail-sheet,.pi-sheet,.modal-card"));
    const probe = (window as unknown as ProbeWindow).overlayProbe = { ranges: 0, rects: 0, writes: 0, original: Range.prototype.getClientRects, rectOriginal: Element.prototype.getBoundingClientRect, observer: new MutationObserver(records => { probe.writes += records.length; }) };
    Range.prototype.getClientRects = function () { probe.ranges++; return probe.original.call(this); };
    Element.prototype.getBoundingClientRect = function () { if (windows.has(this)) probe.rects++; return probe.rectOriginal.call(this); };
    probe.observer.observe(document.querySelector(".vc-companion")!, { subtree: true, attributes: true, attributeFilter: ["style", "data-state", "data-presence", "data-platform", "data-dreaming", "hidden"] });
  });
  await page.waitForTimeout(350);
  const measured = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).overlayProbe;
    probe.observer.disconnect(); Range.prototype.getClientRects = probe.original; Element.prototype.getBoundingClientRect = probe.rectOriginal;
    return { ranges: probe.ranges, rects: probe.rects, writes: probe.writes };
  });
  expect(measured).toEqual({ ranges: 0, rects: 0, writes: 0 });
  await expect(focused).toBeFocused();
}

/** The actual opaque-body proxy clears the actual window, even after a drag.
 * A nearly fullscreen mobile sheet may leave no44px tier outside it. Only
 * that independently proved geometry permits the decorative corner fallback. */
export async function expectCompanionPerchClear(page: Page, dialog: Locator) {
  const viewport = page.viewportSize()!;
  await expect.poll(async () => {
    const body = (await page.locator(".vc-actor").boundingBox())!, pane = (await dialog.boundingBox())!, cell = (await page.locator(".vc-companion").boundingBox())!;
    const w = Math.max(0, Math.min(body.x + body.width, pane.x + pane.width) - Math.max(body.x, pane.x));
    const h = Math.max(0, Math.min(body.y + body.height, pane.y + pane.height) - Math.max(body.y, pane.y));
    if (w * h < .25) return true;
    // For a single rectangular window a body outside it must lie completely
    // left, right, above or below. Check those four feasible extrema directly;
    // do not reuse the product's perch selection/collision implementation.
    const half = 44 * .76 / 2, height = 44 * .76, margin = 4, gutter = 6;
    const clear44 = margin + 22 + half <= pane.x - gutter
      || viewport.width - margin - 22 - half >= pane.x + pane.width + gutter
      || margin + 44 <= pane.y - gutter
      || viewport.height - margin - height >= pane.y + pane.height + gutter;
    return !clear44 && cell.width <= 44.05 && cell.height <= 44.05;
  }).toBe(true);
  const body = (await page.locator(".vc-actor").boundingBox())!, pane = (await dialog.boundingBox())!, cell = (await page.locator(".vc-companion").boundingBox())!;
  expect(body.x).toBeGreaterThanOrEqual(0); expect(body.y).toBeGreaterThanOrEqual(0);
  expect(body.x + body.width).toBeLessThanOrEqual(viewport.width);
  expect(body.y + body.height).toBeLessThanOrEqual(viewport.height);
  const overlap = Math.max(0, Math.min(body.x + body.width, pane.x + pane.width) - Math.max(body.x, pane.x)) * Math.max(0, Math.min(body.y + body.height, pane.y + pane.height) - Math.max(body.y, pane.y));
  console.log(JSON.stringify({ check: "overlay-perch", width: viewport.width, name: await dialog.getAttribute("aria-label"), overlap, fallback: overlap >= .25, cell: { width: cell.width, height: cell.height }, body, pane }));
}
