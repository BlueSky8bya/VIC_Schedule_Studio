// 레일 실측 실험실: 카드(.studio-event-pill .pill-subs) 정본 지오메트리를 재고,
// 입력칸에 CSS 후보를 주입해 스냅샷으로 비교한다(리빌드 없이).
import { chromium } from "playwright";
import path from "node:path";

const SHOT = process.env.SHOT_DIR ?? ".";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await p.goto("http://localhost:3000/visual-fixture/studio", { waitUntil: "networkidle" });
await p.waitForSelector(".studio-month-grid", { timeout: 15000 });

// ── 1) 카드 정본 측정: 시참의날(서브 있음) 카드
const cardM = await p.evaluate(() => {
  const pills = [...document.querySelectorAll(".studio-event-pill")];
  const pill = pills.find((el) => el.querySelector(".pill-subs li"));
  if (!pill) return null;
  const ul = pill.querySelector(".pill-subs");
  const li = ul.querySelector("li");
  const range = document.createRange();
  range.selectNodeContents(li);
  const textRect = range.getBoundingClientRect(); // 글리프 줄박스
  const ulRect = ul.getBoundingClientRect();
  const ulCs = getComputedStyle(ul);
  const liCs = getComputedStyle(li);
  return {
    railTopVsText: ulRect.top - textRect.top, // 레일이 텍스트 줄박스보다 얼마나 위(음수=위)
    railBottomVsText: ulRect.bottom - textRect.bottom,
    gap: parseFloat(ulCs.paddingLeft), // 레일(border 자리)→텍스트 간격
    subFont: liCs.fontSize,
    subLh: liCs.lineHeight,
    ulHeight: ulRect.height,
    textHeight: textRect.height
  };
});
console.log("카드 정본:", JSON.stringify(cardM));

// 카드 줌샷(비교 기준)
const pillBox = await p.evaluate(() => {
  const pill = [...document.querySelectorAll(".studio-event-pill")].find((el) =>
    el.querySelector(".pill-subs li")
  );
  const r = pill.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
await p.screenshot({ path: path.join(SHOT, "lab-card.png"), clip: pillBox });

// ── 2) 입력칸 열고 같은 내용 입력
await p.locator('.studio-month-grid [data-isodate]').nth(8).click();
await p.waitForSelector(".event-editor-panel .title-live-web", { timeout: 8000 });
await p.locator(".event-editor-panel .title-live-web textarea").fill("휴뱅\n정기휴뱅");
await p.waitForTimeout(300);

// 현재 상태 측정: 미러 rest rect vs 레일 rect
const inputM = await p.evaluate(() => {
  const wrap = document.querySelector(".title-live-web");
  const rest = wrap.querySelector(".tt-rest");
  const rail = wrap.querySelector(".tt-rail");
  const rr = rest.getBoundingClientRect();
  const kr = rail.getBoundingClientRect();
  const ta = wrap.querySelector("textarea");
  const cs = getComputedStyle(ta);
  return {
    railTopVsText: kr.top - rr.top,
    railBottomVsText: kr.bottom - rr.bottom,
    railLeft: kr.left - wrap.getBoundingClientRect().left,
    textLeft: rr.left - wrap.getBoundingClientRect().left,
    font: cs.fontSize,
    lh: cs.lineHeight
  };
});
console.log("입력칸 현재:", JSON.stringify(inputM));

// ── 3) 후보 주입: 카드와 같은 규칙 = 레일이 '텍스트 줄박스 전체'를 덮음(인셋 0) + 간격 8px.
//     JS 인셋(+4/-8)을 CSS로 상쇄해 무빌드로 실험: transform 사용.
for (const [name, css] of [
  ["v1-inset0", `.title-live .tt-rail{ transform: translateY(-4px); } .title-live-web .tt-rail{ height: auto; }`],
  ["v2-tight-lh", `.title-live-web .title-live-mirror, .title-live-web textarea{ line-height:1.35 !important; }`]
]) {
  // 초기화 후 각각 적용해보긴 복잡 — v1은 transform만(높이는 JS가 -8 했으니 +8 보정 불가). 스킵 가능.
  void name; void css;
}
// 실제로는 CSS 파일 수정이 필요한 값이므로, 여기선 정확한 목표치만 계산해 출력한다.
await p.screenshot({ path: path.join(SHOT, "lab-input.png"), clip: await p.locator(".title-live-web").boundingBox() });
await b.close();
