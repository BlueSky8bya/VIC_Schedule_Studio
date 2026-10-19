import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANION_PERSONALITY_NAMES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { chooseCompanionPersonality, openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

const out = process.env.COMPANION138_OUTPUT ?? ".scratch-pw/companion-138/native";
const baseline = process.env.COMPANION138_BASELINE === "1";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
const proof = new WeakMap<Page, { errors: string[]; unexpected: string[] }>();
type Frame = { phase: string; scroll: number; front: boolean; dx: number; dy: number; actorDx: number; actorDy: number; support: string; visible: boolean };
type ProbeWindow = Window & { scroll138?: { frames: Frame[]; stop(): void } };
test.use({ viewport: { width: 1920, height: 780 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
test.setTimeout(70000);

test.beforeEach(async ({ page, context, baseURL }) => {
  const p = { errors: [] as string[], unexpected: [] as string[] }; proof.set(page, p);
  page.on("pageerror", e => p.errors.push(e.message));
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(".next/server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewIds = new Set(Object.entries(actions).filter(([, a]) => a.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === "GET" && req.resourceType() === "font" && fonts.has(u.href)) return route.continue();
    if (u.origin === origin && req.method() === "POST" && u.pathname === "/visual-fixture/studio" && previewIds.has(req.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (u.origin !== origin || !["GET", "HEAD"].includes(req.method())) { p.unexpected.push(req.method() + " " + u.origin + u.pathname); return route.abort(); }
    if (u.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});

test("138 unconfigured refreshes stay random while explicit choice survives preview and reload", async ({ page }) => {
  await setup(page, "studio", true);
  const read = async () => {
    const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
    await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
    const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }); await expect(group.getByRole("radio")).toHaveCount(9);
    const current = await group.locator('[aria-checked="true"]').innerText();
    await expect(dialog.getByText("직접 고른 성격은 새로고침 후에도 유지돼요.", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden();
    expect(Object.values(COMPANION_PERSONALITY_NAMES)).toContain(current.trim()); return current.trim();
  };
  const initial = await read();
  const refreshed: string[] = [];
  // Independent draws may repeat. Unit tests enumerate all nine exact draws;
  // this bounded native smoke observes actual documents without RNG injection.
  for (let i = 0; i < 8; i++) { await page.reload(); await page.bringToFront(); await settlePanelLayout(page); refreshed.push(await read()); }
  expect(new Set(refreshed).size).toBeGreaterThan(1);
  await chooseCompanionPersonality(page, "mischievous"); expect(await read()).toBe("사고뭉치");
  await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page);
  expect(await read()).toBe("사고뭉치");
  const pinned: string[] = [];
  for (let i = 0; i < 3; i++) { await page.reload(); await page.bringToFront(); await settlePanelLayout(page); pinned.push(await read()); }
  expect(pinned).toEqual(["사고뭉치", "사고뭉치", "사고뭉치"]);
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/random-refresh.json`, JSON.stringify({ initial, manual: "사고뭉치", sameDocumentPreview: true, refreshed, pinned, distinct: new Set(refreshed).size, nativeRngNotPatched: true }));
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).scroll138; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  mkdirSync(out, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ ...proof.get(page), status: info.status, frames, baseline, scope: "Native wheel/keyboard/manual household interactions; read-only event/frame observations. Saved settings fixture only; no RNG, clock, geometry or engine injection." }, null, 2));
  await page.screenshot({ path: `${out}/${name}.png` }).catch(() => {});
  expect(proof.get(page)!.errors).toEqual([]); expect(proof.get(page)!.unexpected).toEqual([]);
});

async function setup(page: Page, surface: "viewer" | "studio" | "preview", dark: boolean) {
  await page.addInitScript(({ defaults, epoch, epochKey, dark }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }), "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    if (!localStorage.getItem("vic.viewerCompanion")) localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, activeWhileVisible: true, sleep: false, sound: false }));
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=6&hour=23&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await page.evaluate(() => document.fonts.ready); return openCompanionHome(page);
}

for (const surface of ["viewer", "studio", "preview"] as const) for (const dark of [true, false]) test(`138 ${surface} ${dark ? "dark" : "light"} sofa and weekday surface follow rapid native scroll`, async ({ page }) => {
  const home = await setup(page, surface, dark); await placeCompanionOnHomeFloor(page);
  const furniture = await home.locator(".vc-home-room").evaluate(room => {
    const r = room.getBoundingClientRect();
    return { room: { width: r.width, height: r.height }, objects: [".vc-cushion-button", ".vc-home-tv", ".vc-dispenser", ".vc-toy-box", ".vc-home-wash-pad", ".vc-home-trash"].map(selector => {
      const b = room.querySelector(selector)!.getBoundingClientRect(); return { selector, x: b.x - r.x, y: b.y - r.y, width: b.width, height: b.height, bottom: b.bottom - r.y };
    }) };
  });
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${surface}-${dark ? "dark" : "light"}-furniture.json`, JSON.stringify(furniture));
  expect(furniture.objects.every(o => o.x >= 0 && o.y >= 0 && o.bottom <= furniture.room.height)).toBe(true);
  const sofa = home.locator('[data-home-action="home"]');
  await sofa.focus(); await sofa.press("Enter"); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home", { timeout: 20000 });
  await expect(page.locator(".vc-bed-foreground")).toBeVisible();
  // Native calendar zoom creates a real document scroll range, not a fake
  // spacer or changed geometry. The actual wheel remains the only transport.
  const grid = (await page.locator(surface === "studio" ? ".studio-month-grid" : ".public-month-grid").boundingBox())!;
  await page.mouse.move(grid.x + grid.width * .65, Math.min(700, grid.y + 100));
  await page.keyboard.down("Control");
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(260); }
  await page.keyboard.up("Control");
  await settlePanelLayout(page);
  await page.evaluate(() => {
    const frames: Frame[] = []; let id = 0, stopped = false, scroller: Element | null = null;
    const sample = (phase: string) => {
      const bed = document.querySelector(".vc-plush-bed"), front = document.querySelector<HTMLElement>(".vc-bed-foreground"), actor = document.querySelector<HTMLElement>(".vc-companion"), seat = document.querySelector(".vc-home-cushion");
      if (!bed || !front || !actor || !seat) return;
      const b = bed.getBoundingClientRect(), f = front.getBoundingClientRect(), a = actor.getBoundingClientRect(), s = seat.getBoundingClientRect();
      frames.push({ phase, scroll: scroller?.scrollTop ?? scrollY, front: !front.hidden && f.width > 0, dx: f.x - b.x, dy: f.y - b.y, actorDx: a.x + a.width / 2 - (s.x + s.width / 2), actorDy: a.bottom - s.top, support: actor.dataset.platform ?? "", visible: !actor.hidden });
    };
    const scroll = (event: Event) => { scroller = event.target instanceof Element ? event.target : null; sample("scroll"); }; const frame = () => { if (!stopped) { sample("frame"); id = requestAnimationFrame(frame); } };
    window.addEventListener("scroll", scroll, { passive: true, capture: true }); id = requestAnimationFrame(frame);
    (window as ProbeWindow).scroll138 = { frames, stop() { stopped = true; cancelAnimationFrame(id); window.removeEventListener("scroll", scroll, true); } };
  });
  for (const delta of [170, 260, -160, 420, -450, 500, -700]) { await page.mouse.wheel(0, delta); await page.waitForTimeout(70); }
  await page.waitForTimeout(350);
  const frames = await page.evaluate(() => (window as ProbeWindow).scroll138!.frames);
  expect(new Set(frames.map(f => Math.round(f.scroll))).size).toBeGreaterThan(2);
  const visible = frames.filter(f => f.front && f.visible && f.support === "companion-home"); expect(visible.length).toBeGreaterThan(3);
  if (!baseline) {
    expect(Math.max(...visible.map(f => Math.abs(f.dx)))).toBeLessThan(2);
    expect(Math.max(...visible.map(f => Math.abs(f.dy)))).toBeLessThan(2);
    expect(Math.max(...visible.map(f => Math.abs(f.actorDy)))).toBeLessThan(2);
  }
  await page.mouse.wheel(0, 450); await page.waitForTimeout(250);
  const weekdays = page.locator(surface === "studio" ? ".studio-weekdays" : ".weekday-stick"); await expect(weekdays).toBeVisible();
  const colors = await weekdays.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, expected: getComputedStyle(document.documentElement).getPropertyValue("--cal-head").trim(), color: getComputedStyle(node.querySelector("span")!).color }));
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${surface}-${dark ? "dark" : "light"}-weekday.json`, JSON.stringify(colors));
  if (!baseline) {
    const hex = colors.expected.match(/^#([a-f\d]{6})$/i)![1];
    expect(colors.background).toBe(`rgb(${[0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`);
  }
});
