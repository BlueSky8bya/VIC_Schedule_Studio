import { COMPANION_MEMORY_BOOK } from "@/lib/ui/viewer-companion/memory-book-order";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS, COMPANION_TOY_BOOK_ORDER as COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_BEHAVIOR_IDS, COMPANION_LEGACY_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = process.env.COMPANION_MEMORY_OUTPUT ?? ".scratch-pw/memory-expansion-observations";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
type Surface = "viewer" | "studio" | "preview";
type Proof = { rejected: string[]; errors: string[]; notes: unknown[] };
const proofs = new Map<Page, Proof>();
const save = (name: string, value: unknown) => { mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, name + ".json"), JSON.stringify(value, null, 2)); };
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
test.setTimeout(240000);
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
test.afterEach(async ({ page }) => {
  const proof = proofs.get(page)!; save(test.info().title.replace(/[^a-z0-9]+/gi, "-"), { ...proof, buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), scope: "Real production-build fixtures with synthetic care/collection and intercepted APIs; no DB/login or seeded clock/RNG/geometry." });
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); proofs.delete(page);
});
async function seed(page: Page, dark = false, foods = COMPANION_FOOD_KINDS, toys = COMPANION_TOY_KINDS, unread = false, allMemories = true) {
  await page.addInitScript(({ prefs, memory, epoch, key, dark, foods, behaviors, situations, toys, unread }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, personality: "balanced", personalitySource: "manual", roam: false, feeding: true, sleep: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05, life: { ...memory.life, seedFood: "turnip", favoriteFood: "turnip", tastedFoods: ["turnip"], foodScores: { ...memory.life.foodScores, turnip: .9 } } }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: false }));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys, seen: unread ? [] : toys, toyTastes: {}, foodTastes: {}, reasons: [{ domain: "food", kind: "turnip", reason: "mild-bite", age: 0 }] }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods, behaviors, situations, seen: { foods: unread ? [] : foods, behaviors: unread ? [] : behaviors, situations, accessories: [] }, gifts: { unlocked: [], equipped: null, pending: null } }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, dark, foods, behaviors: allMemories ? COMPANION_BEHAVIOR_IDS : COMPANION_LEGACY_BEHAVIOR_IDS, situations: COMPANION_SITUATION_IDS, toys, unread });
}
async function open(page: Page, surface: Surface, hour = 12) {
  const response = await page.goto(surface === "viewer" ? `/visual-fixture/poster?avatar=1&hour=${hour}` : `/visual-fixture/studio?role=owner&y=2025&m=10&hour=${hour}&weather=clear`);
  proofs.get(page)!.notes.push({ stage: "actual-html", sha256: createHash("sha256").update(await response!.body()).digest("hex"), hour, surface });
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  const house = await openCompanionHome(page), fold = house.locator('[data-home-action="fold"]');
  if (await fold.count() && await fold.getAttribute("aria-expanded") === "false") await fold.click();
  await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2); return house;
}



for (const [surface, dark, width, height] of [["viewer", false, 1440, 1000], ["studio", true, 1440, 900], ["preview", false, 1440, 1000], ["viewer", true, 1050, 760]] as const) test(`memory ${surface} ${dark ? "dark" : "light"} ${width} all106 portraits and real paging`, async ({ page }) => {
  await seed(page, dark); await page.setViewportSize({ width, height });
  const house = await open(page, surface); await house.locator('[data-home-action="book"]').click();
  const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(book).toBeVisible();
  await book.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "도감", exact: true }).click();
  await book.locator('[data-act="companion-collection-category"][data-act-opt="behavior"]').click();
  const list = book.getByRole("list", { name: "추억 도감", exact: true }), visited: number[] = [], expressionPixels: unknown[] = [];
  for (;;) {
    const tiles = list.locator("button[data-collection-index]"), indexes = await tiles.evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-collection-index"))));
    visited.push(...indexes);
    for (const index of indexes) await expect(list.locator(`[data-collection-index="${index}"]`)).toHaveAccessibleName(COMPANION_MEMORY_BOOK[index].name + " · 만났어요");
    for (const canvas of await list.locator("canvas").all()) {
      await expect(canvas).toHaveAttribute("data-portrait-ready", "true");
      const pixels = await canvas.evaluate(node => { const canvas = node as HTMLCanvasElement, rgba = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data; let opaque = 0, transparent = 0; for (let i=3;i<rgba.length;i+=4) { if (rgba[i] > 200) opaque++; if (!rgba[i]) transparent++; } return { id: canvas.dataset.collectionArtId, opaque, transparent }; });
      expect(pixels.opaque).toBeGreaterThan(1000); expect(pixels.transparent).toBeGreaterThan(1000); expressionPixels.push(pixels);
    }
    if (indexes.some(index => index === 25 || index === 61 || index === 82 || index === 100)) await book.screenshot({ path: resolve(output, `${surface}-${width}-page-${indexes[0]}.png`) });
    const next = book.locator('[data-page-direction="next"]'); if (await next.isDisabled()) break; await next.click();
  }
  expect(visited).toEqual(COMPANION_MEMORY_BOOK.map((_, index) => index)); expect(expressionPixels).toHaveLength(36);
  await selectCompanionCollectionIndex(page, list, 25);
  const first = list.locator('[data-collection-index="25"]'), columns = await list.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).length);
  await first.focus(); await first.press("ArrowDown");
  await expect(list.locator(`[data-collection-index="${25 + columns}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(book.locator(".rhh-memory-detail strong")).toHaveText(COMPANION_MEMORY_BOOK[25 + columns].name);
  proofs.get(page)!.notes.push({ visited, expressionPixels });
});

test("memory undiscovered expressions and actions keep names and native portraits hidden", async ({ page }) => {
  await seed(page, false, COMPANION_FOOD_KINDS, COMPANION_TOY_KINDS, false, false);
  const house = await open(page, "viewer");
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!).behaviors as string[]).some(id => id.startsWith("pose:")))).toBe(true);
  await house.locator('[data-home-action="book"]').click();
  const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await book.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "도감", exact: true }).click();
  await book.locator('[data-act="companion-collection-category"][data-act-opt="behavior"]').click();
  const list = book.getByRole("list", { name: "추억 도감", exact: true });
  for (const index of [28, 47, 82, 105]) {
    await selectCompanionCollectionIndex(page, list, index);
    await expect(list.locator(`[data-collection-index="${index}"]`)).toHaveAccessibleName(`??? · ${index + 1}`);
    await expect(book.locator(".rhh-memory-detail strong")).toHaveText("???");
    await expect(book.locator(".rhh-memory-detail [data-collection-art-id]")).toHaveCount(0);
    await expect(list.locator(`[data-collection-index="${index}"] canvas`)).toHaveCount(0);
  }
  await book.screenshot({ path: resolve(output, "unknown-expression-action-silhouettes.png") });
});
