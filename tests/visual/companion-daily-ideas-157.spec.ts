import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { chooseCompanionPersonality, openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { guardCompanionQa, startCompanionQaProbe, type DailyProof, type QaObservation } from "./helpers/companion-qa";
import { completedDailyIdeas157, type Daily157Prelude } from "./helpers/companion-daily-ideas-157";
import { settlePanelLayout } from "./helpers/panel-layout";
import { placeCompanionOnMeasuredFloor157 } from "./helpers/companion-numbered-floor-157";

type ProbeWindow = Window & { companionDaily142?: { frames: QaObservation[]; stop: () => void } };
type Setup = { id: string; personality: CompanionPersonality; surface: "viewer" | "studio" | "preview"; toys: number; food?: boolean; sleep?: boolean; pet?: boolean };
const setups: Setup[] = [
  { id: "D157-P", personality: "performer", surface: "preview", toys: 0 },
  { id: "D157-C", personality: "curious", surface: "viewer", toys: 0 },
  { id: "D157-A", personality: "affectionate", surface: "studio", toys: 0, pet: true },
  { id: "D157-S", personality: "sleepy", surface: "preview", toys: 0 },
  { id: "D157-T", personality: "tidy", surface: "viewer", toys: 4 },
  { id: "D157-M", personality: "mischievous", surface: "studio", toys: 1 },
  { id: "D157-G", personality: "gourmet", surface: "viewer", toys: 0, food: true },
  { id: "D157-H", personality: "homebody", surface: "studio", toys: 0, sleep: true },
  { id: "D157-B", personality: "balanced", surface: "viewer", toys: 1 },
];
const records = new WeakMap<Page, { proof: DailyProof; initial: Daily157Prelude; setup: Setup; binding: unknown }>();
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sampleCache = new WeakMap<Page, QaObservation[]>();
// Transfer only new read-only samples while polling. The unmodified complete
// browser history is still saved below; no failed frames are discarded.
async function samples(page: Page) {
  const received = sampleCache.get(page) ?? [];
  const packet = await page.evaluate(offset => {
    const all = (window as ProbeWindow).companionDaily142?.frames ?? [];
    return { total: all.length, frames: all.slice(offset) };
  }, received.length);
  if (packet.total < received.length || packet.frames.length !== packet.total - received.length)
    throw Error("Read-only daily probe history changed during incremental transfer");
  received.push(...packet.frames); sampleCache.set(page, received); return received;
}

test.use({ viewport: { width: 1920, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: false,
  storageState: { cookies: [], origins: [] }, trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(125_000);

test.afterEach(async ({ page }, info) => {
  const record = records.get(page); if (!record) return;
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).companionDaily142; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  await Promise.allSettled(record.proof.pending);
  const reached = completedDailyIdeas157(frames, record.setup.id, record.initial);
  const actualExpressionFrames=frames.filter(frame=>frame.paintedSource?.passed&&frame.paintedSource.mode==="expression"
    &&frame.paintedSource.pixels?.alphaCompared===36864&&frame.paintedSource.pixels.changedFacePixels>0);
  const directory = info.outputPath("daily-ideas-157"); mkdirSync(directory, { recursive: true });
  const raw = resolve(directory, "raw.json"), png = resolve(directory, "actual-final.png");
  writeFileSync(raw, JSON.stringify({ schemaVersion: 1, kind: "actual-daily-idea157", status: info.status, caseTitle: info.title,
    sourceBinding: record.binding, buildId: record.proof.build, setup: record.setup, initial: record.initial,
    errors: record.proof.errors, rejected: record.proof.rejected, proof: { ...record.proof, pending: undefined },
    notes: [{ reachedFinalBeatAndSubsequentSequence: reached, actualExpressionFrames:actualExpressionFrames.length,sampleIntervalMs: 40,
      pollingTransfer: "append-only delta; complete original browser history retained" }], frames,
    limitation: "One actual situational idea/next-action sample per personality, across three shared surfaces. Real UI creates, transports, consumes and reacts; normal synthetic initial preferences/needs are not operating data. All raw candidate/failed frames remain. Not every world/food/random nap outcome or native Cartesian proof." }, null, 2));
  await page.screenshot({ path: png, animations: "allow" }).catch(() => {});
  await info.attach("daily-idea157-native", { path: raw, contentType: "application/json" });
  await info.attach("daily-idea157-final", { path: png, contentType: "image/png" }).catch(() => {});
  if(record.setup.id==="D157-A")expect(actualExpressionFrames.length,"actual trusted petting must paint at least one fully verified current-cell canvas expression").toBeGreaterThan(0);
  expect(record.proof.errors).toEqual([]); expect(record.proof.rejected).toEqual([]);
  expect(record.proof.mutations).toEqual([]); expect(record.proof.liveReads).toEqual([]);
  expect(record.proof.chunks.length).toBeGreaterThan(0); expect(record.proof.chunks.every(item => item.local === item.served)).toBe(true);
});

async function roam(page: Page) {
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tab", { name: "움직임", exact: true }).click(); await dialog.locator('[data-act="companion-roam"]').setChecked(true);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
}

for (const setup of setups) test(`157 ${setup.id} ${setup.surface} actual situational effect finishes and continues with next activity`, async ({ page, context, baseURL }) => {
  const proof = await guardCompanionQa(page, context, baseURL!);
  const frozenPath = process.env.COMPANION156_SOURCE_FREEZE; if (!frozenPath) throw Error("New frozen source binding is required");
  const bytes = readFileSync(resolve(frozenPath)), freeze = JSON.parse(bytes.toString()) as { contentDigest: string; sourceFiles: { path: string; sha256: string }[] };
  const paths = ["lib/ui/viewer-companion/personality-scene-catalog.ts", "lib/ui/viewer-companion/personality-director.ts", "lib/ui/viewer-companion/personality-activity.ts", "lib/ui/viewer-companion/safe-room-floor.ts", "tests/visual/companion-daily-ideas-157.spec.ts", "tests/visual/helpers/companion-daily-ideas-157.ts",
    "app/visual-fixture/poster/page.tsx", "components/poster/public-poster.tsx", "components/poster/viewer-companion/viewer-companion.tsx",
    "tests/visual/helpers/companion-numbered-floor-157.ts", "lib/ui/viewer-companion/geometry.ts"];
  for (const path of paths) expect(freeze.sourceFiles.find(item => item.path === path)?.sha256).toBe(sha(readFileSync(resolve(path))));
  const record = { proof, initial: { toyIds: [], foodIds: [] } as Daily157Prelude, setup, binding: { path: frozenPath, sha256: sha(bytes), contentDigest: freeze.contentDigest } }; records.set(page, record);
  await page.addInitScript(({ epoch, key, defaults, care, setup }) => {
    for (const [k, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }),
      "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: Boolean(setup.sleep), petting: true,
      sound: false, learnFromYou: false, activeWhileVisible: true, heartPrank: false, cardPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: setup.food ? .6 : .05, energy: setup.sleep ? .27 : .95 }));
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, defaults: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_MEMORY, setup });
  const food = setup.food ? "&companionFood=cricket-pepero" : "";
  await page.goto(setup.surface === "viewer" ? `/visual-fixture/poster?avatar=1${food}` : `/visual-fixture/studio?role=owner&y=2026&m=10&hour=12&weather=clear`);
  await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
  if (setup.surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await chooseCompanionPersonality(page, setup.personality);
  if (["D157-C","D157-S","D157-B"].includes(setup.id)) record.initial.roomFloor=await placeCompanionOnMeasuredFloor157(page);
  else await placeCompanionOnHomeFloor(page);
  const home = await openCompanionHome(page);
  for (let i = 0; i < setup.toys; i++) {
    const button = home.getByRole("button", { name: "장난감 상자 열기", exact: true }); await button.focus(); await button.press("Enter");
    await expect(page.locator(".vc-toy")).toHaveCount(i + 1);
  }
  if (setup.toys) await expect.poll(() => page.locator('.vc-toy[data-falling="false"]').count()).toBe(setup.toys);
  if (setup.food) { await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(page.locator('.vc-food[data-kind="cricket-pepero"]')).toHaveCount(1); await expect(page.locator(".vc-food[data-falling]")).toHaveCount(0); }
  record.initial.toyIds = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.toyId!));
  record.initial.foodIds = await page.locator(".vc-food").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food!));
  record.initial.foodKinds = await page.locator(".vc-food").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.kind!));
  const box = await home.locator(".vc-toy-box-opening").boundingBox(); if (box) record.initial.box = box;
  await startCompanionQaProbe(page, { sampleIntervalMs: 40 });
  await roam(page);
  if (setup.pet) {
    // Changing the roam setting creates the real director. Finish its actual
    // entry before trusted petting, so that settings cannot erase that cue.
    await expect.poll(async () => {
      const observed = await samples(page), last = observed.slice(-3);
      const actual = (frame: QaObservation) => frame.visible && frame.decoded && frame.sourceClipMeasured
        && frame.curiousCompletion.source;
      return observed.some(frame => actual(frame) && frame.scene === "entry-affectionate")
        && last.length === 3 && last.every(frame => actual(frame) && frame.scene !== "entry-affectionate"
          && !["walk", "jump", "held"].includes(frame.state) && frame.platform === last[0].platform
          && Math.hypot(frame.x-last[0].x,frame.y-last[0].y) < 1)
        && last[2].at-last[0].at >= 70;
    }, { timeout: 15_000, intervals: [40] }).toBe(true);
    const actor = page.locator(".vc-companion"), r = (await actor.boundingBox())!;
    const left = r.x + r.width * .28, right = r.x + r.width * .72, y = r.y + r.height * .51;
    for (const x of [left, right, left, right]) await page.mouse.move(x, y, { steps: 4 });
    await expect(actor).toHaveAttribute("data-petting", "hover"); record.initial.petted = true;
    await page.mouse.move(2, 2);
  }
  await expect.poll(async () => completedDailyIdeas157(await samples(page), setup.id, record.initial).length, { timeout: 95_000, intervals: [300] }).toBe(1);
  const witness = completedDailyIdeas157(await samples(page), setup.id, record.initial)[0];
  expect(witness.finalBeat).toBe(COMPANION_PERSONALITY_SCENES.find(value => value.id === setup.id)!.steps.length - 1);
  expect(witness.subsequentAt - witness.completedAt).toBeGreaterThan(0);expect(witness.subsequentAt-witness.completedAt).toBeLessThanOrEqual(10000);expect(["walk", "jump"]).toContain(witness.nextState);
});
