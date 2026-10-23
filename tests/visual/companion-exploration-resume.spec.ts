import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { expect, test } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionPersonality, openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { guardCompanionQa, startCompanionQaProbe, finishCompanionQa, type DailyProof, type QaObservation } from "./helpers/companion-qa";
import { companionInterestInspection, matchCompanionExplorationWitness, type ExplorationInputAttempt } from "./helpers/companion-exploration-witness";

test.use({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: "block",
  storageState: { cookies: [], origins: [] }, trace: companionTraceMode(), video: { mode: "on", size: { width: 1440, height: 1100 } } });
test.setTimeout(205_000);

test("living exploration viewer: a real newly placed toy is inspected before the same exploration resumes", async ({ page, context, baseURL }, info) => {
  let proof: DailyProof | undefined, completed = false, originalError: string | undefined;
  const attempts: ExplorationInputAttempt[] = [];
  const scenario = { id: "living-exploration-actual-resume", personality: "curious", surface: "viewer", seconds: 90, width: 1440, motion: "full", need: "content" };
  try {
    proof = await guardCompanionQa(page, context, baseURL!);
    await page.addInitScript(({ defaults, memory, epoch, key }) => {
      for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }),
        "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, roam: true, sleep: false, sound: false, feeding: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05 }));
    }, { defaults: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
    await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
    await chooseCompanionPersonality(page, "curious"); const home = await openCompanionHome(page);
    await startCompanionQaProbe(page, { sampleIntervalMs: 40, captureMs: 190000 });
    const began = await page.evaluate(() => performance.now());
    const actor = page.locator(".vc-companion");
    const readFrames = () => page.evaluate(() => (window as Window & { companionDaily142?: { frames: QaObservation[] } }).companionDaily142!.frames);
    let detourObserved = false;
    for (let attempt = 0; attempt < 3 && !detourObserved; attempt++) {
      // A preceding input can become interesting during the next opportunity.
      // Preserve that real event instead of attributing it to the latest toy.
      if (attempts.length && matchCompanionExplorationWitness(await readFrames(), attempts)) { detourObserved = true; break; }
      const previous = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-toy-id")));
      await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
      const toyId = await page.locator(".vc-toy").evaluateAll((nodes, old) => nodes.map(node => node.getAttribute("data-toy-id")).find(id => id && !old.includes(id)), previous);
      expect(toyId).toBeTruthy(); const toy = page.locator(`.vc-toy[data-toy-id="${toyId}"]`);
      await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 7000 });
      const rect = (await toy.boundingBox())!;
      await page.mouse.move(rect.x+rect.width/2, rect.y+rect.height/2); await page.mouse.down();
      // A human holds the real toy until an actual public exploration is in
      // progress. The actor chooses its own trip; the held object is ineligible.
      await expect.poll(() => actor.evaluate(node => {
        const d = (node as HTMLElement).dataset;
        return ["D143-C", "C05", "C10", "D157-C"].includes(d.personalityScene ?? "") && d.personalityCommand === "go"
          && Boolean(d.platform && !/^companion-home/.test(d.platform)) && ["walk", "jump"].includes(d.state ?? "")
          && Boolean(d.personalityGoalPlatform && d.personalityStepPlatform)
          && [d.personalityStepX,d.personalityStepY,d.personalityGoalX,d.personalityGoalY].every(value => value !== undefined && Number.isFinite(Number(value)))
          && (d.personalityGoalPlatform !== d.personalityStepPlatform || Math.hypot(Number(d.personalityStepX)-Number(d.personalityGoalX),Number(d.personalityStepY)-Number(d.personalityGoalY))>=24)
          && Number(d.personalityStepX)>24 && Number(d.personalityStepX)<innerWidth-24 && Number(d.personalityStepY)>40 && Number(d.personalityStepY)<innerHeight-8;
      }), { timeout: 45000, intervals: [40] }).toBe(true);
      const target = await actor.evaluate(node => {
        const d = (node as HTMLElement).dataset;
        // Place the native object at an actual intermediate support, while
        // the independently bound final goal is still farther along the trip.
        return { x: Number(d.personalityStepX), y: Number(d.personalityStepY),
          platformId: d.personalityStepPlatform, goal: { x: Number(d.personalityGoalX), y: Number(d.personalityGoalY), platformId: d.personalityGoalPlatform } };
      });
      expect(target).toBeTruthy();
      // The native grip was at the real box center, while the model's point
      // is its foot. Keep the captured half-height and clearance above the
      // actual support so this input cannot start underneath the intended row.
      const releaseY = target.y-rect.height/2-12;
      await page.mouse.move(target.x, releaseY, { steps: 4 });
      // Native pause then a one-pixel finishing movement sets a gentle real
      // release velocity, rather than throwing the object across the calendar.
      await page.waitForTimeout(180); await page.mouse.move(target.x+1, releaseY);
      const owner = await actor.evaluate(node => { const d = (node as HTMLElement).dataset; return { id: d.personalityScene ?? "", serial: d.personalitySerial ?? "", beat: d.personalityBeat ?? "" }; });
      const releasedAfterAt = await page.evaluate(() => (window as Window & { companionDaily142?: { frames: QaObservation[] } }).companionDaily142!.frames.at(-1)?.at ?? -Infinity);
      expect(Number.isFinite(releasedAfterAt)).toBe(true);
      attempts.push({ attempt, toyId: toyId!, ownerAtRelease: owner, releasedAfterAt });
      await page.mouse.up(); await page.mouse.move(2,2);
      await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 7000 });
      await info.attach(`actual-interest-input-${attempt}`, { body: JSON.stringify({ owner, toyId, target, gripHeight: rect.height, releaseY, platform: await toy.getAttribute("data-platform") }), contentType: "application/json" });
      await expect(toy, "The native object must settle on the actual intermediate support before evaluating interest").toHaveAttribute("data-platform", target.platformId!);
      const observed = await expect.poll(() => actor.evaluate((node, ids) => {
        const data = (node as HTMLElement).dataset;
        return data.personalityScene === "curious-interest" && ids.includes(data.personalityItem ?? "");
      }, attempts.map(input => input.toyId)), { timeout: 12000, intervals: [40] }).toBe(true).then(() => true, async error => {
        await info.attach(`original-unobserved-interest-${attempt}`, { body: String(error), contentType: "text/plain" });
        return false;
      });
      detourObserved = observed || Boolean(matchCompanionExplorationWitness(await readFrames(), attempts));
    }
    expect(detourObserved, "A new-interest detour must actually occur; native input alone is insufficient").toBe(true);
    await expect.poll(() => page.evaluate(() => performance.now()).then(at => at-began), { timeout: 95000, intervals: [500] }).toBeGreaterThanOrEqual(90000);
    const frames = await readFrames(), witness = matchCompanionExplorationWitness(frames, attempts);
    expect(witness, "The introduced physical toy must interrupt an actual exploration and resume that same owner/serial/beat with rendered motion").toBeTruthy();
    const expected = witness!;
    const inspect = frames.filter(frame => companionInterestInspection(frame, expected.toyId, expected.interestSerial));
    expect(inspect.length, "The same physical object's actual finite inspection must be rendered").toBeGreaterThan(4);
    const lastInspect = inspect.at(-1)!;
    expect(frames.some(f => f.at > lastInspect.at && f.scene === expected.owner.id && f.serial === expected.owner.serial && f.beat === expected.owner.beat
      && f.visible && f.decoded && f.paintedSource?.passed && (f.walkSource || f.jumpSource))).toBe(true);
    await info.attach("actual-interest-resume-witness", { body: JSON.stringify({ ...expected, firstInspectAt: inspect[0].at, lastInspectAt: lastInspect.at, frames: inspect.length }), contentType: "application/json" });
    completed = true;
  } catch (error) { originalError = String(error); throw error; }
  finally {
    await info.attach("actual-interest-input-ledger", { body: JSON.stringify(attempts), contentType: "application/json" });
    if (proof) await finishCompanionQa(page, info, proof, scenario, completed, originalError);
  }
});
