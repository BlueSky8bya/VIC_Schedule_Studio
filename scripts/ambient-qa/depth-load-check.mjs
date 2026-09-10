// Synthetic contention/runtime gates. Run alone against the intended production fixture build.
// This simulates blocked browser callbacks, not OBS, whole-PC load or GPU pressure.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { BASE, VIEWPORT, parseArgs, fixtureUrl, openFixture, assertServer, gitInfo } from "./lib.mjs";

const args = parseArgs();
const base = String(args.base ?? BASE);
const strain = Number(args.strain ?? 35);
const modes = String(args.modes ?? "auto,max,lite").split(",");
if (modes.some((mode) => !["auto", "max", "lite"].includes(mode))) throw new Error("Invalid --modes");
if (!(strain >= 25 && strain <= 100)) throw new Error("--strain must be 25..100ms");
const output = path.join(".scratch-pw", "qa", "r18-depth", `load-${String(args.phase ?? "after")}.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
await assertServer(base);
const report = { at: new Date().toISOString(), source: gitInfo(), build: args.build ?? null, strainMs: strain, viewport: VIEWPORT, limitations: ["Synthetic main-thread busy work before real RAF callbacks; no OS application or GPU load claim.", "Fixture applies the requested graphics preference; this checks auto/max/lite behavior, not the public route's first-visit storage initialization.", "Total RAF counts include fixture UI callbacks; engine frame/time counters are recorded separately."], checks: [], details: {} };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}`); };
const browser = await chromium.launch({ headless: !args.headful });
try {
  report.browser = browser.version();
  for (const mode of modes) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.addInitScript(({ mode, strain }) => {
        localStorage.clear();
        localStorage.setItem("vic.settingsEpoch", "2026-09-04");
        localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
        if (mode !== "auto") localStorage.setItem("vic.gfxPref", mode);
        localStorage.setItem("vic.ambient", "on");
        const original = window.requestAnimationFrame.bind(window);
        window.__depthStrain = { on: false, callbacks: 0, busyCallbacks: 0 };
        window.requestAnimationFrame = (callback) => original((now) => {
          const s = window.__depthStrain;
          s.callbacks++;
          if (s.on) { s.busyCallbacks++; const until = performance.now() + strain; while (performance.now() < until) { /* Controlled synthetic contention. */ } }
          callback(now);
        });
      }, { mode, strain });
      const url = fixtureUrl({ biome: "meadow", season: "spring", band: "morning", weather: "clear", seed: 42 }, { gfx: mode, load: "auto", t: 1500 }, base);
      await openFixture(page, url);
      const read = () => page.evaluate(() => {
        const a = window.__vicAmbient, d = a?.scene();
        return { t: a?.time(), running: a?.running, frames: a?.frames, load: a?.load, q: a?.q, tier: d?.depthTier, cache: d?.depthCache, perf: d?.perf, callbacks: window.__depthStrain.callbacks, busyCallbacks: window.__depthStrain.busyCallbacks, gfxPref: localStorage.getItem("vic.gfxPref"), mounted: !!a };
      });
      const pixels = () => page.evaluate(() => document.querySelector("canvas.gs-season")?.toDataURL() ?? null);
      const wait = (fn, timeout = 35000) => page.waitForFunction(fn, null, { polling: 100, timeout });
      await page.evaluate(() => { window.__vicAmbient.forceLoad(null); window.__vicAmbient.freeze(false); });
      await page.waitForTimeout(2000);
      const before = await read();
      check(`${mode}: requested preference`, (before.gfxPref ?? "auto") === mode, before);
      await page.evaluate(() => { window.__depthStrain.on = true; });
      if (mode === "max") {
        await page.waitForTimeout(5000);
        const after = await read();
        check("max: strain keeps full/load1", after.tier === "full" && after.load === 1 && after.running, after);
        report.details.max = { url, before, strained: after, errors };
      } else {
        await wait(() => window.__vicAmbient.scene().depthTier === "still" && !window.__vicAmbient.running);
        const stopped = await read(), firstPixels = await pixels();
        await page.waitForTimeout(1200);
        const stable = await read(), secondPixels = await pixels();
        check(`${mode}: sustained strain reaches still`, stopped.tier === "still" && !stopped.running, stopped);
        check(`${mode}: still has zero time/frame/RAF advance`, stopped.t === stable.t && stopped.frames === stable.frames && stopped.callbacks === stable.callbacks, { stopped, stable });
        check(`${mode}: still cache stable`, JSON.stringify(stopped.cache) === JSON.stringify(stable.cache), { pixelsDuringBoundedRetriesEqual: firstPixels === secondPixels, cacheBefore: stopped.cache, cacheAfter: stable.cache });
        // Bounded dt=0 retries may finish state initialization at 250/900/2400ms.
        // Pixel stability is checked after that documented window, without relaxing time/RAF checks above.
        await page.waitForTimeout(1600);
        const settledPixels = await pixels();
        await page.waitForTimeout(1100);
        check(`${mode}: settled still pixels stable`, settledPixels === await pixels(), null);
        await page.evaluate(() => { window.__depthStrain.on = false; });
        const probeBefore = stable.perf.probeCount;
        await page.mouse.click(700, 430);
        await wait(() => window.__vicAmbient.scene().perf.probeCount > 0 && !window.__vicAmbient.scene().perf.probing, 10000);
        const recovered = await read();
        const callbacks = recovered.perf.probeCount - probeBefore;
        check(`${mode}: mouse input runs bounded recovery probe`, callbacks > 0 && callbacks <= 90, { callbacks, recovered });
        check(`${mode}: healthy probe resumes lite`, recovered.running && recovered.tier === "lite", recovered);
        if (mode === "lite") {
          await page.waitForTimeout(2000);
          const capped = await read();
          check("lite: never promotes to full", capped.tier !== "full" && capped.load === .3, capped);
        }
        report.details[mode] = { url, before, stopped, stable, recovered, errors };
      }
      await page.evaluate(() => { window.__depthStrain.on = false; });
      if (mode === "max") {
        for (const gate of ["plain", "reduced"]) {
          await page.evaluate((gate) => {
            const root = document.documentElement;
            if (gate === "plain") root.removeAttribute("data-showcase"); else root.setAttribute("data-reduce-motion", "1");
          }, gate);
          await wait(() => !window.__vicAmbient.running, 5000);
          await page.waitForTimeout(2700); // Let bounded late-asset still retries complete.
          const first = await read(), firstPixels = await pixels();
          await page.waitForTimeout(1100);
          const last = await read();
          check(`${gate}: no simulation or RAF`, first.t === last.t && first.frames === last.frames && first.callbacks === last.callbacks && !last.running, { first, last });
          check(`${gate}: stable rendered frame`, firstPixels === await pixels(), null);
          await page.evaluate((gate) => {
            const root = document.documentElement;
            if (gate === "plain") root.setAttribute("data-showcase", "1"); else root.removeAttribute("data-reduce-motion");
          }, gate);
          await wait(() => window.__vicAmbient.running, 5000);
          await page.waitForTimeout(200);
          const resumed = await read();
          check(`${gate}: returning resumes`, resumed.t > last.t && resumed.running, resumed);
        }
        await page.setViewportSize({ width: 360, height: 800 });
        await wait(() => !window.__vicAmbient, 5000);
        await page.waitForTimeout(100);
        const mobileBefore = await read();
        await page.waitForTimeout(1000);
        const mobileAfter = await read();
        const hidden = await page.locator("canvas.gs-season").evaluate((c) => getComputedStyle(c).display === "none");
        check("mobile resize: engine disposed/hidden/no RAF", !mobileAfter.mounted && hidden && mobileBefore.callbacks === mobileAfter.callbacks, { mobileBefore, mobileAfter, hidden });
      }
      check(`${mode}: no page exceptions`, errors.length === 0, errors);
    } catch (error) { check(`${mode}: scenario completed`, false, String(error)); }
    finally { await context.close(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n"); }
  }
} finally { await browser.close(); }
report.passed = report.checks.filter((x) => x.ok).length;
report.failed = report.checks.length - report.passed;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Saved ${output}: ${report.passed} passed, ${report.failed} failed`);
if (report.failed) process.exitCode = 1;
