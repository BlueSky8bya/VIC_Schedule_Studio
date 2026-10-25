import { test, expect } from "@playwright/test";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { companionTraceMode } from "./helpers/companion-evidence-policy";

test.use({ serviceWorkers: "block", trace: companionTraceMode(), video: "on" });
for (const surface of ["viewer", "studio", "preview"] as const) for (const width of surface === "studio" ? [1440] : [390, 1440]) {
  test(`search focus ${surface} ${width}: wraps Tab and returns to its opener after Escape`, async ({ page, context, baseURL }, info) => {
    await page.setViewportSize({ width, height: 1100 });
    const proof = await guardCompanionQa(page, context, baseURL!);
    await context.addInitScript(() => {
      localStorage.setItem("vic.settingsEpoch", "2026-09-04");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
      for (const key of ["vic.ambient", "vic.sound", "vic.gfxPref"]) localStorage.setItem(key, "off");
    });
    await context.route("**/api/public/*/search**", route => {
      const url = new URL(route.request().url());
      if (url.origin !== baseURL || route.request().method() !== "GET") return route.fallback();
      return route.fulfill({ json: url.pathname.endsWith("/search/trending") ? { trends: [] } : url.pathname.endsWith("/search/suggest") ? { items: [] } : { query: "합성검색", hits: [] } });
    });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : `/visual-fixture/studio?role=developer&y=2026&m=6${surface === "preview" ? "&viewer=1" : ""}`);
    await settlePanelLayout(page);
    const opener = page.getByRole("button", { name: "검색", exact: true }).first();
    const box = await opener.isVisible() ? await opener.boundingBox() : null, expand = page.getByRole("button", { name: "패널 펼치기", exact: true });
    if ((!box || box.x + box.width <= 0) && await expand.isVisible()) { await expand.click(); await settlePanelLayout(page); }
    await opener.focus(); await opener.press("Enter");
    const dialog = page.getByRole("dialog", { name: "검색", exact: true });
    const input = dialog.getByRole("searchbox", { name: "검색어", exact: true });
    await expect(input).toBeFocused();
    const focusState = () => dialog.evaluate(node => {
      const list = [...node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(n => n.getClientRects().length > 0);
      return { inside: node.contains(document.activeElement), index: list.indexOf(document.activeElement as HTMLElement), count: list.length };
    });
    const trail: unknown[] = [];
    for (const key of ["Tab", "Shift+Tab"] as const) {
      await input.focus(); let previous = await focusState(), wrapped = false;
      expect(previous.count).toBeGreaterThan(1);
      for (let step = 0; step < previous.count + 2; step++) {
        await page.keyboard.press(key); const actual = await focusState();
        trail.push({ key, step, ...actual }); expect(actual.inside).toBe(true);
        if (key === "Tab" ? previous.index === previous.count - 1 && actual.index === 0 : previous.index === 0 && actual.index === actual.count - 1) wrapped = true;
        previous = actual;
      }
      expect(wrapped, `${key} crossed the actual modal boundary`).toBe(true);
    }
    await input.fill("합성검색"); await input.press("Enter");
    await expect(dialog.locator(".ps-hint").filter({ hasText: "없음" })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await Promise.all(proof.pending);
    expect(proof.errors).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.rejected).toEqual([]);
    expect(proof.chunks.every(chunk => chunk.local === chunk.served)).toBe(true);
    await info.attach("actual-focus-trail", { body: JSON.stringify({ surface, width, trail, openerRestored: true, syntheticFixture: true, fullCertification: false }), contentType: "application/json" });
  });
}
