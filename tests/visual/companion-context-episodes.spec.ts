import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE, type CompanionCare } from "@/lib/ui/viewer-companion/care";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Mode = "meal" | "resume" | "refocus";
type Point = { x: number; y: number };
type Floor = { x: number; y: number; foodX: number; movedX: number; left: number; right: number };
type Food = Point & { id: string; same: boolean; falling: boolean; eating: boolean; selected: boolean; jostling: boolean; scale: number; mouthError: number };
type Frame = Point & { at: number; marker: string; episode: string; phase: string; variant: string; foodGoal: string; episodeFood: string; intent: string; attention: string; state: string; play: string; beat: string; trip: string; runUp: string; journey: string; platform: string; pose: number; row: number; same: boolean; visible: boolean; decoded: boolean; atlas: string; foods: Food[] };
type Input = { at: number; type: string; target: string; key: string; trusted: boolean; x?: number; y?: number };
type CareChange = { at: number; care: CompanionCare };
type Removed = { at: number; id: string; marker: string; state: string };
type FocusEventSample = { at: number; type: string; hasFocus: boolean; hidden: boolean; trusted: boolean };
type FocusTransfer = { before: Point & { at: number; state: string; hasFocus: boolean }; returned: Point & { at: number; state: string; hasFocus: boolean; foodGoal: string; episode: string; phase: string; variant: string; episodeFood: string; runUp: string } };
type Observation = { frames: Frame[]; inputs: Input[]; focusEvents: FocusEventSample[]; careChanges: CareChange[]; removed: Removed[]; mealEntries: number; finishAt: number; finishCompletedAt: number; mouthSeen: boolean };
type Probe = Observation & { node: HTMLElement; foodNodes: Map<string, HTMLElement>; marker: string; began: number; raf: number; timer: number; stopped: boolean; previousState: string; previousPhase: string; previousCare: string; observer: MutationObserver; input: (event: Event) => void; focusInput: (event: Event) => void };
type ProbeWindow = Window & { contextEpisodeProbe: Probe };
type Memory = CompanionCare & { habits?: Record<string, number> };
const output = ".scratch-pw/095-context-episodes";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const foodPoint = (item: Locator) => item.evaluate(node => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: m.m41, y: m.m42 }; });
const memory = (page: Page) => page.evaluate(() => ({ preferences: localStorage.getItem("vic.viewerCompanion"), care: JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!) as Memory }));
const mark = (page: Page, marker: string) => page.evaluate(marker => { (window as unknown as ProbeWindow).contextEpisodeProbe.marker = marker; }, marker);

async function setup(page: Page, surface: Surface, realFocus = false) {
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    // Only established device preferences/care are seeded. This witness never
    // replaces randomness, clocks, focus, product state, actions or DOM content.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, animalMode: "default", personality: "curious", speed: "lively", roam: true, jump: true, feeding: true, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, energy: .9, hunger: .55 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=developer&y=2025&m=11");
  // Playwright enables browser focus emulation even in headed Chromium. Only
  // the real-focus cases remove that override; no fake event, product handler,
  // document.hasFocus replacement, action, clock or random source is supplied.
  const focusSession = realFocus ? await page.context().newCDPSession(page) : undefined;
  if (focusSession) await focusSession.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await openCompanionHome(page, "keyboard");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  return focusSession;
}

