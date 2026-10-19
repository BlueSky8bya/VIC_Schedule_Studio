import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, COMPANION_PERSONALITY_NAMES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

const out = process.env.COMPANION139_OUTPUT ?? ".scratch-pw/companion-139/native";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
const checks = new WeakMap<Page, { errors: string[]; unexpected: string[] }>();
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
test.setTimeout(75000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof = { errors: [] as string[], unexpected: [] as string[] }; checks.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(".next/server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const preview = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && preview.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.unexpected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
  await page.addInitScript(({ defaults, epoch, epochKey }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }), "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    // Seed ordinary fixture switches only once. Native personality choices and
    // their provenance must survive real reloads without an init overwrite.
    if (!localStorage.getItem("vic.viewerCompanion")) localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, sound: false }));
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY });
});
test.afterEach(async ({ page }, info) => {
  mkdirSync(out, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  await page.screenshot({ path: `${out}/${name}.png` });
  writeFileSync(`${out}/${name}-requests.json`, JSON.stringify(checks.get(page)));
  expect(checks.get(page)!.errors).toEqual([]); expect(checks.get(page)!.unexpected).toEqual([]);
});

async function settings(page: Page) {
  const home = await openCompanionHome(page);
  await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }); await expect(group.getByRole("radio")).toHaveCount(9);
  await expect(dialog.getByText("직접 고른 성격은 새로고침 후에도 유지돼요.", { exact: false })).toBeVisible();
  return { dialog, group };
}

for (const [surface, width, input] of [["viewer", 1440, "pointer"], ["studio", 1100, "Enter"], ["studio", 1920, "Home"], ["preview", 1920, "Space"]] as const) test(`139 ${surface} ${width} enlarged book and explicit ${input} personality survive reload`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const show = async () => {
    await page.bringToFront(); await settlePanelLayout(page);
    if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
    return openCompanionHome(page);
  };
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=6&hour=23&weather=clear");
  const home = await show(); await page.mouse.move(2, 2);
  const geometry = await home.locator(".vc-home-room").evaluate(room => {
    const box = (selector: string) => { const r = room.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const paint = room.querySelector(".vc-book-paint")!, style = getComputedStyle(paint);
    return { book: box(".vc-book-button"), paint: box(".vc-book-paint"), radio: box(".vc-radio-button"), shelf: box(".vc-home-shelf"), room: room.getBoundingClientRect().toJSON(), css: { width: parseFloat(style.width), height: parseFloat(style.height) }, hit: room.querySelector(".vc-book-button")!.contains(document.elementFromPoint(box(".vc-book-button").x + box(".vc-book-button").width / 2, box(".vc-book-button").y + box(".vc-book-button").height / 2)) };
  });
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${surface}-${width}-book.json`, JSON.stringify(geometry));
  // Native CSS zoom rounds48px to47.9861px at the studio's .9 scale.
  expect(geometry.css.width).toBeCloseTo(48, 1); expect(geometry.css.height).toBeCloseTo(48, 1);
  expect(geometry.book.width).toBeGreaterThanOrEqual(44); expect(geometry.book.height).toBeGreaterThanOrEqual(44); expect(geometry.hit).toBe(true);
  expect(geometry.paint.x).toBeGreaterThanOrEqual(geometry.book.x - .5); expect(geometry.paint.right).toBeLessThanOrEqual(geometry.book.right + .5);
  expect(geometry.paint.bottom).toBeLessThanOrEqual(geometry.book.bottom + .5); expect(geometry.paint.y).toBeGreaterThanOrEqual(geometry.book.y - .5);
  expect(geometry.book.x - geometry.radio.right).toBeGreaterThanOrEqual(3);
  await home.locator(".vc-book-button").hover();
  await expect.poll(() => home.locator(".vc-book-paint").evaluate(node => getComputedStyle(node).getPropertyValue("--vc-object-feedback-angle").trim())).toBe("2deg");
  await page.mouse.move(2, 2);
  const random: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (i) { await page.reload(); await show(); }
    const { dialog, group } = await settings(page); random.push((await group.locator('[aria-checked="true"]').innerText()).trim());
    if (i === 0) { await dialog.getByRole("tab", { name: "움직임", exact: true }).click(); await dialog.locator('[data-act="companion-jump"]').setChecked(false); }
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  }
  expect(new Set(random).size).toBeGreaterThan(1);
  const { dialog, group } = await settings(page), selected = group.locator('[aria-checked="true"]');
  const manual = input === "Home" ? "재롱둥이" : input === "Enter" ? (random.at(-1) === "깔끔이" ? "애교쟁이" : "깔끔이") : random.at(-1)!;
  if (input === "pointer") await selected.click();
  else if (input === "Home") { await selected.focus(); await selected.press("Home"); await group.getByRole("radio", { name: manual, exact: true }).press("Home"); }
  else { const target = input === "Enter" ? group.getByRole("radio", { name: manual, exact: true }) : selected; await target.focus(); await target.press(input); }
  await expect(group.getByRole("radio", { name: manual, exact: true })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).personalitySource)).toBe("manual");
  const pinned: string[] = [];
  for (let i = 0; i < 3; i++) { await page.reload(); await show(); const current = await settings(page); pinned.push((await current.group.locator('[aria-checked="true"]').innerText()).trim()); await current.dialog.getByRole("button", { name: "닫기", exact: true }).click(); }
  expect(pinned).toEqual([manual, manual, manual]); expect(Object.values(COMPANION_PERSONALITY_NAMES)).toContain(manual);
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${surface}-${width}.json`, JSON.stringify({ geometry, random, manual, pinned, nativeOnly: true }));
});
