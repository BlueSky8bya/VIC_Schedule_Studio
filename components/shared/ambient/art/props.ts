// 소품 그리기(2026-09-04) — 장면·연대기가 놓는 작은 것들(흙더미·연잎·버섯·잔가지·조약돌·풀포기·클로버·데이지·민들레·눈사람)을 **한 API**로
// 그린다: `drawProp(g, art, id, x, y, …)`. 아트 파일(`public/ambient/art/<id>.png`)이 있으면 그것, 없으면 여기의 코드 도형(옛 그림을
// 그대로 옮긴 대체물)을 한 번 구워 쓴다. 앵커는 아트와 같다(stand = 바닥 접점, flat = 가운데) — 파일이 생겨도 자리가 안 움직인다.
// 아트 보드(/studio/ambient-art)의 '지금' 미리보기도 같은 대체물을 보여준다(`fallbackSprite`).

import { artSlot } from "./manifest";
import { drawArt, type ArtSet, type ArtSprite } from "./load";
import { makeCanvas, rng, softBlob, TAU } from "@/components/shared/ambient/scenes/util";
import { depthScale, GROUND_SQUASH, HORIZON_V } from "@/components/shared/ambient/world/view";

const cache = new Map<string, HTMLCanvasElement | null>();
// 발밑 그림자 색 — 장면이 계절에 맞춰 바꾼다. 눈 위의 따뜻한 갈색 그림자는 "어두운 얼룩"으로 읽힌다.
let shadowRGB = "60 66 58";
export const setPropShadow = (rgb: string) => {
  shadowRGB = rgb;
};

// 자리 점유 — 큰 소품끼리 겹쳐 놓이면 "바위가 그루터기를 뚫고 나온" 그림이 된다(2026-09-04 소유자).
// 장면의 bake() 시작에서 resetPropField(), 놓기 전에 claimSpot()으로 자리를 잡는다. 결정적 rng 순서는 호출 쪽 책임.
let propField: { x: number; y: number; r: number }[] = [];
export const resetPropField = () => {
  propField = [];
};
/** 반경 r인 자리를 (x,y)에 잡는다. 이미 찬 자리면 false — 호출 쪽이 다른 후보로 다시 시도한다. */
export function claimSpot(x: number, y: number, r: number): boolean {
  for (const o of propField) {
    const dx = x - o.x;
    const dy = (y - o.y) / 0.7; // 3/4 시점: 세로로 눌린 발자국 기준
    if (dx * dx + dy * dy < (r + o.r) * (r + o.r) * 0.62) return false;
  }
  propField.push({ x, y, r });
  return true;
}
const SCALE = 2;

type Painter = (g: CanvasRenderingContext2D, W: number, H: number, r: () => number, variant: number) => void;

