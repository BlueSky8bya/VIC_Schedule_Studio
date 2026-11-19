import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, COMPANION_PERSONALITY_NAMES, COMPANION_PERSONALITY_SUMMARIES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_TASTES_KEY } from "@/lib/ui/viewer-companion/toy-tastes";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { safeCompanionSurfaces } from "@/lib/ui/viewer-companion/geometry";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { keepCompanionStoredMotion, setCompanionRoam } from "./helpers/companion-settings";
import { COMPANION_PERSONALITY_LAYOUT } from "@/lib/ui/viewer-companion/personality-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";
import { completedNativeBallUseReplay } from "./helpers/companion-ball-use-replay";

const output = process.env.COMPANION141_OUTPUT ?? ".scratch-pw/companion-141/collection-settings";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Surface = "viewer" | "studio" | "preview";
type ItemFrame = { id: string; kind: string; use: string; rotation: number; carried: boolean; held: boolean; falling: boolean; visible: boolean; decoded: boolean; x: number; y: number };
type Frame = { at: number; state: string; row: number; pose: number; decoded: boolean; toyAction: string; actor: { x: number; y: number }; toys: ItemFrame[]; knownToys: string[]; behaviors: string[]; moments: string[] };
type Flight = { key: number; kind: string; id: string; at: number; duration: number; first: { x: number; y: number; width: number; height: number }; last: { x: number; y: number; width: number; height: number }; book: { x: number; y: number } | null; frames: Keyframe[]; decoded: boolean; known: boolean; samples: number };
type Probe = { samples: Frame[]; flights: Flight[]; stop: () => void };
type ProbeWindow = Window & { collection141?: Probe };
const proofs = new WeakMap<Page, { errors: string[]; rejected: string[]; notes: unknown[]; previewReads: number }>();

