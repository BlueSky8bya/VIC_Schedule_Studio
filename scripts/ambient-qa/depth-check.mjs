// P0 depth contracts against a freshly built, fixture-enabled server. Never starts/rebuilds a server.
// node scripts/ambient-qa/depth-check.mjs --base http://127.0.0.1:3100
// Optional: --only matrix,determinism,seal,still,cache,pan,mobile --out .scratch-pw/qa/r18-depth
// --baseline (matrix only, no new-depth assertions) --build <server-revision-label> --width 1024 --height 768
import fs from "node:fs";
import path from "node:path";
import {
  BASE, BANDS, VIEWPORT, advance, assertServer, captureCanvas, ensureDir, fixtureUrl,
  gitInfo, launch, newPage, nowIso, openFixture, parseArgs, state, writeJson
} from "./lib.mjs";

const args = parseArgs();
const base = String(args.base ?? BASE);
const out = String(args.out ?? ".scratch-pw/qa/r18-depth");
const baseline = args.baseline === true;
const viewport = { width: Number(args.width ?? VIEWPORT.width), height: Number(args.height ?? VIEWPORT.height) };
if (!Object.values(viewport).every(n => Number.isInteger(n) && n > 640 && n <= 4096)) throw new Error("Desktop width/height must be integers in 641..4096");
const suites = ["matrix", "determinism", "seal", "still", "cache", "pan", "mobile"];
const selected = args.only ? String(args.only).split(",") : baseline ? ["matrix"] : suites;
if (selected.some(name => !suites.includes(name))) throw new Error(`Unknown suite: ${selected.join(",")}`);
if (baseline && selected.some(name => name !== "matrix")) throw new Error("--baseline supports only matrix; new behavior gates must run on the new build");
const allBiomes = ["meadow", "forest", "mountain", "hill", "pond", "valley", "tidal", "sandy", "rocky", "sea", "deep"];
const allSeasons = ["spring", "summer", "autumn", "winter"];
const biomes = args.biomes ? String(args.biomes).split(",") : allBiomes;
const seasons = args.seasons ? String(args.seasons).split(",") : allSeasons;
if (biomes.some(b => !allBiomes.includes(b)) || seasons.some(s => !allSeasons.includes(s))) throw new Error("Unknown biome/season filter");
const pointers = [`${viewport.width / 2},${viewport.height / 2}`, "0,0", `${viewport.width},${viewport.height}`];
const report = { started: nowIso(), base, git: gitInfo(), serverBuildLabel: args.build ?? null,
  localBuildId: fs.existsSync(".next/BUILD_ID") ? fs.readFileSync(".next/BUILD_ID", "utf8").trim() : null,
  baseline, viewport, pointers, selected, checks: [], frames: [] };
ensureDir(out);
const save = () => writeJson(path.join(out, "results.json"), report);
const check = (name, ok, evidence = {}) => {
  report.checks.push({ name, ok: !!ok, evidence });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  save();
};
const run = async (name, fn) => {
  try { await fn(); } catch (error) { check(name, false, { error: String(error), stack: error.stack }); }
};
const sc = (biome = "meadow", season = "spring", band = "noon", weather = "clear") => ({ biome, season, band, weather, seed: 42 });
const url = (scenario, overrides = {}) => fixtureUrl(scenario, {
  gfx: "max", reduced: 0, y: 2026, day: 15, pointer: pointers[0], ...overrides
}, base);
const raw = page => page.evaluate(() => window.__vicAmbient.scene());
const zeroDepth = depth => !!depth && ["far", "ground", "frame"].every(k => depth[k]?.x === 0 && depth[k]?.y === 0);
const snapshot = async (page, name, keep = false) => {
  const image = await captureCanvas(page);
  if (keep) fs.writeFileSync(path.join(out, `${name}.png`), image.png);
  const record = { name, hash: image.hash, bytes: image.bytes, state: await state(page), detail: await raw(page), screenshot: keep ? `${name}.png` : null };
  report.frames.push(record);
  return record;
};

