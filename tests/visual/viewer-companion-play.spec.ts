import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import playSprites from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import { PREMIERE_STAGE_KEY, SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type PlayFrame = { at: number; same: boolean; visible: boolean; state: string; play: string; beat: string; atlas: string; row: string; platform: string; x: number; foot: number };
type PlayInput = { type: string; at: number; x: number; y: number; trusted: boolean; captured: boolean };
type PlayProbe = { node: HTMLElement; stopped: boolean; raf: number; frames: PlayFrame[]; inputs: PlayInput[]; listener: (event: PointerEvent) => void };
type PlayWindow = Window & { companionPlayProbe?: PlayProbe; companionPlayChanges?: { animalMode: string; personality: string; speed: string }[]; companionPlayInitial?: Element };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const prefix = process.env.COMPANION_PLAY_PREFIX ?? ".scratch-pw/companion-068-play";
const proof = new WeakMap<Page, { blocked: string[]; errors: string[]; reads: number }>();
const packet = (row: number) => playSprites.atlases[row - playSprites.rowOffset].src;

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false });
test.beforeEach(async ({ page }) => {
  const result = { blocked: [] as string[], errors: [] as string[], reads: 0 }; proof.set(page, result);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const reads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(reads.size).toBe(1);
  page.on("pageerror", error => result.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && reads.has(request.headers()["next-action"])) {
      result.reads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { result.blocked.push(`${request.method()} ${pathname}`); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }, info) => {
  const observations = await page.evaluate(() => {
    const probe = (window as PlayWindow).companionPlayProbe;
    if (!probe) return null;
    probe.stopped = true; cancelAnimationFrame(probe.raf);
    for (const event of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) document.removeEventListener(event, probe.listener, true);
    return { frames: probe.frames, inputs: probe.inputs };
  });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 90)}.json`, JSON.stringify({ ...proof.get(page), observations }, null, 2));
  expect(proof.get(page)?.blocked).toEqual([]); expect(proof.get(page)?.errors).toEqual([]);
});

async function setup(page: Page, surface: Surface) {
  await page.addInitScript(({ epoch, key, premiereKey, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, [premiereKey]: "off", "vic.ambient": "off", "vic.sound": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, premiereKey: PREMIERE_STAGE_KEY,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await expect(pet(page)).toHaveCount(1); await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}
async function observe(page: Page) {
  await pet(page).evaluate(node => {
    const probe: PlayProbe = { node: node as HTMLElement, stopped: false, raf: 0, frames: [], inputs: [], listener: () => {} };
    probe.listener = event => {
      const button = node.querySelector<HTMLButtonElement>(".vc-actor")!;
      if (!button.contains(event.target as Node)) return;
      probe.inputs.push({ type: event.type, at: performance.now(), x: event.clientX, y: event.clientY, trusted: event.isTrusted, captured: button.hasPointerCapture(event.pointerId) });
    };
    for (const event of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) document.addEventListener(event, probe.listener, { capture: true, passive: true });
    const sample = () => {
      if (probe.stopped) return;
      const current = document.querySelector<HTMLElement>(".vc-companion"), css = getComputedStyle(probe.node), rect = probe.node.getBoundingClientRect();
      probe.frames.push({ at: performance.now(), same: current === probe.node, visible: probe.node.isConnected && !probe.node.hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity) > .05 && rect.width > 0 && rect.height > 0,
        state: probe.node.dataset.state ?? "", play: probe.node.dataset.play ?? "", beat: probe.node.dataset.playBeat ?? "", atlas: (probe.node.querySelector<HTMLElement>(".vc-sprite")?.style.backgroundImage ?? ""), row: probe.node.style.getPropertyValue("--vc-row"), platform: probe.node.dataset.platform ?? "", x: rect.left + rect.width / 2, foot: rect.bottom });
      probe.raf = requestAnimationFrame(sample);
    };
    (window as PlayWindow).companionPlayProbe = probe; probe.raf = requestAnimationFrame(sample);
  });
}
async function standOnRealSeat(page: Page) {
  // Cushion recall deliberately shares the user's sleep gate. This fixture
  // exercises the real command; it must not ask a disabled command to move it.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).sleep)).toBe(true);
  const home = await openCompanionHome(page, "keyboard");
  await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await home.evaluate(async node => {
    await Promise.allSettled(node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  let previous: number[] | undefined, readyAt = Date.now();
  await expect.poll(async () => {
    const next = await home.evaluate(node => {
      const room = node.querySelector(".vc-home-room")!.getBoundingClientRect(), seat = node.querySelector(".vc-home-cushion")!.getBoundingClientRect();
      return [room.left, room.top, room.width, room.height, seat.left, seat.top, seat.width, seat.height];
    });
    if (!previous || next.some((value, index) => Math.abs(value - previous![index]) > .01)) readyAt = Date.now();
    previous = next;
    return next[2] > 0 && next[3] > 0 && next[6] > 0 && next[7] > 0 ? Date.now() - readyAt : 0;
  }, { intervals: [40], timeout: 5000 }).toBeGreaterThanOrEqual(140);
  const snapshot = () => page.evaluate(() => {
    const box = (selector: string) => { const rect = document.querySelector(selector)?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; };
    const node = document.querySelector<HTMLElement>(".vc-companion");
    return { at: performance.now(), state: node?.dataset.state, support: node?.dataset.platform, home: box(".vc-home"), room: box(".vc-home-room"), seat: box(".vc-home-cushion"), pet: box(".vc-companion"), announcement: node?.querySelector('[role="status"]')?.textContent ?? "" };
  });
  const before = await snapshot();
  const cushion = home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  try {
    await cushion.focus(); await cushion.press("Enter");
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    let stableAt = Date.now();
    await expect.poll(async () => {
      const error = await page.evaluate(() => {
        const body = document.querySelector<HTMLElement>(".vc-companion")!, seat = document.querySelector<HTMLElement>(".vc-home-cushion")!;
        return Math.abs(body.getBoundingClientRect().bottom - seat.getBoundingClientRect().top);
      });
      if (error > 1) stableAt = Date.now();
      return error <= 1 ? Date.now() - stableAt : 0;
    }, { intervals: [40], timeout: 5000 }).toBeGreaterThanOrEqual(140);
  } finally {
    await writeFile(`${prefix}-seat-${test.info().title.replace(/[^a-z0-9]+/gi, "-").slice(0, 90)}.json`, JSON.stringify({ before, after: await snapshot() }, null, 2));
  }
}
async function shortClick(page: Page) {
  await actor(page).click({ delay: 70 });
  // A single exit is not a stroke or a second tap. Do not keep a stationary
  // hover over a crying pet while waiting for its independent finite action.
  await page.mouse.move(5, 5);
  await expect(pet(page)).toHaveAttribute("data-play", "bonk-tears");
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} native short clicks show tears and recover, while a real drag interrupts immediately`, async ({ page }) => {
  await setup(page, surface); await standOnRealSeat(page); await observe(page);
  await shortClick(page);
  await expect(pet(page)).toHaveAttribute("data-play-beat", "checking");
  await expect.poll(() => pet(page).locator(".vc-sprite").evaluate(node => (node as HTMLElement).style.backgroundImage)).toContain(packet(27));
  await page.screenshot({ path: `${prefix}-${surface}-tears.png` });
  await expect(pet(page)).toHaveAttribute("data-play-beat", "recover");
  await expect.poll(() => pet(page).locator(".vc-sprite").evaluate(node => (node as HTMLElement).style.backgroundImage)).toContain(packet(23));
  await expect(pet(page)).not.toHaveAttribute("data-play", "bonk-tears", { timeout: 5000 });
  await expect(pet(page)).toBeVisible();
  await page.screenshot({ path: `${prefix}-${surface}-recovered.png` });
  await shortClick(page);
  const box = await actor(page).boundingBox(); expect(box).not.toBeNull();
  const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height * .45 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  // Lift on the same actual seat's vertical ray, so release safety does not
  // accidentally depend on an unrelated dispenser/control column nearby.
  await page.mouse.move(start.x, Math.max(150, start.y - 85), { steps: 10 });
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-play", "bonk-tears");
  await expect.poll(() => page.evaluate(() => {
    const inputs = (window as PlayWindow).companionPlayProbe!.inputs, down = inputs.filter(input => input.type === "pointerdown").at(-1)!;
    const last = inputs.at(-1)!;
    return last.captured && Math.hypot(last.x - down.x, last.y - down.y) > 6;
  })).toBe(true);
  await page.screenshot({ path: `${prefix}-${surface}-interrupted-held.png` });
  await page.mouse.up(); await page.mouse.move(5, 5);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-play", "bonk-tears");
  await expect(pet(page)).toBeVisible();
  const observations = await page.evaluate(() => (window as PlayWindow).companionPlayProbe!.frames);
  expect(observations.length).toBeGreaterThan(20);
  expect(observations.filter(frame => !frame.visible || !frame.same)).toEqual([]);
  const inputs = await page.evaluate(() => (window as PlayWindow).companionPlayProbe!.inputs);
  expect(inputs.every(input => input.trusted)).toBe(true);
  const firstDown = inputs.find(input => input.type === "pointerdown")!, firstUp = inputs.find(input => input.type === "pointerup")!;
  expect(firstUp.at - firstDown.at).toBeLessThanOrEqual(350);
  expect(Math.hypot(firstUp.x - firstDown.x, firstUp.y - firstDown.y)).toBeLessThanOrEqual(6);
});

