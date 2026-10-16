import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Point = { x: number; y: number };
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Frame = {
  at: number; phase: string; point: Point; body: Point[]; bed: Rect; seatY: number;
  depth: string; frontDepth: string; frontVisible: boolean; frontHidden: boolean; frontZ: number; frontOpacity: number; alignment: number;
  localFronts: number; localFrontVisible: boolean; localFrontOpacity: number;
  rimSamples: number; visible: boolean; sameDom: boolean; platform: string; state: string;
  captured: boolean; gripError: number | null; outline: string; shadow: string;
};
type SofaProbe = Window & { sofaContact: {
  node: HTMLElement; phase: string; frames: Frame[]; raf: number; pointer: number | null;
  lastPoint?: Point & { at: number }; down: EventListener; move: EventListener; sample: () => Frame;
} };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();
const artifactPrefix = process.env.COMPANION_SOFA_ARTIFACT_PREFIX ?? "companion-064-sofa";

test.use({ viewport: { width: 1920, height: 1100 } });
test.beforeEach(async ({ page }) => {
  const attempted: string[] = [], failures: string[] = []; posts.set(page, attempted); errors.set(page, failures);
  page.on("pageerror", error => failures.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST"
    ? (attempted.push(new URL(route.request().url()).pathname), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); expect(errors.get(page)).toEqual([]); });

async function ready(page: Page, studio = false) {
  await page.goto(studio ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster?avatar=1");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await expect(home(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180); // The existing bounded geometry delivery.
  if (studio) await expect(page.locator(".studio-shell")).toHaveCSS("zoom", "0.9");
  else await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
}

async function furniture(page: Page) {
  return home(page).evaluate(node => {
    const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), seat = node.querySelector(".vc-home-cushion")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect();
    return { bed: { left: bed.left, top: bed.top, right: bed.right, bottom: bed.bottom, width: bed.width, height: bed.height }, seatY: seat.top, floor: { left: floor.left, right: floor.right, bottom: floor.bottom } };
  });
}

async function keyboardCue(page: Page) {
  // Traverse out and back with actual Tab input; a programmatic focus alone
  // does not establish the browser's keyboard focus-visible modality.
  await actor(page).focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(actor(page)).toBeFocused();
  const cue = await actor(page).evaluate(node => {
    const style = getComputedStyle(node), before = getComputedStyle(node, "::before");
    const rgb = before.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
    const rect = node.getBoundingClientRect(), matrix = new DOMMatrix(before.transform === "none" ? undefined : before.transform);
    const x = rect.left + parseFloat(before.left) + matrix.e + parseFloat(before.width) / 2;
    const y = (before.top === "auto" ? rect.bottom - parseFloat(before.bottom) - parseFloat(before.height) : rect.top + parseFloat(before.top)) + matrix.f + parseFloat(before.height) / 2;
    const rim = document.querySelector<SVGGeometryElement>(".vc-bed-foreground .vc-bed-front-shape"), ctm = rim?.getScreenCTM();
    const coveredByRim = Boolean(rim && ctm && Number(getComputedStyle(rim.closest(".vc-bed-foreground")!).zIndex) > Number(getComputedStyle(node.closest(".vc-companion")!).zIndex) && rim.isPointInFill(new DOMPoint(x, y).matrixTransform(ctm.inverse())));
    return { focusVisible: node.matches(":focus-visible"), outline: style.outlineStyle, shadow: style.boxShadow, content: before.content, width: parseFloat(before.width), height: parseFloat(before.height), opacity: Number(before.opacity), rgb, coveredByRim };
  });
  expect(cue.focusVisible).toBe(true); expect(cue.outline).toBe("none"); expect(cue.shadow).toBe("none");
  expect(cue.content).not.toBe("none"); expect(cue.width).toBe(24); expect(cue.height).toBe(2); expect(cue.opacity).toBeGreaterThanOrEqual(.6);
  expect(cue.rgb.length).toBeGreaterThanOrEqual(3); expect(Math.max(...cue.rgb.slice(0, 3)) - Math.min(...cue.rgb.slice(0, 3))).toBeLessThan(80);
  expect(cue.coveredByRim, "the neutral keyboard cue remains visible above the sofa rim").toBe(false);
}

async function floorPlacement(page: Page) {
  const room = await furniture(page), point = { x: room.bed.left + room.bed.width / 2, y: room.floor.bottom - COMPANION_HOME_FLOOR_INSET - 8 };
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  expect(await actor(page).evaluate(node => getComputedStyle(node).outlineStyle)).toBe("none");
  await page.mouse.click(point.x, point.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => Math.abs(await pet(page).evaluate(node => node.getBoundingClientRect().bottom) - (await furniture(page)).floor.bottom + COMPANION_HOME_FLOOR_INSET)).toBeLessThan(2);
}

async function recall(page: Page) {
  const control = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await control.focus(); await control.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 5000 });
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => Math.abs(await pet(page).evaluate(node => node.getBoundingClientRect().bottom) - (await furniture(page)).seatY)).toBeLessThan(2);
}

