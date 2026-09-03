// 여름 — 물결(.gs-tide, CSS/SVG caustic) 위의 캔버스: ① 포인터 **항적**(제트스키) ② 물 위에 둥둥 뜬 **장난감 오리**(늘) ③ 가끔
// 가장자리에서 **밀려오는 튜브**(랜덤 이벤트) — 둘 다 집어 끌고 던질 수 있고, 빨리 끌면 제 항적을 남긴다.
//
// 항적(2026-09-04 사용자: 선 몇 줄은 "이게 뭐야") — 벤치마크 = 항공 사진의 제트스키 항적: 몸통은 뒤로 넓게 번지며 천천히
// 가라앉는 **흰 거품 띠**(turbulent wash), V자 두 팔은 그 바깥의 옅은 잔물결, 팔 사이엔 가로 마루. 구현 = **LOD 레이어**:
// 저해상(0.35~0.5×) 오프스크린 캔버스에 거품 도장(소프트 스프라이트 — 나이 들수록 커지고 옅어진다)·팔·마루·고리를 그리고
// 확대 합성한다 — 흐릿해야 하는 것은 흐릿하게 그려야 싸고 자연스럽다(사용자: "이목이 가는 곳만 선명하게, 나머지는 해상도를
// 낮춰라"). 도장은 나이별 알파를 직접 계산한다(잔상 버퍼의 8bit 양자화 고스트가 없다). 소품·뱃머리는 본 캔버스에 또렷하게.
// 여력(f.load): 도장 간격·기억 시간·저해상 배율·글로우/마루·튜브 이벤트·소품 항적이 load에 따라 늘고 준다.
// 원형 잔물결은 **누를 때만**. 캔버스는 투명 — 아래 caustic이 그대로 비친다.

import type { Frame, Scene } from "../scene-engine";
import { ASSET, drawSprite, loadSprite, type Sprite } from "../assets";
import { clamp, lerp, makeCanvas, rng, shadowSprite, softBlob, TAU } from "./util";

type Node = { x: number; y: number; t0: number; nx: number; ny: number; sf: number }; // n = 진행 직각 단위벡터
type Stamp = { x: number; y: number; t0: number; sf: number; r: number };
type Ring = { x: number; y: number; life: number; dur: number; maxR: number; a: number; w: number };
type PropKind = "duck" | "ring";
// 물 밑 물고기(2026-09-04 사용자: "아열대 물고기가 물 밑을 헤엄치듯 비친다") — 저해상 층에 흐릿한 청록 그림자로. 무리(3~6)가
// 같은 목표를 향해 헤엄치고, 포인터가 다가오면 흩어져 달아난다. 여력 ≥.7이면 큰 놈 하나.
type Fish = { x: number; y: number; hd: number; spd: number; k: number; ph: number; big: boolean; flee: number };
type Bubble = { x: number; y: number; t0: number };
type Glint = { x: number; y: number; ph: number; r: number };
type Prop = {
  kind: PropKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number; // 회전(스프라이트 앞 = 위)
  ph: number; // 흔들림 위상
  k: number;
  grab: boolean;
  gox: number;
  goy: number;
  lift: number;
  born: number;
  entered: boolean;
  dvx: number; // 해류(목표 속도)
  dvy: number;
  lx: number; // 마지막 항적 도장 위치
  ly: number;
  nextRing: number;
};

const STAMP_SPR = 96;