test("viewer and studio expose all three independent behavior axes through the same native settings controls", async ({ page }) => {
  for (const surface of ["viewer", "studio"] as const) {
    await setup(page, surface);
    await page.evaluate(() => {
      const scope = window as PlayWindow; scope.companionPlayChanges = []; scope.companionPlayInitial = document.querySelector(".vc-companion")!;
      window.addEventListener("vic:viewer-companion", event => {
        const detail = (event as CustomEvent<{ animalMode: string; personality: string; speed: string }>).detail;
        scope.companionPlayChanges!.push({ animalMode: detail.animalMode, personality: detail.personality, speed: detail.speed });
      });
    });
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
    await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
    const panel = dialog.locator("#rhh-tab-companion-panel");
    await panel.getByRole("tab", { name: "성격", exact: true }).click();
    const groups = [
      { name: "빅타민 동물 모드", key: "animalMode", options: [["고양이", "cat"], ["강아지", "dog"], ["빅타민", "default"]] },
      { name: "빅타민 성격", key: "personality", options: [["잠꾸러기", "sleepy"], ["애교쟁이", "affectionate"], ["호기심", "curious"]] },
      { name: "빅타민 걸음", key: "speed", options: [["느긋하게", "relaxed"], ["발랄하게", "lively"], ["보통", "normal"]] },
    ];
    for (const group of groups) {
      if (group.key === "speed") await panel.getByRole("tab", { name: "움직임", exact: true }).click();
      const controls = panel.getByRole("radiogroup", { name: group.name, exact: true });
      for (const [label, value] of group.options) {
        const radio = controls.getByRole("radio", { name: label, exact: true }); await radio.click(); await expect(radio).toBeChecked();
        await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem("vic.viewerCompanion")!)[key], group.key)).toBe(value);
        await expect(controls.getByRole("radio", { checked: true })).toHaveCount(1);
      }
    }
    await expect(panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toBeChecked();
    const changes = await page.evaluate(() => (window as PlayWindow).companionPlayChanges!);
    expect(changes).toHaveLength(9);
    await page.screenshot({ path: `${prefix}-${surface}-settings.png` });
    const close = dialog.getByRole("button", { name: "닫기", exact: true }); await close.focus(); await close.press("Enter");
    await expect(dialog).toHaveCount(0); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector(".vc-companion") === (window as PlayWindow).companionPlayInitial)).toBe(true);
    // Studio retains the inactive editor shell; only a newly opened visible
    // editor would contradict this settings-only interaction contract.
    await expect(page.locator(".event-editor-panel:visible,.m-edit-sheet:visible")).toHaveCount(0);
  }
});