test.use({ viewport: { width: 1920, height: 1100 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(110000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof = { errors: [] as string[], rejected: [] as string[], notes: [] as unknown[], previewReads: 0 }; proofs.set(page, proof);
  const origin = new URL(baseURL!).origin;
  // This spec replaces storageState, which drops the QA key that keeps a stored roam:false standing still.
  await keepCompanionStoredMotion(page);
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const preview = new Set(Object.entries(actions).filter(([, entry]) => entry.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.resourceType() === "font" && url.origin !== origin) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && preview.has(request.headers()["next-action"])) {
      proof.previewReads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private APIs in141 native fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const observation = await page.evaluate(() => { const p = (window as ProbeWindow).collection141; p?.stop(); return p ? { samples: p.samples, flights: p.flights } : null; }).catch(() => null);
  mkdirSync(output, { recursive: true }); const file = resolve(output, info.title.replace(/[^a-z0-9]+/gi, "-") + ".json");
  writeFileSync(file, JSON.stringify({ ...proofs.get(page), observation, status: info.status, recordedAt: new Date().toISOString(), scope: "Production-build local guarded native inputs and read-only finite rAF/animation observations. Initial preferences/care only; no collection/taste/discovery seeds, RNG/clock/engine/style/geometry injection or real API writes. Not production login/RLS or art approval." }, null, 2));
  await info.attach("collection-settings141", { path: file, contentType: "application/json" });
  await page.screenshot({ path: file.replace(/\.json$/, ".png") }).catch(() => {});
  expect(proofs.get(page)!.errors).toEqual([]); expect(proofs.get(page)!.rejected).toEqual([]);
});

async function fixture(page: Page, surface: Surface, width = 1920, quiet = false, probeBeforeHydration = false) {
  await page.setViewportSize({ width, height: 1100 });
  await page.addInitScript(({ preferences, memory, epoch, epochKey, quiet }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": quiet ? "off" : "max", "vic.gfx": JSON.stringify({ mode: quiet ? "off" : "full", at: Date.now(), v: 3 }), "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": quiet ? "on" : "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: false, sleep: false, feeding: true, sound: false, learnFromYou: true, heartPrank: true, cardPrank: true, ambientPrank: true, panelPrank: false, rarePrank: true }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05 }));
    // Deliberately no taste, collection, first-discovery or runtime state seed.
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, quiet });
  if (probeBeforeHydration) await page.addInitScript(installCollectionProbeInPage, { tasteKey: COMPANION_TASTES_KEY, collectionKey: COMPANION_COLLECTION_KEY });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=10&hour=12&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await expect(page.locator(".vc-companion")).toBeVisible(); return openCompanionHome(page);
}
async function settings(page: Page) {
  const home = await openCompanionHome(page); await home.locator('[data-home-action="book"]').click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  // stage 3: look and character controls live on the book's "함께 지내기" page (its opening page), not on "설정".
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  return dialog;
}
async function choose(page: Page, personality: CompanionPersonality, roam: boolean) {
  const dialog = await settings(page), group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true });
  const option = group.getByRole("radio", { name: COMPANION_PERSONALITY_NAMES[personality], exact: true }); await option.click(); await expect(option).toHaveAttribute("aria-checked", "true");
  // stage 4: roaming is the movement level on the "설정" page (on = 뛰어다니기, as the seed keeps jump on; off = 가만히).
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click(); await setCompanionRoam(dialog, roam);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
}
function installCollectionProbeInPage({ tasteKey, collectionKey }: { tasteKey: string; collectionKey: string }) {
    (window as ProbeWindow).collection141?.stop();
    const samples: Frame[] = [], flights: Flight[] = [], animationIds = new WeakMap<Animation, Flight>();
    let request = 0, stopped = false, last = -Infinity, serial = 0; const began = performance.now();
    const json = (key: string) => { try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; } };
    const point = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 24) {
        last = now; const tastes = json(tasteKey), collection = json(collectionKey), pet = document.querySelector<HTMLElement>(".vc-companion"), texture = pet?.querySelector<HTMLImageElement>(".vc-sprite>.vc-texture");
        const petRect = pet?.getBoundingClientRect(), visible = Boolean(pet && !document.hidden && !pet.hidden && petRect!.width > 0 && getComputedStyle(pet).visibility !== "hidden" && Number(getComputedStyle(pet).opacity) > 0 && !pet.closest("[hidden],[inert],[aria-hidden='true']"));
        const decoded = visible && Boolean(texture?.complete && texture.naturalWidth && texture.getBoundingClientRect().width > 0);
        samples.push({ at: now - began, state: pet?.dataset.state ?? "", row: Number(pet?.dataset.row ?? -1), pose: Number(pet?.dataset.pose ?? -1), decoded, toyAction: pet?.dataset.toyAction ?? "", actor: { x: petRect ? petRect.left + petRect.width / 2 : Number.NaN, y: petRect?.bottom ?? Number.NaN }, toys: [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => { const r = node.getBoundingClientRect(); const image = node.querySelector<HTMLImageElement>("img"), picture = image?.getBoundingClientRect();
          // Since 60f208a3 a toy's spin is painted on its art (.vc-toy-art, --vc-toy-art-rotation); the button only travels.
          const art = node.querySelector<HTMLElement>(".vc-toy-art") ?? image, matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform).multiply(new DOMMatrixReadOnly(art ? getComputedStyle(art).transform : undefined));
          const visible = !document.hidden && !node.closest("[hidden],[inert],[aria-hidden='true']") && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && Number(getComputedStyle(node).opacity) > .05
            && Boolean(image?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && Number(getComputedStyle(image).opacity) > .05 && picture?.width && picture.height)
            && r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
          return { id: node.dataset.toyId!, kind: node.dataset.kind!, use: node.dataset.toyUse ?? "", rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, carried: node.dataset.carried === "true", held: node.dataset.held === "true", falling: node.dataset.falling === "true", visible,
            decoded: visible && Boolean(image?.complete && image.naturalWidth), x: r.left + r.width / 2, y: r.bottom }; }), knownToys: tastes.toys ?? [], behaviors: collection.behaviors ?? [], moments: collection.situations ?? [] });
        const notice = document.querySelector<HTMLElement>(".vc-discovery-flight");
        if (notice && !notice.hidden) for (const animation of notice.getAnimations().filter(value => value.effect instanceof KeyframeEffect && value.effect.target === notice)) {
          let flight = animationIds.get(animation);
          if (!flight) {
            const kind = notice.dataset.discoveryKind ?? "", stamp = notice.querySelector<HTMLElement>("[data-collection-art-id]"), image = notice.querySelector<HTMLImageElement>("img"), id = stamp?.dataset.collectionArtId ?? image?.currentSrc.match(/toy-([^/]+)\.webp/)?.[1] ?? "";
            const book = [...document.querySelectorAll<HTMLElement>(".vc-book-button")].find(node => { const r = node.getBoundingClientRect(); return !node.closest("[hidden],[inert],[aria-hidden='true']") && r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
            const b = book?.getBoundingClientRect();
            flight = { key: ++serial, kind, id, at: now - began, duration: Number(animation.effect?.getTiming().duration), first: point(notice), last: point(notice), book: b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null, frames: (animation.effect as KeyframeEffect).getKeyframes(), decoded: kind === "toy" ? Boolean(image?.complete && image.naturalWidth) : decoded, known: kind === "toy" ? (tastes.toys ?? []).includes(id) : kind === "behavior" ? (collection.behaviors ?? []).includes(id) : kind === "moment" ? (collection.situations ?? []).includes(id) : (collection.foods ?? []).includes(id), samples: 0 };
            animationIds.set(animation, flight); flights.push(flight);
          }
          flight.last = point(notice); flight.samples++;
        }
      }
      if (now - began < 180000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).collection141 = { samples, flights, stop() { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
}
async function startProbe(page: Page) {
  await page.evaluate(installCollectionProbeInPage, { tasteKey: COMPANION_TASTES_KEY, collectionKey: COMPANION_COLLECTION_KEY });
}
const observation = (page: Page) => page.evaluate(() => { const p = (window as ProbeWindow).collection141!; return { samples: p.samples, flights: p.flights }; });
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press("Tab"); await target.focus(); await expect(target).toBeFocused();
  await expect.poll(() => target.evaluate(node => node.matches(":focus-visible"))).toBe(true);
  const keyboard = await target.evaluate(node => {
    const element = node as HTMLElement, style = getComputedStyle(node), rect = node.getBoundingClientRect();
    const scale = rect.width / element.offsetWidth, rules: { selector: string; width: string; outline: string }[] = []; let budget = 20000;
    const visit = (list: CSSRuleList, depth = 0) => {
      if (depth > 6) return;
      for (const rule of list) {
        if (--budget < 0) return;
        if (rule instanceof CSSStyleRule && rule.selectorText.includes(":focus-visible")) {
          const width = rule.style.getPropertyValue("outline-width"), outline = rule.style.getPropertyValue("outline");
          try { if ((width || outline) && node.matches(rule.selectorText)) rules.push({ selector: rule.selectorText, width, outline }); } catch { /* Unrelated selector syntax. */ }
        }
        try { const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules; if (nested) visit(nested, depth + 1); } catch { /* Cross-origin sheet. */ }
      }
    };
    for (const sheet of [...document.styleSheets].slice(0, 64)) try { visit(sheet.cssRules); } catch { /* Font/external stylesheet is not the control's rule. */ }
    return { keyboardTarget: element.className, focusVisible: node.matches(":focus-visible"), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow, scale, paintedOutlineWidth: parseFloat(style.outlineWidth) * scale, authoredFocusRules: rules };
  });
  proofs.get(page)!.notes.push(keyboard);
  // 2026-10-24 owner rule (dd0f45f7, UI_RULES "빅타민 물체 포커스 정정"): food, toys, furniture and the house controls
  // draw no outer focus ring for the keyboard either. This supersedes the 2px keyboard ring this test used to
  // require. What stays: the control really takes keyboard focus (asserted above) and paints no ring or halo.
  expect(keyboard.focusVisible).toBe(true);
  expect(keyboard.outlineStyle === "none" || parseFloat(keyboard.outlineWidth) === 0, JSON.stringify(keyboard)).toBe(true);
  expect(keyboard.boxShadow).toBe("none");
}

for (const [surface, width] of [["studio", 1100], ["viewer", 1920], ["preview", 1920]] as const) test(`141 ${surface} ${width} settings order and shared three-column widths follow actual personality selection`, async ({ page }) => {
  await fixture(page, surface, width); const dialog = await settings(page);
  const animal = dialog.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }), personality = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true });
  await expect(animal.getByRole("radio")).toHaveCount(3); await expect(personality.getByRole("radio")).toHaveCount(9);
  const chosen = personality.getByRole("radio", { name: COMPANION_PERSONALITY_NAMES.affectionate, exact: true }); await chosen.click(); await expect(chosen).toHaveAttribute("aria-checked", "true");
  // stage 3: the separate preview card is gone. The page's own portrait card shows the chosen character
  // (name, summary, live portrait) above the controls, and the hand-picked note sits under the choices.
  const card = dialog.locator(".rhh-companion-summary"); await expect(card).toBeVisible(); await expect(card.locator(".rhh-profile-personality")).toHaveText(COMPANION_PERSONALITY_NAMES.affectionate); await expect(card).toContainText(COMPANION_PERSONALITY_SUMMARIES.affectionate); await expect(card.locator(".rhh-companion-portrait .rhh-wardrobe-preview[data-preview-ready]")).toBeVisible();
  await expect(dialog.locator(".rhh-personality-random .rhh-group-foot")).toHaveText("직접 고른 성격이라 새로고침해도 그대로예요.");
  const geometry = await personality.evaluate(group => {
    const row = group.parentElement!, card = group.closest(".rhh-companion-profile")!.querySelector(".rhh-companion-summary")!, foot = row.querySelector(".rhh-personality-random")!, label = row.querySelector(".rhh-row-label") ?? row.firstElementChild!, animal = document.querySelector('[role="radiogroup"][aria-label="빅타민 동물 모드"]')!;
    return { label: label.getBoundingClientRect().toJSON(), card: card.getBoundingClientRect().toJSON(), foot: foot.getBoundingClientRect().toJSON(), personality: group.getBoundingClientRect().toJSON(), animal: animal.getBoundingClientRect().toJSON(), personButtons: [...group.querySelectorAll('[role="radio"]')].map(node => node.getBoundingClientRect().toJSON()), animalButtons: [...animal.querySelectorAll('[role="radio"]')].map(node => node.getBoundingClientRect().toJSON()) };
  });
  // Order down the page: portrait card, look, then character (label, choices, note).
  expect(geometry.card.bottom).toBeLessThanOrEqual(geometry.animal.top + .5); expect(geometry.animal.bottom).toBeLessThanOrEqual(geometry.label.top + .5);
  expect(geometry.label.bottom).toBeLessThanOrEqual(geometry.personality.top + .5); expect(geometry.personality.bottom).toBeLessThanOrEqual(geometry.foot.top + .5);
  expect(Math.abs(geometry.personality.x - geometry.animal.x)).toBeLessThan(.5); expect(Math.abs(geometry.personality.width - geometry.animal.width)).toBeLessThan(.5);
  for (let i = 0; i < 9; i++) { const r = geometry.personButtons[i]; expect(r.width).toBeGreaterThanOrEqual(44); expect(r.height).toBeGreaterThanOrEqual(44); expect(Math.abs(r.x - geometry.animalButtons[i % 3].x)).toBeLessThan(1); if (i >= 3) expect(r.top).toBeGreaterThanOrEqual(geometry.personButtons[i - 3].bottom - .5); }
  expect(geometry.personButtons[0].top).toBeCloseTo(geometry.personButtons[2].top, 0); proofs.get(page)!.notes.push({ surface, width, geometry });
  if (surface === "preview") expect(proofs.get(page)!.previewReads).toBeGreaterThan(0);
});

