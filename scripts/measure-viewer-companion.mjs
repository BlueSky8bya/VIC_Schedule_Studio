/* Local experiment, not a cross-machine benchmark or an OBS/GPU claim.
 * Run only against an already-built production fixture. No server lifecycle.
 * The5s CPU windows contain no rAF heartbeat, DOM polling or native API spies. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";

const baseURL = process.env.COMPANION_FIXTURE_URL || "http://127.0.0.1:3100";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)) throw new Error("Use a local production fixture, never a real public calendar");
const sampleMs = 5000;
const modes = ["off", "awake", "passive"];
const samples = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const metrics = result => Object.fromEntries(result.metrics.map(metric => [metric.name, metric.value]));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (let round = 0; round < 3; round++) {
      // Rotate order to reduce one-direction warmup/drift bias. Each condition
      // uses a fresh context, then waits for its finite initial layout work.
      for (let slot = 0; slot < modes.length; slot++) {
        const mode = modes[(slot + round) % modes.length];
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
        const posts = [];
        await context.route("**/*", route => {
          if (route.request().method() === "POST") { posts.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
          return route.continue();
        });
        await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
        const page = await context.newPage();
        await page.addInitScript(mode => {
          localStorage.setItem("vic.settingsEpoch", "2026-09-04");
          localStorage.setItem("vic.gfxPref", "max");
          localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
          localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
          localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: mode !== "off", roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false, drag: true, petting: true, feeding: false, animalMode: "default", speed: "normal", size: "normal", personality: "curious" }));
          localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, hunger: .58, affection: .3, curiosity: .6, energy: .8 }));
          Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
        }, mode);
        await page.goto(`${baseURL}/visual-fixture/poster`);
        await page.evaluate(() => document.fonts.ready);
        if (mode !== "off") await page.locator('.vc-companion[data-presence="active"]').waitFor();
        await sleep(3000);
        if (mode === "passive") {
          await page.evaluate(() => {
            Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
            dispatchEvent(new FocusEvent("blur"));
          });
          await page.locator('.vc-companion[data-presence="parked"]').waitFor({ timeout: 12000 });
          await sleep(500); // finish the final care commit before sampling
        }
        const stateBefore = await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus(), presence: document.querySelector(".vc-companion")?.getAttribute("data-presence") ?? "off" }));
        if (stateBefore.hidden || mode === "passive" && stateBefore.presence !== "parked") throw new Error("condition not ready");
        const session = await context.newCDPSession(page);
        await session.send("Performance.enable", { timeDomain: "timeTicks" });
        const before = metrics(await session.send("Performance.getMetrics"));
        const nodeStart = performance.now();
        await sleep(sampleMs);
        const after = metrics(await session.send("Performance.getMetrics"));
        const nodeElapsedMs = performance.now() - nodeStart;
        const elapsedSeconds = after.Timestamp - before.Timestamp;
        const delta = name => (after[name] ?? 0) - (before[name] ?? 0);
        const sample = {
          round: round + 1, mode, elapsedSeconds, nodeElapsedMs, stateBefore,
          rendererTaskPercent: delta("TaskDuration") / elapsedSeconds * 100,
          scriptMsPerSecond: delta("ScriptDuration") * 1000 / elapsedSeconds,
          layoutMsPerSecond: delta("LayoutDuration") * 1000 / elapsedSeconds,
          styleMsPerSecond: delta("RecalcStyleDuration") * 1000 / elapsedSeconds,
          layouts: delta("LayoutCount"), styleRecalculations: delta("RecalcStyleCount"),
          heapDeltaBytes: delta("JSHeapUsedSize"), postRequests: posts.length,
        };
        if (posts.length) throw new Error(`blocked unexpected POSTs: ${posts.length}`);
        samples.push(sample);
        console.log(JSON.stringify(sample));
        await context.close();
      }
    }
    const summaries = modes.map(mode => {
      const group = samples.filter(sample => sample.mode === mode);
      return { mode, medianRendererTaskPercent: median(group.map(sample => sample.rendererTaskPercent)), medianScriptMsPerSecond: median(group.map(sample => sample.scriptMsPerSecond)), medianLayoutMsPerSecond: median(group.map(sample => sample.layoutMsPerSecond)), medianStyleMsPerSecond: median(group.map(sample => sample.styleMsPerSecond)) };
    });
    const report = {
      environment: { browser: browser.version(), platform: process.platform, cpu: os.cpus()[0]?.model, headless: true, fixtureURL: baseURL, sampleMs, rounds: 3 },
      limits: "Synthetic focus-event branch; renderer task wall-time fractions only. Headless software graphics, not total CPU/GPU/OBS performance. No hardware streaming claim, confidence interval or leak proof.",
      samples, summaries,
    };
    await fs.mkdir(".scratch-pw", { recursive: true });
    await fs.writeFile(".scratch-pw/companion-passive-metrics.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ summaries }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
