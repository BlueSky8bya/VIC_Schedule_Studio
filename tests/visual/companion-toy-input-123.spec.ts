import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionCarryAnchor } from "@/lib/ui/viewer-companion/accessory";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = resolve(".scratch-pw/companion-123/input", process.env.COMPANION_INPUT_PHASE ?? "current");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Point = { x: number; y: number };
type ProbeWindow = Window & { input123?: { stop: () => void; samples: unknown[]; measure?: () => Promise<void> } };
type Evidence = { writes: string[]; foreign: string[]; errors: string[]; build: string; notes: unknown[] };
const evidence = new WeakMap<Page, Evidence>();
test.use({ headless: true, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(70000);
test.beforeEach(async ({ page }) => {
  const proof: Evidence = { writes: [], foreign: [], errors: [], notes: [], build: readFileSync(resolve(".next/BUILD_ID"), "utf8").trim() }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const samples = await page.evaluate(() => { const probe = (window as ProbeWindow).input123; probe?.stop(); return probe?.samples ?? []; }).catch(() => []);
  const proof = evidence.get(page)!, name = info.title.replace(/[^a-z0-9]+/gi, "-"); mkdirSync(output, { recursive: true });
  const path = resolve(output, name + ".json");
  writeFileSync(path, JSON.stringify({ ...proof, samples, status: info.status, recordedAt: new Date().toISOString(), afterBuild: readFileSync(resolve(".next/BUILD_ID"), "utf8").trim(), scope: "Actual local native pointer/keyboard input and read-only current DOM observations. No RNG, clock, style, geometry or brain-state injection; initial saved preferences/care only. No production/OBS/device claim." }, null, 2));
  await info.attach("native-toy-food-input", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});
async function setup(page: Page, roam = false) {
  await page.addInitScript(({ preferences, memory, roam, epoch, key }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, personality: "tidy", roam, sleep: false, sound: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, roam, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
  await page.goto("/visual-fixture/poster?avatar=1&ambient=autumn"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible(); await openCompanionHome(page);
}
async function spawn(page: Page, kind: "food" | "toy") {
  const nodes = page.locator(kind === "food" ? ".vc-food" : ".vc-toy"), before = await nodes.count();
  await page.getByRole("button", { name: kind === "food" ? "밥 꺼내기" : "장난감 상자 열기", exact: true }).click();
  await expect(nodes).toHaveCount(before + 1); const node = nodes.last(); await expect(node).toBeVisible();
  if (kind === "toy") await expect(node).toHaveAttribute("data-falling", "false");
  await node.evaluate(node => new Promise<void>(done => {
    let previous: DOMRect | undefined, stable = 0;
    const sample = () => { const rect = node.getBoundingClientRect(); stable = previous && Math.hypot(rect.x - previous.x, rect.y - previous.y) < .1 ? stable + 1 : 0; previous = rect;
      if (stable >= 3) done(); else requestAnimationFrame(sample); }; requestAnimationFrame(sample);
  }));
  return node;
}
async function nativeDrag(page: Page, node: Locator, delta: Point) {
  const rect = (await node.boundingBox())!, start = { x: rect.x + 9, y: rect.y + 10 };
  await node.evaluate((node, start) => {
    (window as ProbeWindow).input123?.stop(); const samples: unknown[] = [], rect = node.getBoundingClientRect();
    const initial = { x: rect.left, y: rect.top }; let active = true, latest: { input: Point; received: number } | undefined;
    const moved = (event: PointerEvent) => {
      if (!active || !event.buttons || !(event.target instanceof Node) || !node.contains(event.target)) return;
      latest = { input: { x: event.clientX, y: event.clientY }, received: performance.now() };
    };
    window.addEventListener("pointermove", moved, true);
    (window as ProbeWindow).input123 = { samples, stop: () => { active = false; window.removeEventListener("pointermove", moved, true); }, measure: () => new Promise<void>(done => {
      // The driver calls this after native dispatch returns. The product's
      // own input callback is already queued, even when it stops propagation.
      requestAnimationFrame(now => { if (active && latest) { const { input, received } = latest, rect = node.getBoundingClientRect(), expected = { x: initial.x + input.x - start.x, y: initial.y + input.y - start.y };
        samples.push({ at: now, received, input, expected, actual: { x: rect.left, y: rect.top }, error: Math.hypot(rect.left - expected.x, rect.top - expected.y) }); } done(); });
    }) };
  }, start);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (let step = 1; step <= 12; step++) { await page.mouse.move(start.x + delta.x * step / 12, start.y + delta.y * step / 12); await page.evaluate(() => (window as ProbeWindow).input123!.measure!()); }
  const samples = await page.evaluate(() => { const probe = (window as ProbeWindow).input123!; probe.stop(); return probe.samples as { at: number; received: number; error: number }[]; });
  await page.mouse.up(); return samples;
}
test("123 native food and toy drags preserve the grabbed offset and paint the latest input in the same frame", async ({ page }) => {
  await setup(page); const food = await spawn(page, "food"), toy = await spawn(page, "toy");
  const foodSamples = await nativeDrag(page, food, { x: 160, y: -100 }), toySamples = await nativeDrag(page, toy, { x: 160, y: -100 });
  evidence.get(page)!.notes.push({ foodSamples, toySamples, noProductFrameOrStyleInjection: true });
  expect(foodSamples.length).toBeGreaterThanOrEqual(8); expect(toySamples.length).toBeGreaterThanOrEqual(8);
  expect(Math.max(...foodSamples.map(sample => sample.error)), "food keeps its existing captured offset").toBeLessThan(1);
  expect(Math.max(...toySamples.map(sample => sample.error)), "toy follows the same actual pointer displacement without a foot jump or extra display frame").toBeLessThan(1);
});
test("123 native falling toys use the existing active display cadence while the pet is idle", async ({ page }) => {
  await setup(page); const toy = await spawn(page, "toy");
  await page.evaluate(() => {
    (window as ProbeWindow).input123?.stop(); const samples: unknown[] = []; let request = 0, stopped = false;
    const sample = (at: number) => { if (stopped) return; const node = document.querySelector<HTMLElement>(".vc-toy"), rect = node?.getBoundingClientRect(), pet = document.querySelector<HTMLElement>(".vc-companion");
      samples.push({ at, x: rect ? rect.left + rect.width / 2 : NaN, y: rect?.bottom ?? NaN, falling: node?.dataset.falling === "true", held: node?.dataset.held === "true", pet: pet?.dataset.state }); request = requestAnimationFrame(sample); };
    (window as ProbeWindow).input123 = { samples, stop: () => { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  });
  // Idle fidgets remain real behavior. Repeat the same native release a
  // bounded four times rather than count their moving poses as idle evidence.
  let attempts = 0;
  for (; attempts < 4; attempts++) {
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", /^(idle|look)$/);
    const rect = (await toy.boundingBox())!, start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x, 160, { steps: 12 }); await page.mouse.up();
    await expect(toy).toHaveAttribute("data-falling", "false");
    const idleCount = await page.evaluate(() => ((window as ProbeWindow).input123!.samples as { falling: boolean; held: boolean; pet: string }[]).filter(sample => sample.falling && !sample.held && ["idle", "look"].includes(sample.pet)).length);
    if (idleCount >= 8) { attempts++; break; }
  }
  const trace = await page.evaluate(() => { const probe = (window as ProbeWindow).input123!; probe.stop(); return probe.samples as { at: number; x: number; y: number; falling: boolean; held: boolean; pet: string }[]; });
  const segments: (typeof trace)[] = []; let segment: typeof trace = [];
  for (const sample of trace) { if (sample.falling && !sample.held && ["idle", "look"].includes(sample.pet)) segment.push(sample); else if (segment.length) { segments.push(segment); segment = []; } } if (segment.length) segments.push(segment);
  const moving = segments.flat(); let longestHold = 0;
  for (const samples of segments) { let heldSince = samples[0].at; for (let i = 1; i < samples.length; i++) { if (Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y) >= .1) heldSince = samples[i].at; else longestHold = Math.max(longestHold, samples[i].at - heldSince); } }
  evidence.get(page)!.notes.push({ fallingSamples: trace, actualNativeReleaseAttempts: attempts, idleLookConsecutiveSegmentLengths: segments.map(segment => segment.length), longestActualPositionHoldMs: longestHold, existingFullCadenceOnly: true });
  expect(moving.length).toBeGreaterThanOrEqual(8);
  expect(longestHold, "a real falling object cannot inherit the idle14Hz pose hold").toBeLessThan(40);
});
test("123 native toy keyboard arrows keep the actual calendar month and heading identity", async ({ page }) => {
  await setup(page); const toy = await spawn(page, "toy"), heading = page.locator(".poster-chrome-title");
  const before = await heading.innerText(), identity = (await heading.elementHandle())!;
  await toy.focus(); await toy.press("Enter"); for (let i = 0; i < 8; i++) await toy.press("ArrowLeft"); await toy.press("Escape");
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const after = await heading.innerText(); evidence.get(page)!.notes.push({ actualCalendarHeadingBefore: before, actualCalendarHeadingAfter: after, nativeToyArrows: 8 });
  expect(after).toBe(before); expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".poster-chrome-title"))).toBe(true);
});
test("123 native pet carry follows the current adopted DOM pose and still reaches the actual box opening", async ({ page }) => {
  await setup(page, true); await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion"); await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  const toy = await spawn(page, "toy"), room = page.getByRole("region", { name: "빅타민 집", exact: true });
  await expect(pet).toHaveAttribute("data-state", "held");
  // Grab the actual bottom pixel, so this setup is independent of the known
  // off-centre pointer bug and of the old toy-arrow/month ownership bug.
  const rect = (await toy.boundingBox())!, floor = (await room.locator(".vc-home-floor").boundingBox())!;
  const grab = { x: rect.x + rect.width / 2, y: rect.y + rect.height - 1 };
  await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await page.mouse.move(floor.x + 118, grab.y, { steps: 12 }); await page.mouse.up();
  await expect(toy).toHaveAttribute("data-falling", "false");
  await expect(pet).toHaveAttribute("data-state", "held");
  const opening = (await room.locator(".vc-toy-box-opening").boundingBox())!, target = { x: opening.x + opening.width / 2, y: opening.y + opening.height };
  const landmarks = companionSpriteMetadata.frames.map((_, index) => { const selected = selectCompanionSprite(index), point = companionCarryAnchor(selected); return point ? { point, frame: selected.frame } : null; });
  await page.evaluate(landmarks => {
    (window as ProbeWindow).input123?.stop(); const samples: unknown[] = []; let request = 0, stopped = false;
    const sample = (at: number) => {
      if (stopped) return;
      const pet = document.querySelector<HTMLElement>(".vc-companion"), toy = document.querySelector<HTMLElement>(".vc-toy"), rect = pet?.getBoundingClientRect(), object = toy?.getBoundingClientRect(), anchor = landmarks[Number(pet?.dataset.pose ?? -1)];
      let expected: Point | null = null;
      if (pet && anchor) {
        const size = parseFloat(getComputedStyle(pet).width); let point = new DOMPoint((anchor.point.x + anchor.frame.x) / 80 * size, (anchor.point.y + anchor.frame.y) / 80 * size);
        for (const layer of [".vc-pose", ".vc-contact", ".vc-reaction", ".vc-facing", ".vc-inertia", ".vc-companion"]) {
          const node = layer === ".vc-companion" ? pet : pet.querySelector<HTMLElement>(layer)!; const style = getComputedStyle(node), origin = style.transformOrigin.split(" ").map(Number.parseFloat), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
          point = new DOMPoint(point.x - origin[0], point.y - origin[1]).matrixTransform(matrix); point.x += origin[0]; point.y += origin[1];
        }
        expected = { x: point.x, y: point.y + 8 };
      }
      samples.push({ at, state: pet?.dataset.state, toyAction: pet?.dataset.toyAction, pose: pet?.dataset.pose, pet: rect ? { x: rect.left + rect.width / 2, y: rect.bottom } : null, carried: toy?.dataset.carried === "true", object: object ? { x: object.left + object.width / 2, y: object.bottom } : null, expectedCurrentDOM: expected, decoded: Boolean(pet?.querySelector<HTMLImageElement>(".vc-texture")?.complete), hidden: !pet || pet.hidden || document.hidden });
      request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).input123 = { samples, stop: () => { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  }, landmarks);
  await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2); await expect(page.locator(".vc-toy")).toHaveCount(0, { timeout: 45000 });
  const trace = await page.evaluate(() => { const probe = (window as ProbeWindow).input123!; probe.stop(); return probe.samples as { at: number; state: string; carried: boolean; pet: Point | null; object: Point | null; expectedCurrentDOM: Point | null; decoded: boolean; hidden: boolean }[]; });
  const travel = trace.filter(sample => sample.carried && ["walk", "jump"].includes(sample.state) && sample.object && sample.expectedCurrentDOM && sample.decoded && !sample.hidden), last = trace.filter(sample => sample.carried).at(-1)!;
  const errors = travel.map(sample => Math.hypot(sample.object!.x - sample.expectedCurrentDOM!.x, sample.object!.y - sample.expectedCurrentDOM!.y));
  evidence.get(page)!.notes.push({ currentDOMCarrySamples: travel.length, maximumCurrentPoseGap: Math.max(...errors), actualOpening: target, lastActualCarry: last, lastOpeningDistance: last?.object ? Math.hypot(last.object.x - target.x, last.object.y - target.y) : null });
  expect(travel.length).toBeGreaterThanOrEqual(8); expect(Math.abs(travel.at(-1)!.pet!.x - travel[0].pet!.x)).toBeGreaterThan(24);
  expect(Math.max(...errors), "toy transport uses the current adopted DOM pose like food, not the previous tick").toBeLessThan(1);
  expect(Math.hypot(last.object!.x - target.x, last.object!.y - target.y), "actual carried toy still reaches the real opening before removal").toBeLessThan(20);
});
