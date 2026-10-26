import { test, expect } from "@playwright/test";
import { guardCompanionQa } from "./helpers/companion-qa";

for (const access of ["sub", "plus"] as const) for (const width of [1440, 390]) {
  test(`subscriber ${access} initial and chapter seek stays external at ${width}px`, async ({ page, context, baseURL }) => {
    const proof = await guardCompanionQa(page, context, baseURL!);
    await page.setViewportSize({ width, height: 1000 });
    let mockReads = 0;
    await context.route("**/api/public/fixture/vod-timeline?*", route => { mockReads++; return route.fulfill({ json: { authorNick: "합성", entries: [{ sec: 0, label: "처음", section: null }, { sec: 300, label: "합성 챕터", section: null }], variants: [] } }); });
    await context.route("**/api/public/fixture/vod-chat?*", route => { mockReads++; return route.fulfill({ json: { binSec: 30, bins: [] } }); });
    await page.addInitScript(() => {
      const target = window as Window & { __seekOpens?: { url: string; target?: string; features?: string }[] };
      target.__seekOpens = [];
      window.open = (url, name, features) => { target.__seekOpens!.push({ url: String(url), target: name, features }); return null; };
    });
    await page.goto(`/visual-fixture/vod-seek?access=${access}`);
    const picker = page.getByRole("combobox", { name: "이 날의 영상 선택", exact: true });
    const options = picker.locator("option");
    await expect(options).toHaveCount(2);
    if (access === "sub") {
      await expect(options).toHaveText([/영상 1 \/ 2.*구독/, /영상 2 \/ 2.*구독/]);
      await expect(page.locator(".dvm-part-counter")).toHaveText("영상 1 / 2");
    } else {
      await expect(options).toHaveText([/1 \/ 2부.*10분.*구독\+/, /2 \/ 2부.*10분.*구독\+/]);
    }
    const link = page.getByRole("link", { name: "숲에서 보기", exact: true });
    await expect(link).toHaveAttribute("href", "https://vod.sooplive.co.kr/player/42?change_second=125");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => (window as Window & { __seekOpens?: unknown[] }).__seekOpens)).toEqual([]);
    await page.getByText("합성 챕터", { exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __seekOpens?: unknown[] }).__seekOpens?.length)).toBe(1);
    expect(await page.evaluate(() => (window as Window & { __seekOpens?: unknown[] }).__seekOpens)).toEqual([{ url: "https://vod.sooplive.co.kr/player/42?change_second=300", target: "_blank", features: "noopener,noreferrer" }]);
    await expect(link).toHaveAttribute("href", "https://vod.sooplive.co.kr/player/42?change_second=300");
    await expect(page.locator("iframe")).toHaveCount(0);
    await picker.selectOption("43");
    await expect(picker).toHaveValue("43");
    await expect(link).toHaveAttribute("href", "https://vod.sooplive.co.kr/player/43");
    await page.screenshot({ path: test.info().outputPath("subscriber-seek.png") });
    await Promise.all(proof.pending);
    expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
    expect(mockReads).toBeGreaterThan(0);
    await test.info().attach("subscriber-seek-proof", { body: JSON.stringify({ access, width, mockReads, buildId: proof.build, errors: proof.errors, mutations: proof.mutations, liveReads: proof.liveReads, networkGuard: "exact-owned-fixture; mock DTO; no external navigation", scope: "actual shared component links and native chapter click; not live SOOP playback" }), contentType: "application/json" });
  });
}
