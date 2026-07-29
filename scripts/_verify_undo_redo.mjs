// P1-HIST-1 검증: 통합 undo/redo — 삭제→Ctrl+Z→Ctrl+Shift+Z, 새 작업이 redo를 비우는지.
// fixture는 익명이라 서버 쓰기가 실패/롤백됨 → /api/studio-write를 성공으로 스텁해 낙관 경로 검증.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let idSeq = 0;
await page.route("**/api/studio-write", async (route) => {
  const body = route.request().postDataJSON();
  const id = body?.op === "save" ? `srv-${++idSeq}` : undefined;
  await route.fulfill({ json: id ? { ok: true, id } : { ok: true } });
});

await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
await page.waitForSelector(".studio-month-grid", { timeout: 15000 });

const countCards = () => page.locator(".studio-event-pill").count();
const toast = () => page.locator(".copy-toast").innerText().catch(() => "(없음)");

const before = await countCards();

// 1) 일정 카드 선택 → Delete → 삭제
const firstCard = page.locator(".studio-event-pill").first();
const title = (await firstCard.innerText()).split("\n")[0];
await firstCard.click();
await page.waitForTimeout(250);
await page.keyboard.press("Delete");
await page.waitForTimeout(700); // poof 애니메이션 + commitDelete
const afterDelete = await countCards();
console.log(`삭제: ${before}->${afterDelete} (감소 기대) · 대상 "${title}"`);

// 2) Ctrl+Z → 복구
await page.keyboard.press("Control+z");
await page.waitForTimeout(500);
const afterUndo = await countCards();
console.log(`Ctrl+Z: ${afterDelete}->${afterUndo} (${before} 기대) · toast: ${await toast()}`);

// 3) Ctrl+Shift+Z → 다시 삭제
await page.keyboard.press("Control+Shift+z");
await page.waitForTimeout(500);
const afterRedo = await countCards();
console.log(`Ctrl+Shift+Z: ${afterUndo}->${afterRedo} (${afterDelete} 기대) · toast: ${await toast()}`);

// 4) Ctrl+Z 재복구(redo가 undo 스택에 역연산을 쌓았는지)
await page.keyboard.press("Control+z");
await page.waitForTimeout(500);
const afterUndo2 = await countCards();
console.log(`Ctrl+Z(2): ${afterRedo}->${afterUndo2} (${before} 기대) · toast: ${await toast()}`);

// 5) 새 작업이 redo를 비우는지: 삭제→undo→새 작업(다른 카드 삭제)→redo → "다시 실행할 작업 없음" 기대.
await page.locator(".studio-event-pill").first().click();
await page.waitForTimeout(250);
await page.keyboard.press("Delete");
await page.waitForTimeout(700);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
await page.locator(".studio-event-pill").first().click();
await page.waitForTimeout(250);
await page.keyboard.press("Delete");
await page.waitForTimeout(700);
await page.keyboard.press("Control+Shift+z");
await page.waitForTimeout(400);
console.log(`redo 무효화 후 Ctrl+Shift+Z toast: ${await toast()} (다시 실행 없음 기대 X — 마지막 삭제의 재실행이 아니라 빈 redo)`);

// 6) Ctrl+Y도 다시 실행으로 동작
await page.keyboard.press("Control+y");
await page.waitForTimeout(300);
console.log(`Ctrl+Y toast: ${await toast()}`);

await browser.close();