export function createSummer(seed: number): Scene {
  const rand = rng(seed);
  const path: Node[] = [];
  const stamps: Stamp[] = [];
  const rings: Ring[] = [];
  const props: Prop[] = [];
  let lo: { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;
  let loS = 0.5;
  let loW = 0;
  let loH = 0;
  let stampSpr: HTMLCanvasElement | null = null;
  let shadow: HTMLCanvasElement | null = null;
  let duckSpr: Sprite | null = null;
  let ringSpr: Sprite | null = null;
  let fishSpr: Sprite | null = null;
  let lastX = -9999;
  let lastY = -9999;
  let sx = -9999;
  let sy = -9999;
  let spawned = 0;
  let stamped = 0;
  let nextTube = 10;
  let tubes = 0;
  const fish: Fish[] = [];
  let schoolX = 0;
  let schoolY = 0;
  let schoolNext = 0;
  let fishFled = 0;
  const bubbles: Bubble[] = [];
  let nextBubble = 4;
  const glints: Glint[] = [];
  let w = 0;
  let h = 0;

  function bake() {
    if (stampSpr) return;
    // 거품 도장 — 바깥 물빛 무리 + 안쪽 흰 거품. 한 장으로 두 겹.
    const { c, g } = makeCanvas(STAMP_SPR, STAMP_SPR);
    // 거품 = 옅은 물빛 무리 + 흰 거품(2026-09-04 사용자: "너무 진해서 어색한 부분이 보인다 — 흐릿하게 글러듯"). 진한 파랑은
    // 쓰지 않고, 흐림은 저해상 레이어 배율(ensureLo)로 낸다.
    softBlob(g, STAMP_SPR / 2, STAMP_SPR / 2, STAMP_SPR / 2, "150 195 228", 0.34, 0);
    softBlob(g, STAMP_SPR / 2, STAMP_SPR / 2, STAMP_SPR * 0.3, "255 255 252", 0.8, 0);
    stampSpr = c;
    shadow = shadowSprite(96, 64, "30 60 90", 0.4);
    void loadSprite(ASSET.duck, 56, 66).then((s) => (duckSpr = s)).catch(() => {});
    void loadSprite(ASSET.ring, 92, 92).then((s) => (ringSpr = s)).catch(() => {});
    void loadSprite(ASSET.fish, 22, 42).then((s) => (fishSpr = s)).catch(() => {});
  }
  function ensureLo(f: Frame) {
    // 항적은 일부러 흐리게(0.28~0.36×) — 또렷한 가장자리가 어색함을 드러낸다(사용자 2026-09-04).
    const want = f.load >= 0.6 ? 0.36 : f.load >= 0.3 ? 0.32 : 0.28;
    if (lo && Math.abs(want - loS) < 0.001 && loW === f.w && loH === f.h) return;
    loS = want;
    loW = f.w;
    loH = f.h;
    lo = makeCanvas(Math.ceil(f.w * loS), Math.ceil(f.h * loS));
  }
  function ring(x: number, y: number, maxR: number, a: number, delay: number, dur: number, wd: number) {
    rings.push({ x, y, life: -delay, dur, maxR, a, w: wd });
  }
  function stamp(x: number, y: number, t: number, sf: number, r: number) {
    stamps.push({ x, y, t0: t, sf, r });
    stamped++;
    if (stamps.length > 1400) stamps.shift();
  }
  function newProp(kind: PropKind, t: number): Prop {
    return {
      kind,
      x: rand() * w,
      y: rand() * h,
      vx: 0,
      vy: 0,
      a: rand() * TAU,
      ph: rand() * TAU,
      k: kind === "duck" ? 0.9 + rand() * 0.25 : 1,
      grab: false,
      gox: 0,
      goy: 0,
      lift: 0,
      born: t,
      entered: kind === "duck",
      dvx: 0,
      dvy: 0,
      lx: 0,
      ly: 0,
      nextRing: t + 1 + rand() * 2
    };
  }
  // 튜브 — 가장자리 밖에서 천천히 들어와 가로질러 나간다("가끔 밀려온다").
  function spawnTube(t: number) {
    const p = newProp("ring", t);
    const edge = Math.floor(rand() * 4);
    const m = 80;
    p.x = edge === 0 ? -m : edge === 1 ? w + m : w * (0.2 + rand() * 0.6);
    p.y = edge === 2 ? -m : edge === 3 ? h + m : h * (0.2 + rand() * 0.6);
    const tx = w * (0.25 + rand() * 0.5);
    const ty = h * (0.25 + rand() * 0.5);
    const d = Math.hypot(tx - p.x, ty - p.y) || 1;
    const sp = 22 + rand() * 14;
    p.dvx = ((tx - p.x) / d) * sp;
    p.dvy = ((ty - p.y) / d) * sp;
    p.vx = p.dvx;
    p.vy = p.dvy;
    p.lx = p.x;
    p.ly = p.y;
    props.push(p);
    tubes++;
  }
  const radiusOf = (p: Prop) => (p.kind === "duck" ? 27 * p.k : 46);
  const fishTarget = (load: number) => (load >= 0.4 ? Math.round(lerp(3, 6, clamp((load - 0.4) / 0.6, 0, 1))) : 0);
  function newFish(big: boolean): Fish {
    return { x: rand() * w, y: rand() * h, hd: rand() * TAU, spd: big ? 26 : 38 + rand() * 20, k: big ? 2.6 : 0.8 + rand() * 0.5, ph: rand() * TAU, big, flee: 0 };
  }

  return {
    resize(f) {
      w = f.w;
      h = f.h;
      bake();
      ensureLo(f);
      if (!props.some((p) => p.kind === "duck")) {
        const d = newProp("duck", f.t);
        d.x = w * (0.3 + rand() * 0.4);
        d.y = h * (0.3 + rand() * 0.4);
        // 핫 존(달력)이 있으면 그 둘레의 빈 띠 중 가장 넓은 곳에서 시작한다(위·아래·왼쪽·오른쪽).
        const hot = f.hot;
        if (hot) {
          const bands: [number, number, number, number][] = [
            [0, 0, w, hot.y],
            [0, hot.y + hot.h, w, h - hot.y - hot.h],
            [0, 0, hot.x, h],
            [hot.x + hot.w, 0, w - hot.x - hot.w, h]
          ];
          const best = bands.filter((b) => b[2] >= 70 && b[3] >= 70).sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
          if (best) {
            d.x = best[0] + 35 + rand() * (best[2] - 70);
            d.y = best[1] + 35 + rand() * (best[3] - 70);
          }
        }
        d.lx = d.x;
        d.ly = d.y;
        props.push(d);
      }
    },
    step(f) {
      const { dt, p, t, load } = f;
      ensureLo(f);
      const ttl = lerp(1.5, 3.0, load);
      const gapPx = lerp(9, 4, load);
      // ① 포인터 항적 — 길(팔·마루용 노드) + 거품 도장(길 위 몇 px마다). 집중 모드(끌기 중)엔 쉰다 — 끌기 스프링에 프레임 양보.
      if (!f.dim && p.inside && p.moved && p.speed > 40) {
        const sp = clamp(p.speed, 40, 2400);
        const sf = clamp((sp - 40) / 1400, 0.12, 1);
        const moved = Math.hypot(p.x - lastX, p.y - lastY);
        if (moved > gapPx * 1.6) {
          const dx = p.vx / (p.speed || 1);
          const dy = p.vy / (p.speed || 1);
          path.push({ x: p.x, y: p.y, t0: t, nx: -dy, ny: dx, sf });
          spawned++;
          lastX = p.x;
          lastY = p.y;
          if (path.length > 360) path.shift();
        }
        if (sx < -9000 || Math.hypot(p.x - sx, p.y - sy) > 90) {
          sx = p.x;
          sy = p.y;
        }
        let d = Math.hypot(p.x - sx, p.y - sy);
        while (d >= gapPx) {
          const k = gapPx / d;
          sx += (p.x - sx) * k;
          sy += (p.y - sy) * k;
          stamp(sx + (rand() - 0.5) * 3, sy + (rand() - 0.5) * 3, t, sf, 8 + 22 * sf);
          d = Math.hypot(p.x - sx, p.y - sy);
        }
      }
      while (path.length && t - path[0].t0 > ttl) path.shift();
      const sttl = ttl * 1.15;
      while (stamps.length && t - stamps[0].t0 > sttl) stamps.shift();
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += dt / r.dur;
        if (r.life >= 1) rings.splice(i, 1);
      }
      // ② 소품 — 해류 따라 둥둥, 잡히면 손을 따라, 놓으면 물의 저항으로 멈춘다. 튜브는 여력이 있을 때만 가끔.
      if (load >= 0.5 && t > nextTube && !props.some((q) => q.kind === "ring")) {
        spawnTube(t);
        nextTube = t + 40 + rand() * 40;
      }
      const drag = Math.pow(0.28, dt);
      for (let i = props.length - 1; i >= 0; i--) {
        const q = props[i];
        if (q.grab) {
          q.gox *= 0.9;
          q.goy *= 0.9;
          const tx = p.x + q.gox;
          const ty = p.y + q.goy;
          q.vx = (tx - q.x) * 16;
          q.vy = (ty - q.y) * 16;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.lift = Math.min(1, q.lift + dt * 6);
        } else {
          if (q.kind === "duck") {
            q.dvx = 7 * Math.sin(q.y * 0.004 + t * 0.11) + 3 * Math.cos(t * 0.07 + q.ph);
            q.dvy = 6 * Math.cos(q.x * 0.005 + t * 0.09) + 3 * Math.sin(t * 0.05 + q.ph);
            // 핫 존(달력·포스터 표면) 위에선 집을 수 없고 칸을 가리니 — 가장 가까운 가장자리 밖으로 살살 밀려난다.
            const hot = f.hot;
            if (hot) {
              const m = 24;
              const inX = q.x > hot.x - m && q.x < hot.x + hot.w + m;
              const inY = q.y > hot.y - m && q.y < hot.y + hot.h + m;
              if (inX && inY) {
                const dl = q.x - hot.x;
                const dr = hot.x + hot.w - q.x;
                const dtp = q.y - hot.y;
                const db = hot.y + hot.h - q.y;
                const min = Math.min(dl, dr, dtp, db);
                const k = 46;
                if (min === dl) q.dvx -= k;
                else if (min === dr) q.dvx += k;
                else if (min === dtp) q.dvy -= k;
                else q.dvy += k;
              }
            }
          }
          q.vx = q.dvx + (q.vx - q.dvx) * drag;
          q.vy = q.dvy + (q.vy - q.dvy) * drag;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.lift = Math.max(0, q.lift - dt * 4);
          if (q.kind === "duck") {
            const m = 34;
            if (q.x < m) {
              q.x = m;
              q.vx = Math.abs(q.vx) + 4;
            } else if (q.x > w - m) {
              q.x = w - m;
              q.vx = -Math.abs(q.vx) - 4;
            }
            if (q.y < m) {
              q.y = m;
              q.vy = Math.abs(q.vy) + 4;
            } else if (q.y > h - m) {
              q.y = h - m;
              q.vy = -Math.abs(q.vy) - 4;
            }
          } else {
            const inside = q.x > -60 && q.x < w + 60 && q.y > -60 && q.y < h + 60;
            if (inside) q.entered = true;
            const gone = q.x < -110 || q.x > w + 110 || q.y < -110 || q.y > h + 110;
            if ((q.entered && gone) || t - q.born > 150) {
              props.splice(i, 1);
              continue;
            }
          }
        }
        // 뱃머리 방향 — 움직이는 쪽으로 천천히 돈다(오리), 튜브는 느리게 자전.
        const sp = Math.hypot(q.vx, q.vy);
        if (q.kind === "duck") {
          if (sp > 12) {
            const want = Math.atan2(q.vy, q.vx) + Math.PI / 2;
            let diff = want - q.a;
            while (diff > Math.PI) diff -= TAU;
            while (diff < -Math.PI) diff += TAU;
            q.a += diff * Math.min(1, dt * (q.grab ? 6 : 1.4));
          }
        } else q.a += (0.12 + (q.grab ? 0 : sp * 0.002)) * dt;
        q.ph += dt * 1.7;
        // 소품 항적 — 빠르게 끌거나 던지면 거품 띠를 남긴다.
        if (load >= 0.4 && sp > 70) {
          const dd = Math.hypot(q.x - q.lx, q.y - q.ly);
          if (dd > 7) {
            stamp(q.x + (rand() - 0.5) * 4, q.y + (rand() - 0.5) * 4, t, clamp(sp / 900, 0.15, 1), 5 + 10 * clamp(sp / 900, 0.15, 1));
            q.lx = q.x;
            q.ly = q.y;
          }
        } else {
          q.lx = q.x;
          q.ly = q.y;
        }
        // 떠 있는 동안 둘레로 잔물결 고리 하나씩(둥둥).
        if (load >= 0.25 && !q.grab && t > q.nextRing) {
          ring(q.x, q.y, radiusOf(q) + 26, 0.22, 0, 1.9, 1.2);
          q.nextRing = t + 2.2 + rand() * 2.4;
        }
      }
      // ③ 물고기 무리 — 목표점(schoolX/Y)이 몇 초마다 옮겨지고 각자 흔들리며 따라간다. 포인터 120px 안이면 흩어져 달아난다.
      const wantFish = fishTarget(load);
      const smallFish = fish.filter((q) => !q.big).length;
      if (smallFish < wantFish) fish.push(newFish(false));
      else if (smallFish > wantFish) {
        const i = fish.findIndex((q) => !q.big);
        if (i >= 0) fish.splice(i, 1);
      }
      const wantBig = load >= 0.7;
      const bigIdx = fish.findIndex((q) => q.big);
      if (wantBig && bigIdx < 0) fish.push(newFish(true));
      else if (!wantBig && bigIdx >= 0) fish.splice(bigIdx, 1);
      if (fish.length) {
        if (t > schoolNext) {
          schoolX = w * (0.15 + rand() * 0.7);
          schoolY = h * (0.15 + rand() * 0.7);
          schoolNext = t + 6 + rand() * 8;
        }
        for (const q of fish) {
          if (p.inside) {
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d < (q.big ? 160 : 120) && d > 0.01 && q.flee <= 0) {
              q.flee = 1.4;
              q.hd = Math.atan2(dy, dx) + (rand() - 0.5) * 0.8;
              fishFled++;
            }
          }
          if (q.flee > 0) q.flee -= dt;
          else {
            const tx = q.big ? schoolX + Math.cos(q.ph) * 120 : schoolX + Math.cos(q.ph + t * 0.3) * 60;
            const ty = q.big ? schoolY + Math.sin(q.ph) * 120 : schoolY + Math.sin(q.ph + t * 0.27) * 60;
            const want = Math.atan2(ty - q.y, tx - q.x);
            let diff = want - q.hd;
            while (diff > Math.PI) diff -= TAU;
            while (diff < -Math.PI) diff += TAU;
            q.hd += clamp(diff, -1.6 * dt, 1.6 * dt) + Math.sin(t * 2.1 + q.ph) * 0.5 * dt;
          }
          const sp = q.spd * (q.flee > 0 ? 3.2 : 1);
          q.x += Math.cos(q.hd) * sp * dt;
          q.y += Math.sin(q.hd) * sp * dt;
          q.ph += dt * (q.flee > 0 ? 3 : 1);
          const m = 60;
          if (q.x < -m) q.x = w + m - 1;
          else if (q.x > w + m) q.x = -m + 1;
          if (q.y < -m) q.y = h + m - 1;
          else if (q.y > h + m) q.y = -m + 1;
        }
      }
      // ④ 물방울 — 여력 0.5부터 3~8초에 하나, 1.4초 동안 커졌다 톡 터진다.
      if (load >= 0.5 && t > nextBubble) {
        bubbles.push({ x: 40 + rand() * (w - 80), y: 40 + rand() * (h - 80), t0: t });
        nextBubble = t + 3 + rand() * 5;
      }
      for (let i = bubbles.length - 1; i >= 0; i--) if (t - bubbles[i].t0 > 1.6) bubbles.splice(i, 1);
      // ⑤ 햇빛 반짝임 — 여력 0.3부터 6~14개.
      const wantGl = load >= 0.3 ? Math.round(lerp(6, 14, load)) : 0;
      while (glints.length < wantGl) glints.push({ x: rand() * w, y: rand() * h, ph: rand() * TAU, r: 1.6 + rand() * 1.8 });
      if (glints.length > wantGl) glints.length = wantGl;
      // 소품끼리 겹치지 않게(원 분리).
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          const a = props[i];
          const b = props[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = radiusOf(a) + radiusOf(b) - 6;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 0.001) continue;
          const d = Math.sqrt(d2);
          const ov = (min - d) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          if (!a.grab) {
            a.x -= nx * ov;
            a.y -= ny * ov;
            a.vx -= nx * 20;
            a.vy -= ny * 20;
          }
          if (!b.grab) {
            b.x += nx * ov;
            b.y += ny * ov;
            b.vx += nx * 20;
            b.vy += ny * 20;
          }
        }
      }
    },
    draw(g, f) {
      const { t, load } = f;
      if (!lo || !stampSpr) return;
      const ttl = lerp(1.5, 3.0, load);
      const sttl = ttl * 1.15;
      const L = lo.g;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.clearRect(0, 0, lo.c.width, lo.c.height);
      L.setTransform(loS, 0, 0, loS, 0, 0);
      L.lineCap = "round";
      L.lineJoin = "round";
      // 물고기 '깊이' — 저해상 층엔 몸 아래 물빛 그늘만(물 밑에 있다는 신호). 몸은 본 캔버스에 에셋으로.
      for (const q of fish) {
        L.save();
        L.translate(q.x, q.y);
        L.rotate(q.hd);
        L.scale(q.k, q.k);
        softBlob(L, 2, 6, 22, "40 95 125", 0.26, 0);
        L.restore();
      }
      // 물방울 — 커지는 고리, 끝에 톡(작은 십자 튐).
      for (const b of bubbles) {
        const e = clamp((t - b.t0) / 1.4, 0, 1);
        const r = 2 + 8 * e;
        L.strokeStyle = `rgb(255 255 255 / ${0.55 * (1 - e * 0.5)})`;
        L.lineWidth = 1.6;
        L.beginPath();
        L.arc(b.x, b.y, r, 0, TAU);
        L.stroke();
        L.strokeStyle = `rgb(150 195 228 / ${0.35 * (1 - e)})`;
        L.beginPath();
        L.arc(b.x, b.y, r + 2, 0, TAU);
        L.stroke();
        if (t - b.t0 > 1.4) {
          const pe = (t - b.t0 - 1.4) / 0.2;
          L.strokeStyle = `rgb(255 255 255 / ${0.7 * (1 - pe)})`;
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * TAU + 0.4;
            L.beginPath();
            L.moveTo(b.x + Math.cos(a) * (r + 2), b.y + Math.sin(a) * (r + 2));
            L.lineTo(b.x + Math.cos(a) * (r + 6 + 8 * pe), b.y + Math.sin(a) * (r + 6 + 8 * pe));
            L.stroke();
          }
        }
      }
      // 거품 띠 — 나이 들수록 넓게 번지고 옅어진다(에너지가 흩어짐).
      for (const s of stamps) {
        const age = t - s.t0;
        const k = 1 - age / sttl;
        if (k <= 0) continue;
        const R = s.r * (1 + 1.9 * (1 - k));
        L.globalAlpha = 0.42 * Math.pow(k, 1.3) * (0.4 + 0.6 * s.sf);
        L.drawImage(stampSpr, s.x - R, s.y - R, R * 2, R * 2);
      }
      L.globalAlpha = 1;
      if (path.length > 1) {
        // 각 점의 벌어진 정도 d = (옆으로 퍼지는 속도 ≈ 0.34×진행속도 상당) × 나이. 나이 0.85승 — 처음 빠르게 벌어지고
        // 뒤로 갈수록 느려진다.
        const armPt = (n: Node, s: number, age: number): [number, number] => {
          const d = (36 + 150 * n.sf) * Math.pow(age, 0.85) + 4;
          return [n.x + n.nx * s * d, n.y + n.ny * s * d];
        };
        const passes = load >= 0.3 ? [0, 1] : [1];
        for (const s of [-1, 1]) {
          for (const pass of passes) {
            for (let i = 1; i < path.length; i++) {
              const a0 = path[i - 1];
              const a1 = path[i];
              const age = t - a1.t0;
              const k = 1 - age / ttl;
              if (k <= 0) continue;
              const [x0, y0] = armPt(a0, s, t - a0.t0);
              const [x1, y1] = armPt(a1, s, age);
              const weight = 0.5 + 0.5 * a1.sf;
              if (pass === 0) {
                L.strokeStyle = `rgb(150 195 228 / ${0.2 * k * weight})`;
                L.lineWidth = 14 + 12 * (1 - k);
              } else {
                L.strokeStyle = `rgb(255 255 250 / ${0.38 * Math.pow(k, 1.1) * weight})`;
                L.lineWidth = 4 + 2 * (1 - k);
              }
              L.beginPath();
              L.moveTo(x0, y0);
              L.lineTo(x1, y1);
              L.stroke();
            }
          }
        }
        // 가로 마루 — 몇 점마다 두 팔 사이를 뒤로 볼록하게(항적 안쪽의 층층 물결). 여력이 있을 때만.
        if (load >= 0.55) {
          for (let i = 2; i < path.length; i += 4) {
            const n = path[i];
            const age = t - n.t0;
            const k = 1 - age / ttl;
            if (k <= 0.05) continue;
            const [lx, ly] = armPt(n, -1, age);
            const [rx, ry] = armPt(n, 1, age);
            const back = path[i - 2];
            const bx = back.x - n.x;
            const by = back.y - n.y;
            const bl = Math.hypot(bx, by) || 1;
            const bulge = (14 + 40 * n.sf) * Math.pow(age, 0.6);
            L.strokeStyle = `rgb(255 255 250 / ${0.22 * k * (0.5 + 0.5 * n.sf)})`;
            L.lineWidth = 2.2;
            L.beginPath();
            L.moveTo(lx, ly);
            L.quadraticCurveTo(n.x + (bx / bl) * bulge, n.y + (by / bl) * bulge, rx, ry);
            L.stroke();
          }
        }
      }
      // 원형 잔물결(누름) — 부드러운 저해상 층에서.
      for (const r of rings) {
        if (r.life < 0) continue;
        const e = 1 - Math.pow(1 - r.life, 2.4);
        const rad = 6 + r.maxR * e;
        const a = r.a * (1 - r.life);
        const lw = r.w * (1 - r.life * 0.6) + 0.8;
        L.lineWidth = lw * 2.6;
        L.strokeStyle = `rgb(120 175 215 / ${a * 0.4})`;
        L.beginPath();
        L.arc(r.x, r.y, rad, 0, TAU);
        L.stroke();
        L.lineWidth = lw;
        L.strokeStyle = `rgb(255 255 250 / ${a})`;
        L.beginPath();
        L.arc(r.x, r.y, rad, 0, TAU);
        L.stroke();
      }
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "medium";
      g.drawImage(lo.c, 0, 0, f.w, f.h);
      // 물고기(public/ambient/fish.svg) — 물 밑이라 반투명, 헤엄칠 때 꼬리 쪽이 좌우로 살랑(몸 뒤쪽을 잘게 기울여 그린다:
      // 앞 절반은 그대로, 뒤 절반은 wag만큼 회전 — 스프라이트 두 조각).
      if (fishSpr) {
        for (const q of fish) {
          const wag = Math.sin(t * (q.flee > 0 ? 22 : 9) + q.ph) * (q.flee > 0 ? 0.32 : 0.18);
          const k = q.k;
          const a = q.hd + Math.PI / 2;
          g.save();
          g.globalAlpha = q.big ? 0.5 : 0.66;
          g.translate(q.x, q.y);
          g.rotate(a + wag * 0.25);
          g.scale(k, k);
          const sw = fishSpr.w;
          const sh = fishSpr.h;
          // 앞 절반(머리~몸통)
          g.drawImage(fishSpr.c, 0, 0, fishSpr.c.width, fishSpr.c.height * 0.55, -sw / 2, -sh / 2, sw, sh * 0.55);
          // 뒤 절반(꼬리) — 몸통 중간을 축으로 wag만큼 더 돌린다.
          g.translate(0, sh * 0.05);
          g.rotate(wag);
          g.drawImage(fishSpr.c, 0, fishSpr.c.height * 0.5, fishSpr.c.width, fishSpr.c.height * 0.5, -sw / 2, -sh * 0.05, sw, sh * 0.5);
          g.restore();
        }
      }
      // 햇빛 반짝임 — 물결 위의 작은 별(숨쉬듯 밝아졌다 사라짐), 본 캔버스에 또렷하게.
      for (const gl of glints) {
        const a = Math.max(0, Math.sin(t * 1.4 + gl.ph));
        if (a < 0.05) continue;
        g.save();
        g.translate(gl.x, gl.y);
        g.rotate(gl.ph);
        g.strokeStyle = `rgb(255 255 255 / ${a * 0.9})`;
        g.lineWidth = 1.2;
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * TAU;
          g.moveTo(0, 0);
          g.lineTo(Math.cos(ang) * gl.r * 2.2 * a, Math.sin(ang) * gl.r * 2.2 * a);
        }
        g.stroke();
        g.fillStyle = `rgb(255 255 255 / ${a})`;
        g.beginPath();
        g.arc(0, 0, gl.r * 0.6, 0, TAU);
        g.fill();
        g.restore();
      }
      // 뱃머리 — 빠르게 움직이는 포인터 앞의 밝은 물마루(본 캔버스, 또렷하게).
      const p = f.p;
      if (load >= 0.3 && p.inside && p.speed > 160) {
        const sf = clamp((p.speed - 160) / 1400, 0, 1);
        const dir = Math.atan2(p.vy, p.vx);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(dir);
        g.scale(0.55, 1);
        softBlob(g, 10, 0, 12 + 10 * sf, "255 255 252", 0.5 * sf + 0.12);
        g.restore();
      }
      // 소품 — 그림자(높이만큼 멀리) + 스프라이트(둥둥: 미세한 회전·크기 숨쉬기).
      for (const q of props) {
        const spr = q.kind === "duck" ? duckSpr : ringSpr;
        if (!spr) continue;
        const bob = Math.sin(q.ph) * 0.03;
        const size = q.k * (1 + bob + 0.1 * q.lift);
        if (shadow) {
          g.save();
          g.globalAlpha = 0.28 + 0.12 * q.lift;
          g.translate(q.x + 4 + 10 * q.lift, q.y + 6 + 12 * q.lift);
          g.rotate(q.a);
          const sw = q.kind === "duck" ? 70 : 100;
          const sh = q.kind === "duck" ? 76 : 100;
          g.drawImage(shadow, (-sw / 2) * size, (-sh / 2) * size, sw * size, sh * size);
          g.restore();
        }
        drawSprite(g, spr, q.x, q.y, q.a + Math.sin(q.ph * 0.7) * 0.05, size);
      }
    },
    pointerDown(f, onBackground) {
      const { x, y } = f.p;
      // 소품 집기 — 바탕 위에서만(칸·버튼 위 클릭은 그쪽 일).
      if (onBackground) {
        let best = -1;
        let bd = Infinity;
        for (let i = 0; i < props.length; i++) {
          const q = props[i];
          const d = Math.hypot(q.x - x, q.y - y);
          if (d < radiusOf(q) + 6 && d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) {
          const q = props[best];
          q.grab = true;
          q.gox = q.x - x;
          q.goy = q.y - y;
          q.lift = 0.4;
          ring(q.x, q.y, radiusOf(q) + 30, 0.35, 0, 1.2, 1.6);
          return true;
        }
      }
      // 누르면 묵직한 원형 잔물결 — 바탕이 아니어도(칸 위) 물은 튄다: 장난감이라 방해가 아니다.
      if (f.load < 0.3) ring(x, y, 130, 0.5, 0, 1.8, 2.4);
      else {
        ring(x, y, 150, 0.7, 0, 2.0, 3.2);
        ring(x, y, 190, 0.5, 0.18, 2.3, 2.6);
        ring(x, y, 230, 0.32, 0.4, 2.6, 2);
      }
      return onBackground;
    },
    pointerUp(f) {
      for (const q of props) {
        if (!q.grab) continue;
        q.grab = false;
        q.vx = clamp(f.p.vx * 0.85, -1400, 1400);
        q.vy = clamp(f.p.vy * 0.85, -1400, 1400);
        ring(q.x, q.y, radiusOf(q) + 40, 0.3, 0, 1.6, 1.4);
      }
    },
    debug() {
      return {
        path: path.length,
        stamps: stamps.length,
        stamped,
        rings: rings.length,
        spawned,
        loScale: loS,
        props: props.map((q) => [q.kind, Math.round(q.x), Math.round(q.y), q.grab ? 1 : 0]),
        tubes,
        sprites: { duck: !!duckSpr, ring: !!ringSpr },
        fish: fish.map((q) => [Math.round(q.x), Math.round(q.y), q.big ? 1 : 0, q.flee > 0 ? 1 : 0]),
        fishFled,
        fishSprite: !!fishSpr,
        bubbles: bubbles.length,
        glints: glints.length
      };
    }
  };
}
