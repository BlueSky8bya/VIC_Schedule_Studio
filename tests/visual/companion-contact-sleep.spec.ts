import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { guardCompanionQa, type DailyProof } from "./helpers/companion-qa";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import { companionAppearanceEyes, companionAppearancePoint } from "@/lib/ui/viewer-companion/appearance";
import { companionFaceLayout } from "@/lib/ui/viewer-companion/face-layout";

type Sample = { at: number; state: string; reach: string; pose: string; x: number; y: number; sx: number; sy: number; pompom: number | null };
type ProbeWindow = Window & { contactSleepProbe?: { frames: Sample[]; stop(): void } };
const proofs = new WeakMap<Page, DailyProof>();
test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", storageState: { cookies: [], origins: [] } });
test.setTimeout(70000);
test.beforeEach(async ({ page, context, baseURL }) => {
  proofs.set(page, await guardCompanionQa(page, context, baseURL!));
  await context.route(u => u.origin === new URL(baseURL!).origin && ["/privacy", "/terms"].includes(u.pathname), r => r.request().resourceType() === "fetch" && r.request().headers().rsc === "1" ? r.fulfill({ status: 204, body: "" }) : r.fallback());
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => (window as ProbeWindow).contactSleepProbe?.stop());
  const proof = proofs.get(page)!;
  await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]);
  expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
});
async function seed(page: Page, energy: number, lit: boolean, roam = true) {
  await page.addInitScript(({ preferences, memory, epoch, key, energy, lit, roam }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }), "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam, personality: "balanced", personalitySource: "manual", sleep: true, feeding: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy, hunger: .05 }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, energy, lit, roam });
}

for (const where of ["home", "outside"] as const) test(`${where} sleep moves only the mouth while approved eyes stay exact`, async ({ page }) => {
  await seed(page, .95, true, false); await open(page, "viewer");
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  if (where === "outside") {
    const cell = (await page.locator(".public-day").first().boundingBox())!;
    await actor.focus(); await actor.press("p"); await page.mouse.click(cell.x + cell.width / 2, cell.y + cell.height * .75);
    await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-placing", "");
    await expect.poll(() => page.locator(".vc-companion").getAttribute("data-state")).toMatch(/^(idle|look)$/);
  }
  await actor.focus(); await actor.press("n"); await page.mouse.move(2, 2);
  const index = where === "home" ? 519 : 267, pet = page.locator(".vc-companion");
  await expect(pet).toHaveAttribute("data-pose", String(index), { timeout: 25000 });
  const pose = anchors.frames.find(frame => frame.physicalIndex === index)!;
  const eyes = companionAppearanceEyes(index, pose.eyes), mouth = companionAppearancePoint(index, pose.mouth!);
  const layout = companionFaceLayout({ eyes, mouth });
  const samples = [];
  await expect.poll(() => pet.locator(".vc-expression-face").evaluate(node => (node as HTMLCanvasElement).hidden)).toBe(false);
  const until = Date.now() + 5400;
  while (Date.now() < until) {
    await page.waitForTimeout(110);
    samples.push(await pet.evaluate((node, layout) => {
      const face = node.querySelector<HTMLCanvasElement>(".vc-expression-face")!, texture = node.querySelector<HTMLImageElement>(".vc-texture")!;
      if (face.hidden) throw Error("Live sleep mouth was not painted");
      const source = document.createElement("canvas"); source.width = source.height = 192;
      const ctx = source.getContext("2d", { willReadFrequently: true })!, m = new DOMMatrixReadOnly(getComputedStyle(texture).transform), rect = node.querySelector(".vc-sprite")!.getBoundingClientRect();
      // The texture transform is a percentage of its full untransformed plane.
      const style = getComputedStyle(node.querySelector(".vc-sprite")!), width = parseFloat(style.width), height = parseFloat(style.height), cell = texture.naturalWidth / 8;
      ctx.drawImage(texture, Math.round(-m.e / width) * cell, Math.round(-m.f / height) * cell, cell, cell, 0, 0, 192, 192);
      const before = ctx.getImageData(0, 0, 192, 192).data, after = face.getContext("2d")!.getImageData(0, 0, 192, 192).data;
      let alpha = 0, outside = 0, changed = 0, fingerprint = 2166136261;
      const l = Math.round((layout.mouthX - 3.4) * 2.4), r = Math.round((layout.mouthX + 3.4) * 2.4), t = Math.round((layout.mouthY - 2) * 2.4), b = Math.round((layout.mouthY + 3.6) * 2.4);
      for (let p = 0; p < before.length; p += 4) {
        if (before[p + 3] !== after[p + 3]) alpha++;
        const x = p / 4 % 192, y = Math.floor(p / 4 / 192), inMouth = x >= l && x <= r && y >= t && y <= b;
        if (before[p] !== after[p] || before[p + 1] !== after[p + 1] || before[p + 2] !== after[p + 2]) { changed++; if (!inMouth) outside++; }
        if (inMouth) for (let k = 0; k < 3; k++) fingerprint = Math.imul(fingerprint ^ after[p + k], 16777619) >>> 0;
      }
      const composite = node.querySelector<HTMLCanvasElement>(".vc-character-composite")!;
      return { alpha, outside, changed, fingerprint, pose: node.getAttribute("data-pose"), visible: rect.width > 0 && (face.checkVisibility() || composite.checkVisibility()), at: performance.now() };
    }, layout));
  }
  for (const sample of samples) { expect(sample.alpha).toBe(0); expect(sample.outside).toBe(0); expect(sample.pose).toBe(String(index)); expect(sample.visible).toBe(true); }
  expect(new Set(samples.map(sample => sample.fingerprint)).size).toBeGreaterThan(12);
  expect(samples.at(-1)!.at - samples[0].at).toBeGreaterThan(4800);
});

