import { expect, test, type Page } from "@playwright/test";

// 일정 그림판 — 지우개·채우기·선택의 '실물' 회귀. 2026-08-05 사용자 지적 3건을 좌표·픽셀로 고정한다.
//   ① "내가 지운 부분 말고 주위까지 같이 지워진다"     → 지워진 폭 = 지우개 크기 언저리
//   ② "채우기로 채운 색이 선택 범위 밖인데도 선택된다"  → 그림은 상자가 아니라 픽셀로 판정
//   ③ "지우개 쓰면 깜빡인다"                          → 커밋 뒤 한 프레임도 비지 않는다
// 픽셀로 재는 이유: '보인다/안 보인다'는 스냅샷보다 좌표가 훨씬 정확하고, 실패했을 때
// 몇 px 어긋났는지가 바로 나온다.

async function openBoard(page: Page) {
  await page.goto("/visual-fixture/studio?viewer=1");
  await page.locator('[data-act="open-drawing-board"]').click();
  await page.locator(".bp-draw-surface").waitFor();
  await page.waitForTimeout(700); // 판 크기가 잡힌 뒤에 그린다(리사이즈 재생과 겹치지 않게)
}
const tool = (page: Page, name: string) => page.locator(`button[aria-label="${name}"]`).first();

async function drag(page: Page, from: [number, number], to: [number, number], steps = 30) {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps });
  await page.mouse.up();
}

/** 화면 좌표 한 점의 알파(맨 위 캔버스부터 훑어 처음 만나는 불투명 픽셀). */
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

/** 한 가로줄에서 잉크가 있는 구간(화면 좌표)들. 어느 캔버스에 있든 합쳐서 본다. */
function inkRuns(
  page: Page,
  y: number,
  x0: number,
  x1: number
): Promise<Array<[number, number]>> {
  return page.evaluate(
    ([yy, ax, bx]) => {
      const canvases = [...document.querySelectorAll<HTMLCanvasElement>(".bp-board canvas")];
      const has: boolean[] = [];
      for (let x = ax; x <= bx; x += 1) {
        let ink = false;
        for (const c of canvases) {
          const r = c.getBoundingClientRect();
          if (x < r.left || x > r.right || yy < r.top || yy > r.bottom) continue;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) continue;
          const sx = Math.round(((x - r.left) / r.width) * c.width);
          const sy = Math.round(((yy - r.top) / r.height) * c.height);
          if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
          if (ctx.getImageData(sx, sy, 1, 1).data[3] > 8) {
            ink = true;
            break;
          }
        }
        has.push(ink);
      }
      const runs: Array<[number, number]> = [];
      let start = -1;
      has.forEach((v, i) => {
        if (v && start < 0) start = i;
        if (!v && start >= 0) {
          runs.push([ax + start, ax + i - 1]);
          start = -1;
        }
      });
      if (start >= 0) runs.push([ax + start, ax + has.length - 1]);
      return runs;
    },
    [y, x0, x1]
  );
}

/** 다음 N프레임 동안 이 점의 알파 최솟값 — 중간에 한 프레임이라도 비면 0이 된다(깜빡임 검출). */
async function watchAlpha(page: Page, x: number, y: number, frames: number): Promise<number> {
  return page.evaluate(
    ([px, py, n]) =>
      new Promise<number>((resolve) => {
        let min = 255;
        let left = n;
        const read = () => {
          const list = [...document.querySelectorAll<HTMLCanvasElement>(".bp-board canvas")];
          let a = 0;
          for (const c of list) {
            const r = c.getBoundingClientRect();
            if (px < r.left || px > r.right || py < r.top || py > r.bottom) continue;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (!ctx) continue;
            const sx = Math.round(((px - r.left) / r.width) * c.width);
            const sy = Math.round(((py - r.top) / r.height) * c.height);
            const d = ctx.getImageData(sx, sy, 1, 1).data;
            if (d[3] > a) a = d[3];
          }
          if (a < min) min = a;
          left -= 1;
          if (left <= 0) resolve(min);
          else requestAnimationFrame(read);
        };
        requestAnimationFrame(read);
      }),
    [x, y, frames] as const
  );
}

