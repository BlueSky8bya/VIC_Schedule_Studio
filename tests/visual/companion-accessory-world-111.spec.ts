import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { currentCompanionAccessory, type CompanionAccessoryId } from "@/lib/ui/viewer-companion/accessory-catalog";
import { getCompanionAccessoryArtFrame } from "@/lib/ui/viewer-companion/accessory-art";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { expectCompanionBehindOverlay, waitForOverlayEntrance } from "./helpers/companion-overlay";

const output = process.env.VIC_ACCESSORY_WORLD_OUTPUT ?? ".scratch-pw/companion-111/world";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
type Frame = { at: number; state: string; trick: string; beat: string; pose: string; platform: string; play: string; episode: string; phase: string; variant: string; food: string; goal: string; x: number; y: number; bob: number; visible: boolean; worn: boolean; fronts: string[]; snacks: Array<{ id: string; x: number; y: number; hidden: boolean; falling: boolean }> };
type ProbeWindow = Window & { accessory111?: { frames: Frame[]; timer: number; stop: boolean } };
test.use({ headless: true, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.setTimeout(100_000);

async function setup(page: Page, id: CompanionAccessoryId, moving = false, feeding = false) {
  const errors: string[] = [], writes: string[] = [], origins = new Set<string>();
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url()); origins.add(url.origin);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    return route.continue();
  });
  await page.addInitScript(({ id, moving, feeding, prefs, care, epoch, key, collectionKey }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: moving, jump: moving, sleep: !moving, feeding, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: true, speed: "lively" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, energy: .95, affection: .5, hunger: feeding ? .55 : .1 }));
    localStorage.setItem(collectionKey, JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { pending: null, unlocked: [id], equipped: id, activeMs: 0, interactionCredit: 0 } }));
  }, { id, moving, feeding, prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, collectionKey: COMPANION_COLLECTION_KEY });
  await page.goto("/visual-fixture/poster"); await page.bringToFront(); await settlePanelLayout(page);
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3117");
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "active");
  expect(await page.evaluate(() => document.hasFocus() && !document.hidden)).toBe(true);
  mkdirSync(output, { recursive: true });
  return { build, errors, writes, origins };
}

async function worn(page: Page, raw: CompanionAccessoryId) {
  const id = currentCompanionAccessory(raw), src = getCompanionAccessoryArtFrame(id)!.src;
  await expect(pet(page)).toHaveAttribute("data-accessory", id);
  await expect.poll(() => pet(page).evaluate((node, src) => {
    const el = node as HTMLElement, layers = [...node.querySelectorAll<HTMLElement>(".vc-wearable-back,.vc-wearable-front")].filter(layer => !layer.hidden);
    return el.dataset.pose === el.dataset.accessoryPose && layers.length > 0 && layers.every(layer => layer.parentElement === node.querySelector(".vc-pose") && getComputedStyle(layer).backgroundImage.includes(src));
  }, src)).toBe(true);
  await expect(pet(page)).toHaveCSS("width", "92px");
}

async function place(page: Page, x: number, y: number) {
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(x, y); await page.mouse.move(1880, 50);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 7000 }); await expect(pet(page)).toBeVisible();
}

async function observe(page: Page) {
  await pet(page).evaluate(node => {
    const el = node as HTMLElement, probe = { frames: [] as Frame[], timer: 0, stop: false };
    const sample = () => {
      if (probe.stop) return;
      const m = new DOMMatrixReadOnly(el.style.transform), pose = el.querySelector<HTMLElement>(".vc-pose")!, transform = new DOMMatrixReadOnly(getComputedStyle(pose).transform), size = parseFloat(el.style.getPropertyValue("--vc-size"));
      const layers = [...el.querySelectorAll<HTMLElement>(".vc-wearable-back,.vc-wearable-front")].filter(layer => !layer.hidden);
      const snacks = [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => { const p = new DOMMatrixReadOnly(node.style.transform); return { id: node.dataset.food ?? "", x: p.m41, y: p.m42, hidden: node.hidden, falling: node.hasAttribute("data-falling") }; });
      probe.frames.push({ at: performance.now(), state: el.dataset.state ?? "", trick: el.dataset.accessoryTrick ?? "", beat: el.dataset.accessoryBeat ?? "", pose: el.dataset.pose ?? "", platform: el.dataset.platform ?? "", play: el.dataset.play ?? "", episode: el.dataset.episode ?? "", phase: el.dataset.episodePhase ?? "", variant: el.dataset.episodeVariant ?? "", food: el.dataset.episodeFood ?? "", goal: el.dataset.foodGoal ?? "", x: m.m41 + size / 2, y: m.m42 + size, bob: transform.m42, visible: el.isConnected && !el.hidden && getComputedStyle(el).visibility !== "hidden", worn: el.dataset.pose === el.dataset.accessoryPose && layers.length > 0, fronts: layers.map(layer => getComputedStyle(layer).transform), snacks });
      probe.timer = window.setTimeout(sample, 40);
    };
    (window as ProbeWindow).accessory111 = probe; sample();
  });
}

