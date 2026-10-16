import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

type Surface = "viewer" | "studio";
type Point = { x: number; y: number };
type VisibleRect = { left: number; right: number; top: number; bottom: number };
type Frame = { at: number; readAt: number; phase: string; phaseAtQueue: string; serialAtQueue: number; serialAtRead: number; coherent: boolean; creatures: number; fronts: number; frontVisible: boolean; bedVisible: boolean; petVisible: boolean; sofaDepth: string; petVisibleRect: VisibleRect | null; frontVisibleRect: VisibleRect | null; bedVisibleRect: VisibleRect | null; alignment: number | null; same: boolean };
type ProbeWindow = Window & { houseAudit?: { phase: string; frames: Frame[]; raf: number; serial: number; timers: Set<ReturnType<typeof setTimeout>>; stopped: boolean } };
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const foods = (page: Page) => page.locator(".vc-food");
const prefix = process.env.VIC_AUDIT_HOUSE_PREFIX ?? ".scratch-pw/companion-077-house";
const transport = new WeakMap<Page, { writes: string[]; errors: string[] }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const observed = { writes: [] as string[], errors: [] as string[] }; transport.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      observed.writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, body: "blocked fixture mutation" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});
test.afterEach(async ({ page }, info) => {
  const frames = await finishWitness(page);
  await writeFile(`${prefix}-${info.title.startsWith("studio") ? "studio" : "viewer"}.json`, JSON.stringify({ ...transport.get(page), frames }, null, 2));
  expect(transport.get(page)).toEqual({ writes: [], errors: [] });
});

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  // The real shared geometry has a bounded120ms delivery after native reflow.
  await page.waitForTimeout(180);
}
async function position(item: Locator) {
  return item.evaluate(node => {
    const value = node.closest("[hidden]") ? (node as HTMLElement).style.transform : getComputedStyle(node).transform;
    const matrix = new DOMMatrixReadOnly(value); return { x: matrix.m41, y: matrix.m42 };
  });
}
async function floorOffset(page: Page, item: Locator) {
  const point = await position(item), floor = (await home(page).locator(".vc-home-floor").boundingBox())!;
  return { x: point.x - floor.x, y: point.y - floor.y };
}
async function expectFloor(page: Page, item: Locator, offset?: Point) {
  await expect(item).toHaveJSProperty("hidden", false); await expect(item).not.toHaveAttribute("data-falling");
  await expect.poll(async () => {
    const point = await position(item), floor = (await home(page).locator(".vc-home-floor").boundingBox())!;
    return Math.abs(point.y - (floor.y + floor.height - COMPANION_HOME_FLOOR_INSET));
  }).toBeLessThan(2);
  if (offset) await expect.poll(async () => { const point = await floorOffset(page, item); return Math.hypot(point.x - offset.x, point.y - offset.y); }).toBeLessThan(2);
}
async function expectForeground(page: Page) {
  await expect(page.locator(".vc-bed-foreground")).toHaveCount(1);
  await expect.poll(() => page.locator(".vc-bed-foreground").evaluate(front => {
    const bed = document.querySelector(".vc-home:not([data-panel-collapsed]) .vc-plush-bed");
    if (!bed || (front as HTMLElement).hidden) return Infinity;
    const a = front.getBoundingClientRect(), b = bed.getBoundingClientRect();
    return Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
  })).toBeLessThan(2);
}
async function checkpoint(page: Page, surface: Surface, label: string, item: Locator, offset?: Point) {
  await settleLayout(page); await expect(home(page)).toHaveCount(1); await expect(pet(page)).toHaveCount(1); await expect(foods(page)).toHaveCount(1);
  await expectFloor(page, item, offset); await expectForeground(page);
  await expect(page.locator("[data-export-surface] .vc-companion,[data-export-surface] .vc-food,[data-export-surface] .vc-bed-foreground")).toHaveCount(0);
  if (surface === "viewer") expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
  await page.screenshot({ path: `${prefix}-${surface}-${label}.png` });
}
async function beginWitness(page: Page) {
  await pet(page).evaluate(node => {
    const probe = { phase: "initial", frames: [] as Frame[], raf: 0, serial: 0, timers: new Set<ReturnType<typeof setTimeout>>(), stopped: false }, began = performance.now();
    const intersect = (a: VisibleRect, b: VisibleRect) => {
      const clipped = { left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) };
      return clipped.right > clipped.left && clipped.bottom > clipped.top ? clipped : null;
    };
    const visibleRect = (element: Element | undefined | null, bounds?: DOMRect): VisibleRect | null => {
      if (!element?.isConnected) return null;
      const box = bounds ?? element.getBoundingClientRect();
      let result = intersect(box, { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight });
      if (!result) return null;
      let opacity = 1;
      for (let current: Element | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (current.hasAttribute("hidden") || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return null;
        opacity *= Number(style.opacity || 1);
        if (opacity <= 0) return null;
        const clipX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX), clipY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
        const inset = /^inset\(([^)]+)\)$/.exec(style.clipPath);
        if (!clipX && !clipY && !inset) continue;
        const rect = current === element ? box : current.getBoundingClientRect();
        if (clipX || clipY) {
          // Overflow clips at the actual padding box. Keep Studio's CSS zoom
          // in the measured scale instead of subtracting unscaled borders.
          const html = current as HTMLElement, scaleX = html.offsetWidth > 0 ? rect.width / html.offsetWidth : 1, scaleY = html.offsetHeight > 0 ? rect.height / html.offsetHeight : 1;
          const left = rect.left + current.clientLeft * scaleX, top = rect.top + current.clientTop * scaleY;
          result = intersect(result, { left: clipX ? left : result.left, right: clipX ? left + current.clientWidth * scaleX : result.right, top: clipY ? top : result.top, bottom: clipY ? top + current.clientHeight * scaleY : result.bottom });
          if (!result) return null;
        }
        if (inset) {
          // The foreground's own authored inset is part of visibility too:
          // a nonzero BCR may still be completely clipped outside the room.
          const tokens = inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
          if (tokens.length >= 1 && tokens.length <= 4 && tokens.every(token => /^-?(?:\d*\.)?\d+(?:px|%)?$/.test(token))) {
            const [a, b = a, c = a, d = b] = tokens;
            const value = (token: string, dimension: number) => parseFloat(token) * (token.endsWith("%") ? dimension / 100 : 1);
            result = intersect(result, { left: rect.left + value(d, rect.width), right: rect.right - value(b, rect.width), top: rect.top + value(a, rect.height), bottom: rect.bottom - value(c, rect.height) });
            if (!result) return null;
          }
        }
      }
      return result;
    };
    const sameRect = (a?: DOMRect, b?: DOMRect) => !a && !b || Boolean(a && b && Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) < .01);
    const read = (queued: { at: number; phaseAtQueue: string; serialAtQueue: number; bed: Element | null; rect?: DOMRect }) => {
      if (probe.stopped) return;
      const fronts = document.querySelectorAll<HTMLElement>(".vc-bed-foreground"), front = fronts[0];
      const bed = document.querySelector<SVGSVGElement>(".vc-home:not([data-panel-collapsed]) .vc-plush-bed");
      const a = front?.getBoundingClientRect(), b = bed?.getBoundingClientRect();
      const frontVisibleRect = visibleRect(front, a), bedVisibleRect = visibleRect(bed, b), frontVisible = Boolean(frontVisibleRect), bedVisible = Boolean(bedVisibleRect);
      // Use the same clipped/ancestor-aware visibility measurement for the
      // creature; a92px BCR alone does not establish a visible resident.
      const petVisibleRect = visibleRect(node), petVisible = Boolean(petVisibleRect), sofaDepth = (node as HTMLElement).dataset.sofaDepth ?? "clear";
      probe.frames.push({ at: queued.at - began, readAt: performance.now() - began, phase: probe.phase, phaseAtQueue: queued.phaseAtQueue, serialAtQueue: queued.serialAtQueue, serialAtRead: probe.serial,
        coherent: queued.serialAtQueue === probe.serial && queued.phaseAtQueue === probe.phase && queued.bed === bed && sameRect(queued.rect, b),
        creatures: document.querySelectorAll(".vc-companion").length, fronts: fronts.length, frontVisible, bedVisible, petVisible, sofaDepth, petVisibleRect, frontVisibleRect, bedVisibleRect,
        alignment: frontVisible && bedVisible && a && b ? Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) : null,
        same: node.isConnected && node === document.querySelector(".vc-companion") });
    };
    const sample = (now: number) => {
      if (probe.stopped) return;
      const bed = document.querySelector(".vc-home:not([data-panel-collapsed]) .vc-plush-bed");
      const queued = { at: now, phaseAtQueue: probe.phase, serialAtQueue: ++probe.serial, bed, rect: bed?.getBoundingClientRect() };
      // Read after every callback in this render batch, never between the
      // house's CSS movement and the product's foreground-follow callback.
      // This is coherent post-batch DOM evidence, not a compositor receipt.
      // Retain mixed batches in JSON; do not label a newer phase/source as a
      // stale rendered frame. The unchanged strict2px oracle applies below.
      const timer = setTimeout(() => { probe.timers.delete(timer); read(queued); }, 0); probe.timers.add(timer);
      probe.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).houseAudit = probe; probe.raf = requestAnimationFrame(sample);
  });
}
async function finishWitness(page: Page) {
  return page.evaluate(() => {
    const probe = (window as ProbeWindow).houseAudit;
    if (!probe) return [];
    probe.stopped = true; cancelAnimationFrame(probe.raf);
    for (const timer of probe.timers) clearTimeout(timer); probe.timers.clear();
    return probe.frames;
  });
}
async function phase(page: Page, name: string) { await page.evaluate(value => { const probe = (window as ProbeWindow).houseAudit; if (probe) probe.phase = value; }, name); }