/** 되돌리기 버튼이 살아 있나 = 되돌릴 기록이 쌓였나. */
function canUndo(page: Page): Promise<boolean> {
  return page.locator('[data-act="실행 취소"]').first().isEnabled();
}

test("① 빠르게 그은 획을 지우개로 톡 — 지우개 크기만큼만 사라진다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + 40);
  const x1 = Math.round(box.x + box.width - 40);
  const mid = Math.round((x0 + x1) / 2);

  // steps=1 = 포인터 이벤트 2개 = 기록되는 점도 사실상 2개(빠른 낙서와 같은 상황).
  await tool(page, "펜").click();
  await drag(page, [x0, y], [x1, y], 1);
  expect(await alphaAt(page, mid, y)).toBeGreaterThan(0);

  await tool(page, "지우개").click();
  await page.mouse.click(mid, y); // 톡 한 번
  await page.waitForTimeout(150);

  const runs = await inkRuns(page, y, x0 - 10, x1 + 10);
  expect(runs.length, "지우개가 획을 끊지 못했다").toBe(2);
  const gap = runs[1][0] - runs[0][1];
  // 지워진 폭 = 지우개 지름 + 획 굵기 + 약간의 여유. 예전 구현은 점 하나를 통째로 버려
  // 획의 절반(수백 px)이 날아갔다.
  expect(gap, `지운 폭이 ${gap}px — 지우개보다 훨씬 크다(과잉 삭제)`).toBeLessThan(48);
  expect(gap, "아무것도 안 지워졌다").toBeGreaterThan(4);
  // 양 끝은 그대로 남아 있다.
  expect(runs[0][0]).toBeLessThan(x0 + 12);
  expect(runs[1][1]).toBeGreaterThan(x1 - 12);
});

test("② 지운 결과가 다시 그려도 그대로다(장면에서 실제로 덜어냈다)", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + 40);
  const x1 = Math.round(box.x + box.width - 40);
  const mid = Math.round((x0 + x1) / 2);

  await tool(page, "펜").click();
  await drag(page, [x0, y], [x1, y], 1);
  await tool(page, "지우개").click();
  await page.mouse.click(mid, y);
  await page.waitForTimeout(150);
  const before = await inkRuns(page, y, x0 - 10, x1 + 10);

  // 되돌리기 → 다시 실행. 판은 명령 모델이라 이때 처음부터 다시 그려진다.
  // 장면에서 실제로 덜어내지 않았다면 여기서 지운 자리가 메워진다 — 예전 구현이 그랬다.
  await page.locator('[data-act="실행 취소"]').first().click();
  await page.waitForTimeout(200);
  const undone = await inkRuns(page, y, x0 - 10, x1 + 10);
  expect(undone.length, "되돌렸는데 지운 자리가 안 돌아왔다").toBe(1);
  await page.locator('[data-act="다시 실행"]').first().click();
  await page.waitForTimeout(250);

  const after = await inkRuns(page, y, x0 - 10, x1 + 10);
  expect(after.length, "다시 그렸더니 지운 자리가 메워졌다").toBe(before.length);
  expect(Math.abs(after[1][0] - before[1][0])).toBeLessThanOrEqual(3);
  // ★ 여기가 '과잉 삭제'의 진짜 검증점이다. 화면에 칠해진 결과가 아니라 **장면을 다시 그린**
  //   결과라서, 기하에서 얼마나 덜어냈는지가 그대로 드러난다. 예전처럼 기록된 점 하나를
  //   통째로 버리면 이 지점에서 획의 절반이 사라진다.
  const gap = after[1][0] - after[0][1];
  expect(gap, `다시 그린 뒤 지운 폭이 ${gap}px — 기하에서 너무 많이 덜어냈다`).toBeLessThan(48);
  expect(after[0][0]).toBeLessThan(x0 + 12);
  expect(after[1][1]).toBeGreaterThan(x1 - 12);
});

