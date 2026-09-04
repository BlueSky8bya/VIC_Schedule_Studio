// 해안 셋(2026-09-04, PLAN-004 §3.6) — 갯벌(tidal)·모래해안(sandy)·암석해안(rocky). 공통 골격: 3/4 시점의 수평선(위 12%) 아래 바다가 화면
// 36%까지 내려오고, 그 아래 2/3가 뭍… 이 아니라 **위 1/3 뭍 + 아래 2/3 바다**? — 소유자 ⓪ "바닷가는 바다만 보여도 된다"를 따르되, 해안은
// 뭍이 있어야 해안이다: 3/4 시점에선 관찰자가 뭍에 서서 바다를 보는 구도가 자연스러워 **뭍이 아래(가까움), 바다가 위(멀리, 수평선까지)**.
// 파도는 수평선에서 내려와 물가 선(화면 64%)에 닿아 거품이 되고, 젖은 모래 띠가 숨쉬듯 넓어졌다 좁아진다.
//  · tidal: 뻘(어두운 회갈색·젖은 광택)·물골·게 구멍 점 — 밀물·썰물은 세계 시간 띠(새벽·저녁 썰물 → 뻘 넓음).
//  · sandy: 모래(밝은 크림)·조개·유목(아트가 있을 때만)·발자국은 P2.
//  · rocky: 검은 바위(rock 자리 대체물)·물웅덩이(밝은 타원)·물보라(파도가 바위에 부딪힐 때 흰 점 몇 개).
// 생물(게·갈매기·가마우지·소라게)은 P2 에이전트. 규칙: 바탕 한 번 굽기, 매 프레임 stroke/작은 fill만.

import type { Frame, Scene } from "../scene-engine";
import type { SeasonKey } from "../registry";
import { clamp, lerp, rng, softBlob, TAU } from "./util";
import { ArtSet } from "../art/load";
import { drawProp } from "../art/props";
import { horizonY, depthScale, GROUND_SQUASH } from "../world/view";
import { bakeWater, drawGlints, drawWaves, waterPalette } from "./water";

export type CoastMode = "tidal" | "sandy" | "rocky";

const LAND_V = 0.64; // 물가 선(정규화) — 그 아래가 뭍

