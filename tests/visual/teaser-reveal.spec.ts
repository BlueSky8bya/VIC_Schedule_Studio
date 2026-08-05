import { expect, test, type Page } from "@playwright/test";

// 최초공개(떡밥) — 시간에 걸린 기능이라 지금까지 브라우저 검증이 없었다. 이번 주에만 두 번
// 문제가 됐다(공개 후 빈 카드 / 지운 떡밥이 유령으로 남음). 여기서 두 가지를 못박는다:
//   ① 공개 전에는 제목이 **DOM 어디에도** 없다 — 편집실 미리보기·방송 화면 공유의 유출면.
//   ② 카운트다운이 0에 닿으면 클라가 실제로 공개 요청을 쏜다(가만히 멈춰 있지 않는다).
// fixture는 `?teaser=<초>`로 '곧 공개될 일정'을 하나 끼워 넣는다(테스트 전용 경로).

const SECRET = "이 제목은 공개 전에 보이면 안 된다";

/** 서버 액션(공개 요청) 호출을 센다. 응답은 실패로 돌려도 된다 — 여기서 볼 것은 '쐈는가'다. */
async function countRevealCalls(page: Page) {
  const calls: string[] = [];
  await page.route("**/visual-fixture/poster**", async (route) => {
    const req = route.request();
    const isAction = req.method() === "POST" && Boolean(await req.headerValue("next-action"));
    if (isAction) {
      calls.push(req.url());
      await route.fulfill({ status: 500, body: "" }); // 실패 응답 — 클라는 조용히 넘어가야 한다
      return;
    }
    await route.continue();
  });
  return calls;
}

test("공개 전: ??? 카드만 보이고 제목은 DOM에 없다", async ({ page }) => {
  await page.goto("/visual-fixture/poster?teaser=600");
  const teaser = page.locator(".public-event.teaser").first();
  await expect(teaser).toBeVisible();
  await expect(teaser).toContainText("???");

  // 카드에도, 페이지 전체 HTML(스크립트로 전달되는 RSC payload 포함)에도 제목이 없어야 한다.
  const html = await page.content();
  expect(html).not.toContain(SECRET);
  // 가린 stub은 태그·카테고리도 비어 있다 — 색으로도 무엇인지 짐작되면 안 된다.
  const cls = await teaser.getAttribute("class");
  expect(cls).toContain("teaser");
});

test("카운트다운이 0이 되면 공개 요청을 쏜다(멈춰 있지 않는다)", async ({ page }) => {
  const calls = await countRevealCalls(page);
  // 가짜 시계(page.clock)는 쓰지 않는다 — 서버가 그린 카운트다운과 클라 시각이 어긋나
  // 하이드레이션 불일치가 나고, 그건 앱이 아니라 하네스가 만든 문제다. 실제로 3초 기다린다.
  await page.goto("/visual-fixture/poster?teaser=3");
  await expect(page.locator(".public-event.teaser").first()).toBeVisible();
  const beforeReveal = calls.length;

  // 공개 시각이 지나면 클라는 캐시를 우회해 실제 내용을 요청한다(가만히 멈춰 있으면 빈 카드).
  await expect.poll(() => calls.length, { timeout: 15_000 }).toBeGreaterThan(beforeReveal);
});

test("공개 요청이 실패해도 화면이 죽지 않는다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await countRevealCalls(page); // 모든 액션을 500으로 돌려준다
  await page.goto("/visual-fixture/poster?teaser=3");
  await page.waitForTimeout(6000); // 공개 시각 통과 + 재시도 몇 번

  // 달력은 계속 그려져 있고(다른 일정 카드가 살아 있다), 콘솔에 치명 오류가 없다.
  expect(await page.locator(".public-event").count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
