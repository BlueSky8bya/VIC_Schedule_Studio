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

test("채운 곳을 지우면 구멍이 비트맵에 남는다(옮기면 따라간다)", async ({ page }) => {
  await openBoard(page);
  await page.waitForTimeout(700); // 판 크기가 잡힌 뒤에 그린다
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  // 사각형 안만 채운다 — 판 전체를 채우면 옮긴 조각 밑에 여전히 채운 면이 깔려 있어
  // '구멍이 따라왔는지'를 픽셀로 구분할 수 없다.
  await tool(page, "사각형").click();
  await drag(page, [cx - 100, cy - 60], [cx + 100, cy + 60]);
  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(250);
  expect(await alphaAt(page, cx, cy)).toBeGreaterThan(0);

  // 채운 면에 구멍을 낸다. 조각을 다시 인코딩·디코딩하므로 반영까지 잠깐 걸린다.
  await tool(page, "지우개").click();
  await drag(page, [cx - 60, cy], [cx + 60, cy]);
  await expect.poll(async () => alphaAt(page, cx, cy), { timeout: 5000 }).toBe(0);

  // 칠해진 부분을 **전부** 감싸면 통째로 잡힌다(분할 조건이 아니다). 빈 곳으로 옮긴다.
  await tool(page, "선택").click();
  await drag(page, [cx - 130, cy - 90], [cx + 130, cy + 90]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);
  const sel = (await page.locator(".bp-stroke-sel").boundingBox())!;
  const dx = -Math.min(280, Math.round(sel.x - box.x - 10));
  await drag(
    page,
    [sel.x + sel.width / 2, sel.y + sel.height / 2],
    [sel.x + sel.width / 2 + dx, sel.y + sel.height / 2]
  );
  await page.waitForTimeout(400);
  // 옮긴 자리에 '구멍 + 그 위아래 채운 면'이 그대로 재현된다 = 픽셀에 구워졌다는 뜻.
  // (예전 방식이면 재생 때 다시 번져 구멍 자체가 메워진다.)
  expect(await alphaAt(page, cx + dx, cy), "구멍이 안 따라왔다").toBe(0);
  expect(await alphaAt(page, cx + dx, cy - 40), "조각 본체가 안 따라왔다").toBeGreaterThan(0);
  expect(await alphaAt(page, cx + dx, cy + 40)).toBeGreaterThan(0);
  expect(await alphaAt(page, cx, cy - 40), "원래 자리에 그대로 남아 있다").toBe(0);
});
