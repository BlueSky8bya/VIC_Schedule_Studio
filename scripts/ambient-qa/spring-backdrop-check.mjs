// Spring release: responsive edges, cache stability, weather and mobile fetch gate.
// Requires an already running production fixture server; never rebuilds it.
import fs from "node:fs";
import path from "node:path";
import { launch, newPage, openFixture, fixtureUrl, captureCanvas, advance } from "./lib.mjs";
const out = process.argv[2] ?? ".scratch-pw/qa/r20-spring/responsive";
fs.mkdirSync(out, { recursive: true });
const report = { build: fs.readFileSync(".next/BUILD_ID", "utf8").trim(), checks: [], frames: [], errors: [] };
const check = (name, ok, evidence) => { report.checks.push({ name, ok: !!ok, evidence }); console.log(`${ok ? "PASS" : "FAIL"} ${name}`); };
const url = (band = "noon", weather = "clear", extra = {}) => fixtureUrl({ biome: "meadow", season: "spring", band, weather, seed: 42 }, { gfx: "max", reduced: 0, y: 2026, day: 15, ...extra });
const detail = page => page.evaluate(() => {
  const c = document.querySelector("canvas.gs-season"), g = c.getContext("2d");
  const edges = [g.getImageData(0, 0, c.width, 1), g.getImageData(0, c.height - 1, c.width, 1), g.getImageData(0, 0, 1, c.height), g.getImageData(c.width - 1, 0, 1, c.height)];
  return { scene: window.__vicAmbient.scene(), alpha: edges.every(e => { for (let i = 3; i < e.data.length; i += 4) if (e.data[i] !== 255) return false; return true; }) };
});
const browser = await launch();
try {
  const { ctx, page, errors } = await newPage(browser);
  for (const [w, h] of [[1400, 860], [1024, 768], [1920, 1080], [3440, 1440], [5120, 1440], [1080, 1920], [1440, 1440], [641, 1100], [3840, 2160]]) {
    await page.setViewportSize({ width: w, height: h });
    await openFixture(page, url());
    const before = await detail(page);
    for (const p of [{ x: 0, y: 0 }, { x: w, y: h }]) {
      await page.evaluate(p => window.__vicAmbient.forcePointer(p), p); await advance(page, 500);
      check(`${w}x${h} pointer ${p.x} opaque edges`, (await detail(page)).alpha);
    }
    const after = await detail(page), image = await captureCanvas(page);
    fs.writeFileSync(path.join(out, `${w}x${h}.png`), image.png);
    check(`${w}x${h} backdrop ready/no pointer rebake/bounded`, after.scene.backdrop?.ready && before.scene.backdrop.bakes === after.scene.backdrop.bakes && after.scene.backdrop.bytes <= 2.1 * 1024 * 1024, after.scene.backdrop);
    report.frames.push({ file: `${w}x${h}.png`, hash: image.hash, ...after });
  }
  await page.setViewportSize({ width: 1400, height: 860 });
  const hashes = new Set();
  for (const [band, weather] of [["morning", "clear"], ["dusk", "clear"], ["night", "clear"], ["noon", "rain"], ["noon", "fog"], ["noon", "wind"]]) {
    await openFixture(page, url(band, weather)); await advance(page, 1000);
    const image = await captureCanvas(page); hashes.add(image.hash);
    const file = `${band}-${weather}.png`; fs.writeFileSync(path.join(out, file), image.png);
    report.frames.push({ file, hash: image.hash, ...(await detail(page)) });
  }
  check("six time/weather views differ", hashes.size === 6);
  for (const extra of [{ camera: "plain" }, { reduced: 1 }, { gfx: "lite" }]) {
    await openFixture(page, url("noon", "clear", extra));
    check(`mode ${JSON.stringify(extra)} ready`, (await detail(page)).scene.backdrop?.ready);
  }
  report.errors.push(...errors); await ctx.close();
  for (const [w, h, touch] of [[390, 844, true], [844, 390, true], [640, 1000, false]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch });
    const p = await context.newPage(), requests = [];
    p.on("request", r => { if (r.url().includes("backdrop-meadow")) requests.push(r.url()); });
    await p.goto(url()); await p.waitForTimeout(700);
    check(`mobile ${w}x${h} no backdrop or engine`, requests.length === 0 && !(await p.evaluate(() => !!window.__vicAmbient)), requests);
    await context.close();
  }
  check("no browser exceptions", report.errors.length === 0, report.errors);
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(report, null, 2));
}
if (report.checks.some(c => !c.ok)) process.exitCode = 1;
