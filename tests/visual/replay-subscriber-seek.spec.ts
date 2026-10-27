import { test, expect } from "@playwright/test";
import { guardCompanionQa } from "./helpers/companion-qa";

for (const access of ["sub", "plus"] as const) for (const width of [1440, 390]) {
  test(`subscriber ${access} initial and chapter seek stays external at ${width}px`, async ({ page, context, baseURL }) => {
    const proof = await guardCompanionQa(page, context, baseURL!);
    await page.setViewportSize({ width, height: 1000 });
    let mockReads = 0;
    await context.route("**/api/public/fixture/vod-timeline?*", route => { mockReads++; return route.fulfill({ json: { authorNick: "합성", entries: [{ sec: 0, label: "처음", section: null }, { sec: 1, label: "합성1초", section: null }, { sec: 2, label: "합성2초", section: null }, { sec: 300, label: "합성 챕터", section: null }], variants: [] } }); });
    await context.route("**/api/public/fixture/vod-chat?*", route => { mockReads++; return route.fulfill({ json: { binSec: 30, bins: [] } }); });
    await page.addInitScript(() => {
      const target = window as Window & { __seekOpens?: { url: string; target?: string; features?: string }[] };
      target.__seekOpens = [];
      document.addEventListener("click",event=>{if((event.target as Element)?.closest('a[href^="https://vod.sooplive.co.kr/player/"]'))event.preventDefault();},true);
      window.open = (url, name, features) => { target.__seekOpens!.push({ url: String(url), target: name, features }); return null; };
    });
    await page.goto(`/visual-fixture/vod-seek?access=${access}`);
    const picker = page.getByRole("button", { name: "이 날의 영상 선택", exact: true });
    await picker.click();
    const options = page.getByRole("listbox",{name:"이 날의 영상 선택"}).getByRole("option");
    await expect(options).toHaveCount(2);
    if (access === "sub") {
      await expect(options).toHaveText([/영상 1.*구독/, /영상 2.*구독/]);
      await expect(page.locator(".dvm-part-counter")).toHaveText("영상 1 / 2");
    } else {
      await expect(options).toHaveText([/1부.*10분.*구독/, /2부.*10분.*구독/]);
      await expect(options.locator('.vod-access-badge[aria-label="구독+"]')).toHaveCount(2);
    }
    await page.keyboard.press("Escape");
    const link = page.getByRole("link", { name: "숲에서 보기", exact: true });
    await expect(link).toHaveAttribute("href", "https://vod.sooplive.co.kr/player/42?change_second=125");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator(".day-vod-modal").focus();
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => (window as Window & { __seekOpens?: unknown[] }).__seekOpens)).toEqual([]);
    for(const sec of [1,2]){
      await page.getByText('합성'+sec+'초',{exact:true}).click();
      const arrow=page.locator('.dvm-ext');await arrow.hover();await arrow.click();
      await expect(arrow).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second='+sec);
      await expect(link).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second='+sec);
    }
    await page.evaluate(()=>{(window as Window & {__seekOpens?:unknown[]}).__seekOpens=[];});
    await page.getByText("합성 챕터", { exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __seekOpens?: unknown[] }).__seekOpens?.length)).toBe(1);
    expect(await page.evaluate(() => (window as Window & { __seekOpens?: unknown[] }).__seekOpens)).toEqual([{ url: "https://vod.sooplive.co.kr/player/42?change_second=300", target: "_blank", features: "noopener,noreferrer" }]);
    await expect(link).toHaveAttribute("href", "https://vod.sooplive.co.kr/player/42?change_second=300");
    await expect(page.locator("iframe")).toHaveCount(0);
    await picker.click();
    await page.getByRole("option").nth(1).click();
    await expect(page.locator(".dvm-head .dvm-title")).toHaveText("합성 다른 영상");
    await expect(link).toHaveAttribute("href", "https://vod.sooplive.co.kr/player/43");
    await page.screenshot({ path: test.info().outputPath("subscriber-seek.png") });
    await Promise.all(proof.pending);
    expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
    expect(mockReads).toBeGreaterThan(0);
    await test.info().attach("subscriber-seek-proof", { body: JSON.stringify({ access, width, mockReads, buildId: proof.build, errors: proof.errors, mutations: proof.mutations, liveReads: proof.liveReads, networkGuard: "exact-owned-fixture; mock DTO; no external navigation", scope: "actual shared component links and native chapter click; not live SOOP playback" }), contentType: "application/json" });
  });
}