async function startProbe(page: Page) {
  await pet(page).evaluate(node => {
    const button = node.querySelector<HTMLButtonElement>(".vc-actor")!, began = performance.now();
    const probe: SofaProbe["sofaContact"] = { node: node as HTMLElement, phase: "start", frames: [], raf: 0, pointer: null,
      down: event => { probe.pointer = (event as PointerEvent).pointerId; },
      move: event => { const e = event as PointerEvent; probe.lastPoint = { x: e.clientX, y: e.clientY, at: performance.now() }; },
      sample: () => { throw new Error("probe not initialized"); } };
    button.addEventListener("gotpointercapture", probe.down); document.addEventListener("pointermove", probe.move, true);
    probe.sample = () => {
      const r = node.getBoundingClientRect(), localSize = (node as HTMLElement).offsetWidth, scale = r.width / localSize;
      const selectors = [".vc-pose", ".vc-contact", ".vc-reaction", ".vc-facing", ".vc-inertia"], layers = selectors.map(selector => getComputedStyle(node.querySelector(selector)!));
      const project = (point: Point, styles: CSSStyleDeclaration[] = layers) => {
        let q = new DOMPoint(point.x, point.y);
        for (const style of styles) {
          const [ox, oy] = style.transformOrigin.split(" ").map(parseFloat), matrix = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
          q = matrix.transformPoint(new DOMPoint(q.x - ox, q.y - oy)); q.x += ox; q.y += oy;
        }
        return { x: r.left + q.x * scale, y: r.top + q.y * scale };
      };
      const sprite = getComputedStyle(node.querySelector(".vc-sprite")!), values = sprite.clipPath.startsWith("inset(") ? sprite.clipPath.slice(6, -1).split(/\s+/) : ["0"];
      const pixels = values.map(value => parseFloat(value) * (value.endsWith("%") ? localSize / 100 : 1));
      const t = pixels[0], rr = pixels[1] ?? t, bb = pixels[2] ?? t, ll = pixels[3] ?? rr;
      const local = [{ x: ll, y: t }, { x: localSize - rr, y: t }, { x: localSize - rr, y: localSize - bb }, { x: ll, y: localSize - bb }];
      // Independent composition of the actual registration clip, sprite and
      // every CSS transform/origin. No product depth/motion helper is imported.
      const body = local.map(point => project(point, [sprite, ...layers]));
      const bedNode = document.querySelector<SVGSVGElement>(".vc-home .vc-plush-bed")!, bed = bedNode.getBoundingClientRect(), seat = document.querySelector(".vc-home .vc-home-cushion")!.getBoundingClientRect();
      const front = document.querySelector<HTMLElement>(".vc-bed-foreground")!, f = front.getBoundingClientRect(), frontStyle = getComputedStyle(front), outline = getComputedStyle(button);
      const localFronts = bedNode.querySelectorAll(".vc-bed-local-front"), localFront = localFronts[0]?.querySelector(".vc-bed-front-shape");
      const localStyle = localFront ? getComputedStyle(localFront) : undefined;
      let localFrontOpacity = 1;
      for (let element: Element | null = localFront ?? null; element; element = element.parentElement) localFrontOpacity *= Number(getComputedStyle(element).opacity);
      const path = bedNode.querySelector<SVGGeometryElement>(".vc-bed-front-shape")!, matrix = path.getScreenCTM(); let rimSamples = 0;
      if (matrix) for (let u = 0; u <= 4; u++) for (let v = 0; v <= 4; v++) {
        const point = project({ x: ll + (localSize - rr - ll) * u / 4, y: t + (localSize - bb - t) * v / 4 }, [sprite, ...layers]);
        if (path.isPointInFill(new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse()))) rimSamples++;
      }
      const [gx, gy] = layers.at(-1)!.transformOrigin.split(" ").map(parseFloat), facing = new DOMMatrix(layers[3].transform === "none" ? undefined : layers[3].transform).a;
      const grip = project({ x: facing < 0 ? localSize - gx : gx, y: gy }), captured = probe.pointer !== null && button.hasPointerCapture(probe.pointer);
      const gripError = captured && node.getAttribute("data-state") === "held" && probe.lastPoint && performance.now() - probe.lastPoint.at > 24 ? Math.hypot(grip.x - probe.lastPoint.x, grip.y - probe.lastPoint.y) : null;
      return { at: performance.now() - began, phase: probe.phase, point: { x: r.left + r.width / 2, y: r.bottom }, body,
        bed: { left: bed.left, top: bed.top, right: bed.right, bottom: bed.bottom, width: bed.width, height: bed.height }, seatY: seat.top,
        depth: (node as HTMLElement).dataset.sofaDepth ?? "", frontDepth: front.dataset.depth ?? "", frontVisible: !front.hidden && frontStyle.display !== "none" && frontStyle.visibility !== "hidden", frontHidden: front.hidden, frontZ: Number(frontStyle.zIndex), frontOpacity: Number(frontStyle.opacity), alignment: Math.max(Math.abs(f.left - bed.left), Math.abs(f.top - bed.top), Math.abs(f.width - bed.width), Math.abs(f.height - bed.height)),
        localFronts: localFronts.length, localFrontVisible: Boolean(localStyle && localStyle.display !== "none" && localStyle.visibility !== "hidden" && localFrontOpacity > 0), localFrontOpacity,
        rimSamples, visible: !(node as HTMLElement).hidden && getComputedStyle(node).display !== "none", sameDom: document.querySelector(".vc-companion") === node, platform: (node as HTMLElement).dataset.platform ?? "", state: (node as HTMLElement).dataset.state ?? "", captured, gripError, outline: outline.outlineStyle, shadow: outline.boxShadow };
    };
    const frame = () => { probe.frames.push(probe.sample()); probe.raf = requestAnimationFrame(frame); };
    (window as unknown as SofaProbe).sofaContact = probe; probe.raf = requestAnimationFrame(frame);
  });
}
const phase = (page: Page, value: string) => page.evaluate(value => { (window as unknown as SofaProbe).sofaContact.phase = value; }, value);
async function finishProbe(page: Page, label: string) {
  const frames = await page.evaluate(() => {
    const p = (window as unknown as SofaProbe).sofaContact; cancelAnimationFrame(p.raf);
    p.node.querySelector(".vc-actor")!.removeEventListener("gotpointercapture", p.down); document.removeEventListener("pointermove", p.move, true); return p.frames;
  });
  await writeFile(`.scratch-pw/${artifactPrefix}-${label}.json`, JSON.stringify(frames, null, 2));
  expect(frames.length).toBeGreaterThan(12); expect(frames.every(frame => frame.sameDom && frame.visible)).toBe(true);
  expect(frames.every(frame => frame.outline === "none" && frame.shadow === "none")).toBe(true);
  for (const frame of frames) {
    expect(["clear", "back", "seat", "front"]).toContain(frame.depth);
    expect(frame.localFronts, "the room retains exactly one shared local cloth group").toBe(1);
    const intersects = Math.max(...frame.body.map(p => p.x)) > frame.bed.left && Math.min(...frame.body.map(p => p.x)) < frame.bed.right && Math.max(...frame.body.map(p => p.y)) > frame.bed.top && Math.min(...frame.body.map(p => p.y)) < frame.bed.bottom;
    if (["back", "seat"].includes(frame.depth)) {
      expect(frame.frontVisible).toBe(true); expect(frame.frontHidden).toBe(false); expect(frame.frontDepth).toBe(frame.depth);
      expect(frame.frontOpacity).toBeGreaterThan(.99); expect(frame.alignment).toBeLessThan(1); expect(frame.frontZ).toBe(76);
      expect(frame.localFrontVisible, "an interior resident needs one external front, without a second local copy").toBe(false);
    } else {
      expect(frame.frontHidden, "an outside body needs the complete room's local front only").toBe(true); expect(frame.frontVisible).toBe(false);
      expect(frame.localFrontVisible).toBe(true); expect(frame.localFrontOpacity).toBeGreaterThan(.99);
    }
    if (Math.max(...frame.body.map(p => p.y)) < frame.bed.top + frame.bed.height * .19 - .25) expect(frame.depth).toBe("clear");
    if (intersects && Math.max(...frame.body.map(p => p.y)) > frame.bed.top + frame.bed.height * .19 + .25 &&
      (Math.min(...frame.body.map(p => p.x)) < frame.bed.left + frame.bed.width * 31 / 180 - .25 || Math.max(...frame.body.map(p => p.x)) > frame.bed.right - frame.bed.width * 31 / 180 + .25)) expect(frame.depth).toBe("front");
  }
  const grips = frames.flatMap(frame => frame.gripError === null ? [] : [frame.gripError]); if (grips.length) expect(Math.max(...grips)).toBeLessThan(.2);
  console.log(JSON.stringify({ check: "sofa-contact", label, frames: frames.length, depths: [...new Set(frames.map(f => f.depth))], rimWitnessFrames: frames.filter(f => f.rimSamples > 0).length, maxGripError: grips.length ? Math.max(...grips) : null, posts: posts.get(page), errors: errors.get(page) }));
  return frames;
}