for (const [surface, width] of [["viewer", 1920], ["studio", 1100], ["preview", 1920]] as const) test(`142 ${surface} direct personality shortcut exposes the complete shared compass without manual scrolling`, async ({ page }) => {
  const home = await fixture(page, surface, width);
  if (surface === "studio") { await page.setViewportSize({ width, height: 640 }); await settlePanelLayout(page); }
  const shortcut = home.locator('[data-home-action="personality"]'); await expect(shortcut).toBeVisible();
  const size = (await shortcut.boundingBox())!; expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44);
  const headerButtons = await home.locator(":scope > .panel-section-heading button").evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { action: node.getAttribute("data-act"), x: r.x, y: r.y, width: r.width, height: r.height }; }));
  for (let i = 0; i < headerButtons.length; i++) for (const other of headerButtons.slice(i + 1)) {
    const current = headerButtons[i], overlapX = Math.min(current.x + current.width, other.x + other.width) - Math.max(current.x, other.x), overlapY = Math.min(current.y + current.height, other.y + other.height) - Math.max(current.y, other.y);
    expect(Math.max(0, overlapX) * Math.max(0, overlapY), "the real header inputs must stay separate").toBeLessThan(.1);
  }
  await shortcut.click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  // stage 3: the home's character label opens the book on "함께 지내기", at the character controls; no sub-tabs exist.
  await expect(dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "함께 지내기", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("tablist", { name: "빅타민 설정", exact: true })).toHaveCount(0);
  const grid = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true });
  await expect(grid.locator('[aria-checked="true"]')).toBeFocused();
  await waitForOverlayEntrance(dialog);
  const actual = await grid.getByRole("radio").evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { id: node.getAttribute("data-act-opt"), x: r.x, y: r.y, width: r.width, height: r.height, exposed: hit === node || node.contains(hit) };
  }));
  expect(actual.map(item => item.id)).toEqual(COMPANION_PERSONALITY_LAYOUT); expect(actual.every(item => item.exposed && item.width >= 44 && item.height >= 44)).toBe(true);
  for (let i = 0; i < 9; i++) { expect(actual[i].x).toBeCloseTo(actual[i % 3].x, 0); expect(actual[i].y).toBeCloseTo(actual[Math.floor(i / 3) * 3].y, 0); }
  await grid.getByRole("radio", { name: "동글이", exact: true }).click(); await expect(grid.getByRole("radio", { name: "동글이", exact: true })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(shortcut).toBeFocused(); await expect(shortcut).toContainText("동글이");
  // Reuse the already mounted settings child: its layout focus must not
  // replace the actual home opener captured by the parent activation.
  await shortcut.click(); await expect(grid.getByRole("radio", { name: "동글이", exact: true })).toBeFocused();
  await waitForOverlayEntrance(dialog);
  const readCompassThumb = () => grid.evaluate(group => {
    const selected = group.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]'), thumb = group.querySelector<HTMLElement>(":scope > .rhh-seg-thumb");
    if (!selected || !thumb) return null;
    const a = selected.getBoundingClientRect(), b = thumb.getBoundingClientRect();
    return { selected: selected.dataset.actOpt, button: a.toJSON(), thumb: b.toJSON(),
      centerError: Math.max(Math.abs(a.x+a.width/2-b.x-b.width/2), Math.abs(a.y+a.height/2-b.y-b.height/2)),
      edgeError: Math.max(Math.abs(a.left-b.left), Math.abs(a.top-b.top), Math.abs(a.right-b.right), Math.abs(a.bottom-b.bottom)),
      running: group.getAnimations({ subtree: true }).filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).length };
  });
  // The shared thumb reserves a2px inter-cell gap; the buttons share their
  // full columns. Observe its actual settled cell rather than an entrance or
  // spring midpoint, without changing CSS or stopping any animation.
  let previousCompass: Awaited<ReturnType<typeof readCompassThumb>> = null, stableBoxDrift = Infinity;
  await expect.poll(async () => {
    const actual = await readCompassThumb();
    stableBoxDrift = actual && previousCompass ? Math.max(...["button", "thumb"].flatMap(part => ["left", "right", "top", "bottom"].map(edge => Math.abs(actual[part as "button" | "thumb"][edge] - previousCompass![part as "button" | "thumb"][edge])))) : Infinity;
    previousCompass = actual;
    return Boolean(actual && actual.running === 0 && actual.centerError <= 1 && actual.edgeError <= 2 && stableBoxDrift <= .1);
  }).toBe(true);
  const warmCompassSettled = await readCompassThumb();
  proofs.get(page)!.notes.push({ surface, warmCompassSettled, twoActualBoxReadings: true, stableBoxDrift });
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: resolve(output, test.info().title.replace(/[^a-z0-9]+/gi, "-")+"-warm-open-compass.png") });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(shortcut).toBeFocused();
  await home.locator('[data-home-action="book"]').click(); await expect(dialog.getByRole("tab", { name: "함께 지내기", exact: true })).toHaveAttribute("aria-selected", "true");
  // stage 3: the in-book "성격 바꾸기" shortcut is gone; the ordinary book already shows the same character controls on this page.
  await expect(dialog.getByRole("button", { name: "성격 바꾸기", exact: true })).toHaveCount(0);
  await expect(grid.getByRole("radio", { name: "동글이", exact: true })).toBeVisible(); await expect(grid.getByRole("radio", { name: "동글이", exact: true })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(home.locator('[data-home-action="book"]')).toBeFocused();
  proofs.get(page)!.notes.push({ surface, viewport: page.viewportSize(), actualCompass: actual, headerButtons, oneHomeActivation: true, warmSecondOpenRestoresHomeOpener: true, manualScroll: false, ordinaryBookPreserved: true });
});

