// contact sheet(PLAN-20260905-005 P1) — 캡처 폴더의 프레임을 한 장에 모은다(브라우저 캔버스 합성 — 추가 의존성 없음).
//   node scripts/ambient-qa/sheet.mjs --round 01 --phase before [--smoke | --only 3,10] [--cols 3] [--scale 0.5]
// 산출(시나리오 폴더 안): temporal-sheet.png(0/250/500/1000/2000/4000ms) · band-sheet.png(새벽~밤) · weather-sheet.png(허용 날씨) ·
//   static-gray.png(흑백 — 바이옴 정체성 R-2 판정용). 라벨은 각 칸 아래 캡션 줄에.

import fs from "node:fs";
import path from "node:path";
import { SMOKE_IDS } from "./scenarios.mjs";
import { BANDS, KO, launch, listScenarioDirs, parseArgs, pngDataUrl, roundDir } from "./lib.mjs";

const args = parseArgs();
const round = String(args.round ?? "00");
const phase = String(args.phase ?? "before");
const cols = Number(args.cols ?? 3);
const scale = Number(args.scale ?? 0.5);
const only = args.smoke ? SMOKE_IDS : args.only ? String(args.only).split(",").map(Number) : null;
const phaseDir = roundDir(round, phase);
const entries = listScenarioDirs(phaseDir, only);
if (!entries.length) {
  console.error(`캡처가 없다: ${phaseDir} (먼저 capture.mjs)`);
  process.exit(2);
}

const browser = await launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body style='margin:0;background:#fff'></body></html>");

/** 브라우저 안에서 합성: 제목 띠 + 격자(각 칸 아래 캡션). */
async function compose(tiles, title, colsOverride) {
  const dataUrl = await page.evaluate(
    async ({ tiles, title, cols, scale }) => {
      const load = (src) =>
        new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => rej(new Error("image load failed"));
          im.src = src;
        });
      const imgs = await Promise.all(tiles.map((t) => load(t.src)));
      const tw = Math.round(imgs[0].width * scale);
      const th = Math.round(imgs[0].height * scale);
      const cap = 26;
      const gap = 10;
      const head = 34;
      const c = Math.min(cols, tiles.length);
      const rows = Math.ceil(tiles.length / c);
      const W = c * tw + (c + 1) * gap;
      const H = head + rows * (th + cap + gap) + gap;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const g = cv.getContext("2d");
      g.fillStyle = "#f4f2ee";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#2b2f38";
      g.font = "bold 15px system-ui, sans-serif";
      g.textBaseline = "middle";
      g.fillText(title, gap, head / 2);
      g.font = "12px system-ui, sans-serif";
      imgs.forEach((im, i) => {
        const col = i % c;
        const row = Math.floor(i / c);
        const x = gap + col * (tw + gap);
        const y = head + row * (th + cap + gap);
        g.drawImage(im, x, y, tw, th);
        g.strokeStyle = "rgba(0,0,0,0.18)";
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
        g.fillStyle = "#3d414c";
        g.fillText(tiles[i].label, x + 4, y + th + cap / 2);
      });
      return cv.toDataURL("image/png");
    },
    { tiles, title, cols: colsOverride ?? cols, scale }
  );
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function gray(src) {
  const dataUrl = await page.evaluate(async (src) => {
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("image load failed"));
      i.src = src;
    });
    const cv = document.createElement("canvas");
    cv.width = im.width;
    cv.height = im.height;
    const g = cv.getContext("2d");
    g.filter = "grayscale(1)";
    g.drawImage(im, 0, 0);
    return cv.toDataURL("image/png");
  }, src);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

let made = 0;
for (const { sid, dir, meta } of entries) {
  const title = `${sid} — ${meta.title} · seed ${meta.scenario.seed} · ${meta.phase}`;
  const byKind = (k) => meta.frames.filter((f) => f.kind === k);
  const temporal = byKind("temporal").sort((a, b) => a.ms - b.ms);
  if (temporal.length) {
    fs.writeFileSync(path.join(dir, "temporal-sheet.png"), await compose(temporal.map((f) => ({ src: pngDataUrl(path.join(dir, f.file)), label: `t = ${f.ms} ms · ${f.hash}` })), `${title} · 시간`));
    made++;
  }
  const long = byKind("long").sort((a, b) => a.ms - b.ms);
  if (long.length) {
    fs.writeFileSync(path.join(dir, "long-sheet.png"), await compose(long.map((f) => ({ src: pngDataUrl(path.join(dir, f.file)), label: `t = ${f.ms / 1000}s · ${f.hash}${f.scene?.sqPhase !== undefined ? ` · sq ${f.scene.sqPhase}` : ""}` })), `${title} · 긴 시간(첫 랜덤 이벤트 창)`, 4));
    made++;
  }
  const band = byKind("band").sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band));
  if (band.length) {
    fs.writeFileSync(path.join(dir, "band-sheet.png"), await compose(band.map((f) => ({ src: pngDataUrl(path.join(dir, f.file)), label: `${KO.band[f.band]} ${f.band} · ${f.hash}` })), `${title} · 시간대`));
    made++;
  }
  const weather = byKind("weather");
  if (weather.length) {
    fs.writeFileSync(path.join(dir, "weather-sheet.png"), await compose(weather.map((f) => ({ src: pngDataUrl(path.join(dir, f.file)), label: `${KO.weather[f.weather]} ${f.weather} · ${f.hash}` })), `${title} · 날씨`));
    made++;
  }
  const st = byKind("static")[0];
  if (st) {
    fs.writeFileSync(path.join(dir, "static-gray.png"), await gray(pngDataUrl(path.join(dir, st.file))));
    made++;
  }
  console.log(`✓ ${sid} — 시트 ${[temporal.length && "temporal", long.length && "long", band.length && "band", weather.length && "weather", st && "gray"].filter(Boolean).join("/")}`);
}
await browser.close();
console.log(`done · ${made} sheets → ${phaseDir}`);
