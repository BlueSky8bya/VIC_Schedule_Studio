import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Frame = { at: number; x: number; y: number; state: string; platform: string; pose: string; presence: string; hidden: boolean; journey: boolean; waiting: boolean; focus: boolean; visibility: string; transform: string; dream: string[]; animations: { time: number | null; state: string }[] };
type JourneyTrace = Window & { companionJourneyTrace: { at: number; attribute: string; previous: string | null; current: string | null }[]; companionJourneyObserver: MutationObserver };
const actor = (page: Page) => page.locator(".vc-companion .vc-actor");
const pet = (page: Page) => page.locator(".vc-companion");
const evidence = new WeakMap<Page, { writes: string[]; errors: string[]; frames: Frame[] }>();
test.use({ viewport: { width: 1920, height: 480 }, headless: false, isMobile: false, hasTouch: false, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  test.setTimeout(95_000);
  const proof = { writes: [] as string[], errors: [] as string[], frames: [] as Frame[] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
  await page.addInitScript(({ preferences, care, key, epoch }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: true, jump: true, sleep: true, heartPrank: false, cardPrank: false, panelPrank: false, ambientPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .1, energy: .85 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const folder = `.scratch-pw/companion-099/${build}`; mkdirSync(folder, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 120);
  const journeyTrace = await page.evaluate(() => { const w = window as unknown as JourneyTrace; w.companionJourneyObserver?.disconnect(); return w.companionJourneyTrace ?? []; }).catch(() => []);
  const proof = evidence.get(page)!;
  writeFileSync(`${folder}/${name}.json`, JSON.stringify({ build, title: info.title, status: info.status, ...proof, longestUnchangingMs: frozenSpan(proof.frames), hiddenFrames: proof.frames.filter(frame => frame.hidden).length, journeyTrace, blockedRecoveryObserved: journeyTrace.some(record => record.attribute === "data-home-waiting" && (record.previous !== null || record.current !== null)) }, null, 2));
  await page.screenshot({ path: `${folder}/${name}.png` }).catch(() => {});
});
async function snapshot(page: Page) {
  const frame = await pet(page).evaluate(node => {
    const el = node as HTMLElement, rect = el.getBoundingClientRect(), pose = el.querySelector(".vc-pose");
    return { at: performance.now(), x: rect.x, y: rect.y, state: el.dataset.state ?? "", platform: el.dataset.platform ?? "", pose: el.dataset.pose ?? "", presence: el.dataset.presence ?? "", hidden: el.hidden, journey: el.hasAttribute("data-home-journey"), waiting: el.hasAttribute("data-home-waiting"), focus: document.hasFocus(), visibility: document.visibilityState, transform: pose ? getComputedStyle(pose).transform : "", dream: [...el.querySelectorAll(".vc-dream i")].map(node => `${getComputedStyle(node).transform}/${getComputedStyle(node).opacity}`), animations: pose?.getAnimations().map(animation => ({ time: typeof animation.currentTime === "number" ? animation.currentTime : null, state: animation.playState })) ?? [] };
  }); evidence.get(page)!.frames.push(frame); return frame;
}
async function open(page: Page, surface: "viewer" | "studio") {
  // Playwright normally installs focus emulation on every Chromium page.
  // Remove that harness default so real window activation owns this test.
  const nativeFocus = await page.context().newCDPSession(page);
  await nativeFocus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await expect(actor(page)).toBeVisible();
  await pet(page).evaluate(node => {
    const w = window as unknown as JourneyTrace; w.companionJourneyTrace = [];
    w.companionJourneyObserver = new MutationObserver(records => { for (const record of records) w.companionJourneyTrace.push({ at: performance.now(), attribute: record.attributeName ?? "", previous: record.oldValue, current: node.getAttribute(record.attributeName!) }); });
    w.companionJourneyObserver.observe(node, { attributes: true, attributeOldValue: true, attributeFilter: ["data-home-journey", "data-home-waiting"] });
  });
  const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true }); if (await launcher.isVisible()) await launcher.click();
  // Opening the actual room has a finite focus handoff. Wait before the
  // placement input, then prove that the real keyboard command was accepted.
  await page.waitForTimeout(600); await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", ""); await page.mouse.click(850, 430); await page.mouse.move(1190, 430);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  // The preparation/placement may cancel an earlier idea. Only observe
  // automatic attempts after the chosen real floor is established.
  await page.evaluate(() => { (window as unknown as JourneyTrace).companionJourneyTrace.length = 0; });
}
function frozenSpan(frames: Frame[]) {
  let longest = 0, since = frames[0]?.at ?? 0, previous = "";
  for (const frame of frames) {
    const key = frame.hidden ? "hidden" : [Math.round(frame.x * 10), Math.round(frame.y * 10), frame.pose, frame.state, frame.transform, ...frame.dream].join("/");
    if (key !== previous) { since = frame.at; previous = key; }
    longest = Math.max(longest, frame.at - since);
  } return longest;
}
for (const surface of ["viewer", "studio"] as const) test(`${surface} native active short viewport remains visible and alive through 65 seconds of spontaneous behavior`, async ({ page }) => {
  await open(page, surface); const start = Date.now();
  while (Date.now() - start < 65_000) { await snapshot(page); await page.waitForTimeout(120); }
  const proof = evidence.get(page)!;
  expect(proof.frames.every(frame => frame.focus && frame.visibility === "visible"), "PRECONDITION: every sample uses actual foreground focus and visibility").toBe(true);
  expect(proof.frames.every(frame => !frame.hidden), "the active fixture has no enabled hiding prank or withdrawn room; the creature remains rendered").toBe(true);
  // Random native movement may reach a higher date before the eight-second
  // low-perch recovery lease. Preserve the actual attribute trace as separate
  // branch evidence, rather than pretending every run enters that branch or
  // forcing RNG/brain state just to satisfy a coverage assertion.
  expect(frozenSpan(proof.frames), "visible position, expression and compositor breathing must not freeze together for a minute").toBeLessThan(6000);
  expect(proof.writes).toEqual([]); expect(proof.errors).toEqual([]);
});

test("actual visible window blur finishes its action then sleeps with CSS breathing and wakes without relocation", async ({ page, browser }) => {
  await open(page, "viewer");
  // A second browser context creates a separate native window. No fake
  // hasFocus, visibility, clock, scheduler or random source is installed.
  const otherContext = await browser.newContext(); const other = await otherContext.newPage();
  try {
    const nativeFocus = await otherContext.newCDPSession(other);
    await nativeFocus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await other.goto("about:blank"); await other.bringToFront();
    await expect.poll(() => page.evaluate(() => ({ focus: document.hasFocus(), visibility: document.visibilityState })), { message: "PRECONDITION: actual blurred but visible native window" }).toEqual({ focus: false, visibility: "visible" });
    await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 15_000 });
    const initial = await snapshot(page);
    // Monitor actual DOM writes after the finite handoff. CSS animations
    // must continue even when the JS world is quiescent.
    await pet(page).evaluate(node => {
      const w = window as unknown as { companionMutationCount: number; companionMutationObserver: MutationObserver };
      w.companionMutationCount = 0; w.companionMutationObserver = new MutationObserver(records => { w.companionMutationCount += records.length; });
      w.companionMutationObserver.observe(node, { subtree: true, attributes: true, childList: true });
    });
    const start = Date.now(); while (Date.now() - start < 5200) { await snapshot(page); await page.waitForTimeout(140); }
    const writes = await page.evaluate(() => { const w = window as unknown as { companionMutationCount: number; companionMutationObserver: MutationObserver }; w.companionMutationObserver.disconnect(); return w.companionMutationCount; });
    const frames = evidence.get(page)!.frames;
    expect(frames.every(frame => !frame.hidden && !frame.focus && frame.visibility === "visible" && frame.presence === "parked")).toBe(true);
    expect(new Set(frames.map(frame => frame.transform)).size).toBeGreaterThan(10);
    expect(new Set(frames.map(frame => frame.dream.join("/"))).size).toBeGreaterThan(10);
    expect(writes, "parked breathing and zzZ have no per-frame DOM writes").toBe(0);
    await page.bringToFront(); await expect(pet(page)).toHaveAttribute("data-presence", "active", { timeout: 5000 });
    const woke = await snapshot(page); expect(Math.hypot(woke.x - initial.x, woke.y - initial.y)).toBeLessThan(5);
    expect(evidence.get(page)!.writes).toEqual([]); expect(evidence.get(page)!.errors).toEqual([]);
  } finally { await otherContext.close(); }
});
