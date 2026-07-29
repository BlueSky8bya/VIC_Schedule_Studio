// 레일 후보를 런타임 주입으로 비교(리빌드 없이): (a) 현재, (b) 인셋0, (c) 인셋0+행간 1.4.
import { chromium } from "playwright";
import path from "node:path";

const SHOT = process.env.SHOT_DIR ?? ".";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await p.goto("http://localhost:3000/visual-fixture/studio", { waitUntil: "networkidle" });
await p.waitForSelector(".studio-month-grid", { timeout: 15000 });
await p.locator('.studio-month-grid [data-isodate]').nth(8).click();
await p.waitForSelector(".event-editor-panel .title-live-web", { timeout: 8000 });
const ta = p.locator(".event-editor-panel .title-live-web textarea");
await ta.fill("휴뱅\n정기휴뱅");
await p.waitForTimeout(300);

const shoot = async (name) => {
  const box = await p.locator(".title-live-web").boundingBox();
  await p.screenshot({ path: path.join(SHOT, `${name}.png`), clip: box });
};

// (b) 인셋 0 — 레일 = 미러 rest rect 그대로
const setRail = () =>
  p.evaluate(() => {
    const wrap = document.querySelector(".title-live-web");
    const mirror = wrap.querySelector(".title-live-mirror");
    const rest = wrap.querySelector(".tt-rest");
    const rail = wrap.querySelector(".tt-rail");
    const mr = mirror.getBoundingClientRect();
    const rr = rest.getBoundingClientRect();
    rail.style.top = `${rr.top - mr.top}px`;
    rail.style.height = `${rr.height}px`;
    return { top: rr.top - mr.top, h: rr.height };
  });
console.log("b(인셋0):", JSON.stringify(await setRail()));
await shoot("lab-b-inset0");

// (c) 행간 1.4로 조이고(제목-서브 간격 카드처럼 타이트) 인셋 0
await p.addStyleTag({
  content:
    ".title-live-web .title-live-mirror, .title-live-web textarea { line-height: 1.4 !important; }"
});
await ta.fill("휴뱅\n정기휴뱅 "); // 재측정 트리거
await ta.fill("휴뱅\n정기휴뱅");
await p.waitForTimeout(300);
console.log("c(행간1.4+인셋0):", JSON.stringify(await setRail()));
await shoot("lab-c-lh14");

// (d) 행간 1.3
await p.addStyleTag({
  content:
    ".title-live-web .title-live-mirror, .title-live-web textarea { line-height: 1.3 !important; }"
});
await ta.fill("휴뱅\n정기휴뱅 ");
await ta.fill("휴뱅\n정기휴뱅");
await p.waitForTimeout(300);
console.log("d(행간1.3+인셋0):", JSON.stringify(await setRail()));
await shoot("lab-d-lh13");

await b.close();