async function finish(page: Page, name: string, proof: Awaited<ReturnType<typeof setup>>) {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).accessory111; if (!p) return []; p.stop = true; clearTimeout(p.timer); return p.frames; });
  const result = { ...proof, origins: [...proof.origins], url: page.url(), afterBuild: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), frames };
  writeFileSync(`${output}/${name}.json`, JSON.stringify(result, null, 2)); await page.screenshot({ path: `${output}/${name}.png` });
  expect(result.afterBuild).toBe(result.build); expect(proof.writes).toEqual([]); expect(proof.errors).toEqual([]);
  return frames;
}

for (const id of ["sunglasses", "beret", "bell-badge", "magic-pocket", "propeller-hat"] as const) test(`${id}: actual family survives scroll, sofa, pickup and ordinary overlay`, async ({ page }) => {
  const proof = await setup(page, id); await worn(page, id); await observe(page);
  await place(page, 740, 650); await worn(page, id);
  const before = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 180);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before); await worn(page, id);
  const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  const cushion = home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await cushion.focus(); await cushion.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-state", "sleep", { timeout: 8000 }); await worn(page, id);
  await expect(page.locator(".vc-bed-foreground")).toBeVisible();
  const b = (await actor(page).boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + b.height * .4); await page.mouse.down();
  try { await page.mouse.move(b.x + b.width / 2 + 55, b.y + b.height * .4 - 90, { steps: 12 }); await expect(pet(page)).toHaveAttribute("data-state", "held"); await worn(page, id); await expect(pet(page)).toHaveAttribute("data-sofa-depth", "clear"); await expect(page.locator(".vc-bed-foreground")).toBeHidden(); }
  finally { await page.mouse.up(); }
  await place(page, 740, 650);
  let settings = page.getByRole("button", { name: "설정", exact: true });
  if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  settings = page.getByRole("button", { name: "설정", exact: true }); await settings.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await waitForOverlayEntrance(dialog);
  await worn(page, id); await expectCompanionBehindOverlay(page, dialog);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await worn(page, id);
  const frames = await finish(page, `family-${id}`, proof); expect(frames.filter(frame => frame.visible && frame.worn).length).toBeGreaterThan(15);
});

for (const id of ["scarf", "bell-pendant"] as const) test(`${id}: old earned wardrobe keeps its ledger and wears the body-fit replacement`, async ({ page }) => {
  const proof = await setup(page, id); await worn(page, id);
  const gifts = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).gifts, COMPANION_COLLECTION_KEY);
  // Reading normalizes in memory; it need not rewrite storage until an actual
  // local action. The legacy source ledger itself therefore remains intact.
  expect(gifts.unlocked).toContain(id); await finish(page, `legacy-${id}`, proof);
});

test("propeller: native safe floor starts finite hover and pickup cancels without losing its worn part", async ({ page }) => {
  const proof = await setup(page, "propeller-hat", true); await worn(page, "propeller-hat");
  await page.mouse.wheel(0, 650); await settlePanelLayout(page); await place(page, 740, 1082);
  // Actual visible handling lets the authored6s readiness clock elapse. It
  // does not inject activeMs, erase a goal, alter RNG or launch an action.
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(7500);
  await actor(page).press("Space"); await observe(page);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/);
  await expect(pet(page)).toHaveAttribute("data-accessory-trick", "propeller-hat", { timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).accessory111!.frames.some(frame => frame.trick === "propeller-hat" && frame.bob < -20)), { timeout: 6000 }).toBe(true);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held"); await worn(page, "propeller-hat");
  await actor(page).press("Space"); await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 8000 }); await worn(page, "propeller-hat");
  const frames = await finish(page, "propeller-native-hover-pickup", proof), showing = frames.filter(frame => frame.trick === "propeller-hat" && frame.beat === "show");
  expect(showing.length).toBeGreaterThan(3); expect(showing.every(frame => frame.visible && frame.worn)).toBe(true);
  expect(new Set(showing.flatMap(frame => frame.fronts)).size).toBeGreaterThan(4);
});

