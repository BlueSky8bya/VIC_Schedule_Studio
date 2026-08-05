import { expect, test, type Page } from "@playwright/test";

// 일정 2개 이상인 칸에서 카드를 끌 때, '원래 위치'(보라 점선)와 '들어갈 자리'(민트 삽입선)가
// 손에 든 유령 카드에 가려 안 보이던 문제(2026-08-05 사용자 지적)의 회귀 테스트.
//
// 왜 이 조합이 위험한가: 같은 칸 안에서 순서만 바꿀 때는 손이 거의 안 움직인다 → 유령이
// 출발 자리 바로 위에 앉는다. 유령은 body 직속 z-index 9999라 달력 안 안내를 그 위로 올릴 수
// 없다. 그래서 **유령이 비쳐 보여야** 한다(실측: opacity 0.97에서 안내가 통째로 가려졌다).

async function stackTwoInOneCell(page: Page) {
  // 샘플 데이터에는 한 칸에 2개인 날이 없다 — 카드 하나를 다른 카드 위로 끌어 만든다.
  await page.route("**/api/studio-write", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, id: "srv-1" })
    })
  );
  await page.goto("/visual-fixture/studio");
  await page.locator(".studio-event-pill").first().waitFor();
  const p0 = page.locator(".studio-event-pill").nth(0);
  const p1 = page.locator(".studio-event-pill").nth(1);
  const a = (await p0.boundingBox())!;
  const b = (await p1.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 4, { steps: 20 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("[data-act='calendar-cell']")].filter(
            (c) => c.querySelectorAll(".studio-event-pill").length > 1
          ).length
      )
    )
    .toBeGreaterThan(0);
}

test("여러 개 있는 칸에서 끌 때 안내(원래 위치·삽입선)가 유령에 안 가린다", async ({ page }) => {
  await stackTwoInOneCell(page);

  const cellIdx = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-act='calendar-cell']")].findIndex(
        (c) => c.querySelectorAll(".studio-event-pill").length > 1
      )
  );
  const cell = page.locator("[data-act='calendar-cell']").nth(cellIdx);
  const pill = cell.locator(".studio-event-pill").first();
  const a = (await pill.boundingBox())!;

  // 같은 칸 안에서 아래로 조금만 끈다(순서 바꾸기) — 유령이 출발 자리에 겹치는 최악의 상황.
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 6, a.y + a.height / 2 + 30, { steps: 10 });
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 55, { steps: 10 });

  const state = await page.evaluate(() => {
    const rect = (el: Element | null) => (el ? el.getBoundingClientRect().toJSON() : null);
    const ghostEl = document.querySelector<HTMLElement>(".event-drag-ghost");
    return {
      ghost: rect(ghostEl),
      ghostOpacity: ghostEl ? Number(getComputedStyle(ghostEl).opacity) : null,
      src: rect(document.querySelector(".studio-event-pill.dragging-src")),
      line: rect(document.querySelector(".drop-insert-line"))
    };
  });
  await page.mouse.up();

  // 안내가 실제로 그려져 있다.
  expect(state.src, "출발 자리 표시가 없다").toBeTruthy();
  expect(state.line, "삽입선이 없다").toBeTruthy();

  // 유령이 안내 위에 겹쳐 있고(이 상황이 바로 문제였던 자리), 그럼에도 비쳐 보여야 한다.
  const overlaps = (a2: DOMRect | null, b2: DOMRect | null) =>
    Boolean(
      a2 &&
        b2 &&
        a2.left < b2.right &&
        a2.right > b2.left &&
        a2.top < b2.bottom &&
        a2.bottom > b2.top
    );
  const covered =
    overlaps(state.ghost as DOMRect, state.src as DOMRect) ||
    overlaps(state.ghost as DOMRect, state.line as DOMRect);
  if (covered) {
    expect(
      state.ghostOpacity ?? 1,
      "유령이 안내를 덮는데 불투명하다 — 안내가 안 보인다"
    ).toBeLessThanOrEqual(0.7);
  }
});

test("유령 카드는 항상 반투명하다(안내를 가리지 않기 위한 계약)", async ({ page }) => {
  await page.route("**/api/studio-write", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  );
  await page.goto("/visual-fixture/studio");
  const pill = page.locator(".studio-event-pill").first();
  const a = (await pill.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 40, { steps: 10 });
  const opacity = await page.evaluate(() => {
    const g = document.querySelector<HTMLElement>(".event-drag-ghost");
    return g ? Number(getComputedStyle(g).opacity) : null;
  });
  await page.mouse.up();
  expect(opacity).not.toBeNull();
  expect(opacity!).toBeLessThanOrEqual(0.7);
  expect(opacity!, "너무 투명하면 무엇을 들고 있는지 안 보인다").toBeGreaterThanOrEqual(0.35);
});