await assertServer(base);
const browser = await launch();
const { page, errors } = await newPage(browser);
await page.setViewportSize(viewport);
try {
  if (selected.includes("matrix")) for (const biome of biomes) for (const season of seasons) {
    await run(`matrix ${biome} ${season}`, async () => {
      const frames = [];
      for (let i = 0; i < pointers.length; i++) {
        const scenario = sc(biome, season);
        await openFixture(page, url(scenario, { t: 1500, pointer: pointers[i] }));
        const frame = await snapshot(page, `${biome}-${season}-p${i}`, true);
        frames.push(frame);
        const d = frame.detail.depth;
        check(`${frame.name} ${baseline ? "baseline ready" : "ready and bounded"}`, frame.state.pending === 0 && frame.state.frozen && !frame.state.running
          && Math.abs(frame.state.t - 1.5) < 0.001 && (baseline || (!!d && Math.abs(d.far.x) <= 3 && d.far.y === 0
          && Math.abs(d.ground.x) <= 8 && Math.abs(d.ground.y) <= 2 && Math.abs(d.frame.x) <= 16 && Math.abs(d.frame.y) <= 4)),
        { state: frame.state, depth: d });
      }
      if (!baseline) check(`${biome}-${season} three pointer views differ`, new Set(frames.map(f => f.hash)).size === 3, frames.map(f => ({ hash: f.hash, depth: f.detail.depth })));
    });
  }

  if (selected.includes("determinism")) for (const biome of biomes) {
    await run(`determinism ${biome}`, async () => {
      const scenario = sc(biome, "autumn");
      const over = { pointer: pointers[2], t: 1000 };
      await openFixture(page, url(scenario, over));
      const first = await snapshot(page, `${biome}-url-first`);
      await openFixture(page, url(scenario, over));
      const repeat = await snapshot(page, `${biome}-url-repeat`);
      check(`${biome} repeated URL pixels`, first.hash === repeat.hash, { first: first.hash, repeat: repeat.hash });
      await openFixture(page, url(scenario, { ...over, t: 0 }));
      await advance(page, 1000);
      const whole = await snapshot(page, `${biome}-whole`);
      await openFixture(page, url(scenario, { ...over, t: 0 }));
      for (let i = 0; i < 4; i++) await advance(page, 250);
      const divided = await snapshot(page, `${biome}-divided`);
      check(`${biome} URL = advance(1000) = advance(250)x4`, first.hash === whole.hash && whole.hash === divided.hash,
        { url: first.hash, whole: whole.hash, divided: divided.hash, time: divided.state.t });
    });
  }

  if (selected.includes("seal")) {
    const bandHashes = [];
    for (const band of BANDS) await run(`deep seal ${band}`, async () => {
      const entries = [];
      for (const season of seasons) for (const weather of ["clear", "cloud", "rain", "snow", "fog", "wind"]) {
        await openFixture(page, url(sc("deep", season, band, weather), { t: 1000, pointer: pointers[2] }));
        const frame = await snapshot(page, `deep-seal-${band}-${season}-${weather}`);
        entries.push({ season, weather, hash: frame.hash });
      }
      check(`deep ${band}: ${seasons.length} seasons and six weather states sealed`, new Set(entries.map(e => e.hash)).size === 1, entries);
      bandHashes.push(entries[0]?.hash);
    });
    check("deep six time bands remain distinct", bandHashes.length === 6 && new Set(bandHashes).size === 6, bandHashes);
  }

  if (selected.includes("still")) for (const gate of [{ camera: "plain" }, { reduced: 1 }]) {
    for (const biome of ["meadow", "mountain", "sea", "deep"]) await run(`still ${biome} ${JSON.stringify(gate)}`, async () => {
      await openFixture(page, url(sc(biome), { ...gate, t: 1500, pointer: pointers[2] }));
      const before = await snapshot(page, `${biome}-still-${Object.keys(gate)[0]}-before`, true);
      await page.evaluate(() => window.__vicAmbient.forcePointer({ x: 0, y: 0 }));
      const reached = await advance(page, 2000);
      const after = await snapshot(page, `${biome}-still-${Object.keys(gate)[0]}-after`);
      check(`${biome} ${JSON.stringify(gate)} has no motion`, before.hash === after.hash && reached === 0
        && before.state.settledT === 0 && zeroDepth(after.detail.depth), { before: before.hash, after: after.hash, reached, depth: after.detail.depth });
    });
  }

  if (selected.includes("cache")) for (const biome of biomes) await run(`cache ${biome}`, async () => {
    await openFixture(page, url(sc(biome), { t: 1500 }));
    const before = (await raw(page)).depthCache;
    for (const p of [{ x: 0, y: 0 }, { x: viewport.width, y: viewport.height }, { x: viewport.width / 2, y: viewport.height / 2 }]) {
      await page.evaluate(point => window.__vicAmbient.forcePointer(point), p);
      await advance(page, 1000);
    }
    const after = (await raw(page)).depthCache;
    check(`${biome} pointer causes no extra depth cache bake`, Number.isFinite(before?.bakes) && before.bakes === after?.bakes, { before, after });
    check(`${biome} depth cache bounded`, Number.isFinite(after?.bytes) && after.bytes <= 64 * 1024 * 1024 && after.entries <= 12, after);
  });

  if (selected.includes("pan")) for (const [from, to] of [["meadow", "forest"], ["sandy", "sea"], ["sea", "deep"]]) {
    await run(`pan ${from}-${to}`, async () => {
      await openFixture(page, url(sc(from), { t: 1500, pointer: pointers[2] }));
      await page.evaluate(() => {
        window.__depthDepart = [];
        window.addEventListener("vic:biome-depart", e => window.__depthDepart.push({ ...e.detail, t: window.__vicAmbient.time() }));
      });
      check(`${from}-${to} navigation accepted`, await page.evaluate(target => window.__vicAmbient.goTo(target), to));
      await page.waitForFunction(target => window.__vicAmbient.scene().loaded?.includes(target), to);
      await advance(page, 1000 / 60);
      const started = await raw(page);
      const depart = await page.evaluate(() => window.__depthDepart.at(-1));
      check(`${from}-${to} departure contract`, started.moving === true && depart?.dur === 0.62, { started, depart });
      await advance(page, 600);
      const nearEnd = await snapshot(page, `pan-${from}-${to}-600`, true);
      check(`${from}-${to} still moving at 600ms`, nearEnd.detail.moving === true, { detail: nearEnd.detail, t: nearEnd.state.t });
      await advance(page, 1000 / 30);
      const arrived = await snapshot(page, `pan-${from}-${to}-633`, true);
      check(`${from}-${to} arrives first frame after 620ms`, arrived.detail.moving === false && arrived.state.biome === to,
        { detail: arrived.detail, elapsed: arrived.state.t - (depart?.t ?? NaN) });
    });
  }

  if (selected.includes("mobile")) for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await run(`mobile ${viewport.width}x${viewport.height}`, async () => {
      const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      try {
        const mobile = await context.newPage();
        const assets = [];
        mobile.on("request", request => { if (/\/ambient\/|\/noto\//.test(request.url())) assets.push(request.url()); });
        await mobile.goto(url(sc(), { t: 1500 }), { waitUntil: "networkidle" });
        await mobile.waitForFunction(() => document.documentElement.dataset.biomeFixtureDisabled === "mobile");
        const observed = await mobile.evaluate(() => ({
          engine: !!window.__vicAmbient,
          coarse: matchMedia("(pointer: coarse)").matches,
          canvas: [...document.querySelectorAll("canvas.gs-season")].map(c => ({ width: c.width, height: c.height, display: getComputedStyle(c).display }))
        }));
        check(`mobile ${viewport.width}x${viewport.height}: no engine, initialized canvas, or ambient asset requests`, !observed.engine
          && observed.canvas.every(c => c.width === 300 && c.height === 150 && c.display === "none") && assets.length === 0,
        { ...observed, assets, note: "An inert canvas DOM element may remain; the scene engine and canvas backing allocation must not mount." });
        await mobile.screenshot({ path: path.join(out, `mobile-${viewport.width}x${viewport.height}.png`) });
      } finally { await context.close(); }
    });
  }
  check("desktop page errors absent", errors.length === 0, errors);
} finally {
  await browser.close();
  report.finished = nowIso();
  report.failed = report.checks.filter(c => !c.ok).length;
  report.passed = report.checks.filter(c => c.ok).length;
  save();
}
console.log(`${report.passed} passed, ${report.failed} failed. ${path.join(out, "results.json")}`);
process.exitCode = report.failed ? 1 : 0;