for (const mode of ["off", "soft", "reduced"] as const) test(`${mode} sleep keeps the approved static mouth`, async ({ page }) => {
  await seed(page, .95, true, false);
  await page.addInitScript(mode => { localStorage.setItem("vic.gfxPref", mode === "reduced" ? "max" : mode); localStorage.setItem("vic.gfx", JSON.stringify({ mode: mode === "reduced" ? "full" : mode, v: 3, at: Date.now() })); localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off"); }, mode);
  await open(page, "viewer");
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  await actor.focus(); await actor.press("n"); await page.mouse.move(2, 2);
  await expect.poll(() => pet.getAttribute("data-pose"), { timeout: 25000 }).toMatch(/^(267|519)$/);
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(500); expect(await pet.locator(".vc-expression-face").evaluate(node => (node as HTMLCanvasElement).hidden)).toBe(true); }
});
async function observe(page: Page) {
  await page.evaluate(() => {
    const frames: Sample[] = []; let request = 0, stopped = false;
    const sample = (at: number) => {
      if (stopped) return;
      const pet = document.querySelector<HTMLElement>(".vc-companion"), pose = pet?.querySelector(".vc-pose");
      if (pet && pose) {
        const rect = pet.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(pose).transform);
        frames.push({ at, state: pet.dataset.state ?? "", reach: pet.dataset.homeReaching ?? "", pose: pet.dataset.pose ?? "", x: rect.x, y: rect.y, sx: Math.hypot(m.a, m.b), sy: Math.hypot(m.c, m.d), pompom: pet.dataset.pompom === undefined ? null : Number(pet.dataset.pompom) });
      }
      if (frames.length < 5000) request = requestAnimationFrame(sample);
    };
    request = requestAnimationFrame(sample);
    (window as ProbeWindow).contactSleepProbe = { frames, stop() { stopped = true; cancelAnimationFrame(request); } };
  });
}
async function open(page: Page, surface: "viewer" | "studio" | "preview") {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?hour=0" : "/visual-fixture/studio?role=owner&hour=0");
  await page.bringToFront();
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
  const home = await openCompanionHome(page);
  await observe(page); await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2);
  return home;
}
for (const surface of ["viewer", "studio", "preview"] as const) {
  for (const kind of ["curtain", "light"] as const) test(`${surface} ${kind} reaches the real control without a widening gesture`, async ({ page }) => {
    await seed(page, kind === "curtain" ? .25 : .95, kind === "curtain");
    const home = await open(page, surface);
    await expect.poll(() => page.evaluate(kind => (window as ProbeWindow).contactSleepProbe!.frames.filter(f => f.reach === kind).length, kind), { timeout: 35000 }).toBeGreaterThan(10);
    if (kind === "curtain") await expect(home.locator(".vc-home-window")).toHaveAttribute("data-curtain", "closed", { timeout: 20000 });
    else await expect(home.locator('[data-home-action="light"]')).toHaveAttribute("aria-pressed", "true", { timeout: 20000 });
    const frames = await page.evaluate(kind => (window as ProbeWindow).contactSleepProbe!.frames.filter(f => f.reach === kind), kind);
    expect(frames.length).toBeGreaterThan(10);
    expect(Math.max(...frames.map(f => f.sx))).toBeLessThanOrEqual(1.001);
    expect(Math.min(...frames.map(f => f.sy))).toBeGreaterThanOrEqual(.999);
    expect(Math.max(...frames.map(f => f.y)) - Math.min(...frames.map(f => f.y))).toBeGreaterThan(15);
    const material = frames.flatMap(f => f.pompom === null ? [] : [f.pompom]);
    expect(material.length).toBeGreaterThan(0);
    expect(Math.min(...material)).toBeLessThan(-.001);
    expect(Math.min(...material)).toBeGreaterThanOrEqual(-.0601);
    expect(Math.max(...material)).toBeLessThanOrEqual(0);
  });
  test(`${surface} cozy sleep keeps a subtle area-preserving breath`, async ({ page }) => {
    await seed(page, .95, true); await open(page, surface);
    const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
    await actor.focus(); await actor.press("n"); await page.mouse.move(2, 2);
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-pose", "519", { timeout: 25000 });
    const at = await page.evaluate(() => performance.now());
    await page.waitForTimeout(5100);
    const frames = await page.evaluate(at => (window as ProbeWindow).contactSleepProbe!.frames.filter(f => f.at >= at && f.state === "sleep" && f.pose === "519"), at);
    expect(frames.length).toBeGreaterThan(60);
    expect(frames.at(-1)!.at - frames[0].at).toBeGreaterThan(4800);
    expect(Math.max(...frames.map(f => f.sx))).toBeLessThanOrEqual(1.006);
    expect(Math.min(...frames.map(f => f.sy))).toBeGreaterThanOrEqual(.994);
    expect(Math.max(...frames.map(f => f.sx))).toBeGreaterThan(1.003);
    for (const f of frames) expect(f.sx * f.sy).toBeCloseTo(1, 4);
  });
}
