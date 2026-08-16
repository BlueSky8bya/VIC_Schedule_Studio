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

test("큰 화면(셸 zoom 0.9)에서도 '놓을 자리' 높이 = '원래 위치' 높이", async ({ page }) => {
  // ≥1700px에서 .studio-shell에 CSS zoom 0.9가 걸린다. getBoundingClientRect는 그 배율이 이미
  // 곱해진 화면 px라, 그 값을 zoom 안쪽 스페이서의 인라인 height로 되쓰면 0.9가 두 번 먹어
  // 민트 '놓을 자리'가 보라 '원래 위치'보다 10% 낮았다(2026-08-16 사용자 지적, 1440에선 안 보임).
  await page.setViewportSize({ width: 1800, height: 1200 });
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
  await page.waitForTimeout(400); // 높이 전환이 끝날 때까지
  const hs = await page.evaluate(() => {
    const src = document.querySelector<HTMLElement>(".studio-event-pill.dragging-src");
    const gap = document.querySelector<HTMLElement>(".drop-gap.on");
    return {
      src: src?.getBoundingClientRect().height ?? -1,
      gap: gap?.getBoundingClientRect().height ?? -1
    };
  });
  await page.mouse.up();
  expect(hs.src).toBeGreaterThan(0);
  expect(Math.abs(hs.gap - hs.src), `놓을 자리 ${hs.gap} vs 원래 위치 ${hs.src}`).toBeLessThan(0.5);
});

