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
        layering: tiers.map((c) => {
          const ring = c.querySelector<HTMLElement>(".tier-ring")!;
          const crown = c.querySelector<HTMLElement>(".tier-crown");
          return {
            mixed: c.hasAttribute("data-mixed"),
            ringZ: getComputedStyle(ring).zIndex,
            ringPos: getComputedStyle(ring).position,
            // 링은 카드 박스와 일치(흐름 안으로 밀려 바닥 띠가 되면 높이 0이 아니다)
            ringH: ring.offsetHeight,
            cardH: c.offsetHeight,
            crownPos: crown ? getComputedStyle(crown).position : null,
            mainZ: getComputedStyle(c.querySelector(".event-main")!).zIndex
          };
        })
      };
    });
    expect(m.tiers).toBeGreaterThan(0);
    expect(m.rings).toBe(m.tiers);
    expect(m.crowns).toBeGreaterThanOrEqual(1);
    expect(m.popular).toBe(0);
    expect(m.legend).toBe(4);
    // 2색 카드(data-mixed)의 자식 position:relative 규칙에 링·👑이 끌려가면 안 된다(사용자 리포트:
    // 링이 카드 바닥 금색 띠, 👑이 왼쪽 아래로 밀림).
    expect(m.layering.some((l) => l.mixed)).toBe(true);
    for (const l of m.layering) {
      expect(l.ringZ).toBe("0");
      expect(l.ringPos).toBe("absolute");
      // inset:0 = 카드 padding box(카드 자체 1px 테두리 안쪽) → 높이 차 = 테두리 2px까지 정상
      expect(Math.abs(l.ringH - l.cardH)).toBeLessThanOrEqual(2);
      if (l.crownPos) expect(l.crownPos).toBe("absolute");
      expect(l.mainZ).toBe("1");
    }
  });

  test("상세 팝오버에 관심 단계 라벨(글자)이 뜬다 — 단계마다 다른 텍스트", async ({ page }) => {
    await page.goto("/visual-fixture/poster?hearts=1");
    await page.locator("[data-export-surface]").waitFor();
    await page.waitForTimeout(600);
    const seen: Record<string, string> = {};
    for (const key of ["warm", "hot", "blaze", "top"]) {
      const card = page.locator(`.public-event[data-tier="${key}"]`).first();
      await card.click();
      const line = page.locator(".agenda-detail-sheet .agenda-detail-tier");
      await line.waitFor();
      seen[key] = (await line.locator("b").textContent()) ?? "";
      await expect(line).toHaveClass(new RegExp(`tier-${key}`));
      await page.keyboard.press("Escape");
      await page.locator(".agenda-detail-sheet").waitFor({ state: "detached" });
    }
    expect(seen).toEqual({ warm: "관심", hot: "높은 관심", blaze: "폭발적 관심", top: "최고 인기" });
    // 티어 없는 카드엔 줄이 없다
    await page.locator(".public-event:not([data-tier])").first().click();
    await page.locator(".agenda-detail-sheet").waitFor();
    await expect(page.locator(".agenda-detail-sheet .agenda-detail-tier")).toHaveCount(0);
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