async function readFloor(page: Page, surface: Surface): Promise<Floor> {
  return page.evaluate(surface => {
    const root = document.querySelector<HTMLElement>(surface === "viewer" ? ".poster-page" : ".studio-shell")!;
    const styles = new Map<Element, CSSStyleDeclaration>();
    const css = (node: Element) => { const style = styles.get(node) ?? getComputedStyle(node); styles.set(node, style); return style; };
    const visible = (node: Element | null): boolean => !node || !node.hasAttribute("hidden") && css(node).display !== "none" && !["hidden", "collapse"].includes(css(node).visibility) && Number(css(node).opacity || 1) > .05 && visible(node.parentElement);
    let y = innerHeight - 18;
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const r = bar.getBoundingClientRect();
      if (visible(bar) && css(bar).position === "fixed" && r.width > 0 && r.height > 0 && r.top >= innerHeight * .65 && r.bottom <= innerHeight + 1) y = Math.min(y, r.top - 8);
    }
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const add = (r: DOMRect, parent: Element | null) => {
      const clip = { left: Math.max(0, r.left), right: Math.min(innerWidth, r.right), top: Math.max(0, r.top), bottom: Math.min(innerHeight, r.bottom) };
      for (let node = parent; node; node = node.parentElement) {
        const style = css(node), clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX), clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (!clipX && !clipY) continue;
        const b = node.getBoundingClientRect();
        if (clipX) { clip.left = Math.max(clip.left, b.left); clip.right = Math.min(clip.right, b.right); }
        if (clipY) { clip.top = Math.max(clip.top, b.top); clip.bottom = Math.min(clip.bottom, b.bottom); }
      }
      if (clip.right > clip.left && clip.bottom > clip.top) obstacles.push(clip);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
      range.selectNodeContents(node); for (const r of range.getClientRects()) add(r, parent);
    }
    range.detach();
    const controls = new Set(root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"));
    for (const node of document.querySelectorAll<HTMLElement>(".vc-home,.vc-home-launcher")) controls.add(node);
    for (const node of controls) if (visible(node) && !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day,.studio-day,[data-companion-event='ordinary']") && !node.closest(".vc-companion")) add(node.getBoundingClientRect(), node.parentElement);
    const clear = (x: number) => obstacles.every(r => x + 50 <= r.left || x - 50 >= r.right || y + 4 <= r.top || y - 96 >= r.bottom);
    const x = 740, foodX = surface === "viewer" ? 1050 : 430, movedX = surface === "viewer" ? 1150 : 330;
    if (![x, foodX, movedX].every(clear)) throw new Error("the three native rays must be actually clear of text and controls");
    let left = x, right = x;
    while (left > 54 && clear(left - 1)) left--;
    while (right < innerWidth - 54 && clear(right + 1)) right++;
    if (![foodX, movedX].every(point => point >= left && point <= right)) throw new Error("the unchanged fixture needs one continuous actual floor for this meal");
    return { x, y, foodX, movedX, left, right };
  }, surface);
}

