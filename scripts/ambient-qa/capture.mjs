// 캡처(PLAN-20260905-005 P1) — 대표 시나리오를 결정적 fixture로 열어 정적·시간·시간대·날씨 프레임을 PNG로 받는다.
//   node scripts/ambient-qa/capture.mjs --round 01 --phase before [--smoke | --only 3,10] [--kinds static,temporal,band,weather]
//                                       [--seed 42] [--base http://127.0.0.1:3100]
// 산출: .scratch-pw/qa/r01/before/<sid>/{static.png, temporal-0000.png…, band-<b>.png, weather-<w>.png, meta.json, index.md}
//       + r01/before/index.md · phase.json. 시트는 sheet.mjs, diff는 diff.mjs가 이 폴더를 읽는다.
// 결정성: 정적·시간대·날씨는 **URL(t=1500)**로, 시간 시트는 t=0 페이지에서 advance()를 누적한다(같은 dt·같은 걸음 수 = 같은 프레임).

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SEED, SCENARIOS, SMOKE_IDS } from "./scenarios.mjs";
import {
  BANDS,
  BASE,
  KO,
  STATIC_T,
  TEMPORAL_MS,
  VIEWPORT,
  advance,
  assertServer,
  captureCanvas,
  ensureDir,
  fixtureUrl,
  gitInfo,
  launch,
  newPage,
  nowIso,
  openFixture,
  parseArgs,
  roundDir,
  sidOf,
  state,
  titleOf,
  writeJson
} from "./lib.mjs";

const args = parseArgs();
const round = String(args.round ?? "00");
const phase = String(args.phase ?? "before");
const base = String(args.base ?? BASE);
const seed = Number(args.seed ?? DEFAULT_SEED);
const kinds = String(args.kinds ?? "static,temporal,band,weather")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const only = args.smoke ? SMOKE_IDS : args.only ? String(args.only).split(",").map(Number) : null;
const list = SCENARIOS.filter((s) => !only || only.includes(s.id)).map((s) => ({ ...s, seed }));

await assertServer(base);
const outDir = roundDir(round, phase);
ensureDir(outDir);
const git = gitInfo();
console.log(`capture → ${outDir} · ${list.length} scenarios · kinds ${kinds.join("/")} · seed ${seed} · build ${git.commit}${git.dirty ? "(dirty)" : ""}`);

const browser = await launch();
const { page, errors } = await newPage(browser);
const phaseIndex = [];
const t0 = Date.now();

for (const sc of list) {
  const sid = sidOf(sc);
  const dir = path.join(outDir, sid);
  ensureDir(dir);
  const meta = { sid, title: titleOf(sc), scenario: sc, round, phase, base, git, createdAt: nowIso(), viewport: VIEWPORT, frames: [], pageErrors: [] };
  const shot = async (file, url, extra) => {
    const cap = await captureCanvas(page);
    fs.writeFileSync(path.join(dir, file), cap.png);
    const st = await state(page);
    meta.frames.push({ file, url, t: Math.round(st.t * 1000) / 1000, hash: cap.hash, bytes: cap.bytes, world: st.world, scene: st.scene, pending: st.pending, ...extra });
  };
  if (kinds.includes("static")) {
    const url = fixtureUrl(sc, { t: STATIC_T }, base);
    await openFixture(page, url);
    await shot("static.png", url, { kind: "static" });
  }
  if (kinds.includes("temporal")) {
    const url = fixtureUrl(sc, { t: 0 }, base);
    await openFixture(page, url);
    let prev = 0;
    for (const ms of TEMPORAL_MS) {
      if (ms > prev) await advance(page, ms - prev);
      prev = ms;
      await shot(`temporal-${String(ms).padStart(4, "0")}.png`, url, { kind: "temporal", ms });
    }
  }
  if (kinds.includes("band")) {
    for (const b of BANDS) {
      const url = fixtureUrl(sc, { band: b, t: STATIC_T }, base);
      await openFixture(page, url);
      await shot(`band-${b}.png`, url, { kind: "band", band: b });
    }
  }
  if (kinds.includes("weather")) {
    // 허용 날씨는 엔진이 정본(월별 확률표 > 0) — 금지 조합(여름 눈)은 목록에 없다.
    await openFixture(page, fixtureUrl(sc, { t: 0 }, base));
    const opts = await page.evaluate(() => window.__vicAmbient.weatherOptions());
    meta.weatherOptions = opts;
    for (const w of opts) {
      const url = fixtureUrl(sc, { weather: w, t: STATIC_T }, base);
      await openFixture(page, url);
      await shot(`weather-${w}.png`, url, { kind: "weather", weather: w });
    }
  }
  meta.pageErrors = errors.splice(0);
  writeJson(path.join(dir, "meta.json"), meta);
  fs.writeFileSync(path.join(dir, "index.md"), scenarioIndex(meta));
  phaseIndex.push(meta);
  console.log(`✓ ${sid} — ${meta.frames.length} frames${meta.pageErrors.length ? ` · ⚠ page errors ${meta.pageErrors.length}` : ""}`);
}