test("③ 사각형 한 변만 지워도 나머지 변은 남는다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const left = Math.round(box.x + 60);
  const right = Math.round(box.x + 260);
  const top = Math.round(box.y + 40);
  const bottom = Math.round(box.y + 160);

  await tool(page, "사각형").click();
  await drag(page, [left, top], [right, bottom]);
  expect(await alphaAt(page, Math.round((left + right) / 2), top)).toBeGreaterThan(0);

  // 윗변 한가운데만 지운다.
  await tool(page, "지우개").click();
  await page.mouse.click(Math.round((left + right) / 2), top);
  await page.waitForTimeout(200);

  expect(await alphaAt(page, Math.round((left + right) / 2), top), "지운 자리가 안 지워졌다").toBe(0);
  // 나머지 세 변 + 윗변 양옆은 그대로.
  expect(await alphaAt(page, left, Math.round((top + bottom) / 2))).toBeGreaterThan(0);
  expect(await alphaAt(page, right, Math.round((top + bottom) / 2))).toBeGreaterThan(0);
  expect(await alphaAt(page, Math.round((left + right) / 2), bottom)).toBeGreaterThan(0);
  expect(await alphaAt(page, left + 20, top)).toBeGreaterThan(0);
});

test("④ 채운 색 — 투명한 여백만 긁으면 선택되지 않는다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const R = 90;

  // 원을 그리고 그 안을 채운다 → 채운 조각의 '상자'는 원의 바깥 사각형이라 **네 귀퉁이는 투명**이다.
  // 상자로 판정하던 예전 구현은 그 투명한 귀퉁이만 긁어도 조각을 통째로 잡았다.
  await tool(page, "원").click();
  await drag(page, [cx - R, cy - R], [cx + R, cy + R]);
  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(250);
  expect(await alphaAt(page, cx, cy), "원 안이 안 채워졌다").toBeGreaterThan(0);
  expect(await alphaAt(page, cx - R + 8, cy - R + 8), "귀퉁이는 비어 있어야 한다").toBe(0);

  // 상자 안이지만 칠해지지 않은 귀퉁이만 감싼다 — 아무것도 잡히면 안 된다.
  await tool(page, "선택").click();
  await drag(page, [cx - R + 4, cy - R + 4], [cx - R + 20, cy - R + 20]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(0);

  // 칠해진 한가운데를 감싸면 잡힌다(선택 자체가 죽으면 안 되니까 반대도 확인).
  await drag(page, [cx - 20, cy - 20], [cx + 20, cy + 20]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);
});

test("⑤ 지우개가 여백만 스치면 되돌리기 기록이 안 쌓인다", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const R = 90;

  await tool(page, "원").click();
  await drag(page, [cx - R, cy - R], [cx + R, cy + R]);
  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(250);

  // 채운 조각의 상자 안이지만 **칠해지지 않은** 자리(원 바깥 귀퉁이)를 지운다.
  const undoCount = async () => {
    let n = 0;
    while (await canUndo(page)) {
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(60);
      n += 1;
      if (n > 12) break;
    }
    return n;
  };
  await tool(page, "지우개").click();
  // 지우개 반지름(굵기 5 × 5 ÷ 2 = 12.5)만큼 원 윤곽에서 떨어진 자리를 톡 — 원에는 안 닿는다.
  await page.mouse.click(cx - R + 6, cy - R + 6);
  await page.waitForTimeout(250);

  // 기록은 '원 + 채우기' 둘뿐이어야 한다(빈 곳을 지운 것은 기록이 아니다).
  expect(await undoCount()).toBe(2);
});

test("⑥ 지우개를 쓴 뒤 한 프레임도 그림이 사라지지 않는다(깜빡임)", async ({ page }) => {
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);

  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);
  const probeX = Math.round(box.x + 30);
  const probeY = Math.round(box.y + 30);
  expect(await alphaAt(page, probeX, probeY)).toBeGreaterThan(0);

  // 지우개를 긋는 동안·직후 30프레임 동안 멀리 있는 채운 픽셀을 지켜본다.
  await tool(page, "지우개").click();
  await page.mouse.move(cx - 60, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy, { steps: 10 });
  const watching = watchAlpha(page, probeX, probeY, 30);
  await page.mouse.up();
  const min = await watching;
  expect(min, "지우개 커밋 직후 그림이 한 프레임 사라졌다(깜빡임)").toBeGreaterThan(0);
});