// 각 대체물은 (W×H) 상자 안에 그린다. stand는 바닥이 H, flat은 가운데 (W/2, H/2).
const PAINT: Record<string, Painter> = {
  "soil-mound": (g, W, H) => {
    g.translate(W / 2, H / 2);
    g.scale(1, H / W);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, W / 2);
    rg.addColorStop(0, "rgb(88 66 46 / 0.55)");
    rg.addColorStop(0.55, "rgb(120 95 70 / 0.5)");
    rg.addColorStop(0.82, "rgb(152 128 98 / 0.4)");
    rg.addColorStop(1, "rgb(152 128 98 / 0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, W / 2, 0, TAU);
    g.fill();
  },
  molehill: (g, W, H) => {
    g.translate(W / 2, H - 8);
    softBlob(g, 1, 3, 15, "60 46 34", 0.22, 0);
    g.save();
    g.scale(1, 0.62);
    const rg = g.createRadialGradient(-4, -5, 1, 0, 0, 14);
    rg.addColorStop(0, "#a8896a");
    rg.addColorStop(0.6, "#8a6a4c");
    rg.addColorStop(1, "#6f543c");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, 14, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = "rgb(60 46 34 / 0.45)";
    for (const [x, y] of [[-6, -2], [3, -4], [7, 2], [-2, 4], [1, -1]] as const) {
      g.beginPath();
      g.arc(x, y, 0.9, 0, TAU);
      g.fill();
    }
  },
  "grass-patch": (g, W, H) => {
    softBlob(g, W / 2, H / 2, 18, "96 150 92", 0.28, 0);
  },
  lilypad: (g, W, H, r, variant) => {
    // 연잎 — 둥근 잎에 V자 갈라짐, 잎맥, **가장자리 두께**(아래쪽 어두운 초승달 + 바깥 밝은 테). 겹쳐도 층이 읽히게(2026-09-04 소유자).
    const R = Math.min(W, H) / 2 - 3;
    g.translate(W / 2, H / 2);
    g.rotate(variant * 2.1);
    const cut = 0.32 + variant * 0.06;
    const leaf = (rr: number) => {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, rr, cut, TAU - cut);
      g.closePath();
    };
    // 아래쪽 두께(그늘 초승달)
    g.save();
    g.translate(1.5, 2.2);
    leaf(R);
    g.fillStyle = "rgb(46 82 60 / 0.55)";
    g.fill();
    g.restore();
    leaf(R);
    const rg = g.createRadialGradient(-R * 0.25, -R * 0.25, 2, 0, 0, R);
    rg.addColorStop(0, "#93bb95");
    rg.addColorStop(0.75, "#6a9a72");
    rg.addColorStop(1, "#5a8a66");
    g.fillStyle = rg;
    g.fill();
    g.strokeStyle = "rgb(230 245 225 / 0.55)";
    g.lineWidth = 1.3;
    g.stroke();
    g.strokeStyle = "rgb(60 100 70 / 0.32)";
    g.lineWidth = 0.9;
    for (let i = 0; i < 7; i++) {
      const a = cut + 0.5 + (i / 6) * (TAU - 2 * cut - 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
      g.stroke();
    }
    softBlob(g, -R * 0.3, -R * 0.35, R * 0.45, "255 255 240", 0.16, 0);
  },
  mushroom: (g, W, H, r, variant) => {
    const one = (x: number, base: number, rr: number) => {
      g.fillStyle = "rgb(236 224 200)";
      g.beginPath();
      g.ellipse(x, base - rr * 0.55, rr * 0.42, rr * 0.6, 0, 0, TAU);
      g.fill();
      const cap = g.createRadialGradient(x - rr * 0.3, base - rr * 1.2, 1, x, base - rr, rr);
      cap.addColorStop(0, "#b48864");
      cap.addColorStop(1, "#7f5a40");
      g.fillStyle = cap;
      g.beginPath();
      g.ellipse(x, base - rr, rr, rr * 0.8, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(245 236 218 / 0.85)";
      for (let k = 0; k < 4; k++) {
        const aa = r() * TAU;
        const d = r() * rr * 0.55;
        g.beginPath();
        g.arc(x + Math.cos(aa) * d, base - rr + Math.sin(aa) * d * 0.8, 1 + r() * 1.2, 0, TAU);
        g.fill();
      }
    };
    if (variant === 0) one(W / 2, H - 1, Math.min(W, H) * 0.42);
    else {
      one(W * 0.38, H - 1, Math.min(W, H) * 0.36);
      one(W * 0.68, H - 1, Math.min(W, H) * 0.26);
    }
  },
  twig: (g, W, H, r) => {
    const len = W * 0.86;
    const x = W * 0.07;
    const y = H / 2;
    g.lineCap = "round";
    g.strokeStyle = "rgb(96 74 52 / 0.7)";
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(x, y + 1);
    g.lineTo(x + len * 0.55, y - 1);
    g.lineTo(x + len, y + (r() - 0.5) * 6);
    g.stroke();
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + len * 0.55, y - 1);
    g.lineTo(x + len * 0.8, y - H * 0.35);
    g.stroke();
  },
  pebble: (g, W, H, r) => {
    const x = W / 2;
    const y = H / 2;
    const rr = Math.min(W, H) * 0.42;
    g.fillStyle = r() < 0.5 ? "rgb(170 172 168)" : "rgb(148 150 146)";
    g.beginPath();
    g.ellipse(x, y, rr * 1.15, rr * 0.85, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgb(255 255 250 / 0.4)";
    g.beginPath();
    g.ellipse(x - rr * 0.3, y - rr * 0.3, rr * 0.45, rr * 0.28, 0, 0, TAU);
    g.fill();
  },
  "grass-tuft": (g, W, H, r) => tuft(g, W, H, r, ["rgb(140 190 118 / 0.75)", "rgb(112 168 104 / 0.7)"]),
  "grass-dry": (g, W, H, r) => tuft(g, W, H, r, ["rgb(150 126 82 / 0.85)", "rgb(120 100 62 / 0.85)"]),
  clover: (g, W, H, r) => {
    const x = W / 2;
    const y = H / 2;
    g.fillStyle = "rgb(96 150 92 / 0.7)";
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + r() * 0.3;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 3.4, 2.6, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgb(230 245 225 / 0.35)";
    g.beginPath();
    g.arc(x, y, 1.3, 0, TAU);
    g.fill();
  },
  daisy: (g, W, H) => {
    const x = W / 2;
    const y = H * 0.42;
    g.strokeStyle = "rgb(120 165 100 / 0.8)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y + 3);
    g.lineTo(x + 1, H - 1);
    g.stroke();
    // 꽃잎 5장(8장은 눈송이·별표로 읽혔다), 가운데는 채도 낮은 크림 노랑.
    g.fillStyle = "rgb(252 252 248 / 0.96)";
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k / 5) * TAU;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 4.4, y + Math.sin(a) * 4.4, 3.6, 2.6, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgb(214 196 140 / 0.95)";
    g.beginPath();
    g.arc(x, y, 2.5, 0, TAU);
    g.fill();
  },
  "dandelion-puff": (g, W, H) => {
    const x = W / 2;
    const y = H * 0.38;
    g.strokeStyle = "rgb(120 165 100 / 0.7)";
    g.lineWidth = 1.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y + 6);
    g.lineTo(x + 2, H - 1);
    g.stroke();
    // 홀씨 머리 — 26개 살이 방사하면 톱니바퀴 아이콘으로 읽혔다. 살 없이 점만 세 겹으로.
    softBlob(g, x, y, 11, "255 255 255", 0.5, 0);
    for (const [rr, n, a] of [[4.2, 5, 0.5], [7, 7, 0.7], [9.6, 7, 0.85]] as const) {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + rr;
        g.fillStyle = `rgb(255 255 255 / ${a})`;
        g.beginPath();
        g.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 1.4, 0, TAU);
        g.fill();
      }
    }
    g.fillStyle = "rgb(190 210 150)";
    g.beginPath();
    g.arc(x, y, 2.6, 0, TAU);
    g.fill();
  },
  "snowman-1": (g, W, H) => snowman(g, W, H, 1),
  "snowman-2": (g, W, H) => snowman(g, W, H, 2),
  "snowman-3": (g, W, H) => snowman(g, W, H, 3),
  // ── 큰 소품 대체물(2026-09-04 검토 1차) — 이 자리들이 `now: "none"`이라 scatterProps가 전부 건너뛰었고,
  // 그래서 육지 바이옴이 "잔디 벽지 한 장"이 됐다. 아트가 올 때까지의 대체물은 확정 화풍(픽셀 아트)에 맞춰
  // 평면 음영 + **같은 색조의 더 어두운 윤곽**(검정 금지) 2~3톤으로만 그린다.
  rock: (g, W, H, r, variant) => {
    // 변형마다 돌 색이 다르다 — 회청 일변도면 가을·모래 땅 위에서 파랗게 뜬다(검토 3차).
    const COLS: string[][] = [
      ["#9aa0a2", "#7c8385", "#5c6365"],
      ["#a49c92", "#877f74", "#645d54"],
      ["#9ca3a0", "#7e8682", "#5e6663"],
      ["#a8a49a", "#8a8579", "#66625a"]
    ];
    rockShape(g, W, H, variant, COLS[variant % COLS.length]);
  },
  stump: (g, W, H) => {
    const x = W / 2;
    const b = H - 1;
    const rw = W * 0.42;
    const topY = b - H * 0.5; // 옆면을 낮게(0.62는 가늘고 길어 "덩어리"로 뭉갰다, 검토 라운드2 사이클3)
    flatBody(g, "#6f5a3e", "#463522", () => {
      g.beginPath();
      g.moveTo(x - rw, topY);
      g.lineTo(x - rw, b - 3);
      g.quadraticCurveTo(x, b + 3, x + rw, b - 3);
      g.lineTo(x + rw, topY);
      g.closePath();
    });
    // 나이테 — 넓은 윗면 타원(밝게) + 굵은 테 두 줄. 원통이라는 신호는 이 대비 하나다.
    g.fillStyle = "#c2a172";
    g.beginPath();
    g.ellipse(x, topY, rw, rw * 0.44, 0, 0, TAU);
    g.fill();
    g.strokeStyle = "#463522";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, topY, rw, rw * 0.44, 0, 0, TAU);
    g.stroke();
    dither(g, x - rw, b - H * 0.62, rw * 2, H * 0.6, "#54402c", 24, 77, () => {
      g.beginPath();
      g.moveTo(x - rw, b - H * 0.62);
      g.lineTo(x - rw * 0.94, b - 3);
      g.quadraticCurveTo(x, b + 2, x + rw * 0.94, b - 3);
      g.lineTo(x + rw, b - H * 0.62);
      g.closePath();
    });
    g.strokeStyle = "#8a6c4a";
    g.lineWidth = 1.4;
    for (const k of [0.66, 0.34]) {
      g.beginPath();
      g.ellipse(x, topY, rw * k, rw * 0.44 * k, 0, 0, TAU);
      g.stroke();
    }
  },
  log: (g, W, H) => {
    const y = H - H * 0.42;
    const rr = H * 0.36;
    flatBody(g, "#846a4a", "#57422d", () => {
      g.beginPath();
      g.moveTo(W * 0.14, y - rr);
      g.lineTo(W * 0.88, y - rr);
      g.quadraticCurveTo(W * 0.95, y, W * 0.88, y + rr);
      g.lineTo(W * 0.14, y + rr);
      g.quadraticCurveTo(W * 0.07, y, W * 0.14, y - rr);
      g.closePath();
    });
    g.fillStyle = "#a98a63";
    g.beginPath();
    g.ellipse(W * 0.14, y, H * 0.12, rr * 0.94, 0, 0, TAU);
    g.fill();
    g.strokeStyle = "#8a6c4a";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(W * 0.14, y, H * 0.06, rr * 0.5, 0, 0, TAU);
    g.stroke();
    dither(g, W * 0.14, y - rr, W * 0.74, rr * 2, "#57422d", 30, 91, () => {
      g.beginPath();
      g.moveTo(W * 0.14, y - rr);
      g.lineTo(W * 0.88, y - rr);
      g.quadraticCurveTo(W * 0.95, y, W * 0.88, y + rr);
      g.lineTo(W * 0.14, y + rr);
      g.quadraticCurveTo(W * 0.07, y, W * 0.14, y - rr);
      g.closePath();
    });
    // 껍질 결 두 줄.
    g.strokeStyle = "rgb(72 56 38 / 0.4)";
    g.beginPath();
    g.moveTo(W * 0.3, y - rr * 0.45);
    g.lineTo(W * 0.82, y - rr * 0.5);
    g.moveTo(W * 0.28, y + rr * 0.4);
    g.lineTo(W * 0.8, y + rr * 0.35);
    g.stroke();
  },
  "shrub-spring": (g, W, H, r) => shrub(g, W, H, r, "#9cc47f", "#7aa563", "#4f7346", "#f2f4ea"),
  "shrub-summer": (g, W, H, r) => shrub(g, W, H, r, "#7fa96a", "#638a54", "#3f6039"),
  "shrub-autumn": (g, W, H, r) => shrub(g, W, H, r, "#a8906a", "#8a7050", "#5c4a34"),
  "shrub-winter": (g, W, H, r) => shrub(g, W, H, r, "#b6bcc2", "#98a1a8", "#6d777e", "#ffffff"),
  "snow-pile": (g, W, H, r, variant) => {
    const b = H - 1;
    const x = W / 2 + (variant ? W * 0.06 : -W * 0.04);
    flatBody(g, "#f4f8fb", "#c7d3dd", () => {
      g.beginPath();
      g.moveTo(x - W * 0.46, b);
      g.quadraticCurveTo(x - W * 0.34, b - H * 0.86, x - W * 0.02, b - H * 0.8);
      g.quadraticCurveTo(x + W * 0.34, b - H * 0.72, x + W * 0.46, b);
      g.closePath();
    });
    g.fillStyle = "rgb(200 214 226 / 0.55)";
    g.beginPath();
    g.ellipse(x + W * 0.2, b - H * 0.2, W * 0.16, H * 0.13, 0, 0, TAU);
    g.fill();
  },
  reed: (g, W, H, r, variant) => {
    // 변형 0~1 = 여름 갈대(초록), 2~3 = 마른 억새(누런 회갈). 가을 언덕이 여름 풀색이면 계절이 어긋난다.
    const dry = variant >= 2;
    const x = W / 2;
    const b = H - 1;
    const n = 3 + (variant % 2);
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * (W * 0.24);
      const len = H * (0.72 + r() * 0.26);
      const bend = (r() - 0.5) * W * 0.5;
      g.strokeStyle = dry ? (i % 2 ? "#a89468" : "#b5a274") : i % 2 ? "#7d9464" : "#8fa471";
      g.lineWidth = 1.8;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x + dx, b);
      g.quadraticCurveTo(x + dx + bend * 0.3, b - len * 0.6, x + dx + bend, b - len);
      g.stroke();
      // 이삭 — 갈색 원통(선명한 갈색 금지, 카키 갈색).
      g.fillStyle = dry ? "#c0b394" : "#8a7350";
      g.beginPath();
      g.ellipse(x + dx + bend, b - len - H * 0.06, W * 0.075, H * 0.085, bend * 0.02, 0, TAU);
      g.fill();
    }
  },
  "dandelion-flower": (g, W, H) => {
    const x = W / 2;
    const y = H * 0.34;
    g.strokeStyle = "rgb(120 165 100 / 0.8)";
    g.lineWidth = 1.3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y + 4);
    g.lineTo(x + 1.5, H - 1);
    g.stroke();
    // 채도 낮은 크림 노랑(선명한 노랑 금지 — 오행 팔레트).
    g.fillStyle = "#ddd08a";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 2.9, 1.5, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#c8b970";
    g.beginPath();
    g.arc(x, y, 2.4, 0, TAU);
    g.fill();
  },
  lotus: (g, W, H) => {
    const x = W / 2;
    const y = H * 0.55;
    g.fillStyle = "#dcb7c0";
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.42;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.4, 6.2, a + Math.PI / 2, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#c79aa6";
    g.beginPath();
    g.ellipse(x, y - 1, 4.4, 5.2, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#e6d9a8";
    g.beginPath();
    g.arc(x, y - 2, 1.8, 0, TAU);
    g.fill();
  },
  "grass-tall": (g, W, H, r, variant) => {
    // 여름 초원의 표지 — 무릎 높이의 활처럼 휜 잎 + 고개 숙인 원통 이삭(강아지풀). 봄의 짧은 잔디 포기와
    // 실루엣이 확실히 달라야 두 계절이 갈린다(2026-09-04 소유자).
    const b = H - 1;
    const cx = W / 2;
    g.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const sd = i % 2 ? 1 : -1;
      const len = H * (0.5 + r() * 0.48);
      const bend = sd * W * (0.2 + r() * 0.3);
      g.strokeStyle = `rgb(${i % 3 === 0 ? "104 148 86" : "78 122 70"} / ${0.72 + r() * 0.28})`;
      g.lineWidth = 1.4 + r() * 0.9;
      g.beginPath();
      g.moveTo(cx + sd * 1.5, b);
      g.quadraticCurveTo(cx + bend * 0.4, b - len * 0.65, cx + bend, b - len);
      g.stroke();
    }
    // 이삭 — 고개 숙인 원통 하나(변형 3은 둘).
    const spikes = variant === 2 ? 2 : 1;
    for (let i = 0; i < spikes; i++) {
      const sd = i ? 1 : -1;
      const tipx = cx + sd * W * (0.1 + r() * 0.16);
      const tipy = b - H * (0.78 + r() * 0.16);
      g.strokeStyle = "rgb(88 124 74 / 0.9)";
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(cx, b);
      g.quadraticCurveTo(cx + sd * 2, b - H * 0.5, tipx, tipy);
      g.stroke();
      g.fillStyle = "#b3c184";
      g.save();
      g.translate(tipx, tipy);
      g.rotate(sd * 0.5);
      g.beginPath();
      g.ellipse(0, -H * 0.06, W * 0.1, H * 0.12, 0, 0, TAU);
      g.fill();
      g.strokeStyle = "rgb(126 138 88 / 0.85)";
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
  },
  // 아래 셋은 장면이 이미 부르는데 자리(매니페스트)가 없어 **아무것도 안 그려지던** 것들이다(2026-09-05).
  driftwood: (g, W, H, r, variant) => {
    // 파도에 씻겨 은회색으로 바랜 나무토막 — 껍질 없이 결만, 한쪽 끝이 부러져 뾰족하다.
    const b = H - 1;
    const cy = b - H * 0.36;
    const hh = H * 0.3;
    const bend = (variant % 2 ? 1 : -1) * H * 0.14;
    const body = () => {
      g.beginPath();
      g.moveTo(W * 0.04, cy + hh * 0.2);
      g.quadraticCurveTo(W * 0.5, cy - hh + bend, W * 0.94, cy - hh * 0.3);
      g.lineTo(W * 0.99, cy + hh * 0.2);
      g.quadraticCurveTo(W * 0.5, cy + hh + bend, W * 0.06, cy + hh * 0.7);
      g.closePath();
    };
    flatBody(g, "#b3ada2", "#6f6a60", body, b);
    g.save();
    body();
    g.clip();
    // 결 — 길게 갈라진 금 몇 줄(밝은 면은 위, 그늘은 아래).
    g.fillStyle = "#c9c4b9";
    g.beginPath();
    g.moveTo(W * 0.06, cy - hh * 0.2);
    g.quadraticCurveTo(W * 0.5, cy - hh * 0.8 + bend, W * 0.96, cy - hh * 0.2);
    g.lineTo(W * 0.96, cy);
    g.quadraticCurveTo(W * 0.5, cy - hh * 0.45 + bend, W * 0.06, cy);
    g.closePath();
    g.fill();
    g.strokeStyle = "#6f6a60";
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const t = 0.2 + i * 0.24;
      g.beginPath();
      g.moveTo(W * 0.1, cy + hh * (t - 0.4));
      g.quadraticCurveTo(W * 0.5, cy + hh * (t - 0.7) + bend, W * 0.92, cy + hh * (t - 0.35));
      g.stroke();
    }
    dither(g, 0, cy - hh, W, hh * 2, "#5d584f", 26, 13 + variant * 5, body);
    g.restore();
    // 부러진 끝 — 뾰족한 삼각 두 개.
    g.fillStyle = "#a49e93";
    g.beginPath();
    g.moveTo(W * 0.99, cy - hh * 0.3);
    g.lineTo(W * 1.0, cy + hh * 0.2);
    g.lineTo(W * 0.86, cy - hh * 0.05);
    g.closePath();
    g.fill();
    void r;
  },
  "shell-clam": (g, W, H, r, variant) => {
    // 위에서 본 조개 한 짝 — 크림빛 흰색에 부챗살 결.
    const cx = W / 2;
    const cy = H / 2;
    const rw = W * 0.46;
    const rh = H * 0.42;
    flatBody(g, "#f3ecdd", "#b6a98d", () => {
      g.beginPath();
      g.moveTo(cx - rw, cy + rh * 0.5);
      g.quadraticCurveTo(cx, cy - rh * 1.5, cx + rw, cy + rh * 0.5);
      g.quadraticCurveTo(cx, cy + rh * 1.2, cx - rw, cy + rh * 0.5);
      g.closePath();
    });
    g.strokeStyle = "rgb(182 169 141 / 0.85)";
    g.lineWidth = 1;
    const ribs = 5 + (variant % 3);
    for (let i = 0; i <= ribs; i++) {
      const a = -Math.PI * 0.82 + (i / ribs) * Math.PI * 0.64;
      g.beginPath();
      g.moveTo(cx, cy + rh * 0.55);
      g.lineTo(cx + Math.cos(a) * rw * 0.94, cy + rh * 0.55 + Math.sin(a) * rh * 1.5);
      g.stroke();
    }
    void r;
  },
  starfish: (g, W, H, r) => {
    // 팔 다섯 — 채도 낮은 살구·모래빛(선명한 주황 금지).
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.46;
    flatBody(g, "#d9bb9c", "#9c7f62", () => {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU;
        const rr = i % 2 === 0 ? R : R * 0.4;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    });
    g.fillStyle = "#c2a184";
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU;
      const d = Math.pow(r(), 0.6) * R * 0.8;
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.1, 0, TAU);
      g.fill();
    }
  },
  "tree-pine": (g, W, H, r) => pine(g, W, H, r, "green"),
  "tree-pine-autumn": (g, W, H, r) => pine(g, W, H, r, "muted"),
  "tree-pine-winter": (g, W, H, r) => pine(g, W, H, r, "snow")
};

