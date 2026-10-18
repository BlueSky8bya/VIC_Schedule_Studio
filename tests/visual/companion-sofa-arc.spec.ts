import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Frame = { at: number; phase: string; x: number; y: number; row: number; state: string; platform: string; flight: boolean; journey: string; visible: boolean; same: boolean; frontVisible: boolean; frontAlignment: number; depth: string; focused: boolean };
type Probe = { frames: Frame[]; phase: string; raf: number; node: HTMLElement };
type ProbedWindow = Window & { sofaArcWitness?: Probe };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const room = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const record = new WeakMap<Page, { writes: string[]; errors: string[]; target?: unknown; frames?: Frame[] }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof = { writes: [] as string[], errors: [] as string[] }; record.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    // Device preferences only: no clocks, RNG, focus, coordinates, brain or
    // callbacks are supplied. The explicit recall owns the whole journey.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: true, jump: true, sleep: true, animalMode: "cat", feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .95, energy: 1 }));
    localStorage.setItem("vic.panelSections", JSON.stringify({ version: 1, "tag-filter": false, season: false, "companion-home": true }));
    localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
});

test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const probe = (window as ProbedWindow).sofaArcWitness; if (!probe) return []; cancelAnimationFrame(probe.raf); return probe.frames; }).catch(() => [] as Frame[]);
  record.get(page)!.frames = frames;
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const directory = `${process.env.VIC_SOFA_ARC_OUTPUT ?? ".scratch-pw/100-sofa-arc"}/${build}`, label = info.title.replace(/[^a-z0-9]+/gi, "-");
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/${label}.json`, JSON.stringify({ title: info.title, status: info.status, build, ...record.get(page) }, null, 2));
  await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true }).catch(() => {});
  expect(record.get(page)!.writes).toEqual([]); expect(record.get(page)!.errors).toEqual([]);
});

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
}
async function actualCard(page: Page, surface: Surface) {
  return page.evaluate(surface => {
    const root = document.querySelector(surface === "studio" ? ".studio-shell" : ".poster-page")!;
    const selector = surface === "studio" ? "[data-companion-event='ordinary'][data-eventid]" : ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
    const home = document.querySelector(".vc-home")!.getBoundingClientRect(), bed = document.querySelector(".vc-plush-bed")!.getBoundingClientRect(), seat = document.querySelector(".vc-home-cushion")!.getBoundingClientRect();
    const shown = (node: Element) => { const r = node.getBoundingClientRect(); for (let p: Element | null = node; p; p = p.parentElement) { const s = getComputedStyle(p); if (p.hasAttribute("hidden") || s.display === "none" || s.visibility !== "visible" || Number(s.opacity) <= .05) return false; } return r.width > 0 && r.height > 0; };
    const controls = [...root.querySelectorAll("button,a[href],input,select,textarea,[role='button']")].filter(node => shown(node) && !node.matches(`${selector},.public-day,.agenda-day,.studio-day`) && !node.closest(".vc-companion,.vc-cushion-button")).map(node => node.getBoundingClientRect());
    const candidates: { node: HTMLElement; x: number; y: number; distance: number }[] = [];
    for (const node of root.querySelectorAll<HTMLElement>(selector)) {
      if (!shown(node)) continue;
      const r = node.getBoundingClientRect(), y = r.top - 3;
      if (r.width < 110 || y < 120 || r.bottom > innerHeight - 60 || y < seat.top - 200 || y > seat.top + 240) continue;
      for (const fraction of [.5, .75, .25]) {
        const x = r.left + r.width * fraction, dx = Math.abs(x - (bed.left + bed.width / 2)), half = 92 * .76 / 2 + 3, height = 92 * .76 + 3;
        if (dx < 80 || dx > 400 || x < 50 || x > innerWidth - 50) continue;
        if (x - half < home.right && x + half > home.left && y > home.top && y - height < home.bottom) continue;
        if (controls.some(control => control.left < x + half && control.right > x - half && control.top < y + 3 && control.bottom > y - height)) continue;
        if (document.elementFromPoint(x, r.top + 2)?.closest(selector) !== node) continue;
        candidates.push({ node, x, y, distance: Math.hypot(dx, y - seat.top) });
      }
    }
    const picked = candidates.sort((a, b) => a.distance - b.distance)[0];
    if (!picked) return null;
    picked.node.setAttribute("data-test-sofa-route-card", "");
    const rect = picked.node.getBoundingClientRect();
    return { x: picked.x, y: picked.y, offsetX: picked.x - rect.left, home: { left: home.left, top: home.top, right: home.right, bottom: home.bottom }, bed: { left: bed.left, top: bed.top, right: bed.right, bottom: bed.bottom }, seatY: seat.top };
  }, surface);
}

async function probe(page: Page) {
  await pet(page).evaluate(node => {
    const proof: Probe = { node: node as HTMLElement, phase: "recall", frames: [], raf: 0 }, began = performance.now();
    const sample = () => {
      const el = node as HTMLElement, r = el.getBoundingClientRect(), bed = document.querySelector(".vc-home .vc-plush-bed")?.getBoundingClientRect();
      const front = document.querySelector<HTMLElement>(".vc-bed-foreground"), f = front?.getBoundingClientRect(), css = front && getComputedStyle(front);
      const image = el.querySelector<HTMLImageElement>(".vc-texture"), visible = !el.hidden && getComputedStyle(el).display !== "none" && Boolean(image?.complete && image.naturalWidth > 0);
      proof.frames.push({ at: performance.now() - began, phase: proof.phase, x: r.left + r.width / 2, y: r.bottom, row: Math.floor(Number(el.dataset.pose) / 16), state: el.dataset.state ?? "", platform: el.dataset.platform ?? "", flight: el.hasAttribute("data-sofa-flight"), journey: el.dataset.journey ?? "", visible, same: el.isConnected && el === document.querySelector(".vc-companion"), frontVisible: Boolean(front && !front.hidden && css?.display !== "none" && css?.visibility !== "hidden"), frontAlignment: bed && f ? Math.max(Math.abs(f.left - bed.left), Math.abs(f.top - bed.top), Math.abs(f.width - bed.width), Math.abs(f.height - bed.height)) : Infinity, depth: el.dataset.sofaDepth ?? "", focused: document.hasFocus() });
      proof.raf = requestAnimationFrame(sample);
    };
    (window as ProbedWindow).sofaArcWitness = proof; proof.raf = requestAnimationFrame(sample);
  });
}
async function frames(page: Page) { return page.evaluate(() => (window as ProbedWindow).sofaArcWitness!.frames); }
async function setPhase(page: Page, phase: string) { await page.evaluate(phase => { (window as ProbedWindow).sofaArcWitness!.phase = phase; }, phase); }
function jumpGroups(samples: readonly Frame[]) {
  const groups = new Map<string, Frame[]>();
  for (const sample of samples.filter(frame => frame.state === "jump" && [4, 5].includes(frame.row))) { const group = groups.get(sample.journey) ?? []; group.push(sample); groups.set(sample.journey, group); }
  return [...groups.values()];
}
function assertLateralArc(samples: readonly Frame[]) {
  const lateral = (group: readonly Frame[]) => Math.max(...group.map(frame => frame.x)) - Math.min(...group.map(frame => frame.x));
  // The real planner can approach via its floor, then enter the snug sofa
  // vertically. Test its lateral approach separately instead of inventing
  // sideways travel for that safe contained final lift.
  const flight = jumpGroups(samples).sort((a, b) => lateral(b) - lateral(a))[0] ?? [];
  expect(flight.length, "the actual recall needs12 native lateral ascent/descent samples").toBeGreaterThanOrEqual(12);
  expect(flight.every(frame => frame.visible && frame.same && frame.focused)).toBe(true);
  const moving = flight.slice(1).flatMap((frame, i) => { const previous = flight[i]; return Math.hypot(frame.x - previous.x, frame.y - previous.y) > .025 ? [{ dx: Math.abs(frame.x - previous.x), dy: Math.abs(frame.y - previous.y) }] : []; });
  expect(moving.length).toBeGreaterThanOrEqual(10);
  expect(lateral(flight), "the measured approach must actually travel laterally").toBeGreaterThan(8);
  expect(moving.filter(delta => delta.dx > .01 && delta.dy > .01).length / moving.length, "lateral flight must move both axes instead of lift/plateau/drop stages").toBeGreaterThan(.85);
}
function assertMeasuredSofaEntry(samples: readonly Frame[]) {
  const entry = jumpGroups(samples.filter(frame => frame.flight)).sort((a, b) => b.length - a.length)[0] ?? [];
  expect(entry.length, "the actual safe sofa entry needs12 native ascent/descent samples").toBeGreaterThanOrEqual(12);
  expect(entry.every(frame => frame.visible && frame.same && frame.focused)).toBe(true);
  expect(Math.max(...entry.map(frame => frame.y)) - Math.min(...entry.map(frame => frame.y))).toBeGreaterThan(8);
  // Same-x entry is valid, but the old sampler's long level middle stage is
  // not. Anticipation and settled landing rows are excluded from this trace.
  let unchangedSince = entry[0].at, anchorY = entry[0].y, longestPlateau = 0;
  for (const frame of entry.slice(1)) {
    if (Math.abs(frame.y - anchorY) > .01) { unchangedSince = frame.at; anchorY = frame.y; }
    else longestPlateau = Math.max(longestPlateau, frame.at - unchangedSince);
  }
  expect(longestPlateau, "sofa ascent/descent must not pause on a level passage plateau").toBeLessThan(110);
  const speeds = entry.slice(1).flatMap((frame, index) => {
    const previous = entry[index], seconds = (frame.at - previous.at) / 1000;
    return seconds > .006 && seconds < .1 && frame.phase === previous.phase ? [Math.hypot(frame.x - previous.x, frame.y - previous.y) / seconds] : [];
  });
  // Allow ordinary browser sampling/registration quantization. The launch
  // function constrains the exact analytical curve to330x/650y px/sec.
  expect(Math.max(...speeds), "actual entry must not squeeze a large clearance arc into a generic short jump").toBeLessThan(900);
}
async function assertSeated(page: Page) {
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 25000 });
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => pet(page).evaluate(node => Math.abs(node.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => {
    const front = document.querySelector<HTMLElement>(".vc-bed-foreground")!, bed = document.querySelector(".vc-home .vc-plush-bed")!.getBoundingClientRect(), f = front.getBoundingClientRect();
    return !front.hidden ? Math.max(Math.abs(f.left - bed.left), Math.abs(f.top - bed.top), Math.abs(f.width - bed.width), Math.abs(f.height - bed.height)) : Infinity;
  })).toBeLessThan(1.5);
}
for (const surface of ["viewer", "studio"] as const) for (const reflow of [false, true]) test(`${surface} native sofa recall${reflow ? " survives rail reflow during its route" : " uses a lateral arc and measured sofa entry"}`, async ({ page }) => {
  test.setTimeout(55000);
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster?avatar=1");
  await page.bringToFront(); await expect(actor(page)).toBeVisible(); await openCompanionHome(page); await settled(page); await page.waitForTimeout(180);
  const target = await actualCard(page, surface); record.get(page)!.target = target;
  expect(target, "fixture requires a real nearby card with a92px-body-clear top").not.toBeNull();
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(target!.x, target!.y - 8); await page.mouse.move(1850, 1000);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await probe(page);
  const cushion = room(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await cushion.focus(); await cushion.press("Enter");
  if (reflow) {
    await expect.poll(() => frames(page).then(samples => samples.filter(frame => frame.state === "jump" && [4, 5].includes(frame.row)).length), { timeout: 15000, intervals: [20] }).toBeGreaterThanOrEqual(14);
    await expect(pet(page)).toHaveAttribute("data-state", "jump");
    // Move the real room during the chosen route. Its actual planner owns
    // the floor detour, safe entry and finite replan throughout.
    await setPhase(page, "reflow"); await page.getByRole("button", { name: "태그 필터", exact: true }).click();
    await settled(page);
  }
  await assertSeated(page); await expect(pet(page)).not.toHaveAttribute("data-home-journey");
  await expect(pet(page)).not.toHaveAttribute("data-sofa-flight");
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toBeInViewport({ ratio: .9 }); await expect(pet(page)).toHaveCount(1);
  const samples = await frames(page);
  assertLateralArc(samples); assertMeasuredSofaEntry(samples);
  expect(samples.length).toBeGreaterThan(12); expect(samples.every(frame => frame.same && frame.visible)).toBe(true);
  if (reflow) expect(samples.some(frame => frame.phase === "reflow" && frame.platform === "companion-home")).toBe(true);
  for (const sample of samples.filter(frame => frame.frontVisible)) expect(sample.frontAlignment, "an exposed sofa front must follow its current real room").toBeLessThan(2.5);
});