export function createCoast(seed: number, opts: { season: SeasonKey; mode: CoastMode }): Scene {
  const rand = rng(seed);
  const { season, mode } = opts;
  let w = 0;
  let h = 0;
  let water: HTMLCanvasElement | null = null;
  let land: HTMLCanvasElement | null = null;
  let sky: HTMLCanvasElement | null = null;
  let gw = 0;
  let gh = 0;
  let gdpr = 0;
  const glints: { x: number; y: number; ph: number; r: number }[] = [];
  const spray: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const art = new ArtSet(["rock", "log", "reed", "pebble", "shell-clam", "starfish", "driftwood"]);
  let av = -1;
  const pal = waterPalette(season);
  const top = () => horizonY(h);
  const shoreY = () => h * LAND_V;
  // 조석(갯벌) — 새벽·저녁 썰물(뻘 넓음), 점심 밀물. 물가 선이 ±6% 움직인다.
  const tide = (f: Frame) => {
    if (mode !== "tidal") return 0;
    const b = f.time.band;
    return b === "dawn" || b === "evening" || b === "night" ? 1 : b === "noon" ? -1 : 0;
  };

  function bake(dpr: number) {
    water = bakeWater(w, h, top(), dpr, pal, seed);
    // 뭍 — 모드별 바탕(아래 36%).
    const lc = document.createElement("canvas");
    lc.width = Math.max(1, Math.ceil(w * dpr));
    lc.height = Math.max(1, Math.ceil((h - shoreY() + 60) * dpr));
    const g = lc.getContext("2d")!;
    g.scale(dpr, dpr);
    const r = rng(seed * 7 + 3);
    const H = h - shoreY() + 60;
    const base = mode === "tidal" ? ["#8f8474", "#7a7062"] : mode === "sandy" ? ["#e6dcbd", "#d9cda9"] : ["#8a8f93", "#6c7275"];
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, base[0]);
    grad.addColorStop(1, base[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, H);
    if (mode === "tidal") {
      // 물골(밝은 물 띠)·젖은 광택·게 구멍 점.
      for (let i = 0; i < 4; i++) {
        const y0 = 30 + r() * (H - 60);
        g.strokeStyle = "rgb(190 205 215 / 0.55)";
        g.lineWidth = 6 + r() * 6;
        g.lineCap = "round";
        g.beginPath();
        for (let x = -10; x <= w + 10; x += 24) g.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 18 + Math.sin(x * 0.027 + i * 3) * 6);
        g.stroke();
      }
      for (let i = 0; i < Math.round(w / 9); i++) {
        const x = r() * w;
        const y = r() * H;
        g.fillStyle = "rgb(60 54 46 / 0.55)";
        g.beginPath();
        g.ellipse(x, y, 2.2, 1.4, 0, 0, TAU);
        g.fill();
        softBlob(g, x + 3, y - 2, 6, "230 225 210", 0.25, 0);
      }
    } else if (mode === "sandy") {
      // 모래 결·조개 몇 개(아트 없으면 옅은 흰 점).
      for (let i = 0; i < Math.round(w / 5); i++) {
        g.fillStyle = r() < 0.5 ? "rgb(255 250 235 / 0.5)" : "rgb(190 175 140 / 0.35)";
        g.beginPath();
        g.arc(r() * w, r() * H, 0.8 + r() * 1.2, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 6; i++) {
        const x = r() * w;
        const y = 20 + r() * (H - 40);
        if (!drawProp(g, art, "shell-clam", x, y, { k: 0.8 + r() * 0.5, r: r(), sy: GROUND_SQUASH, rot: r() * TAU })) {
          g.fillStyle = "rgb(250 244 230)";
          g.beginPath();
          g.ellipse(x, y, 5, 3.4, r(), 0, TAU);
          g.fill();
        }
      }
    } else {
      // 검은 바위 무리 + 물웅덩이 + 따개비 점.
      for (let i = 0; i < Math.round(w / 90); i++) {
        const x = r() * w;
        const y = 10 + r() * (H - 30);
        const k = 0.8 + r() * 1.2;
        if (!drawProp(g, art, "rock", x, y, { k, r: r(), flip: r() < 0.5 })) {
          const rg = g.createRadialGradient(x - 8 * k, y - 10 * k, 2, x, y - 6 * k, 26 * k);
          rg.addColorStop(0, "#6f767a");
          rg.addColorStop(1, "#3f4649");
          g.fillStyle = rg;
          g.beginPath();
          g.ellipse(x, y - 6 * k, 24 * k, 14 * k, r() * 0.5 - 0.25, 0, TAU);
          g.fill();
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = r() * w;
        const y = 20 + r() * (H - 50);
        g.fillStyle = "rgb(190 215 225 / 0.75)";
        g.beginPath();
        g.ellipse(x, y, 22 + r() * 16, 9 + r() * 6, 0, 0, TAU);
        g.fill();
        g.strokeStyle = "rgb(255 255 255 / 0.5)";
        g.lineWidth = 1;
        g.stroke();
      }
    }
    land = lc;
    // 하늘.
    const sc = document.createElement("canvas");
    sc.width = Math.max(1, Math.ceil(w * dpr));
    sc.height = Math.max(1, Math.ceil(top() * dpr) + 2);
    const sg = sc.getContext("2d")!;
    sg.scale(dpr, dpr);
    const sgrad = sg.createLinearGradient(0, 0, 0, top());
    sgrad.addColorStop(0, "#dbe8f1");
    sgrad.addColorStop(1, "#eef5fa");
    sg.fillStyle = sgrad;
    sg.fillRect(0, 0, w, top() + 2);
    sg.fillStyle = "rgb(255 255 255 / 0.45)";
    sg.fillRect(0, top() - 1, w, 1.5);
    sky = sc;
    gw = w;
    gh = h;
    gdpr = dpr;
    av = art.version;
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      if (!water || gw !== w || gh !== h || gdpr !== f.dpr || av !== art.version) bake(f.dpr);
    },
    step(f) {
      const { dt, load } = f;
      if (av !== art.version) bake(f.dpr);
      const gt = Math.round(lerp(4, 16, load));
      while (glints.length < gt) glints.push({ x: rand() * w, y: top() + 20 + rand() * (shoreY() - top() - 40), ph: rand() * TAU, r: 1.2 + rand() * 1.4 });
      if (glints.length > gt) glints.length = gt;
      // 물보라(암석해안) — 파도 주기마다 바위 근처에서 흰 점 몇 개.
      if (mode === "rocky" && load >= 0.4 && rand() < dt * 2.2) {
        const x = rand() * w;
        for (let i = 0; i < 5; i++) spray.push({ x: x + (rand() - 0.5) * 20, y: shoreY() - 4, vx: (rand() - 0.5) * 60, vy: -60 - rand() * 90, life: 1 });
      }
      for (let i = spray.length - 1; i >= 0; i--) {
        const s = spray[i];
        s.vy += 260 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 1.6;
        if (s.life <= 0) spray.splice(i, 1);
      }
    },
    draw(g, f) {
      const t = f.t;
      if (sky) g.drawImage(sky, 0, 0, f.w, sky.height / (gdpr || 1));
      if (water) g.drawImage(water, 0, 0, f.w, f.h);
      const sy = shoreY() - tide(f) * f.h * 0.06 - Math.sin(t * 0.5) * 3; // 물가 선이 숨쉰다
      // 파도 — 수평선에서 물가까지, 마지막 선은 물가에서 거품이 된다.
      drawWaves(g, t, f.w, { top: top(), bottom: sy, bands: 4, speed: 0.05, amp: 12, alpha: 0.22, foam: pal.foam, shore: true });
      drawGlints(g, t, glints);
      // 뭍 — 물가 선 아래. 젖은 띠(어두운 반투명)가 물가 위로 살짝.
      if (land) {
        g.save();
        g.beginPath();
        g.rect(0, sy, f.w, f.h - sy);
        g.clip();
        g.drawImage(land, 0, sy - 60, f.w, land.height / (gdpr || 1));
        g.restore();
        // 젖은 모래/뻘 띠 — 물가 선 아래 12~18px, 파도 주기로 넓어졌다 좁아진다.
        const wet = 10 + 8 * (0.5 + 0.5 * Math.sin(t * 0.5));
        const wg = g.createLinearGradient(0, sy, 0, sy + wet);
        wg.addColorStop(0, mode === "rocky" ? "rgb(40 50 60 / 0.35)" : "rgb(80 70 50 / 0.28)");
        wg.addColorStop(1, "rgb(80 70 50 / 0)");
        g.fillStyle = wg;
        g.fillRect(0, sy, f.w, wet);
        // 물가 거품 선.
        g.strokeStyle = `rgb(${pal.foam} / 0.7)`;
        g.lineWidth = 2;
        g.beginPath();
        for (let x = -10; x <= f.w + 10; x += 12) g.lineTo(x, sy + Math.sin(x * 0.02 + t * 1.1) * 2.5);
        g.stroke();
      }
      for (const s of spray) {
        g.fillStyle = `rgb(255 255 255 / ${clamp(s.life, 0, 1) * 0.9})`;
        g.beginPath();
        g.arc(s.x, s.y, 1.6, 0, TAU);
        g.fill();
      }
      void depthScale;
    },
    debug() {
      return { biomeKind: mode, glints: glints.length, spray: spray.length, season };
    }
  };
}
