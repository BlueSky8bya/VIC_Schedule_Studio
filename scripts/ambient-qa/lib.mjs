// 앰비언트 비주얼 QA 공용(2026-09-05, PLAN-20260905-005 P1) — 결정적 fixture(/visual-fixture/biome)를 열고 **캔버스만** PNG로 받는다.
// 폰트·OS가 끼지 않는다(DOM 스크린샷이 아니다). 서버: 프로덕션 빌드 + `VISUAL_TEST_FIXTURE=1 npx next start -p 3100 -H 127.0.0.1`.
// 산출물은 .scratch-pw/qa/r<NN>/<phase>/<sid>/ — 추적하지 않는다(라운드 기록엔 경로만).

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export const BASE = process.env.AMBIENT_QA_BASE || "http://127.0.0.1:3100";
export const OUT_ROOT = path.join(".scratch-pw", "qa");
export const VIEWPORT = { width: 1400, height: 860 };
/** 정적·시간대·날씨 프레임의 시각(ms) — 굽기·첫 스폰이 자리 잡은 뒤. */
export const STATIC_T = 1500;
/** 시간 시트의 시각들(ms). */
export const TEMPORAL_MS = [0, 250, 500, 1000, 2000, 4000];
export const BANDS = ["dawn", "morning", "noon", "dusk", "evening", "night"];
export const KO = {
  band: { dawn: "새벽", morning: "아침", noon: "점심", dusk: "노을", evening: "저녁", night: "밤" },
  weather: { clear: "맑음", cloud: "흐림", rain: "비", snow: "눈", fog: "안개", wind: "바람" },
  season: { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" },
  biome: {
    valley: "계곡",
    pond: "민물",
    mountain: "산",
    hill: "들판·언덕",
    meadow: "초원",
    forest: "숲",
    tidal: "갯벌",
    sandy: "모래해안",
    rocky: "암석해안",
    sea: "먼바다",
    deep: "깊은 바다"
  }
};

/** `--k v` · `--k=v` · `--flag` → 객체. 위치 인자는 `_`. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const k = a.slice(2);
    const nx = argv[i + 1];
    if (nx !== undefined && !nx.startsWith("--")) {
      out[k] = nx;
      i++;
    } else out[k] = true;
  }
  return out;
}

export const pad2 = (n) => String(n).padStart(2, "0");
export const roundDir = (round, phase) => path.join(OUT_ROOT, `r${pad2(round)}`, phase);
/** 시나리오 폴더 이름 — 사람이 읽는다: s03-meadow-autumn-morning-clear. */
export const sidOf = (sc) => `s${pad2(sc.id)}-${sc.biome}-${sc.season}-${sc.band}-${sc.weather}`;
export const titleOf = (sc) =>
  `${KO.biome[sc.biome] ?? sc.biome} · ${KO.season[sc.season] ?? sc.season} · ${KO.band[sc.band] ?? sc.band} · ${KO.weather[sc.weather] ?? sc.weather}`;

export function fixtureUrl(sc, over = {}, base = BASE) {
  const q = { biome: sc.biome, season: sc.season, band: sc.band, weather: sc.weather, seed: sc.seed ?? 42, t: 0, load: 1, camera: "showcase", ...over };
  const qs = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${base}/visual-fixture/biome?${qs}`;
}

export async function launch() {
  return chromium.launch({ headless: true });
}

/** 컨텍스트 + 페이지. 페인트-전 스크립트가 배경 게이트를 열도록 localStorage를 심는다(비주얼 스위트와 같은 값). */
export async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    // 아트 자리의 404(public/ambient/art/<id>.png 미납품)는 설계된 폴백(ADR-0017 ⑮) — 에러가 아니다.
    if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem("vic.settingsEpoch", "2026-09-04");
      localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
      localStorage.setItem("vic.gfxPref", "max");
      localStorage.setItem("vic.ambient", "on");
    } catch {
      /* 저장소 불가 — 페이지가 스스로 게이트를 연다 */
    }
  });
  return { ctx, page, errors };
}

/** fixture를 열고 `settledT`(t까지 전진 완료)를 기다린다. 반환 = 상태 요약. */
export async function openFixture(page, url, timeoutMs = 40000) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.__vicAmbient?.settledT !== undefined, null, { timeout: timeoutMs });
  return state(page);
}

export async function advance(page, ms) {
  return page.evaluate((v) => window.__vicAmbient.advance(v), ms);
}

export async function forceWorld(page, force) {
  return page.evaluate((f) => window.__vicAmbient.forceWorld(f), force);
}

/** 엔진·세계·장면 상태 요약(장면 debug()는 배열을 길이로, 긴 문자열은 잘라서). */
export async function state(page) {
  return page.evaluate(() => {
    const a = window.__vicAmbient;
    const raw = a.scene() || {};
    const scene = {};
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) scene[k] = `[${v.length}]`;
      else if (v === null || ["number", "boolean", "string"].includes(typeof v)) scene[k] = typeof v === "string" && v.length > 60 ? `${v.slice(0, 60)}…` : v;
    }
    return {
      t: a.time(),
      settledT: a.settledT,
      frames: a.frames,
      load: a.load,
      q: a.q,
      seed: a.seed,
      frozen: a.frozen,
      running: a.running,
      pending: a.pending(),
      biome: a.biome(),
      world: a.world(),
      scene
    };
  });
}

/** 캔버스(.gs-season)만 PNG로 — 페이지 배경색 위에 합성해 불투명하게. */
export async function captureCanvas(page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.querySelector("canvas.gs-season");
    if (!c) return null;
    let bg = getComputedStyle(document.body).backgroundColor;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = "#fbf9f5";
    const o = document.createElement("canvas");
    o.width = c.width;
    o.height = c.height;
    const g = o.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, o.width, o.height);
    g.drawImage(c, 0, 0);
    return o.toDataURL("image/png");
  });
  if (!dataUrl) throw new Error("canvas.gs-season not found (배경 게이트가 닫혔거나 fixture가 아니다)");
  const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  return { png, hash: sha(png), bytes: png.length };
}

export const sha = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 12);
export const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
export const writeJson = (p, v) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
export const nowIso = () => new Date().toISOString();

export function gitInfo() {
  try {
    const commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: "unknown", dirty: null };
  }
}

/** 서버가 떠 있나 — 아니면 어떻게 띄우는지 알려 주고 끝낸다. */
export async function assertServer(base = BASE) {
  try {
    const r = await fetch(`${base}/visual-fixture/biome?t=0`, { redirect: "manual" });
    if (r.status === 404) throw new Error("404 — VISUAL_TEST_FIXTURE=1 없이 떠 있다");
    if (!r.ok && r.status !== 200) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(`서버에 닿지 못했다(${base}): ${e.message}`);
    console.error("띄우기: npm run build && VISUAL_TEST_FIXTURE=1 npx next start -p 3100 -H 127.0.0.1");
    process.exit(2);
  }
}

/** 시나리오 폴더의 프레임을 읽어 데이터 URL로(시트·diff가 브라우저 캔버스에서 합성한다). */
export const pngDataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;

/** phase 폴더 안의 시나리오 폴더 목록(meta.json이 있는 것만, id 순). */
export function listScenarioDirs(phaseDir, only = null) {
  if (!fs.existsSync(phaseDir)) return [];
  return fs
    .readdirSync(phaseDir)
    .filter((d) => fs.existsSync(path.join(phaseDir, d, "meta.json")))
    .map((d) => ({ sid: d, dir: path.join(phaseDir, d), meta: readJson(path.join(phaseDir, d, "meta.json")) }))
    .filter((e) => !only || only.includes(e.meta.scenario.id))
    .sort((a, b) => a.meta.scenario.id - b.meta.scenario.id);
}
