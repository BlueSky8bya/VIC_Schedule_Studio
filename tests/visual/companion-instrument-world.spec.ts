import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { createCompanionInstrumentInbox } from "@/lib/ui/viewer-companion/instrument-reaction";
import type { CompanionInstrumentPulse } from "@/lib/ui/viewer-companion/instrument-music";
import { settlePanelLayout } from "./helpers/panel-layout";
import { placeCompanionAt } from "./helpers/companion-home";

test.use({ viewport: { width: 1440, height: 1800 }, isMobile: false, hasTouch: false, serviceWorkers: "block", trace: "off" });
test.setTimeout(180_000);
const output = process.env.VIC_INSTRUMENT_OUTPUT ?? ".scratch-pw/companion-112/rhythm/native";
test("actual calendar instrument onsets drive the shared creature reaction and cross-page zero volume clears it", async ({ page, context }) => {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method())) { writes.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live reads" });
    return route.continue();
  });
  // The seeded character is marked hand-picked: a document otherwise draws its own, and the reaction under test
  // (calm, then encourage) belongs to the affectionate dog.
  await page.addInitScript(({ prefs, care, life, key, epoch }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.sound", "on"); localStorage.setItem("vic.soundVol", "60"); localStorage.setItem("vic.soundCats", JSON.stringify({ tap: true, ui: true, celebrate: true, edit: true, alert: true }));
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, animalMode: "dog", personality: "affectionate", personalitySource: "manual", roam: true, jump: false, sleep: false, feeding: false, petting: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .05, energy: .98, life }));
    localStorage.setItem("vic.companionRadio.v1", JSON.stringify({ enabled: true, volume: 35, react: true, excludedIds: [] }));
    const windowWithEvents = window as Window & { __instrumentOnsets?: Record<string, unknown>[] };
    windowWithEvents.__instrumentOnsets = [];
    window.addEventListener("vic:companion-instrument", event => windowWithEvents.__instrumentOnsets!.push({ ...(event as CustomEvent<Record<string, unknown>>).detail }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life: createCompanionLife(() => 0), key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH });
  await page.goto("/visual-fixture/poster"); await page.bringToFront(); await settlePanelLayout(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  await expect(actor).toBeVisible();
  // Set it on the world floor with the keyboard placement. The old quick drag-and-release from the house is a
  // throw now (rough play: the companion sulks and ignores the music).
  await placeCompanionAt(page, { x: 1000, y: 1650 }, /^viewport-floor(?:-\d+)?$/);
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
    // Owner witness: one sample per painted frame of who owns the companion. A phrase that goes unanswered may be
    // retried only when an authored scene really held the companion while that phrase was due.
    const owners: { at: number; owned: boolean }[] = [];
    (window as Window & { __instrumentOwners?: typeof owners }).__instrumentOwners = owners;
    const sample = () => {
      const node = document.querySelector<HTMLElement>(".vc-companion");
      if (node) owners.push({ at: performance.now(), owned: node.dataset.lifePurpose === "authored" || node.hasAttribute("data-scene") });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const ownedBetween = (from: number, to: number) => page.evaluate(({ from, to }) => ((window as Window & { __instrumentOwners?: { at: number; owned: boolean }[] }).__instrumentOwners ?? [])
    .some(frame => frame.owned && frame.at >= from && frame.at <= to), { from, to });
  const mark = page.locator("button.day-mark.celebratable").filter({ hasText: "현충일" }).first();
  await expect(mark).toBeVisible();
  const markBox = (await mark.boundingBox())!;
  const tap = () => page.mouse.click(markBox.x + markBox.width / 2, markBox.y + markBox.height / 2);
  const pulseAt = async () => page.evaluate(() => {
    const all = (window as Window & { __instrumentOnsets?: { rhythm?: { tapAt: number } }[] }).__instrumentOnsets ?? [];
    return all.at(-1)?.rhythm?.tapAt;
  });
  const read = () => page.evaluate(() => (window as Window & { __instrumentOnsets?: Record<string, unknown>[] }).__instrumentOnsets ?? []);
  const grade = (values: Record<string, unknown>[]) => {
    const inbox = createCompanionInstrumentInbox();
    values.forEach(value => inbox.offer(value as unknown as CompanionInstrumentPulse, Number(value.at), true));
    return inbox.take(Number(values.at(-1)?.at))?.quality;
  };
  // Source score: Amazing Grace100BPM; quarter gaps1,2,.5,.5,2.
  // Real elapsed waits/native mouse events only; no clock/RNG/pose patches.
  const playScore = async () => {
    const start = (await read()).length;
    await tap();
    await expect.poll(async () => (await read()).length).toBeGreaterThan(start);
    const anchor = (await pulseAt())!; expect(anchor).toBeGreaterThan(0);
    for (const offset of [600, 1800, 2100, 2400, 3600]) {
      const remaining = anchor + offset - await page.evaluate(() => performance.now());
      if (remaining > 0) await page.waitForTimeout(remaining);
      await tap();
    }
    await expect.poll(async () => (await read()).length).toBeGreaterThanOrEqual(start + 6);
    return (await read()).slice(start);
  };
  const playRapid = async () => {
    const start = (await read()).length;
    for (let index = 0; index < 6; index++) { await tap(); await page.waitForTimeout(150); }
    return (await read()).slice(start);
  };
  // A roaming character also plays authored scenes of its own (1f2cb9eb and later). They outrank a music
  // reaction, and a phrase played into one is simply not answered. So each phrase is really played again, after
  // the 2.7s pause that ends a tap streak, until the companion is free to answer it; every phrase must grade the same.
  // A retry is allowed only when the owner witness shows an authored scene in that phrase's window; an unanswered
  // phrase while nothing else owned the companion fails at once.
  const answered = async (play: () => Promise<Record<string, unknown>[]>, quality: "steady" | "uneven", reaction: string, label: string) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt) await page.waitForTimeout(2700);
      const began = await page.evaluate(() => performance.now());
      const played = await play();
      // Since 1f2cb9eb an onset of a verified score also names its place in that score (an anonymous score key, never
      // the song title). The event still carries nothing but these fields, and no calendar text.
      const required = ["at", "bpm", "durationMs", "expectedGapMs", "mood", "rhythm"], scorePlace = ["phraseEnd", "scoreEnd", "scoreIndex", "scoreKey", "scoreSegment"];
      for (const onset of played) {
        const keys = Object.keys(onset);
        expect(required.filter(key => !keys.includes(key))).toEqual([]); expect(keys.filter(key => !required.includes(key) && !scorePlace.includes(key))).toEqual([]);
        expect(JSON.stringify(onset)).not.toMatch(/[가-힣]/);
      }
      mkdirSync(output, { recursive: true });
      writeFileSync(`${output}/${label}-onsets-before-assert.json`, JSON.stringify({ attempt, played, grade: grade(played) }, null, 2));
      expect(played).toHaveLength(6); expect(grade(played)).toBe(quality);
      if (await expect(pet).toHaveAttribute("data-instrument-reaction", reaction, { timeout: 7000 }).then(() => true, () => false)) return { played, attempt };
      const ended = await page.evaluate(() => performance.now());
      expect(await ownedBetween(began, ended), `${label} phrase ${attempt + 1} was not answered with "${reaction}" while no authored scene owned the companion`).toBe(true);
    }
    throw new Error(`six ${quality} phrases were played and none was answered with "${reaction}"`);
  };
  const score = await answered(playScore, "steady", "calm", "score"), onsets = score.played;
  const reactions = await page.evaluate(() => (window as Window & { __instrumentReactions?: string[] }).__instrumentReactions ?? []);
  await test.info().attach("actual-instrument-before-volume", { body: JSON.stringify({ onsets, reactions, attempts: score.attempt + 1, pet: await pet.evaluate(node => ({ attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value]), rect: node.getBoundingClientRect().toJSON() })) }, null, 2), contentType: "application/json" });
  const reaction = await pet.getAttribute("data-instrument-reaction");
  await page.screenshot({ path: `${output}/score-steady.png` });
  await page.waitForTimeout(2700);
  const rapid = await answered(playRapid, "uneven", "encourage", "rapid"), fast = rapid.played;
  await page.screenshot({ path: `${output}/rapid-uneven.png` });
  const other = await context.newPage();
  await other.goto("/visual-fixture/poster"); await other.bringToFront(); await settlePanelLayout(other);
  await other.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = other.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "소리", exact: true }).click();
  const volume = dialog.getByRole("slider", { name: "전체 음량", exact: true });
  await volume.focus(); await volume.press("Home");
  await expect(volume).toHaveValue("0");
  await other.close(); await page.bringToFront();
  expect(await page.evaluate(() => localStorage.getItem("vic.soundVol"))).toBe("0");
  await expect(pet).not.toHaveAttribute("data-instrument-reaction", /.+/);
  const beforeMutedTap = (await read()).length;
  await mark.click(); await page.waitForTimeout(700);
  expect((await read()).length).toBe(beforeMutedTap);
  writeFileSync(`${output}/actual-onsets.json`, JSON.stringify({ onsets, reaction, fast, reactions: await page.evaluate(() => (window as Window & { __instrumentReactions?: string[] }).__instrumentReactions ?? []), afterMute: await read(), writes, errors }, null, 2));
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
