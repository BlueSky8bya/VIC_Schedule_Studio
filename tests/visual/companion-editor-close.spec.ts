import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

type Sample = { at: number; hidden: boolean; same: boolean; x: number; y: number; state: string; presence: string; guest: boolean; returning: boolean };
type ProbeWindow = Window & { editorCloseProbe: { frames: Sample[]; raf: number; started: number; node: HTMLElement } };
const pet = (page: Page) => page.locator(".vc-companion");

test.use({ viewport: { width: 1920, height: 780 } });
const scenarios = [
  { mode: "full", input: "none" }, { mode: "lite", input: "none" },
  { mode: "reduced", input: "none" }, { mode: "off", input: "none" },
  { mode: "full", input: "pointer" }, { mode: "full", input: "keyboard" },
] as const;
for (const { mode, input } of scenarios) {
  test(`studio ${mode} ${input}: closing an editor in a visible unfocused window restores its quiet pet`, async ({ page }) => {
    const posts: string[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "POST") { posts.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
      if (request.method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, body: "unused fixture navigation" });
      return route.continue();
    });
    await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
    await page.addInitScript(({ prefs, care, key, epoch, mode }) => {
      // Model another visible OS window owning focus. A hidden browser tab is
      // a different hard-hide contract. No pet state, position or app callback
      // is injected; every placement/open/close below uses native controls.
      Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
      localStorage.setItem(key, epoch);
      localStorage.setItem("vic.gfxPref", mode === "off" ? "off" : mode === "lite" ? "lite" : "max");
      localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
      localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
      localStorage.setItem("vic.prefSplit", "1"); localStorage.setItem("vic.font.studio", "maple"); localStorage.setItem("vic.calText.studio", "18");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, energy: .9, hunger: .05 }));
      localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, mode });
    await page.goto("/visual-fixture/studio?role=developer");
    await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
    const actor = pet(page).locator(".vc-actor"); await expect(actor).toBeVisible();
    const calendar = (await page.locator(".studio-calendar-panel").boundingBox())!;
    await page.mouse.move(calendar.x + calendar.width * .55, Math.min(730, calendar.y + 100));
    await page.keyboard.down("Control");
    try { for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(260); } }
    finally { await page.keyboard.up("Control"); }
    await page.mouse.wheel(0, 120); await page.waitForTimeout(200);
    const target = await page.locator('.studio-event-pill[data-companion-event="ordinary"] .pill-main strong').evaluateAll(nodes => nodes.map((node, index) => {
      const range = document.createRange(); range.selectNodeContents(node); const r = range.getBoundingClientRect();
      return { index, x: r.left + r.width / 2, y: r.top - 4, width: r.width };
    }).filter(p => p.width > 25 && p.x > 100 && p.x < innerWidth - 100 && p.y > 180 && p.y < innerHeight - 40).sort((a, b) => b.y - a.y || b.x - a.x)[0]);
    expect(target).toBeDefined();
    await actor.focus(); await actor.press("p"); await page.mouse.click(target.x, target.y); await page.mouse.move(1880, 140);
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await page.waitForTimeout(350);
    await page.locator('.studio-event-pill[data-companion-event="ordinary"] .pill-main strong').nth(target.index).dblclick();
    const editor = page.locator(".event-editor-panel.is-edit"); await expect(editor).toBeVisible(); await waitForOverlayEntrance(editor);
    await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 6000 });
    await expect(pet(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-detail-guest");
    const before = await pet(page).evaluate(node => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: m.m41 + 46, y: m.m42 + 92, support: node.getAttribute("data-platform") }; });
    await pet(page).evaluate(node => {
      const probe: ProbeWindow["editorCloseProbe"] = { frames: [], raf: 0, started: performance.now(), node: node as HTMLElement };
      const sample = () => {
        const el = document.querySelector<HTMLElement>(".vc-companion"), m = new DOMMatrixReadOnly(el?.style.transform);
        probe.frames.push({ at: performance.now() - probe.started, hidden: !el || el.hidden, same: el === node && node.isConnected, x: m.m41 + 46, y: m.m42 + 92, state: el?.dataset.state ?? "", presence: el?.dataset.presence ?? "", guest: el?.hasAttribute("data-detail-guest") ?? false, returning: el?.hasAttribute("data-returning") ?? false });
        probe.raf = requestAnimationFrame(sample);
      };
      (window as unknown as ProbeWindow).editorCloseProbe = probe; probe.raf = requestAnimationFrame(sample);
    });
    mkdirSync(".scratch-pw/087-editor-close", { recursive: true });
    const caseId = `${mode}-${input}`;
    await page.screenshot({ path: `.scratch-pw/087-editor-close/${caseId}-open.png` });
    await editor.locator(".editor-close").click(); await expect(editor).toBeHidden();
    // Unrelated input during the finite dismissal must not strand the pet by
    // cancelling only its final check while leaving the old observer behind.
    if (input === "pointer") await page.mouse.click(8, 770);
    if (input === "keyboard") await page.keyboard.press("Shift");
    await page.waitForTimeout(2200);
    const observed = await page.evaluate(() => { const probe = (window as unknown as ProbeWindow).editorCloseProbe; cancelAnimationFrame(probe.raf); return { frames: probe.frames, hiddenTab: document.hidden, focused: document.hasFocus() }; });
    await page.screenshot({ path: `.scratch-pw/087-editor-close/${caseId}-closed.png` });
    writeFileSync(`.scratch-pw/087-editor-close/${caseId}.json`, JSON.stringify({ before, ...observed, posts, errors }, null, 2));
    expect(observed.hiddenTab).toBe(false); expect(observed.focused).toBe(false);
    const tail = observed.frames.filter(frame => frame.at >= 1200);
    expect(tail.length).toBeGreaterThan(30);
    expect(tail.every(frame => !frame.hidden && frame.same && !frame.guest && !frame.returning)).toBe(true);
    expect(tail.every(frame => Math.hypot(frame.x - before.x, frame.y - before.y) < 3)).toBe(true);
    await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "parked");
    await expect(pet(page)).toBeInViewport({ ratio: .9 });
    await expect(pet(page)).toHaveAttribute("data-dreaming", "");
    // Once the finite close recovery is over, quiet sleep stops updating the pet DOM.
    await pet(page).evaluate(node => {
      const observer = new MutationObserver(records => { (window as unknown as { closeWrites: number }).closeWrites += records.length; });
      (window as unknown as { closeWrites: number; closeObserver: MutationObserver }).closeWrites = 0;
      (window as unknown as { closeObserver: MutationObserver }).closeObserver = observer;
      observer.observe(node, { attributes: true, subtree: true, attributeFilter: ["style", "hidden", "data-state", "data-presence", "data-platform"] });
    });
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => { const scope = window as unknown as { closeWrites: number; closeObserver: MutationObserver }; scope.closeObserver.disconnect(); return scope.closeWrites; })).toBe(0);
    expect(posts).toEqual([]); expect(errors).toEqual([]);
  });
}
