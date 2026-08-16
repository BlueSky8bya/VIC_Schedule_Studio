import { expect, test, type Page } from "@playwright/test";

// 편집실 실물 e2e — 로그인 없이 편집실 셸을 띄우는 fixture(/visual-fixture/studio)를 쓴다.
// 지금까지 편집실은 타입·빌드·코드리뷰까지만 검증됐고(ISSUE-001), 실제로 터진 사고는 전부 이
// 영역이었다. 서버 쓰기는 `/api/studio-write`를 가로채 흉내 낸다 — 운영 DB를 건드리지 않으면서
// **클라이언트가 보내는 명령의 내용과 순서**(진짜 위험한 부분)를 그대로 검사한다.

type WriteReq = { op: string; payload: Record<string, unknown> };

/** 쓰기 창구를 가로채 요청을 기록한다. delayMs로 응답을 늦춰 직렬화도 관찰한다. */
async function interceptWrites(
  page: Page,
  opts: { ok?: boolean; delayFor?: (req: WriteReq) => number } = {}
) {
  const reqs: WriteReq[] = [];
  const timeline: string[] = [];
  await page.route("**/api/studio-write", async (route) => {
    const body = route.request().postDataJSON() as WriteReq;
    reqs.push(body);
    timeline.push(`start:${body.op}`);
    const delay = opts.delayFor?.(body) ?? 0;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    timeline.push(`end:${body.op}`);
    await route.fulfill({
      status: opts.ok === false ? 403 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        opts.ok === false ? { ok: false, error: "권한 없음" } : { ok: true, id: "srv-1" }
      )
    });
  });
  return { reqs, timeline };
}

async function openStudio(page: Page) {
  await page.goto("/visual-fixture/studio");
  await page.locator("[data-act='calendar-cell']").first().waitFor();
}