fs.writeFileSync(path.join(outDir, "index.md"), phaseIndexMd(round, phase, phaseIndex));
writeJson(path.join(outDir, "phase.json"), {
  round,
  phase,
  base,
  seed,
  kinds,
  git,
  createdAt: nowIso(),
  elapsedSec: Math.round((Date.now() - t0) / 1000),
  scenarios: phaseIndex.map((m) => ({ sid: m.sid, id: m.scenario.id, frames: m.frames.length, pageErrors: m.pageErrors.length }))
});
await browser.close();
console.log(`done · ${Math.round((Date.now() - t0) / 1000)}s → ${path.join(outDir, "index.md")}`);

// ── 인덱스(검사 에이전트가 읽는 형태: 캡션 = 바이옴/계절/시간대/날씨/시드/t) ──────────────────────────────────
function scenarioIndex(m) {
  const sc = m.scenario;
  const rows = m.frames
    .map((f) => {
      const w = f.world ?? {};
      return `| [${f.file}](${f.file}) | ${f.kind} | ${f.t} | ${KO.band[w.band] ?? w.band} | ${KO.weather[w.weather] ?? w.weather} | \`${f.hash}\` |`;
    })
    .join("\n");
  const staticFrame = m.frames.find((f) => f.kind === "static") ?? m.frames[0];
  return `# ${m.sid} — ${m.title} · seed ${sc.seed}

- 라운드 r${m.round} · ${m.phase} · 빌드 \`${m.git.commit}\`${m.git.dirty ? " (dirty)" : ""} · 캡처 ${m.createdAt}
- 조합: biome **${sc.biome}** / season **${sc.season}** / band **${sc.band}** / weather **${sc.weather}** / seed **${sc.seed}** / camera showcase · 뷰포트 ${m.viewport.width}×${m.viewport.height}
- 왜 이 조합: ${sc.why} · 주 검사자 ${sc.agents}
- 시트(sheet.mjs 뒤): [temporal-sheet.png](temporal-sheet.png) · [band-sheet.png](band-sheet.png) · [weather-sheet.png](weather-sheet.png) · [static-gray.png](static-gray.png) · diff(diff.mjs 뒤): temporal-diff-*.png · [diff.json](diff.json)
${m.weatherOptions ? `- 허용 날씨(이 달): ${m.weatherOptions.map((w) => KO.weather[w] ?? w).join(" · ")}\n` : ""}
## 프레임

| 파일 | 종류 | t(s) | 띠 | 날씨 | 해시 |
|---|---|---|---|---|---|
${rows}

## 장면 상태(${staticFrame?.file ?? "-"} 시점, debug())

\`\`\`json
${JSON.stringify({ world: staticFrame?.world, scene: staticFrame?.scene }, null, 2)}
\`\`\`

## 페이지 에러

${m.pageErrors.length ? m.pageErrors.map((e) => `- ${e}`).join("\n") : "없음"}
`;
}

function phaseIndexMd(round, phase, metas) {
  const rows = metas
    .map((m) => {
      const sc = m.scenario;
      const st = m.frames.find((f) => f.kind === "static");
      return `| ${sc.id} | [${m.sid}](${m.sid}/index.md) | ${m.title} | ${sc.seed} | ${m.frames.length} | ${st ? `[static](${m.sid}/static.png)` : "-"} | ${m.pageErrors.length} |`;
    })
    .join("\n");
  return `# r${round} · ${phase} — 캡처 인덱스

빌드 \`${metas[0]?.git.commit ?? "?"}\`${metas[0]?.git.dirty ? " (dirty)" : ""} · ${metas[0]?.createdAt ?? ""} · 뷰포트 ${VIEWPORT.width}×${VIEWPORT.height} · 프레임 = 캔버스만(폰트·크롬 없음)

| # | 폴더 | 조합 | 시드 | 프레임 | 정적 | 에러 |
|---|---|---|---|---|---|---|
${rows}

읽는 법: 폴더의 \`index.md\` → 프레임 표(캡션 = 바이옴/계절/띠/날씨/t/해시) → 시트(\`*-sheet.png\`)·diff(\`temporal-diff-*.png\`).
`;
}