for (const surface of ["viewer", "studio"] as const) test(`${surface}: a real floor snack and sofa follow consecutive panel, compact and window changes`, async ({ page }) => {
  test.setTimeout(65000);
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner&y=2026&m=6" : "/visual-fixture/poster?avatar=1");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await expect(actor(page)).toBeVisible(); await openCompanionHome(page); await settleLayout(page);
  const creature = await pet(page).elementHandle();
  await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const item = foods(page).last(); await expect(foods(page)).toHaveCount(1);
  const snack = await item.elementHandle(), start = (await item.boundingBox())!;
  const target = await home(page).evaluate(node => {
    const floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(), bed = node.querySelector(".vc-cushion-button")!.getBoundingClientRect();
    return { x: bed.left + bed.width / 2, y: floor.bottom - 3 };
  });
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 16 }); await page.mouse.up();
  await expectFloor(page, item); const offset = await floorOffset(page, item);
  // Keyboard activates the same real cushion control without competing with
  // the nearby snack's separate native input target.
  const cushion = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }); await cushion.focus(); await cushion.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 }); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await checkpoint(page, surface, "floor", item, offset); await beginWitness(page);

  for (const section of ["tag-filter", "season"] as const) {
    await phase(page, `fold-${section}`);
    const heading = page.locator(`[data-panel-section-toggle="${section}"]:visible`); await expect(heading).toHaveCount(1); await heading.click();
    await expect(heading).toHaveAttribute("aria-expanded", "false"); await checkpoint(page, surface, `fold-${section}`, item, offset);
  }
  await phase(page, "right"); await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click(); await checkpoint(page, surface, "right", item, offset);
  await phase(page, "compact-closed"); await page.setViewportSize({ width: 1280, height: 1000 });
  await expect(page.getByRole("button", { name: "빅타민 집 열기", exact: true })).toBeVisible();
  await expect(page.locator(".vc-bed-foreground")).toBeHidden(); await expect(item).toHaveJSProperty("hidden", true);
  await phase(page, "compact-open"); await openCompanionHome(page); await checkpoint(page, surface, "compact", item);
  await phase(page, "wide"); await page.setViewportSize({ width: 1920, height: 1100 }); await checkpoint(page, surface, "wide", item, offset);

  await phase(page, "settings"); await page.getByRole("button", { name: "설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true }); await expect(settings).toBeVisible(); await waitForOverlayEntrance(settings);
  await expect(pet(page)).toBeVisible(); await expect(page.locator(".vc-food-layer")).toBeHidden();
  await page.screenshot({ path: `${prefix}-${surface}-settings.png` });
  await settings.getByRole("button", { name: "닫기", exact: true }).click(); await expect(settings).toBeHidden(); await checkpoint(page, surface, "settings-closed", item, offset);

  await phase(page, "detail");
  const card = page.locator(surface === "studio" ? '.studio-event-pill[data-companion-event="ordinary"]' : ".public-event:not(.teaser):not(.is-support)").filter({ visible: true }).first();
  if (surface === "studio") await card.locator(".pill-main strong").dblclick(); else await card.click();
  const detail = page.locator(surface === "studio" ? ".event-editor-panel.is-edit" : ".agenda-detail-sheet"); await expect(detail).toBeVisible(); await waitForOverlayEntrance(detail);
  await expect(pet(page)).toBeVisible(); await expect(page.locator(".vc-food-layer")).toBeHidden();
  await page.screenshot({ path: `${prefix}-${surface}-detail.png` });
  await detail.locator(surface === "studio" ? ".editor-close" : ".agenda-detail-close").click(); await expect(detail).toBeHidden();
  await checkpoint(page, surface, "detail-closed", item, offset);
  for (const section of ["season", "tag-filter"] as const) {
    await phase(page, `unfold-${section}`); const heading = page.locator(`[data-panel-section-toggle="${section}"]:visible`); await heading.click(); await expect(heading).toHaveAttribute("aria-expanded", "true"); await checkpoint(page, surface, `unfold-${section}`, item, offset);
  }
  await phase(page, "restored-left"); await page.getByRole("button", { name: "패널을 왼쪽에 두기", exact: true }).click(); await checkpoint(page, surface, "restored", item, offset);
  expect(await creature!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  expect(await snack!.evaluate(node => node.isConnected && node === document.querySelector(".vc-food"))).toBe(true);
  const frames = await finishWitness(page);
  expect(frames.length).toBeGreaterThan(30);
  expect(frames.every(frame => frame.same && frame.creatures === 1 && frame.fronts === 1)).toBe(true);
  const coherent = frames.filter(frame => frame.coherent);
  expect(coherent.length).toBeGreaterThan(30);
  expect(coherent.filter(frame => frame.frontVisible && !frame.bedVisible), "a detached foreground must never outlive its visible room in a coherent DOM batch").toEqual([]);
  // A contained seat/back resident paints between the local
  // sofa back and its fixed foreground. Outside/clear pets do not need that
  // extra occluder because the local drawing already contains the full sofa.
  const nested = coherent.filter(frame => frame.bedVisible && frame.petVisible && ["seat", "back"].includes(frame.sofaDepth));
  expect(nested.length, "the recalled resident must exercise the sofa interior rather than make this visibility check vacuous").toBeGreaterThan(0);
  expect(nested.filter(frame => !frame.frontVisible), "a visible interior resident must retain its sofa foreground in every coherent DOM batch").toEqual([]);
  const aligned = coherent.filter(frame => frame.alignment !== null);
  expect(aligned.length).toBeGreaterThan(20);
  expect(Math.max(...aligned.map(frame => frame.alignment!)), "the sofa foreground must follow the real bed throughout each native transition").toBeLessThan(2);
});
