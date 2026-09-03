// 앰비언트 에셋 로더(2026-09-04) — `public/ambient/*.svg`가 소품(오리·튜브·도토리·무당벌레)의 원본이다. 코드로 그리지 않고
// **그림 파일**을 쓴다: 더 좋은 에셋이 생기면 파일만 바꾸면 된다(같은 viewBox 비율·위쪽이 앞). 한 번 불러 원하는 CSS px
// 크기 × 배율로 오프스크린 캔버스에 굽고, 매 프레임은 drawImage 한 번 — SVG를 프레임마다 그리면 매번 래스터라이즈한다.
// 실패(404·차단)해도 장면은 소품만 빠진 채 돈다(null 유지).

import { makeCanvas } from "./scenes/util";

export const ASSET = {
  duck: "/ambient/duck.svg",
  ring: "/ambient/swim-ring.svg",
  acorn: "/ambient/acorn.svg",
  ladybug: "/ambient/ladybug.svg"
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

/** 에셋을 (w×h CSS px) × scale 해상도의 스프라이트로 굽는다. scale은 DPR(최대 2) — 회전·확대해도 또렷하다. */
export async function loadSprite(url: string, w: number, h: number, scale = 2): Promise<Sprite> {
  const im = await loadImage(url);
  const { c, g } = makeCanvas(w * scale, h * scale);
  g.drawImage(im, 0, 0, c.width, c.height);
  return { c, w, h };
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
