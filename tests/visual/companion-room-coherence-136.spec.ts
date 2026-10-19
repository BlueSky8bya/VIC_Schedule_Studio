import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_HOME_LIGHT_KEY } from "@/lib/ui/viewer-companion/home-light";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = process.env.COMPANION136_OUTPUT ?? ".scratch-pw/companion-136/native";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
test.setTimeout(90000);
test.use({ serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
const proofs = new WeakMap<Page, { errors: string[]; unexpected: string[] }>();
test.beforeEach(async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin, proof = { errors: [] as string[], unexpected: [] as string[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.unexpected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => { const proof = proofs.get(page)!; expect(proof.errors).toEqual([]); expect(proof.unexpected).toEqual([]); });

async function seed(page: Page, dark: boolean, sleep = false) {
  await page.addInitScript(({ prefs, epochKey, epoch, dark, sleep }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, sleep, sound: false }));
    // Deliberately no light key: real first defaults and subsequent native
    // decisions must establish it, including after this init script reruns.
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, dark, sleep });
}
async function opened(page: Page) {
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible()
    || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const home = await openCompanionHome(page);
  await home.locator("img").evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  return home;
}
async function save(home: Locator, name: string, data?: unknown) {
  mkdirSync(output, { recursive: true });
  await home.screenshot({ path: `${output}/${name}.png` });
  if (data !== undefined) writeFileSync(`${output}/${name}.json`, JSON.stringify(data, null, 2));
}

for (const dark of [false, true]) test(`136 first ${dark ? "dark" : "bright"} default and native lamp decisions survive route, remount and reload`, async ({ page }) => {
  await seed(page, dark); await page.goto("/visual-fixture/poster?avatar=1");
  let home = await opened(page); const lamp = home.locator(".vc-home-lamp");
  await expect(lamp).toHaveAttribute("aria-pressed", String(!dark));
  const chosen = dark; await lamp.click(); await expect(lamp).toHaveAttribute("aria-pressed", String(chosen));
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_HOME_LIGHT_KEY)).toEqual({ version: 1, lit: chosen });
  await home.getByRole("button", { name: "빅타민 집 닫기", exact: true }).click();
  await expect(home).toBeHidden(); home = await opened(page); await expect(home.locator(".vc-home-lamp")).toHaveAttribute("aria-pressed", String(chosen));
  await page.goto("/visual-fixture/studio?role=owner&y=2025&m=10&hour=23&weather=clear");
  home = await opened(page); await expect(home.locator(".vc-home-lamp")).toHaveAttribute("aria-pressed", String(chosen));
  await page.reload(); home = await opened(page); await expect(home.locator(".vc-home-lamp")).toHaveAttribute("aria-pressed", String(chosen));
  await save(home, `remember-${dark ? "dark-on" : "bright-off"}`, { chosen, raw: await page.evaluate(key => localStorage.getItem(key), COMPANION_HOME_LIGHT_KEY), actualNativeClicks: true });
});

for (const [surface, width] of [["viewer", 1440], ["studio", 1100], ["studio", 1920]] as const)
  test(`136 ${surface} ${width} keeps a wide launcher room, lamp above feeder and an intact deep cabinet`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 }); await seed(page, false);
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2025&m=10&hour=12&weather=clear");
    const home = await opened(page);
    const data = await home.evaluate(node => {
      const room = node.querySelector(".vc-home-room")!, lamp = room.querySelector(".vc-home-lamp")!, feeder = room.querySelector(".vc-dispenser")!;
      const box = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const tv = room.querySelector(".vc-home-tv-paint")!, transform = new DOMMatrix(getComputedStyle(tv).transform);
      return { presentation: node.getAttribute("data-home-presentation"), home: box(node), room: box(room), lamp: box(lamp), feeder: box(feeder), body: room.querySelector(".vc-home-tv-body")!.getAttribute("src"), planarXScale: transform.m11, planarYRotation: transform.m31, curtainGrade: getComputedStyle(room.querySelector(".vc-window-curtain-overlay")!).filter };
    });
    expect(Math.abs((data.lamp.x + data.lamp.width / 2) - (data.feeder.x + data.feeder.width / 2))).toBeLessThan(1);
    expect(data.body).toBe("/companion/home/136/tv-body.webp"); expect(data.planarXScale).toBe(1); expect(data.planarYRotation).toBe(0);
    if (data.presentation === "compact") { expect(data.home.width / data.home.height).toBeGreaterThan(1.18); expect(data.room.width).toBeGreaterThan(390); }
    for (const target of [data.lamp, data.feeder]) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44); }
    await home.locator(".vc-home-tv").click(); await home.locator(".vc-home-tv-screen > img").evaluate(image => (image as HTMLImageElement).decode());
    await page.mouse.move(2, 2); await save(home, `${surface}-${width}-composition`, data);
  });

test("136 seated sofa front/back and curtains share both light states and the same hover response", async ({ page }) => {
  await seed(page, true); await page.goto("/visual-fixture/studio?role=owner&y=2025&m=10&hour=23&weather=clear");
  const home = await opened(page), room = home.locator(".vc-home-room"), lamp = home.locator(".vc-home-lamp"), foreground = page.locator(".vc-bed-foreground");
  await placeCompanionOnHomeFloor(page); await home.locator('[data-home-action="home"]').click(); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home", { timeout: 20000 });
  await expect(foreground).toBeVisible();
  const materials = () => page.evaluate(() => {
    const room = document.querySelector(".vc-home-room")!, front = document.querySelector(".vc-bed-foreground")!;
    const keys = ["--vc-bed-light", "--vc-bed-cloth", "--vc-bed-shade", "--vc-soft-shadow"];
    const get = (node: Element) => keys.map(key => getComputedStyle(node).getPropertyValue(key).trim());
    return { back: get(room), front: get(front), curtain: getComputedStyle(room.querySelector(".vc-window-curtain-overlay")!).filter, grade: Number(getComputedStyle(room).getPropertyValue("--vc-room-art-grade")), backTransform: getComputedStyle(room.querySelector(".vc-sofa-feedback")!).transform, frontTransform: getComputedStyle(front.querySelector(".vc-sofa-feedback")!).transform };
  });
  const samples = [];
  for (const lit of [false, true, false]) {
    if ((await lamp.getAttribute("aria-pressed")) !== String(lit)) await lamp.click();
    await expect.poll(async () => { const m = await materials(); return m.front.join("|") === m.back.join("|"); }).toBe(true);
    const bounds = (await home.locator(".vc-cushion-button").boundingBox())!;
    await page.mouse.move(bounds.x + 5, bounds.y + bounds.height / 2);
    await expect.poll(async () => { const m = await materials(); return m.frontTransform === m.backTransform; }).toBe(true);
    const m = await materials(); expect(m.curtain).toBe(`brightness(${m.grade})`); expect(m.grade).toBe(lit ? 1 : .6);
    samples.push({ lit, ...m }); await save(home, `seated-hover-${lit ? "on" : "off"}`, samples);
  }
  await expect(room).not.toHaveAttribute("data-lamp-lit");
});