for (const [surface, width] of [["viewer", 1920], ["studio", 2400]] as const) test(`142 ${surface} real television glass and continuous cords retain their physical controls`, async ({ page }) => {
  const home = await fixture(page, surface, width); await placeCompanionOnHomeFloor(page);
  const tv = home.locator('[data-home-action="tv"]'); await tv.focus(); await tv.press("Enter");
  const screenImage=home.locator(".vc-home-tv-screen > .vc-tv-picture > img");
  await expect(screenImage).toHaveCount(1);
  expect(await screenImage.evaluate(async(node:HTMLImageElement)=>{await node.decode();return node.complete&&node.naturalWidth>0;})).toBe(true);
  const actual = await home.evaluate(node => {
    const box = (selector: string) => { const r = node.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const lamp = box(".vc-home-lamp-paint"), circle = box(".vc-home-lamp-handle"), cord = box(".vc-curtain-rope"), collar = box(".vc-curtain-collar"), handle = box(".vc-curtain-handle"), window = box(".vc-home-window");
    const picture = node.querySelector<HTMLElement>(".vc-home-tv-screen")!, clip = node.querySelector<SVGClipPathElement>(".vc-home-tv-projection clipPath")!;
    return { lamp, circle, cord, collar, handle, window, rodImage: box(".vc-window-curtain-stage"), curtainHit: box(".vc-curtain-control"), lampHit: box(".vc-home-lamp"), bodySrc: node.querySelector(".vc-home-tv-body")!.getAttribute("src"), clip: clip.querySelector("path")!.getAttribute("d"), pictureTransform: getComputedStyle(picture).transform };
  });
  expect(actual.bodySrc).toBe("/companion/home/136/tv-body.webp"); expect(actual.clip).toMatch(/^M133 167/);
  expect(actual.circle.x).toBeGreaterThan(actual.lamp.x + actual.lamp.width / 2); expect(actual.circle.y + actual.circle.height).toBeLessThanOrEqual(actual.lamp.y + actual.lamp.height + .5);
  // The collar ring, not the full hit-wrapper or rope crop top, owns the
  // registered rod point. Keep native collar/rope/handle seams continuous.
  const ringY = actual.collar.y + actual.collar.height * 35 / 99;
  expect(Math.abs(ringY - actual.rodImage.y - actual.rodImage.height * 17 / 192)).toBeLessThan(.75);
  // The60px minimum describes the connected pull assembly, including the
  // native collar/handle crops; the straight rope band is only one piece.
  expect(actual.handle.y + actual.handle.height - ringY).toBeGreaterThan(60);
  expect(actual.cord.height).toBeGreaterThan(0);
  expect(Math.abs(actual.cord.x + actual.cord.width / 2 - actual.rodImage.x - actual.rodImage.width * 10 / 256)).toBeLessThan(.75);
  expect(Math.abs(actual.collar.x + actual.collar.width / 2 - actual.cord.x - actual.cord.width / 2)).toBeLessThan(.75);
  expect(Math.abs(actual.handle.x + actual.handle.width / 2 - actual.cord.x - actual.cord.width / 2)).toBeLessThan(.75);
  expect(Math.abs(actual.cord.y - actual.collar.y - actual.collar.height + .5)).toBeLessThan(.75);
  expect(Math.abs(actual.cord.y + actual.cord.height - actual.handle.y - 1)).toBeLessThan(.75);
  expect(actual.cord.x + actual.cord.width / 2).toBeGreaterThan(actual.rodImage.x);
  expect(actual.cord.x + actual.cord.width / 2).toBeLessThan(actual.rodImage.x + actual.rodImage.width * .1);
  for (const rect of [actual.curtainHit, actual.lampHit]) { expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44); }
  proofs.get(page)!.notes.push({ surface, actual, televisionRasterUnchanged: true, lampRaster: "selected wood-base pair155", contactSelectors: [".vc-home-lamp-handle", ".vc-curtain-handle"], sourceGlassPixelProof: "companion-personality-layout-142.test.ts" });
  if (surface === "studio") {
    await home.locator('[data-home-action="book"]').click();
    const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
    await waitForOverlayEntrance(dialog);
    // stage 3: the in-book "성격 바꾸기" shortcut is gone; the character choice itself is on this page and keeps the 44px target.
    const button = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).locator('[role="radio"][aria-checked="true"]'); await button.scrollIntoViewIfNeeded();
    // The studio scales its whole surface, so the target is measured in layout pixels, not in the scaled box.
    const rect = await button.evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }));
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    proofs.get(page)!.notes.push({ surface, viewport: page.viewportSize(), actualProfileCharacterChoice: rect });
    await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(home.locator('[data-home-action="book"]')).toBeFocused();
  }
});