/** 침엽수(소나무·곰솔) 대체물 — 동물의 숲 카메라(3/4)에서 본 톱니 원뿔 3단 + 짧고 굵은 줄기.
 *  참나무(둥근 잎 덩이)와 실루엣이 확실히 갈려야 "혼효림"으로 읽힌다. 밝은 땅(눈·모래) 위에서 붉은 줄기는
 *  가장 시끄러운 요소라 회갈색 고정(2026-09-04 소유자 규칙). */
function pine(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, tone: "green" | "muted" | "snow") {
  // 침엽수 대체물 — 동물의 숲 카메라(3/4)에서 본 톱니 원뿔 3단 + 짧고 굵은 줄기.
  // 1차 판(2026-09-04)은 단(段)마다 path에 moveTo를 두 번 써 **좌·우 반쪽이 별개 서브패스**가 됐고,
  // 그 탓에 clip이 한쪽만 잡아 밝은 면이 나무 옆에 **선 채로 복제된 초록 삼각형**으로 새어 나왔다
  // (검토 라운드2 현실성 #2). 이번 판은 단마다 **한 번의 연속 경로**(꼭대기 → 오른쪽 톱니 → 밑변 → 왼쪽 톱니 → 꼭대기)만 쓴다.
  const snowy = tone === "snow";
  const b = H - 1;
  const cx = W / 2;
  const line = snowy ? "#16241c" : tone === "muted" ? "#1e2a1c" : "#18291d";
  const dark = snowy ? "#1f2e22" : tone === "muted" ? "#26301f" : "#1f3a27";
  const mid = snowy ? "#2f4229" : tone === "muted" ? "#3a4a2e" : "#33573a";
  const light = snowy ? "#3f5636" : tone === "muted" ? "#4b5a39" : "#457049";
  // 줄기 — 짧고 굵은 회갈색(밝은 땅 위의 붉은 줄기는 가장 시끄럽다). 맨 아래 단이 윗부분을 덮는다.
  const tw = Math.max(3, Math.round(W * 0.13));
  const th = Math.round(H * 0.14);
  g.fillStyle = "#5c4e3e";
  g.fillRect(Math.round(cx - tw / 2), b - th, tw, th);
  g.fillStyle = "#76664f";
  g.fillRect(Math.round(cx - tw / 2), b - th, Math.max(1, Math.round(tw * 0.36)), th);

  // 아래 단이 위 단을 덮어야 층이 겹쳐 보인다 → **위 단부터** 그린다.
  const tiers = [
    { base: b - H * 0.58, hw: W * 0.27, hh: H * 0.34 },
    { base: b - H * 0.33, hw: W * 0.38, hh: H * 0.32 },
    { base: b - H * 0.07, hw: W * 0.48, hh: H * 0.35 }
  ];
  for (const tr of tiers) {
    const apexY = tr.base - tr.hh;
    // 한 번의 연속 경로. k = 0(꼭대기) → 1(밑단)로 내려가며 가지 끝이 네 번 튀어나온다.
    const path = () => {
      g.beginPath();
      g.moveTo(cx, apexY);
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const jag = 0.72 + 0.28 * (k % 2);
        g.lineTo(cx + tr.hw * t * jag, apexY + tr.hh * t - tr.hh * 0.06);
        g.lineTo(cx + tr.hw * t, apexY + tr.hh * t * 0.94);
      }
      g.lineTo(cx + tr.hw * 0.42, tr.base);
      g.lineTo(cx - tr.hw * 0.42, tr.base);
      for (let k = 4; k >= 1; k--) {
        const t = k / 4;
        const jag = 0.72 + 0.28 * (k % 2);
        g.lineTo(cx - tr.hw * t, apexY + tr.hh * t * 0.94);
        g.lineTo(cx - tr.hw * t * jag, apexY + tr.hh * t - tr.hh * 0.06);
      }
      g.closePath();
    };
    flatBody(g, mid, line, path, tr.base);
    g.save();
    path();
    g.clip();
    // 밝은 면(왼쪽 위) · 그늘 면(오른쪽 아래) — 잎 덩이가 면으로 갈려야 픽셀 참나무와 화풍이 맞는다.
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(cx - tr.hw * 0.04, apexY - 2);
    g.lineTo(cx - tr.hw * 1.4, tr.base * 0.42 + apexY * 0.58);
    g.lineTo(cx - tr.hw * 0.62, tr.base + 4);
    g.lineTo(cx - tr.hw * 0.06, tr.base + 4);
    g.closePath();
    g.fill();
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(cx + tr.hw * 0.3, apexY + tr.hh * 0.1);
    g.lineTo(cx + tr.hw * 1.5, tr.base + 4);
    g.lineTo(cx + tr.hw * 0.16, tr.base + 4);
    g.closePath();
    g.fill();
    // 가지 단의 밝은 윗면 — 겨울의 눈 쐐기와 같은 자리. 이게 없으면 잎 덩이가 단색 삼각형이라 매끈한
    // 벡터로 읽힌다(사이클4 미관 #7: "침엽수만 매끈 벡터"). 눈이 있는 겨울은 아래에서 흰색으로 덮는다.
    if (!snowy) {
      g.fillStyle = light;
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const yTip = apexY + tr.hh * t - tr.hh * 0.06;
        const yIn = apexY + tr.hh * (t - 0.25) * 0.94;
        for (const sd of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx + sd * tr.hw * t * 0.96, yTip);
          g.lineTo(cx + sd * tr.hw * (t - 0.22) * 0.5, yIn);
          g.lineTo(cx + sd * tr.hw * (t - 0.22) * 0.5, yIn + 2.2);
          g.lineTo(cx + sd * tr.hw * t * 0.96, yTip + 2.4);
          g.closePath();
          g.fill();
        }
      }
      // 그늘 입술 — 밝은 띠 바로 아래(계단이 확실히 읽히게).
      g.fillStyle = dark;
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const yTip = apexY + tr.hh * t - tr.hh * 0.06;
        for (const sd of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx + sd * tr.hw * t * 0.96, yTip + 2.4);
          g.lineTo(cx + sd * tr.hw * (t - 0.22) * 0.5, yTip + 3.4);
          g.lineTo(cx + sd * tr.hw * (t - 0.22) * 0.5, yTip + 5.2);
          g.lineTo(cx + sd * tr.hw * t * 0.96, yTip + 4.6);
          g.closePath();
          g.fill();
        }
      }
    }
    if (snowy) {
      // 눈은 가지 **윗면**에 얹힌다 — 가로 막대로 그으면 케이크 층 줄무늬가 된다(2026-09-04 자체 검토 cc3).
      // 가지의 경사를 따라 기운 쐐기로, 좌우 각각.
      g.fillStyle = "#eef4fa";
      for (let k = 1; k <= 4; k++) {
        const t = k / 4;
        const yTip = apexY + tr.hh * t - tr.hh * 0.06;
        const yIn = apexY + tr.hh * (t - 0.25) * 0.94;
        for (const sd of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx + sd * tr.hw * t * 0.96, yTip);
          g.lineTo(cx + sd * tr.hw * (t - 0.22) * 0.5, yIn);
          g.lineTo(cx + sd * tr.hw * (t - 0.22) * 0.5, yIn + 2.6);
          g.lineTo(cx + sd * tr.hw * t * 0.96, yTip + 2.8);
          g.closePath();
          g.fill();
        }
      }
    }
    // 밑단 그늘 — 아래 단과 층이 갈린다. 전폭 막대는 케이크 층 선이 되므로 가지 밑선을 따라 짧게.
    g.fillStyle = line;
    g.globalAlpha = 0.3;
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sd * tr.hw, tr.base - 3);
      g.lineTo(cx + sd * tr.hw * 0.42, tr.base - 1);
      g.lineTo(cx + sd * tr.hw * 0.42, tr.base + 1);
      g.lineTo(cx + sd * tr.hw, tr.base);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    dither(g, cx - tr.hw, apexY, tr.hw * 2, tr.hh, line, 30, 71 + Math.round(tr.hw));
    g.restore();
  }
  void r;
}

