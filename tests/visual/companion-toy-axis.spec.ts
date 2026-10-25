import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const output = process.env.COMPANION_TOY_AXIS_OUTPUT ?? (process.env.COMPANION_QA_OUTPUT ? `${process.env.COMPANION_QA_OUTPUT}/toy-axis` : ".scratch-pw/toy-axis-proof");
test.use({ viewport: { width: 1760, height: 1050 }, serviceWorkers: "block" });

for (const mode of ["full", "reduced", "soft", "off"] as const) test(`axis toy room material ${mode}: dimmed painted pixels`, async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin, errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    return url.origin === origin && ["GET", "HEAD"].includes(request.method()) && !url.pathname.startsWith("/api/") ? route.continue() : route.abort();
  });
  // A fixed mechanical pose isolates material pixels from rotor motion. This
  // synthetic room sample complements the native shared-home control cases.
  await page.goto("/visual-fixture/toy-motion?reduced=1");
  await expect(page.locator("[data-motion-ready=true]")).toHaveCount(1);
  await page.evaluate(mode => {
    document.documentElement.dataset.gfx = mode === "reduced" ? "full" : mode;
    document.documentElement.toggleAttribute("data-reduce-motion", mode === "reduced");
  }, mode);
  mkdirSync(output, { recursive: true });
  for (const kind of ["spinning-top", "battle-top-launcher", "pinwheel"]) {
    const toy = page.locator(`.vc-toy[data-kind="${kind}"]`), art = toy.locator("canvas");
    await expect(toy).toHaveAttribute("data-axis-painted", "");
    await toy.evaluate(node => node.style.setProperty("--vc-item-room-light", "1"));
    const bright = await toy.screenshot({ path: resolve(output, `material-${mode}-${kind}-bright.png`) });
    await toy.evaluate(node => node.style.setProperty("--vc-item-room-light", ".4"));
    const dim = await toy.screenshot({ path: resolve(output, `material-${mode}-${kind}-dim.png`) });
    const filter = await art.evaluate(node => getComputedStyle(node).filter);
    expect(filter).toContain("brightness(0.4)");
    expect(filter).toContain("saturate(1.2)");
    expect(filter).toContain("contrast(1.06)");
    const pixels = async (bytes: Buffer) => (await sharp(bytes).removeAlpha().raw().toBuffer());
    const before = await pixels(bright), after = await pixels(dim);
    expect(after.length).toBe(before.length);
    let darkened = 0, lightened = 0;
    for (let i = 0; i < before.length; i += 3) {
      const delta = before[i] + before[i + 1] + before[i + 2] - after[i] - after[i + 1] - after[i + 2];
      if (delta > 60) darkened++;
      if (delta < -30) lightened++;
    }
    expect(darkened).toBeGreaterThan(30);
    expect(lightened).toBe(0);
    await toy.evaluate(node => node.style.setProperty("--vc-item-room-light", "1"));
    expect(await art.evaluate(node => getComputedStyle(node).filter)).toContain("brightness(1)");
  }
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`toy mechanics all 84 ${reduced ? "reduced" : "normal"}: upright axes and planted controls`, async ({ page, context, baseURL }) => {
  const rejected: string[] = [], errors: string[] = [], origin = new URL(baseURL!).origin;
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => {
    const r = route.request(), url = new URL(r.url());
    if (url.origin !== origin) return route.abort();
    if (!["GET", "HEAD"].includes(r.method()) || url.pathname.startsWith("/api/")) { rejected.push(r.method() + " " + url.pathname); return route.abort(); }
    return route.continue();
  });
  await page.goto(`/visual-fixture/toy-motion?reduced=${reduced ? 1 : 0}`);
  await expect(page.locator(".vc-toy")).toHaveCount(84);
  await expect(page.locator("[data-motion-ready=true]")).toHaveCount(1);
  await expect.poll(() => page.locator(".vc-toy img").evaluateAll(images => images.filter(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0).length)).toBe(84);
  const observations = await page.evaluate(async () => {
    type Frame = { kind: string; progress: number; x: number; y: number; width: number; height: number; transform: string; pixelHash?: string; alphaHash?: string; shaftHash?: string; alphaPixels?: number; angle?: number };
    const frames: Frame[][] = []; let last = 0;
    const hash = (pixels: Uint8ClampedArray, filter: (i: number) => boolean = () => true) => {
      let value = 2166136261;
      for (let i = 0; i < pixels.length; i++) if (filter(i)) value = Math.imul(value ^ pixels[i], 16777619);
      return (value >>> 0).toString(16);
    };
    await new Promise<void>(done => {
      const start = performance.now(), tick = (now: number) => {
        if (now - last > 60) {
          last = now;
          frames.push([...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => {
            const r = node.getBoundingClientRect(), image = node.querySelector<HTMLImageElement>("img")!, c = node.querySelector<HTMLCanvasElement>("canvas");
            const context = c?.getContext("2d"), pixels = context?.getImageData(0, 0, c!.width, c!.height).data;
            const imageRect = image.getBoundingClientRect();
            return { kind: node.dataset.kind!, progress: Number(node.dataset.progress), x: r.left + r.width / 2, y: r.bottom, width: imageRect.width, height: imageRect.height, transform: node.style.transform,
              ...(pixels ? { pixelHash: hash(pixels), alphaHash: hash(pixels, i => i % 4 === 3), shaftHash: hash(pixels, i => i >= Math.floor(c!.height * .82) * c!.width * 4), alphaPixels: pixels.filter((v, i) => i % 4 === 3 && v > 0).length, angle: Number(c!.dataset.motionAngle) } : {}) };
          }));
        }
        if (now - start < 4900) requestAnimationFrame(tick); else done();
      }; requestAnimationFrame(tick);
    }); return frames;
  });
  mkdirSync(output, { recursive: true });
  const file = resolve(output, `${reduced ? "reduced" : "normal"}.json`);
  writeFileSync(file, JSON.stringify({ scope: "Actual normal-speed mechanical-art fixture, all84, production sampler/painter/assets/CSS. Not autonomous AI or discovery proof.", observations, errors, rejected }));
  await test.info().attach("axis-native-pixels", { path: file, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, `${reduced ? "reduced" : "normal"}-all84.png`), fullPage: true });
  expect(errors).toEqual([]); expect(rejected).toEqual([]);
  for (const kind of ["spinning-top", "battle-top-launcher", "pinwheel"]) {
    const frames = observations.flatMap(frame => frame.filter(item => item.kind === kind && item.progress > .25 && item.progress < .75));
    expect(frames.length).toBeGreaterThan(12); expect(frames.every(frame => (frame.alphaPixels ?? 0) > 150)).toBe(true);
    expect(Math.max(...frames.map(frame => frame.x)) - Math.min(...frames.map(frame => frame.x))).toBeLessThan(.01);
    expect(Math.max(...frames.map(frame => frame.y)) - Math.min(...frames.map(frame => frame.y))).toBeLessThan(.01);
    expect(frames.every(frame => !frame.transform.includes("rotate"))).toBe(true);
    const first = frames[0];
    if (reduced) expect(frames.every(frame => frame.pixelHash === first.pixelHash)).toBe(true);
    else expect(frames.some(frame => frame.pixelHash !== first.pixelHash)).toBe(true);
    if (kind === "spinning-top" || kind === "battle-top-launcher") for (const frame of frames) {
      expect(frame.alphaHash).toBe(first.alphaHash);
    }
    if (kind === "pinwheel") {
      // The lower shaft is a static original-image region, never a rotor.
      expect(frames.every(frame => frame.shaftHash === first.shaftHash)).toBe(true);
    }
  }
  const grounded = ["gear-board", "capsule-machine", "loop-race-track", "wooden-bowling", "mini-tuho", "jigsaw-puzzle", "shape-sorter", "mini-dollhouse", "modeling-clay-tub", "stud-brick-castle", "toy-drum", "xylophone"];
  for (const kind of grounded) {
    const rows = observations.flatMap(frame => frame.filter(item => item.kind === kind && item.progress > .25 && item.progress < .75));
    expect(Math.max(...rows.map(frame => frame.x)) - Math.min(...rows.map(frame => frame.x))).toBeLessThan(.01);
    expect(Math.max(...rows.map(frame => frame.y)) - Math.min(...rows.map(frame => frame.y))).toBeLessThan(.01);
    expect(Math.max(...rows.map(frame => frame.width)) - Math.min(...rows.map(frame => frame.width))).toBeLessThan(.01);
  }
});
