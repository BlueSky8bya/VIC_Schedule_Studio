import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Frame = { at: number; visible: boolean; same: boolean; state: string; play: string; beat: string; row: string; image: string; platform: string; x: number; foot: number; ruffled: number };
type Probe = { node: HTMLElement; frames: Frame[]; ups: number[]; stopped: boolean; raf: number; listener: (event: PointerEvent) => void };
type MotionWindow = Window & { motionRhythmProbe?: Probe; motionRhythmRandom?: number; motionRhythmAutonomy?: boolean; motionRhythmSeed?: number };
const prefix = process.env.COMPANION_RHYTHM_PREFIX ?? ".scratch-pw/companion-071-rhythm";
const companion = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => companion(page).locator(".vc-actor");
const evidence = new WeakMap<Page, { writes: string[]; errors: string[] }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof = { writes: [] as string[], errors: [] as string[] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(previewReads.size).toBe(1);
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) {
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "" });
    }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }, info) => {
  const observation = await page.evaluate(() => {
    const probe = (window as MotionWindow).motionRhythmProbe;
    if (!probe) return null;
    probe.stopped = true; cancelAnimationFrame(probe.raf); document.removeEventListener("pointerup", probe.listener, true);
    return { frames: probe.frames, ups: probe.ups };
  });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 110)}.json`, JSON.stringify({ ...evidence.get(page), observation }, null, 2));
  expect(evidence.get(page)).toEqual({ writes: [], errors: [] });
});

async function setup(page: Page, surface: Surface, autonomous = false) {
  await page.addInitScript(({ epoch, epochKey, preferences, care, autonomous }) => {
    if (!sessionStorage.getItem("companion-rhythm-seeded")) {
      for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.premiereStage": "off", "vic.ambient": "off", "vic.sound": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
      localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
      sessionStorage.setItem("companion-rhythm-seeded", "1");
    }
    // Only the fixture's random source is controlled. No product action,
    // geometry, animation clock or event handler is replaced by this probe.
    const scope = window as MotionWindow, nativeRandom = Math.random;
    scope.motionRhythmAutonomy = autonomous; scope.motionRhythmSeed = 7151;
    Math.random = () => {
      if (scope.motionRhythmRandom !== undefined) return scope.motionRhythmRandom;
      if (!scope.motionRhythmAutonomy) return nativeRandom();
      scope.motionRhythmSeed = (Math.imul(scope.motionRhythmSeed!, 1664525) + 1013904223) >>> 0;
      return scope.motionRhythmSeed / 4294967296;
    };
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, autonomous,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: autonomous, jump: autonomous, sleep: !autonomous, feeding: false, heartPrank: false, ambientPrank: false, panelPrank: false, speed: autonomous ? "lively" : "normal" },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await expect(actor(page)).toBeVisible(); await expect(companion(page)).toHaveAttribute("data-atlas", "hd");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}

async function observe(page: Page) {
  await companion(page).evaluate(node => {
    const scope = window as MotionWindow;
    // Discard random values consumed by mounting, settings and the native
    // spatial setup. Only this observed action sequence owns the fixed seed.
    if (scope.motionRhythmAutonomy) { scope.motionRhythmSeed = 7151; scope.motionRhythmRandom = undefined; }
    const probe: Probe = { node: node as HTMLElement, frames: [], ups: [], stopped: false, raf: 0, listener: () => {} };
    probe.listener = event => { if (event.isTrusted && node.contains(event.target as Node)) probe.ups.push(performance.now()); };
    document.addEventListener("pointerup", probe.listener, { capture: true, passive: true });
    const sample = () => {
      if (probe.stopped) return;
      const css = getComputedStyle(probe.node), rect = probe.node.getBoundingClientRect(), data = probe.node.dataset;
      if (scope.motionRhythmAutonomy) scope.motionRhythmRandom = ["walk", "jump"].includes(data.state ?? "") ? .01 : undefined;
      probe.frames.push({ at: performance.now(), visible: probe.node.isConnected && !probe.node.hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity) > .05 && rect.width > 0 && rect.height > 0,
        same: document.querySelector(".vc-companion") === node, state: data.state ?? "", play: data.play ?? "", beat: data.playBeat ?? "", row: probe.node.style.getPropertyValue("--vc-row"), image: probe.node.querySelector<HTMLElement>(".vc-sprite")?.style.backgroundImage ?? "", platform: data.platform ?? "", x: rect.left + rect.width / 2, foot: rect.bottom, ruffled: document.querySelectorAll("[data-vc-ruffled]").length });
      probe.raf = requestAnimationFrame(sample);
    };
    scope.motionRhythmProbe = probe; probe.raf = requestAnimationFrame(sample);
  });
}

async function recallToSeat(page: Page) {
  const home = await openCompanionHome(page, "keyboard");
  await home.evaluate(async node => { await Promise.allSettled(node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  let previous: number[] | undefined, stableAt = Date.now();
  await expect.poll(async () => {
    const next = await home.evaluate(node => {
      const room = node.querySelector(".vc-home-room")!.getBoundingClientRect(), seat = node.querySelector(".vc-home-cushion")!.getBoundingClientRect();
      return [room.x, room.y, room.width, room.height, seat.x, seat.y, seat.width, seat.height];
    });
    if (!previous || next.some((value, index) => Math.abs(value - previous![index]) > .01)) stableAt = Date.now();
    previous = next;
    return next[2] > 0 && next[3] > 0 && next[6] > 0 && next[7] > 0 ? Date.now() - stableAt : 0;
  }, { intervals: [40], timeout: 5000 }).toBeGreaterThanOrEqual(160);
  const recall = home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await recall.focus(); await recall.press("Enter");
  await expect(companion(page)).toHaveAttribute("data-platform", "companion-home");
  await expect(companion(page)).not.toHaveAttribute("data-state", "jump");
  await page.mouse.move(5, 5);
}

async function openPranks(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.locator("#rhh-tab-companion-panel").getByRole("tab", { name: "장난", exact: true }).click();
  return dialog;
}

async function dropNearAnOrdinaryCard(page: Page) {
  await expect(actor(page)).toBeVisible();
  await expect(companion(page)).toHaveAttribute("data-platform", /.+/);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  const card = page.locator(".public-event[data-eventid='evt-005'],[data-companion-event='ordinary'][data-eventid='evt-005']").first();
  await expect(card).toBeVisible();
  const box = (await actor(page).boundingBox())!, carrier = (await companion(page).boundingBox())!, target = (await card.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height * .45 };
  const footOffset = carrier.y + carrier.height - start.y;
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(target.x + target.width * .72, target.y - 25 - footOffset, { steps: 18 });
  await expect(companion(page)).toHaveAttribute("data-state", "held");
  await page.mouse.up(); await page.mouse.move(5, 5);
  await expect(companion(page)).toHaveAttribute("data-platform", /^card-.*-top(?:-\d+)?$/);
  await expect(companion(page)).not.toHaveAttribute("data-state", "jump");
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} short tap reacts promptly, reads tears and recovers without hiding during drag interruption`, async ({ page }) => {
  await setup(page, surface); await recallToSeat(page); await observe(page);
  await actor(page).click({ delay: 55 }); await page.mouse.move(5, 5);
  await expect(companion(page)).toHaveAttribute("data-play", "bonk-tears");
  await expect(companion(page)).toHaveAttribute("data-play-beat", "checking");
  await page.screenshot({ path: `${prefix}-${surface}-tears.png` });
  await expect(companion(page)).not.toHaveAttribute("data-play", "bonk-tears", { timeout: 2000 });
  const first = await page.evaluate(() => { const probe = (window as MotionWindow).motionRhythmProbe!; return { frames: probe.frames, up: probe.ups[0] }; });
  const reaction = first.frames.filter(frame => frame.play === "bonk-tears");
  expect(reaction.length).toBeGreaterThan(12);
  expect(reaction.find(frame => frame.beat === "checking")!.at - first.up).toBeLessThanOrEqual(300);
  expect(reaction.at(-1)!.at - first.up).toBeLessThanOrEqual(1800);
  // Pointer release paints contact synchronously; the next renderer frame
  // publishes its semantic beat. A pre-tick empty label is not a missing pose.
  expect(new Set(reaction.map(frame => frame.beat).filter(Boolean))).toEqual(new Set(["impact", "checking", "recover"]));
  expect(reaction.some(frame => frame.beat === "checking" && frame.image.includes("victamin-play-27-ear-v2.webp"))).toBe(true);
  await actor(page).click({ delay: 55 }); await page.mouse.move(5, 5);
  await expect(companion(page)).toHaveAttribute("data-play", "bonk-tears");
  const box = (await actor(page).boundingBox())!, start = { x: box.x + box.width / 2, y: box.y + box.height * .45 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, Math.max(150, start.y - 90), { steps: 10 });
  await expect(companion(page)).toHaveAttribute("data-state", "held");
  await expect(companion(page)).not.toHaveAttribute("data-play", "bonk-tears");
  await page.screenshot({ path: `${prefix}-${surface}-interrupted.png` });
  await page.mouse.up(); await page.mouse.move(5, 5);
  await expect(companion(page)).not.toHaveAttribute("data-state", "held");
  const frames = await page.evaluate(() => (window as MotionWindow).motionRhythmProbe!.frames);
  expect(frames.filter(frame => !frame.visible || !frame.same)).toEqual([]);
});

