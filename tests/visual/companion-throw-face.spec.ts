import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { guardCompanionQa } from "./helpers/companion-qa";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

const stage = process.env.COMPANION_THROW_FACE_STAGE ?? "after";
const guard = process.env.COMPANION_THROW_FACE_GUARD ?? "";
const mode = guard === "off" ? "off" : "full";
const output = resolve(process.env.COMPANION_THROW_FACE_OUTPUT ?? ".scratch-pw/companion-throw-face", stage);
type Sample = { at: number; state: string; phase: string; expression: string; pose: string; row: number; x: number; y: number; source: string; visible: boolean; face: boolean; spiral: boolean; eyePixels?: number[]; mouthPixels?: number[]; png?: string };
type ProbeWindow = Window & { throwFaceProof?: { samples: Sample[]; stop: () => void; release: number } };
test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", contextOptions: { reducedMotion: "no-preference" }, trace: "retain-on-failure" });

for (const surface of ["viewer", "studio", "preview"] as const) test(`native throw face ${surface}${guard ? ` [${guard}]` : ""}: surprised airborne and relieved only on actual landing`, async ({ page, context, baseURL }) => {
  mkdirSync(output, { recursive: true });
  const proof = await guardCompanionQa(page, context, baseURL!);
  // A known studio notification read is fulfilled locally, never executed.
  // Older main QA helpers do not yet have this exact readonly stub.
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node as Record<string, { exportedName?: string }>;
  const unseen = new Set(Object.entries(manifest).filter(([, m]) => m.exportedName === "getUnseenReportCountAction").map(([id]) => id));
  await page.route(url => ["/visual-fixture/studio", "/privacy", "/terms"].includes(url.pathname), route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && ["/privacy", "/terms"].includes(url.pathname) && request.resourceType() === "fetch" && [...url.searchParams.keys()].join() === "_rsc" && !url.hash) return route.continue();
    return request.method() === "POST" && unseen.has(request.headers()["next-action"])
      ? route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":"fixture"}\n1:0\n' }) : route.fallback();
  });
  await page.addInitScript(({ preferences, memory, key, epoch, mode, reduced }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": mode === "off" ? "off" : "max", "vic.gfx": JSON.stringify({ mode, at: Date.now(), v: 3 }), "vic.reduceMotion": reduced ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, animalMode: "default", roam: false, jump: false, sleep: false, petting: false, feeding: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05 }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, mode, reduced: guard === "reduced" });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : `/visual-fixture/studio?role=owner&y=2026&m=6&weather=clear${surface === "preview" ? "&viewer=1" : ""}`);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => ({ mode: document.documentElement.dataset.gfx ?? "full", reduced: document.documentElement.hasAttribute("data-reduce-motion") }))).toEqual({ mode, reduced: guard === "reduced" });
  const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor");
  await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p");
  await expect(pet).toHaveAttribute("data-placing", "");
  await page.mouse.click(670, 1080); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-placing", "");
  await expect(pet).toHaveAttribute("data-platform", /^viewport-floor/);
  // Sniff is the same settled, stationary support pose, not an active throw.
  await expect.poll(() => pet.getAttribute("data-state")).toMatch(/^(idle|look|sniff)$/);
  const body = (await actor.boundingBox())!, start = { x: body.x + body.width / 2, y: body.y + body.height * .4 }, centre = { x: 670, y: 610 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 10, start.y - 4); await expect(pet).toHaveAttribute("data-state", "held");
  for (let i = 1; i <= 24; i++) { await page.mouse.move(start.x + (centre.x - start.x) * i / 24, start.y + (centre.y - start.y) * i / 24); await page.waitForTimeout(20); }
  await expect(pet).toHaveAttribute("data-state", "held"); await page.waitForTimeout(180);
  let launchCentre = centre;
  if (guard === "shaken") {
    for (let stroke = 0; stroke < 4; stroke++) {
      const from = launchCentre, to = { x: centre.x + (stroke % 2 ? -90 : 90), y: centre.y };
      for (let step = 1; step <= 3; step++) { await page.mouse.move(from.x + (to.x - from.x) * step / 3, to.y); await page.waitForTimeout(10); }
      launchCentre = to;
    }
    await expect(pet).toHaveAttribute("data-held-dizzy", "");
  }
  await page.evaluate(rows => {
    const samples: Sample[] = []; let stopped = false, raf = 0, lastPng = -Infinity;
    const probe = { samples, release: Infinity, stop() { stopped = true; cancelAnimationFrame(raf); } };
    document.addEventListener("pointerup", event => { if (event.isTrusted) probe.release = performance.now(); }, { once: true, capture: true });
    const capture = (at: number) => {
      if (stopped) return;
      const p = document.querySelector<HTMLElement>(".vc-companion")!, r = p.getBoundingClientRect(), texture = p.querySelector<HTMLImageElement>(".vc-texture"), face = p.querySelector<HTMLCanvasElement>(".vc-expression-face"), composite = p.querySelector<HTMLCanvasElement>(".vc-character-composite");
      const visible = Boolean(p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && (composite?.width && composite.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || face?.width && face.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || texture?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })));
      const sample: Sample = { at, state: p.dataset.state ?? "", phase: p.dataset.throwPhase ?? "", expression: p.dataset.expression ?? "", pose: p.dataset.pose ?? "", row: rows.findIndex(row => row.includes(Number(p.dataset.pose))), x: r.x + r.width / 2, y: r.bottom, source: texture?.complete && texture.naturalWidth ? texture.currentSrc : "", visible, face: Boolean(face && !face.hidden && face.width), spiral: p.hasAttribute("data-held-dizzy") };
      // User's exact pose500 regression: two old squeezed-lid ends must be
      // skin again, while the previously clipped right brow must carry ink.
      // Fixed observed source pixels, independent of the painter's mask.
      if (sample.pose === "500" && sample.expression === "relief" && sample.face && face?.width === 192) {
        const ctx = face.getContext("2d");
        sample.eyePixels = [[138, 125], [152, 126], [143, 117]].map(([x, y]) => ctx!.getImageData(x, y, 1, 1).data[1]);
        sample.mouthPixels = [[131, 130], [130, 132], [135, 131]].map(([x, y]) => ctx!.getImageData(x, y, 1, 1).data[1]);
      }
      if (at >= probe.release && at - lastPng >= 60 && composite && !composite.hidden && composite.width) { sample.png = composite.toDataURL(); lastPng = at; }
      samples.push(sample); raf = requestAnimationFrame(capture);
    };
    (window as ProbeWindow).throwFaceProof = probe; raf = requestAnimationFrame(capture);
  }, companionSpriteMetadata.rows);
  // Real timed native input stays inside the existing80ms velocity window,
  // including protocol/frame overhead. No velocity or app clock is supplied.
  for (let i = 1; i <= 6; i++) { await page.waitForTimeout(10); await page.mouse.move(launchCentre.x + i * 20, launchCentre.y - i * 32); }
  await page.mouse.up(); await page.waitForTimeout(160);
  await page.screenshot({ path: resolve(output, `${surface}-flight.png`) });
  let resetAt = 0;
  if (guard === "escape") { await page.keyboard.press("Escape"); resetAt = await page.evaluate(() => performance.now()); }
  if (guard === "regrab") {
    const box = (await actor.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height * .5);
    await expect(pet).toHaveAttribute("data-state", "held"); await page.waitForTimeout(180);
    await expect(pet).not.toHaveAttribute("data-expression", "relief");
    await page.mouse.up(); resetAt = await page.evaluate(() => performance.now());
  }
  await page.waitForTimeout(1300);
  const observed = await page.evaluate(() => { const p = (window as ProbeWindow).throwFaceProof!; p.stop(); return { release: p.release, samples: p.samples }; });
  await Promise.allSettled(proof.pending);
  const airborne = observed.samples.filter(f => f.at >= observed.release && f.state === "jump" && ["launch", "rise", "apex", "fall"].includes(f.phase) && f.source);
  writeFileSync(resolve(output, `${surface}.json`), JSON.stringify({ stage, guard, surface, resetAt, ...observed, proof: { ...proof, pending: undefined }, limitations: "Native saved preferences and pointer input; read-only DOM/canvas observations; no clock/RNG/physics callbacks modified." }, null, 2));
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]);
  if (guard === "off" || guard === "reduced") {
    expect(airborne).toEqual([]); expect(observed.samples.filter(f => f.at >= observed.release).every(f => f.expression !== "relief")).toBe(true); return;
  }
  expect(airborne.length).toBeGreaterThan(6);
  expect(airborne.every(f => f.visible)).toBe(true);
  expect(Math.max(...airborne.map(f => f.x)) - Math.min(...airborne.map(f => f.x))).toBeGreaterThan(45);
  if (guard === "escape" || guard === "regrab") {
    const reset = observed.samples.filter(f => f.at >= resetAt);
    expect(reset.length).toBeGreaterThan(8); expect(reset.every(f => !f.phase && f.expression !== "relief" && f.visible)).toBe(true); return;
  }
  expect(observed.samples.some(f => f.phase === "landing")).toBe(true);
  if (guard === "shaken") {
    const painted = airborne.filter(f => f.at >= observed.release + 80);
    expect(painted.length).toBeGreaterThan(4); expect(painted.every(f => f.row === 22 && f.pose === painted[0].pose && f.expression !== "relief" && !f.face)).toBe(true); return;
  }
  if (stage !== "before") {
    const painted = airborne.filter(f => f.at >= observed.release + 80);
    expect(painted.length).toBeGreaterThan(4);
    expect(painted.every(f => f.expression === "relief" && f.face), "Decoded ordinary thrown art must actually carry the surprised face until contact").toBe(true);
    const eyes = painted.filter(f => f.pose === "500" && f.eyePixels);
    expect(eyes.length, "Actual rise must show the user's residue regression pose").toBeGreaterThan(0);
    expect(eyes.every(f => f.eyePixels![0] > 210 && f.eyePixels![1] > 210 && f.eyePixels![2] < 150), "Old eyelid ends must be erased and the right eyebrow must remain uncut").toBe(true);
    expect(eyes.every(f => f.mouthPixels![0] > 220 && f.mouthPixels![1] > 220 && f.mouthPixels![2] === 83), "The two mouth particles must be clean skin while the central source mouth remains exact").toBe(true);
    const contact = observed.samples.filter(f => f.phase === "landing");
    expect(contact.every(f => f.visible)).toBe(true);
    expect(contact.some(f => f.row === 6), "Actual contact must adopt its landing art within the existing finite beat").toBe(true);
  }
});
