// 결정성 셀프테스트(PLAN-20260905-005 P0) — 하네스 자체가 믿을 만한지 스모크 시나리오 셋으로 잰다.
//   node scripts/ambient-qa/selftest.mjs [--base http://127.0.0.1:3100] [--only 3,10,14]
// 검사: ① 같은 URL 두 번 = 같은 픽셀 ② advance(1000) = advance(250)×4 = URL t=1000 ③ 얼림(실시간이 흘러도 t·픽셀 불변)
//       ④ 시간대 바꾸면 world().band가 따라오고 픽셀이 달라진다 ⑤ 시드 바꾸면 픽셀이 달라진다 ⑥ 허용 날씨 표(여름 눈 없음)
//       ⑦ 도착 상태(pending 0 · frozen · running false · settledT = t) ⑧ 페이지 에러 0.

import { SCENARIOS, SMOKE_IDS } from "./scenarios.mjs";
import { BASE, advance, assertServer, captureCanvas, fixtureUrl, launch, newPage, openFixture, parseArgs, sidOf, state } from "./lib.mjs";

const args = parseArgs();
const base = String(args.base ?? BASE);
const ids = args.only ? String(args.only).split(",").map(Number) : SMOKE_IDS;
const list = SCENARIOS.filter((s) => ids.includes(s.id)).map((s) => ({ ...s, seed: 42 }));
await assertServer(base);

let fails = 0;
const check = (name, ok, info = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? ` — ${info}` : ""}`);
  if (!ok) fails++;
};
const t0 = Date.now();
const browser = await launch();
const { page, errors } = await newPage(browser);
const shot = async () => (await captureCanvas(page)).hash;

for (const sc of list) {
  const sid = sidOf(sc);
  console.log(`\n── ${sid}`);
  // ① 같은 URL 두 번
  const u1500 = fixtureUrl(sc, { t: 1500 }, base);
  const s1 = await openFixture(page, u1500);
  const h1 = await shot();
  await openFixture(page, u1500);
  const h2 = await shot();
  check("① same URL → same frame", h1 === h2, `${h1} vs ${h2}`);
  // ⑦ 도착 상태
  check("⑦ settled state", s1.pending === 0 && s1.frozen === true && s1.running === false && Math.abs(s1.settledT - 1.5) < 0.02, `pending=${s1.pending} frozen=${s1.frozen} running=${s1.running} settledT=${s1.settledT} frames=${s1.frames}`);
  // ② advance 경로 동치
  const u0 = fixtureUrl(sc, { t: 0 }, base);
  await openFixture(page, u0);
  await advance(page, 1000);
  const hA = await shot();
  await openFixture(page, u0);
  for (let i = 0; i < 4; i++) await advance(page, 250);
  const hB = await shot();
  const sB = await state(page);
  await openFixture(page, fixtureUrl(sc, { t: 1000 }, base));
  const hC = await shot();
  check("② advance(1000) = 4×advance(250) = URL t=1000", hA === hB && hB === hC, `${hA} / ${hB} / ${hC} · t=${sB.t}`);
  // ③ 얼림
  await openFixture(page, u1500);
  const hF1 = await shot();
  const tF1 = (await state(page)).t;
  await page.waitForTimeout(700);
  const hF2 = await shot();
  const sF2 = await state(page);
  check("③ frozen: real time passes, t/frame unchanged", hF1 === hF2 && tF1 === sF2.t && sF2.running === false, `t=${tF1}→${sF2.t}`);
  // ④ 시간대
  const other = sc.band === "night" ? "noon" : "night";
  const sBand = await openFixture(page, fixtureUrl(sc, { band: other, t: 1500 }, base));
  const hBand = await shot();
  check(`④ band ${sc.band} → ${other} changes frame + world().band`, hBand !== h1 && sBand.world.band === other, `band=${sBand.world.band} ${h1}→${hBand}`);
  // ⑤ 시드
  await openFixture(page, fixtureUrl({ ...sc, seed: 7 }, { t: 1500 }, base));
  const hSeed = await shot();
  const sSeed = await state(page);
  check("⑤ seed 42 → 7 changes frame", hSeed !== h1 && sSeed.seed === 7, `seed=${sSeed.seed} ${h1}→${hSeed}`);
  // ⑥ 허용 날씨
  const opts = await page.evaluate(() => window.__vicAmbient.weatherOptions());
  const snowOk = sc.season === "winter" ? opts.includes("snow") : !opts.includes("snow");
  check("⑥ weatherOptions follows the month table", Array.isArray(opts) && opts.includes("clear") && snowOk, `${sc.season}: ${opts.join(",")}`);
}
// ⑧ 페이지 에러
check("⑧ no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
console.log(`\n${fails ? `${fails} FAILED` : "ALL PASSED"} · ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(fails ? 1 : 0);
