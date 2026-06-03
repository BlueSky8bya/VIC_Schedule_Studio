import { chromium } from "@playwright/test";
const OUT = "C:/Projects/VIC Schedule studio/.verify";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://127.0.0.1:3000/studio", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(1000);
// 시청자 화면 미리보기 진입
await p.getByRole("button", { name: /시청자 화면/ }).first().click().catch(() => {});
await p.waitForTimeout(1500);
const hasPoster = await p.locator(".public-month-grid").count();
console.log("public-month-grid:", hasPoster);
if (!hasPoster) { console.log("no poster"); await b.close(); process.exit(0); }

const res = await p.evaluate(() => {
  const days = [...document.querySelectorAll(".public-month-grid .public-day:not(.outside)")];
  if (days.length < 2) return { err: "not enough in-month cells", n: days.length };
  // 같은 줄의 인접 두 칸 찾기(top 같은)
  let a = null, c = null;
  for (let i = 0; i < days.length - 1; i++) {
    const r1 = days[i].getBoundingClientRect(), r2 = days[i + 1].getBoundingClientRect();
    if (Math.abs(r1.top - r2.top) < 2) { a = days[i]; c = days[i + 1]; break; }
  }
  if (!a || !c) return { err: "no adjacent same-row" };
  const de = (cell) => cell.querySelector(".day-events");
  const mk = (long) =>
    `<div class="public-event span ${long ? "no-right" : "no-left"}"><div class="event-main"><p>${long ? "휴뱅" : "휴뱅"}</p></div>${long ? '<ul class="event-subs"><li>여교멤보고온다 부럽지~</li><li>3일에 봐요</li></ul>' : ""}</div>`;
  de(a).innerHTML = mk(true);
  de(c).innerHTML = mk(false);
  // 강제 reflow
  void a.offsetHeight;
  const ea = a.querySelector(".public-event").getBoundingClientRect();
  const ec = c.querySelector(".public-event").getBoundingClientRect();
  return { aH: Math.round(ea.height), cH: Math.round(ec.height), cellA: Math.round(a.getBoundingClientRect().height), cellC: Math.round(c.getBoundingClientRect().height) };
});
console.log("RESULT:", JSON.stringify(res));
await p.screenshot({ path: `${OUT}/poster-inject.png` });
await b.close();
