import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1800 }, isMobile: false, hasTouch: false, serviceWorkers: "block", trace: "off" });
test.setTimeout(60_000);
test("actual calendar instrument onsets drive the shared creature reaction and cross-page zero volume clears it", async ({ page, context }) => {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method())) { writes.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live reads" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, life, key, epoch }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.sound", "on"); localStorage.setItem("vic.soundVol", "60"); localStorage.setItem("vic.soundCats", JSON.stringify({ tap: true, ui: true, celebrate: true, edit: true, alert: true }));
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, animalMode: "dog", personality: "affectionate", roam: true, jump: false, sleep: false, feeding: false, petting: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .05, energy: .98, life }));
    localStorage.setItem("vic.companionRadio.v1", JSON.stringify({ enabled: true, volume: 35, react: true, excludedIds: [] }));
    const windowWithEvents = window as Window & { __instrumentOnsets?: Record<string, unknown>[] };
    windowWithEvents.__instrumentOnsets = [];
    window.addEventListener("vic:companion-instrument", event => windowWithEvents.__instrumentOnsets!.push({ ...(event as CustomEvent<Record<string, unknown>>).detail }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life: createCompanionLife(() => 0), key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH });
  await page.goto("/visual-fixture/poster"); await page.bringToFront(); await settlePanelLayout(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  await expect(actor).toBeVisible();
  const body = (await actor.boundingBox())!;
  await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2); await page.mouse.down(); await page.mouse.move(1000, 1650, { steps: 8 }); await page.mouse.up(); await page.mouse.move(3, 3);
  await page.evaluate(() => {
    const target = window as Window & { __instrumentReactions?: string[] };
    target.__instrumentReactions = [];
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const value = (record.target as HTMLElement).dataset.instrumentReaction;
        if (value) target.__instrumentReactions!.push(value);
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-instrument-reaction"] });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  });
  const mark = page.locator("button.day-mark.celebratable").filter({ hasText: "현충일" }).first();
  await expect(mark).toBeVisible();
  for (let tap = 0; tap < 6; tap++) { await mark.click(); await page.waitForTimeout(540); }
  const read = () => page.evaluate(() => (window as Window & { __instrumentOnsets?: Record<string, unknown>[] }).__instrumentOnsets ?? []);
  await expect.poll(async () => (await read()).length).toBeGreaterThanOrEqual(6);
  const onsets = await read();
  for (const onset of onsets) expect(Object.keys(onset).sort()).toEqual(["at", "bpm", "durationMs", "expectedGapMs", "mood"]);
  const reactions = await page.evaluate(() => (window as Window & { __instrumentReactions?: string[] }).__instrumentReactions ?? []);
  await test.info().attach("actual-instrument-before-volume", { body: JSON.stringify({ onsets, reactions, pet: await pet.evaluate(node => ({ attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]), rect: node.getBoundingClientRect().toJSON() })) }, null, 2), contentType: "application/json" });
  await expect(pet).toHaveAttribute("data-instrument-reaction", /bounce|sway|calm|encourage|tease|bored/, { timeout: 10_000 });
  const reaction = await pet.getAttribute("data-instrument-reaction");
  mkdirSync(".scratch-pw/companion-111/instrument-native", { recursive: true });
  await page.screenshot({ path: ".scratch-pw/companion-111/instrument-native/playing.png" });
  const other = await context.newPage();
  await other.goto("/visual-fixture/poster"); await other.bringToFront(); await settlePanelLayout(other);
  await other.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = other.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "소리", exact: true }).click();
  const volume = dialog.getByRole("slider", { name: "효과음 음량", exact: true });
  await volume.focus(); await volume.press("Home");
  await expect(volume).toHaveValue("0");
  await other.close(); await page.bringToFront();
  expect(await page.evaluate(() => localStorage.getItem("vic.soundVol"))).toBe("0");
  await expect(pet).not.toHaveAttribute("data-instrument-reaction", /.+/);
  const beforeMutedTap = (await read()).length;
  await mark.click(); await page.waitForTimeout(700);
  expect((await read()).length).toBe(beforeMutedTap);
  writeFileSync(".scratch-pw/companion-111/instrument-native/actual-onsets.json", JSON.stringify({ onsets, reaction, afterMute: await read(), writes, errors }, null, 2));
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
