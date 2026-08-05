import { expect, test, type Page } from "@playwright/test";

// 일정 그림판의 되돌리기/다시실행 무결성 — 브라우저 실물.
// 2026-08-05에 지우개를 '진짜 삭제'로, 채우기를 '비트맵 조각'으로 바꿨다. 둘 다 장면 배열을
// 통째로 교체하는(scene) 경로라, Ctrl+Z 한 번에 정확히 직전으로 돌아가는지가 새로 위험해졌다.
// 그림판은 서버 저장이 없어 되돌리기가 유일한 안전망이다 — 여기서 어긋나면 복구 수단이 없다.

async function openBoard(page: Page) {
  await page.goto("/visual-fixture/studio?viewer=1");
  await page.locator('[data-act="open-drawing-board"]').click();
  await page.locator(".bp-draw-surface").waitFor();
  await page.waitForTimeout(600); // 판 크기 안정
}
const tool = (page: Page, name: string) => page.locator(`button[aria-label="${name}"]`).first();

async function drag(page: Page, a: [number, number], b: [number, number], steps = 30) {
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  await page.mouse.move(b[0], b[1], { steps });
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
const undo = (page: Page) => page.keyboard.press("Control+z");
const redo = (page: Page) => page.keyboard.press("Control+y");

test("펜: 되돌리면 사라지고, 다시 실행하면 돌아온다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + box.width * 0.3);
  const x1 = Math.round(box.x + box.width * 0.7);
  const mid = Math.round((x0 + x1) / 2);

  await tool(page, "펜").click();
  await drag(page, [x0, y], [x1, y]);
  expect(await alphaAt(page, mid, y)).toBeGreaterThan(0);

  await undo(page);
  await expect.poll(() => alphaAt(page, mid, y), { timeout: 3000 }).toBe(0);
  await redo(page);
  await expect.poll(() => alphaAt(page, mid, y), { timeout: 3000 }).toBeGreaterThan(0);
});

test("지우개: 되돌리면 지운 획이 정확히 복구된다", async ({ page }) => {
  // 지우개는 이제 장면에서 기하를 덜어낸다(scene 교체). 되돌리기가 그 교체를 통째로 되짚지
  // 못하면 지운 부분이 영영 사라진다 — 서버 저장이 없어 만회할 방법이 없는 자리다.
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + box.width * 0.3);
  const x1 = Math.round(box.x + box.width * 0.7);
  const mid = Math.round((x0 + x1) / 2);

  await tool(page, "펜").click();
  await drag(page, [x0, y], [x1, y]);
  await tool(page, "지우개").click();
  await drag(page, [mid, y - 50], [mid, y + 50]);
  expect(await alphaAt(page, mid, y)).toBe(0);

  await undo(page);
  await expect.poll(() => alphaAt(page, mid, y), { timeout: 3000 }).toBeGreaterThan(0);
  // 획 자체는 남아 있어야 한다(되돌리기가 획까지 지워버리면 안 된다).
  expect(await alphaAt(page, x0 + 10, y)).toBeGreaterThan(0);

  await redo(page);
  await expect.poll(() => alphaAt(page, mid, y), { timeout: 3000 }).toBe(0);
});

test("채우기: 되돌리기 한 번이면 칠하기 전으로 돌아간다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  expect(await alphaAt(page, cx, cy)).toBeGreaterThan(0);

  await undo(page);
  await expect.poll(() => alphaAt(page, cx, cy), { timeout: 3000 }).toBe(0);
  await redo(page);
  await expect.poll(() => alphaAt(page, cx, cy), { timeout: 3000 }).toBeGreaterThan(0);
});

test("채운 면을 지운 뒤 되돌리기/다시실행이 구멍 상태와 함께 오간다", async ({ page }) => {
  // 그림(비트맵)은 지울 때 픽셀에 구워 넣는다. 그 결과가 히스토리에 담기지 않으면
  // 다시실행이 '지우기 전 그림'으로 돌아가 사용자가 한 일이 사라진다.
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  await tool(page, "지우개").click();
  await drag(page, [cx - 80, cy], [cx + 80, cy]);
  await expect.poll(() => alphaAt(page, cx, cy), { timeout: 5000 }).toBe(0);

  await undo(page); // 지우기 취소 → 구멍이 메워진다
  await expect.poll(() => alphaAt(page, cx, cy), { timeout: 5000 }).toBeGreaterThan(0);

  await redo(page); // 다시 지우기 → 구멍이 돌아온다(구워진 결과가 보존됐다는 뜻)
  await expect.poll(() => alphaAt(page, cx, cy), { timeout: 5000 }).toBe(0);

  await undo(page);
  await undo(page); // 채우기까지 취소 → 빈 판
  await expect.poll(() => alphaAt(page, cx, cy), { timeout: 5000 }).toBe(0);
  await expect.poll(() => alphaAt(page, cx - 200, cy), { timeout: 5000 }).toBe(0);
});

test("되돌릴 게 없으면 아무 일도 안 일어난다(빈 판에서 Ctrl+Z 연타)", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  for (let i = 0; i < 5; i += 1) await undo(page);
  await tool(page, "펜").click();
  await drag(page, [cx - 60, cy], [cx + 60, cy]);
  expect(await alphaAt(page, cx, cy)).toBeGreaterThan(0); // 그리기는 여전히 동작
});
