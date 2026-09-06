// 스폰 위치 프로브(라운드 1, A-1 수용 기준용) — 여러 시드에서 랜덤 이벤트(다람쥐·회오리 등)가 **처음 나타난 자리**와 **살아 있는 동안의
// 최소 y**를 잰다. 걷는 생물이 지평선 띠(v < .12)나 그 근처(v < .18)에서 태어나거나 지나가면 A-1(공중 보행) 위반이다.
//   node scripts/ambient-qa/spawn-probe.mjs --only 3 --seeds 24 [--from 15000 --to 40000 --step 500] [--watch squirrel,whirl] [--band morning]
// 장면 debug()가 `[x, y, …]` 배열로 노출하는 키만 볼 수 있다(autumn: squirrel · whirl). 출력 = 시드별 표 + 요약(v<.18 비율, 최소 v).

import { byId } from "./scenarios.mjs";
import { BASE, advance, assertServer, fixtureUrl, launch, newPage, openFixture, parseArgs } from "./lib.mjs";

const args = parseArgs();
const base = String(args.base ?? BASE);
const sc0 = byId(args.only ?? 3);
if (!sc0) {
  console.error("--only <시나리오 id>");
  process.exit(2);
}
const seeds = Number(args.seeds ?? 24);
const from = Number(args.from ?? 15000);
const to = Number(args.to ?? 40000);
const step = Number(args.step ?? 500);
const watch = String(args.watch ?? "squirrel,whirl").split(",").filter(Boolean);
const HZ_V = 0.26; // = world/view.ts HORIZON_V(2026-09-06 하늘 확대). 0.12로 두면 v가 두 배로 부풀어 A-1 판정이 무효(라운드 8·9 검토 B 지적)
const FLOOR_V = 0.18;
await assertServer(base);

const browser = await launch();
const { page } = await newPage(browser);
const rows = [];
const t0 = Date.now();
for (let seed = 1; seed <= seeds; seed++) {
  const sc = { ...sc0, seed, band: args.band ?? sc0.band };
  await openFixture(page, fixtureUrl(sc, { t: from }, base));
  const h = await page.evaluate(() => document.querySelector("canvas.gs-season").offsetHeight);
  const hz = h * HZ_V;
  const vOf = (y) => (y - hz) / (h - hz);
  const first = {};
  const minY = {};
  const prev = {};
  for (let t = from; t <= to; t += step) {
    if (t > from) await advance(page, step);
    const s = await page.evaluate(() => {
      const d = window.__vicAmbient.scene();
      const out = {};
      for (const k of Object.keys(d)) if (Array.isArray(d[k]) && typeof d[k][0] === "number" && typeof d[k][1] === "number") out[k] = d[k];
      return out;
    });
    for (const k of watch) {
      const v = s[k];
      if (v && !prev[k]) first[k] = { t, x: v[0], y: v[1], v: vOf(v[1]) };
      if (v) minY[k] = Math.min(minY[k] ?? Infinity, v[1]);
      prev[k] = !!v;
    }
  }
  const row = { seed };
  for (const k of watch) {
    row[k] = first[k] ? { ...first[k], v: Math.round(first[k].v * 1000) / 1000, minV: Math.round(vOf(minY[k]) * 1000) / 1000 } : null;
  }
  rows.push(row);
  console.log(`seed ${String(seed).padStart(2)} · ${watch.map((k) => (row[k] ? `${k}@${(row[k].t / 1000).toFixed(1)}s (${row[k].x},${row[k].y}) v=${row[k].v} minV=${row[k].minV}` : `${k} —`)).join(" · ")}`);
}
await browser.close();

console.log(`\n── 요약(${sc0.biome}/${sc0.season}/${args.band ?? sc0.band}/${sc0.weather}, ${from / 1000}~${to / 1000}s, 시드 1~${seeds}) · ${Math.round((Date.now() - t0) / 1000)}s`);
for (const k of watch) {
  const seen = rows.map((r) => r[k]).filter(Boolean);
  if (!seen.length) {
    console.log(`${k}: 등장 0`);
    continue;
  }
  const spawnLow = seen.filter((s) => s.v < FLOOR_V).length;
  const spawnSky = seen.filter((s) => s.v < 0).length;
  const pathLow = seen.filter((s) => s.minV < FLOOR_V).length;
  const pathSky = seen.filter((s) => s.minV < 0).length;
  const minSpawn = Math.min(...seen.map((s) => s.v));
  const minPath = Math.min(...seen.map((s) => s.minV));
  console.log(
    `${k}: 등장 ${seen.length}/${seeds} · 출발 v<${FLOOR_V} ${spawnLow}건(지평선 위 ${spawnSky}) · 경로 최소 v<${FLOOR_V} ${pathLow}건(지평선 위 ${pathSky}) · 최소 출발 v ${minSpawn.toFixed(3)} · 최소 경로 v ${minPath.toFixed(3)}`
  );
}
