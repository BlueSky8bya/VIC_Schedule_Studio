import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = process.env.COMPANION164_OUTPUT ?? ".scratch-pw/reach164-observations";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
type Surface = "viewer" | "studio" | "preview";
type Proof = { rejected: string[]; errors: string[]; notes: unknown[] };
const proofs = new Map<Page, Proof>();
type ReachWindow = Window & { reach164?: { frames: ReachFrame[]; stop: () => void } };
type ReachFrame = { at: number; x: number; y: number; state: string; support: string; life: string; command: string; reaching: string; lit: boolean; touching: boolean; knob: { x: number; y: number }; room: { width: number; height: number }; transform: string };
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
test.setTimeout(70000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof: Proof = { rejected: [], errors: [], notes: [] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const manifest = JSON.parse(readFileSync(resolve(".next/server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(manifest).filter(([, v]) => v.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin) { if (req.resourceType() === "font") return fulfillReadOnlyFont(route, fonts, proof.rejected); proof.rejected.push(req.method() + " " + url.pathname); return route.abort(); }
    if (!["GET", "HEAD"].includes(req.method())) {
      if (["/api/activity", "/api/visit", "/api/presence", "/api/visit-session", "/api/visit-ping"].includes(url.pathname)) return route.fulfill({ json: { ok: true, skipped: true } });
      if (url.pathname === "/visual-fixture/studio" && previews.has(req.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
      proof.rejected.push(req.method() + " " + url.pathname); return route.abort();
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  const frames = await page.evaluate(() => { const p = (window as ReachWindow).reach164; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"); mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, name + ".json"), JSON.stringify({ status: info.status, ...proof, frames, buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), scope: "Production-build fixtures; synthetic preferences/care only; native inputs, measured geometry, real time/RNG/physics. No DB/login." }, null, 2));
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); proofs.delete(page);
});
async function seed(page: Page) {
  await page.addInitScript(({ prefs, memory, epoch, key }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, personality: "balanced", personalitySource: "manual", roam: false, feeding: true, sleep: true, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: true }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
}
async function open(page: Page, surface: Surface, compact: boolean) {
  const response = await page.goto(surface === "viewer" ? `/visual-fixture/poster?hour=0${compact ? "&avatar=1" : ""}` : "/visual-fixture/studio?role=owner&y=2025&m=10&hour=0&weather=clear");
  proofs.get(page)!.notes.push({ stage: "actual-html", sha256: createHash("sha256").update(await response!.body()).digest("hex"), surface });
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  let house = await openCompanionHome(page);
  if (compact && await house.getAttribute("data-home-presentation") !== "compact") {
    const panel = page.locator('.panel-place-ctl [data-act="panel-toggle"]:visible,.poster-panel-ctl [data-act="panel-toggle"]:visible').first();
    await panel.click(); await expect(panel).toHaveAttribute("aria-pressed", "false"); await settlePanelLayout(page); house = await openCompanionHome(page);
  }
  if (!compact && await house.getAttribute("data-home-presentation") !== "panel") {
    await house.getByRole("button", { name: "빅타민 집 닫기", exact: true }).click();
    const panel = page.locator('.panel-place-ctl [data-act="panel-toggle"]:visible,.poster-panel-ctl [data-act="panel-toggle"]:visible').first();
    await panel.click(); await expect(panel).toHaveAttribute("aria-pressed", "true"); await settlePanelLayout(page); house = await openCompanionHome(page);
  }
  const fold = house.locator('[data-home-action="fold"]');
  if (await fold.count() && await fold.getAttribute("aria-expanded") === "false") await fold.click();
  await settlePanelLayout(page); await page.mouse.move(2, 2);
  return house;
}
async function observe(page: Page) {
  await page.evaluate(() => {
    let raf = 0; const frames: ReachFrame[] = [], start = performance.now();
    const tick = () => {
      const actor = document.querySelector<HTMLElement>(".vc-companion"), body = actor?.getBoundingClientRect();
      const lamp = document.querySelector<HTMLElement>(".vc-home [data-home-action=light]"), knob = lamp?.querySelector(".vc-home-lamp-handle")?.getBoundingClientRect();
      const room = document.querySelector(".vc-home-room")?.getBoundingClientRect();
      if (actor && body && lamp && knob && room && frames.length < 3200) frames.push({ at: performance.now() - start, x: body.left + body.width / 2, y: body.bottom, state: actor.dataset.state ?? "", support: actor.dataset.platform ?? "", life: actor.dataset.homeLife ?? "", command: actor.dataset.personalityCommand ?? "", reaching: actor.dataset.homeReaching ?? "", lit: lamp.getAttribute("aria-pressed") === "true", touching: lamp.hasAttribute("data-companion-touch"), knob: { x: knob.left + knob.width / 2, y: knob.top + knob.height / 2 }, room: { width: room.width, height: room.height }, transform: actor.style.transform });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); (window as ReachWindow).reach164 = { frames, stop() { cancelAnimationFrame(raf); } };
  });
}
for (const [surface, width, compact, source] of [
  ["viewer", 1100, true, "floor"], ["viewer", 1494, true, "floor"], ["viewer", 1700, true, "floor"], ["viewer", 1920, true, "floor"], ["viewer", 2560, true, "floor"], ["viewer", 1494, false, "floor"],
  ["studio", 1494, true, "floor"], ["studio", 1920, true, "floor"], ["studio", 2560, true, "floor"], ["studio", 1494, false, "floor"], ["preview", 1920, true, "floor"], ["preview", 1494, false, "floor"],
  ["viewer", 2560, true, "sofa"], ["studio", 1920, true, "sofa"],
] as const) test(`164 ${surface} ${width} ${compact ? "compact" : "panel"} ${source} lamp off physically returns to sleep`, async ({ page }) => {
  await page.setViewportSize({ width, height: 937 });
  await seed(page); const house = await open(page, surface, compact), actor = page.locator(".vc-companion");
  // Keep the initial lamp state stable during layout/placement. Native ON
  // starts the existing living loop immediately before observing the intent.
  await house.locator('[data-home-action="personality"]').click();
  const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await book.getByRole("tab", { name: "움직임", exact: true }).click();
  await book.locator('[data-act="companion-roam"]').setChecked(true);
  await book.getByRole("button", { name: "닫기", exact: true }).click();
  // Changing motion preferences reconstructs the controller. Finish a native
  // placement on its freshly measured support before issuing the sleep key.
  await placeCompanionOnHomeFloor(page);
  if (source === "sofa") {
    const cushion = (await house.locator(".vc-home-cushion").boundingBox())!;
    await actor.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }).press("p");
    await page.mouse.click(cushion.x + cushion.width / 2, cushion.y + cushion.height / 2); await page.mouse.move(2, 2);
    await expect(actor).toHaveAttribute("data-platform", "companion-home"); await expect(actor).not.toHaveAttribute("data-state", "jump");
  }
  await expect(house).toHaveAttribute("data-home-presentation", compact ? "compact" : "panel");
  await expect(house.locator(".vc-home-room")).toHaveAttribute("data-night", "true");
  await expect(house.locator("[data-home-action=light]")).toHaveAttribute("aria-pressed", "true");
  await observe(page);
  await actor.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }).press("n"); await page.mouse.move(2, 2);
  await expect(house.locator("[data-home-action=light]")).toHaveAttribute("aria-pressed", "false", { timeout: 18000 });
  await expect(actor).toHaveAttribute("data-state", "sleep", { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => { const frames = (window as ReachWindow).reach164!.frames, contact = frames.find(f => f.touching); return Boolean(contact && frames.some(f => f.state === "sleep" && f.at > contact.at && f.y > contact.y + 20)); })).toBe(true);
  const frames = await page.evaluate(() => (window as ReachWindow).reach164!.frames);
  const contact = frames.find(f => f.touching); expect(contact).toBeTruthy();
  expect(frames.find(f => !f.lit)!.at).toBeGreaterThanOrEqual(contact!.at);
  expect(frames.some(f => f.state === "sleep" && f.at > contact!.at && f.y > contact!.y + 20)).toBe(true);
  expect(frames.filter((f, i) => f.reaching === "light" && frames[i - 1]?.reaching !== "light")).toHaveLength(1);
  // A native request to wash wakes the resident. Its awake-light trip must
  // finish at the real cord before the retained pad approach and brush ACK.
  await house.getByRole("button", { name: "샤워패드에서 씻기", exact: true }).click(); await page.mouse.move(2, 2);
  await expect(house.locator("[data-home-action=light]")).toHaveAttribute("aria-pressed", "true", { timeout: 18000 });
  await expect(actor).toHaveAttribute("data-washing", "", { timeout: 25000 });
  await page.waitForTimeout(650); await page.screenshot({ path: resolve(output, `${surface}-${width}-${compact ? "compact" : "panel"}-${source}-wash.png`) });
  await expect(actor).not.toHaveAttribute("data-washing", "", { timeout: 12000 });
  await expect(actor).not.toHaveAttribute("data-platform", "companion-home-floor-400", { timeout: 12000 });
  const sequence = await page.evaluate(() => (window as ReachWindow).reach164!.frames);
  const on = sequence.find(f => f.at > contact!.at + 500 && f.lit);
  expect(on).toBeTruthy();
  expect(sequence.some(f => f.at > contact!.at + 500 && f.at <= on!.at && f.touching)).toBe(true);
});