test("새 일정: 저장하면 save 명령 하나가 나가고 '저장됨'이 뜬다", async ({ page }) => {
  const { reqs } = await interceptWrites(page);
  await openStudio(page);

  await page.locator("[data-act='calendar-cell']").nth(10).click();
  await page.locator("textarea, input[type='text']").first().fill("검증용 일정");
  await page.locator("[data-act='save-event']").click();

  await expect.poll(() => reqs.length, { timeout: 5000 }).toBeGreaterThan(0);
  const save = reqs.find((r) => r.op === "save");
  expect(save, "save 명령이 나가야 한다").toBeTruthy();
  expect(save!.payload.publicTitle).toBe("검증용 일정");
  expect(String(save!.payload.dateKey)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // 공개 범위는 기본이 '모두' — 실수로 비공개가 기본이 되면 시청자 화면에서 일정이 사라진다.
  expect(save!.payload.visibilityScope).toBe("public");
  await expect(page.getByText("저장됨").first()).toBeVisible();
});

test("저장이 실패하면 '저장 실패'로 정직하게 말하고 앱은 계속 쓸 수 있다", async ({ page }) => {
  const { reqs } = await interceptWrites(page, { ok: false });
  await openStudio(page);

  await page.locator("[data-act='calendar-cell']").nth(12).click();
  await page.locator("textarea, input[type='text']").first().fill("실패할 일정");
  await page.locator("[data-act='save-event']").click();

  await expect.poll(() => reqs.length, { timeout: 5000 }).toBeGreaterThan(0);
  await expect(page.getByText("저장 실패").first()).toBeVisible();
  // 실패 후에도 화면이 살아 있어야 한다(다른 날짜를 계속 고를 수 있다).
  await page.locator("[data-act='calendar-cell']").nth(15).click();
  await expect(page.locator("textarea, input[type='text']").first()).toBeVisible();
});

test("쓰기는 직렬로 나간다 — 앞 요청이 끝나기 전에 다음이 시작되지 않는다", async ({ page }) => {
  // 첫 요청만 길게 지연시킨다. 큐가 없으면 두 요청이 겹쳐(start,start,end,end) 서버 도착 순서가
  // 뒤집힐 수 있다 — '마지막 누른 것이 진실'이라는 약속이 깨지는 자리다.
  let first = true;
  const { reqs, timeline } = await interceptWrites(page, {
    delayFor: () => {
      if (first) {
        first = false;
        return 900;
      }
      return 0;
    }
  });
  await openStudio(page);

  // 같은 카드에서 연달아 두 번 저장한다(제목을 바꿔 구분). 첫 요청이 아직 날아가는 중에
  // 두 번째를 눌러야 큐가 있는지 없는지가 드러난다.
  await page.locator("[data-act='calendar-cell']").nth(10).click();
  const title = page.locator("textarea, input[type='text']").first();
  await title.fill("첫 번째");
  await page.locator("[data-act='save-event']").click();
  await title.fill("두 번째");
  await page.locator("[data-act='save-event']").click();

  await expect.poll(() => reqs.length, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
  // 겹침 없음: 각 start 바로 뒤에 자기 end가 온다.
  for (let i = 0; i < timeline.length; i += 2) {
    expect(timeline[i].startsWith("start:")).toBe(true);
    expect(timeline[i + 1]?.startsWith("end:")).toBe(true);
  }
  // 제출 순서 그대로 도착한다.
  expect(reqs.map((r) => r.payload.publicTitle)).toEqual(["첫 번째", "두 번째"]);
});

test("삭제 → 되돌리기: delete 뒤 restore가 같은 일정으로 나간다", async ({ page }) => {
  const { reqs } = await interceptWrites(page);
  await openStudio(page);

  await page.locator(".studio-event-pill").first().click();
  await page.locator("[data-act='일정 삭제']").click();
  await expect.poll(() => reqs.filter((r) => r.op === "delete").length, { timeout: 5000 }).toBe(1);

  const undo = page.locator("[data-act='delete-snack-undo'], .delete-snack button").first();
  await undo.click();
  await expect.poll(() => reqs.filter((r) => r.op === "restore").length, { timeout: 5000 }).toBe(1);
  const del = reqs.find((r) => r.op === "delete")!;
  const res = reqs.find((r) => r.op === "restore")!;
  // 같은 id로 되살아나야 태그·하트·연결이 그대로 붙어 온다(P0-DATA-1 tombstone).
  expect(res.payload.eventId).toBe(del.payload.eventId);
});

test("카드를 다른 날로 끌면 reorder가 movedId와 함께 나간다", async ({ page }) => {
  const { reqs } = await interceptWrites(page);
  await openStudio(page);

  const pill = page.locator(".studio-event-pill").first();
  const a = (await pill.boundingBox())!;
  const cell = page.locator("[data-act='calendar-cell']").nth(23);
  const b = (await cell.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 20, { steps: 25 });
  await page.mouse.up();

  await expect.poll(() => reqs.filter((r) => r.op === "reorder").length, { timeout: 5000 }).toBe(1);
  const move = reqs.find((r) => r.op === "reorder")!;
  expect(move.payload.movedId).toBeTruthy();
  expect(String(move.payload.dateKey)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Array.isArray(move.payload.orderedIds)).toBe(true);
});

test("중대한 쓰기는 keepalive로 나간다 — 저장 도중 떠나도 전송이 끝난다", async ({ page }) => {
  // ADR-0006의 약속. 헤더로는 안 보이므로 fetch를 감싸 init.keepalive를 관찰한다.
  await page.addInitScript(() => {
    const w = window as unknown as { __ka?: boolean[]; fetch: typeof fetch };
    w.__ka = [];
    const orig = w.fetch;
    w.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      if (url.includes("/api/studio-write")) w.__ka!.push(Boolean(init?.keepalive));
      return orig(input, init);
    };
  });
  await interceptWrites(page);
  await openStudio(page);

  await page.locator("[data-act='calendar-cell']").nth(10).click();
  await page.locator("textarea, input[type='text']").first().fill("keepalive 확인");
  await page.locator("[data-act='save-event']").click();

  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __ka: boolean[] }).__ka.length), {
      timeout: 5000
    })
    .toBeGreaterThan(0);
  const flags = await page.evaluate(() => (window as unknown as { __ka: boolean[] }).__ka);
  expect(flags.every(Boolean)).toBe(true);
});

