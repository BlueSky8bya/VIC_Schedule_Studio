// 아트 로더(2026-09-04) — `public/ambient/art/<id>.png`가 있으면 장면이 그 그림을 쓴다. 매니페스트(`manifest.ts`)의 자리 상자(px)에
// **알파 경계로 잘라 맞추고**(코덱스 생성물은 1024 정사각 + 여백) 앵커를 붙인다: stand = 발밑 가운데(바닥 접점), flat/shadow = 가운데.
// 404·차단이면 null을 기억하고 다시 묻지 않는다(세션 동안). 한 번 굽고 매 프레임 drawImage 한 번 — assets.ts와 같은 규칙.
// 장면은 `ArtSet`으로 필요한 자리만 묶어 받고, 모두 도착하면 `version`이 1 오른다(바탕을 한 번만 다시 굽기 위해).

import { ART_DIR, artSlot, slotFiles, type ArtSlot } from "./manifest";
import { makeCanvas } from "@/components/shared/ambient/scenes/util";

export type ArtSprite = { c: HTMLCanvasElement; w: number; h: number; ax: number; ay: number; id: string };

const resolved = new Map<string, ArtSprite | null>(); // key = `${file}@${scale}` (tint 사본은 별도 키)
const pending = new Map<string, Promise<ArtSprite | null>>();

function fetchImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/** 알파 경계(α > 8)를 찾는다 — 생성물의 투명 여백을 잘라 상자에 꽉 채우기 위해. 큰 그림은 512로 줄여 잰다(한 번). */
function alphaBox(im: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const S = 512;
  const k = Math.min(1, S / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.max(1, Math.round(im.naturalWidth * k));
  const h = Math.max(1, Math.round(im.naturalHeight * k));
  const { c, g } = makeCanvas(w, h);
  g.drawImage(im, 0, 0, w, h);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: im.naturalWidth, h: im.naturalHeight };
  return { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
}

function bake(im: HTMLImageElement, slot: ArtSlot, scale: number, tint?: string): ArtSprite {
  const box = alphaBox(im);
  const [bw, bh] = slot.px;
  const fit = Math.min(bw / box.w, bh / box.h);
  const w = Math.max(1, box.w * fit);
  const h = Math.max(1, box.h * fit);
  const { c, g } = makeCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  g.drawImage(im, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
  if (tint) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
  }
  return { c, w, h, ax: 0.5, ay: slot.view === "stand" ? 1 : 0.5, id: slot.id };
}

/** 파일 하나를 자리 규격으로 굽는다(없으면 null). scale = DPR 배율(트리처럼 확대되는 것은 3). */
export function artFile(file: string, slot: ArtSlot, scale = 2, tint?: string): Promise<ArtSprite | null> {
  const key = `${file}@${scale}${tint ? `@${tint}` : ""}`;
  if (resolved.has(key)) return Promise.resolve(resolved.get(key) ?? null);
  let p = pending.get(key);
  if (!p) {
    p = fetchImage(`${ART_DIR}/${file}`).then((im) => {
      const s = im ? bake(im, slot, scale, tint) : null;
      resolved.set(key, s);
      pending.delete(key);
      return s;
    });
    pending.set(key, p);
  }
  return p;
}

/** 장면이 쓰는 자리 묶음. get(id) = 첫 변형, pick(id, r) = r(0~1)로 고른 변형. 모두 도착하면 version 1 → 바탕을 한 번 다시 굽는다. */
export class ArtSet {
  version = 0;
  readonly ready: Promise<void>;
  private map = new Map<string, (ArtSprite | null)[]>();
  constructor(ids: readonly string[], opts: { scale?: number; scaleOf?: Record<string, number>; tint?: Record<string, string> } = {}) {
    const jobs: Promise<unknown>[] = [];
    for (const id of ids) {
      const slot = artSlot(id);
      if (!slot) continue;
      const files = slotFiles(slot);
      const arr: (ArtSprite | null)[] = files.map(() => null);
      this.map.set(id, arr);
      files.forEach((f, i) => {
        jobs.push(artFile(f, slot, opts.scaleOf?.[id] ?? opts.scale ?? 2, opts.tint?.[id]).then((s) => (arr[i] = s)));
      });
    }
    this.ready = Promise.all(jobs).then(() => {
      this.version++;
    });
  }
  has(id: string): boolean {
    return !!this.map.get(id)?.some(Boolean);
  }
  get(id: string): ArtSprite | null {
    return this.map.get(id)?.find(Boolean) ?? null;
  }
  pick(id: string, r: number): ArtSprite | null {
    const arr = this.map.get(id)?.filter(Boolean) as ArtSprite[] | undefined;
    if (!arr || !arr.length) return null;
    return arr[Math.min(arr.length - 1, Math.floor(Math.max(0, Math.min(0.999, r)) * arr.length))];
  }
}

/** 앵커 기준으로 그린다 — stand는 (x,y)가 바닥 접점, flat은 가운데. k = 배율(1 = 자리 크기), rot = 회전(라디안). */
export function drawArt(g: CanvasRenderingContext2D, s: ArtSprite, x: number, y: number, k = 1, rot = 0, flipX = false) {
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.scale(flipX ? -k : k, k);
  g.drawImage(s.c, -s.w * s.ax, -s.h * s.ay, s.w, s.h);
  g.restore();
}
