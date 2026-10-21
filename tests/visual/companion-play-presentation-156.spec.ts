import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { companionSpriteMetadata, companionSpriteSources } from "@/lib/ui/viewer-companion/sprite-quality";
import { chooseCompanionPersonality, openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { guardCompanionQa, startCompanionQaProbe, type QaObservation } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { curiousTextureCellMatches } from "./helpers/companion-curious-completion-144";

type ProbeWindow = Window & { companionDaily142?: { frames: QaObservation[]; stop: () => void } };
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const frameBuffers = new WeakMap<Page, { cursor: number; frames: QaObservation[] }>();
const frames = async (page: Page) => {
  const previous = frameBuffers.get(page) ?? { cursor: 0, frames: [] };
  const chunk = await page.evaluate(cursor => {
    const frames = (window as ProbeWindow).companionDaily142?.frames ?? [];
    return { cursor: frames.length, frames: frames.slice(cursor) };
  }, previous.cursor);
  const frames = previous.frames.concat(chunk.frames);
  frameBuffers.set(page, { cursor: chunk.cursor, frames });
  return frames;
};
const actualSource = (frame: QaObservation) => frame.visible && frame.decoded && frame.sourceClipMeasured === true
  && frame.curiousCompletion.source === true && frame.paintedSource?.passed === true
  && curiousTextureCellMatches(frame.pose, frame.curiousCompletion.cell);
const actualPose = (frame: QaObservation) => actualSource(frame) && frame.playPaint === "matching";
const firstBow = (observed: QaObservation[]) => {
  const start = observed.findIndex(frame => frame.state === "play" && frame.play === "bow");
  if (start < 0) return [];
  const end = observed.findIndex((frame, index) => index > start && (frame.state !== "play" || frame.play !== "bow"));
  return observed.slice(start, end < 0 ? observed.length : end);
};

test.use({ viewport: { width: 1920, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: false,
  trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } }, storageState: { cookies: [], origins: [] } });
test.setTimeout(130_000);