test("141 food toy and furniture draw no circular outline for pointer hover or keyboard focus, and keyboard focus stays real", async ({ page }) => {
  const home = await fixture(page, "studio"); await choose(page, "tidy", false);
  await home.locator('[data-home-action="feed"]').focus(); await page.keyboard.press("Enter");
  await home.locator('[data-home-action="toys"]').focus(); await page.keyboard.press("Enter");
  const food = page.locator(".vc-food").first(), toy = page.locator(".vc-toy").first(); await expect(food).toBeVisible(); await expect(toy).toBeVisible(); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
  for (const target of [food, toy, home.locator('[data-home-action="feed"]'), home.locator('[data-home-action="toys"]'), home.locator('[data-home-action="book"]')]) {
    await page.mouse.click(2, 2); await target.hover();
    // CSS outline:none may retain the computed medium width (3px). Its
    // style is what makes that width invisible; a width-only assertion
    // would reject a correctly absent ring before any keyboard focus.
    await expect.poll(() => target.evaluate(node => { const style = getComputedStyle(node); return style.outlineStyle === "none" ? 0 : parseFloat(style.outlineWidth); })).toBe(0);
    expect(await target.evaluate(node => getComputedStyle(node).boxShadow)).toBe("none");
    proofs.get(page)!.notes.push(await target.evaluate(node => { const style = getComputedStyle(node); return { pointerTarget: node.className, focusVisible: node.matches(":focus-visible"), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow }; }));
    await keyboardFocus(page, target); await page.mouse.move(2, 2);
  }
  // The artwork's own hover treatment is retained; the physical44px button
  // and native keyboard operation remain the same control.
  await toy.hover(); expect(await toy.locator("img").evaluate(node => getComputedStyle(node).transform)).not.toBe("none");
});

