import { expect, test, type Page } from "@playwright/test";

// 드래그 중 자리 안내 계약(2026-08-05 사용자 결정 A안):
//   · 보라 '원래 위치' = 출발점. 드래그 내내 **그 자리 고정**.
//   · 민트 '놓을 자리' = 도착점. 커서 따라 카드 사이를 **오르내린다**(실제 자리를 여는 스페이서).
//   · 손에 든 유령 카드는 **불투명**(투명하게 만들지 않는다 — 가림은 안내 이동으로 푼다).
// 앞선 시도들이 여기서 한 번씩 어긋났다: ① 유령이 안내를 덮음 ② 출발 표시를 없애고 그걸
// 움직여 버림. 셋을 한 파일에 못박아 다시 흔들리지 않게 한다.

async function stackTwoInOneCell(page: Page) {
  // 샘플에는 한 칸에 2개인 날이 없다 — 카드 하나를 다른 카드 위로 끌어 만든다(서버는 가로챈다).
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
  return page.evaluate(
    () =>
      [...document.querySelectorAll("[data-act='calendar-cell']")].findIndex(
        (c) => c.querySelectorAll(".studio-event-pill").length > 1
      )
  );
}

/** 드래그 중 화면 상태: 출발 표시(보라)·도착 표시(민트)·유령. */
function dragState(page: Page) {
  return page.evaluate(() => {
    const top = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().top) : null);
    const src = document.querySelector<HTMLElement>(".studio-event-pill.dragging-src");
    // 드래그 중에는 후보 자리마다 접힌 스페이서가 깔려 있다 — **열린 것**(.on)이 지금 놓일 자리다.
    const gap = document.querySelector<HTMLElement>(".drop-gap.on");
    const ghost = document.querySelector<HTMLElement>(".event-drag-ghost");
    return {
      srcTop: top(src),
      srcLabel: src ? getComputedStyle(src, "::after").content : null,
      gapTop: top(gap),
      gapLabel: gap ? getComputedStyle(gap, "::after").content : null,
      gapCell: gap?.closest("[data-act='calendar-cell']")?.getAttribute("data-date") ?? null,
      ghostOpacity: ghost ? Number(getComputedStyle(ghost).opacity) : null
    };
  });
}

