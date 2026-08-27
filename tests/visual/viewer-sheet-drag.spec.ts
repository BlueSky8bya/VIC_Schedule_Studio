import { expect, test } from "@playwright/test";

// B1(2026-08-27) — 시청자 모바일 일정 상세 시트 '끌어서 닫기' 회귀 게이트.
//  · 그립 존(.agenda-detail-top = 손잡이 줄만, 얇게)이 sticky + touch-action:none, 손잡이(.agenda-detail-grab) 렌더.
//  · 짧게 끌었다 놓으면 열린 채 제자리(인라인 transform 정리), 1/3 넘게 끌면 닫힘, 빠른 플릭도 닫힘.
//  · 모바일엔 X 없음 — 손잡이 탭이 닫기(드래그 뒤 꼬리 click은 삼켜져 복귀 유지). PC 팝오버(anchor)는 X, 그립 없음.
test.describe("viewer sheet — 끌어서 닫기", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
      } catch {
        /* noop */
      }
    });
  });

  async function dragGrab(page: import("@playwright/test").Page, dy: number, steps = 12) {
    const g = await page.locator(".agenda-detail-top").boundingBox();
    if (!g) throw new Error("grip zone missing");
    const x = g.x + g.width / 2;
    const y = g.y + 12;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x, y + (dy * i) / steps);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
  }

  test("모바일: 손잡이·그립 존, 짧은 드래그 복귀 / 긴 드래그 닫힘 / 손잡이 탭 닫힘·X 없음", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/visual-fixture/poster?hearts=1");
    await page.locator(".agenda-event").first().waitFor();
    await page.waitForTimeout(500);

    const open = async () => {
      await page.locator(".agenda-event").first().click();
      await page.locator(".agenda-detail-sheet").waitFor();
      await page.waitForTimeout(300);
    };
    await open();
    const m = await page.evaluate(() => {
      const top = document.querySelector<HTMLElement>(".agenda-detail-top")!;
      const cs = getComputedStyle(top);
      return {
        grab: !!document.querySelector(".agenda-detail-grab span"),
        sticky: cs.position,
        touch: cs.touchAction,
        topH: top.offsetHeight,
        h: document.querySelector<HTMLElement>(".agenda-detail-sheet")!.offsetHeight
      };
    });
    expect(m.grab).toBe(true);
    expect(m.sticky).toBe("sticky");
    expect(m.touch).toBe("none");
    expect(m.topH).toBeLessThanOrEqual(28); // 손잡이 줄만 — X 버튼 높이까지 sticky면 본문을 가린다

    // 짧게(15%) → 열린 채 복귀
    await dragGrab(page, Math.round(m.h * 0.15));
    await page.waitForTimeout(500);
    await expect(page.locator(".agenda-detail-sheet")).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector<HTMLElement>(".agenda-detail-sheet")!.style.transform)).toBe("");

    // 1/3 넘게(50%) → 닫힘
    await dragGrab(page, Math.round(m.h * 0.5));
    await page.locator(".agenda-detail-sheet").waitFor({ state: "detached", timeout: 3000 });

    // 모바일엔 X 없음, 손잡이 탭 = 닫기
    await open();
    await expect(page.locator(".agenda-detail-sheet .agenda-detail-close")).toHaveCount(0);
    await page.locator("button.agenda-detail-grab").click();
    await page.locator(".agenda-detail-sheet").waitFor({ state: "detached", timeout: 3000 });
  });

  test("PC 팝오버: 그립 존·손잡이 없음", async ({ page }) => {
    await page.goto("/visual-fixture/poster?hearts=1");
    await page.locator("[data-export-surface]").waitFor();
    await page.waitForTimeout(400);
    await page.locator(".public-event").first().click();
    await page.locator(".agenda-detail-backdrop.is-pop .agenda-detail-sheet").waitFor();
    const m = await page.evaluate(() => ({
      grab: document.querySelectorAll(".agenda-detail-grab").length,
      top: document.querySelectorAll(".agenda-detail-top").length,
      close: document.querySelectorAll(".agenda-detail-sheet .agenda-detail-close").length
    }));
    expect(m.grab).toBe(0);
    expect(m.top).toBe(0);
    expect(m.close).toBe(1);
  });
});
