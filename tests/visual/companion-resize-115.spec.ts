import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import ts from "typescript";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { CAL_ZOOM_STEPS } from "@/lib/ui/calendar-zoom";
import { COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

type Platform = { id: string; x: number; y: number; width: number; kind: string; manualOnly?: boolean };
type Sample = { at: number; stage: string; width: number; height: number; hidden: boolean; reason: string; state: string; support: string; x: number; y: number; pose: string; decoded: boolean };
type ProbeWindow = Window & { resize115Probe?: { samples: Sample[]; stage: string; stop: () => void } };
const output = process.env.VIC_RESIZE115_OUTPUT ?? ".scratch-pw/companion-115/motion/resize/native";
type Module = { code: string; imports: Record<string, string> };
const modules: Record<string, Module> = {};
function compile(path: string) {
  if (modules[path]) return;
  const code = path.endsWith(".json") ? `module.exports=${readFileSync(path, "utf8")}` : ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const imports: Record<string, string> = {}; modules[path] = { code, imports };
  for (const [, specifier] of code.matchAll(/require\("([^"]+)"\)/g)) {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) throw new Error(`Unexpected geometry dependency: ${specifier}`);
    const base = specifier.startsWith("@/") ? specifier.slice(2) : posix.normalize(posix.join(posix.dirname(path), specifier));
    const dependency = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find(existsSync);
    if (!dependency) throw new Error(`Missing geometry dependency: ${base}`);
    imports[specifier] = dependency; compile(dependency);
  }
}
compile("lib/ui/viewer-companion/geometry.ts");

async function readActualGeometry(page: Page) {
  // A separate finite read-only diagnostic observes the actual DOM AFTER the
  // native gesture. It never injects platforms or calls product handlers.
  return page.evaluate(async modules => {
    const cache = new Map<string, { exports: Record<string, unknown> }>();
    const load = (path: string): Record<string, unknown> => {
      const cached = cache.get(path); if (cached) return cached.exports;
      const source = modules[path], compiled = { exports: {} as Record<string, unknown> }; cache.set(path, compiled);
      new Function("require", "module", "exports", source.code)((id: string) => load(source.imports[id]), compiled, compiled.exports);
      return compiled.exports;
    };
    type Observer = (() => void) & { landings: () => readonly Platform[] };
    const observe = load("lib/ui/viewer-companion/geometry.ts").observeCompanionPlatforms as (root: HTMLElement, receive: (platforms: Platform[]) => void, options: { size: number; getHome: () => HTMLElement | null }) => Observer;
    const root = document.querySelector<HTMLElement>("[data-companion-surface='studio'],.poster-page")!;
    const rows: Array<{ at: number; platforms: Platform[]; landings: readonly Platform[] }> = [];
    let subscription: Observer | undefined;
    try {
      subscription = observe(root, platforms => rows.push({ at: performance.now(), platforms, landings: subscription?.landings() ?? [] }), { size: 92, getHome: () => document.querySelector(".vc-home-cushion") });
      await new Promise<void>(done => setTimeout(done, 400));
      return rows;
    } finally { subscription?.(); }
  }, modules);
}

test.use({ headless: true, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block" });
for (const [surface, trial] of [["viewer", 0], ["viewer", 1], ["viewer", 2], ["studio", 0]] as const) test(`${surface} native calendar zoom and viewport shrink retain an accessible companion (${trial})`, async ({ page }) => {
  test.setTimeout(30000); const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    return route.continue();
  });
  await page.addInitScript(({ key, epoch, prefs, care, collectionKey }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.removeItem(collectionKey);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: true, jump: true, sleep: false, feeding: true, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, energy: 1, hunger: .55 }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, collectionKey: COMPANION_COLLECTION_KEY });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?links=1" : "/visual-fixture/studio?role=owner&companionDrag=1");
  await page.bringToFront(); await settlePanelLayout(page);
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3117");
  const pet = page.locator(".vc-companion"); await expect(pet).toBeVisible(); await openCompanionHome(page);
  await page.evaluate(() => {
    const samples: Sample[] = [], began = performance.now(); let request = 0, stopped = false, previous = "", last = -Infinity;
    const probe = { samples, stage: "before", stop: () => { stopped = true; cancelAnimationFrame(request); } };
    (window as ProbeWindow).resize115Probe = probe;
    const tick = (now: number) => {
      if (stopped) return;
      const body = document.querySelector<HTMLElement>(".vc-companion")!, matrix = new DOMMatrixReadOnly(body.style.transform), size = parseFloat(body.style.getPropertyValue("--vc-size")), img = body.querySelector<HTMLImageElement>(".vc-texture");
      const sample: Sample = { at: now - began, stage: probe.stage, width: innerWidth, height: innerHeight, hidden: body.hidden, reason: body.dataset.hiddenReason ?? "", state: body.dataset.state ?? "", support: body.dataset.platform ?? "", x: matrix.m41 + size / 2, y: matrix.m42 + size, pose: body.dataset.pose ?? "", decoded: Boolean(img?.complete && img.naturalWidth) };
      const key = JSON.stringify([sample.stage, sample.hidden, sample.reason, sample.state, sample.support, sample.pose]);
      if (key !== previous || now - last >= 80) { samples.push(sample); previous = key; last = now; }
      request = requestAnimationFrame(tick);
    }; request = requestAnimationFrame(tick);
  });
  let actualGeometry: Awaited<ReturnType<typeof readActualGeometry>> = [];
  try {
    const calendar = page.locator(surface === "viewer" ? ".public-calendar-area" : ".studio-calendar-panel").first(), box = (await calendar.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 12); await page.keyboard.down("Control");
    try { for (let step = 1; step < CAL_ZOOM_STEPS.length; step++) { await page.evaluate(step => { (window as ProbeWindow).resize115Probe!.stage = `zoom-${step}`; }, step); await page.mouse.wheel(0, -120); await page.waitForTimeout(250); } } finally { await page.keyboard.up("Control"); }
    if (trial > 0) {
      // Native placement puts this trial in a genuine first-contact flight
      // while the following real resize/reflow changes its measured ledges.
      const target = await page.evaluate(trial => {
        const cards = [...document.querySelectorAll<HTMLElement>(".public-event[data-eventid]")].map(node => node.getBoundingClientRect())
          .filter(rect => rect.width > 100 && rect.top > 150 && rect.top < innerHeight - 80);
        cards.sort((a, b) => Math.abs(a.left + a.width / 2 - innerWidth * .68) - Math.abs(b.left + b.width / 2 - innerWidth * .68) || b.top - a.top);
        const card = cards[0]; if (!card) throw new Error("No actual visible card for native placement");
        return { x: card.left + Math.min(70, card.width / 2), y: card.top - (trial === 1 ? 30 : 65) };
      }, trial);
      const actor = page.locator(".vc-actor"); await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p");
      await expect(pet).toHaveAttribute("data-placing", ""); await page.mouse.click(target.x, target.y); await page.mouse.move(1880, 50);
      await page.waitForTimeout(trial === 1 ? 50 : 110);
    }
    await page.evaluate(() => { (window as ProbeWindow).resize115Probe!.stage = "shrink"; });
    await page.setViewportSize({ width: 1920, height: 700 }); await settlePanelLayout(page);
    // Cover the next autonomous leg too: the original B4 studio failure
    // landed safely first and only later revisited a stale tracked target.
    await page.waitForTimeout(4200);
    actualGeometry = await readActualGeometry(page);
    await expect(pet).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".vc-actor")).toBeVisible();
  } finally {
    const samples = await page.evaluate(() => { const probe = (window as ProbeWindow).resize115Probe; probe?.stop(); return probe?.samples ?? []; });
    mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/${surface}-${trial}.json`, JSON.stringify({ buildId: readFileSync(resolve(".next/BUILD_ID"), "utf8").trim(), url: page.url(), samples, actualGeometry, writes, errors }, null, 2));
    await page.screenshot({ path: `${output}/${surface}-${trial}.png` });
    expect(writes).toEqual([]); expect(errors).toEqual([]);
  }
});
