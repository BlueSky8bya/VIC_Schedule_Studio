import { expect, test, type Page } from "@playwright/test";

// 모바일에서 화면 위로 뜨는 것들이 **화면 안에** 들어오는지. 2026-08-05 실측: 삭제 스낵바
// ('실행 취소')가 390px 화면에서 오른쪽으로 넘쳐 잘렸다. 원인은 등장 애니메이션의 transform이
// 가운데 정렬(translateX(-50%))을 덮어쓴 것 — CSS 계약은 tests/unit/centering-vs-animation.test.ts가
// 지키고, 여기서는 실제 브라우저에서 좌표로 확인한다.

test.use({ viewport: { width: 390, height: 844 } });

async function openMobileStudio(page: Page) {
  await page.route("**/api/studio-write", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, id: "srv-1" })
    })
  );
  await page.goto("/visual-fixture/studio");
  await page.locator("[data-act='agenda-event']").first().waitFor();
}

test("삭제 스낵바가 좁은 화면에서 안 잘린다", async ({ page }) => {
  await openMobileStudio(page);
  await page.locator("[data-act='agenda-event']").first().click();
  await page.locator("[data-act='이 일정 삭제']").click();

  const snack = page.locator(".delete-snack");
  await snack.waitFor();
  const geo = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".delete-snack")!;
    const r = el.getBoundingClientRect();
    // position:fixed의 기준(containing block)은 뷰포트가 아닐 수 있다 — filter/transform이
    // 걸린 조상이 있으면 그 조상이 기준이 된다(이 앱은 눈편한테마 filter를 body에 건다).
    // 중앙 정렬은 그 기준 안에서 판정해야 한다. 잘림 여부는 눈에 보이는 폭으로 본다.
    let cb: HTMLElement = document.documentElement;
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (
        (cs.transform && cs.transform !== "none") ||
        (cs.filter && cs.filter !== "none") ||
        (cs.backdropFilter && cs.backdropFilter !== "none") ||
        cs.contain === "paint" ||
        cs.willChange.includes("transform")
      ) {
        cb = a;
        break;
      }
    }
    const cbRect = cb.getBoundingClientRect();
    const docW = window.innerWidth;
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      docW,
      bottom: Math.round(r.bottom),
      viewH: window.innerHeight,
      cbLeft: Math.round(cbRect.left),
      cbRight: Math.round(cbRect.right)
    };
  });

  expect(geo.left, "왼쪽이 화면 밖").toBeGreaterThanOrEqual(0);
  expect(geo.right, "오른쪽이 잘림").toBeLessThanOrEqual(geo.docW);
  expect(geo.bottom, "아래가 잘림").toBeLessThanOrEqual(geo.viewH);
  // 가운데 정렬 — 기준 블록 안에서 좌우 여백이 같아야 한다(애니메이션이 정렬을 덮으면 깨진다).
  const leftGap = geo.left - geo.cbLeft;
  const rightGap = geo.cbRight - geo.right;
  expect(Math.abs(leftGap - rightGap), `가운데가 아님(좌 ${leftGap} / 우 ${rightGap})`).toBeLessThanOrEqual(4);

  // 버튼도 온전히 눌러진다(라벨이 잘려 나가지 않았다).
  const undo = page.locator("[data-act='delete-snack-undo']");
  await expect(undo).toBeVisible();
  await expect(undo).toContainText("실행 취소");
  const ub = (await undo.boundingBox())!;
  expect(Math.round(ub.x + ub.width)).toBeLessThanOrEqual(geo.docW);
});

test("긴 제목이어도 스낵바가 화면을 안 넘는다", async ({ page }) => {
  await openMobileStudio(page);
  // 제목을 아주 길게 바꾼 뒤 삭제 — 폭 상한(max-width)이 실제로 먹는지 본다.
  await page.locator("[data-act='agenda-event']").first().click();
  const title = page.locator("textarea, input[type='text']").first();
  await title.fill("아주아주 긴 제목 ".repeat(8));
  await page.locator("[data-act='이 일정 삭제']").click();

  await page.locator(".delete-snack").waitFor();
  const geo = await page.evaluate(() => {
    const r = document.querySelector<HTMLElement>(".delete-snack")!.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      docW: window.innerWidth
    };
  });
  expect(geo.left).toBeGreaterThanOrEqual(0);
  expect(geo.right).toBeLessThanOrEqual(geo.docW);
});
