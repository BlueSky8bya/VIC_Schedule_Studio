// diff(PLAN-20260905-005 P1) — 두 프레임의 절대차를 히트맵으로(브라우저 캔버스, 추가 의존성 없음).
//   시간 시트 인접 프레임:  node scripts/ambient-qa/diff.mjs --round 01 --phase before [--smoke | --only 3]
//       → <sid>/temporal-diff-0250.png(0→250) … + diff.json {pairs:[{a,b,changedRatio,meanMag,blocks:{max,mean,hot}}]}
//   전/후 비교:            node scripts/ambient-qa/diff.mjs --round 01 --compare before,after [--only 3]
//       → r01/compare-before-after/<sid>/<file>.png + compare.md · compare.json (같은 파일 이름끼리, 해시가 같으면 diff 생략)
// 히트맵: 안 바뀐 곳 = A의 어두운 흑백, 바뀐 곳 = 크기에 따라 노랑 → 빨강. blocks = 20×12 격자의 블록 평균(국소 점프 = 루프 이음매 M-2 힌트).

import fs from "node:fs";
import path from "node:path";
import { SMOKE_IDS } from "./scenarios.mjs";
import { launch, listScenarioDirs, parseArgs, pngDataUrl, roundDir, writeJson } from "./lib.mjs";

const args = parseArgs();
const round = String(args.round ?? "00");
const only = args.smoke ? SMOKE_IDS : args.only ? String(args.only).split(",").map(Number) : null;
const THRESHOLD = Number(args.threshold ?? 6);

const browser = await launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body style='margin:0'></body></html>");

async function diffPair(fileA, fileB) {
  const r = await page.evaluate(
    async ({ a, b, thr }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => rej(new Error("image load failed"));
          im.src = src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.min(ia.width, ib.width);
      const h = Math.min(ia.height, ib.height);
      const mk = () => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      };
      const ca = mk();
      const cb = mk();
      ca.getContext("2d").drawImage(ia, 0, 0);
      cb.getContext("2d").drawImage(ib, 0, 0);
      const da = ca.getContext("2d").getImageData(0, 0, w, h).data;
      const db = cb.getContext("2d").getImageData(0, 0, w, h).data;
      const out = mk();
      const og = out.getContext("2d");
      const od = og.createImageData(w, h);
      const o = od.data;
      const GX = 20;
      const GY = 12;
      const blocks = new Float64Array(GX * GY);
      const bw = w / GX;
      const bh = h / GY;
      let changed = 0;
      let sum = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const m = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
          blocks[Math.min(GY - 1, Math.floor(y / bh)) * GX + Math.min(GX - 1, Math.floor(x / bw))] += m;
          if (m > thr) {
            changed++;
            sum += m;
            const k = Math.min(1, m / 160);
            o[i] = 255;
            o[i + 1] = Math.round(220 - 170 * k);
            o[i + 2] = Math.round(70 - 40 * k);
            o[i + 3] = 255;
          } else {
            const l = (da[i] * 0.3 + da[i + 1] * 0.59 + da[i + 2] * 0.11) * 0.32;
            o[i] = o[i + 1] = o[i + 2] = Math.round(l);
            o[i + 3] = 255;
          }
        }
      }
      og.putImageData(od, 0, 0);
      const per = bw * bh;
      let bmax = 0;
      let bsum = 0;
      let hot = 0;
      for (let k = 0; k < blocks.length; k++) {
        blocks[k] /= per;
        bsum += blocks[k];
        if (blocks[k] > bmax) {
          bmax = blocks[k];
          hot = k;
        }
      }
      const bmean = bsum / blocks.length;
      return {
        w,
        h,
        changedRatio: changed / (w * h),
        meanMag: changed ? sum / changed : 0,
        blocks: { cols: GX, rows: GY, max: bmax, mean: bmean, ratio: bmean > 0 ? bmax / bmean : 0, hot: { col: hot % GX, row: Math.floor(hot / GX) } },
        dataUrl: out.toDataURL("image/png")
      };
    },
    { a: pngDataUrl(fileA), b: pngDataUrl(fileB), thr: THRESHOLD }
  );
  const png = Buffer.from(r.dataUrl.slice(r.dataUrl.indexOf(",") + 1), "base64");
  delete r.dataUrl;
  return { ...r, png };
}

const fmt = (x) => (Math.round(x * 10000) / 100).toFixed(2);