test("⑦ 채운 색도 러버밴드로 '잘라서' 선택된다(획과 같은 문법)", async ({ page }) => {
  // 사용자 지적(2026-08-06): "채우기로 색칠된 건 선택으로 분할이 안 된다."
  // 그림은 통째 선택이 최소 단위였다 — 획은 밴드에 걸친 구간만 잘라 주는데 그림만 예외였다.
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const R = 90;

  await tool(page, "원").click();
  await drag(page, [cx - R, cy - R], [cx + R, cy + R]);
  await tool(page, "채우기").click();
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(250);

  // 밴드는 **원 안쪽에만** 둔다 — 윤곽을 건드리면 도형까지 함께 잡혀 무엇이 잘렸는지 흐려진다.
  const inLeft: [number, number] = [cx - 40, cy];
  const inRight: [number, number] = [cx + 40, cy];
  expect(await alphaAt(page, ...inLeft)).toBeGreaterThan(0);
  expect(await alphaAt(page, ...inRight)).toBeGreaterThan(0);

  await tool(page, "선택").click();
  await drag(page, [cx - 70, cy - 30], [cx - 10, cy + 30]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);
  const sel = (await page.locator(".bp-stroke-sel").boundingBox())!;
  expect(sel.width, "선택 상자가 감싼 범위보다 크다(통째로 잡혔다)").toBeLessThan(90);
  expect(sel.height, "선택 상자가 감싼 범위보다 크다(통째로 잡혔다)").toBeLessThan(90);

  // 잘라 선택한 조각만 아래로 옮긴다 — 나머지 채운 면은 제자리에 남고, 자른 자리는 빈다.
  await drag(page, [cx - 40, cy], [cx - 40, cy + 200], 20);
  await page.waitForTimeout(300);
  expect(await alphaAt(page, ...inLeft), "자른 자리가 안 비었다").toBe(0);
  expect(await alphaAt(page, cx - 40, cy + 200), "옮긴 자리에 조각이 없다").toBeGreaterThan(0);
  expect(await alphaAt(page, ...inRight), "나머지 채운 면까지 같이 옮겨졌다").toBeGreaterThan(0);
});

test("⑧ 형광펜을 절반만 선택해도 이음매가 진해지거나 잘록해지지 않는다", async ({ page }) => {
  // 사용자 지적(2026-08-06): ① 1자로 그은 형광펜을 절반만 선택하면 경계에 진한 덩어리가 생기고
  // 해제해도 남는다(조각 둘이 반투명 캡을 두 번 칠함). ② 끝을 물려 피했더니 이번엔 캡이 둥글게
  // 잘려 알약 여러 개처럼 보였다(둥근 끝은 이어붙일 수 없다).
  // 그래서 두 가지를 함께 본다: 경계의 **농도**(진해지지 않았나)와 **두께**(잘록해지지 않았나).
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + 60);
  const x1 = Math.round(box.x + box.width - 60);
  const mid = Math.round((x0 + x1) / 2);

  await tool(page, "형광펜").click();
  await drag(page, [x0, y], [x1, y], 24);
  await page.waitForTimeout(150);

  const xs = [x0 + 40, mid - 40, mid - 6, mid, mid + 6, mid + 40, x1 - 40];
  const alphas = async () => {
    const out: number[] = [];
    for (const x of xs) out.push(await alphaAt(page, x, y));
    return out;
  };
  /** 세로로 훑어 잉크가 있는 픽셀 수 = 획 두께(잘록해짐 검출). */
  const thickness = async (x: number) =>
    page.evaluate(
      ([px, cy]) => {
        const cs = [...document.querySelectorAll<HTMLCanvasElement>(".bp-board canvas")];
        let n = 0;
        for (let dy = -40; dy <= 40; dy += 1) {
          let ink = false;
          for (const c of cs) {
            const r = c.getBoundingClientRect();
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (!ctx) continue;
            const sx = Math.round(((px - r.left) / r.width) * c.width);
            const sy = Math.round(((cy + dy - r.top) / r.height) * c.height);
            if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
            if (ctx.getImageData(sx, sy, 1, 1).data[3] > 8) {
              ink = true;
              break;
            }
          }
          if (ink) n += 1;
        }
        return n;
      },
      [x, y] as const
    );

  const flat = await alphas();
  const base = Math.round(flat.reduce((a, b) => a + b, 0) / flat.length);
  const baseThick = await thickness(x0 + 40);
  expect(base, "형광펜이 안 그려졌다").toBeGreaterThan(30);
  expect(baseThick, "획 두께를 못 쟀다").toBeGreaterThan(4);

  // 왼쪽 절반만 감싼다 → 경계가 mid 부근에 생긴다.
  await tool(page, "선택").click();
  await drag(page, [x0 - 30, y - 40], [mid, y + 40]);
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(1);
  const during = await alphas();
  expect(Math.max(...during), `선택 중 경계가 진해졌다(${during.join(",")})`).toBeLessThanOrEqual(
    base + 12
  );

  // 선택 해제 — "풀어도 겹친 채로 남는다"가 여기서 드러난다.
  await page.mouse.click(Math.round(box.x + 20), Math.round(box.y + box.height - 20));
  await expect(page.locator(".bp-stroke-sel")).toHaveCount(0);
  const after = await alphas();
  expect(Math.max(...after), `해제 뒤에도 경계가 진하다(${after.join(",")})`).toBeLessThanOrEqual(
    base + 12
  );
  expect(Math.min(...after), `경계가 벌어졌다(${after.join(",")})`).toBeGreaterThan(base - 25);

  // 두께 — 경계 부근이 알약처럼 잘록해지면 안 된다.
  for (const x of [mid - 8, mid - 2, mid, mid + 2, mid + 8]) {
    const t = await thickness(x);
    expect(t, `이음매가 잘록하다(x=${x}: ${t} vs ${baseThick})`).toBeGreaterThanOrEqual(
      baseThick - 2
    );
  }
});