async function startProbe(page: Page) {
  await pet(page).evaluate((node, rowCount) => {
    const el = node as HTMLElement;
    const probe: Probe = { node: el, foodNodes: new Map(), marker: "setup", began: performance.now(), frames: [], inputs: [], focusEvents: [], careChanges: [], removed: [], mealEntries: 0, finishAt: 0, finishCompletedAt: 0, mouthSeen: false, raf: 0, timer: 0, stopped: false, previousState: "", previousPhase: "", previousCare: "", observer: new MutationObserver(() => {}), input: () => {}, focusInput: () => {} };
    probe.input = event => {
      const target = event.target instanceof Element ? event.target.closest(".vc-actor,.vc-food,.vc-dispenser") : null;
      probe.inputs.push({ at: performance.now() - probe.began, type: event.type, target: target?.matches(".vc-food") ? "food" : target?.matches(".vc-actor") ? "actor" : target?.matches(".vc-dispenser") ? "dispenser" : "page", key: event instanceof KeyboardEvent ? event.key : "", trusted: event.isTrusted, ...(event instanceof PointerEvent ? { x: event.clientX, y: event.clientY } : {}) });
    };
    for (const type of ["pointerdown", "pointermove", "pointerup", "keydown", "keyup"]) document.addEventListener(type, probe.input, { capture: true, passive: true });
    // Observe genuine tab activation. The listener only reads focus/visibility;
    // it never calls the product's focus handler or dispatches a synthetic event.
    probe.focusInput = event => { probe.focusEvents.push({ at: performance.now() - probe.began, type: event.type, hasFocus: document.hasFocus(), hidden: document.hidden, trusted: event.isTrusted }); };
    window.addEventListener("blur", probe.focusInput); window.addEventListener("focus", probe.focusInput); document.addEventListener("visibilitychange", probe.focusInput);
    probe.observer = new MutationObserver(records => {
      for (const record of records) for (const removed of record.removedNodes) {
        if (!(removed instanceof HTMLElement)) continue;
        const foods = [...(removed.matches(".vc-food") ? [removed] : []), ...removed.querySelectorAll<HTMLElement>(".vc-food")];
        for (const food of foods) probe.removed.push({ at: performance.now() - probe.began, id: food.dataset.food ?? "", marker: probe.marker, state: el.dataset.state ?? "" });
      }
    });
    probe.observer.observe(document.body, { childList: true, subtree: true });
    const sample = () => {
      if (probe.stopped) return;
      probe.timer = window.setTimeout(() => {
        if (probe.stopped) return;
        const at = performance.now() - probe.began, m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size")), texture = el.querySelector<HTMLImageElement>(".vc-texture"), sprite = el.querySelector<HTMLElement>(".vc-sprite")!, spriteBox = sprite.getBoundingClientRect();
        const mouthX = spriteBox.left + spriteBox.width * (el.dataset.facing === "left" ? 1 - 111 / 192 : 111 / 192), mouthY = spriteBox.top + spriteBox.height * 131 / 192;
        const foods = [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => {
          const id = food.dataset.food ?? "", matrix = new DOMMatrixReadOnly(food.style.transform), art = food.firstElementChild as HTMLElement, box = art.getBoundingClientRect(), artMatrix = new DOMMatrixReadOnly(getComputedStyle(art).transform);
          if (!probe.foodNodes.has(id)) probe.foodNodes.set(id, food);
          return { id, same: probe.foodNodes.get(id) === food, x: matrix.m41, y: matrix.m42, falling: food.hasAttribute("data-falling"), eating: food.hasAttribute("data-eating"), selected: food.hasAttribute("data-selected"), jostling: food.hasAttribute("data-jostling"), scale: Math.hypot(artMatrix.a, artMatrix.b), mouthError: Math.hypot(box.left + box.width / 2 - mouthX, box.top + box.height / 2 - mouthY) };
        });
        const style = getComputedStyle(el), frame: Frame = { at, marker: probe.marker, episode: el.dataset.episode ?? "", phase: el.dataset.episodePhase ?? "", variant: el.dataset.episodeVariant ?? "", foodGoal: el.dataset.foodGoal ?? "", episodeFood: el.dataset.episodeFood ?? "", intent: el.dataset.intent ?? "", attention: el.dataset.attention ?? "", state: el.dataset.state ?? "", play: el.dataset.play ?? "", beat: el.dataset.playBeat ?? "", trip: el.dataset.trip ?? "", runUp: el.dataset.runUp ?? "", journey: el.dataset.journey ?? "", platform: el.dataset.platform ?? "", pose: Number(el.dataset.pose), row: Math.round(parseFloat(el.style.getPropertyValue("--vc-row")) * (rowCount - 1) / 100), same: el.isConnected && el === document.querySelector(".vc-companion"), visible: !el.hidden && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > .05, decoded: Boolean(texture?.complete && texture.naturalWidth > 0), atlas: el.dataset.atlas ?? "", x: m.m41 + size / 2, y: m.m42 + size, foods };
        probe.frames.push(frame);
        if (frame.state === "eat" && probe.previousState !== "eat") probe.mealEntries++;
        if (frame.episode === "meal" && frame.phase === "finish" && !probe.finishAt) probe.finishAt = at;
        if (probe.finishAt && probe.previousPhase === "finish" && frame.phase !== "finish") probe.finishCompletedAt = at;
        if (frame.state === "eat" && foods.some(food => food.eating && food.scale < .8 && food.scale > .1)) probe.mouthSeen = true;
        probe.previousState = frame.state; probe.previousPhase = frame.phase;
        const raw = localStorage.getItem("vic.viewerCompanionCare") ?? "";
        if (raw && raw !== probe.previousCare) { probe.careChanges.push({ at, care: JSON.parse(raw) as CompanionCare }); probe.previousCare = raw; }
      }, 0);
      probe.raf = requestAnimationFrame(sample);
    };
    (window as unknown as ProbeWindow).contextEpisodeProbe = probe; probe.raf = requestAnimationFrame(sample);
  }, companionSpriteMetadata.rows.length);
}