test("순서 저장이 실패하면 서버 순서로 되돌아온다(다른 저장이 진행 중이어도)", async ({ page }) => {
  // 2026-08-16 실측: 이동 저장 실패 시 곧바로 router.refresh()를 불렀는데, 그 결과가 도착하는
  // 순간 다른 쓰기(저장)가 아직 진행 중이면 prop 동기화 가드가 그 결과를 버렸다 → 편집자 화면은
  // 옮긴 순서·서버는 옛 순서로 영영 갈라졌다. 여기서는 '휴방' 저장을 3초 늦추고 그 사이 이동을
  // 실패시켜, 저장이 끝난 뒤 카드가 서버(원래) 칸으로 돌아오는지 본다.
  await page.route("**/api/studio-write", async (r) => {
    const body = r.request().postDataJSON() as { op?: string };
    if (body?.op === "reorder") {
      return r.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "테스트: 순서 저장 실패" })
      });
    }
    if (body?.op === "save") await new Promise((res) => setTimeout(res, 3000));
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, id: "srv-1" })
    });
  });
  await page.goto("/visual-fixture/studio");
  await page.locator(".studio-event-pill").first().waitFor();
  const src = page.locator(".studio-event-pill").first();
  const srcId = await src.getAttribute("data-eventid");
  const srcDate = await src.evaluate(
    (el) => el.closest("[data-act='calendar-cell']")?.getAttribute("data-isodate") ?? null
  );
  const emptyIdxs = await page.evaluate(() =>
    [...document.querySelectorAll("[data-act='calendar-cell']")]
      .map((c, i) => (c.querySelectorAll(".studio-event-pill").length === 0 ? i : -1))
      .filter((i) => i >= 0)
  );
  expect(emptyIdxs.length).toBeGreaterThan(0);
  const cells = page.locator("[data-act='calendar-cell']");
  const targetCell = cells.nth(emptyIdxs[0]);
  const targetDate = await targetCell.getAttribute("data-isodate");

  // ① 다른 카드를 열고 Ctrl+S → save가 3초간 진행 중이 된다.
  await page.locator(".studio-event-pill").nth(1).click();
  await page.locator(".studio-editor-panel, [data-act='editor-panel']").first().waitFor({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(150);

  // ② 그 사이 카드를 다른 빈 칸으로 끈다 → reorder 실패. (패널이 열려 레이아웃이 바뀌었을 수
  //    있으니 좌표는 지금 다시 잰다.)
  const a = (await src.boundingBox())!;
  const b = (await targetCell.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 8, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await page.mouse.up();

  const cellOf = () =>
    page.evaluate(
      (id) =>
        document
          .querySelector(`.studio-event-pill[data-eventid="${id}"]`)
          ?.closest("[data-act='calendar-cell']")
          ?.getAttribute("data-isodate") ?? null,
      srcId
    );
  // 낙관적으로는 일단 옮겨진다.
  await expect.poll(cellOf, { timeout: 3000 }).toBe(targetDate);
  // 저장(3초)이 끝난 뒤 서버 진실(원래 칸)로 되돌아와야 한다. 예전엔 영영 targetDate였다.
  await expect.poll(cellOf, { timeout: 12000 }).toBe(srcDate);
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

test("끌 때 회전이 아예 없고, 손을 부드럽게 뒤따른다", async ({ page }) => {
  // 2026-08-06 사용자 결정: 회전(진자)은 없앤다. 대신 스프링으로 부드럽게 따라오고,
  // 놓으면 새 자리로 '뿅' 들어간다. 여기서는 ① 회전 0 ② 즉시 순간이동 아님을 좌표로 본다.
  await page.goto("/visual-fixture/studio");
  const card = page.locator(".studio-event-pill").first();
  await card.waitFor();
  const b = (await card.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 12, b.y + b.height / 2 + 12, { steps: 3 });

  /** 유령의 회전각(deg)과 위치 — transform 행렬에서 뽑는다. */
  const ghostState = () =>
    page.evaluate(() => {
      const g = document.querySelector<HTMLElement>(".event-drag-ghost");
      if (!g) return null;
      const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
      // 위치는 style.left/top으로 읽는다 — getBoundingClientRect는 확대(scale 1.06)만큼
      // 좌상단이 밀려 보여서 '따라붙었나' 판정이 상수만큼 틀어진다.
      return {
        deg: (Math.atan2(m.b, m.a) * 180) / Math.PI,
        x: parseFloat(g.style.left) || 0,
        y: parseFloat(g.style.top) || 0
      };
    });

  // 큰 원을 몇 바퀴 돌린다 — 예전에는 여기서 카드가 90° 넘게 뒤집혔다.
  let worstDeg = 0;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const R = 120;
  for (let turn = 0; turn < 2; turn += 1) {
    for (let i = 0; i < 16; i += 1) {
      const t = (i / 16) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
      const st = await ghostState();
      if (st) worstDeg = Math.max(worstDeg, Math.abs(st.deg));
    }
  }
  expect(worstDeg, `카드가 ${worstDeg.toFixed(1)}° 기울었다 — 회전은 없어야 한다`).toBeLessThan(0.6);

  // 스프링 기준점(잡은 지점 오프셋)은 실측으로 잡는다 — 카드 안쪽 여백·확대 때문에
  // '커서 − 카드폭/2'로 가정하면 몇 px 어긋난다.
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(500); // 충분히 정착
  const settled = (await ghostState())!;
  const offX = cx - settled.x;
  const offY = cy - settled.y;

  // 손을 크게 옮긴 직후엔 아직 도착 전이어야 한다(즉시 순간이동 = 툭툭 끊기는 느낌).
  // 화면 아래쪽으로 크게 가면 자동 스크롤이 걸려 좌표 기준이 흔들린다 — 뷰포트 안에서만 움직인다.
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const tx = cx + 200;
  const ty = cy + 40;
  await page.mouse.move(tx, ty);
  const mid = (await ghostState())!;
  const lag = Math.hypot(mid.x - (tx - offX), mid.y - (ty - offY));
  expect(lag, "유령이 손에 즉시 박힌다(스프링 지연이 없다)").toBeGreaterThan(2);
  // 그리고 곧 따라붙는다(영영 뒤처지지 않는다).
  await expect
    .poll(
      async () => {
        const st = await ghostState();
        if (!st) return 999;
        return Math.hypot(st.x - (tx - offX), st.y - (ty - offY));
      },
      { timeout: 2000 }
    )
    .toBeLessThan(2);
  expect(await page.evaluate(() => window.scrollY), "자동 스크롤이 끼어들었다").toBe(scrollBefore);

  // 회전을 없앤 대신 '손에 들려 있다'는 아주 작은 흔들림이 살아 있어야 한다(위치 흔들림).
  // 손을 멈춘 채로 지켜본다 — 값이 전혀 안 변하면 죽은 카드처럼 보인다(2026-08-06 사용자 지적).
  const sway = await page.evaluate(
    () =>
      new Promise<{ span: number; max: number }>((resolve) => {
        const g = document.querySelector<HTMLElement>(".event-drag-ghost")!;
        const xs: number[] = [];
        const ys: number[] = [];
        let n = 0;
        const tick = () => {
          const m = new DOMMatrixReadOnly(getComputedStyle(g).transform);
          xs.push(m.e);
          ys.push(m.f);
          if (++n < 40) requestAnimationFrame(tick);
          else
            resolve({
              span: Math.max(
                Math.max(...xs) - Math.min(...xs),
                Math.max(...ys) - Math.min(...ys)
              ),
              max: Math.max(...xs.map(Math.abs), ...ys.map(Math.abs))
            });
        };
        requestAnimationFrame(tick);
      })
  );
  expect(sway.span, "들고 있는데 흔들림이 전혀 없다").toBeGreaterThan(0.4);
  expect(sway.max, "흔들림이 과하다(읽기 방해)").toBeLessThan(4);
  await page.mouse.up();
});

test("놓으면 새 자리로 빨려 들어가 '뿅' 하고 정착한다", async ({ page }) => {
  // 유령이 그 자리에서 툭 사라지고 카드가 다른 곳에 순간이동하면 멋이 없다(사용자 지적).
  // 놓은 유령은 새 자리까지 스프링으로 이동한 뒤 사라지고, 도착한 카드가 짧게 정착 펄스를 준다.
  await page.route("**/api/studio-write", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, id: "srv-1" })
    })
  );
  await page.goto("/visual-fixture/studio");
  await page.locator(".studio-event-pill").first().waitFor();
  const from = (await page.locator(".studio-event-pill").nth(0).boundingBox())!;
  const cells = page.locator("[data-act='calendar-cell']");
  // 비어 있는 칸을 하나 고른다(그 칸으로 옮긴다).
  const emptyIdx = await page.evaluate(() => {
    const list = [...document.querySelectorAll("[data-act='calendar-cell']")];
    return list.findIndex((c) => c.querySelectorAll(".studio-event-pill").length === 0);
  });
  expect(emptyIdx).toBeGreaterThanOrEqual(0);
  const to = (await cells.nth(emptyIdx).boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 18 });
  // 놓기 **직전에** 애니메이션 수집기를 건다 — 착지 연출이 몇 개 켜지는지 세기 위해.
  // 예전에는 옮긴 카드에 '저장 반짝'(.just-saved / pill-settle)까지 겹쳐 "따닥" 두 번 번쩍였다
  // (2026-08-06 사용자 지적). 카드에 걸리는 애니메이션은 착지 펄스 하나여야 한다.
  await page.evaluate(() => {
    const w = window as unknown as { __anims?: string[] };
    w.__anims = [];
    document.addEventListener(
      "animationstart",
      (e) => {
        const t = e.target as HTMLElement | null;
        if (t?.classList?.contains("studio-event-pill")) {
          w.__anims!.push((e as AnimationEvent).animationName);
        }
      },
      true
    );
  });
  await page.mouse.up();

  // 유령이 즉시 사라지지 않고, 착지 애니메이션이 끝나면 정리된다.
  const stillThere = await page.locator(".event-drag-ghost").count();
  expect(stillThere, "놓자마자 유령이 사라졌다(착지 연출 없음)").toBe(1);
  // 도착한 카드에 정착 펄스가 붙는다.
  await expect(page.locator(".studio-event-pill.just-landed")).toHaveCount(1, { timeout: 2000 });
  // 그리고 유령은 반드시 치워진다(멈춘 유령을 남기지 않는다).
  await expect(page.locator(".event-drag-ghost")).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator(".studio-event-pill.just-landed")).toHaveCount(0, { timeout: 2000 });
  const anims = await page.evaluate(
    () => (window as unknown as { __anims?: string[] }).__anims ?? []
  );
  expect(anims, `착지 연출이 ${anims.length}개 겹쳤다(${anims.join(", ")})`).toEqual(["card-landed"]);
});
