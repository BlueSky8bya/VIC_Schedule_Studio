import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const out=process.env.COMPANION155_OUTPUT??'.scratch-pw/companion-155';
const fonts=new Set([...readFileSync(resolve('app/fonts.css'),'utf8').matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match=>match[1]));
const proofs=new WeakMap<Page,{errors:string[];unexpected:string[];notes:unknown[]}>();
test.use({storageState:{cookies:[],origins:[]},serviceWorkers:'block',trace:companionTraceMode(),video:'on'});
test.setTimeout(45000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof = { errors: [] as string[], unexpected: [] as string[], notes: [] as unknown[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, proof.unexpected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previews.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.unexpected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});

test.afterEach(async({page},info)=>{const proof=proofs.get(page)!;mkdirSync(out,{recursive:true});const name=info.title.replace(/[^a-z0-9]+/gi,'-');writeFileSync(resolve(out,name+'.json'),JSON.stringify({case:info.title,status:info.status,buildId:readFileSync(resolve('.next/BUILD_ID'),'utf8').trim(),...proof},null,2));await page.screenshot({path:resolve(out,name+'.png')}).catch(()=>{});expect(proof.errors).toEqual([]);expect(proof.unexpected).toEqual([]);});
async function setup(page: Page, surface: "viewer" | "studio" | "preview", width: number, mode: "full" | "soft" | "off", dark = false) {
  await page.setViewportSize({ width, height: 780 });
  await page.addInitScript(({ defaults, memory, epoch, epochKey, mode, dark }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": mode === "full" ? "max" : mode === "soft" ? "auto" : "off", "vic.gfx": JSON.stringify({ mode, v: 3, at: Date.now() }), "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off", "vic.viewerCompanion": JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, sound: false, feeding: true, learnFromYou: false, ambientPrank: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }) })) localStorage.setItem(key, value);
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, mode, dark });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=autumn" : "/visual-fixture/studio?role=owner&y=2026&m=6&hour=23&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  if (width === 1100) { const fold = page.getByRole("button", { name: "패널 접기", exact: true }); if (await fold.isVisible()) { await fold.click(); await settlePanelLayout(page); } }
  await page.evaluate(() => document.fonts.ready);
  const home = await openCompanionHome(page); await settlePanelLayout(page);
  return home;
}


async function lampSample155(page: Page) {
  return page.locator(".vc-home:visible").evaluate(home => {
    const box = (selector: string) => { const r = home.querySelector(selector)!.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const body = box(".vc-home-lamp-paint"), knob = box(".vc-home-lamp-handle"), room = box(".vc-home-room");
    const lit = home.querySelector('[data-home-action="light"]')!.getAttribute("aria-pressed") === "true";
    const layers = [...home.querySelectorAll<HTMLElement>(".vc-home-lamp-art")].map(node => { const css = getComputedStyle(node); return { state: node.dataset.lampState, opacity: Number(css.opacity), src: css.borderImageSource, slice: css.borderImageSlice, head: parseFloat(css.borderTopWidth), tail: parseFloat(css.borderBottomWidth) }; });
    const cordHit = box(".vc-home-lamp-cord-hit"), cordCore = box(".vc-home-lamp-cord-core");
    const controls = [...home.querySelectorAll<HTMLElement>("[data-home-action]")].filter(node => !["light", "fold", "home"].includes(node.dataset.homeAction!)).map(node => {
      const r = node.getBoundingClientRect(), action = node.dataset.homeAction;
      return { action, rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        hits: [.25, .5, .75].map(fraction => ({ fraction, x: r.left + r.width * fraction, y: r.top + r.height * .5, hit: document.elementFromPoint(r.left + r.width * fraction, r.top + r.height * .5)?.closest<HTMLElement>("[data-home-action]")?.dataset.homeAction })) };
    });
    return { body, knob, room, lit, layers, cordHit, cordCore, controls, knobTarget: document.elementFromPoint((knob.left + knob.right) / 2, (knob.top + knob.bottom) / 2)?.closest("button")?.getAttribute("data-home-action"), obsoleteOverlays: home.querySelectorAll(".vc-home-lamp-cord,.vc-home-lamp-bulb").length };
  });
}

async function recordPaint155(page: Page, name: string) {
  const sample = await lampSample155(page), bytes = await page.locator(".vc-home:visible .vc-home-lamp-paint").screenshot();
  writeFileSync(resolve(out, name + "-lamp.png"), bytes);
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const active = sample.layers.find(layer => layer.opacity === 1)!;
  const scale = info.width / sample.body.width, head = Math.ceil(active.head * scale), tail = Math.ceil(active.tail * scale);
  const lineX = Math.round(info.width * 443 / 512), rows: { y: number; contrast: number; signedContrast: number }[] = [];
  const luma = (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]; };
  for (let y = head - 2; y < info.height - tail + 2; y++) {
    const center = Math.min(luma(lineX - 1, y), luma(lineX, y), luma(lineX + 1, y));
    const left = (luma(lineX - 5, y) + luma(lineX - 4, y)) / 2;
    // Highlighted cord pixels may be lighter than their backdrop. Retain
    // signed measurements while requiring contrast on every original row.
    rows.push({ y, contrast: Math.abs(left - center), signedContrast: left - center });
  }
  proofs.get(page)!.notes.push({ stage: "actual-rendered-cord", name, ...sample, pixels: { width: info.width, height: info.height, rows, missingCandidates: rows.filter(row => row.contrast < 1) } });
  // Both seams and every stretched middle row must retain a visible line.
  expect(rows.filter(row => row.contrast < 1), "rendered raster cord has a missing row").toEqual([]);
  return bytes;
}

async function feedback156(page: Page) {
  return page.locator(".vc-home:visible .vc-home-lamp").evaluate(lamp => {
    const paint = lamp.querySelector(".vc-home-lamp-paint")!, css = getComputedStyle(paint);
    const head = lamp.querySelector(".vc-home-lamp-art")!;
    return { height: paint.getBoundingClientRect().height, visualScale: paint.getBoundingClientRect().height / Number.parseFloat(css.height), head: getComputedStyle(head).borderTopWidth,
      opacity: Math.max(...[...lamp.querySelectorAll(".vc-home-lamp-cord-feedback")].map(node => Number(getComputedStyle(node).opacity))),
      transition: css.transitionDuration, hoveredCord: Boolean(lamp.querySelector(".vc-home-lamp-cord-hit:hover,.vc-home-lamp-cord-core:hover")) };
  });
}

async function widerCord158(page: Page, name: string) {
  const home = page.locator(".vc-home:visible"), lamp = home.locator("[data-home-action=light]");
  const wall = (await home.locator(".vc-home-room").boundingBox())!;
  await page.mouse.click(wall.x + wall.width - 3, wall.y + 12); await page.mouse.move(wall.x + wall.width - 3, wall.y + 12);
  await expect.poll(async () => (await feedback156(page)).opacity).toBe(0);
  const sample = await lampSample155(page), target = sample.cordHit, center = (sample.knob.left + sample.knob.right) / 2;
  proofs.get(page)!.notes.push({ stage: "wider-cord158-probe", name, sample });
  expect(target.width).toBeGreaterThanOrEqual(31.8);
  const nearby = sample.controls.filter(control => ["radio", "book", "curtain"].includes(control.action!));
  for (const control of nearby) for (const point of control.hits) {
    const core = sample.cordCore, onCord = point.x >= core.left && point.x <= core.right && point.y >= core.top && point.y <= core.bottom;
    expect(point.hit, control.action + " keeps its target outside the original cord core").toBe(onCord ? "light" : control.action);
    if (point.fraction === .5) expect(point.hit, control.action + " center stays usable").toBe(control.action);
  }
  // Actual native clicks13px to either side of the thin cord, outside its
  // previous7px tolerance. Use clear wall above the neighboring shelf.
  const y = target.top + 5, initial = String(await lamp.getAttribute("aria-pressed"));
  expect(initial).toMatch(/^(true|false)$/);
  const hits: unknown[] = [];
  for (const offset of [-13, 13]) {
    const x = center + offset;
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-home-action]")?.dataset.homeAction, { x, y });
    expect(hit).toBe("light"); await page.mouse.move(x, y); await expect.poll(async () => (await feedback156(page)).opacity).toBe(1);
    const before = await lamp.getAttribute("aria-pressed"); await page.mouse.click(x, y); await expect(lamp).toHaveAttribute("aria-pressed", String(before !== "true")); hits.push({ x, y, offset, hit });
  }
  await expect(lamp).toHaveAttribute("aria-pressed", initial);
  proofs.get(page)!.notes.push({ stage: "wider-cord158", name, target, core: sample.cordCore, physicalHandle: sample.knob, controls: nearby, observedControls: sample.controls, hits, sameNativeButton: true });
}