test("geometry: actual font choice, text wrapping, viewport resize and scroll keep a reachable glyph-clear actor", async ({ page }) => {
  const proof = await setup(page, "bell-badge"); await worn(page, "bell-badge"); await observe(page);
  const card = page.locator(".public-event[data-eventid],.agenda-event[data-eventid]").filter({ hasText: "시참" }).first();
  await expect(card).toBeVisible(); const initial = (await card.boundingBox())!;
  await place(page, initial.x + initial.width / 2, initial.y - 35);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await waitForOverlayEntrance(dialog);
  await dialog.getByRole("tab", { name: "글자", exact: true }).click();
  const size = dialog.getByRole("slider", { name: "달력 글씨 크기(px)", exact: true });
  await size.focus(); await size.press("End");
  const font = dialog.getByRole("radio", { name: "본고딕", exact: true }); await font.focus(); await font.press("Space");
  await expect(font).toHaveAttribute("aria-checked", "true"); await page.evaluate(() => document.fonts.ready);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await settlePanelLayout(page); await expect(actor(page)).toBeVisible(); await worn(page, "bell-badge");
  const changed = await card.boundingBox(); expect(changed).not.toBeNull(); expect(changed!.height).toBeGreaterThan(initial.height);
  await page.setViewportSize({ width: 1400, height: 900 }); await settlePanelLayout(page); await expect(actor(page)).toBeVisible();
  await page.mouse.move(1300, 400); await page.mouse.wheel(0, 180); await settlePanelLayout(page); await expect(actor(page)).toBeVisible(); await worn(page, "bell-badge");
  await card.scrollIntoViewIfNeeded(); await settlePanelLayout(page); const current = (await card.boundingBox())!;
  await place(page, current.x + current.width / 2, current.y - 30); await expect(actor(page)).toBeEnabled(); await worn(page, "bell-badge");
  const clearance = await pet(page).evaluate(node => {
    const el = node as HTMLElement, sprite = el.querySelector<HTMLElement>(".vc-sprite")!, body = el.getBoundingClientRect(), size = el.offsetWidth;
    const chain = [sprite, ...[".vc-pose", ".vc-contact", ".vc-reaction", ".vc-facing", ".vc-inertia"].map(selector => el.querySelector<HTMLElement>(selector)!)].map(layer => getComputedStyle(layer));
    const clip = chain[0].clipPath.slice(6, -1).split(/\s+/).slice(0, 4).map(value => parseFloat(value) * (value.endsWith("%") ? size / 100 : 1)), [top, right = top, bottom = top, left = right] = clip;
    const project = (x: number, y: number) => { let q = new DOMPoint(x, y); for (const css of chain) { const [ox, oy] = css.transformOrigin.split(" ").map(parseFloat), m = new DOMMatrixReadOnly(css.transform === "none" ? undefined : css.transform); q = m.transformPoint(new DOMPoint(q.x - ox, q.y - oy)); q.x += ox; q.y += oy; } return { x: body.left + q.x * body.width / size, y: body.top + q.y * body.width / size }; };
    const corners = [project(left, top), project(size - right, top), project(left, size - bottom), project(size - right, size - bottom)], bounds = { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)), top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
    const overlaps: Array<{ width: number; height: number }> = [], range = document.createRange();
    for (const card of document.querySelectorAll(".public-event[data-eventid],.agenda-event[data-eventid]")) {
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) { if (text.parentElement?.closest(".sr-only,svg")) continue; range.selectNodeContents(text); for (const glyph of range.getClientRects()) { const width = Math.min(bounds.right, glyph.right) - Math.max(bounds.left, glyph.left), height = Math.min(bounds.bottom, glyph.bottom) - Math.max(bounds.top, glyph.top); if (width > .75 && height > .75) overlaps.push({ width, height }); } }
    }
    range.detach(); return { bounds, overlaps, font: localStorage.getItem("vic.font"), text: document.documentElement.style.getPropertyValue("--cal-text") };
  });
  writeFileSync(`${output}/geometry-font-resize-clearance.json`, JSON.stringify(clearance, null, 2));
  expect(clearance.font).toBe("noto"); expect(clearance.overlaps).toEqual([]);
  await finish(page, "geometry-font-resize-scroll", proof);
});

