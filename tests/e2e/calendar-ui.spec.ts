import { expect, test } from "@playwright/test";

test("root requires Google authentication before role-based routing", async ({
  page
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Google 계정으로 먼저 로그인해 주세요" })
  ).toBeVisible();
  await expect(page.getByText("Owner", { exact: true })).toBeVisible();
  await expect(page.getByText("매니저 / 작업자")).toBeVisible();
  await expect(page.getByText("일반 시청자", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 로그인" })).toBeVisible();
});

test("studio supports month navigation but blocks unauthenticated editing", async ({
  page
}) => {
  await page.goto("/studio");

  await expect(page.getByRole("heading", { name: "빅토리 월간 일정표" })).toBeVisible();
  await page.getByTitle("다음 달").click();
  await expect(page.getByText("26.07")).toBeVisible();
  await page.getByRole("button", { name: "15" }).click();
  await expect(page.getByText("viewer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
});
