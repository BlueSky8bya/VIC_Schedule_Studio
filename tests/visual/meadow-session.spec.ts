import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { enterCompanionMeadow, placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";

const output = process.env.MEADOW_SESSION_OUTPUT ?? (process.env.COMPANION_QA_OUTPUT ? `${process.env.COMPANION_QA_OUTPUT}/meadow-session` : ".scratch-pw/meadow-session-proof");
const fonts = new Set([...readFileSync("app/fonts.css", "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
// Keep the real video, explicit PNGs and read-only input/paint receipts. Per-API
// DOM snapshots can space actual pressed input beyond a deliberate fling.
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", video: { mode: "on", size: { width: 1920, height: 1080 } }, trace: { mode: "retain-on-failure", snapshots: false, screenshots: false, sources: true } });
test.setTimeout(110000);
test.beforeEach(async ({ page, context, baseURL }, info) => {
  mkdirSync(output, { recursive: true }); const origin = new URL(baseURL!).origin;
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, []);
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Credential-free meadow ownership fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, epoch, epochKey, manual }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", v: 3, at: Date.now() }));
    localStorage.setItem("vic.ambient", "on"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.premiereStage", "off"); localStorage.setItem("vic_avatar_side", "left");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: manual, feeding: true, heartPrank: false, ambientPrank: false, activeWhileVisible: true, personality: "balanced", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care, fullness: .98, energy: manual ? .4 : .95 }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, manual: info.title === "meadow viewer: real pet gestures and concurrent physical item releases keep original care and painted motion" });
});

type MeadowInputWitness = {
  phase: string; began: number;
  inputs: { phase: string; type: string; at: number; stamp: number; x: number; y: number; buttons: number; trusted: boolean; pointerId: number; targetActor: boolean; captured: boolean; target: string; kind: string; id: string; coalesced: { stamp: number; x: number; y: number; buttons: number; trusted: boolean }[] }[];
  paints: { phase: string; at: number; row: string; pose: string; state: string; reaction: string; petting: string; ink: number; hash: number; paintedAt: string; x: number; y: number }[];
  items: { at: number; interval: number; objects: { kind: string; id: string; x: number; y: number; held: boolean; captured: boolean; pointerId?: number; visible: boolean; art: string; painted: boolean }[] }[];
  stop(): void;
};
type MeadowInputEvidence = Omit<MeadowInputWitness, "stop">;
type MeadowPlacementEvidence = {
  at: number; kind: string; id: string; platform: string; falling: string | null; point: { x: number; y: number }; hitSame: boolean;
  down?: { at: number; x: number; y: number; trusted: boolean; pointerId: number; sameTarget: boolean }; captured?: boolean;
};
type MeadowWitnessWindow = Window & { meadowInputWitness?: MeadowInputWitness; meadowInputHistory?: MeadowInputEvidence[]; meadowPlacements?: MeadowPlacementEvidence[] };
async function observeMeadowInput(page: Page, phase: string) {
  await page.evaluate(phase => {
    const scope = window as MeadowWitnessWindow, previousWitness = scope.meadowInputWitness;
    if (previousWitness) { previousWitness.stop(); const { phase, began, inputs, paints, items } = previousWitness; (scope.meadowInputHistory ??= []).push({ phase, began, inputs, paints, items }); }
    const actor = document.querySelector<HTMLElement>(".vc-meadow-walk")!, canvas = actor.querySelector<HTMLCanvasElement>("canvas")!;
    const inputs: MeadowInputWitness["inputs"] = [], paints: MeadowInputWitness["paints"] = [], items: MeadowInputWitness["items"] = [];
    let previous = "";
    const paint = () => {
      const key = [actor.dataset.row, actor.dataset.pose, actor.dataset.state, actor.dataset.reaction, actor.dataset.petting].join(":");
      if (key === previous || paints.length >= 500) return; previous = key;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0, hash = 2166136261;
      for (let index = 0; index < pixels.length; index++) { hash = Math.imul(hash ^ pixels[index], 16777619); if (index % 4 === 3 && pixels[index]) ink++; }
      const body = actor.querySelector(".vc-meadow-walk-body")!.getBoundingClientRect();
      paints.push({ phase, at: performance.now(), row: actor.dataset.row ?? "", pose: actor.dataset.pose ?? "", state: actor.dataset.state ?? "", reaction: actor.dataset.reaction ?? "", petting: actor.dataset.petting ?? "", paintedAt: actor.dataset.paintedAt ?? "", ink, hash: hash >>> 0, x: body.left + body.width / 2, y: body.bottom });
    };
    const input = (event: PointerEvent) => {
      if (inputs.length >= 1000) return;
      const target = event.target instanceof Element ? event.target : null, button = target?.closest<HTMLButtonElement>(".vc-meadow-walk-body,.vc-food,.vc-toy");
      const kind = button?.matches(".vc-food") ? "food" : button?.matches(".vc-toy") ? "toy" : button?.matches(".vc-meadow-walk-body") ? "pet" : "other";
      const coalesced = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents().slice(-64).map(sample => ({ stamp: sample.timeStamp, x: sample.clientX, y: sample.clientY, buttons: sample.buttons, trusted: sample.isTrusted })) : [];
      inputs.push({ phase, type: event.type, at: performance.now(), stamp: event.timeStamp, x: event.clientX, y: event.clientY, buttons: event.buttons, trusted: event.isTrusted, pointerId: event.pointerId, targetActor: kind === "pet", captured: button?.hasPointerCapture(event.pointerId) ?? false, target: target?.tagName ?? "none", kind, id: button?.dataset.food ?? button?.dataset.toyId ?? (kind === "pet" ? "pet" : ""), coalesced });
    };
    const observer = new MutationObserver(paint); observer.observe(actor, { attributes: true, attributeFilter: ["data-row", "data-pose", "data-state", "data-reaction", "data-petting", "data-painted-at"] });
    const inputEvents = ["pointerdown", "pointermove", "pointerup", "pointercancel", "gotpointercapture", "lostpointercapture"] as const;
    for (const type of inputEvents) document.addEventListener(type, input, true);
    const began = performance.now(); let frame = 0, previousItemAt = began;
    const sampleItems = () => {
      const objects = [...document.querySelectorAll<HTMLButtonElement>(".vc-food,.vc-toy")].map(node => {
        const rect = node.getBoundingClientRect(), image = node.querySelector<HTMLImageElement>("img"), artCanvas = node.querySelector<HTMLCanvasElement>("canvas");
        const art = node.querySelector<HTMLElement>(".vc-toy-axis-art,.vc-toy-art") ?? node.firstElementChild!;
        const canvasInk = artCanvas?.getContext("2d")?.getImageData(0, 0, artCanvas.width, artCanvas.height).data.some((value, index) => index % 4 === 3 && value > 0) ?? false;
        const kind = node.matches(".vc-food") ? "food" : "toy", id = node.dataset.food ?? node.dataset.toyId!;
        let pointerId: number | undefined;
        for (let index = inputs.length - 1; index >= 0; index--) if (inputs[index].type === "pointerdown" && inputs[index].kind === kind && inputs[index].id === id) { pointerId = inputs[index].pointerId; break; }
        return { kind, id, x: rect.left + rect.width / 2, y: rect.bottom, held: node.hasAttribute("data-showcase-held"), captured: pointerId !== undefined && node.hasPointerCapture(pointerId), pointerId, visible: !node.hidden && Boolean(node.getClientRects().length), art: getComputedStyle(art).transform, painted: Boolean(image?.complete && image.naturalWidth > 0 || node.querySelector("svg") || canvasInk) };
      });
      const at = performance.now(); items.push({ at, interval: at - previousItemAt, objects }); previousItemAt = at;
      if (items.length < 420 && performance.now() - began < 6000) frame = requestAnimationFrame(sampleItems);
    };
    if (phase.startsWith("same-layer")) frame = requestAnimationFrame(sampleItems);
    scope.meadowInputWitness = { phase, began, inputs, paints, items, stop() { observer.disconnect(); cancelAnimationFrame(frame); for (const type of inputEvents) document.removeEventListener(type, input, true); } };
    paint();
  }, phase);
}
async function meadowInputEvidence(page: Page) {
  return page.evaluate(() => { const value = (window as MeadowWitnessWindow).meadowInputWitness!; return { phase: value.phase, began: value.began, inputs: value.inputs, paints: value.paints, items: value.items }; });
}
test.afterEach(async ({ page }, info) => {
  const evidence = await page.evaluate(() => {
    const scope = window as MeadowWitnessWindow, value = scope.meadowInputWitness, placements = scope.meadowPlacements ?? [];
    if (!value) return placements.length ? { phase: "setup-placement", placements } : undefined;
    value.stop(); return { phase: value.phase, began: value.began, inputs: value.inputs, paints: value.paints, items: value.items, previousPhases: scope.meadowInputHistory ?? [], placements };
  }).catch(() => undefined);
  if (evidence) writeFileSync(`${output}/${info.title.replace(/[^a-z0-9]+/gi, "-")}-actual-input.json`, JSON.stringify({ status: info.status, ...evidence, scope: "Read-only actual trusted native pointer receipt times and current canvas RGBA; no synthetic pointer dispatch, engine/clock/RNG or sampler edits." }, null, 2));
});

type NativeThrowTarget = { kind: "pet" | "food" | "toy"; id: string; selector: string; x: number; y: number };
async function nativeFastThrow(mouse: CDPSession, target: NativeThrowTarget) {
  await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y, button: "none", buttons: 0, modifiers: 0, force: 0 });
  await mouse.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", buttons: 1, modifiers: 0, force: .5, clickCount: 1 });
  // This CDP read avoids inserting a traced Playwright DOM snapshot between
  // one object's finite flight and the next object's real capture.
  const capture = await mouse.send("Runtime.evaluate", { expression: `(() => { const target = ${JSON.stringify(target)}, node = document.querySelector(target.selector), input = window.meadowInputWitness?.inputs.findLast(e => e.type === "pointerdown" && e.kind === target.kind && e.id === target.id); return { down: input, captured: Boolean(input && node?.hasPointerCapture(input.pointerId)) }; })()`, returnByValue: true });
  const actual = capture.result.value as { down?: { trusted: boolean }; captured: boolean };
  expect(actual.down?.trusted, "the actual native pointerdown must hit this same real object").toBe(true); expect(actual.captured).toBe(true);
  // Ordered native commands run against the real browser clock. Awaiting each
  // traced protocol reply serialized this physical gesture into slow placement.
  const moves: Promise<unknown>[] = [];
  for (let step = 1; step <= 8; step++) {
    moves.push(mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y - step * 14, button: "left", buttons: 1, modifiers: 0, force: .5 }));
    if (step < 8) await new Promise(resolve => setTimeout(resolve, 5));
  }
  // Queue the real release before awaiting browser acknowledgements: waiting
  // here created an actual stationary tail, rather than a fast native fling.
  moves.push(mouse.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y - 112, button: "left", buttons: 0, modifiers: 0, clickCount: 1 }));
  await Promise.all(moves);
}
function nativeReleaseEvidence(evidence: MeadowInputEvidence, target: Pick<NativeThrowTarget, "kind" | "id">) {
  const owned = evidence.inputs.filter(sample => sample.kind === target.kind && sample.id === target.id), down = [...owned].reverse().find(sample => sample.type === "pointerdown")!;
  expect(down?.trusted).toBe(true);
  const up = owned.find(sample => sample.type === "pointerup" && sample.at > down.at)!; expect(up?.trusted).toBe(true);
  const moves = owned.filter(sample => sample.type === "pointermove" && sample.buttons === 1 && sample.captured && sample.trusted && sample.at >= down.at && sample.at <= up.at);
  expect(moves.length, "trusted pressed movement must reach this same real captured object").toBeGreaterThanOrEqual(1);
  const gaps = moves.slice(1).map((sample, index) => sample.at - moves[index].at), releaseGap = up.at - moves.at(-1)!.at;
  // These are diagnostic receipt times, not a second implementation of the
  // velocity sampler. Actual free flight below distinguishes fling from place.
  return { down, up, moves, gaps, releaseGap, receivedSpan: moves.at(-1)!.at - moves[0].at };
}