async function prepareFood(page: Page, floor: Floor) {
  await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(floor.x, floor.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => pet(page).evaluate((el, point) => { const m = new DOMMatrixReadOnly((el as HTMLElement).style.transform), size = parseFloat((el as HTMLElement).style.getPropertyValue("--vc-size")); return Math.hypot(m.m41 + size / 2 - point.x, m.m42 + size - point.y); }, floor)).toBeLessThan(2);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(page.locator(".vc-food")).toHaveCount(1);
  const item = page.locator(".vc-food"), rect = (await item.boundingBox())!, point = await foodPoint(item), grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(floor.foodX + grip.x - point.x, floor.y + grip.y - point.y, { steps: 12 }); await page.mouse.up();
  await expect(item).not.toHaveAttribute("data-falling");
  await expect.poll(async () => { const point = await foodPoint(item); return Math.hypot(point.x - floor.foodX, point.y - floor.y); }).toBeLessThan(1);
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  const id = (await item.getAttribute("data-food"))!, before = await memory(page);
  await mark(page, "observe-initial");
  await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(1800, 650);
  return { id, before };
}

async function interruptFood(page: Page, floor: Floor, id: string) {
  await expect(pet(page)).toHaveAttribute("data-episode-phase", "approach", { timeout: 15000 });
  const item = page.locator(`.vc-food[data-food="${id}"]`), rect = (await item.boundingBox())!, point = await foodPoint(item), grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await mark(page, "held-food");
  await expect(pet(page)).not.toHaveAttribute("data-episode", "meal");
  await expect(pet(page)).not.toHaveAttribute("data-food-goal"); await expect(pet(page)).not.toHaveAttribute("data-episode-food");
  await expect(item).not.toHaveAttribute("data-eating"); await page.waitForTimeout(450);
  await expect(item).toHaveAttribute("data-food", id); await expect(page.locator(".vc-food")).toHaveCount(1);
  await mark(page, "moving-food");
  await page.mouse.move(floor.movedX + grip.x - point.x, floor.y + grip.y - point.y, { steps: 12 });
  await mark(page, "release-food"); await page.mouse.up(); await page.mouse.move(1800, 650);
  await expect(item).not.toHaveAttribute("data-falling");
  await expect.poll(async () => { const point = await foodPoint(item); return Math.hypot(point.x - floor.movedX, point.y - floor.y); }).toBeLessThan(1);
  await mark(page, "observe-resumed");
}

async function interruptFocus(page: Page): Promise<FocusTransfer> {
  await expect(pet(page)).toHaveAttribute("data-episode-phase", "approach", { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).contextEpisodeProbe.frames.filter(frame => frame.marker === "observe-initial" && frame.phase === "approach" && frame.state === "walk").length), { intervals: [20] }).toBeGreaterThanOrEqual(2);
  const before = await pet(page).evaluate(node => { const el = node as HTMLElement, probe = (window as unknown as ProbeWindow).contextEpisodeProbe, m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size")); return { at: performance.now() - probe.began, x: m.m41 + size / 2, y: m.m42 + size, state: el.dataset.state ?? "", hasFocus: document.hasFocus() }; });
  await mark(page, "blur-pending");
  const other = await page.context().newPage();
  try {
    await other.goto("about:blank"); await other.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hasFocus()), { intervals: [10] }).toBe(false);
    await other.waitForTimeout(100);
    await mark(page, "observe-refocused"); await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hasFocus()), { intervals: [10] }).toBe(true);
    const returned = await pet(page).evaluate(node => { const el = node as HTMLElement, probe = (window as unknown as ProbeWindow).contextEpisodeProbe, m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size")); return { at: performance.now() - probe.began, x: m.m41 + size / 2, y: m.m42 + size, state: el.dataset.state ?? "", hasFocus: document.hasFocus(), foodGoal: el.dataset.foodGoal ?? "", episode: el.dataset.episode ?? "", phase: el.dataset.episodePhase ?? "", variant: el.dataset.episodeVariant ?? "", episodeFood: el.dataset.episodeFood ?? "", runUp: el.dataset.runUp ?? "" }; });
    return { before, returned };
  } finally {
    await page.bringToFront(); await other.close();
  }
}

