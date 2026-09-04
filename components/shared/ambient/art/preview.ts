// 아트 보드의 '지금' 미리보기(2026-09-04) — 자리마다 화면이 지금 쓰는 대체물을 보여준다: 코드 도형은 props/traces의 대체 스프라이트를
// 그대로, 이모지·실루엣·SVG는 그 파일 경로. 보드(클라이언트)만 쓴다.

import { ASSET } from "@/components/shared/ambient/assets";
import { fallbackSprite } from "./props";
import { bareTreeSprite, canopyTreeSprite } from "@/components/shared/ambient/world/traces-draw";

export type ArtPreview = { kind: "canvas"; c: HTMLCanvasElement } | { kind: "url"; src: string } | null;

const URL_OF: Record<string, string> = {
  sprout: ASSET.sprout,
  "sapling-green": ASSET.herb,
  "sapling-autumn": ASSET.herb,
  "sapling-bare": ASSET.herb,
  acorn: ASSET.acorn,
  "swim-ring": ASSET.ring,
  "fish-slim": ASSET.fishShadowSlim,
  "fish-fantail": ASSET.fishShadowFantail,
  duck: ASSET.duck,
  rabbit: ASSET.rabbit,
  chipmunk: ASSET.chipmunk,
  butterfly: ASSET.butterfly,
  ladybug: ASSET.ladybug,
  bee: ASSET.bee
};

export function previewOf(id: string): ArtPreview {
  if (URL_OF[id]) return { kind: "url", src: URL_OF[id] };
  const m = /^tree-oak-(spring|summer|autumn|winter)$/.exec(id);
  if (m) {
    const season = m[1] as "spring" | "summer" | "autumn" | "winter";
    return { kind: "canvas", c: season === "winter" ? bareTreeSprite(44) : canopyTreeSprite(season, 44) };
  }
  const c = fallbackSprite(id, 0);
  return c ? { kind: "canvas", c } : null;
}
