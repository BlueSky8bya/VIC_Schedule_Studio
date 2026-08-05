import { expect, test, type Page } from "@playwright/test";

// 일정 그림판의 지우개·채우기 실물 검증(브라우저에서 실제로 그리고 지우고 고른다).
// 2026-08-05 사용자 지적 두 건을 회귀로 고정한다:
//   ① "지운 게 왜 선택되냐 / 지운 건 아예 없는 걸로 해야지" — 예전엔 지우개가 destination-out
//      **획으로 장면에 남아** 화면에서만 가렸다. 그 획을 선택하면 '지우개 위로' 올려지면서
//      지운 부분이 그 자리에서 되살아났다(실측: 선택 직후 alpha 0 → 255).
//   ② "선택할 때 채우기가 겹쳐 적용된다" — 채우기가 '찍은 점'만 남기고 재생마다 다시 번졌다.
// fixture(/visual-fixture/studio)는 로그인 없이 편집실 셸을 owner로 띄운다 — 편집실 실물 검증이
// 막혀 있던(ISSUE-001) 영역을 이 경로로 뚫는다.

async function openBoard(page: Page) {
  await page.goto("/visual-fixture/studio?viewer=1");
  await page.locator('[data-act="open-drawing-board"]').click();
  await page.locator(".bp-draw-surface").waitFor();
}
const tool = (page: Page, name: string) => page.locator(`button[aria-label="${name}"]`).first();

async function drag(page: Page, from: [number, number], to: [number, number], steps = 30) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.mouse.up();
}

/** 화면 좌표의 알파값(맨 위 캔버스부터 훑어 처음 만나는 불투명 픽셀). */
function alphaAt(page: Page, x: number, y: number): Promise<number> {
  return page.evaluate(
    ([px, py]) => {
      const list = [...document.querySelectorAll<HTMLCanvasElement>(".bp-board canvas")].reverse();
      for (const c of list) {
        const r = c.getBoundingClientRect();
        if (px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;
        const sx = Math.round(((px - r.left) / r.width) * c.width);
        const sy = Math.round(((py - r.top) / r.height) * c.height);
        const d = ctx.getImageData(sx, sy, 1, 1).data;
        if (d[3] > 0) return d[3];
      }
      return 0;
    },
    [x, y]
  );
}

test("지운 부분은 선택해도 되살아나지 않는다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + box.width * 0.3);
  const x1 = Math.round(box.x + box.width * 0.7);
  const mid = Math.round((x0 + x1) / 2);

  await tool(page, "펜").click();
  await drag(page, [x0, y], [x1, y]);
  expect(await alphaAt(page, mid, y)).toBeGreaterThan(0);

  await tool(page, "지우개").click();
  await drag(page, [mid, y - 50], [mid, y + 50]);
  expect(await alphaAt(page, mid, y)).toBe(0);

  // 획 전체를 감싸 선택 — 예전엔 이 순간 지운 자리가 다시 칠해졌다(선택 획을 지우개 위로 올려서).
  await tool(page, "선택").click();
  await drag(page, [x0 - 40, y - 50], [x1 + 40, y + 50]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);
  expect(await alphaAt(page, mid, y)).toBe(0);

  // 옮겨도 지운 구간은 계속 없다(기하에서 덜어냈으므로 따라갈 것 자체가 없다).
  const sel = (await page.locator(".bp-stroke-sel").boundingBox())!;
  await drag(
    page,
    [sel.x + sel.width / 2, sel.y + sel.height / 2],
    [sel.x + sel.width / 2, sel.y + sel.height / 2 + 70]
  );
  expect(await alphaAt(page, mid, y + 70)).toBe(0);
});

test("채우기는 한 번 계산해 굳는다 — 선택되고, 다시 번지지 않는다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  expect(await alphaAt(page, cx, cy)).toBeGreaterThan(0);

  // 채운 것도 선택된다(사용자 질문: "채우기로 채운 건 선택이 안 되는 버그인가?").
  await tool(page, "선택").click();
  await drag(page, [box.x + 8, box.y + 8], [box.x + box.width - 8, box.y + box.height - 8]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);

  // 옮기면 그림처럼 따라온다 — 재생 때 다시 번지면 원래 자리가 계속 칠해져 있다.
  const probeX = Math.round(box.x + 20);
  const probeY = Math.round(box.y + 20);
  expect(await alphaAt(page, probeX, probeY)).toBeGreaterThan(0);
  const sel = (await page.locator(".bp-stroke-sel").boundingBox())!;
  await drag(
    page,
    [sel.x + sel.width / 2, sel.y + sel.height / 2],
    [sel.x + sel.width / 2 + 140, sel.y + sel.height / 2]
  );
  expect(await alphaAt(page, probeX, probeY)).toBe(0);
});

/**
 * 가운데 세로줄을 훑어 '위아래가 모두 칠해진' 투명 구간(=구멍)의 중심 y를 잰다.
 * 단순 bbox는 못 쓴다 — 채운 조각을 아래로 옮기면 위쪽 빈 띠까지 포함돼 구멍과 구분이 안 된다.
 */
function holeCenterY(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".bp-board canvas");
    const ctx = c?.getContext("2d", { willReadFrequently: true });
    if (!c || !ctx) return null;
    const x = Math.floor(c.width / 2);
    const col = ctx.getImageData(x, 0, 1, c.height).data;
    const clear = (y: number) => col[y * 4 + 3] === 0;
    let y = 0;
    while (y < c.height && clear(y)) y += 1; // 위쪽 빈 띠 건너뛰기
    for (; y < c.height; y += 1) {
      if (!clear(y)) continue;
      const start = y;
      while (y < c.height && clear(y)) y += 1;
      if (y >= c.height) return null; // 아래로 끝까지 뚫림 = 구멍이 아니라 바깥
      return { center: (start + y - 1) / 2, height: y - start };
    }
    return null;
  });
}

test("채운 곳을 지우면 구멍이 비트맵에 남는다(옮기면 따라간다)", async ({ page }) => {
  await openBoard(page);
  await page.waitForTimeout(700); // 판 크기가 잡힌 뒤에 그린다
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  expect(await alphaAt(page, cx, cy)).toBeGreaterThan(0);
  expect(await holeCenterY(page)).toBeNull(); // 아직 구멍 없음

  // 채운 면에 구멍을 낸다. 조각을 다시 인코딩·디코딩하므로 반영까지 잠깐 걸린다.
  await tool(page, "지우개").click();
  await drag(page, [cx - 80, cy], [cx + 80, cy]);
  await expect
    .poll(async () => (await holeCenterY(page))?.height ?? 0, { timeout: 5000 })
    .toBeGreaterThan(8);
  const before = (await holeCenterY(page))!;

  // 선택해서 아래로 옮기면 구멍도 같이 내려간다 = 픽셀에 구워졌다는 뜻.
  // (예전 방식이면 재생 때 다시 번져 구멍 자체가 메워진다.)
  await tool(page, "선택").click();
  await drag(page, [box.x + 6, box.y + 6], [box.x + box.width - 6, box.y + box.height - 6]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);
  const sel = (await page.locator(".bp-stroke-sel").boundingBox())!;
  await drag(
    page,
    [sel.x + sel.width / 2, sel.y + sel.height / 2],
    [sel.x + sel.width / 2, sel.y + sel.height / 2 + 90]
  );
  await expect
    .poll(async () => (await holeCenterY(page))?.center ?? 0, { timeout: 5000 })
    .toBeGreaterThan(before.center + 60);
});
