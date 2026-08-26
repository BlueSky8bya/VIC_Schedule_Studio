import { expect, test } from "@playwright/test";

// 아바타 scene "한눈에"(2026-08-27) 회귀 게이트 — 방송 화면(OBS 1920×1080 브라우저 소스) 기준.
//  · 시청자 미리보기 scene: 달력이 폭·높이 둘 다에 맞아 한 화면(스크롤 0), 영역 세로 중앙(dy>0 가능).
//  · 오른쪽 칸: 정보 카드가 열 전폭(세로 스택) — 달 제목 줄바꿈 0. 카드↔점선 박스 겹침 0.
//  · 꾸미기 scene: 높이 fit 하지 않음(툴바 크롬이 커서 달력이 짓눌린다) + 토글이 슬롯 안 흐름
//    (카드 아래·박스 위)에 있고 어느 것과도 겹치지 않는다.
//  · scene OFF(기본 시청자): 폭 fit + stage 높이 = 자연높이×배율, dy 0 (예전 그대로).
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
    const scaler = q(".poster-scaler");
    const monthB = q(".avatar-top-cards .ric-month b");
    const monthLine = monthB ? parseFloat(getComputedStyle(monthB).fontSize) * 1.15 : 0;
    return {
      innerH: window.innerHeight,
      scrollH: document.documentElement.scrollHeight,
      stage: rect(q(".poster-stage")),
      surface: rect(q("[data-export-surface]")),
      natH: scaler?.offsetHeight ?? 0,
      scale: parseFloat(getComputedStyle(scaler!).getPropertyValue("--poster-scale")),
      dy: parseFloat(getComputedStyle(scaler!).getPropertyValue("--poster-dy")) || 0,
      slot: rect(q(".avatar-slot")),
      cards: rect(q(".avatar-top-cards")),
      info: rect(q(".avatar-top-cards .rail-info-card")),
      monthWrapped: monthB ? monthB.getBoundingClientRect().height > monthLine * 1.6 : false,
      ctl: rect(q(".avatar-ctl-inslot")),
      dock: rect(q(".avatar-dock-inner")),
      rail: rect(q(".avatar-side-rail"))
    };
  });
}

test.describe("avatar scene — 한눈에(OBS 1920×1080)", () => {
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

  test("시청자 미리보기 scene: 한 화면 + 세로 스택 카드 + 겹침 0", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1");
    await page.locator(".poster-page.avatar-scene").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    expect(m.stage!.b).toBeLessThanOrEqual(m.innerH);
    expect(m.surface!.b).toBeLessThanOrEqual(m.innerH + 1);
    expect(m.scrollH).toBeLessThanOrEqual(m.innerH + 1);
    // 높이 fit: stage가 가용 높이를 차지하고 달력은 그 안에서 세로 중앙.
    expect(m.stage!.h).toBeGreaterThan(m.natH * m.scale - 1);
    expect(m.dy).toBeGreaterThanOrEqual(0);
    expect(Math.abs(m.surface!.y - (m.stage!.y + m.dy))).toBeLessThan(2);
    // 오른쪽 칸: 정보 카드가 열 전폭, 달 제목 한 줄.
    expect(Math.abs(m.info!.w - m.cards!.w)).toBeLessThan(1.5);
    expect(m.monthWrapped).toBe(false);
    expect(overlaps(m.cards, m.dock)).toBe(false);
    expect(overlaps(m.slot, m.stage)).toBe(false);
    expect(overlaps(m.rail, m.stage)).toBe(false);
    // 아바타 열은 1920에서 정확히 360px(고정 컴포지션).
    expect(Math.round(m.slot!.w)).toBe(360);
  });

  test("꾸미기 scene: 높이 fit 없음 + 토글이 카드와 박스 사이", async ({ page }) => {
    await page.goto("/visual-fixture/poster?avatar=1&mode=decorate");
    await page.locator(".poster-page.avatar-scene").waitFor();
    await page.waitForTimeout(700);
    const m = await readScene(page);
    expect(m.dy).toBe(0);
    expect(Math.abs(m.stage!.h - m.natH * m.scale)).toBeLessThan(1);
    expect(m.ctl).not.toBeNull();
    expect(m.ctl!.y).toBeGreaterThanOrEqual(m.cards!.b);
    expect(m.ctl!.b).toBeLessThanOrEqual(m.dock!.y);
    expect(overlaps(m.ctl, m.cards)).toBe(false);
    expect(overlaps(m.ctl, m.dock)).toBe(false);
  });

  test("scene OFF(기본 시청자): 폭 fit 그대로, dy 0", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    await page.locator("[data-export-surface]").waitFor();
    await page.waitForTimeout(500);
    const m = await readScene(page);
    expect(m.dy).toBe(0);
    expect(Math.abs(m.stage!.h - m.natH * m.scale)).toBeLessThan(1);
    expect(m.slot).toBeNull();
  });
});