for (const surface of ["viewer", "studio", "preview"] as const) test(`156 ${surface} cold bow packet keeps a full actual onset and following activity`, async ({ page, context, baseURL }, info) => {
  const proof = await guardCompanionQa(page, context, baseURL!);
  const cold: { path: string; requestedAt: number; releasedAt: number; requestedMonotonicAt: number; releasedMonotonicAt: number; sha256: string }[] = [];
  const bowSources = companionSpriteSources(29);
  const bindingPath = process.env.COMPANION156_SOURCE_FREEZE;
  if (!bindingPath) throw Error("New execution source-freeze.json is required");
  const sourceBytes = readFileSync(resolve(bindingPath));
  const binding = JSON.parse(sourceBytes.toString()) as { contentDigest: string; sourceFiles: { path: string; sha256: string }[] };
  const sourcePaths = ["components/poster/viewer-companion/viewer-companion.tsx", "lib/ui/viewer-companion/play-presentation.ts", "tests/visual/companion-play-presentation-156.spec.ts"];
  for (const path of sourcePaths) expect(binding.sourceFiles.find(item => item.path === path)?.sha256).toBe(sha(readFileSync(resolve(path))));
  for (const path of bowSources) {
    const bytes = readFileSync(resolve("public", "." + path));
    expect(sha(bytes)).toBe(companionSpriteMetadata.atlases.find(atlas => atlas.src === path)?.sha256);
    await context.route("**" + path, async route => {
      const requestedAt = Date.now(), requestedMonotonicAt = performance.now();
      const request = { path, requestedAt, requestedMonotonicAt, releasedAt: 0, releasedMonotonicAt: 0, sha256: sha(bytes) }; cold.push(request);
      // Delaying these exact existing immutable local bytes models a cold
      // packet. No actor, RNG, clock, geometry or animation hook is replaced.
      // A requested timer duration is not a measured lower bound: Node may
      // fire before the rounded wall-clock deadline. Keep both real clocks.
      while (Date.now() - requestedAt < 450 || performance.now() - requestedMonotonicAt < 450) {
        const remaining = Math.max(1, 450 - (Date.now() - requestedAt), 450 - (performance.now() - requestedMonotonicAt));
        await new Promise(done => setTimeout(done, remaining));
      }
      request.releasedMonotonicAt = performance.now();
      request.releasedAt = Date.now();
      await route.fulfill({ contentType: "image/webp", body: bytes });
    });
  }
  await page.addInitScript(({ epoch, epochKey, preferences, care }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }),
      "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off",
      // The initial notebook preview must not warm bow before observation.
      // Performer previews a different immutable packet; its real radio is
      // still selected below and the first-bow cold assertion stays strict.
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, personality: "performer", personalitySource: "manual", enabled: true, roam: false, sleep: false, learnFromYou: false, heartPrank: false, cardPrank: false, panelPrank: false, rarePrank: false }),
      "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...care, hunger: .05, energy: .95 }) })) localStorage.setItem(key, value);
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_MEMORY });
  let completed = false;
  try {
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2025&m=10&hour=12&weather=clear");
    await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
    if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
    const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
    await chooseCompanionPersonality(page, "performer");
    expect(cold, "no bow packet may be warm before autonomous observation").toEqual([]);
    frameBuffers.delete(page);
    await startCompanionQaProbe(page, { sampleIntervalMs: 40 });
    await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
    await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
    await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
    await dialog.locator('[data-act="companion-roam"]').setChecked(true);
    await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
    await expect.poll(async () => {
      const observed = await frames(page), bow = firstBow(observed);
      if (!bow.length) return false;
      const rows = bow.filter(frame => actualPose(frame) && companionSpriteMetadata.rows[29].includes(frame.pose));
      const recovery = bow.filter(frame => actualPose(frame) && companionSpriteMetadata.rows[23].includes(frame.pose));
      return rows.length >= 3 && recovery.length >= 2 && observed.some(frame => actualSource(frame)
        && frame.at > recovery.at(-1)!.at + 100 && frame.at <= recovery.at(-1)!.at + 10_000
        && frame.play !== "bow" && ["walk", "jump", "eat", "sleep"].includes(frame.state));
    }, { timeout: 90_000, intervals: [100] }).toBe(true);
    const observed = await frames(page), bow = firstBow(observed);
    const actual = bow.filter(actualPose);
    expect(cold.length).toBeGreaterThan(0); expect(cold.every(request => request.releasedAt - request.requestedAt >= 450)).toBe(true);
    expect(cold.every(request => request.releasedMonotonicAt - request.requestedMonotonicAt >= 450)).toBe(true);
    expect(actual.length).toBe(bow.length);
    const onset = actual.filter(frame => companionSpriteMetadata.rows[29].includes(frame.pose));
    expect(onset[0].pose).toBeLessThan(companionSpriteMetadata.rows[29].at(-3)!);
    expect(new Set(onset.map(frame => frame.pose)).size).toBeGreaterThanOrEqual(3);
    expect(Math.max(...onset.map(frame => frame.pose))).toBe(companionSpriteMetadata.rows[29].at(-1));
    expect(actual.at(-1)!.at - actual[0].at).toBeGreaterThanOrEqual(1340 * .8 - 80);
    expect(actual.at(-1)!.at - actual[0].at).toBeLessThanOrEqual(1600);
    completed = true;
  } finally {
    const observed = await page.evaluate(() => { const probe = (window as ProbeWindow).companionDaily142; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
    await Promise.allSettled(proof.pending);
    const directory = info.outputPath("cold-bow-presentation-156"); mkdirSync(directory, { recursive: true });
    const raw = resolve(directory, "raw.json");
    const boundaryClean = [proof.errors,proof.rejected,proof.mutations,proof.liveReads].every(rows => rows.length === 0);
    const chunksMatch = proof.chunks.length > 0 && proof.chunks.every(chunk => chunk.local === chunk.served);
    writeFileSync(raw, JSON.stringify({ schemaVersion: 1, kind: "actual-cold-play-presentation-156", surface, status: completed && boundaryClean && chunksMatch && info.status === "passed" ? "passed" : "failed", statusAtFinally: info.status, completed,
      sourceBinding: { path: resolve(bindingPath), sha256: sha(sourceBytes), contentDigest: binding.contentDigest }, buildId: proof.build,
      proof: { ...proof, pending: undefined }, cold, frames: observed,
      limitation: "Three real native surface samples of one finite bow under450ms immutable local packet latency. Not every pose/packet or all nine daily idea adoption. Trace/video still require independent review." }, null, 2));
    await page.screenshot({ path: resolve(directory, "actual-final.png"), animations: "allow" }).catch(() => {});
    await info.attach("cold-bow-presentation-156", { path: raw, contentType: "application/json" });
    expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
    expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(chunk => chunk.local === chunk.served)).toBe(true);
  }
});