test("⑨ 스치듯 지우면 그은 대로만 깎인다(획이 통째로 안 끊긴다)", async ({ page }) => {
  // 사용자 지적(2026-08-06): "내가 의도한 대로 못 지운다 — 후처리로 정리되는 것 같다."
  // 벡터로 자르면 획이 굵기 단위로 끊겨, 가장자리를 살짝 스쳤을 뿐인데 그 구간의 폭 전체가
  // 사라졌다. 이제 지우개가 획 폭을 통째로 덮은 적이 없으면 픽셀 그대로 깎는다.
  await openBoard(page);
  const box = (await page.locator(".bp-draw-surface").boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + 60);
  const x1 = Math.round(box.x + box.width - 60);
  const probe = Math.round((x0 + x1) / 2);

  const thickness = (x: number) =>
    page.evaluate(
      ([px, cy]) => {
        const cs = [...document.querySelectorAll<HTMLCanvasElement>(".bp-board canvas")];
        let n = 0;
        for (let dy = -40; dy <= 40; dy += 1) {
          for (const c of cs) {
            const r = c.getBoundingClientRect();
            const ctx = c.getContext("2d", { willReadFrequently: true });
            if (!ctx) continue;
            const sx = Math.round(((px - r.left) / r.width) * c.width);
            const sy = Math.round(((cy + dy - r.top) / r.height) * c.height);
            if (sx < 0 || sy < 0 || sx >= c.width || sy >= c.height) continue;
            if (ctx.getImageData(sx, sy, 1, 1).data[3] > 8) {
              n += 1;
              break;
            }
          }
        }
        return n;
      },
      [x, y] as const
    );

  await tool(page, "형광펜").click();
  await drag(page, [x0, y], [x1, y], 24);
  await page.waitForTimeout(150);
  const base = await thickness(probe);
  expect(base, "형광펜 두께를 못 쟀다").toBeGreaterThan(8);

  // 위쪽 가장자리만 따라 스친다(중심선에서 10px 위) — 폭을 덮은 적이 없다.
  await tool(page, "지우개").click();
  await drag(page, [x0 + 20, y - 10], [x1 - 20, y - 10], 20);
  await page.waitForTimeout(400);

  const after = await thickness(probe);
  expect(after, "스쳤는데 획이 통째로 끊겼다").toBeGreaterThan(2);
  expect(after, "스쳤는데 아무것도 안 깎였다").toBeLessThan(base - 2);
  // 지우개가 지나간 자리 바깥(양 끝)은 원래 두께 그대로.
  expect(await thickness(x0 + 6)).toBeGreaterThanOrEqual(base - 2);
});
