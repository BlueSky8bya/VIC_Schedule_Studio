import { expect, test } from "@playwright/test";

// 시청자 검색(PLAN-20260918-023) — 비로그인 화면에서의 계약.
// 데이터는 실제 공개 DB(다시보기·팬 타임라인은 늘 있다). 일정 적중은 달에 따라 없을 수 있어 조건부.

test("public search API returns only public DTO fields and honours the 2-char floor", async ({ request }) => {
  const short = await request.get("/api/public/vic/search?q=%E3%85%8B");
  expect(short.ok()).toBe(true);
  expect((await short.json()).hits).toEqual([]);

  const res = await request.get("/api/public/vic/search?q=%EC%97%94%EB%94%A9&limit=20");
  expect(res.ok()).toBe(true);
  expect(res.headers()["cache-control"]).toContain("s-maxage");
  const json = (await res.json()) as { hits: { kind: string; dateKey: string }[] };
  expect(json.hits.length).toBeGreaterThan(0);
  const payload = JSON.stringify(json).toLowerCase();
  for (const banned of ['"private', '"embargo', '"work', '"codename', '"editor', '"request', '"secret']) {
    expect(payload).not.toContain(banned);
  }
});

test.describe("desktop search sheet", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "PC 머리줄 알약 전용");

  test("header pill replaces 내 관심, results group by day, chapter opens /replay?t=", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".public-calendar-header .interest-toggle")).toHaveCount(0);
    await page.click(".public-calendar-header .search-open");
    await page.fill(".ps-field input", "엔딩");
    await expect(page.locator(".ps-day").first()).toBeVisible();
    await expect(page.locator(".ps-row mark").first()).toHaveText("엔딩");
    const chapter = page.locator(".ps-chapter").first();
    await expect(chapter).toBeVisible();
    await chapter.click();
    await page.waitForURL(/\/replay\/\d{4}-\d{2}-\d{2}\?(part=\d+&)?t=\d+/, { timeout: 20_000 });
    await expect(page.locator(".replay-page")).toBeVisible();
  });

  test("slash opens the sheet, Escape closes it, event hit moves the month and flashes the cell", async ({ page }) => {
    await page.goto("/");
    // 하이드레이션 전엔 키 리스너가 없다 — 알약이 그려진 뒤 누른다.
    await expect(page.locator(".public-calendar-header .search-open")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("/");
    await expect(page.locator(".ps-sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".ps-sheet")).toHaveCount(0);

    await page.keyboard.press("/");
    await page.fill(".ps-field input", "마크");
    await expect(page.locator(".ps-row").first()).toBeVisible();
    const ev = page.locator(".ps-event").first();
    if ((await ev.count()) === 0) test.skip(true, "이 검색어에 일정 적중이 없음");
    await ev.click();
    await expect(page.locator(".public-day.cell-flash")).toHaveCount(1, { timeout: 3000 });
    await expect(page.locator(".ps-sheet")).toHaveCount(0);
  });
});

test.describe("mobile search chip", () => {
  test.skip(({ isMobile }) => !isMobile, "모바일 아젠다 전용");

  test("bottom pill 검색 (old 관심 slot) opens the same sheet", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".search-open")).toHaveCount(0);
    await page.click("[data-act=\"mb-search\"]");
    await page.fill(".ps-field input", "마크");
    await expect(page.locator(".ps-row").first()).toBeVisible();
  });
});