for (const [surface, mode, compact, dark] of [
  ["viewer", "full", false, false], ["viewer", "full", false, true],
  ["studio", "full", false, true], ["preview", "full", false, true],
  ["viewer", "full", true, false], ["viewer", "full", true, true],
  ["viewer", "soft", false, true], ["viewer", "off", false, false],
] as const) test("155 " + surface + " " + mode + " " + (compact ? "compact" : "panel") + " " + (dark ? "dark" : "light") + " connected selected lamp", async ({ page }) => {
  let home = await setup(page, surface, 1920, mode, dark);
  if (compact) {
    const panel = page.locator(".poster-panel-ctl [data-act=panel-toggle]").first();
    await panel.click(); await expect(panel).toHaveAttribute("aria-pressed", "false"); await settlePanelLayout(page);
    home = await openCompanionHome(page); await expect(home).toHaveAttribute("data-home-presentation", "compact"); await settlePanelLayout(page);
  }
  const fold = home.locator("[data-home-action=fold]");
  if (await fold.count() && await fold.getAttribute("aria-expanded") === "false") await fold.click();
  const lamp = home.locator("[data-home-action=light]"), curtain = home.locator("[data-home-action=curtain]");
  await page.evaluate(async () => { await Promise.all(["off", "on"].map(async state => { const image = new Image(); image.src = "/companion/home/155/lamp-" + state + ".webp"; await image.decode(); })); });
  for (const lit of [false, true]) {
    if (await lamp.getAttribute("aria-pressed") !== String(lit)) await lamp.click();
    await expect(lamp).toHaveAttribute("aria-pressed", String(lit));
    const wall = (await home.locator(".vc-home-room").boundingBox())!;
    await page.mouse.click(wall.x + wall.width - 3, wall.y + 12); await page.mouse.move(1, 1);
    const before = await lampSample155(page), active = before.layers.filter(layer => layer.opacity === 1);
    expect(before.obsoleteOverlays).toBe(0); expect(active).toHaveLength(1);
    expect(active[0].state).toBe(lit ? "on" : "off"); expect(active[0].src).toContain("/companion/home/155/lamp-" + (lit ? "on" : "off") + ".webp");
    expect(active[0].slice).toBe("304 0 84 fill");
    expect(before.knob.left).toBeGreaterThan(before.body.left + before.body.width / 2);
    expect(before.knob.bottom).toBeLessThan(before.room.bottom); expect(before.knobTarget).toBe("light");
    const name = [surface, mode, compact ? "compact" : "panel", dark ? "dark" : "light", lit ? "on" : "off"].join("-");
    mkdirSync(out, { recursive: true }); await home.screenshot({ path: resolve(out, name + ".png") }); const ordinary = await recordPaint155(page, name);
    const idle = await feedback156(page); expect(idle.opacity).toBe(0);
    const handle = before.knob; await page.mouse.move((handle.left + handle.right) / 2, (handle.top + handle.bottom) / 2);
    await expect.poll(async () => (await feedback156(page)).opacity).toBe(1);
    await expect.poll(async () => (await feedback156(page)).height - idle.height).toBeCloseTo(mode === "full" ? 1.5 * idle.visualScale : 0, 1);
    const hover = await feedback156(page); expect(hover.hoveredCord).toBe(true); expect(hover.head).toBe(idle.head);
    const highlighted = await recordPaint155(page, name + "-hover");
    const plain = await sharp(ordinary).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const glow = await sharp(highlighted).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let changedCordPixels = 0, changedGlobePixels = 0;
    for (let y = 2; y < Math.min(plain.info.height, glow.info.height) - 2; y++) for (let x = 1; x < plain.info.width - 1; x++) {
      const i = (y * plain.info.width + x) * plain.info.channels;
      const changed = [0, 1, 2].some(channel => Math.abs(plain.data[i + channel] - glow.data[i + channel]) > 3);
      if (changed && x > plain.info.width * .82 && x < plain.info.width * .94 && y > Number.parseFloat(idle.head)) changedCordPixels++;
      if (changed && x < plain.info.width * .78 && y < Number.parseFloat(idle.head) - 2) changedGlobePixels++;
    }
    expect(changedCordPixels).toBeGreaterThan(5); expect(changedGlobePixels).toBe(0);
    proofs.get(page)!.notes.push({ stage: "cord-hover156", name, idle, hover, changedCordPixels, changedGlobePixels });
    const k = before.knob; await page.mouse.move((k.left + k.right) / 2, (k.top + k.bottom) / 2); await page.mouse.down();
    const pressed = await lampSample155(page);
    expect(pressed.layers.map(layer => layer.head)).toEqual(before.layers.map(layer => layer.head));
    expect(pressed.knob.top).toBeGreaterThanOrEqual(before.knob.top); expect(pressed.knobTarget).toBe("light");
    await recordPaint155(page, name + "-pressed"); await page.mouse.up();
    await expect(lamp).toHaveAttribute("aria-pressed", String(!lit)); await lamp.focus(); await lamp.press("Enter"); await expect(lamp).toHaveAttribute("aria-pressed", String(lit));
  }
  if (surface === "viewer" && mode === "full" && !compact && !dark) {
    await page.mouse.click(1, 1); await page.mouse.move(1, 1); await page.emulateMedia({ reducedMotion: "reduce" });
    const quiet = await feedback156(page), handle = (await lampSample155(page)).knob;
    await page.mouse.move((handle.left + handle.right) / 2, (handle.top + handle.bottom) / 2);
    const quietHover = await feedback156(page); expect(quietHover.height).toBe(quiet.height); expect(quietHover.opacity).toBe(1); expect(quietHover.transition).toBe("0s");
    await page.mouse.down(); expect((await feedback156(page)).height).toBe(quiet.height); await page.mouse.up();
    proofs.get(page)!.notes.push({ stage: "system-reduced-motion156", quiet, quietHover });
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  const saved = (await lamp.getAttribute("aria-pressed"))!; await curtain.click(); await expect(lamp).toHaveAttribute("aria-pressed", saved);
  const radio = home.locator("[data-home-action=radio]");
  const hit = await radio.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button")?.getAttribute("data-home-action"); });
  expect(hit).toBe("radio"); await radio.click(); await expect(radio).toHaveAttribute("aria-pressed", "false"); await expect(lamp).toHaveAttribute("aria-pressed", saved);
  await widerCord158(page, [surface, mode, compact ? "compact" : "panel", dark ? "dark" : "light"].join("-"));
});

for (const surface of ["viewer", "studio"] as const) test("158 " + surface + " narrow panel keeps furniture clickable around the wider invisible cord", async ({ page }) => {
  let home = await setup(page, surface, 1440, "full");
  const panel = page.locator(".panel-place-ctl [data-act=panel-toggle]:visible").first();
  await expect(panel).toBeVisible();
  if (await panel.getAttribute("aria-pressed") === "false") {
    if (await home.locator(".vc-home-close").isVisible()) await home.locator(".vc-home-close").click();
    await panel.click(); await expect(panel).toHaveAttribute("aria-pressed", "true"); await settlePanelLayout(page);
    home = await openCompanionHome(page); await settlePanelLayout(page);
  }
  await expect(home).toHaveAttribute("data-home-presentation", "panel");
  const fold = home.locator("[data-home-action=fold]");
  if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
  await expect(home.locator(".vc-home-room")).toBeVisible(); await settlePanelLayout(page);
  await widerCord158(page, surface + "-narrow");
});
