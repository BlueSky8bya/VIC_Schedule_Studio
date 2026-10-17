import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Frame = { at: number; platform: string; state: string; presence: string; journey: boolean; hidden: boolean; same: boolean; x: number; y: number; pose: string };
type FixtureWindow = Window & { fixtureFocused: boolean; homeWitness: { frames: Frame[]; raf: number } };
const scenarios = [
  { surface: "studio", animal: "default", start: "blur", mode: "full", sleep: true },
  { surface: "viewer", animal: "default", start: "parked", mode: "full", sleep: true },
  { surface: "studio", animal: "dog", start: "parked", mode: "full", sleep: true },
  { surface: "viewer", animal: "cat", start: "parked", mode: "lite", sleep: true },
  { surface: "studio", animal: "cat", start: "active", mode: "full", sleep: false },
  { surface: "viewer", animal: "dog", start: "active", mode: "reduced", sleep: true },
  { surface: "studio", animal: "default", start: "parked", mode: "off", sleep: true },
  { surface: "viewer", animal: "dog", start: "parked", mode: "full", sleep: true, interruption: "fold" },
] as const;

test.use({ viewport: { width: 1920, height: 1100 } });
for (const scenario of scenarios) {
  const { surface, animal, start, mode, sleep } = scenario;
  const interruption = "interruption" in scenario ? scenario.interruption : undefined;
  test(`${surface} ${animal} ${start} ${mode}${interruption ? ` ${interruption}` : ""}: ${interruption ? "a parked recall yields to explicit house closure" : "a low-energy sleepy companion completes a direct recall"}`, async ({ page }) => {
    test.setTimeout(40000);
    const posts: string[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "POST") { posts.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
      if (request.method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, body: "unused fixture navigation" });
      return route.continue();
    });
    await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
    await page.addInitScript(({ prefs, care, key, epoch, animal, mode, sleep }) => {
      // Model visible OS focus only. Product state, positions, clocks and
      // callbacks stay untouched; all commands below use real controls.
      const scope = window as unknown as FixtureWindow;
      scope.fixtureFocused = true;
      Object.defineProperty(document, "hasFocus", { configurable: true, value: () => scope.fixtureFocused });
      localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", mode === "lite" ? "lite" : mode === "off" ? "off" : "max");
      localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
      localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, animalMode: animal, personality: "sleepy", speed: "normal", sleep, roam: false, jump: false, feeding: false, heartPrank: false, ambientPrank: false, cardPrank: false, panelPrank: false, learnFromYou: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, energy: .08, hunger: .1 }));
      localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, animal, mode, sleep });
    await page.goto(surface === "studio" ? "/visual-fixture/studio?role=developer&y=2025&m=11" : "/visual-fixture/poster");
    await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
    const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor");
    await expect(actor).toBeVisible();
    await actor.focus(); await actor.press("p"); await page.mouse.click(850, 1050); await page.mouse.move(1800, 900);
    await expect(pet).toHaveAttribute("data-platform", /^viewport-floor/); await expect(pet).not.toHaveAttribute("data-state", "jump");
    const identity = (await pet.elementHandle())!;
    if (start === "parked") {
      await page.evaluate(() => { (window as unknown as FixtureWindow).fixtureFocused = false; window.dispatchEvent(new Event("blur")); });
      await expect(pet).toHaveAttribute("data-presence", "parked", { timeout: 18000 });
    }
    const savedBefore = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"));
    await pet.evaluate(node => {
      const witness = { frames: [] as Frame[], raf: 0 }, began = performance.now();
      const sample = () => {
        const el = node as HTMLElement, m = new DOMMatrixReadOnly(el.style.transform);
        witness.frames.push({ at: performance.now() - began, platform: el.dataset.platform ?? "", state: el.dataset.state ?? "", presence: el.dataset.presence ?? "", journey: el.hasAttribute("data-home-journey"), hidden: el.hidden, same: node.isConnected && node === document.querySelector(".vc-companion"), x: m.m41 + 46, y: m.m42 + 92, pose: el.dataset.pose ?? "" });
        witness.raf = requestAnimationFrame(sample);
      };
      (window as unknown as FixtureWindow).homeWitness = witness; witness.raf = requestAnimationFrame(sample);
    });
    const caseId = `${surface}-${animal}-${start}-${mode}${interruption ? `-${interruption}` : ""}`, output = ".scratch-pw/088-home";
    mkdirSync(output, { recursive: true });
    let samples: Frame[] = [];
    try {
      const recall = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
      await expect(recall).toBeEnabled(); await recall.click();
      if (mode !== "reduced") {
        await expect(pet).toHaveAttribute("data-home-journey", "");
        await expect(pet).not.toHaveAttribute("data-state", "sleep");
        await expect(pet).toHaveAttribute("data-state", "walk");
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${output}/${caseId}-travelling.png` });
      }
      if (start === "blur") {
        await page.evaluate(() => { (window as unknown as FixtureWindow).fixtureFocused = false; window.dispatchEvent(new Event("blur")); });
      }
      if (interruption === "fold") {
        // A call issued from CSS-only parked sleep must reconnect live geometry;
        // closing its actual house now supersedes the command, not its cache.
        await page.getByRole("button", { name: "빅타민 집", exact: true }).click();
        await expect(pet).not.toHaveAttribute("data-home-journey", { timeout: 6000 });
        await expect(pet).not.toHaveAttribute("data-platform", "companion-home");
      } else {
        await page.waitForFunction(() => {
          const node = document.querySelector<HTMLElement>(".vc-companion");
          return node?.dataset.platform === "companion-home" || node?.dataset.state === "sleep";
        }, undefined, { timeout: 25000 });
        await expect(pet).toHaveAttribute("data-platform", "companion-home");
        await expect(pet).not.toHaveAttribute("data-home-journey");
      }
      await expect(pet).toBeVisible(); await expect(pet).toBeInViewport({ ratio: .9 });
      expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
      if (!sleep) await expect(pet).not.toHaveAttribute("data-state", "sleep");
      if (start !== "active" && !interruption) {
        await expect(pet).toHaveAttribute("data-presence", "parked", { timeout: 18000 });
        await expect(pet).toHaveAttribute("data-dreaming", "");
      }
    } finally {
      samples = await page.evaluate(() => { const probe = (window as unknown as FixtureWindow).homeWitness; cancelAnimationFrame(probe.raf); return probe.frames; });
      writeFileSync(`${output}/${caseId}.json`, JSON.stringify({ scenario, samples, posts, errors }, null, 2));
      await page.screenshot({ path: `${output}/${caseId}.png` });
    }
    const firstMove = samples.findIndex(frame => frame.journey && ["walk", "jump", "wake", "look"].includes(frame.state));
    if (mode !== "reduced" && !interruption) {
      expect(firstMove).toBeGreaterThanOrEqual(0);
      const travelling = samples.slice(firstMove).filter(frame => frame.platform !== "companion-home");
      expect(travelling.length).toBeGreaterThan(10);
      expect(travelling.every(frame => frame.journey && frame.same && frame.state !== "sleep" && frame.presence !== "parked")).toBe(true);
    }
    expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(savedBefore);
    expect(posts).toEqual([]); expect(errors).toEqual([]);
  });
}
