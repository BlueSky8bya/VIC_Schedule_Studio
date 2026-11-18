import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { enterCompanionMeadow, placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = ".scratch-pw/companion-consistency/live/meadow";
const fonts = new Set([...readFileSync("app/fonts.css", "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
test.setTimeout(90000);
test.use({ viewport: { width: 1920, height: 1080 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });

test("appearance: real meadow entry and pet strokes retain the four-ear crown composite", async ({ page, context, baseURL }) => {
  const errors: string[] = [], rejected: string[] = [], origin = new URL(baseURL!).origin;
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.resourceType() === "font") return fulfillReadOnlyFont(route, fonts, rejected);
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { rejected.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live service" });
    return route.continue();
  });
  await page.addInitScript(({ defaults, epoch, key }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }), "vic.ambient": "on", "vic.sound": "off", "vic.reduceMotion": "off", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, petting: true, feeding: false, personality: "affectionate", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { unlocked: ["tiny-crown"], equipped: "tiny-crown", pending: null } }));
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
  await page.goto("/visual-fixture/poster?ambient=spring&avatar=1"); await page.bringToFront();
  await placeCompanionOnExposedBackground(page, 180); await enterCompanionMeadow(page);
  const meadow = page.locator(".vc-meadow-walk"), body = meadow.locator(".vc-meadow-walk-body"), composite = meadow.locator(".vc-character-composite");
  await expect(meadow).toBeVisible(); await expect(composite).toBeVisible();
  await expect(composite).toHaveAttribute("data-ear-slots", "orange-root orange-tip yellow-root yellow-tip");
  const samples: { pose: string | null; compositePose: string | null; layered: string | null; ink: number }[] = [];
  for (let index = 0; index < 36; index++) {
    const rect = (await body.boundingBox())!;
    await page.mouse.move(rect.x + rect.width * (index % 2 ? .35 : .65), rect.y + rect.height * .52, { steps: 3 }); await page.waitForTimeout(55);
    samples.push(await meadow.evaluate(node => { const canvas = node.querySelector<HTMLCanvasElement>(".vc-character-composite")!; return { pose: node.getAttribute("data-pose"), compositePose: canvas.dataset.pose ?? null, layered: canvas.closest(".vc-pose")?.getAttribute("data-layered") ?? null, ink: canvas.getContext("2d")!.getImageData(0, 0, 384, 384).data.filter((value, index) => index % 4 === 3 && value > 0).length }; }));
  }
  expect(samples.every(sample => sample.layered === "true" && sample.ink > 1000 && sample.pose === sample.compositePose)).toBe(true);
  await expect(meadow).toHaveAttribute("data-petting", /hover|touch/);
  mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/crown-petting.png` });
  writeFileSync(`${output}/proof.json`, JSON.stringify({ samples, errors, rejected, scope: "Production React meadow; native entry and pointer strokes. No actor/clock/RNG/renderer mutation. Fixture does not establish broadcaster hardware performance." }, null, 2));
  expect(errors).toEqual([]); expect(rejected).toEqual([]);
});