function verify(observation: Observation, floor: Floor, id: string, mode: Mode, before: Awaited<ReturnType<typeof memory>>, after: Awaited<ReturnType<typeof memory>>, focusTransfer?: FocusTransfer) {
  const resumed = mode === "resume", refocused = mode === "refocus", interrupted = resumed || refocused;
  const frames = observation.frames.filter(frame => frame.marker !== "setup"), rows = companionSpriteMetadata.rows;
  const initial = frames.filter(frame => frame.marker === "observe-initial" && frame.episode === "meal");
  const prefix = ["notice", "greet", "approach"].map(phase => initial.findIndex(frame => frame.phase === phase));
  expect(prefix.every(index => index >= 0) && prefix[0] < prefix[1] && prefix[1] < prefix[2], "one actual notice→greet→approach sequence precedes the meal or its cancellation").toBe(true);
  expect(initial.some(frame => frame.phase === "notice" && frame.state === "look" && frame.attention === "inspect" && frame.intent === "feed" && rows[1].includes(frame.pose))).toBe(true);
  const variant = initial.find(frame => frame.phase === "notice")!.variant;
  expect(["careful", "dash", "bound", "rush-trip", "bound-slip"]).toContain(variant);
  expect(new Set(initial.map(frame => frame.variant))).toEqual(new Set([variant]));
  expect(initial.some(frame => frame.phase === "greet" && rows[variant === "careful" ? 1 : 31].includes(frame.pose))).toBe(true);
  const finish = frames.filter(frame => frame.episode === "meal" && frame.phase === "finish");
  expect(finish.length).toBeGreaterThan(3); expect(finish.every(frame => frame.foodGoal === "")).toBe(true);
  expect(finish.some(frame => frame.state === "shake" && rows[17].includes(frame.pose)), "the default species completes its actual post-meal body shake").toBe(true);
  expect(observation.finishCompletedAt).toBeGreaterThan(observation.finishAt);
  const meals = frames.filter(frame => frame.state === "eat"), firstMeal = meals[0];
  expect(firstMeal).toBeDefined(); expect(observation.mealEntries).toBe(1);
  expect(meals.every(frame => frame.foodGoal === id)).toBe(true);
  expect(observation.removed.map(item => item.id)).toEqual([id]);
  expect(observation.removed[0].at).toBeGreaterThan(firstMeal.at); expect(finish[0].at).toBeGreaterThanOrEqual(observation.removed[0].at - 40);
  const route = resumed ? frames.filter(frame => ["release-food", "observe-resumed"].includes(frame.marker)) : refocused ? frames.filter(frame => frame.marker === "observe-refocused") : frames;
  const approach = route.filter(frame => frame.foodGoal === id && ["walk", "jump"].includes(frame.state));
  expect(approach.length).toBeGreaterThan(8);
  expect(approach.some(frame => [2, 4, 5, 20].some(row => rows[row].includes(frame.pose)))).toBe(true);
  expect(Math.abs(firstMeal.x - approach[0].x)).toBeGreaterThan(80);
  expect(Math.abs(firstMeal.x - (resumed ? floor.movedX : floor.foodX))).toBeLessThanOrEqual(38);
  expect(Math.abs(firstMeal.y - floor.y)).toBeLessThan(2);
  if (interrupted) {
    if (resumed) {
      const held = frames.filter(frame => frame.marker === "held-food"), lastHeldAt = held.at(-1)!.at;
      expect(held.length).toBeGreaterThan(8);
      expect(held.filter(frame => frame.at >= lastHeldAt - 350).every(frame => frame.episode !== "meal" && frame.foodGoal === "" && frame.episodeFood === "" && frame.state !== "eat" && frame.foods.length === 1 && !frame.foods[0].eating)).toBe(true);
    }
    expect(route.filter(frame => frame.at < firstMeal.at && frame.episode === "meal")).toEqual([]);
    expect(route.filter(frame => frame.state === "eat").every(frame => frame.episode === "")).toBe(true);
    expect(approach.every(frame => frame.episode === "")).toBe(true);
    if (refocused) {
      expect(focusTransfer).toBeDefined();
      const transfer = focusTransfer!, direction = Math.sign(floor.foodX - floor.x);
      expect(transfer.before.hasFocus && transfer.returned.hasFocus).toBe(true);
      expect(transfer.before.state).toBe("walk"); expect(transfer.returned.state, "focus returns before the current finite walk ends").toBe("walk");
      expect((transfer.returned.x - floor.x) * direction).toBeGreaterThanOrEqual(-2);
      expect((transfer.returned.x - floor.x) * direction).toBeLessThan(175);
      expect(Math.abs(transfer.returned.y - floor.y)).toBeLessThan(2);
      expect({ episode: transfer.returned.episode, phase: transfer.returned.phase, variant: transfer.returned.variant, episodeFood: transfer.returned.episodeFood }).toEqual({ episode: "", phase: "", variant: "", episodeFood: "" });
      expect(transfer.returned.foodGoal, "the current finite food leg keeps its identity after the scene is cancelled").toBe(id);
      expect(transfer.returned.runUp).toBe("");
      const blur = observation.focusEvents.find(event => event.type === "blur" && !event.hasFocus && event.at >= transfer.before.at), focused = observation.focusEvents.find(event => event.type === "focus" && event.hasFocus && event.at > (blur?.at ?? Infinity));
      expect(blur).toBeDefined(); expect(focused).toBeDefined(); expect(blur!.trusted && focused!.trusted).toBe(true);
      expect(focused!.at - blur!.at).toBeGreaterThanOrEqual(100);
      const beforeMeal = route.filter(frame => frame.at < firstMeal.at);
      expect(beforeMeal.every(frame => frame.phase === "" && frame.episodeFood === "" && frame.runUp === "" && !["celebrate", "tumble", "slip-tumble", "bump", "slip"].includes(frame.play)), "returning focus cannot revive the cancelled greeting, accident or planned running hop").toBe(true);
      expect(firstMeal.at - transfer.returned.at).toBeLessThan(45000);
    }
  } else {
    const mealAt = initial.findIndex(frame => frame.phase === "meal"), finishAt = initial.findIndex(frame => frame.phase === "finish");
    expect(mealAt).toBeGreaterThan(prefix[2]); expect(finishAt).toBeGreaterThan(mealAt);
    expect(initial.every(frame => frame.episodeFood === id)).toBe(true);
    const mishap = initial.filter(frame => frame.phase === "mishap"), journeys = new Set(mishap.map(frame => frame.journey).filter(Boolean));
    expect(journeys.size, "at most one actual accident occurs in the encounter").toBeLessThanOrEqual(1);
    if (mishap.length) {
      const returning = frames.filter(frame => frame.at >= mishap[0].at && frame.at < firstMeal.at);
      expect(returning.every(frame => frame.foodGoal === id), "recovery must remember the same actual snack until eating").toBe(true);
      expect(returning.every(frame => !["sleep", "heart", "hide", "panel"].includes(frame.state)), "recovery cannot turn into unrelated sleep or play before the meal").toBe(true);
      expect(returning.filter(frame => ["walk", "jump"].includes(frame.state)).every(frame => frame.episodeFood === id), "all return travel must belong to that same food encounter").toBe(true);
      const rolling = mishap.some(frame => ["tumble", "slip-tumble"].includes(frame.play));
      for (const row of rolling ? [21, 22, 23, 26] : [22, 23, 25, 26]) expect(mishap.some(frame => rows[row].includes(frame.pose)), `observed accident must actually display HD row${row}`).toBe(true);
      if (mishap.some(frame => frame.play === "slip-tumble")) expect(mishap.some(frame => rows[24].includes(frame.pose))).toBe(true);
    }
  }
  const chewing = meals.flatMap(frame => frame.foods.filter(food => food.eating && food.scale >= .1 && food.scale <= .8).map(food => ({ frame, food })));
  const actualMouth = chewing.filter(({ frame }) => rows[9].includes(frame.pose));
  expect(actualMouth.length).toBeGreaterThan(8);
  expect(Math.max(...actualMouth.map(({ food }) => food.mouthError)), "actual food art shrinks at the approved HD mouth").toBeLessThan(5);
  expect(meals.some(frame => rows[9].includes(frame.pose) && frame.foods.some(food => food.eating && food.scale < .1))).toBe(true);
  expect(chewing.some(({ food }) => food.scale >= .72)).toBe(true);
  let actorViolations = 0, foodViolations = 0, geometryViolations = 0, firstInvalid: Record<string, unknown> | undefined;
  for (const frame of frames) {
    if (!frame.same || !frame.visible || !frame.decoded || frame.atlas !== "hd" || !Number.isInteger(frame.pose) || !companionSpriteMetadata.frames[frame.pose]) { actorViolations++; firstInvalid ??= { at: frame.at, problem: "actor", frame }; }
    if (frame.foods.length > 1 || frame.foods.some(food => food.id !== id || !food.same)) { foodViolations++; firstInvalid ??= { at: frame.at, problem: "food identity", foods: frame.foods }; }
    for (const food of frame.foods) {
      const settled = !["moving-food", "release-food"].includes(frame.marker), target = ["observe-resumed"].includes(frame.marker) ? floor.movedX : floor.foodX;
      if (settled && !food.eating && (food.falling || Math.hypot(food.x - target, food.y - floor.y) >= 1)) { foodViolations++; firstInvalid ??= { at: frame.at, problem: "settled food coordinates/state", food, target }; }
    }
    if (frame.episode === "meal" && (frame.x < floor.left - 2 || frame.x > floor.right + 2 || frame.y > floor.y + 2 || frame.y < 100)) { geometryViolations++; firstInvalid ??= { at: frame.at, problem: "actual floor corridor", frame }; }
  }
  expect({ actorViolations, foodViolations, geometryViolations }, `first invalid frame: ${JSON.stringify(firstInvalid ?? null)}`).toEqual({ actorViolations: 0, foodViolations: 0, geometryViolations: 0 });
  expect(observation.inputs.length).toBeGreaterThan(15); expect(observation.inputs.every(input => input.trusted)).toBe(true);
  expect(observation.inputs.filter(input => input.type === "pointerup" && input.target === "dispenser")).toHaveLength(1);
  expect(observation.inputs.filter(input => input.type === "pointerdown" && input.target === "food")).toHaveLength(resumed ? 2 : 1);
  expect(observation.inputs.some(input => input.type === "keydown" && input.target === "actor" && input.key.toLowerCase() === "p")).toBe(true);
  const care = observation.careChanges, affectionRewards = care.filter((change, index) => index > 0 && change.care.affection - care[index - 1].care.affection > .05), hungerRewards = care.filter((change, index) => index > 0 && care[index - 1].care.hunger - change.care.hunger > .2);
  expect(affectionRewards).toHaveLength(1); expect(hungerRewards).toHaveLength(1);
  expect(affectionRewards[0].at).toBeGreaterThan(firstMeal.at); expect(hungerRewards[0].at).toBeGreaterThan(firstMeal.at);
  const elapsed = frames.at(-1)!.at - frames[0].at;
  expect(after.care.affection - before.care.affection + elapsed / 2400000).toBeCloseTo(.1, 2);
  expect(after.care.hunger - before.care.hunger - elapsed / 900000).toBeCloseTo(-.36, 1);
  expect(after.care.hunger).toBeLessThan(.35); expect(after.preferences).toBe(before.preferences); expect(after.care.habits).toEqual(before.care.habits);
}