for (const surface of ["viewer", "studio"] as const) test(`${surface} card tilt switch is independent and persists a native OFF choice after reload`, async ({ page }) => {
  await setup(page, surface);
  let dialog = await openPranks(page);
  const toggle = dialog.getByRole("switch", { name: "빅타민 일정 기울이기 켜기/끄기", exact: true });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!));
  await expect(toggle).toBeChecked(); await toggle.click(); await expect(toggle).not.toBeChecked();
  for (const name of ["하트 콩", "숨바꼭질", "패널 자리 장난"]) {
    const control = dialog.getByRole("switch", { name: `빅타민 ${name} 켜기/끄기`, exact: true });
    await expect(control).not.toBeChecked();
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).cardPrank)).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!))).toEqual({ ...before, cardPrank: false });
  await page.screenshot({ path: `${prefix}-${surface}-card-prank-off.png` });
  await page.reload(); await page.bringToFront();
  dialog = await openPranks(page);
  await expect(dialog.getByRole("switch", { name: "빅타민 일정 기울이기 켜기/끄기", exact: true })).not.toBeChecked();
  await expect(dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toBeChecked();
});

for (const surface of ["viewer", "studio"] as const) for (const cardPrank of [true, false]) test(`${surface} actual natural movement contact performs its finite reaction with card tilt ${cardPrank ? "ON and click restoration" : "OFF"}`, async ({ page }) => {
  test.setTimeout(50000);
  await setup(page, surface, true);
  if (!cardPrank) {
    const dialog = await openPranks(page);
    await dialog.getByRole("switch", { name: "빅타민 일정 기울이기 켜기/끄기", exact: true }).click();
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  // Both real calendars have empty date rows below the sample's last event.
  // This focused contact fixture hides only their date ink, so the actual
  // geometry observer naturally removes competing date ledges. Ordinary card
  // art, text, controls, collisions, utility decisions and rendering remain
  // unchanged; full-map geometry and locomotion have separate regressions.
  await page.locator(".public-day .day-strip > strong,.studio-day .studio-day-head > strong").evaluateAll(nodes => {
    for (const node of nodes) (node as HTMLElement).style.visibility = "hidden";
  });
  // A native user drop starts near an ordinary card; autonomous jumping then
  // chooses a real text ledge. The held drop itself is ineligible for a mishap.
  await dropNearAnOrdinaryCard(page); await observe(page);
  // A normal utility-selected walk/jump must finish on an ordinary card.
  // The test controls only its random draw, then observes native animation
  // frames and the actual card effect rather than dispatching a play command.
  await expect.poll(() => page.evaluate(() => {
    const frames = (window as MotionWindow).motionRhythmProbe!.frames;
    return frames.some((frame, index) => ["bump", "slip", "tumble"].includes(frame.play) && ["walk", "jump"].includes(frames[index - 1]?.state));
  }), { timeout: 35000, intervals: [50] }).toBe(true);
  await expect(companion(page)).toHaveAttribute("data-play", /bump|slip|tumble/);
  const contact = await page.evaluate(() => {
    const frames = (window as MotionWindow).motionRhythmProbe!.frames;
    const index = frames.findIndex((frame, i) => ["bump", "slip", "tumble"].includes(frame.play) && ["walk", "jump"].includes(frames[i - 1]?.state));
    return { before: frames[index - 1], after: frames[index] };
  });
  expect(contact.after.at - contact.before.at).toBeLessThanOrEqual(100);
  expect(contact.after.platform).toMatch(/^card-/);
  if (cardPrank) {
    await expect(page.locator("[data-vc-ruffled]")).toHaveCount(1);
    await page.screenshot({ path: `${prefix}-${surface}-natural-contact-on.png` });
    const card = page.locator("[data-vc-ruffled]"); await card.click();
    await expect(page.locator("[data-vc-ruffled]")).toHaveCount(0);
  } else {
    await expect(companion(page)).not.toHaveAttribute("data-play", /bump|slip|tumble/, { timeout: 2500 });
    await expect(page.locator("[data-vc-ruffled]")).toHaveCount(0);
    const frames = await page.evaluate(() => (window as MotionWindow).motionRhythmProbe!.frames);
    expect(frames.some(frame => ["bump", "slip", "tumble"].includes(frame.play))).toBe(true);
    expect(frames.every(frame => frame.ruffled === 0)).toBe(true);
    await page.screenshot({ path: `${prefix}-${surface}-natural-contact-off.png` });
  }
  const frames = await page.evaluate(() => (window as MotionWindow).motionRhythmProbe!.frames);
  expect(frames.filter(frame => !frame.visible || !frame.same)).toEqual([]);
});
