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

/** PLAN-069 supersedes collision avoidance. A window may overlap the actual
 * body; its own hit target must win there, without moving/scaling the pet. */
export async function expectCompanionBehindOverlay(page: Page, dialog: Locator) {
  const body = (await page.locator(".vc-actor").boundingBox())!, pane = (await dialog.boundingBox())!;
  const overlap = { left: Math.max(body.x, pane.x), right: Math.min(body.x + body.width, pane.x + pane.width), top: Math.max(body.y, pane.y), bottom: Math.min(body.y + body.height, pane.y + pane.height) };
  if (overlap.right - overlap.left > 2 && overlap.bottom - overlap.top > 2) {
    expect(await dialog.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), { x: (overlap.left + overlap.right) / 2, y: (overlap.top + overlap.bottom) / 2 })).toBe(true);
  }
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-detail-guest", "");
  expect(await page.locator(".vc-companion").evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m11)).toBeCloseTo(1, 4);
}