function tuft(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, cols: string[]) {
  g.lineCap = "round";
  const x = W / 2;
  const y = H - 1;
  const n = 3 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const len = H * (0.5 + r() * 0.45);
    const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.42 + (r() - 0.5) * 0.3;
    const bend = (r() - 0.5) * 5;
    g.strokeStyle = cols[k % cols.length];
    g.lineWidth = 1.2 + r() * 0.8;
    g.beginPath();
    g.moveTo(x + k * 1.6 - (n - 1) * 0.8, y);
    g.quadraticCurveTo(x + bend, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
}

function snowman(g: CanvasRenderingContext2D, W: number, H: number, stage: number) {
  g.translate(W / 2, H - 2);
  const ball = (cx: number, cy: number, rr: number) => {
    const rg = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr);
    rg.addColorStop(0, "#ffffff");
    rg.addColorStop(0.8, "#e9eef3");
    rg.addColorStop(1, "#c9d4de");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.fill();
  };
  ball(0, -14, 14);
  if (stage >= 2) ball(0, -34, 11);
  if (stage >= 3) {
    ball(0, -50, 8.5);
    g.strokeStyle = "rgb(84 70 60)";
    g.lineWidth = 2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-10, -36);
    g.lineTo(-21, -46);
    g.moveTo(10, -36);
    g.lineTo(21, -46);
    g.stroke();
    g.fillStyle = "#3b3f46";
    for (const [x, y, r] of [[-3, -52, 1.3], [3, -52, 1.3], [0, -33, 1.2], [0, -27, 1.2]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }
}

/** 평면 음영 한 덩이 — path를 채우고 같은 색조의 더 어두운 윤곽을 두른다(픽셀 아트 규칙: 검정 윤곽 금지).
 *  윤곽은 얇고 옅게: 진한 1.4px 선은 화면에서 "벡터 스티커"로 읽혔다(2026-09-04 검토 2차). */
function flatBody(g: CanvasRenderingContext2D, fill: string, line: string, path: () => void, baseY?: number) {
  path();
  g.fillStyle = fill;
  g.fill();
  // 윤곽 — 얇고 옅게. `baseY`를 주면 **밑변 위쪽만** 그린다: 닫힌 path를 그대로 stroke하면 밑변이
  // 상자 폭만큼의 가로선으로 남아 "판자에 올린 것"으로 읽혔다(2026-09-04 검토 5차).
  g.save();
  if (baseY !== undefined) {
    g.beginPath();
    g.rect(-9999, -9999, 99999, baseY - 1 + 9999);
    g.clip();
    path();
  }
  g.globalAlpha *= 0.55;
  g.strokeStyle = line;
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

/** 디더 점 — 픽셀 아트의 계조. 상자 안에 같은 색조의 어두운 점을 성기게 찍어 평면을 깬다. */
function dither(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, n: number, seed: number, clip?: () => void) {
  // clip을 주면 그 안에만 찍는다 — 안 주면 상자 전체에 뿌려져 실루엣 밖 땅에 **어두운 직사각**이 남는다
  // (검토 라운드2 현실성 #8). 새 소품은 반드시 몸통 path를 넘긴다.
  g.save();
  if (clip) {
    clip();
    g.clip();
  }
  const r = rng(seed);
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.16 + r() * 0.2;
    g.fillRect(Math.round(x + r() * w), Math.round(y + r() * h), 1.4, 1.4);
  }
  g.restore();
  g.restore();
}

function rockShape(g: CanvasRenderingContext2D, W: number, H: number, variant: number, cols: string[]) {
  // 실루엣은 변형마다 다르게 — 같은 삼각 도장이 화면에 반복되면 "주먹밥 스티커"가 된다(2026-09-04 검토 2차).
  const rr = rng(913 + variant * 137);
  const x = W / 2;
  const b = H - 1;
  const rw = W * (0.36 + rr() * 0.16);
  const rh = H * (0.6 + rr() * 0.34);
  // (발밑 그림자는 여기서 굽지 않는다 — 슬롯 해상도(40×30)에서 구운 부드러운 그림자를 보간 없이 2배로
  //  키우면 계단진 사각형이 된다. 그림자는 호출부/scatterProps가 화면 해상도로 그린다, 검토 라운드2 #8.)
  // 밑변에서 시작해 시계방향으로 5~7개의 각진 꼭짓점.
  const n = 5 + Math.floor(rr() * 3);
  const pts: [number, number][] = [[x - rw, b]];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const px = x - rw + 2 * rw * t + (rr() - 0.5) * rw * 0.24;
    const py = b - rh * (0.34 + Math.sin(t * Math.PI) * (0.5 + rr() * 0.5));
    pts.push([px, py]);
  }
  pts.push([x + rw, b]);
  flatBody(g, cols[1], cols[2], () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }, b);
  // 밝은 면(왼쪽 위) — 두 톤이면 충분.
  g.fillStyle = cols[0];
  g.beginPath();
  g.moveTo(pts[0][0] + rw * 0.2, b - rh * 0.3);
  for (let i = 1; i < Math.max(2, pts.length - 2); i++) g.lineTo(pts[i][0], pts[i][1] + 1);
  g.lineTo(x - rw * 0.05, b - rh * 0.34);
  g.closePath();
  g.fill();
  // 이끼 — 채도 낮은 초록 몇 점.
  g.fillStyle = "rgb(126 156 110 / 0.4)";
  g.beginPath();
  g.ellipse(x + rw * 0.35, b - rh * 0.16, rw * 0.26, rh * 0.1, 0, 0, TAU);
  g.fill();
  dither(g, x - rw, b - rh, rw * 2, rh, cols[2], 26, 41 + variant * 7, () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  });
}

