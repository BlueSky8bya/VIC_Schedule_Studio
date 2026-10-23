import { expect, test } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionPersonality, openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { guardCompanionQa, startCompanionQaProbe, finishCompanionQa, type DailyProof } from "./helpers/companion-qa";

// These are supplemental real-life observations, not replacements for the
// frozen daily nine or a seeded scene/motion simulation. The original before
// run and its incomplete reporter remain unchanged.
test.use({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
  serviceWorkers: "block", storageState: { cookies: [], origins: [] },
  isMobile: false, hasTouch: false, trace: "on",
  video: { mode: "on", size: { width: 1440, height: 1100 } } });
test.setTimeout(145_000);

for (const surface of ["viewer", "studio", "preview"] as const) {
  for (const personality of ["curious", "gourmet"] as const) {
    test(`living intent motion ${surface} ${personality}: ninety actual seconds with a fresh physical toy and next activity`, async ({ page, context, baseURL }, info) => {
      let proof: DailyProof | undefined, completed = false, originalError: string | undefined;
      const scenario = { id: `living-intent-motion-${surface}-${personality}`, surface, personality, seconds: 90,
        width: 1440, motion: "full", need: personality === "gourmet" ? "hungry" : "content", lateToyAtSeconds: 40 };
      try {
        proof = await guardCompanionQa(page, context, baseURL!);
        await page.addInitScript(({ defaults, care, epoch, key, personality }) => {
          for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max",
            "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off",
            "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
          localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...defaults, enabled: true, roam: true, sleep: true, sound: false }));
          localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: personality === "gourmet" ? .8 : .05, energy: .9 }));
        }, { defaults: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, personality });
        await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=6&hour=12&weather=clear");
        await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
        if (surface === "preview") {
          await page.locator(".io-preview").click();
          await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page);
        }
        await chooseCompanionPersonality(page, personality); const home = await openCompanionHome(page);
        await expect(page.locator(".vc-companion")).toBeVisible();
        await startCompanionQaProbe(page, { sampleIntervalMs: 40 });
        await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
        await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
        await page.mouse.move(2, 2);
        const started = await page.evaluate(() => performance.now());
        await expect.poll(() => page.evaluate(() => performance.now()).then(at => at - started), { timeout: 45000, intervals: [500] }).toBeGreaterThanOrEqual(40000);
        // A real native control introduces an actual new object. No actor,
        // choice, route, clock, RNG or completion event is forced.
        const earlierIds = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-toy-id")));
        await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
        if (personality === "curious") {
          // Put the newly introduced real toy near the observed public actor
          // with native input. Geometry is read from painted day containers;
          // no runtime platform, object position or scene is written.
          const fresh = page.locator(".vc-toy");
          const freshId = await fresh.evaluateAll((nodes, old) => nodes.map(node => node.getAttribute("data-toy-id")).find(id => id && !old.includes(id)), earlierIds);
          const target = await page.locator(".vc-companion").evaluate(actor => {
            if (/^companion-home/.test(actor.getAttribute("data-platform") ?? "")) return null;
            const r = actor.getBoundingClientRect(), x = r.left + r.width / 2, y = r.bottom;
            const days = [...document.querySelectorAll<HTMLElement>(".public-day,.studio-day,.agenda-day")]
              .filter(node => !node.closest("[inert],[hidden],[aria-hidden='true']"))
              .map(node => node.getBoundingClientRect()).filter(d => d.width > 70 && d.bottom > 150 && d.bottom < innerHeight - 10);
            return days.map(d => ({ x: Math.max(d.left+30, Math.min(d.right-30, x+55)), y: d.bottom-38 }))
              .sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))
              .find(p => Math.hypot(p.x-x,p.y-y) < 130) ?? null;
          });
          if (freshId && target) {
            const toy = page.locator(`.vc-toy[data-toy-id="${freshId}"]`);
            await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 7000 });
            const rect = await toy.boundingBox();
            if (rect) {
              await page.mouse.move(rect.x + rect.width/2, rect.y + rect.height/2);
              await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 }); await page.mouse.up();
              await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 7000 });
              await info.attach("actual-new-toy-input", { body: JSON.stringify({ id: freshId, target, settledPlatform: await toy.getAttribute("data-platform") }), contentType: "application/json" });
            }
          }
        }
        await page.mouse.move(2, 2);
        await expect.poll(() => page.evaluate(() => performance.now()).then(at => at - started), { timeout: 55000, intervals: [500] }).toBeGreaterThanOrEqual(90000);
        completed = true;
      } catch (error) { originalError = String(error); throw error; }
      finally { if (proof) await finishCompanionQa(page, info, proof, scenario, completed, originalError); }
    });
  }
}