/** Carry the one resting toy by pointer to the centre of the widest measured home-floor span and set it down.
 * Spans come from the product's own safeCompanionSurfaces over the painted room controls and text, measured the
 * same way as helpers/companion-numbered-floor-157.ts. Only a pointer drag is used; no product state is touched. */
async function setBallInOpenFloorSpan(page: Page, home: Locator, phase: string) {
  const measured = await home.evaluate((house, inset) => {
    const visible = (node: Element) => { const r = node.getBoundingClientRect(), css = getComputedStyle(node); return r.width > 0 && r.height > 0 && css.visibility !== "hidden" && css.display !== "none" && !node.closest('[hidden],[inert],[aria-hidden="true"]'); };
    const rect = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    const floor = house.querySelector(".vc-home-floor")!.getBoundingClientRect(), pet = document.querySelector(".vc-companion")!.getBoundingClientRect();
    const obstacles = [...house.querySelectorAll("button,a[href],input,select,textarea,[role='button']")]
      .filter(node => visible(node) && !node.closest(".vc-companion,.vc-cushion-button,.vc-toys,.vc-toy,[data-home-decoration-control]")).map(node => rect(node.getBoundingClientRect()));
    const walker = document.createTreeWalker(house, NodeFilter.SHOW_TEXT); let text: Node | null;
    while ((text = walker.nextNode())) {
      if (!text.textContent?.trim() || !text.parentElement || !visible(text.parentElement)) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) obstacles.push(rect(r));
    }
    return { floor: { x: floor.left, y: floor.bottom - inset, width: floor.width }, size: pet.width, obstacles, viewport: { width: innerWidth, height: innerHeight } };
  }, COMPANION_HOME_FLOOR_INSET);
  const spans = safeCompanionSurfaces(measured.floor, measured.obstacles, measured.size, measured.viewport, { width: measured.size * .76, height: measured.size * .76 });
  const span = [...spans].sort((a, b) => b.width - a.width)[0];
  expect(span, "an actual safe floor span exists").toBeTruthy();
  // The toss clamp leaves span.width - 32 px of sideways room; the original rule needs at least 8 px of it each way.
  expect(span.width, "the widest floor span leaves room for an unclamped toss").toBeGreaterThan(32 + 2 * 24);
  const ball = page.locator(".vc-toy"), r = (await ball.boundingBox())!, target = { x: span.x + span.width / 2, y: span.y - 24 };
  await page.mouse.move(r.x + r.width / 2, r.y + r.height - 6); await page.mouse.down(); await expect(ball).toHaveAttribute("data-held", "true");
  // The last pointer step sets the release velocity; end with a 1px step so the ball is set down, not flung.
  await page.mouse.move(target.x, target.y, { steps: 10 }); await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.mouse.move(target.x, target.y + 1); await page.mouse.up(); await page.mouse.move(2, 2);
  await expect(ball).toHaveAttribute("data-held", "false"); await expect(ball).toHaveAttribute("data-falling", "false", { timeout: 6000 });
  const rest = (await ball.boundingBox())!, restX = rest.x + rest.width / 2;
  proofs.get(page)!.notes.push({ ballSetInOpenFloorSpan: { phase, span, spans, restX } });
  expect(Math.abs(restX - target.x), "the set-down ball rests in the open middle of that span").toBeLessThanOrEqual(span.width / 2 - 16 - 24);
}

