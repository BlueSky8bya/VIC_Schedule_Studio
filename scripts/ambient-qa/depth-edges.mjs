// Runtime spatial gates. Requires an existing production fixture server; never starts/rebuilds it.
// node scripts/ambient-qa/depth-edges.mjs --base http://127.0.0.1:3100 --build build2
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE, parseArgs, fixtureUrl, openFixture, advance, assertServer, captureCanvas, gitInfo } from "./lib.mjs";

const args = parseArgs();
const base = String(args.base ?? BASE);
const out = String(args.out ?? ".scratch-pw/qa/r18-depth/edges");
const selected = new Set(String(args.only ?? "large,pan,input,mobile").split(","));
fs.mkdirSync(out, { recursive: true });
const report = { build: args.build ?? null, base, source: gitInfo(), started: new Date().toISOString(), checks: [], errors: [],
  limitations: ["Mobile checks use Chromium emulation, not physical devices.", "Memory gate counts depth pool, transition panel and foreground only; excludes existing scene sources, decode and GPU copies.", "Alpha checks read raw canvas edges, not page-composited screenshots."] };
const save = () => fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(report, null, 2) + "\n");
const check = (name, ok, evidence = {}) => { report.checks.push({ name, ok: !!ok, evidence }); console.log(`${ok ? "PASS" : "FAIL"} ${name}`); save(); };
const run = async (name, fn) => { try { await fn(); } catch (error) { check(name, false, { error: String(error) }); } };
const url = (biome, more = {}) => fixtureUrl({ biome, season: "spring", band: "noon", weather: "clear", seed: 42 },
  { gfx: "max", load: 1, camera: "showcase", t: 0, y: 2026, m: 4, day: 15, ...more }, base);