function shrub(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, light: string, mid: string, line: string, dot?: string) {
  // 공 세 개를 붙이면 "개똥 세 덩이"로 읽힌다(소유자 2026-09-04, 검토 3차 재확인) → 울퉁불퉁한 덤불 실루엣 하나 +
  // 잎 자국 몇 개 + 짧은 밑동. 픽셀 격자에서 구워지므로 곡선은 거칠어도 된다.
  const b = H - 1;
  const cx = W / 2;
  const rw = W * 0.47;
  const rh = H * 0.8; // 0.72는 납작한 덩어리, 0.98은 세로 말뚝 — 그 사이(2026-09-04 소유자)
  const n = 13;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI; // 왼쪽 밑동 → 위 → 오른쪽 밑동
    const bump = 0.82 + 0.3 * Math.sin(i * 2.1 + 0.6) + (r() - 0.5) * 0.16;
    pts.push([cx + Math.cos(a) * rw * bump, b + Math.sin(a) * rh * bump]);
  }
  flatBody(g, mid, line, () => {
    g.beginPath();
    g.moveTo(cx - rw, b);
    for (const [px, py] of pts) g.lineTo(px, py);
    g.lineTo(cx + rw, b);
    g.closePath();
  }, b);
  // 밝은 면 — 왼쪽 위. 매끈한 타원 한 장은 "판자에 붙인 동전"으로 읽혔다(검토 4차) → 세 덩이로 흩는다.
  g.fillStyle = light;
  for (const [ox, oy, sx2, sy2] of [[-0.3, -0.62, 0.34, 0.24], [-0.06, -0.72, 0.22, 0.16], [-0.42, -0.44, 0.2, 0.14]] as const) {
    g.beginPath();
    g.ellipse(cx + rw * ox, b + rh * oy, rw * sx2, rh * sy2, -0.5, 0, TAU);
    g.fill();
  }
  // 잎 자국 — 어두운 톱니 몇 개(덩어리가 잎 뭉치로 읽히게).
  g.strokeStyle = line;
  g.lineWidth = 1;
  g.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    const px = cx + (r() - 0.5) * rw * 1.5;
    const py = b - rh * (0.2 + r() * 0.6);
    g.beginPath();
    g.moveTo(px - 2.5, py);
    g.lineTo(px, py - 2.5);
    g.lineTo(px + 2.5, py);
    g.stroke();
  }
  g.globalAlpha = 1;
  // 밑동.
  g.strokeStyle = line;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx, b);
  g.lineTo(cx - 1, b - rh * 0.22);
  g.stroke();
  dither(g, cx - rw, b - rh, rw * 2, rh, line, 30, 55, () => {
    g.beginPath();
    g.moveTo(cx - rw, b);
    for (const [px, py] of pts) g.lineTo(px, py);
    g.lineTo(cx + rw, b);
    g.closePath();
  });
  if (dot) {
    g.fillStyle = dot;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(cx + (r() - 0.5) * rw * 1.4, b - rh * (0.25 + r() * 0.6), 1.4, 0, TAU);
      g.fill();
    }
  }
}

