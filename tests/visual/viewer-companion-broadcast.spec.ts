import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES, COMPANION_PREFERENCES_KEY } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type PreferenceWitness = { reads: number; mounts: { afterPreferenceRead: boolean }[] };
type WitnessWindow = Window & { companionBroadcastWitness?: PreferenceWitness };
type Evidence = { assets: string[]; mutations: string[]; errors: string[]; checkpoints: { label: string; assets: string[]; witness: PreferenceWitness }[] };
type FoodProbe = { reads: string[]; fallingSeen: boolean; positions: number[]; original: typeof Storage.prototype.getItem; observer: MutationObserver; raf: number };
type FoodProbeWindow = Window & { companionBroadcastFood?: FoodProbe };
type FoodProof = Pick<FoodProbe, "reads" | "fallingSeen" | "positions">;
const proof = new WeakMap<Page, Evidence>();
const pet = (page: Page) => page.locator(".vc-companion");
const url = (surface: Surface) => surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner";
const other = (surface: Surface): Surface => surface === "viewer" ? "studio" : "viewer";
const legacyOff = { version: 1, enabled: false, jump: false, feeding: false, learnFromYou: false, speed: "relaxed", animalMode: "dog", personality: "sleepy", size: "small" };

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const evidence: Evidence = { assets: [], mutations: [], errors: [], checkpoints: [] }; proof.set(page, evidence);
  page.on("pageerror", error => evidence.errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/companion/")) evidence.assets.push(new URL(request.url()).pathname); });
  // Routing disables the HTTP cache, so a zero-request OFF assertion is not
  // satisfied by an image fetched during the earlier ON part of this test.
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { evidence.mutations.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "fixture mutation blocked" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  await writeFile(`.scratch-pw/companion-broadcast-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify(proof.get(page), null, 2));
  expect(proof.get(page)?.mutations).toEqual([]); expect(proof.get(page)?.errors).toEqual([]);
});

async function prepare(page: Page, saved: Record<string, unknown> | null) {
  await page.addInitScript(({ epochKey, epoch, preferencesKey, saved }) => {
    if (!sessionStorage.getItem("companion-broadcast-prepared")) {
      localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.premiereStage", "off");
      localStorage.setItem("vic_avatar_side", "left");
      if (saved) localStorage.setItem(preferencesKey, JSON.stringify(saved)); else localStorage.removeItem(preferencesKey);
      sessionStorage.setItem("companion-broadcast-prepared", "1");
    }
    const witness: PreferenceWitness = { reads: 0, mounts: [] };
    (window as WitnessWindow).companionBroadcastWitness = witness;
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (this === window.localStorage && key === preferencesKey) witness.reads++;
      return read.call(this, key);
    };
    new MutationObserver(records => {
      for (const record of records) for (const added of record.addedNodes) {
        if (!(added instanceof Element)) continue;
        if (added.matches(".vc-companion") || added.querySelector(".vc-companion")) witness.mounts.push({ afterPreferenceRead: witness.reads > 0 });
      }
    }).observe(document, { childList: true, subtree: true });
  }, { epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferencesKey: COMPANION_PREFERENCES_KEY, saved });
}

async function checkpoint(page: Page, label: string) {
  const evidence = proof.get(page)!;
  const witness = await page.evaluate(() => (window as WitnessWindow).companionBroadcastWitness!);
  evidence.checkpoints.push({ label, assets: [...evidence.assets], witness });
  return witness;
}
async function expectColdOff(page: Page, label: string) {
  await expect(page.locator(".poster-page,.studio-shell")).toBeVisible();
  // Catch a lazy mount/request after hydration as well as its initial frame.
  await page.waitForTimeout(900);
  await expect(pet(page)).toHaveCount(0);
  expect(proof.get(page)!.assets).toEqual([]);
  const witness = await checkpoint(page, label);
  expect(witness.reads).toBeGreaterThan(0); expect(witness.mounts).toEqual([]);
}

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} fresh default ON respects native OFF through cold reload and surface navigation`, async ({ page }) => {
    await prepare(page, null); await page.goto(url(surface)); await page.bringToFront();
    await expect(pet(page)).toBeVisible({ timeout: 10000 });
    await expect(pet(page).locator(".vc-texture")).toHaveCount(1);
    expect(await page.evaluate(key => localStorage.getItem(key), COMPANION_PREFERENCES_KEY)).toBeNull();
    const witness = await checkpoint(page, "fresh-on");
    expect(witness.reads).toBeGreaterThan(0); expect(witness.mounts.length).toBeGreaterThan(0);
    expect(witness.mounts.every(mount => mount.afterPreferenceRead)).toBe(true);
    await expect.poll(() => proof.get(page)!.assets.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
    const master = dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true });
    await expect(master).toBeChecked(); await master.click(); await expect(master).not.toBeChecked();
    await expect(pet(page)).toHaveCount(0);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_PREFERENCES_KEY);
    expect(saved).toEqual({ version: 1, ...DEFAULT_COMPANION_PREFERENCES, enabled: false });
    proof.get(page)!.assets.length = 0;
    await page.reload(); await expectColdOff(page, "native-off-reload");
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_PREFERENCES_KEY)).toEqual(saved);
    proof.get(page)!.assets.length = 0;
    await page.goto(url(other(surface))); await expectColdOff(page, "native-off-other-surface");
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_PREFERENCES_KEY)).toEqual(saved);
  });

  test(`${surface} legacy explicit OFF never mounts or requests a companion asset on a cold entry`, async ({ page }) => {
    await prepare(page, legacyOff); await page.goto(url(surface));
    await expectColdOff(page, "legacy-off-cold");
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_PREFERENCES_KEY)).toEqual(legacyOff);
  });

  test(`${surface} real snack gravity and house following read no graphics preference during steady frames`, async ({ page }) => {
    await prepare(page, { version: 1, ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false });
    await page.goto(url(surface)); await page.bringToFront();
    await expect(pet(page)).toBeVisible();
    const home = await openCompanionHome(page, "keyboard");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    const snack = page.locator(".vc-food"); await expect(snack).toHaveCount(1);
    const room = (await home.locator(".vc-home-room").boundingBox())!, food = (await snack.boundingBox())!;
    const origin = await snack.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 }; });
    const start = { x: food.x + food.width / 2, y: food.y + food.height / 2 }, target = { x: room.x + room.width * .35, y: room.y + 20 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(target.x + start.x - origin.x, target.y + start.y - origin.y, { steps: 14 });
    await snack.evaluate(node => {
      const probe: FoodProbe = { reads: [], fallingSeen: false, positions: [], original: Storage.prototype.getItem, observer: new MutationObserver(() => { probe.fallingSeen ||= node.hasAttribute("data-falling"); }), raf: 0 };
      probe.observer.observe(node, { attributes: true, attributeFilter: ["data-falling"] });
      Storage.prototype.getItem = function (key: string) { if (this === window.localStorage && (key === "vic.gfx" || key === "vic.gfxPref")) probe.reads.push(key); return probe.original.call(this, key); };
      const sample = () => { if (node.hasAttribute("data-falling")) { probe.fallingSeen = true; const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); probe.positions.push(matrix.m42); } probe.raf = requestAnimationFrame(sample); };
      (window as FoodProbeWindow).companionBroadcastFood = probe; probe.raf = requestAnimationFrame(sample);
    });
    let result: FoodProof | undefined;
    try {
      await page.mouse.up(); await page.mouse.move(4, 4);
      await expect.poll(() => page.evaluate(() => (window as FoodProbeWindow).companionBroadcastFood!.fallingSeen)).toBe(true);
      await expect(snack).not.toHaveAttribute("data-falling", { timeout: 5000 });
      const before = { room: (await home.locator(".vc-home-room").boundingBox())!, food: await snack.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42) };
      await page.locator('[data-panel-section-toggle="tag-filter"]:visible').first().click();
      await expect.poll(async () => Math.abs((await home.locator(".vc-home-room").boundingBox())!.y - before.room.y)).toBeGreaterThan(10);
      await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
      await expect.poll(async () => {
        const roomNow = (await home.locator(".vc-home-room").boundingBox())!, foodNow = await snack.evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42);
        return Math.abs((foodNow - before.food) - (roomNow.y - before.room.y));
      }).toBeLessThan(2);
    } finally {
      result = await page.evaluate(() => { const probe = (window as FoodProbeWindow).companionBroadcastFood!; probe.observer.disconnect(); cancelAnimationFrame(probe.raf); Storage.prototype.getItem = probe.original; return { reads: probe.reads, fallingSeen: probe.fallingSeen, positions: probe.positions }; });
      await writeFile(`.scratch-pw/companion-broadcast-${surface}-food-graphics.json`, JSON.stringify(result, null, 2));
    }
    expect(result.fallingSeen).toBe(true); expect(result.positions.length).toBeGreaterThan(2);
    expect(Math.max(...result.positions) - Math.min(...result.positions)).toBeGreaterThan(20);
    expect(result.reads).toEqual([]);
  });
}