test("같은 칸: 보라 '원래 위치'는 고정, 민트 '놓을 자리'가 오르내린다", async ({ page }) => {
  const cellIdx = await stackTwoInOneCell(page);
  const cell = page.locator("[data-act='calendar-cell']").nth(cellIdx);
  const pill = cell.locator(".studio-event-pill").first();
  const other = cell.locator(".studio-event-pill").nth(1);
  const a = (await pill.boundingBox())!;
  const cx = a.x + a.width / 2;

  await page.mouse.move(cx, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(cx + 6, a.y + a.height / 2 + 10, { steps: 8 });
  const first = await dragState(page);
  expect(first.srcTop, "출발 표시가 없다").not.toBeNull();
  expect(first.srcLabel ?? "").toContain("원래 위치");
  // 원래 있던 그 자리를 가리키는 동안에는 도착 표시를 열지 않는다 — 같은 공간을 두 표시가
  // 겹쳐 가리키면 뭘 하려는지 오히려 흐려진다(사용자 결정).
  expect(first.gapTop, "같은 자리인데 도착 표시가 떴다").toBeNull();

  // 아래 카드 밑까지 끈다 → 그제서야 도착 표시가 열린다.
  // 좌표는 **드래그가 시작된 뒤** 다시 잰다 — 형제 카드가 이미 움직였을 수 있다.
  const bLive = (await other.boundingBox())!;
  await page.mouse.move(cx + 6, bLive.y + bLive.height + 12, { steps: 14 });
  await expect
    .poll(async () => (await dragState(page)).gapTop ?? -1, { timeout: 4000 })
    .toBeGreaterThan((first.srcTop ?? 0) + 10);

  const low = await dragState(page);
  expect(low.gapLabel ?? "", "도착 표시에 이름이 없다").toContain("놓을 자리");
  // 출발 표시는 그대로 그 자리에 있다(없애지 않는다 — 사용자 지적).
  expect(low.srcTop).toBe(first.srcTop);
  expect(low.srcLabel ?? "").toContain("원래 위치");

  // 다시 원래 자리로 돌아오면 도착 표시가 닫힌다(원래 위치만 남는다).
  await page.mouse.move(cx + 6, a.y + 6, { steps: 14 });
  await expect
    .poll(async () => (await dragState(page)).gapTop, { timeout: 4000 })
    .toBeNull();
  const up = await dragState(page);
  expect(up.srcTop, "출발 표시가 움직였다").toBe(first.srcTop);
  await page.mouse.up();
});

test("다른 칸으로 끌면 그 칸에 도착 표시가 열리고 출발 표시는 남는다", async ({ page }) => {
  const cellIdx = await stackTwoInOneCell(page);
  const cell = page.locator("[data-act='calendar-cell']").nth(cellIdx);
  const pill = cell.locator(".studio-event-pill").first();
  const a = (await pill.boundingBox())!;
  const other = page.locator("[data-act='calendar-cell']").nth(cellIdx + 2);
  const b = (await other.boundingBox())!;

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  const s = await dragState(page);
  await page.mouse.up();

  expect(s.gapTop, "대상 칸에 자리가 안 열렸다").not.toBeNull();
  expect(s.gapLabel ?? "").toContain("놓을 자리");
  expect(s.srcTop, "출발 표시가 사라졌다").not.toBeNull();
  expect(s.srcLabel ?? "").toContain("원래 위치");
});

test("유령 카드는 카드처럼 불투명하다 — 가림은 안내 이동으로 푼다", async ({ page }) => {
  const cellIdx = await stackTwoInOneCell(page);
  const pill = page
    .locator("[data-act='calendar-cell']")
    .nth(cellIdx)
    .locator(".studio-event-pill")
    .first();
  const a = (await pill.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 40, { steps: 10 });
  const s = await dragState(page);
  await page.mouse.up();
  expect(s.ghostOpacity ?? 0).toBeGreaterThanOrEqual(0.85);
});

test("자리가 열릴 때 툭 끊기지 않고 이어진다(중간 높이가 실제로 지나간다)", async ({ page }) => {
  // '부드럽다'를 눈이 아니라 숫자로 본다: 삽입 위치가 바뀐 직후 열리는 자리의 높이를 촘촘히
  // 샘플링해, 0과 최종 높이 사이의 **중간값**이 실제로 관측되는지 확인한다.
  // (예전 구현은 요소가 사라졌다 새로 생겨 0 → H로 즉시 점프했다.)
  const cellIdx = await stackTwoInOneCell(page);
  const cell = page.locator("[data-act='calendar-cell']").nth(cellIdx);
  const pill = cell.locator(".studio-event-pill").first();
  const other = cell.locator(".studio-event-pill").nth(1);
  const a = (await pill.boundingBox())!;
  const cx = a.x + a.width / 2;

  await page.mouse.move(cx, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(cx + 6, a.y + a.height / 2 + 10, { steps: 8 });
  const bLive = (await other.boundingBox())!;

  // 아래로 넘긴 직후부터 높이를 촘촘히 잰다.
  const samples: number[] = [];
  await page.mouse.move(cx + 6, bLive.y + bLive.height + 12, { steps: 4 });
  for (let i = 0; i < 14; i += 1) {
    samples.push(
      await page.evaluate(() => {
        // 드래그 중엔 모든 칸에 접힌 스페이서가 깔려 있다 — 지금 '열리고 있는' 것 = 가장 높은 것.
        const hs = [...document.querySelectorAll<HTMLElement>(".drop-gap")].map((e) =>
          Math.round(e.getBoundingClientRect().height)
        );
        return hs.length > 0 ? Math.max(...hs) : -1;
      })
    );
    await page.waitForTimeout(20);
  }
  await page.mouse.up();

  const max = Math.max(...samples);
  expect(max, "자리가 아예 안 열렸다").toBeGreaterThan(20);
  // 0과 최종 높이 사이 값이 한 번이라도 관측돼야 '전환'이다.
  const mid = samples.filter((h) => h > 2 && h < max - 2);
  expect(mid.length, `높이가 즉시 점프했다: ${samples.join(",")}`).toBeGreaterThan(0);
});
