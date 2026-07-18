import { expect, test } from "@playwright/test";

// 지오메트리 하드 게이트(ADR-0004). 색·글자 작업이 '레이아웃'을 바꾸지 않았는지 = 표면 크기·칸·
// 스티커(비율 좌표) 위치가 그대로인지 스냅샷으로 못박는다. 픽셀 스냅샷(poster.spec)과 분리 —
// 픽셀은 '의도한 시각 변화'로 갱신될 수 있지만, 지오메트리는 Δ0가 배포 조건이다.
// baseline 갱신은 '레이아웃을 바꾸는 게 의도된' 변경일 때만.
test.describe("public poster — geometry gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
      } catch {
        /* noop */
      }
    });
  });

  test("surface / cells / stickers layout is unchanged", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    const surface = page.locator("[data-export-surface]").first();
    await surface.waitFor({ state: "visible" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForFunction(
      () => {
        const el = document.querySelector("[data-export-surface]") as HTMLElement | null;
        if (!el) return false;
        const w = window as unknown as { __gh?: number };
        const h = Math.round(el.getBoundingClientRect().height);
        const stable = w.__gh === h;
        w.__gh = h;
        return stable && h > 0;
      },
      { polling: 200, timeout: 5000 }
    );

    const geo = await page.evaluate(() => {
      // transform: scale의 subpixel 잡음을 피하려고 화면 좌표(getBoundingClientRect) 대신 레이아웃
      // 좌표(offsetWidth/Height/Top)만 쓴다 — 정수·transform 무관·run간 안정.
      //
      // 스티커 드리프트의 진짜 원인: 카드/글자 레이아웃이 바뀌어 표면 '자연 높이'가 달라지면, 비율
      // 좌표(yRatio×높이)로 놓인 스티커가 밀린다. 그래서 표면 자연 폭·높이 + 각 날짜칸의 자연 높이
      // (= 행 높이의 원천)를 못박는다. 가로(xRatio×폭)는 폭이 1840 고정이라 불변.
      const surfaceEl = document.querySelector("[data-export-surface]") as HTMLElement;
      const days = Array.from(
        document.querySelectorAll<HTMLElement>("[data-export-surface] .public-day")
      );
      const stickers = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sticker-id]")
      )
        .map((el) => ({
          id: el.getAttribute("data-sticker-id"),
          // 인라인 비율 스타일(데이터 원천) 그대로 — 렌더 측정이 아니라 좌표 자체를 못박는다.
          left: el.style.left,
          top: el.style.top,
          width: el.style.width
        }))
        .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
      return {
        surface: { w: surfaceEl.offsetWidth, h: surfaceEl.offsetHeight },
        dayCount: days.length,
        dayHeights: days.map((d) => d.offsetHeight),
        stickers
      };
    });

    expect(JSON.stringify(geo, null, 2)).toMatchSnapshot("poster-geometry.txt");
  });
});
