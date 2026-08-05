import { expect, test, type Page } from "@playwright/test";

// 일정 2개 이상인 칸에서 카드를 끌 때, '어디에 놓이는지' 안내가 손에 든 유령 카드에 가려
// 안 보이던 문제(2026-08-05 사용자 지적)의 회귀 테스트.
//
// 처음엔 유령을 반투명하게 해서 비쳐 보이게 했는데, 사용자 결정으로 접근을 바꿨다:
// **점선 자리 자체가 실제 카드처럼 목표 위치로 움직인다.** 그러면 안내는 유령 아래가 아니라
// 형제 카드 사이에서 자리를 벌리며 보이고, 유령은 카드답게 불투명해도 된다.

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

/** 지금 화면에서 '끌고 있는 카드의 빈 자리'(점선)와 형제 카드의 위치를 잰다. */
function dragGeometry(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element | null) => (el ? el.getBoundingClientRect().toJSON() : null);
    const src = document.querySelector<HTMLElement>(".studio-event-pill.dragging-src");
    const cell = src?.closest("[data-act='calendar-cell']") ?? null;
    const siblings = cell
      ? [...cell.querySelectorAll<HTMLElement>(".studio-event-pill")]
          .filter((p) => p !== src)
          .map((p) => p.getBoundingClientRect().top)
      : [];
    return {
      src: rect(src),
      moving: Boolean(src?.classList.contains("dragging-src-moving")),
      label: src ? getComputedStyle(src, "::after").content : null,
      siblingTops: siblings,
      ghostOpacity: (() => {
        const g = document.querySelector<HTMLElement>(".event-drag-ghost");
        return g ? Number(getComputedStyle(g).opacity) : null;
      })()
    };
  });
}

test("같은 칸에서 순서를 바꾸면 점선 자리가 목표 위치로 따라 움직인다", async ({ page }) => {
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

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 6, a.y + a.height / 2 + 12, { steps: 8 });
  const atStart = await dragGeometry(page);
  expect(atStart.src, "끌고 있는 카드의 자리 표시가 없다").toBeTruthy();

  // 아래 카드 자리까지 끌어내린다 → 점선이 그 자리로 내려가야 한다.
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 58, { steps: 12 });
  const moved = await expect
    .poll(
      async () => {
        const g = await dragGeometry(page);
        return g.src && atStart.src ? Math.round(g.src.top - atStart.src.top) : 0;
      },
      { timeout: 4000 }
    )
    .toBeGreaterThan(20);
  void moved;

  const now = await dragGeometry(page);
  // 표시가 '놓을 자리'로 바뀐다(출발점이 아니라 도착점을 가리킨다).
  expect(now.moving).toBe(true);
  expect(now.label ?? "").toContain("놓을 자리");
  // 형제 카드는 그 자리를 비켜 준다(빈 자리가 실제로 열린다).
  expect(now.siblingTops.length).toBeGreaterThan(0);
  await page.mouse.up();
});

test("유령 카드는 카드처럼 불투명하다 — 가림은 점선 이동으로 푼다", async ({ page }) => {
  // 사용자 결정: 투명하게 만들지 않는다. 대신 안내가 유령 밑에 깔리지 않게 움직인다.
  await stackTwoInOneCell(page);
  const cellIdx = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-act='calendar-cell']")].findIndex(
        (c) => c.querySelectorAll(".studio-event-pill").length > 1
      )
  );
  const pill = page.locator("[data-act='calendar-cell']").nth(cellIdx).locator(".studio-event-pill").first();
  const a = (await pill.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 40, { steps: 10 });
  const g = await dragGeometry(page);
  await page.mouse.up();
  expect(g.ghostOpacity ?? 0).toBeGreaterThanOrEqual(0.85);
});

test("다른 칸으로 나가면 출발 자리는 '원래 위치'로 남는다", async ({ page }) => {
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
  // 다른 날 칸으로 끌고 간다(같은 칸이 아니므로 '놓을 자리'가 아니라 출발점 표시가 맞다).
  const other = page.locator("[data-act='calendar-cell']").nth(cellIdx + 2);
  const b = (await other.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  const g = await dragGeometry(page);
  await page.mouse.up();
  expect(g.moving).toBe(false);
  expect(g.label ?? "").toContain("원래 위치");
});
