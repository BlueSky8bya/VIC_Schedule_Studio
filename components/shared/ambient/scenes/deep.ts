// 깊은 바다(2026-09-06 소유자 지시) — **물속에 들어가 있는 옆모습 시점**. 다른 열 화면은 3/4 부감이지만 여기만은
// 카메라가 물 안에 있다: 위는 수면 쪽(밝다), 아래는 심연(어둡다), 가로는 그냥 옆이다. 그래서
//  · 바닥 눌림(GROUND_SQUASH)·지평선·거리 축소(depthScale)를 쓰지 않는다 — 아래로 갈수록 "가까운" 게 아니라 **깊은** 것이다.
//  · 물고기 실루엣은 윗면이 아니라 **옆면**이다(다른 바이옴은 top-view 그림자 — 소유자 2026-09-04 규칙, 시점이 다르니 여기선 옆면).
//  · **계절·날씨·시간대의 영향을 아예 받지 않는다**(소유자). 200m 아래는 계절도 날씨도 닿지 않고 밤낮 차이도 사실상 없다 —
//    엔진의 조명 패스·대기 안개·날씨 입자는 `sealed: true`로 통째로 건너뛴다(scene-engine).
// 변주는 시간이 아니라 **깊이·생물·부유물**이 만든다. 동물은 손으로 그리지 않는다 — 전부 Noto 이모지 실루엣(assets.ts).

import type { Scene } from "../scene-engine";
import { clamp, lerp, makeCanvas, rng, softBlob, TAU } from "./util";
import { ASSET, drawFacing, loadSprite, type Sprite } from "../assets";

// 심해 팔레트(고정) — 청록빛 남색에서 심연으로. 오행: 물(수) 계열, 붉은 계열 없음.
const TOP = "#1d4a68"; // 수면에서 내려온 빛이 남은 층
const MID = "#123047";
const ABYSS = "#050d18";
const MOTE = "226 238 244"; // 마린 스노
const GLOW = "150 220 210"; // 발광(해파리·플랑크톤)

type Fish = {
  x: number;
  y: number;
  hd: number; // 진행 방향(라디안)
  spd: number;
  z: number; // 0 = 멀다(작고 흐리다) … 1 = 가깝다
  px: number; // 그릴 크기(CSS px)
  ph: number;
  kind: number; // fishSpr 인덱스
  school: number; // -1 = 홀로
};
type Jelly = { x: number; y: number; r: number; ph: number; spd: number; z: number };