async function dragTo(page: Page, item: Locator, point: { x: number; y: number }) {
  await expect(item).toBeVisible();
  const kind = await item.evaluate(node => node.matches(".vc-food") ? "food" : node.matches(".vc-toy") ? "toy" : "pet");
  if (kind === "food") await expect(item).not.toHaveAttribute("data-falling");
  if (kind === "toy") await expect(item).toHaveAttribute("data-falling", "false");
  const bounds = kind === "pet" ? (await item.boundingBox())! : await settledBox(item), grip = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const index = await item.evaluate((node, point) => {
    const scope = window as MeadowWitnessWindow, target = document.elementFromPoint(point.x, point.y), element = node as HTMLElement;
    const record: MeadowPlacementEvidence = { at: performance.now(), kind: element.matches(".vc-food") ? "food" : element.matches(".vc-toy") ? "toy" : "pet", id: element.dataset.food ?? element.dataset.toyId ?? "pet", platform: element.dataset.platform ?? "", falling: element.getAttribute("data-falling"), point, hitSame: Boolean(target && (node === target || node.contains(target))) };
    const records = scope.meadowPlacements ??= []; records.push(record);
    document.addEventListener("pointerdown", event => { record.down = { at: performance.now(), x: event.clientX, y: event.clientY, trusted: event.isTrusted, pointerId: event.pointerId, sameTarget: event.target instanceof Node && (event.target === node || node.contains(event.target)) }; }, { capture: true, once: true });
    return records.length - 1;
  }, grip);
  expect(await item.evaluate((_node, index) => (window as MeadowWitnessWindow).meadowPlacements![index].hitSame, index), "fresh placement hit must identify the intended stable real object").toBe(true);
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  const capture = await item.evaluate((node, index) => { const record = (window as MeadowWitnessWindow).meadowPlacements![index]; record.captured = Boolean(record.down && node.hasPointerCapture(record.down.pointerId)); return record; }, index);
  expect(capture.down?.trusted).toBe(true); expect(capture.down?.sameTarget).toBe(true); expect(capture.captured, "this exact real object must own the placement drag").toBe(true);
  await page.mouse.move(point.x, point.y, { steps: 14 }); await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2);
}

