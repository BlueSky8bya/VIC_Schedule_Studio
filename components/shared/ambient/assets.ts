// 앰비언트 에셋 로더(2026-09-04) — `public/ambient/*.svg`가 소품(오리·튜브·도토리·무당벌레)의 원본이다. 코드로 그리지 않고
// **그림 파일**을 쓴다: 더 좋은 에셋이 생기면 파일만 바꾸면 된다(같은 viewBox 비율·위쪽이 앞). 한 번 불러 원하는 CSS px
// 크기 × 배율로 오프스크린 캔버스에 굽고, 매 프레임은 drawImage 한 번 — SVG를 프레임마다 그리면 매번 래스터라이즈한다.
// 실패(404·차단)해도 장면은 소품만 빠진 채 돈다(null 유지).

import { makeCanvas } from "./scenes/util";

// 동물·물고기는 직접 그리지 않는다(2026-09-04 사용자: 손그림 금지) — Google Noto Emoji 아트워크(Apache-2.0, public/ambient/
// noto/NOTICE.txt)를 그대로 쓴다. 옆모습(왼쪽을 본다)은 drawFacing으로 진행 방향에 맞춰 뒤집고 기울인다; 무당벌레·나비처럼
// 위에서 본 것은 drawSprite(앞 = 위). 튜브·도토리만 우리 SVG.
export const ASSET = {
  ring: "/ambient/swim-ring.svg",
  acorn: "/ambient/acorn.svg",
  rabbit: "/ambient/noto/emoji_u1f407.svg",
  chipmunk: "/ambient/noto/emoji_u1f43f.svg",
  // 물고기는 **위에서 본** 실루엣(퍼블릭 도메인 top-view 도안에서 구운 PNG, public/ambient/NOTICE.txt) — 물 밑 그림자로만 그린다
  // (2026-09-04 사용자: "위에서 내려다보는데 옆모습 물고기가 누워 다니니 어색" → 동물의 숲식 그림자). 머리 = 왼쪽.
  fishShadowSlim: "/ambient/fish-shadow-slim.png",
  fishShadowFantail: "/ambient/fish-shadow-fantail.png",
  duck: "/ambient/noto/emoji_u1f986.svg",
  ladybug: "/ambient/noto/emoji_u1f41e.svg",
  // 여름 초원의 곤충(2026-09-04 소유자: "봄·여름이 너무 같다 — 풀 구성도 곤충 종류도 갈라라").
  beetle: "/ambient/noto/emoji_u1fab2.svg", // 딱정벌레(위에서 본 모습, 무당벌레와 같은 기계)
  hopper: "/ambient/noto/emoji_u1f997.svg", // 메뚜기(옆모습 — drawFacing)
  bee: "/ambient/noto/emoji_u1f41d.svg",
  butterfly: "/ambient/noto/emoji_u1f98b.svg",
  // 연대기(Phase A) — 도토리에서 난 싹·묘목(식물, Noto).
  sprout: "/ambient/noto/emoji_u1f331.svg",
  herb: "/ambient/noto/emoji_u1f33f.svg"
} as const;

export type Sprite = { c: HTMLCanvasElement; w: number; h: number }; // w/h = 그릴 때의 CSS px 크기

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`ambient asset failed: ${url}`));
      im.src = url;
    });
    images.set(url, p);
  }
  return p;
}

/** 에셋을 (w×h CSS px) × scale 해상도의 스프라이트로 굽는다. scale은 DPR(최대 2) — 회전·확대해도 또렷하다.
 *  tint를 주면 불투명 부분을 그 색으로 물들인다(실루엣 → 물빛 그림자). */
export async function loadSprite(url: string, w: number, h: number, scale = 2, tint?: string): Promise<Sprite> {
  const im = await loadImage(url);
  const { c, g } = makeCanvas(w * scale, h * scale);
  g.drawImage(im, 0, 0, c.width, c.height);
  if (tint) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
  }
  return { c, w, h };
}

/** 옆모습(왼쪽을 보는) 스프라이트를 진행 방향 hd(라디안, 화면 좌표)에 맞춰 그린다 — 오른쪽으로 가면 좌우로 뒤집고, 위아래
 *  성분만큼 코를 기울인다(180° 회전이면 배가 위로 뒤집힌다). extra = 귀 쫑긋·꼬리질 같은 작은 추가 회전. */
export function drawFacing(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, hd: number, k = 1, extra = 0) {
  const cx = Math.cos(hd);
  const sy = Math.sin(hd);
  const flip = cx >= 0;
  const rot = flip ? Math.atan2(sy, cx) : Math.atan2(-sy, -cx);
  g.save();
  g.translate(x, y);
  g.rotate(rot + extra);
  g.scale(flip ? -k : k, k);
  g.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
  g.restore();
}

/** 스프라이트를 (x,y) 중심·회전 a·배율 k로 그린다(alpha는 호출 쪽 globalAlpha). */
export function drawSprite(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, a: number, k = 1, flipX = false) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.scale(flipX ? -k : k, k);
  g.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
  g.restore();
}