test("food: native whole encounter keeps the same snack after any actually selected mishap", async ({ page }, info) => {
  const proof = await setup(page, "bow", true, true); await worn(page, "bow");
  await openCompanionHome(page); await page.mouse.wheel(0, 650); await settlePanelLayout(page);
  await place(page, 740, 1082);
  const floorY = await pet(page).evaluate(node => new DOMMatrixReadOnly((node as HTMLElement).style.transform).m42 + node.getBoundingClientRect().width);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(page.locator(".vc-food")).toHaveCount(1);
  const food = page.locator(".vc-food"), box = (await food.boundingBox())!, logical = await food.evaluate(el => { const m = new DOMMatrixReadOnly((el as HTMLElement).style.transform); return { x: m.m41, y: m.m42 }; });
  const grip = { x: box.x + box.width / 2, y: box.y + box.height / 2 }, id = (await food.getAttribute("data-food"))!;
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(1050 + grip.x - logical.x, 1082 + grip.y - logical.y, { steps: 14 }); await observe(page); await page.mouse.up();
  let frames: Frame[] = [];
  try {
    await expect(food).not.toHaveAttribute("data-falling"); await expect(food).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-state", "held");
    await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(1880, 50);
    await expect(food).toHaveCount(0, { timeout: 65_000 });
    await expect.poll(() => page.evaluate(() => (window as ProbeWindow).accessory111!.frames.some(frame => frame.episode === "meal" && frame.phase === "finish")), { timeout: 7000 }).toBe(true);
  } finally {
    frames = await finish(page, `meal-${info.repeatEachIndex}`, proof);
    writeFileSync(`${output}/meal-${info.repeatEachIndex}-summary.json`, JSON.stringify({ nativeRngUnchanged: true, foodId: id, variant: frames.find(frame => frame.episode === "meal")?.variant, mishapObserved: frames.some(frame => frame.phase === "mishap"), mealObserved: frames.some(frame => frame.state === "eat"), finishObserved: frames.some(frame => frame.phase === "finish") }, null, 2));
  }
  const falling = frames.flatMap(frame => frame.snacks.filter(snack => snack.id === id && snack.falling));
  expect(falling.length).toBeGreaterThan(1); expect(falling.every(snack => !snack.hidden && snack.y >= floorY - .75 && snack.y <= 1076.75)).toBe(true);
  for (let i = 1; i < falling.length; i++) expect(falling[i].y).toBeLessThanOrEqual(falling[i - 1].y + .1);
  const mishap = frames.find(frame => frame.phase === "mishap"), firstEat = frames.find(frame => frame.state === "eat");
  expect(firstEat).toBeDefined(); expect(frames.some(frame => ["walk", "jump"].includes(frame.state) && frame.goal === id)).toBe(true);
  if (mishap && firstEat) {
    const recovery = frames.filter(frame => frame.at >= mishap.at && frame.at < firstEat.at);
    expect(recovery.length).toBeGreaterThan(20); expect(recovery.every(frame => frame.goal === id)).toBe(true);
    expect(recovery.every(frame => !["sleep", "hide", "heart", "panel"].includes(frame.state))).toBe(true);
    expect(recovery.some(frame => ["tumble", "slip-tumble", "bump", "slip"].includes(frame.play))).toBe(true);
  }
});

test("ordinary glasses: native roaming records return-to-rest gestures after real travel without forcing the random habit", async ({ page }) => {
  test.setTimeout(125_000);
  const proof = await setup(page, "sunglasses", true); await worn(page, "sunglasses");
  await page.mouse.wheel(0, 650); await settlePanelLayout(page); await place(page, 740, 1082);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(7500);
  await actor(page).press("Space"); await observe(page);
  await expect(pet(page)).toHaveAttribute("data-accessory-trick", "sunglasses", { timeout: 45_000 });
  // Native stochastic coverage is an observation, not a guaranteed reward.
  // Never replace Math.random or a pose to manufacture the post-run branch.
  await page.waitForTimeout(50_000);
  const frames = await finish(page, "ordinary-native-habits", proof), starts = frames.filter((frame, index) => frame.trick === "sunglasses" && frames[index - 1]?.trick !== "sunglasses");
  const afterTravel = starts.filter(start => frames.some(frame => frame.at < start.at && start.at - frame.at < 5000 && (frame.state === "jump" || frame.state === "walk" && Number(frame.pose) >= 304 && Number(frame.pose) < 320)));
  writeFileSync(`${output}/ordinary-native-habits-summary.json`, JSON.stringify({ starts: starts.map(frame => frame.at), afterTravel: afterTravel.map(frame => frame.at), earlyRepeatBefore45s: starts.some((frame, index) => index > 0 && frame.at - starts[index - 1].at < 45_000), nativeRngUnchanged: true, limitation: "Random post-run branch may remain unobserved; the file records actual evidence, not a guaranteed branch PASS." }, null, 2));
  expect(starts.length).toBeGreaterThan(0); expect(frames.some(frame => frame.state === "walk")).toBe(true); expect(frames.filter(frame => frame.trick).every(frame => frame.visible && frame.worn)).toBe(true);
});