async function capture(page: Page) {
  const at = await actor(page).evaluate(node => { const r = node.getBoundingClientRect(); for (const fx of [.5, .35, .65]) for (const fy of [.25, .45, .65]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (document.elementFromPoint(x, y)?.closest(".vc-actor") === node) return { x, y }; } return null; });
  expect(at, "an actual native point on the exposed actor").not.toBeNull();
  const body = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; });
  const offset = { x: at!.x - body.x, y: at!.y - body.y }; let current = at!;
  await page.mouse.move(current.x, current.y); await page.mouse.down();
  return {
    async move(point: Point, label: string, steps = 20) {
      await phase(page, label); const from = current, to = { x: point.x + offset.x, y: point.y + offset.y };
      for (let step = 1; step <= steps; step++) { current = { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps }; await page.mouse.move(current.x, current.y); await page.waitForTimeout(20); }
      await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(120);
    },
    async drop(label: string) { await phase(page, label); await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 }); await page.waitForTimeout(100); },
  };
}

test("a floor-origin held body crosses the side wall, clears the complete crest, then drops onto the real room floor", async ({ page }) => {
  await ready(page); await keyboardCue(page); await floorPlacement(page); await startProbe(page);
  const room = await furniture(page), drag = await capture(page), side = { x: Math.max(51, room.bed.left + room.bed.width * .14), y: room.seatY - 16 };
  await drag.move(side, "side-rim");
  expect(await actor(page).evaluate(node => Number(getComputedStyle(node, "::before").opacity))).toBe(0);
  await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-floor-side-held.png` });
  await drag.move({ x: room.bed.left + room.bed.width / 2, y: room.bed.top - 65 }, "above-crest");
  await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-above-crest.png` });
  await drag.move(side, "rim-return"); await drag.drop("rim-fall");
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  const frames = await finishProbe(page, "floor-held-rim");
  const sideFrames = frames.filter(f => f.phase === "side-rim" && f.state === "held"); expect(sideFrames.length).toBeGreaterThanOrEqual(12);
  expect(sideFrames.some(f => f.depth === "front" && f.rimSamples > 0 && /^companion-home-floor/.test(f.platform))).toBe(true);
  expect(frames.filter(f => f.phase === "above-crest" && f.depth === "clear").length).toBeGreaterThan(3);
  expect(frames.filter(f => f.phase === "rim-fall" && f.state === "jump").length).toBeGreaterThanOrEqual(12);
  expect(Math.abs(frames.at(-1)!.point.y - (await furniture(page)).floor.bottom + COMPANION_HOME_FLOOR_INSET)).toBeLessThan(2);
  await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-rim-floor.png` });
});

test("the studio resident exits sideways without dragging the foreground through its held body and lands on the first actual card", async ({ page }) => {
  await ready(page, true); await recall(page); await keyboardCue(page); await startProbe(page);
  const room = await furniture(page), drag = await capture(page);
  await drag.move({ x: room.bed.right - room.bed.width * .12, y: room.seatY - 10 }, "home-side-exit");
  await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-studio-side-exit.png` });
  const target = await page.locator(".studio-event-pill[data-companion-event='ordinary'][data-eventid]").evaluateAll(nodes => nodes.map((node, index) => ({ index, r: node.getBoundingClientRect() })).filter(({ r }) => r.width > 100 && r.top > 240 && r.top < innerHeight - 150).map(({ index, r }) => ({ index, x: r.left + r.width / 2, y: r.top - 24 }))[0] ?? null);
  expect(target).not.toBeNull();
  await drag.move({ x: target!.x, y: Math.min(room.bed.top - 65, target!.y - 65) }, "outside-clear");
  await drag.move(target!, "card-release"); await drag.drop("outside-fall");
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
  const frames = await finishProbe(page, "studio-home-exit");
  expect(frames.some(f => ["back", "seat"].includes(f.depth) && f.frontVisible && f.rimSamples > 0), "the native exit starts behind a real foreground mask").toBe(true);
  const exit = frames.filter(f => f.phase === "home-side-exit" && f.state === "held"); expect(exit.length).toBeGreaterThanOrEqual(12);
  expect(exit.some(f => f.depth === "front" && f.rimSamples > 0 && f.platform === "companion-home")).toBe(true);
  expect(Math.abs(frames.at(-1)!.point.y - await page.locator(".studio-event-pill[data-companion-event='ordinary'][data-eventid]").nth(target!.index).evaluate(node => node.getBoundingClientRect().top) + 3)).toBeLessThan(2);
  await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-studio-outside-landed.png` });
});

test("a genuine floor-to-cushion recall changes depth during the finite flight and settles behind the actual seat", async ({ page }) => {
  await ready(page); await floorPlacement(page); await startProbe(page); await phase(page, "floor-to-home");
  await recall(page); await page.waitForTimeout(160);
  const frames = await finishProbe(page, "floor-to-home");
  expect(frames.filter(f => f.state === "jump").length).toBeGreaterThanOrEqual(12);
  expect(frames.some(f => f.depth === "front" && f.rimSamples > 0)).toBe(true);
  expect(frames.some(f => ["back", "seat"].includes(f.depth) && f.rimSamples > 0)).toBe(true);
  expect(frames.at(-1)!.platform).toBe("companion-home"); expect(frames.at(-1)!.depth).toBe("seat");
  expect(Math.max(...frames.map(f => f.point.y)) - Math.min(...frames.map(f => f.point.y))).toBeGreaterThan(12);
  expect(Math.abs(frames.at(-1)!.point.y - (await furniture(page)).seatY)).toBeLessThan(2);
  await keyboardCue(page); await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-recalled-keyboard.png` });
});
