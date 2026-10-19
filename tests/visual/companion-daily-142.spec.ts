import { expect, test } from "@playwright/test";
import { dailyCases } from "../../scripts/companion-qa/catalog.mjs";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FULL_THRESHOLD, DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionPersonality, openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { finishCompanionQa, guardCompanionQa, startCompanionQaProbe, type DailyProof } from "./helpers/companion-qa";

const cases = process.env.COMPANION_QA_CASES ? JSON.parse(process.env.COMPANION_QA_CASES) as ReturnType<typeof dailyCases> : dailyCases(Math.floor((Date.now() + 9 * 3600000) / 86400000));
if (cases.length !== 9 || new Set(cases.map(row => row.personality)).size !== 9 || cases.some(row => row.seconds !== 90 || row.motion !== "full" || !["full", "soft", "off", "reduced"].includes(String(row.plannedMotion)) || !/^[a-z-]+$/.test(row.id))) throw Error("Daily scenario contract changed; review its declared universe");
test.use({ serviceWorkers: "block", storageState: { cookies: [], origins: [] }, isMobile: false, hasTouch: false });
test.setTimeout(125000);
for (const scenario of cases) test(`142 daily ${scenario.personality}: ninety actual full-motion seconds in ${scenario.surface}/${scenario.width} (planned ${scenario.plannedMotion})`, async ({ page, context, baseURL }, info) => {
  let proof: DailyProof | undefined, completed = false, originalError: string | undefined, observed = { ...scenario };
  try {
    proof = await guardCompanionQa(page, context, baseURL!);
    await page.setViewportSize({ width: Number(scenario.width), height: 1100 });
    await page.addInitScript(({ defaults, care, epoch, epochKey, scenario }) => {
      const values = { [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": scenario.theme === "dark" ? "on" : "off", "vic_avatar_side": "left", "vic.premiereStage": "off" };
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, sleep: true, sound: false, roam: true }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: scenario.need === "hungry" ? .8 : .05, energy: scenario.need === "tired" ? .15 : .9 }));
    }, { defaults: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, scenario });
    const month = { spring: 4, summer: 7, autumn: 10, winter: 1 }[scenario.season as "spring" | "summer" | "autumn" | "winter"];
    // The public fixture has no world-time override. Studio and read-only
    // preview inspect the actual shared month/hour rather than a runtime hook.
    await page.goto(scenario.surface === "viewer" ? "/visual-fixture/poster?avatar=1" : `/visual-fixture/studio?role=${scenario.surface === "studio-developer" ? "developer" : "owner"}&y=2025&m=${month}&hour=${scenario.band === "night" ? 21 : 12}&weather=clear`);
    await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
    if (scenario.surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
    await chooseCompanionPersonality(page, scenario.personality as CompanionPersonality); const home = await openCompanionHome(page);
    await expect(page.locator(".vc-companion")).toBeVisible();
    const actual = await home.locator(".vc-home-room").evaluate((node, mealThreshold) => {
      const fullness = node.closest(".vc-home")?.querySelector<HTMLMeterElement>('meter[aria-label="빅타민 포만감"]')?.value;
      const energy = node.closest(".vc-home")?.querySelector<HTMLMeterElement>('meter[aria-label="빅타민 기력"]')?.value;
      return { season: (node as HTMLElement).dataset.season ?? "unverified", band: ["night", "evening"].includes((node as HTMLElement).dataset.band ?? "") ? "night" : "day", theme: document.documentElement.dataset.theme ?? "light", width: innerWidth, motion: document.documentElement.hasAttribute("data-reduce-motion") ? "reduced" : ["off", "soft"].includes(document.documentElement.dataset.gfx ?? "") ? document.documentElement.dataset.gfx! : "full",
        need: typeof fullness === "number" && typeof energy === "number" ? fullness <= 1 - mealThreshold ? "hungry" : energy <= .25 ? "tired" : "content" : "unverified", fullness: fullness ?? -1, energy: energy ?? -1 };
    }, COMPANION_FULL_THRESHOLD);
    expect(actual.motion, "Each daily personality must be observed in full motion; quiet modes have separate native regressions").toBe("full");
    observed = { ...scenario, plannedMotion: String(scenario.plannedMotion), observedMotion: actual.motion, syntheticInitialNeed: String(scenario.need), ...actual }; // Requested fixture values are not observed coverage.
    await startCompanionQaProbe(page);
    // Native controls create actual objects. No world, source, RNG or controller
    // is replaced, and discovery is never seeded or forced for coverage.
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    await page.mouse.move(2, 2);
    const started = await page.evaluate(() => performance.now());
    await expect.poll(() => page.evaluate(() => performance.now()).then(at => at - started), { timeout: 95000, intervals: [1000] }).toBeGreaterThanOrEqual(90000);
    completed = true;
  } catch (error) {
    originalError = String(error); throw error;
  } finally {
    if (proof) await finishCompanionQa(page, info, proof, observed, completed, originalError);
  }
});