// Real OS/tab activation uses headed Chromium. Headed mode alone does not undo
// Playwright's default focus emulation; the two refocus setups remove it above.
// Keep the real desktop pointer outside this window while preserving native focus.
test.use({ headless: false, launchOptions: { args: ["--disable-features=CalculateNativeWinOcclusion", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--window-position=-2400,-1400"] }, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
for (const surface of ["viewer", "studio"] as const) for (const mode of ["meal", "resume", "refocus"] as const) test(`${surface}: native meal ${mode === "resume" ? "cancels for held food and resumes its same ID" : mode === "refocus" ? "cancels on real blur and returns before the current walk ends" : "connects notice, greeting, approach, meal and finish"}`, async ({ page }, info) => {
  test.setTimeout(100000);
  const writes: string[] = [], errors: string[] = [], resumed = mode === "resume", name = `${surface}-${mode}`;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => { const request = route.request(), path = new URL(request.url()).pathname; if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); } return route.continue(); });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  const focusSession = await setup(page, surface, mode === "refocus"); await startProbe(page); mkdirSync(output, { recursive: true });
  let floor: Floor | undefined, id = "", before: Awaited<ReturnType<typeof memory>> | undefined, after: Awaited<ReturnType<typeof memory>> | undefined, observation: Observation | undefined, focusTransfer: FocusTransfer | undefined;
  try {
    floor = await readFloor(page, surface); ({ id, before } = await prepareFood(page, floor));
    const deadline = Date.now() + 60000;
    if (resumed) await interruptFood(page, floor, id);
    else if (mode === "refocus") focusTransfer = await interruptFocus(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).contextEpisodeProbe.mouthSeen), { timeout: Math.max(1000, deadline - Date.now()), intervals: [50], message: "the single actual food reaches a real meal within the finite observation budget" }).toBe(true);
    await page.screenshot({ path: `${output}/${name}-meal.png` });
    await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).contextEpisodeProbe.finishCompletedAt > 0), { timeout: Math.max(1000, deadline - Date.now()), intervals: [50], message: "successful actual consumption reaches and completes its finite finish" }).toBe(true);
    await mark(page, "finish-tail"); await page.waitForTimeout(1200);
  } finally {
    after = await memory(page);
    observation = await page.evaluate(() => {
      const probe = (window as unknown as ProbeWindow).contextEpisodeProbe;
      probe.stopped = true; cancelAnimationFrame(probe.raf); clearTimeout(probe.timer); probe.observer.disconnect();
      for (const type of ["pointerdown", "pointermove", "pointerup", "keydown", "keyup"]) document.removeEventListener(type, probe.input, true);
      window.removeEventListener("blur", probe.focusInput); window.removeEventListener("focus", probe.focusInput); document.removeEventListener("visibilitychange", probe.focusInput);
      const { frames, inputs, focusEvents, careChanges, removed, mealEntries, finishAt, finishCompletedAt, mouthSeen } = probe;
      return { frames, inputs, focusEvents, careChanges, removed, mealEntries, finishAt, finishCompletedAt, mouthSeen };
    });
    writeFileSync(`${output}/${name}.json`, JSON.stringify({ buildId: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), surface, mode, resumed, focusEmulationDisabled: mode === "refocus", floor, foodId: id, before, after, focusTransfer, observation, writes, errors }, null, 2));
    await page.screenshot({ path: `${output}/${name}-final.png` });
    await info.attach("native episode evidence", { path: `${output}/${name}.json`, contentType: "application/json" });
    await focusSession?.detach();
  }
  // Raw evidence is saved before these bounded aggregate assertions. Each
  // captured frame/food is checked without thousands of reporter expect steps.
  verify(observation!, floor!, id, mode, before!, after!, focusTransfer);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