test("studio native short click during a real released fall keeps falling, lands and finishes its expression", async ({ page }) => {
  await setup(page, "studio"); await standOnRealSeat(page); await observe(page);
  const source = await actor(page).boundingBox(); expect(source).not.toBeNull();
  const start = { x: source!.x + source!.width / 2, y: source!.y + source!.height * .45 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 180, { steps: 12 });
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.mouse.up();
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  // mouse.click intentionally has no locator-stability wait: this native tap
  // is on a genuinely moving actor, not a debug action or synthetic event.
  const during = await actor(page).boundingBox(); expect(during).not.toBeNull();
  const down = { x: during!.x + during!.width / 2, y: during!.y + during!.height * .45 };
  expect(await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest(".vc-actor")), down)).toBe(true);
  const before = await pet(page).evaluate(node => node.getBoundingClientRect().bottom);
  await page.mouse.click(down.x, down.y, { delay: 50 }); await page.mouse.move(5, 5);
  await expect(pet(page)).toHaveAttribute("data-play", "bonk-tears");
  await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
  await expect.poll(() => pet(page).evaluate(node => node.getBoundingClientRect().bottom)).toBeGreaterThan(before + 8);
  await expect.poll(() => page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".vc-companion")!, seat = document.querySelector<HTMLElement>(".vc-home-cushion")!;
    return Math.abs(body.getBoundingClientRect().bottom - seat.getBoundingClientRect().top);
  }), { timeout: 2000 }).toBeLessThanOrEqual(1);
  await expect(pet(page)).toHaveAttribute("data-play", "bonk-tears");
  await expect(pet(page)).toHaveAttribute("data-play-beat", "checking");
  await expect.poll(() => pet(page).locator(".vc-sprite").evaluate(node => (node as HTMLElement).style.backgroundImage)).toContain(packet(27));
  await page.screenshot({ path: `${prefix}-studio-midair-contact.png` });
  await expect(pet(page)).not.toHaveAttribute("data-play", "bonk-tears", { timeout: 5000 });
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  const frames = await page.evaluate(() => (window as PlayWindow).companionPlayProbe!.frames);
  const falling = frames.filter(frame => frame.play === "bonk-tears");
  expect(falling.length).toBeGreaterThan(10);
  expect(Math.max(...falling.map(frame => frame.foot)) - Math.min(...falling.map(frame => frame.foot))).toBeGreaterThan(20);
  expect(frames.filter(frame => !frame.visible || !frame.same)).toEqual([]);
});
