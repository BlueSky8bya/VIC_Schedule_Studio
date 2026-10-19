import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionSpriteMetadata as registration } from "@/lib/ui/viewer-companion/sprite-quality";
import { createCompanionTastesStore } from "@/lib/ui/viewer-companion/toy-tastes";
import { experienceCompanionLife } from "@/lib/ui/viewer-companion/life";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const out = resolve(process.env.COMPANION_EXPERIENCE_130_OUTPUT ?? ".scratch-pw/companion-130/native");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
const pet = (page: Page) => page.locator(".vc-companion");
const room = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
type Proof = { writes: string[]; foreign: string[]; errors: string[]; notes: unknown[] };
type Frame = { at: number; hidden: boolean; focused: boolean; down: number; state: string; platform: string; depth: string; row: number; pose: string; front: boolean; local: string; petting: string; trip: string; textures: { src: string; complete: boolean }[] };
type ProbeWindow = Window & { experience130?: { frames: Frame[]; stop: () => void } };
const proofs = new WeakMap<Page, Proof>();
test.use({ headless: true, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(65000);
test.beforeEach(async ({ page }) => {
  const proof: Proof = { writes: [], foreign: [], errors: [], notes: [] }; proofs.set(page, proof);
  page.on("pageerror", e => proof.errors.push(e.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private API" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).experience130; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  mkdirSync(out, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const path = resolve(out, name + ".json");
  writeFileSync(path, JSON.stringify({ build: readFileSync(resolve(".next/BUILD_ID"), "utf8").trim(), status: info.status, proof: proofs.get(page), frames, scope: "Production-build fixture. Initial preferences/care only, native inputs and read-only successive display samples/video. No RNG, focus, clock, geometry, style or runtime-state injection; not broadcaster hardware evidence." }, null, 2));
  await info.attach("experience-130", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(out, name + ".png") }).catch(() => {});
  expect(proofs.get(page)!.writes).toEqual([]); expect(proofs.get(page)!.foreign).toEqual([]); expect(proofs.get(page)!.errors).toEqual([]);
});
async function ready(page: Page, studio: boolean, activeWhileVisible = true, mode: "full" | "reduced" | "off" | "soft" | "lite" = "full", history = false, accident = false) {
  const prior = createCompanionTastesStore(); prior.recordToy("ball", "played"); prior.recordToy("ball", "played"); prior.recordToy("bell", "tripped");
  const durian = { food: "durian", reaction: "disliked", reason: "durian-socks" } as const, peach = { food: "peach", reaction: "delighted", reason: "sweet-bite" } as const;
  prior.recordFoodOutcome(durian); prior.recordFoodOutcome(peach);
  const life = experienceCompanionLife(experienceCompanionLife(DEFAULT_COMPANION_MEMORY.life, { kind: "fed", food: "durian", taste: durian }), { kind: "fed", food: "peach", taste: peach });
  await page.addInitScript(({ key, epoch, preferences, memory, activeWhileVisible, mode, history, prior, life, accident }) => {
    for (const [k, value] of Object.entries({ [key]: epoch,
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible, roam: accident, personality: accident ? "mischievous" : preferences.personality, speed: accident ? "lively" : preferences.speed, sleep: false, feeding: true, sound: false, learnFromYou: accident }),
      "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, ...(history ? { life } : {}), energy: .95, hunger: .05 }),
      "vic.gfx": JSON.stringify({ mode: mode === "soft" ? "soft" : "full", at: Date.now(), v: 3 }), "vic.gfxPref": mode === "soft" ? "auto" : mode === "off" ? "off" : mode === "lite" ? "lite" : "max", "vic.reduceMotion": mode === "reduced" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, value);
    if (history) {
      localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify(prior));
      localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: ["durian", "peach"], behaviors: [], situations: [], gifts: { pending: null, unlocked: [], equipped: null, activeMs: 0, interactionCredit: 0 } }));
    }
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, activeWhileVisible, mode, history, prior: prior.load(), life, accident });
  await page.goto(studio ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1&ambient=autumn");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await expect(pet(page)).toBeVisible();
  const home = await openCompanionHome(page);
  await home.evaluate(async n => Promise.all(n.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))));
}
async function probe(page: Page) {
  await page.evaluate(rowCount => {
    let raf = 0, stopped = false, down = 0; const frames: Frame[] = [];
    const pointer = () => { down++; }; document.addEventListener("pointerdown", pointer, true);
    const sample = (at: number) => {
      if (stopped) return;
      const n = document.querySelector<HTMLElement>(".vc-companion")!, front = document.querySelector<HTMLElement>(".vc-bed-foreground"), local = document.querySelector(".vc-bed-local-front");
      frames.push({ at, hidden: document.hidden || n.hidden, focused: document.hasFocus(), down, state: n.dataset.state ?? "", platform: n.dataset.platform ?? "", depth: n.dataset.sofaDepth ?? "", row: Math.round(parseFloat(n.style.getPropertyValue("--vc-row")) / 100 * (rowCount - 1)), pose: n.dataset.pose ?? "", front: Boolean(front && !front.hidden && getComputedStyle(front).visibility !== "hidden"), local: local ? getComputedStyle(local).visibility : "missing", petting: n.dataset.petting ?? "", trip: n.dataset.trip ?? "", textures: [...n.querySelectorAll<HTMLImageElement>(".vc-sprite > .vc-texture")].map(i => ({ src: i.currentSrc || i.src, complete: i.complete && i.naturalWidth > 0 })) });
      if (frames.length < 7200) raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).experience130 = { frames, stop: () => { stopped = true; cancelAnimationFrame(raf); document.removeEventListener("pointerdown", pointer, true); } }; raf = requestAnimationFrame(sample);
  }, registration.rows.length);
}
const frames = (page: Page) => page.evaluate(() => (window as ProbeWindow).experience130!.frames);
async function strokes(page: Page, count = 72) {
  const p = await pet(page).evaluate(n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - r.width * .45 }; });
  for (let i = 0; i < count; i++) { await page.mouse.move(p.x + Math.sin(i * Math.PI / 8) * 14, p.y); await page.waitForTimeout(32); }
}
for (const viewport of [{ width: 1440, studio: false, edge: true }, { width: 1920, studio: true, edge: false }]) test(`130 resident smiling strokes keep the actual sofa cloth at ${viewport.width} ${viewport.edge ? "near-side" : "center"}`, async ({ page }) => {
  await page.setViewportSize({ width: viewport.width, height: 1100 }); await ready(page, viewport.studio); await placeCompanionOnHomeFloor(page);
  const sofa = room(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }); await sofa.focus(); await sofa.press("Enter"); await page.mouse.move(2, 2);
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 25000 }); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  if (viewport.edge) {
    const bed = (await room(page).locator(".vc-plush-bed").boundingBox())!, seat = (await room(page).locator(".vc-home-cushion").boundingBox())!;
    const actor = pet(page).getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
    const offset = Math.max(0, bed.width * 59 / 180 - 35.5);
    proofs.get(page)!.notes.push({ actualNativeBed: bed, actualNativeSeat: seat, requestedInsideSeatOffset: offset });
    await actor.focus(); await actor.press("p"); await page.mouse.click(bed.x + bed.width / 2 - offset, seat.y - .01); await page.mouse.move(2, 2);
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await page.waitForTimeout(250);
  }
  await probe(page); await strokes(page); await page.mouse.move(2, 2); await page.waitForTimeout(800);
  const actual = (await frames(page)).filter(f => !f.hidden && f.platform === "companion-home");
  expect(actual.filter(f => f.state === "petted" && f.row === 9).length, "native smiling petting frames actually occurred").toBeGreaterThan(12);
  expect(new Set(actual.filter(f => f.row === 9).map(f => f.pose)).size).toBeGreaterThan(4);
  // A cold new packet keeps its prior decoded pose until adoption. Observe
  // genuine smiling cells separately from the requested row during that handoff.
  const smiling = actual.filter(f => f.row === 9 && registration.rows[9].includes(Number(f.pose)));
  expect(smiling.length, "actual adopted smiling frames occurred").toBeGreaterThan(12);
  expect(new Set(smiling.map(f => f.pose)).size).toBeGreaterThan(4);
  expect(actual.every(f => f.textures.length === 1 && f.textures[0].complete), "resident checks witness one actual decoded sprite on every frame").toBe(true);
  expect(actual.every(f => new URL(f.textures[0].src).pathname === registration.atlases[registration.frames[Number(f.pose)].atlas].src), "each displayed pose uses its actual adopted packet").toBe(true);
  expect(actual.every(f => ["seat", "back"].includes(f.depth) && f.front && f.local === "hidden"), "every grounded resident frame keeps exactly one foreground cloth").toBe(true);
});
test("130 an actual toy trip earns its reason only after the native mishap finishes", async ({ page }) => {
  test.setTimeout(125000); await page.setViewportSize({ width: 1920, height: 1100 }); await ready(page, true, true, "full", false, true);
  const actor = pet(page).getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await actor.focus(); await actor.press("p"); await page.mouse.click(700, 1022); await page.mouse.move(2, 2);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await actor.focus(); await actor.press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  for (const x of [540, 620, 780, 860]) {
    const before = await page.locator(".vc-toy").count(); await room(page).getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    await expect(page.locator(".vc-toy")).toHaveCount(before + 1); const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false");
    const rect = (await toy.boundingBox())!; await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(x, 1029, { steps: 14 }); await page.waitForTimeout(150); await page.mouse.move(x, 1030); await page.mouse.up(); await page.mouse.move(2, 2);
    await expect(toy).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/); await expect(toy).toHaveAttribute("data-falling", "false");
  }
  const placed = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(n => ({ id: (n as HTMLElement).dataset.toyId, kind: (n as HTMLElement).dataset.kind, platform: (n as HTMLElement).dataset.platform, rect: n.getBoundingClientRect().toJSON() })));
  proofs.get(page)!.notes.push({ actualPlacedToys: placed, priorTasteSeed: false });
  await probe(page); await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2);
  await expect.poll(() => page.evaluate(() => { const raw = localStorage.getItem("vic.viewerCompanionTastes"); return raw ? JSON.parse(raw).reasons?.some((r: { reason: string }) => r.reason === "toy-trip") : false; }), { timeout: 85000, intervals: [250, 500, 1000] }).toBe(true);
  const actual = await frames(page), saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!));
  expect(actual.some(f => f.trip === "toy" && f.state === "play" && !f.hidden)).toBe(true);
  expect(actual.filter(f => f.trip === "toy" && f.state === "play" && !f.hidden).every(f => f.textures.length === 1 && f.textures[0].complete), "the earned trip has actual decoded impact frames").toBe(true);
  expect(saved.reasons.some((r: { reason: string; kind: string }) => r.reason === "toy-trip" && placed.some(t => t.kind === r.kind))).toBe(true);
  proofs.get(page)!.notes.push({ actualEarnedTripReasons: saved.reasons.filter((r: { reason: string }) => r.reason === "toy-trip") });
});
for (const mode of ["full", "reduced", "off", "soft", "lite"] as const) test(`130 food selection highlights its art and preserves its physical target in ${mode}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 }); await ready(page, false, true, mode);
  await expect.poll(() => page.locator("html").evaluate(n => (n as HTMLElement).dataset.gfx ?? "full")).toBe(mode === "reduced" ? "full" : mode);
  await room(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const food = page.locator(".vc-food"), art = food.locator(".vc-fruit");
  await expect(food).toHaveCount(1); await expect(food).not.toHaveAttribute("data-falling"); await page.mouse.move(2, 2);
  const before = (await food.boundingBox())!; await food.hover();
  await expect.poll(() => art.evaluate(n => getComputedStyle(n).filter)).toContain("brightness(1.07)");
  if (mode === "full" || mode === "lite") await expect.poll(() => art.evaluate(n => new DOMMatrixReadOnly(getComputedStyle(n).transform).a)).toBeCloseTo(1.1, 2);
  else await expect(art).toHaveCSS("transform", "none");
  const after = (await food.boundingBox())!; expect(after.width).toBeCloseTo(44, 2); expect(after.height).toBeCloseTo(44, 2); expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(.1);
  await food.focus(); await food.press("Enter"); await expect(food).toHaveAttribute("data-selected", ""); await page.mouse.move(2, 2);
  await expect.poll(() => art.evaluate(n => getComputedStyle(n).filter)).toContain("brightness(1.07)");
  await food.press("Escape");
  proofs.get(page)!.notes.push({ mode, actualNativeBefore: before, actualNativeAfter: after });
});
test("130 prior sensory and toy accident reasons fit the shared compact profile", async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 780 }); await ready(page, false, true, "full", true);
  await room(page).getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  const cards = dialog.locator(".rhh-taste-card"); await expect(cards).toHaveCount(4);
  await expect(cards.filter({ hasText: "싫어하는 간식" })).toContainText("두리안"); await expect(cards.filter({ hasText: "싫어하는 간식" }).locator(".rhh-taste-reason")).toHaveText("주인 양말 냄새남");
  await expect(cards.filter({ hasText: "싫어하는 장난감" })).toContainText("딸랑 종"); await expect(cards.filter({ hasText: "싫어하는 장난감" }).locator(".rhh-taste-reason")).toHaveText("놀다가 걸려 넘어졌어요");
  await expect(cards.filter({ hasText: "좋아하는 간식" })).toContainText("복숭아");
  const fit = await dialog.evaluate(n => { const r = n.getBoundingClientRect(); return { overflow: n.scrollWidth - n.clientWidth, left: r.left, right: r.right, top: r.top, bottom: r.bottom, viewport: innerHeight }; });
  expect(fit.overflow).toBeLessThanOrEqual(1); expect(fit.left).toBeGreaterThanOrEqual(0); expect(fit.right).toBeLessThanOrEqual(1050); expect(fit.top).toBeGreaterThanOrEqual(0); expect(fit.bottom).toBeLessThanOrEqual(fit.viewport + 1);
  proofs.get(page)!.notes.push({ priorLocalMemoryProjectionOnly: true, earnedInNativeSession: false, fit });
});
test("130 first native strokes after real focus leaves and returns need no schedule click", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await ready(page, true);
  await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2);
  const peer = await page.context().newPage();
  try {
    await peer.setContent("<button style='width:200px;height:100px'>Other window</button>"); await peer.bringToFront(); await peer.getByRole("button").click();
    // Playwright enables permanent focus emulation for each page by default.
    // Disable that driver override on both surfaces, then use native activation;
    // do not replace hasFocus, dispatch events, or emulate a chosen focus state.
    const targetNative = await page.context().newCDPSession(page), peerNative = await page.context().newCDPSession(peer);
    await targetNative.send("Emulation.setFocusEmulationEnabled", { enabled: false }); await peerNative.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await peer.bringToFront(); await peer.getByRole("button").click();
    const targetState = await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() })), peerState = await peer.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() }));
    proofs.get(page)!.notes.push({ actualBefore: { targetState, peerState }, windows: { target: await targetNative.send("Browser.getWindowForTarget"), peer: await peerNative.send("Browser.getWindowForTarget") } });
    expect(targetState, "genuine visible, unfocused schedule before testing its first hover").toEqual({ hidden: false, focused: false }); expect(peerState.focused).toBe(true);
    await probe(page); await strokes(page);
    const actual = await frames(page);
    proofs.get(page)!.notes.push({ nativeUnfocusedFrames: actual.filter(f => !f.focused).length, nativeUnfocusedPettingFrames: actual.filter(f => !f.focused && f.petting !== "").length, scope: "Native pointer transport may activate this tab. Remaining unfocused OS-window strokes require separate hardware evidence; no forced focus state." });
    expect(actual.every(f => f.down === 0)).toBe(true);
    expect(actual.some(f => !f.hidden && f.petting !== "" && f.state === "petted")).toBe(true);
  } finally { await page.evaluate(() => (window as ProbeWindow).experience130?.stop()); await peer.close(); }
});
