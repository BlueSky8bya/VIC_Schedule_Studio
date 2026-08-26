import { expect, test } from "@playwright/test";

// 관심 단계 = 카드 테두리 링(2026-08-27, 불꽃 알약 대체) 회귀 게이트.
//  · 티어 카드마다 .tier-ring 1개, 1위엔 .tier-crown, 옛 .event-popular(불꽃 줄) 0.
//  · 링·👑은 높이 0 — 하트가 있어도 표면 자연 높이가 하트 없을 때와 같다(달력 비율 보호).
//  · 본문(.event-main)이 링 위 층(z-index 1 > 0) — 2색 카드(data-mixed)도 포함.
//  · 범례(웹 2종)·모바일 아젠다 도움말에 견본 4개, 모바일 행에도 링·👑.
test.describe("heart tier — 테두리 링", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
      } catch {
        /* noop */
      }
    });
  });

  test("데스크탑: 링·👑 렌더, 불꽃 줄 없음, 본문이 링 위", async ({ page }) => {
    await page.goto("/visual-fixture/poster?hearts=1");
    await page.locator("[data-export-surface]").waitFor();
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const tiers = Array.from(document.querySelectorAll<HTMLElement>(".public-event[data-tier]"));
      return {
        tiers: tiers.length,
        rings: document.querySelectorAll(".public-event .tier-ring").length,
        crowns: document.querySelectorAll(".public-event .tier-crown").length,
        popular: document.querySelectorAll(".event-popular").length,
        legend: document.querySelectorAll(".legend-tiers .tier-swatch").length,
        layering: tiers.map((c) => ({
          mixed: c.hasAttribute("data-mixed"),
          ringZ: getComputedStyle(c.querySelector(".tier-ring")!).zIndex,
          mainZ: getComputedStyle(c.querySelector(".event-main")!).zIndex
        }))
      };
    });
    expect(m.tiers).toBeGreaterThan(0);
    expect(m.rings).toBe(m.tiers);
    expect(m.crowns).toBeGreaterThanOrEqual(1);
    expect(m.popular).toBe(0);
    expect(m.legend).toBe(4);
    for (const l of m.layering) {
      expect(l.ringZ).toBe("0");
      expect(l.mainZ).toBe("1");
    }
  });

  test("표면 자연 높이: 하트 유무 동일(링은 높이 0)", async ({ page }) => {
    const natural = async (url: string) => {
      await page.goto(url);
      await page.locator("[data-export-surface]").waitFor();
      await page.waitForTimeout(600);
      return page.evaluate(
        () => (document.querySelector("[data-export-surface]") as HTMLElement).offsetHeight
      );
    };
    const base = await natural("/visual-fixture/poster");
    const hearts = await natural("/visual-fixture/poster?hearts=1");
    expect(hearts).toBe(base);
  });

  test.describe("모바일 아젠다", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    test("행 링·👑·도움말 견본, 가로 넘침 없음", async ({ page }) => {
      await page.goto("/visual-fixture/poster?hearts=1");
      await page.locator(".agenda-event").first().waitFor();
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({
        rings: document.querySelectorAll(".agenda-event .tier-ring").length,
        crowns: document.querySelectorAll(".agenda-event .tier-crown").length,
        swatches: document.querySelectorAll(".agenda-tier-help .tier-swatch").length,
        overflowX: document.documentElement.scrollWidth > window.innerWidth
      }));
      expect(m.rings).toBeGreaterThan(0);
      expect(m.crowns).toBeGreaterThanOrEqual(1);
      expect(m.swatches).toBe(4);
      expect(m.overflowX).toBe(false);
    });
  });
});
