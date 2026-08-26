import { expect, test } from "@playwright/test";

// 아바타 scene 회귀 게이트(2026-08-27) — 방송 화면(OBS 1920×1080 브라우저 소스) 기준.
//  · scene: 달력은 평소처럼 '폭 기준' fit만(높이 fit은 당일 철회 — 긴 달에서 글씨가 작아짐).
//  · 오른쪽 칸: 정보 카드가 열 전폭(세로 스택) — 달 제목 줄바꿈 0. 카드↔점선 박스 겹침 0.
//    아바타 열은 1920에서 정확히 360px(고정 컴포지션).
//  · 꾸미기 scene: 토글이 슬롯 안 흐름(카드 아래·박스 위)에 있고 어느 것과도 겹치지 않는다.
//  · 고정 scene(fixed=left, /onair와 동일 경로): 토글 없이 scene이 켜진다.
//  · scene OFF(기본 시청자): 슬롯 없음, 폭 fit.
type Box = { x: number; y: number; w: number; h: number; b: number; r: number } | null;
const overlaps = (a: Box, b: Box) => !!(a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b);

async function readScene(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector<HTMLElement>(s);
    const rect = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right };
    };
    const scaler = q(".poster-scaler")!;
    const monthB = q(".avatar-top-cards .ric-month b");
    const monthLine = monthB ? parseFloat(getComputedStyle(monthB).fontSize) * 1.15 : 0;
    return {
      stage: rect(q(".poster-stage")),
      natH: scaler.offsetHeight,
      scale: parseFloat(getComputedStyle(scaler).getPropertyValue("--poster-scale")),
      slot: rect(q(".avatar-slot")),
      cards: rect(q(".avatar-top-cards")),
      info: rect(q(".avatar-top-cards .rail-info-card")),
      monthWrapped: monthB ? monthB.getBoundingClientRect().height > monthLine * 1.6 : false,
      ctlInslot: rect(q(".avatar-ctl-inslot")),
      ctlPreview: rect(q(".avatar-ctl-preview")),
      dock: rect(q(".avatar-dock-inner")),
      rail: rect(q(".avatar-side-rail"))
    };
  });
}

test.describe("avatar scene — 방송 화면(1920×1080)", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
        window.localStorage.setItem("vic_avatar_on", "1");
        window.localStorage.setItem("vic_avatar_side", "left");
      } catch {
        /* noop */
      }
    });
  });

  test("시청자 미리보기 scene: 폭 fit + 세로 스택 카드 + 겹침 0 + 360px 열", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1");
    await page.locator(".poster-page.avatar-scene").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    // 폭 기준 fit: stage 높이 = 자연높이 × 배율(높이 fit 없음).
    expect(Math.abs(m.stage!.h - m.natH * m.scale)).toBeLessThan(1);
    expect(m.ctlPreview).not.toBeNull();
    // 오른쪽 칸: 정보 카드가 열 전폭, 달 제목 한 줄.
    expect(Math.abs(m.info!.w - m.cards!.w)).toBeLessThan(1.5);
    expect(m.monthWrapped).toBe(false);
    expect(overlaps(m.cards, m.dock)).toBe(false);
    expect(overlaps(m.slot, m.stage)).toBe(false);
    expect(overlaps(m.rail, m.stage)).toBe(false);
    expect(Math.round(m.slot!.w)).toBe(360);
  });

  test("꾸미기 scene: 토글이 카드와 박스 사이, 겹침 0", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1&mode=decorate");
    await page.locator(".poster-page.avatar-scene").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    expect(Math.abs(m.stage!.h - m.natH * m.scale)).toBeLessThan(1);
    expect(m.ctlInslot).not.toBeNull();
    expect(m.ctlInslot!.y).toBeGreaterThanOrEqual(m.cards!.b);
    expect(m.ctlInslot!.b).toBeLessThanOrEqual(m.dock!.y);
    expect(overlaps(m.ctlInslot, m.cards)).toBe(false);
    expect(overlaps(m.ctlInslot, m.dock)).toBe(false);
  });

  test("고정 scene(fixed=right, /onair 경로): 토글 없이 켜지고 오른쪽", async ({ page }) => {
    await page.goto("/visual-fixture/poster?fixed=right");
    await page.locator(".poster-page.avatar-scene.avatar-right").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    expect(m.ctlPreview).toBeNull();
    expect(m.ctlInslot).toBeNull();
    expect(m.slot).not.toBeNull();
    expect(m.slot!.x).toBeGreaterThan(m.stage!.r);
    expect(Math.abs(m.info!.w - m.cards!.w)).toBeLessThan(1.5);
  });

  test("scene OFF(기본 시청자): 슬롯 없음, 폭 fit", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").waitFor();
    await page.waitForTimeout(500);
    const m = await readScene(page);
    expect(Math.abs(m.stage!.h - m.natH * m.scale)).toBeLessThan(1);
    expect(m.slot).toBeNull();
  });
});
