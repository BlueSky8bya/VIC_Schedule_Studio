import { expect, test } from "@playwright/test";

// 공개 포스터(시청자) 표면의 픽셀·지오메트리 기준선. 색·글자 scrim 작업(0B)에서 스티커·칸이
// 조용히 밀리는 걸 이 스냅샷이 잡는다. 표면([data-export-surface])만 찍어 바깥 크롬(계정·라이브
// 비콘)의 흔들림을 배제한다.
//
// 결정성(중요): 두 가지가 흔들면 baseline 대비 전역 diff가 난다 →
//  1) JS rAF 애니메이션(월드컵 공 등) — CSS animations:disabled로는 안 멈춘다. 앱의 '동작 줄이기'
//     토글(localStorage)을 미리 켜서 rAF 루프 자체를 멈춘다.
//  2) `--poster-scale` 측정이 웹폰트 로드 타이밍에 좌우된다 → 폰트가 다 뜬 뒤 resize를 한 번
//     흘려 재측정시키고, 안정될 때까지 기다린 뒤 찍는다.
test.describe("public poster — visual baseline", () => {
  test.beforeEach(async ({ page }) => {
    // 앱 '동작 줄이기'를 켠 상태로 로드(rAF 애니메이션 정지 → 공·반짝임이 고정 포즈).
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("vic.reduceMotion", "on");
      } catch {
        /* storage 불가 환경 무시 */
      }
    });
  });

  test("viewer surface (2026-06) is pixel-stable", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    const surface = page.locator("[data-export-surface]").first();
    await surface.waitFor({ state: "visible" });
    // 웹폰트가 다 뜬 뒤 재측정을 유도(폰트 로드 전 측정된 스케일 고착 방지) → 안정 대기.
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.dispatchEvent(new Event("resize"));
    });
    // 표면 크기가 두 번 연속 같아질 때까지(스케일 정착) 기다린다.
    await page.waitForFunction(
      () => {
        const el = document.querySelector(
          "[data-export-surface]",
        ) as HTMLElement | null;
        if (!el) return false;
        const w = window as unknown as { __ph?: number };
        const h = Math.round(el.getBoundingClientRect().height);
        const stable = w.__ph === h;
        w.__ph = h;
        return stable && h > 0;
      },
      { polling: 200, timeout: 5000 },
    );
    await expect(surface).toHaveScreenshot("viewer-surface-2026-06.png");
  });

  // B안 M4c: 공식 export 표면·공개 포스터에 방송 판서/편집실 확대 UI가 절대 없다는 단언.
  // (판서는 편집실 미리보기 오버레이 전용, 확대 컨트롤은 편집실 전용 — 시청자·export 무흔적.)
  test("export surface has no broadcast/zoom admin UI", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    const surface = page.locator("[data-export-surface]").first();
    await surface.waitFor({ state: "visible" });
    for (const sel of [
      ".broadcast-panel",
      ".bp-toolbar",
      ".cal-zoom-ctl",
      ".cal-zoom-float",
      ".cal-zoom-peek",
    ]) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
    for (const sel of [
      ".studio-topbar",
      ".studio-toolbar",
      ".modal-backdrop",
      ".private-loading",
      ".passcode-box",
      ".tag-editor",
      ".members-panel",
      "[data-private-badge]",
    ]) {
      await expect(surface.locator(sel)).toHaveCount(0);
    }
    await expect(surface).not.toContainText("비공개");
  });
});
