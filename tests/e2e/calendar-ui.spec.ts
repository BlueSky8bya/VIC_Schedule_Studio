import { expect, test } from "@playwright/test";

test("root auto-routes unauthenticated visitors to Google login", async ({
  page
}) => {
  // 루트는 모두 로그인 진입 — Supabase 설정 시 자동으로 Google OAuth로 넘어간다.
  await page.goto("/");
  await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 });
  expect(page.url()).toContain("accounts.google.com");
});

test("studio renders read-only for unauthenticated viewers", async ({
  page
}) => {
  await page.goto("/studio");

  await expect(page.getByRole("heading", { name: "빅토리 일정표" })).toBeVisible();

  // 비로그인 시청자 경계: 편집 불가 단서가 보여야 한다. ('비공개 일정 보기' 토글은 2026-08-27 철수.)
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "비공개 일정 보기" })).toHaveCount(0);

  // 비공개 레이어 경고는 절대 노출되면 안 된다.
  await expect(
    page.getByText("비공개 레이어 표시 중입니다", { exact: false })
  ).toHaveCount(0);

  // 월 이동 버튼이 동작한다(값 하드코딩 없이 — 날짜에 의존하지 않게).
  await expect(page.getByRole("button", { name: "다음 달" })).toBeEnabled();
  await page.getByRole("button", { name: "다음 달" }).click();
});