test("141 a native spawned toy stays unknown until visible completed play and earns one book flight", async ({ page }) => {
  // Preparation draws are finite and separate from the unchanged75s first
  // discovery and65s actual replay windows below. This is not a rarity guarantee.
  test.setTimeout(950000); const home = await fixture(page, "studio"); await choose(page, "mischievous", false); await placeCompanionOnHomeFloor(page);
  // Use the actual weighted catalogue. Return unwanted native draws
  // through the actual opening; no kind, weight, model or RNG is supplied.
  let id = "",actualDraws=0;
  for (let draw = 0; draw < 320; draw++) {
    await home.locator('[data-home-action="toys"]').focus(); await page.keyboard.press("Enter"); const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
    actualDraws++;
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").toys ?? [], COMPANION_TASTES_KEY)).toEqual([]);
    if (await toy.getAttribute("data-kind") === "ball") { id = (await toy.getAttribute("data-toy-id"))!; break; }
    const r = (await toy.boundingBox())!, b = (await home.locator(".vc-toy-box-opening").boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height - 6); await page.mouse.down(); await expect(toy).toHaveAttribute("data-held","true"); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await expect(home.locator('[data-home-action="toys"]')).toHaveAttribute("data-toy-over", ""); await page.mouse.up(); await expect(toy).toHaveCount(0);
  }
  proofs.get(page)!.notes.push({ actualWeightedPreparationDraws:actualDraws,maximumDraws:320,targetKind:"ball",randomOrRarityOverride:false,firstDiscoveryTimeoutMs:75000,sameIdReplayTimeoutMs:65000 });
  expect(id,"bounded actual weighted draws must produce the target; absence is a preserved setup failure, never forced").not.toBe("");
  // The product keeps a tossed ball inside its support (viewer-companion.tsx clamps the carried point to
  // platform.x+16 .. platform.x+width-16), so a toss played at a span edge has no sideways travel. The drawn ball
  // lands beside the toy box near such an edge, and each toss carries it on towards one. Before the first play and
  // again before the replay, carry it by pointer to the centre of the widest measured floor span, so both plays
  // happen where the full original toss (including >= 8 px sideways travel) can be painted.
  await setBallInOpenFloorSpan(page, home, "before-first-play");
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").toys ?? [], COMPANION_TASTES_KEY)).toEqual([]);
  await startProbe(page); await choose(page, "mischievous", true);
  const discoveryStarted = Date.now();
  // The first completed play commits the ball to the collection; then wait for that same ball to come to rest.
  await expect.poll(async () => (await observation(page)).samples.some(frame => frame.knownToys.includes("ball")), { timeout: 75000, intervals: [100] }).toBe(true);
  const resting = page.locator(`.vc-toy[data-toy-id="${id}"]`);
  await expect.poll(async () => resting.evaluate(node => { const n = node as HTMLElement; return n.dataset.carried !== "true" && n.dataset.held !== "true" && n.dataset.falling !== "true"; }), { timeout: 10000, intervals: [50] }).toBe(true);
  await setBallInOpenFloorSpan(page, home, "before-replay");
  const replayAfter = (await observation(page)).samples.at(-1)!.at;
  await expect.poll(async () => (await observation(page)).flights.some(f => f.kind === "toy" && f.id === "ball"), { timeout: Math.max(1000, 75000 - (Date.now() - discoveryStarted)), intervals: [100] }).toBe(true);
  const first = await observation(page), flight = first.flights.find(f => f.kind === "toy" && f.id === "ball")!;
  expect(flight.known).toBe(true); expect(flight.decoded).toBe(true); expect(flight.duration).toBe(1500); expect(flight.book).not.toBeNull();
  const prior = first.samples.filter(frame => frame.at <= flight.at); expect(prior.some(frame => frame.decoded && frame.toys.some(toy => toy.id === id && toy.carried && !toy.held))).toBe(true);
  expect(first.samples.some(frame => frame.knownToys.includes("ball"))).toBe(true);
  const firstKnown = first.samples.find(frame => frame.knownToys.includes("ball"));
  expect(firstKnown).toBeDefined();
  // The replay boundary is the pointer set-down after the first commit; it cannot precede that commit.
  expect(firstKnown!.at).toBeLessThanOrEqual(replayAfter);
  expect(firstKnown!.at).toBeLessThanOrEqual(flight.at);
  expect(first.samples.some(frame => frame.at < firstKnown!.at && frame.decoded && !frame.knownToys.includes("ball")
    && frame.toys.some(toy => toy.id === id && toy.carried && !toy.held))).toBe(true);
  // The ball was set in the open middle of a floor span above, so the original >= 8 px sideways minimum applies.
  const edgeToss = { minLateralCssPx: 8 };
  // Observe a NEW pickup and the current149 full ball throw/catch, then its
  // real release/flight/rest. The legacy1100ms pounce observer remains intact
  // in its own helper/tests; it cannot certify this different2600ms use.
  // The collection commit follows the first completed play. Its visual notice
  // can wait behind other discoveries and begin AFTER the next real pickup.
  // Keep that queued animation's assertions separate from the replay boundary.
  await expect.poll(async () => Boolean(completedNativeBallUseReplay((await observation(page)).samples, id, replayAfter, edgeToss)),
    { timeout: 65000, intervals: [100] }).toBe(true);
  proofs.get(page)!.notes.push({ samePhysicalToyReplay: completedNativeBallUseReplay((await observation(page)).samples, id, replayAfter, edgeToss),
    firstCollectionCommitAt: firstKnown!.at, openSpanSetDownAt: replayAfter, visualDiscoveryFlightAt: flight.at, replayBoundary: "open-span-set-down-after-first-completed-play-collection-commit",
    expectedPlaybackMs: 2600, expectedUse: "ball-toss", expectedPlaybackRows: [1, 9], replayObserver: "156-current149", sameIdFlightCount: (await observation(page)).flights.filter(f => f.kind === "toy" && f.id === "ball").length });
  expect((await observation(page)).flights.filter(f => f.kind === "toy" && f.id === "ball")).toHaveLength(1);
});

