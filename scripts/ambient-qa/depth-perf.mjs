// Real-time fixture profiling. Example: --phase before --modes max --seconds 30
// --cpu 4 applies CDP CPU throttling; --headful opens Chromium for a visible GPU run.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE, VIEWPORT, parseArgs, fixtureUrl, openFixture, assertServer, gitInfo } from "./lib.mjs";

const args = parseArgs();
const seconds = Number(args.seconds ?? 30);
const cpu = Number(args.cpu ?? 1);
if (!(seconds > 0 && seconds <= 600) || !(cpu >= 1)) throw new Error("Invalid seconds/cpu");
const modes = String(args.modes ?? "max,auto,lite").split(",");
const scenarios = String(args.scenarios ?? "idle,pointer,pan").split(",");
if (modes.some((x) => !["max", "auto", "lite"].includes(x)) || scenarios.some((x) => !["idle", "pointer", "pan"].includes(x))) throw new Error("Invalid modes/scenarios");
const base = String(args.base ?? BASE);
const phase = String(args.phase ?? "after");
const out = path.join(".scratch-pw", "qa", "r18-depth", `perf-${phase}`);
fs.mkdirSync(out, { recursive: true });
await assertServer(base);
const results = { createdAt: new Date().toISOString(), source: gitInfo(), buildLabel: args.build ?? null, viewport: VIEWPORT, seconds, cpu, headful: !!args.headful, measurements: [], limitations: ["RAF gaps describe browser scheduling, not GPU execution time.", "Canvas bytes estimate RGBA backing storage of live WeakRef-tracked HTML canvases; GC timing affects counts; excludes OffscreenCanvas, decoded images, GPU duplication.", "Canvas instrumentation adds overhead equally to before and after.", "Debug perf is unavailable on builds that do not expose it."] };
const browser = await chromium.launch({ headless: !args.headful });
try {
  results.browser = browser.version();
  for (const mode of modes) for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.addInitScript(({ mode }) => {
        localStorage.clear();
        localStorage.setItem("vic.settingsEpoch", "2026-09-04");
        localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
        localStorage.setItem("vic.gfxPref", mode);
        localStorage.setItem("vic.ambient", "on");
        const refs = [];
        let created = 0, draws = 0;
        const create = Document.prototype.createElement;
        Document.prototype.createElement = function (...a) {
          const el = create.apply(this, a);
          if (el instanceof HTMLCanvasElement) { refs.push(new WeakRef(el)); created++; }
          return el;
        };
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (...a) { draws++; return draw.apply(this, a); };
        window.__depthPerf = () => {
          let live = 0, bytes = 0;
          for (const r of refs) { const c = r.deref(); if (c) { live++; bytes += c.width * c.height * 4; } }
          return { created, draws, live, estimatedRgbaBytes: bytes };
        };
      }, { mode });
      const cdp = await context.newCDPSession(page);
      if (cpu !== 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      const url = fixtureUrl({ biome: "meadow", season: "spring", band: "morning", weather: "clear", seed: 42 }, { gfx: mode, load: "auto", t: 1500 }, base);
      await openFixture(page, url);
      // forceLoad(null) also clears the baseline fixture's forced load=1.
      await page.evaluate((mode) => {
        localStorage.setItem("vic.gfxPref", mode);
        document.documentElement.setAttribute("data-gfx", mode === "lite" ? "lite" : "full");
        window.dispatchEvent(new Event("vic:gfx-pref"));
        window.__vicAmbient.forceLoad(null);
        window.__vicAmbient.freeze(false);
      }, mode);
      // Warm-up is separate from the measured interval.
      await page.waitForTimeout(2000);
      const measurement = await page.evaluate(async ({ seconds, scenario }) => {
        const a = window.__vicAmbient;
        const snapshot = () => {
          const scene = a.scene();
          return { instrumentation: window.__depthPerf(), engine: { frames: a.frames, load: a.load, q: a.q, running: a.running, t: a.time(), scene, perf: scene.perf ?? (typeof a.perf === "function" ? a.perf() : a.perf ?? null) } };
        };
        const before = snapshot();
        const gaps = [], states = [];
        let prev = 0, begin = 0, lastNav = -3000, navAttempts = 0, navAccepted = 0, lastState = -1000;
        await new Promise((resolve) => {
          const tick = (now) => {
            if (!begin) begin = now;
            if (prev) gaps.push(now - prev);
            prev = now;
            const elapsed = now - begin;
            if (scenario === "pointer") {
              window.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", clientX: 700 + Math.sin(elapsed / 1300) * 650, clientY: 430 + Math.sin(elapsed / 1900) * 370, bubbles: true }));
            }
            if (scenario === "pan" && elapsed - lastNav >= 2500) {
              lastNav = elapsed; navAttempts++;
              if (a.goTo(a.biome() === "meadow" ? "forest" : "meadow")) navAccepted++;
            }
            if (elapsed - lastState >= 1000) { lastState = elapsed; states.push({ ms: elapsed, load: a.load, q: a.q, running: a.running, tier: a.scene().depthTier ?? null }); }
            if (elapsed >= seconds * 1000) resolve(); else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const after = snapshot();
        a.freeze(true);
        const sorted = gaps.slice().sort((x, y) => x - y);
        const durationMs = gaps.reduce((x, y) => x + y, 0);
        return { before, after, durationMs, raf: { samples: gaps.length, mean: durationMs / gaps.length, p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1), over34Ratio: gaps.filter((x) => x > 34).length / gaps.length }, drawImageCalls: after.instrumentation.draws - before.instrumentation.draws, newCanvasAllocations: after.instrumentation.created - before.instrumentation.created, navAttempts, navAccepted, states };
      }, { seconds, scenario });
      const row = { mode, scenario, url, ...measurement, errors };
      results.measurements.push(row);
      fs.writeFileSync(path.join(out, `${mode}-${scenario}.json`), JSON.stringify(row, null, 2) + "\n");
      fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(results, null, 2) + "\n");
      console.log(`${phase} ${mode}/${scenario}: mean=${row.raf.mean.toFixed(2)} p95=${row.raf.p95.toFixed(2)} late=${(row.raf.over34Ratio * 100).toFixed(2)}% draws=${row.drawImageCalls} newCanvas=${row.newCanvasAllocations} nav=${row.navAccepted}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(`Saved ${out}`);
