import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
    // The developer header's report inbox asks for its badge number on mount (02b4295a, 2026-11-13). That one read
    // is answered here ("nothing unseen") and never reaches the server; every other POST is still a forbidden write.
    const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "POST" && actions[request.headers()["next-action"] ?? ""]?.exportedName === "getUnseenReportCountAction") return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":"fixture"}\n1:0\n' });
      if (request.method() === "POST") { posts.push(`${path} ${request.headers()["next-action"] ?? ""}`.trim()); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
      if (request.method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, body: "unused fixture navigation" });
      return route.continue();
    });
    await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
    await page.addInitScript(({ prefs, care, key, epoch, animal, mode, sleep }) => {
      // Model visible OS focus only. "다른 창 쓸 때도 놀기" ships on (1f2cb9eb, 2026-10-19), which keeps a blurred
      // visible page active; these cases are about the blur that parks, so the seed turns that one switch off.
      // Model visible OS focus only. Product state, positions, clocks and
      // callbacks stay untouched; all commands below use real controls.
      const scope = window as unknown as FixtureWindow;
      scope.fixtureFocused = true;
      Object.defineProperty(document, "hasFocus", { configurable: true, value: () => scope.fixtureFocused });
      localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", mode === "lite" ? "lite" : mode === "off" ? "off" : "max");
      localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
      localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, activeWhileVisible: false, animalMode: animal, personality: "sleepy", speed: "normal", sleep, roam: false, jump: false, feeding: false, heartPrank: false, ambientPrank: false, cardPrank: false, panelPrank: false, learnFromYou: false }));
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
    const focusWindow = (focused: boolean) => page.evaluate(focused => { (window as unknown as FixtureWindow).fixtureFocused = focused; window.dispatchEvent(new Event(focused ? "focus" : "blur")); }, focused);
    if (start === "parked") {
      await focusWindow(false);
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
      await expect(recall).toBeEnabled();
      // A real click on another window's page focuses that window before the click arrives, and since 1f2cb9eb
      // (2026-10-19) the recall is ignored while the document has no focus. Model the same order: focus, then click
      // at once, so the call still reaches a creature that has not finished waking from its parked sleep.
      if (start === "parked") { await focusWindow(true); await expect(pet).not.toHaveAttribute("data-presence", "active"); }
      await recall.click();
      if (mode !== "reduced") {
        await expect(pet).toHaveAttribute("data-home-journey", "");
        await expect(pet).not.toHaveAttribute("data-state", "sleep");
        await expect(pet).toHaveAttribute("data-state", "walk");
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${output}/${caseId}-travelling.png` });
      }
      // The user goes back to the other window while the called journey is under way.
      if (start !== "active") await focusWindow(false);
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