for (const quiet of [false, true]) test(`141 actual first behavior discovery uses ${quiet ? "reduced static" : "one shrinking book"} presentation`, async ({ page }) => {
  // New initial poses may be discovered during hydration. Observe the genuine
  // first animation from the start; opening the book would cancel that flight.
  await fixture(page, "studio", 1920, quiet, true);
  await expect.poll(async () => (await observation(page)).flights.some(f => f.kind === "behavior" && f.known && f.decoded), { timeout: 45000, intervals: [100] }).toBe(true);
  const proof = await observation(page), flight = proof.flights.find(f => f.kind === "behavior" && f.known && f.decoded)!;
  expect(proof.samples.some(frame => frame.decoded && frame.at <= flight.at && frame.behaviors.includes(flight.id))).toBe(true);
  await expect.poll(async () => (await observation(page)).flights.find(f => f.key === flight.key)!.samples, { timeout: 4000 }).toBeGreaterThan(4);
  const final = (await observation(page)).flights.find(f => f.key === flight.key)!;
  if (quiet) { expect(final.duration).toBe(600); expect(new Set(final.frames.map(frame => frame.transform)).size).toBe(1); expect(Math.hypot(final.last.x - final.first.x, final.last.y - final.first.y)).toBeLessThan(.1); }
  else { expect(final.duration).toBe(1500); expect(final.book).not.toBeNull(); expect(String(final.frames.at(-1)?.transform)).toMatch(/scale\(0?\.45\)/); }
});