if (args.compare) {
  // ── 전/후 비교 ──
  const [pa, pb] = String(args.compare).split(",");
  if (!pa || !pb) {
    console.error("--compare before,after 형식");
    process.exit(2);
  }
  const A = listScenarioDirs(roundDir(round, pa), only);
  const B = listScenarioDirs(roundDir(round, pb), only);
  const outDir = path.join(roundDir(round, `compare-${pa}-${pb}`));
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const ea of A) {
    const eb = B.find((e) => e.sid === ea.sid);
    if (!eb) continue;
    const dir = path.join(outDir, ea.sid);
    fs.mkdirSync(dir, { recursive: true });
    for (const fa of ea.meta.frames) {
      const fb = eb.meta.frames.find((f) => f.file === fa.file);
      if (!fb) continue;
      if (fa.hash === fb.hash) {
        report.push({ sid: ea.sid, file: fa.file, same: true, changedRatio: 0, meanMag: 0 });
        continue;
      }
      const d = await diffPair(path.join(ea.dir, fa.file), path.join(eb.dir, fb.file));
      fs.writeFileSync(path.join(dir, fa.file), d.png);
      report.push({ sid: ea.sid, file: fa.file, same: false, changedRatio: d.changedRatio, meanMag: d.meanMag, blocks: d.blocks, heatmap: path.join(ea.sid, fa.file) });
    }
    console.log(`✓ ${ea.sid}`);
  }
  writeJson(path.join(outDir, "compare.json"), { round, before: pa, after: pb, threshold: THRESHOLD, pairs: report });
  const rows = report.map((r) => `| ${r.sid} | ${r.file} | ${r.same ? "같음" : `**${fmt(r.changedRatio)}%**`} | ${r.same ? "-" : r.meanMag.toFixed(1)} | ${r.same ? "-" : `[히트맵](${r.heatmap.replace(/\\/g, "/")})`} |`).join("\n");
  fs.writeFileSync(
    path.join(outDir, "compare.md"),
    `# r${round} — ${pa} → ${pb} 비교\n\n임계 ${THRESHOLD}/255 · 바뀐 픽셀 비율(%) · 평균 변화 크기\n\n| 시나리오 | 파일 | 바뀐 비율 | 평균 크기 | 히트맵 |\n|---|---|---|---|---|\n${rows}\n`
  );
  await browser.close();
  console.log(`done → ${path.join(outDir, "compare.md")}`);
} else {
  // ── 시간 시트 인접 프레임 diff ──
  const phase = String(args.phase ?? "before");
  const entries = listScenarioDirs(roundDir(round, phase), only);
  if (!entries.length) {
    console.error(`캡처가 없다: ${roundDir(round, phase)} (먼저 capture.mjs)`);
    process.exit(2);
  }
  for (const { sid, dir, meta } of entries) {
    const pairs = [];
    // 인접 프레임 diff — 시간 시트(0~4s)와 긴 시간 시트(15~30s, 있을 때).
    for (const kind of ["temporal", "long"]) {
      const frames = meta.frames.filter((f) => f.kind === kind).sort((a, b) => a.ms - b.ms);
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1];
        const b = frames[i];
        const d = await diffPair(path.join(dir, a.file), path.join(dir, b.file));
        const file = `${kind}-diff-${String(b.ms).padStart(kind === "long" ? 5 : 4, "0")}.png`;
        fs.writeFileSync(path.join(dir, file), d.png);
        pairs.push({ kind, a: a.file, b: b.file, msA: a.ms, msB: b.ms, file, changedRatio: d.changedRatio, meanMag: d.meanMag, blocks: d.blocks });
      }
    }
    writeJson(path.join(dir, "diff.json"), { sid, threshold: THRESHOLD, pairs });
    const idx = path.join(dir, "index.md");
    if (fs.existsSync(idx)) {
      // 있던 diff 절은 갈아 낀다(캡처를 덧붙인 뒤 다시 돌릴 수 있게).
      const cur = fs.readFileSync(idx, "utf8");
      const cut = cur.indexOf("\n## 시간 diff");
      const head = cut >= 0 ? cur.slice(0, cut) : cur;
      const rows = pairs.map((p) => `| ${p.kind} | ${p.msA} → ${p.msB} ms | ${fmt(p.changedRatio)}% | ${p.meanMag.toFixed(1)} | ${p.blocks.ratio.toFixed(1)}× (${p.blocks.hot.col},${p.blocks.hot.row}) | [히트맵](${p.file}) |`).join("\n");
      fs.writeFileSync(idx, `${head}\n## 시간 diff(인접 프레임, 임계 ${THRESHOLD})\n\n| 시트 | 구간 | 바뀐 비율 | 평균 크기 | 최대 블록/평균(위치) | 파일 |\n|---|---|---|---|---|---|\n${rows}\n\n블록 비가 크고(≥ 6×) 한 곳에 몰리면 국소 점프(랩·리셋) 후보 — M-2. 블록 격자 20×12(한 칸 70×72px).\n`);
    }
    console.log(`✓ ${sid} — ${pairs.length} diffs · 바뀐 비율 ${pairs.map((p) => fmt(p.changedRatio)).join(" / ")}%`);
  }
  await browser.close();
  console.log("done");
}