const detail = page => page.evaluate(() => window.__vicAmbient.scene());
const centered = d => d && Object.values(d).every(p => p.x === 0 && p.y === 0);
const allocated = c => c.bytes + (c.panelBytes ?? 0) + (c.foregroundBytes ?? 0);
const edgeAlpha = page => page.evaluate(() => {
  const c = document.querySelector("canvas.gs-season"), g = c.getContext("2d");
  const strips = [g.getImageData(0, 0, c.width, 1), g.getImageData(0, c.height - 1, c.width, 1),
    g.getImageData(0, 0, 1, c.height), g.getImageData(c.width - 1, 0, 1, c.height)];
  return strips.map(s => { let gaps = 0, min = 255; for (let i = 3; i < s.data.length; i += 4) { min = Math.min(min, s.data[i]); if (s.data[i] < 255) gaps++; } return { gaps, min }; });
});
const snapshot = async (page, name) => {
  const image = await captureCanvas(page);
  fs.writeFileSync(path.join(out, name + ".png"), image.png);
  return { image: name + ".png", hash: image.hash, scene: await detail(page), alpha: await edgeAlpha(page) };
};
await assertServer(base);
const browser = await chromium.launch({ headless: true });
report.browser = browser.version();
const newContext = async opts => {
  const context = await browser.newContext(opts);
  context.on("page", page => page.on("pageerror", e => report.errors.push(String(e))));
  return context;
};
try {
  const large = await newContext({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1.5 });
  try {
    const page = await large.newPage();
    for (const biome of selected.has("large") ? ["mountain", "pond", "sea", "deep"] : []) await run("4K " + biome, async () => {
      await openFixture(page, url(biome));
      await advance(page, 250);
      const origin = await edgeAlpha(page);
      const initial = (await detail(page)).depthCache;
      for (const p of [{ x: 0, y: 0 }, { x: 3840, y: 2160 }, { x: 1920, y: 1080 }]) {
        await page.evaluate(p => window.__vicAmbient.forcePointer(p), p);
        await advance(page, 250);
      }
      const end = await snapshot(page, "4k-" + biome);
      check(biome + " 4K pointer does not rebake", initial.bakes === end.scene.depthCache.bakes, { initial, final: end.scene.depthCache });
      check(biome + " depth allocations <80MiB", allocated(end.scene.depthCache) < 80 * 1024 * 1024, end.scene.depthCache);
      check(biome + " raw edges opaque", origin.every(e => e.gaps === 0) && end.alpha.every(e => e.gaps === 0), { origin, after: end.alpha });
    });
  } finally { await large.close(); }

  const desktop = await newContext({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1 });
  try {
    const page = await desktop.newPage();
    for (const [from, to, axis] of selected.has("pan") ? [["meadow", "forest", "horizontal"], ["sea", "deep", "vertical"]] : []) await run(axis + " pan", async () => {
      await openFixture(page, url(from));
      await page.evaluate(() => window.__vicAmbient.forcePointer({ x: 1400, y: 860 }));
      await advance(page, 500);
      const accepted = await page.evaluate(to => window.__vicAmbient.goTo(to), to);
      await page.evaluate(() => window.__vicAmbient.ready());
      await advance(page, 0);
      await advance(page, 300);
      const middle = await snapshot(page, axis + "-middle");
      await advance(page, 400);
      const end = await snapshot(page, axis + "-end");
      check(axis + " arrives", accepted && end.scene.biome === to && !end.scene.moving, { middle: middle.scene, end: end.scene });
      check(axis + " pan depth memory <80MiB", allocated(middle.scene.depthCache) < 80 * 1024 * 1024 && allocated(end.scene.depthCache) < 80 * 1024 * 1024, { middle: middle.scene.depthCache, end: end.scene.depthCache });
      check(axis + " pan raw edges opaque", middle.alpha.every(e => e.gaps === 0) && end.alpha.every(e => e.gaps === 0), { middle: middle.alpha, end: end.alpha });
    });
    if (selected.has("input")) await run("pointer semantics and zoom", async () => {
      await openFixture(page, url("pond"));
      await advance(page, 250);
      check("no mouse starts centered", centered((await detail(page)).depth));
      await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointermove", { pointerType: "touch", clientX: 0, clientY: 0 })));
      await advance(page, 500);
      check("touch does not drive depth", centered((await detail(page)).depth));
      await page.mouse.move(1390, 850);
      await advance(page, 1000);
      check("desktop mouse drives depth", !centered((await detail(page)).depth));
      await page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerleave")));
      await advance(page, 1500);
      check("pointer leave returns center", centered((await detail(page)).depth));
      await page.evaluate(() => {
        document.querySelector("canvas.gs-season").style.zoom = "0.8";
        document.documentElement.style.overflow = "auto";
        document.body.style.height = "3000px";
        window.dispatchEvent(new Event("resize"));
        window.scrollTo(0, 160);
      });
      await advance(page, 0);
      const expected = await page.evaluate(() => {
        const c = document.querySelector("canvas.gs-season"), r = c.getBoundingClientRect();
        window.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", clientX: r.left + r.width * .75, clientY: r.top + r.height * .3 }));
        return { x: -.5 * 8 * Math.min(1, c.offsetWidth / 1400), y: .4 * 2 * Math.min(1, c.offsetWidth / 1400),
          rect: { x: r.x, y: r.y, width: r.width, height: r.height }, offsetWidth: c.offsetWidth, scrollY };
      });
      await advance(page, 1500);
      const got = (await detail(page)).depth.ground;
      check("zoom .8 + scroll pointer pose", Math.abs(got.x - expected.x) <= 1 && Math.abs(got.y - expected.y) <= 1, { expected, got });
      const hit = await page.evaluate(() => {
        const a = window.__vicAmbient, s = a.scene(), c = document.querySelector("canvas.gs-season"), r = c.getBoundingClientRect();
        if (!s.duck) return { available: false };
        const zoom = r.width / c.offsetWidth;
        const x = r.left + (s.duck.x + s.depth.ground.x) * zoom, y = r.top + (s.duck.y + s.depth.ground.y) * zoom;
        const before = a.consumed;
        // Real input is intentionally ignored by a frozen engine. Open and close the
        // gate synchronously, without yielding to any RAF or changing simulation time.
        a.freeze(false);
        window.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", button: 0, clientX: x, clientY: y }));
        const after = a.consumed;
        window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "mouse", button: 0, clientX: x, clientY: y }));
        a.freeze(true);
        return { available: true, before, after, duck: s.duck, x, y };
      });
      check("zoom + scroll actual duck hit", hit.available && hit.after > hit.before, hit);
      await snapshot(page, "zoom-pond");
    });
  } finally { await desktop.close(); }

  for (const item of selected.has("mobile") ? [
    { name: "desktop1024", viewport: { width: 1024, height: 768 }, mobile: false },
    { name: "desktop641", viewport: { width: 641, height: 800 }, mobile: false },
    { name: "width640", viewport: { width: 640, height: 800 }, mobile: true },
    { name: "portrait", viewport: { width: 390, height: 844 }, mobile: true, touch: true },
    { name: "landscape", viewport: { width: 844, height: 390 }, mobile: true, touch: true }
  ] : []) await run(item.name, async () => {
    const context = await newContext({ viewport: item.viewport, deviceScaleFactor: 1, isMobile: !!item.touch, hasTouch: !!item.touch });
    try {
      const page = await context.newPage(), images = [];
      page.on("request", req => { if (req.resourceType() === "image") images.push(req.url()); });
      if (item.mobile) {
        await page.goto(url("meadow"), { waitUntil: "networkidle" });
        const evidence = await page.evaluate(() => ({ mounted: !!window.__vicAmbient, display: getComputedStyle(document.querySelector("canvas.gs-season")).display,
          mobile: matchMedia("(max-width: 640px), (max-height: 640px) and (pointer: coarse)").matches,
          showcase: document.documentElement.hasAttribute("data-showcase") }));
        check(item.name + " no engine or image requests", evidence.mobile && !evidence.mounted && evidence.display === "none" && !evidence.showcase && images.length === 0, { ...evidence, images });
      } else {
        await openFixture(page, url("meadow"));
        await advance(page, 1000);
        const evidence = await detail(page);
        check(item.name + " background centered without pointer", centered(evidence.depth));
      }
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
  check("browser errors", report.errors.length === 0, report.errors);
  report.finished = new Date().toISOString(); save();
}
if (report.checks.some(c => !c.ok)) process.exitCode = 1;