export function createDeep(seed: number): Scene {
  const rand = rng(seed * 7 + 13);
  let w = 0;
  let h = 0;
  let bg: HTMLCanvasElement | null = null;
  let bw = 0;
  let bh = 0;
  let bdpr = 0;
  // 옆모습 실루엣(Noto) — 작은 것부터. 실루엣이라 색은 물빛 한 가지로 물들인다.
  const SPR = 96;
  const fishSpr: (Sprite | null)[] = [null, null, null];
  let jellySpr: Sprite | null = null;
  let bigSpr: Sprite | null = null; // 고래(아주 가끔 지나간다)
  let squidSpr: Sprite | null = null;
  let asked = false;
  const SHAFT_X = [0.14, 0.36, 0.62, 0.86];
  let shaftSpr: HTMLCanvasElement | null = null;
  const fish: Fish[] = [];
  const jellies: Jelly[] = [];
  // 무리 중심 둘 — 물고기는 흩어져 다니지 않는다(먼바다와 같은 규칙).
  const schools = [
    { x: 0.3, y: 0.4, vx: 1 },
    { x: 0.72, y: 0.66, vx: -1 }
  ];
  // 거대 실루엣 — 30~70초에 한 번 화면을 가로지른다(심해의 크기를 말하는 유일한 장치).
  let bigAt = 18 + rand() * 30;
  let bigX = -1200;
  let bigDir = 1;
  let bigY = 0;

  /** 깊이(정규화 0~1) → 물빛. 옆모습이라 y가 곧 깊이다. */
  function bake(dpr: number) {
    const { c, g } = makeCanvas(Math.max(1, Math.ceil(w * dpr)), Math.max(1, Math.ceil(h * dpr)));
    g.scale(dpr, dpr);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, TOP);
    grad.addColorStop(0.34, MID);
    grad.addColorStop(1, ABYSS);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // 수면에서 스며든 빛 — 화면 위 가장자리에 넓고 아주 옅은 덩어리 하나(수면 자체는 프레임 밖이다).
    softBlob(g, w * 0.5, -h * 0.06, w * 0.75, "196 232 240", 0.16, 0, 0.5);
    bg = c;
    shaftSpr = bakeShaft();
    bw = w;
    bh = h;
    bdpr = dpr;
  }

  /** 빛기둥 텍스처 — 사다리꼴 × 가로 페이드 × 세로 페이드를 픽셀로 굽는다. 한 번만. */
  function bakeShaft(): HTMLCanvasElement {
    const W = 96;
    const H = 256;
    const { c, g } = makeCanvas(W, H);
    const im = g.createImageData(W, H);
    const d = im.data;
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      const half = (W / 2) * (0.34 + 0.66 * v);
      const vFade = Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * v)), 1.4);
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x - W / 2) / Math.max(1, half);
        if (dx >= 1) continue;
        const hFade = Math.pow(Math.cos((dx * Math.PI) / 2), 1.6);
        const a = Math.round(255 * 0.1 * hFade * vFade);
        if (a <= 0) continue;
        const i = (y * W + x) * 4;
        d[i] = 214;
        d[i + 1] = 236;
        d[i + 2] = 246;
        d[i + 3] = a;
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  function newFish(load: number): Fish {
    const solo = rand() < 0.22;
    const school = solo ? -1 : rand() < 0.5 ? 0 : 1;
    const z = solo ? 0.55 + rand() * 0.45 : Math.pow(rand(), 0.7);
    const sc = school >= 0 ? schools[school] : null;
    const y = sc ? clamp(h * sc.y + (rand() - 0.5) * h * 0.3, h * 0.06, h * 0.94) : h * (0.1 + rand() * 0.82);
    const x = sc ? clamp(w * sc.x + (rand() - 0.5) * w * 0.4, -60, w + 60) : rand() * w;
    // 크기: 멀리 = 작게. 홀로 다니는 놈이 크다. 여력이 낮으면 큰 놈만 남긴다.
    const px = (solo ? 46 : 24) * (0.6 + 0.8 * z) * (0.85 + 0.3 * load);
    return {
      x,
      y,
      hd: (sc ? (sc.vx > 0 ? 0 : Math.PI) : rand() < 0.5 ? 0 : Math.PI) + (rand() - 0.5) * 0.3,
      spd: (solo ? 10 : 18) + rand() * 12,
      z,
      px,
      ph: rand() * TAU,
      kind: solo ? 0 : rand() < 0.65 ? 1 : 2,
      school
    };
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!bg || bw !== w || bh !== h || bdpr !== f.dpr) bake(f.dpr);
      if (jellies.length === 0) {
        // (아래 push 뒤 r을 z로 채운다)
        for (let i = 0; i < 7; i++) {
          jellies.push({
            x: w * (0.08 + 0.13 * i + 0.04 * Math.sin(i * 2.3)),
            y: h * (0.18 + 0.1 * i + 0.06 * Math.sin(i * 1.7)),
            // 반지름은 z의 함수 — 크기와 깊이 단서가 어긋나면 "가장 큰 것이 화면 한가운데"가 된다(라운드 7 B).
            r: 0,
            ph: rand() * TAU,
            spd: 3 + rand() * 5,
            z: 0.25 + rand() * 0.75
          });
        }
        for (const j of jellies) j.r = 10 + 30 * j.z;
      }
    },
    step(f) {
      const { dt, t, load } = f;
      // 물고기 수 — 여력에 비례(먼바다보다 적다: 심해는 성기다).
      const target = Math.round(lerp(6, 18, load));
      while (fish.length < target) fish.push(newFish(load));
      if (fish.length > target) fish.length = target;
      // 무리 중심이 천천히 흐른다 — 무리째 화면을 가로지르고 반대편에서 돌아온다.
      for (const sc of schools) {
        sc.x += sc.vx * 0.012 * dt;
        if (sc.x < -0.25) sc.x = 1.25;
        if (sc.x > 1.25) sc.x = -0.25;
        sc.y += Math.sin(t * 0.09 + sc.vx) * 0.004 * dt;
        sc.y = clamp(sc.y, 0.2, 0.82);
      }
      for (const s of fish) {
        const p = f.p;
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        // 위협 반응 — 옆모습이라 위아래로도 피한다(물속엔 위가 있다).
        if (p.inside && d < 150) {
          const away = Math.atan2(s.y - p.y, s.x - p.x);
          s.hd += (((away - s.hd + Math.PI) % TAU) - Math.PI) * 0.2;
          s.spd = Math.min(90, s.spd + 70 * dt);
        } else if (s.school >= 0) {
          // 무리로 돌아가려는 힘 + 진행 방향 정렬(보이드 축약).
          const sc = schools[s.school];
          const tx = w * sc.x;
          const ty = h * sc.y;
          const to = Math.atan2(ty - s.y, tx - s.x);
          const pull = Math.min(1, Math.hypot(tx - s.x, ty - s.y) / (w * 0.34));
          s.hd += (((to - s.hd + Math.PI) % TAU) - Math.PI) * 0.6 * pull * dt;
          s.spd += ((sc.vx > 0 ? 20 : 20) - s.spd) * dt * 0.6;
        } else {
          s.spd += (12 - s.spd) * dt * 0.5;
        }
        s.hd += Math.sin(t * 0.5 + s.ph) * 0.5 * dt; // 몸을 흔들며 나아간다
        // 원근 = 깊이가 아니라 z(멀고 가까움). 멀수록 화면에서 느리다.
        const mk = 0.4 + 0.6 * s.z;
        s.x += Math.cos(s.hd) * s.spd * dt * mk;
        s.y += Math.sin(s.hd) * s.spd * dt * 0.45 * mk;
        if (s.x < -140) s.x = w + 120;
        if (s.x > w + 140) s.x = -120;
        s.y = clamp(s.y, h * 0.04, h * 0.96);
      }
      // 해파리 — 맥동하며 아주 천천히 떠오른다. 위로 빠지면 아래에서 다시 올라온다.
      for (const j of jellies) {
        j.y -= j.spd * dt * (0.5 + 0.5 * Math.sin(t * 1.2 + j.ph)) * 0.4;
        j.x += Math.sin(t * 0.25 + j.ph) * 6 * dt;
        if (j.y < -j.r * 2) {
          j.y = h + j.r * 2;
          j.x = rand() * w;
        }
      }
      // 거대 실루엣 등장 주기.
      if (bigX < -1000 || bigX > w + 1000) {
        bigAt -= dt;
        if (bigAt <= 0) {
          bigDir = rand() < 0.5 ? 1 : -1;
          bigX = bigDir > 0 ? -900 : w + 900;
          bigY = h * (0.45 + rand() * 0.35);
          bigAt = 30 + rand() * 40;
        }
      } else bigX += bigDir * 26 * dt;
    },
    draw(g, f) {
      const t = f.t;
      if (bg) g.drawImage(bg, 0, 0, f.w, f.h);
      // **시간대만 읽는다**(2026-09-06 라운드 10, 소유자 우선순위 A + 검토 A·B·C 동일 의견). 이 방은 계절·날씨에 여전히 봉인이다
      // (`sealed()` 유지 — 엔진 입자·대기 안개·조명 패스를 건너뛴다). 그러나 장면이 **수면 빛줄기 4개**를 늘 그리는 이상
      // "밤낮이 없다"와 "태양 기둥이 있다"는 동시에 참일 수 없었다 — 새벽 2시의 태양 기둥이 모순이었다(C). BIOME_GRAMMAR §11이
      // 이미 "낮 빛줄기 최대 · 새벽/저녁 ×.4 · 밤 0 + 해파리 발광 ×1.5"로 적혀 있어 문서 쪽으로 해소한다.
      // 계약은 "30 해시 동일" → "**띠마다 5날씨 해시 동일(고유 해시 정확히 6)**"로 바뀐다(selftest ④).
      // 채널은 셋뿐: ① 빛줄기 세기·기울기 ② 위 1/3의 명도(수면 글로우 — 바닥 L은 밤낮 같다) ③ 밤 발광. 별·노을 색·그림자·입자는 없다.
      const band = f.time.band;
      const dayK = band === "noon" ? 1 : band === "morning" ? 0.8 : band === "dawn" || band === "dusk" ? 0.35 : band === "evening" ? 0.12 : 0;
      const nightK = band === "night" ? 1 : band === "evening" ? 0.6 : band === "dawn" ? 0.25 : 0;
      if (dayK < 1) {
        // 수면에서 내려온 빛이 줄어든다 — 위 34%만 어두워지고(점심 → 밤 TOP L ≈ −12) 아래는 그대로.
        const dim = g.createLinearGradient(0, 0, 0, f.h * 0.34);
        const k = 1 - 0.34 * (1 - dayK);
        const kk = Math.round(255 * k);
        dim.addColorStop(0, `rgb(${kk} ${kk} ${Math.min(255, kk + 6)})`);
        dim.addColorStop(1, "rgb(255 255 255)");
        g.save();
        g.globalCompositeOperation = "multiply";
        g.fillStyle = dim;
        g.fillRect(0, 0, f.w, f.h * 0.34);
        g.restore();
      }
      if (!asked) {
        asked = true;
        // 실루엣 색 — 물빛보다 조금 짙은 남색. 채도 1로 완전히 눌러 "이모지"가 아니라 그림자로 읽히게.
        const tint = "rgb(14 34 52)";
        void loadSprite(ASSET.fishSide, SPR, SPR, 2, tint, 0, true).then((s) => (fishSpr[0] = s)).catch(() => {});
        void loadSprite(ASSET.fishTropical, SPR, SPR, 2, tint, 0, true).then((s) => (fishSpr[1] = s)).catch(() => {});
        void loadSprite(ASSET.fishPuffer, SPR, SPR, 2, tint, 0, true).then((s) => (fishSpr[2] = s)).catch(() => {});
        void loadSprite(ASSET.whale, 220, 220, 2, "rgb(6 16 28)", 0, true).then((s) => (bigSpr = s)).catch(() => {});
        void loadSprite(ASSET.squid, SPR, SPR, 2, tint, 0, true).then((s) => (squidSpr = s)).catch(() => {});
        // 해파리도 **한 색 실루엣**이다 — 원본 이모지를 그대로 얹으면 광택·눈·무늬가 남아 "이모지"로 읽힌다(검토 B ③-a).
        // 발광은 색이 아니라 **빛무리 + 밝은 단색**으로 만든다.
        void loadSprite(ASSET.jellyfish, SPR, SPR, 2, "rgb(178 232 222)", 0, true).then((s) => (jellySpr = s)).catch(() => {});
      }
      // ① 수면 빛줄기 — 항상 있다(시간대·날씨 무관: 여기는 계절이 닿지 않는 방이다). 좌우 모서리 없이 흩어진다.
      // 빛줄기 — **한 번 굽고 매 프레임 drawImage 한 번**(LOD 규칙). 조각을 나눠 그리면 알파가 곹쳨 가로
      // 사다리가 보이고(실측), 세로 직사각으로 그리면 "반투명 UI 패널"이 된다(검토 A·B·C 공통).
      // 스프라이트 안에 사다리꼴(위 34% → 아래 100% 폭) + 가로 페이드 + 세로 페이드를 모두 굽고, 기울기는 transform(전단)으로.
      if (shaftSpr && dayK > 0) {
        const bot = f.h * 0.66;
        // 해가 낮으면(새벽·노을) 기둥이 눕고 수가 준다(C): 점심 4개·기울기 .09 → 새벽·노을 2개·.2.
        const nShaft = dayK >= 0.8 ? 4 : dayK >= 0.3 ? 2 : 1;
        const lowSun = 1 - Math.min(1, dayK / 0.8);
        for (let i = 0; i < nShaft; i++) {
          const x0 = f.w * SHAFT_X[i] + Math.sin(t * 0.16 + i * 1.7) * 30;
          const wd = 150 + 60 * Math.sin(t * 0.23 + i) + 26 * Math.sin(t * 0.11 + i * 2.1);
          const tilt = (i % 2 === 0 ? 1 : -1) * (0.09 + 0.11 * lowSun + 0.05 * Math.sin(t * 0.07 + i));
          const a = (0.85 + 0.3 * Math.sin(t * 0.19 + i * 2.3)) * dayK;
          g.save();
          g.globalAlpha *= Math.max(0.12, a);
          g.transform(1, 0, tilt, 1, x0, 0);
          g.drawImage(shaftSpr, -wd / 2, 0, wd, bot);
          g.restore();
        }
      }
      // ③ 생물 — **한 z 목록으로 모아 한 번만 정렬**한다(2026-09-06 라운드 7 B: 물고기·해파리·고래·오징어를
      // 클래스 단위로 통째 그려 z .17 해파리가 z .9 물고기 앞에 왔다 — A-3·D-1). 옆모습이라 y는 수심이고
      // 앞뒤는 오직 z다.
      type Draw = { z: number; run: () => void };
      const items: Draw[] = [];
      for (const s2 of fish) {
        const spr = fishSpr[s2.kind] || fishSpr[0];
        const a = (0.22 + 0.5 * s2.z) * (1 - 0.4 * nightK * (1 - s2.z)); // 밤엔 먼 것(z 작음)이 먼저 사라진다
        items.push({
          z: s2.z,
          run: () => {
            g.save();
            g.globalAlpha *= a;
            if (spr) drawFacing(g, spr, s2.x, s2.y, s2.hd, s2.px / SPR, Math.sin(t * 3 + s2.ph) * 0.06);
            else {
              g.fillStyle = "rgb(9 24 40)";
              g.beginPath();
              g.ellipse(s2.x, s2.y, s2.px * 0.42, s2.px * 0.2, 0, 0, TAU);
              g.fill();
            }
            g.restore();
          }
        });
      }
      for (const j of jellies) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + j.ph);
        const R = j.r * (0.9 + 0.14 * pulse);
        const a = (0.16 + 0.16 * pulse) * (0.55 + 0.5 * j.z);
        items.push({
          z: j.z,
          run: () => {
            softBlob(g, j.x, j.y, R * 2.2 * (1 + 0.2 * nightK), GLOW, a * 0.5 * (1 + 0.5 * nightK), 0); // 밤 발광 ×1.5·반지름 ×1.2(GRAMMAR §11)
            if (jellySpr) {
              g.save();
              g.globalAlpha *= Math.min(1, a * 2.6);
              g.translate(j.x, j.y);
              const k = (R * 2.4) / SPR;
              g.scale(k, k * (0.94 + 0.1 * pulse));
              g.drawImage(jellySpr.c, -SPR / 2, -SPR / 2, SPR, SPR);
              g.restore();
            }
          }
        });
      }
      if (bigSpr && bigX > -1000 && bigX < f.w + 1000) {
        items.push({
          z: 0.08, // 고래는 가장 먼 층
          run: () => {
            g.save();
            g.globalAlpha = 0.16;
            drawFacing(g, bigSpr!, bigX, bigY + Math.sin(t * 0.12) * 10, bigDir > 0 ? 0 : Math.PI, 2.6);
            g.restore();
          }
        });
      }
      if (squidSpr) {
        const sx = ((t * 9) % (f.w + 400)) - 200;
        items.push({
          z: 0.3,
          run: () => {
            g.save();
            g.globalAlpha = 0.2;
            drawFacing(g, squidSpr!, sx, f.h * 0.24 + Math.sin(t * 0.4) * 12, 0, 0.5);
            g.restore();
          }
        });
      }
      items.sort((a, b) => a.z - b.z);
      for (const it of items) it.run();
      // ⑤ 마린 스노 — 위에서 아래로 천천히 내린다. 옆모습이라 이게 유일한 "중력"의 증거다.
      // 세 층(먼·중간·앞) — 크기·속도·알파가 층마다 달라야 "물속"의 깊이가 읽힌다(검토 A·C).
      const nSnow = Math.round(lerp(140, 380, f.load));
      const rs = rng(seed * 3 + 7);
      const LAYERS = [
        { n: 0.5, sp: 4, px: 1, a: 0.07, drift: 1 },
        { n: 0.33, sp: 9, px: 1.6, a: 0.13, drift: 2.4 },
        { n: 0.17, sp: 16, px: 2.4, a: 0.2, drift: 5 }
      ];
      for (const L of LAYERS) {
        const cnt = Math.round(nSnow * L.n);
        for (let i = 0; i < cnt; i++) {
          const sx = rs() * f.w;
          const sp = L.sp * (0.75 + rs() * 0.5);
          const sy = (rs() * f.h + t * sp) % f.h;
          const drift = Math.sin(t * 0.18 + i * 1.7) * L.drift;
          g.fillStyle = `rgb(${MOTE} / ${(L.a * (0.7 + rs() * 0.6)).toFixed(3)})`;
          g.fillRect(sx + drift, sy, L.px, L.px);
        }
      }
      // ⑦ 심연 — 아래로 갈수록 어둡다. 장면 맨 위에 한 겹(생물도 같이 잠긴다).
      const dg = g.createLinearGradient(0, f.h * 0.34, 0, f.h);
      dg.addColorStop(0, "rgb(4 10 20 / 0)");
      dg.addColorStop(1, "rgb(3 8 16 / 0.5)");
      g.fillStyle = dg;
      g.fillRect(0, f.h * 0.34, f.w, f.h * 0.66);
    },
    // 계절·날씨가 닿지 않는 방 — 엔진의 날씨 입자·대기 안개·조명 패스를 전부 건너뛴다. **시간대는 장면이 스스로 읽는다**(라운드 10, 위 draw).
    sealed: () => true,
    ownsWeather: () => true,
    debug() {
      return { biomeKind: "deep", fish: fish.length, jellies: jellies.length, bigX: Math.round(bigX) };
    }
  };
}