/** 대체물(코드 도형)을 자리 크기로 한 번 굽는다. 없는 자리는 null. */
export function fallbackSprite(id: string, variant = 0): HTMLCanvasElement | null {
  const key = `${id}:${variant}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const slot = artSlot(id);
  const paint = PAINT[id];
  if (!slot || !paint) {
    cache.set(key, null);
    return null;
  }
  const [W, H] = slot.px;
  // **논리 해상도 상한 DOT_MAX** — 자리 상자가 크면(소나무 92×168) 그 해상도로 그린 도형은 매끈한 벡터가 되어
  // 옆의 픽셀 아트 참나무와 화풍이 갈린다(검토 라운드2 미관 #2: "침엽수 = 매끈한 벡터, 활엽수 = 청키 픽셀").
  // 긴 변을 64~72px로 눌러 그린 뒤 **보간 없이** 확대해야 굵은 점이 된다(CLAUDE.md: 64~96px 논리 해상도).
  const DOT_MAX = 72;
  const f = Math.min(1, DOT_MAX / Math.max(W, H));
  const lw = Math.max(8, Math.round(W * f));
  const lh = Math.max(8, Math.round(H * f));
  const { c: small, g: sg } = makeCanvas(lw, lh);
  sg.scale(lw / W, lh / H);
  paint(sg, W, H, rng(1000 + id.length * 31 + variant * 97), variant);
  const { c, g } = makeCanvas(W * SCALE, H * SCALE);
  g.imageSmoothingEnabled = false;
  g.drawImage(small, 0, 0, W * SCALE, H * SCALE);
  cache.set(key, c);
  return c;
}

/** 아트가 있으면 아트, 없으면 대체물이 있는 자리에 큰 소품(관목·바위·그루터기·통나무·눈 무더기 …)을 바탕에
 *  결정적으로 흩뿌린다. band = "edge"(기본: 위 띠 · 아래 띠 · 좌우 — 달력 밖) 또는 "any". 같은 rng 순서를 쓰므로
 *  아트가 없어도 rng 소비가 같다(다른 소품 자리 불변). 땅의 것은 지평선 아래에만(minV로 더 내릴 수 있다). */
export function scatterProps(
  g: CanvasRenderingContext2D,
  art: ArtSet | null,
  w: number,
  h: number,
  r: () => number,
  list: { id: string; n: number; band?: "edge" | "any"; k?: number; minV?: number }[]
) {
  for (const it of list) {
    for (let i = 0; i < it.n; i++) {
      let x: number;
      let y: number;
      // 땅의 것은 지평선 아래에만 — 옛 범위는 y=10부터라 소품이 먼 언덕/하늘에 박혔다(2026-09-04 검토 1차).
      const gy = h * HORIZON_V + 12 + (it.minV ?? 0) * (h - h * HORIZON_V);
      if (it.band === "any") {
        x = 20 + r() * (w - 40);
        y = gy + r() * (h - gy - 30);
      } else {
        const t = r();
        if (t < 0.5) {
          // 위쪽 띠 — 지평선 바로 밑은 안개에 반쯤 잠겨 "잘린 덤불"로 보인다. 한 칸 내려서 놓는다(검토 4차).
          x = 30 + r() * (w - 60);
          y = gy + h * 0.03 + r() * h * 0.08;
        } else if (t < 0.8) {
          x = 30 + r() * (w - 60);
          y = h * 0.9 + r() * h * 0.08;
        } else if (t < 0.9) {
          x = 10 + r() * w * 0.06;
          y = gy + r() * (h * 0.85 - gy);
        } else {
          x = w * 0.93 + r() * w * 0.05;
          y = gy + r() * (h * 0.85 - gy);
        }
      }
      // 무작위 폭(0.85~1.2)은 depthScale(0.6~1.0)보다 좁아야 거리 단서가 이긴다(검토 2차).
      const k = (it.k ?? 1) * (0.85 + r() * 0.35) * depthScale(y, h);
      const v = r();
      const flip = r() < 0.5;
      // 아트가 있으면 아트, 없으면 대체물이 있는 자리만(대체물조차 없으면 건너뛴다 — rng 소비는 위에서 이미 같다).
      if (!(art && art.has(it.id)) && !fallbackSprite(it.id, 0)) continue;
      const slot = artSlot(it.id);
      // 겹침 방지 — 찬 자리면 이 개체는 거른다(같은 rng 소비를 유지하려고 재추첨은 하지 않는다).
      if (!claimSpot(x, y, ((slot?.px[0] ?? 32) * k) / 2)) continue;
      if (slot?.view === "stand") softBlob(g, x + 2, y - 2, slot.px[0] * 0.45 * k, shadowRGB, 0.16, 0, GROUND_SQUASH * 0.5);
      drawProp(g, art, it.id, x, y, { k, r: v, flip });
    }
  }
}

/** 소품 하나를 그린다. 아트가 있으면 아트, 없으면 대체물. r(0~1)로 변형을 고른다. 그린 게 있으면 true. */
export function drawProp(
  g: CanvasRenderingContext2D,
  art: ArtSet | null,
  id: string,
  x: number,
  y: number,
  opts: { k?: number; rot?: number; r?: number; alpha?: number; flip?: boolean; sy?: number } = {}
): boolean {
  const k = opts.k ?? 1;
  const r = opts.r ?? 0;
  const sy = opts.sy ?? 1; // 3/4 시점 바닥 눌림(납작한 것) — 회전 전에 화면 세로로
  const a: ArtSprite | null = art ? art.pick(id, r) : null;
  if (opts.alpha !== undefined) {
    g.save();
    g.globalAlpha *= opts.alpha;
  }
  let drew = false;
  if (a) {
    drawArt(g, a, x, y, k, opts.rot ?? 0, opts.flip, sy);
    drew = true;
  } else {
    const slot = artSlot(id);
    const variants = slot?.variants && slot.variants > 1 ? slot.variants : 1;
    const c = fallbackSprite(id, Math.min(variants - 1, Math.floor(Math.max(0, Math.min(0.999, r)) * variants)));
    if (c && slot) {
      const [W, H] = slot.px;
      g.save();
      // 축소해 그릴 때도 **보간을 끈다** — 켜져 있으면 굵은 점이 평균화돼 매끈한 벡터가 되고, 같은 소품이
      // 가까울 땐 픽셀·멀 땐 벡터로 보인다(검토 라운드2 사이클3 미관 #4).
      g.imageSmoothingEnabled = false;
      g.translate(x, y);
      if (sy !== 1) g.scale(1, sy);
      if (opts.rot) g.rotate(opts.rot);
      g.scale(opts.flip ? -k : k, k);
      g.drawImage(c, -W / 2, slot.view === "stand" ? -H : -H / 2, W, H);
      g.restore();
      drew = true;
    }
  }
  if (opts.alpha !== undefined) g.restore();
  return drew;
}

/**
 * 물에 잠긴 소품(2026-09-05, QA 라운드 1 S-4 — BIOME_GRAMMAR 공통 물가 규칙). 수면선(yWater) 아래로 `depth`px 잠긴 채 그린다:
 *   · 수면 위 = 원본 그대로
 *   · 수면 아래 = 물색으로 물든 사본(source-atop), 깊을수록 투명(destination-out 그라데이션) — "물 속에 있다"
 *   · 수면선 바로 위 3px = 어두운 젖은 띠 — "물이 닿았다"
 * 옛 방식(수면 위만 clip)은 밑변이 직선으로 잘려 "접시 위 돌"이 됐다. 회전·눌림 없는 stand 소품 전용(바위·통나무·그루터기).
 * 소품은 오프스크린에 한 번 그려 물들인 뒤 한 번에 찍는다 — 바탕(물)에는 손대지 않는다. 앞 반원 수면선·잔물결은 호출 쪽이 그린다.
 */
export function drawSubmerged(
  g: CanvasRenderingContext2D,
  art: ArtSet | null,
  id: string,
  x: number,
  yWater: number,
  opts: { k?: number; r?: number; flip?: boolean; depth: number; water: string; wet?: number; alphaDeep?: number }
): boolean {
  const slot = artSlot(id);
  if (!slot) return false;
  const k = opts.k ?? 1;
  const [W, H] = slot.px;
  const cw = Math.ceil(W * k * 1.3) + 4;
  const ch = Math.ceil(H * k * 1.3) + 4;
  const { c, g: t } = makeCanvas(cw, ch);
  const ax = cw / 2;
  const ay = ch - 2; // 바닥 접점(stand)
  const depth = Math.max(1, opts.depth);
  const drew = drawProp(t, art, id, ax, ay, { k, r: opts.r, flip: opts.flip });
  if (!drew) return false;
  const yw = ay - depth; // 오프스크린 안의 수면선
  // 물속 부분 — 물색으로 물들이고(소품 픽셀에만) 깊을수록 옅어진다.
  t.save();
  t.beginPath();
  t.rect(0, yw, cw, ch - yw);
  t.clip();
  t.globalCompositeOperation = "source-atop";
  t.fillStyle = `rgb(${opts.water} / 0.62)`;
  t.fillRect(0, yw, cw, ch - yw);
  t.globalCompositeOperation = "destination-out";
  const fade = t.createLinearGradient(0, yw, 0, ay);
  fade.addColorStop(0, "rgb(0 0 0 / 0.1)");
  fade.addColorStop(1, `rgb(0 0 0 / ${1 - (opts.alphaDeep ?? 0.42)})`);
  t.fillStyle = fade;
  t.fillRect(0, yw, cw, ch - yw);
  t.restore();
  // 젖은 띠 — 수면선 바로 위 3px, 소품 픽셀에만.
  const wet = opts.wet ?? 0.26;
  if (wet > 0) {
    t.save();
    t.globalCompositeOperation = "source-atop";
    t.fillStyle = `rgb(24 34 44 / ${wet})`;
    t.fillRect(0, yw - 3, cw, 3);
    t.restore();
  }
  g.drawImage(c, x - ax, yWater - yw);
  return true;
}