test("만들자마자 끈 카드: 끄는 도중 저장이 끝나 id가 바뀌어도 화면·서버 순서가 같다", async ({ page }) => {
  // 2026-08-16 실측(8/17 칸): 새 카드를 만들고 곧바로 끌었더니 서버에는 순서가 저장됐는데
  // 편집자 화면은 옛 순서 그대로였고('저장됨' 배지도 정상), 새로고침하니 순서가 달랐다.
  // 원인: 드롭 핸들러가 pointerdown 때의 렌더 클로저라 카드 id를 temp로 알고 있는데, 끄는 사이
  // 저장이 끝나 배열에서는 실제 id로 바뀌어 낙관적 반영(setEvents)이 그 카드를 못 찾았다.
  // 서버 저장은 temp→실제 매핑으로 정상 전송 → 화면만 거짓말. 여기서는 그 찰나를 재현한다:
  // save 응답을 1.5초 늦추고, 그 사이 temp 카드를 집어 빈 칸으로 천천히 끌어 저장 완료 뒤 놓는다.
  const { reqs } = await interceptWrites(page, {
    delayFor: (r) => (r.op === "save" ? 1500 : 0)
  });
  await openStudio(page);

  const cells = page.locator("[data-act='calendar-cell']");
  const emptyIdxs = await page.evaluate(() =>
    [...document.querySelectorAll("[data-act='calendar-cell']")]
      .map((c, i) => (c.querySelectorAll(".studio-event-pill").length === 0 ? i : -1))
      .filter((i) => i >= 0)
  );
  expect(emptyIdxs.length).toBeGreaterThan(1);
  const fromCell = cells.nth(emptyIdxs[0]);
  const toCell = cells.nth(emptyIdxs[1]);
  const toDate = await toCell.getAttribute("data-isodate");

  await fromCell.click();
  await page.locator("textarea, input[type='text']").first().fill("바로 끌 일정");
  await page.locator("[data-act='save-event']").click();
  // 낙관적 temp 카드가 뜬다(아직 저장 응답 전).
  const temp = fromCell.locator(".studio-event-pill[data-eventid^='temp-']");
  await temp.waitFor({ timeout: 3000 });
  await page.keyboard.press("Escape"); // 편집 패널을 닫아 달력 위를 가리지 않게(드롭 판정)
  await page.waitForTimeout(250);
  const a = (await temp.boundingBox())!;
  const b = (await toCell.boundingBox())!;

  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 8, { steps: 4 });
  // 끄는 도중 저장 완료(1.5초) → id가 temp에서 srv-1로 바뀐다.
  await page.waitForTimeout(1900);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();

  // ① 화면: 카드(이제 실제 id)가 대상 칸에 있어야 한다. 예전엔 원래 칸에 남았다.
  const cellOf = () =>
    page.evaluate(
      () =>
        document
          .querySelector(".studio-event-pill[data-eventid='srv-1']")
          ?.closest("[data-act='calendar-cell']")
          ?.getAttribute("data-isodate") ?? null
    );
  await expect.poll(cellOf, { timeout: 5000 }).toBe(toDate);
  // ② 서버: reorder가 실제 id로, 대상 날짜로 나갔다(화면과 같은 진실).
  await expect.poll(() => reqs.filter((r) => r.op === "reorder").length, { timeout: 5000 }).toBe(1);
  const reorder = reqs.find((r) => r.op === "reorder")!;
  expect(reorder.payload.movedId).toBe("srv-1");
  expect(reorder.payload.dateKey).toBe(toDate);
  expect(reorder.payload.orderedIds).toEqual(["srv-1"]);
});