test("meadow viewer: real pet gestures and concurrent physical item releases keep original care and painted motion", async ({ page }, info) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1920, height: 1100 }); await page.goto("/visual-fixture/poster?ambient=spring"); await page.bringToFront();
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const home = await openCompanionHome(page), fold = home.locator('[data-home-action="fold"]');
  if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
  await placeCompanionOnHomeFloor(page);
  const foods = page.locator(".vc-food"), toys = page.locator(".vc-toy"), pet = page.locator(".vc-meadow-walk"), actor = pet.locator(".vc-meadow-walk-body");
  // Admit each original item only after its real home fall and placement finish.
  // Two snacks share a dispenser point; visible alone can hit the newer snack.
  for (const [kind, x] of [["food", 90], ["toy", 210], ["food", 140], ["toy", 260]] as const) {
    const items = kind === "food" ? foods : toys, before = await items.count();
    await home.getByRole("button", { name: kind === "food" ? "밥 꺼내기" : "장난감 상자 열기", exact: true }).click();
    await expect(items).toHaveCount(before + 1);
    const item = items.nth(before); await dragTo(page, item, { x, y: 990 }); await expect(item).toHaveAttribute("data-platform", /^viewport-floor/);
  }
  await expect(foods).toHaveCount(2); await expect(toys).toHaveCount(2);
  await placeCompanionOnExposedBackground(page, 280); const originalFoot = await foot(page.locator(".vc-companion"));
  await enterCompanionMeadow(page); await expect(actor).toBeVisible();
  const identity = { foods: await foods.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food!)), toys: await toys.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.toyId!)) };
  const witness = async (name: string) => {
    const painted = await pet.evaluate(node => {
      const canvas = node.querySelector("canvas")!, data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261, ink = 0;
      for (let index = 0; index < data.length; index++) { hash = Math.imul(hash ^ data[index], 16777619); if (index % 4 === 3 && data[index]) ink++; }
      const element = node as HTMLElement;
      return { row: element.dataset.row, pose: element.dataset.pose, state: element.dataset.state, reaction: element.dataset.reaction, paintedAt: element.dataset.paintedAt, pixels: { hash: hash >>> 0, ink }, body: node.querySelector<HTMLElement>(".vc-pose")!.style.transform };
    });
    expect(painted.pixels.ink).toBeGreaterThan(100); await page.screenshot({ path: `${output}/manual-${name}.png` }); return painted;
  };
  const stages: Record<string, unknown> = {};
  await expect(pet).toHaveAttribute("data-state", "idle");
  const firstFoot = await foot(actor); expect(firstFoot.y).toBeGreaterThan(page.viewportSize()!.height * .5);
  await actor.focus(); await actor.press("Enter"); await expect(pet).toHaveAttribute("data-row", "29"); stages.pet = await witness("pet-personality-bow");
  await expect(pet).toHaveAttribute("data-reaction", "none", { timeout: 5000 });
  await actor.click(); await expect(pet).toHaveAttribute("data-row", "27"); stages.tap = await witness("short-tap-tears");
  const careEnergy = () => page.evaluate(() => Number(JSON.parse(localStorage.getItem("vic.viewerCompanionCare") ?? "{}").energy));
  const energyBeforeNap = await careEnergy();
  await actor.focus(); await actor.press("n"); await expect(pet).toHaveAttribute("data-state", "sleep"); stages.sleep = await witness("nap");
  await expect(pet).toHaveAttribute("data-state", "wake", { timeout: 18000 }); stages.wake = await witness("wake");
  const energyAfterNap = await careEnergy(); expect(energyAfterNap).toBeGreaterThan(energyBeforeNap); stages.restedCare = { energyBeforeNap, energyAfterNap };
  await expect(pet).toHaveAttribute("data-state", "idle");
  await observeMeadowInput(page, "real-shake");
  const shakeBox = (await actor.boundingBox())!, grip = { x: shakeBox.x + shakeBox.width / 2, y: shakeBox.y + shakeBox.height / 2 };
  // Native CDP input avoids Playwright's four awaited intermediate protocol
  // roundtrips per leg. Receive time remains the browser's real clock; the
  // witness below must prove the unchanged physical sampler's timing window.
  const mouse = await page.context().newCDPSession(page);
  await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: grip.x, y: grip.y, button: "none", buttons: 0, modifiers: 0, force: 0 });
  await mouse.send("Input.dispatchMouseEvent", { type: "mousePressed", x: grip.x, y: grip.y, button: "left", buttons: 1, modifiers: 0, force: .5, clickCount: 1 });
  const pressEvidence = await meadowInputEvidence(page), down = pressEvidence.inputs.find(sample => sample.type === "pointerdown" && sample.trusted && sample.targetActor);
  expect(down, "native pointerdown must hit this actual resident before any shake loop").toBeTruthy();
  expect(await actor.evaluate((button, pointerId) => button.hasPointerCapture(pointerId), down!.pointerId), "the actual resident must own native pointer capture after pointerdown").toBe(true);
  let lastX = grip.x;
  for (const side of [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1]) {
    lastX = grip.x + side * 55;
    await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: lastX, y: grip.y, button: "left", buttons: 1, modifiers: 0, force: .5 });
    await new Promise(resolve => setTimeout(resolve, 45));
  }
  await new Promise(resolve => setTimeout(resolve, 180));
  await mouse.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: lastX, y: grip.y, button: "left", buttons: 0, clickCount: 1 });
  await mouse.detach(); await page.mouse.move(2, 2);
  const shakeEvidence = await meadowInputEvidence(page), received = shakeEvidence.inputs.filter(sample => sample.type === "pointermove" && sample.buttons === 1 && sample.targetActor && sample.captured);
  expect(shakeEvidence.inputs.some(sample => sample.type === "gotpointercapture" && sample.trusted && sample.targetActor), "pressed native movement must activate the same resident's capture").toBe(true);
  expect(received.length, "actual native moves must arrive at the captured resident").toBeGreaterThanOrEqual(8);
  expect(received.every(sample => sample.trusted), "browser must receive real trusted native input").toBe(true);
  const gaps = received.slice(1).map((sample, index) => sample.at - received[index].at);
  expect(Math.max(...gaps), "environment/fixture timing: real received shake legs must fit the unchanged 160ms sampler gate").toBeLessThanOrEqual(160);
  expect(received.at(-1)!.at - received[0].at).toBeGreaterThanOrEqual(280);
  stages.shakeInput = { ...shakeEvidence, gaps };
  await expect(pet).toHaveAttribute("data-reaction", "dizzy"); stages.shake = await witness("shake-dizzy");
  await expect(pet).toHaveAttribute("data-reaction", "none", { timeout: 5000 });
  const escapeBox = (await actor.boundingBox())!;
  await page.mouse.move(escapeBox.x + escapeBox.width / 2, escapeBox.y + escapeBox.height / 2); await page.mouse.down(); await page.mouse.move(escapeBox.x + escapeBox.width / 2 + 30, escapeBox.y + escapeBox.height / 2);
  await expect(actor).toHaveAttribute("data-showcase-held", ""); await page.keyboard.press("Escape"); await expect(actor).not.toHaveAttribute("data-showcase-held"); await page.mouse.up();
  await expect(page.locator("html")).toHaveAttribute("data-showcase", "1"); stages.pointerEscape = await witness("pointer-escape-release");
  const releaseMouse = await page.context().newCDPSession(page), pairProofs: unknown[] = [];
  for (const kind of ["food", "toy"] as const) {
    await observeMeadowInput(page, `same-layer-${kind}`);
    const targets = await page.evaluate(kind => [...document.querySelectorAll<HTMLButtonElement>(kind === "food" ? ".vc-food" : ".vc-toy")].map(node => {
      const box = node.getBoundingClientRect(), id = node.dataset.food ?? node.dataset.toyId!;
      return { kind, id, selector: `[${kind === "food" ? "data-food" : "data-toy-id"}=${JSON.stringify(id)}]`, x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }), kind);
    expect(targets).toHaveLength(2);
    // No Playwright DOM snapshot or late bounding-box read between A's real
    // release and B's grab: a bounded reader samples the actual overlap RAFs.
    await nativeFastThrow(releaseMouse, targets[0]); await nativeFastThrow(releaseMouse, targets[1]);
    const screenshot = await releaseMouse.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`${output}/manual-${kind}-after-second-release.png`, Buffer.from(screenshot.data, "base64"));
    await new Promise(resolve => setTimeout(resolve, 2000));
    const evidence = await meadowInputEvidence(page), throws = targets.map(target => nativeReleaseEvidence(evidence, target));
    const arcs = targets.map((target, index) => {
      const frames = evidence.items.filter(frame => frame.at > throws[index].up.at).flatMap(frame => frame.objects.filter(item => item.kind === kind && item.id === target.id && !item.held && item.visible).map(item => ({ at: frame.at, ...item })));
      expect(frames.length, "each released real object must retain visible sampled frames").toBeGreaterThanOrEqual(3);
      const highest = frames.reduce((best, frame) => frame.y < best.y ? frame : best);
      expect(frames[0].y - highest.y, "each actual released object must rise in free flight rather than stay at its placed point").toBeGreaterThan(5);
      expect(frames.some(frame => frame.at > highest.at && frame.y > highest.y + 5), "each actual flight must descend after its visible rise").toBe(true);
      expect(frames.some(frame => frame.painted && !["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(frame.art)), "each real object must show its original art in motion").toBe(true);
      return { frames, highest };
    });
    const overlaps = evidence.items.filter(frame => frame.at >= throws[0].up.at).flatMap(frame => {
      const a = frame.objects.find(item => item.kind === kind && item.id === targets[0].id), b = frame.objects.find(item => item.kind === kind && item.id === targets[1].id);
      return a && b && a.visible && b.visible && !a.held && !a.captured && b.captured ? [{ at: frame.at, a, b }] : [];
    });
    expect(overlaps.length, "same-layer A must remain visible while the actual native pointer captures B").toBeGreaterThanOrEqual(2);
    const displacement = Math.max(...overlaps.map(frame => Math.hypot(frame.a.x - overlaps[0].a.x, frame.a.y - overlaps[0].a.y)));
    expect(displacement, "A's real finite flight must continue during B's hold, not freeze when B is grabbed").toBeGreaterThan(5);
    expect(overlaps.some(frame => frame.a.painted && !["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(frame.a.art)), "the original real art must paint its flight rotation during the overlap").toBe(true);
    const secondFree = evidence.items.filter(frame => frame.at > throws[1].up.at).flatMap(frame => frame.objects.filter(item => item.kind === kind && item.id === targets[1].id && !item.held && item.visible));
    expect(secondFree.some(item => item.painted && !["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(item.art))).toBe(true);
    const first = page.locator(targets[0].selector), second = page.locator(targets[1].selector), landed = [await settledBox(first), await settledBox(second)];
    await first.focus(); const beforeNext = await foot(first); await first.press("Enter"); await expect(first).toHaveAttribute("data-showcase-held", ""); await first.press("ArrowRight"); await first.press("Enter"); await expect(first).not.toHaveAttribute("data-showcase-held");
    const afterNext = await foot(first); expect(afterNext.x - beforeNext.x).toBeCloseTo(16, 1);
    expect(await page.locator(kind === "food" ? ".vc-food" : ".vc-toy").evaluateAll((nodes, kind) => nodes.map(node => kind === "food" ? (node as HTMLElement).dataset.food : (node as HTMLElement).dataset.toyId), kind)).toEqual(kind === "food" ? identity.foods : identity.toys);
    pairProofs.push({ kind, targets, throws, arcs, overlaps, displacement, evidence, landed, beforeNext, afterNext, sameIdsRetained: true });
  }
  await releaseMouse.detach(); stages.concurrentSameLayerPairs = pairProofs;
  await actor.focus(); await actor.press("n"); await expect(pet).toHaveAttribute("data-state", "sleep"); await actor.press("Space");
  await expect(actor).toHaveAttribute("data-showcase-held", ""); stages.wakeByGrab = await witness("wake-by-grab"); await actor.press("Space");
  expect(errors).toEqual([]);
  writeFileSync(`${output}/viewer-manual-interactions.json`, JSON.stringify({ test: info.title, originalFoot, firstFoot, stages, errors, scope: "Actual unpatched native input, original sprite canvas pixels and real item image transforms. Shared care owner, finite gestures/nap/wake/shake, captured Escape and independent same-ID item releases. Not all9 personalities/allAI/full certification.", fullCertification: false }, null, 2));
});
async function foot(item: Locator) { const box = (await item.boundingBox())!; return { x: box.x + box.width / 2, y: box.y + box.height }; }
async function settledBox(item: Locator) {
  let previous: Awaited<ReturnType<Locator["boundingBox"]>>, stable = 0;
  await expect.poll(async () => {
    const current = await item.boundingBox();
    stable = current && previous && Math.max(Math.abs(current.x - previous.x), Math.abs(current.y - previous.y), Math.abs(current.width - previous.width), Math.abs(current.height - previous.height)) < .25 ? stable + 1 : 0;
    previous = current; return stable;
  }, { intervals: [60], timeout: 5000 }).toBeGreaterThanOrEqual(3);
  return previous!;
}
async function layoutCovers(page: Page) {
  return page.evaluate(() => {
    const selector = ".public-calendar-area,.public-calendar-header,.studio-calendar-panel,.studio-topbar,.studio-titlebar,.weekday-row,.studio-weekdays,.panel-section,.rail-info-card,.soop-live-beacon,.vc-home,.event-editor-panel,[role=dialog],button,a[href],input,select,textarea";
    return [...document.querySelectorAll<HTMLElement>(selector)].filter(node => {
      if (node.closest("[hidden],[aria-hidden=true],.vc-companion,.vc-meadow-walk,.vc-food-layer,.vc-toys,.gs-season,.gs-tide,.showcase-surface")) return false;
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) { const s = getComputedStyle(parent); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity || 1) <= .05) return false; }
      return true;
    }).map(node => { const r = node.getBoundingClientRect(); return { className: node.className, label: node.getAttribute("aria-label"), x: r.x, y: r.y, width: r.width, height: r.height }; }).filter(r => r.width > 0 && r.height > 0);
  });
}
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > .5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > .5;

for (const surface of ["viewer", "owner", "preview"] as const) {
  test(`meadow ${surface}: resident departs and covered placements retire on shower-pad return`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1920, height: 1100 });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : `/visual-fixture/studio?role=owner&y=2026&m=4${surface === "preview" ? "&viewer=1" : ""}`);
    await page.bringToFront(); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const home = await openCompanionHome(page), fold = home.locator('[data-home-action="fold"]');
    if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
    await placeCompanionOnHomeFloor(page);
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    let food = page.locator(".vc-food").first(), toy = page.locator(".vc-toy").first();
    const pet = page.locator(".vc-meadow-walk"), drawing = pet.locator(".vc-meadow-walk-body");
    await expect(food).toBeVisible(); await expect(food).not.toHaveAttribute("data-falling");
    await expect(toy).toBeVisible(); await expect(toy).toHaveAttribute("data-falling", "false");
    const identity = { food: await food.getAttribute("data-food"), toy: await toy.getAttribute("data-toy-id") };
    await enterCompanionMeadow(page);
    await expect(pet).toBeVisible(); await expect(pet).toHaveAttribute("data-state", "idle"); await expect(food).toBeHidden(); await expect(toy).toBeHidden();
    await expect(food).not.toHaveAttribute("data-showcase-lease"); await expect(toy).not.toHaveAttribute("data-showcase-lease");
    await page.keyboard.press("Escape"); await expect(food).toBeVisible(); await expect(toy).toBeVisible();

    // Native drag throws settle on the actual screen floor before admission.
    await dragTo(page, food, { x: 90, y: 990 }); await expect(food).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/, { timeout: 7000 });
    await dragTo(page, toy, { x: 180, y: 990 }); await expect(toy).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/, { timeout: 7000 });
    await placeCompanionOnExposedBackground(page, 280);
    const entryFoot = await foot(page.locator(".vc-companion"));
    await enterCompanionMeadow(page); await expect(pet).toBeVisible(); await expect(food).toBeVisible(); await expect(toy).toBeVisible();
    await expect(pet).toHaveAttribute("data-state", "idle");
    const admittedFoot = await foot(drawing);
    expect(admittedFoot.y).toBeGreaterThan(page.viewportSize()!.height * .5);
    await expect(food).toHaveAttribute("data-showcase-lease", ""); await expect(toy).toHaveAttribute("data-showcase-lease", "");
    // Fresh credential-free fixture care only: this acknowledges the same
    // resident, not merely an attractive pose in a disconnected puppet.
    const careAffection = () => page.evaluate(() => Number(JSON.parse(localStorage.getItem("vic.viewerCompanionCare") ?? "{}").affection));
    const careBefore = await careAffection(); await drawing.focus(); await drawing.press("Enter");
    await expect(pet).toHaveAttribute("data-reaction", "bow"); await expect.poll(careAffection).toBeGreaterThan(careBefore);
    const careAfter = await careAffection(); await expect(pet).toHaveAttribute("data-reaction", "none", { timeout: 5000 });
    const beforeStroke = await careAffection(); await observeMeadowInput(page, "real-hover-stroke");
    const stroke = (await drawing.boundingBox())!;
    for (const ratio of [.3, .7, .3, .7]) { await page.mouse.move(stroke.x + stroke.width * ratio, stroke.y + stroke.height * .45, { steps: 5 }); await page.waitForTimeout(75); }
    await expect.poll(careAffection, { message: "real back-and-forth stroke must reach the same resident care owner" }).toBeGreaterThan(beforeStroke);
    await expect.poll(async () => (await meadowInputEvidence(page)).paints.some(sample => sample.state === "petted" && sample.row === "16" && sample.ink > 100), { message: "accepted stroke must decode and paint the current shared personality response" }).toBe(true);
    const strokeEvidence = await meadowInputEvidence(page);
    expect(strokeEvidence.inputs.filter(sample => sample.type === "pointermove" && sample.targetActor && sample.trusted && sample.buttons === 0).length).toBeGreaterThanOrEqual(4);
    expect(strokeEvidence.paints.some(sample => sample.at >= strokeEvidence.began && sample.state === "petted" && sample.row === "16" && sample.ink > 100), "accepted balanced stroke must paint its actual shared stretch response").toBe(true);
    await page.screenshot({ path: `${output}/${surface}-actual-hover-response.png` }); await page.mouse.move(2, 2);
    await drawing.focus(); await drawing.press("Space"); await expect(drawing).toHaveAttribute("data-showcase-held", "");
    const heldBefore = await foot(drawing); await drawing.press("ArrowLeft"); await drawing.press("Escape");
    await expect(drawing).not.toHaveAttribute("data-showcase-held"); await expect(page.locator("html")).toHaveAttribute("data-showcase", "1");
    const heldAfter = await foot(drawing); expect(heldBefore.x - heldAfter.x).toBeCloseTo(16, 1);
    await drawing.press("p"); await expect(drawing).toHaveAttribute("data-showcase-placing", "");
    await page.mouse.click(entryFoot.x, entryFoot.y); await page.mouse.move(2, 2); await expect(drawing).not.toHaveAttribute("data-showcase-placing");
    const pointPlaced = await foot(drawing); expect(Math.hypot(pointPlaced.x - entryFoot.x, pointPlaced.y - entryFoot.y)).toBeLessThan(2);
    let actualThrow: unknown;
    if (surface === "viewer") {
      await observeMeadowInput(page, "real-pet-fling");
      const start = (await drawing.boundingBox())!, grip = { x: start.x + start.width / 2, y: start.y + start.height / 2 }, mouse = await page.context().newCDPSession(page);
      const target: NativeThrowTarget = { kind: "pet", id: "pet", selector: ".vc-meadow-walk-body", ...grip };
      await nativeFastThrow(mouse, target); await mouse.detach();
      await expect.poll(async () => (await meadowInputEvidence(page)).paints.some(sample => sample.state === "jump" && sample.row === "32" && sample.ink > 100), { message: "actual qualified pet throw must decode and paint its airborne source" }).toBe(true);
      const evidence = await meadowInputEvidence(page), timing = nativeReleaseEvidence(evidence, target), firstFlight = evidence.paints.find(sample => sample.state === "jump" && sample.row === "32" && sample.ink > 100)!;
      const flyingFoot = { x: firstFlight.x, y: firstFlight.y }; await expect(pet).toHaveAttribute("data-state", "idle", { timeout: 5000 });
      const landedFoot = await foot(drawing); expect(Math.hypot(flyingFoot.x - landedFoot.x, flyingFoot.y - landedFoot.y)).toBeGreaterThan(30);
      // The landed body can cover its old entry foot. A P click on that body
      // is a pet interaction, not a completed background placement.
      const clearPoint = await page.evaluate(({ entryFoot, width, height }) => {
        for (const x of [entryFoot.x + 140, entryFoot.x - 140, entryFoot.x + 280]) {
          const hit = document.elementFromPoint(x, entryFoot.y);
          if (x > width / 2 && x < innerWidth - width / 2 && entryFoot.y > height && entryFoot.y < innerHeight - 8
            && hit && !hit.closest('button,input,select,textarea,[role=dialog]')) return { x, y: entryFoot.y };
        }
      }, { entryFoot, width: start.width, height: start.height });
      expect(clearPoint, "the native P destination must be exposed background outside all actual controls").toBeTruthy();
      await drawing.focus(); await drawing.press("p"); await expect(drawing).toHaveAttribute("data-showcase-placing", "");
      await page.mouse.click(clearPoint!.x, clearPoint!.y); await page.mouse.move(2, 2); await expect(drawing).not.toHaveAttribute("data-showcase-placing");
      const intermediateFoot = await foot(drawing); expect(Math.hypot(intermediateFoot.x - clearPoint!.x, intermediateFoot.y - clearPoint!.y)).toBeLessThan(2);
      expect(await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y) && !document.elementFromPoint(point.x, point.y)!.closest('button,input,select,textarea,[role=dialog]')), entryFoot)).toBe(true);
      await drawing.press("p"); await expect(drawing).toHaveAttribute("data-showcase-placing", "");
      await page.mouse.click(entryFoot.x, entryFoot.y); await page.mouse.move(2, 2); await expect(drawing).not.toHaveAttribute("data-showcase-placing");
      const returnedFoot = await foot(drawing); expect(Math.hypot(returnedFoot.x - entryFoot.x, returnedFoot.y - entryFoot.y)).toBeLessThan(2);
      actualThrow = { grip, timing, evidence, flyingFoot, landedFoot, clearPoint, intermediateFoot, returnedFoot, row: 32, continued: "same pet completes native P placement on exposed background, then returns to its exact entry foot after finite native throw" };
    }
    for (const item of [food, toy]) {
      await item.focus(); await item.press("Enter"); await expect(item).toHaveAttribute("data-showcase-held", "");
      await item.press("ArrowUp"); await item.press("Enter"); await expect(item).not.toHaveAttribute("data-showcase-held");
    }
    const interactions = { entryFoot, admittedFoot, careBefore, careAfter, stroke: { beforeStroke, afterStroke: await careAffection(), ...strokeEvidence }, heldBefore, heldAfter, pointPlaced, actualThrow, actual: "Native Enter petting reaches same resident care, real mouse out/back strokes with actual care and current canvas-source response, keyboard hold/arrows/first-Escape retains appreciation, P places same pet at exact grass foot, real food/toy Enter hold/drop; viewer actual timed pointer throw/row32/landing then P. No engine or clock patches." };
    const keyboard: Record<string, { before: { x: number; y: number }; after: { x: number; y: number } }> = {};
    for (const [kind, item] of [["food", food], ["toy", toy], ["pet", drawing]] as const) {
      await item.focus(); const before = await foot(item); await item.press("ArrowRight"); const after = await foot(item);
      expect(after.x - before.x).toBeCloseTo(16, 1); expect(after.y - before.y).toBeCloseTo(0, 1);
      keyboard[kind] = { before, after };
    }
    const calendar = page.locator(surface === "owner" ? ".studio-calendar-panel" : ".public-calendar-area").first();
    const cover = (await calendar.boundingBox())!, target = { x: cover.x + cover.width * .52, y: Math.min(900, cover.y + cover.height * .55) };
    await dragTo(page, food, { x: target.x - 90, y: target.y }); await dragTo(page, toy, { x: target.x + 90, y: target.y }); await dragTo(page, drawing, { x: target.x, y: target.y - 100 });
    const placed = { food: await foot(food), toy: await foot(toy), pet: await foot(drawing) };
    await page.keyboard.press("Escape"); await expect(food).toHaveCount(0); await expect(toy).toHaveCount(0); await expect(pet).toHaveCount(0);
    await expect(page.locator(".vc-companion")).toBeVisible(); await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home-floor-400");
    const retiredIdentity = { ...identity };
    await expect(home).toBeVisible(); await expect(home.locator('[data-home-action="toys"]')).toBeEnabled();
    const beforeDispense = { foods: await page.locator(".vc-food").count(), toys: await page.locator(".vc-toy").count() };
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    await expect(page.locator(".vc-food")).toHaveCount(beforeDispense.foods + 1);
    // The homecoming resident now stands in front of this storage opening.
    // Use its native keyboard activation rather than clicking through a pet.
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".vc-toy")).toHaveCount(beforeDispense.toys + 1);
    await expect(page.locator(".vc-toy").last()).toHaveAttribute("data-falling", "false", { timeout: 7000 });
    food = page.locator(".vc-food").last(); toy = page.locator(".vc-toy").last();
    await expect(food).not.toHaveAttribute("data-falling");
    identity.food = await food.getAttribute("data-food"); identity.toy = await toy.getAttribute("data-toy-id");
    await dragTo(page, food, { x: 90, y: 990 }); await dragTo(page, toy, { x: 180, y: 990 });
    await expect(food).not.toHaveAttribute("data-falling"); await expect(toy).toHaveAttribute("data-falling", "false");
    await expect(food).toHaveAttribute("data-platform", /^viewport-floor/); await expect(toy).toHaveAttribute("data-platform", /^viewport-floor/);
    await enterCompanionMeadow(page); await expect(pet).toHaveAttribute("data-state", "idle");
    await expect(food).toBeVisible(); await expect(toy).toBeVisible(); await expect(pet).toBeVisible();
    const restored = { food: await foot(food), toy: await foot(toy), pet: await foot(drawing) };
    await expect(page.locator(`[data-food="${retiredIdentity.food}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${retiredIdentity.toy}"]`)).toHaveCount(0);
    await expect(food).toHaveAttribute("data-food", identity.food!); await expect(toy).toHaveAttribute("data-toy-id", identity.toy!);
    await page.screenshot({ path: `${output}/${surface}-restored-placements.png` });
    let dynamicCover: unknown;
    if (surface === "viewer") {
      // At 1280px the ordinary calendar fills x20..1260. There was no
      // exposed grass at x220, so that earlier fixture correctly hid items.
      // Instead measure a real layout change: expanding the native tag card
      // pushes the house over a previously exposed band of grass.
      await page.keyboard.press("Escape"); await expect(home).toBeVisible();
      const tags = page.locator('[data-panel-section-toggle="tag-filter"]:visible').first();
      if (await tags.getAttribute("aria-expanded") === "true") await tags.click();
      const oldHome = await settledBox(home);
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "true");
      const expandedHome = await settledBox(home);
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "false");
      const collapsedHome = await settledBox(home), viewport = page.viewportSize()!;
      const firstFoot = Math.max(collapsedHome.y + collapsedHome.height + 56, expandedHome.y + 56), lastFoot = Math.min(expandedHome.y + expandedHome.height - 8, viewport.height - 32);
      expect(lastFoot - firstFoot).toBeGreaterThan(4);
      const chosenFoot = (firstFoot + lastFoot) / 2;
      await enterCompanionMeadow(page); await expect(food).toBeVisible(); await expect(toy).toBeVisible();
      for (const [item, fraction] of [[food, .25], [toy, .65]] as const) {
        const box = (await item.boundingBox())!;
        await dragTo(page, item, { x: collapsedHome.x + collapsedHome.width * fraction, y: chosenFoot - box.height / 2 });
      }
      await page.keyboard.press("Escape"); await expect(food).toBeVisible(); await expect(toy).toBeVisible();
      await expect(food).toHaveJSProperty("hidden", false); await expect(toy).toHaveJSProperty("hidden", false);
      const exposed = { food: (await food.boundingBox())!, toy: (await toy.boundingBox())! };
      const beforeCovers = await layoutCovers(page);
      for (const item of Object.values(exposed)) {
        expect(item.x >= 0 && item.y >= 0 && item.x + item.width <= viewport.width && item.y + item.height <= viewport.height).toBe(true);
        expect(beforeCovers.filter(cover => overlaps(item, cover))).toEqual([]);
      }
      await page.screenshot({ path: `${output}/viewer-before-dynamic-cover.png` });
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "true");
      const coveringHome = await settledBox(home);
      for (const item of Object.values(exposed)) expect(overlaps(item, coveringHome)).toBe(true);
      // These are the real item nodes' geometry visibility flags. A hidden
      // ancestor alone (for example a global modal pause) cannot satisfy this.
      await expect(food).toHaveJSProperty("hidden", true); await expect(toy).toHaveJSProperty("hidden", true);
      await expect(food).toBeHidden(); await expect(toy).toBeHidden();
      await page.screenshot({ path: `${output}/viewer-dynamic-cover.png` });
      await tags.click(); await expect(tags).toHaveAttribute("aria-expanded", "false"); await settledBox(home);
      await expect(food).toBeVisible(); await expect(toy).toBeVisible();
      await expect(food).toHaveJSProperty("hidden", false); await expect(toy).toHaveJSProperty("hidden", false);
      const uncovered = { food: (await food.boundingBox())!, toy: (await toy.boundingBox())! };
      for (const kind of ["food", "toy"] as const) expect(Math.hypot(exposed[kind].x - uncovered[kind].x, exposed[kind].y - uncovered[kind].y)).toBeLessThan(2);
      dynamicCover = { kind: "native-tag-expansion-shifts-real-house", viewport, oldHome, expandedHome, collapsedHome, beforeCovers, exposed, coveringHome, uncovered, childHiddenDuringCover: true, childHiddenAfterClose: false };
      await enterCompanionMeadow(page);
    }
    await food.focus(); await food.press("Delete"); await expect(page.locator(`[data-food="${identity.food}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(home).toBeVisible();
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
    await expect(pet).toHaveCount(0);
    await expect(page.locator(".vc-companion")).toBeVisible({ timeout: 7000 });
    const homeRecall = { releasedLease: true, actualVisible: true, platform: await page.locator(".vc-companion").getAttribute("data-platform"), state: await page.locator(".vc-companion").getAttribute("data-state") };
    const next = page.getByRole("button", { name: "다음 달", exact: true }).filter({ visible: true }).first();
    await next.click();
    await expect(page.locator(`[data-food="${identity.food}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${identity.toy}"]`)).toHaveCount(0); await expect(pet).toHaveCount(0);
    await page.reload(); await expect(page.locator(".vc-food,.vc-toy,.vc-meadow-walk")).toHaveCount(0);
    expect(errors).toEqual([]);
    writeFileSync(`${output}/${surface}-ownership.json`, JSON.stringify({ test: info.title, identity, retiredIdentity, interactions, keyboard, beforeDispense, placed, restored, dynamicCover, homeRecall, actual: "Native home dispense, actual drag and floor contact, pre-entry exclusion, exact original lower-left foot, real care-linked petting/stroking and keyboard interaction parity, each real object keyboard 16px movement, food Delete, covered exit permanently retires originals, shower-pad homecoming, and fresh exposed items survive re-entry with independently working home dispense, viewer native tag expansion moves the actual house over previously proven exposed objects (each child.hidden true then false), direct home recall releases lease and resumes visible ordinary actor, month departure and reload. No engine/RNG/clock/position patch; shower support is asserted after the covered return.", fullCertification: false }, null, 2));
  });
}
