import { expect, test, type Page } from "@playwright/test";

/**
 * 반응형 레이아웃 가드 (로그인 불필요 표면만).
 *
 * 사진 비교가 아니라 "측정값 검사"다 — 폰트·OS가 달라도 안정적으로 돌아가고,
 * "한 화면 고치다 다른 비율이 깨지는" 사고(가로 스크롤바, 버튼이 화면 밖으로 밀림)를
 * 자동으로 잡는다. zoom 제거(Phase 4)처럼 위험한 작업 전후로 이 가드가 회귀를 막아준다.
 *
 * 인증이 필요한 표면(실제 포스터·꾸미기·비공개 레이어)은 여기서 다루지 않는다.
 * "/"는 Supabase 설정 시 자동으로 Google 로그인으로 넘어가 헤드리스로 못 잡으므로 제외.
 * 로그인 없이 도달 가능한 핵심 표면은 "/studio"(읽기전용 스튜디오 셸) — zoom(Phase 4)이
 * 건드릴 바로 그 달력 화면이라 회귀 가드로 가장 가치 있다.
 */

// 보고서(responsive-design-audit-report.md §6)의 viewport 세트.
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "laptop-short", width: 1366, height: 768 },
  { name: "fhd", width: 1920, height: 1080 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "ultrawide", width: 3440, height: 1440 }
] as const;

// 가로 스크롤바(=가로 오버플로)가 없어야 한다. 1px 반올림 오차는 허용.
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "가로 오버플로(스크롤바)").toBeLessThanOrEqual(1);
}

test.describe("읽기전용 스튜디오 셸 (/studio)", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}x${vp.height}: 가로 오버플로 없음 + 달력 노출 + 비공개 미노출`, async ({
      page
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/studio");

      // 달력(스튜디오 셸)이 떠야 한다.
      await expect(
        page.getByRole("heading", { name: "빅토리 일정표" })
      ).toBeVisible();

      // 보안 경계: 인증 안 된 시청자에겐 비공개 레이어 경고가 절대 보이면 안 된다.
      await expect(
        page.getByText("비공개 레이어 표시 중입니다", { exact: false })
      ).toHaveCount(0);

      await expectNoHorizontalOverflow(page);
    });
  }
});
