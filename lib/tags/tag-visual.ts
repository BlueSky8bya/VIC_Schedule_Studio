// 태그 '시각'(색·무늬·잉크 원천)을 한 곳에서 푸는 resolver. 지금은 색 계산이 여러 표면(포스터
// 카드·범례·모바일 바·필터·칩·insights 4곳·export)에 흩어져 각자 palette를 find한다 → 단일 진입점으로
// 모은다(0A). 커스텀 색(bg_hex)을 나중에 얹을 입구도 이 하나로 만든다.
//
// 계약(코덱스 리뷰 반영): visualOf는 rootTagId/kind/colorKey/bg/border/legacyTextColor/patternKey/
// missing을 담아 '레거시 렌더를 정확히 재현'한다(0A는 픽셀 동일이 목표). 이벤트 단위 칸색/점줄 분배는
// 기존 month.ts 함수에 위임해 결과가 정의상 동일하다(드리프트 방지). 팩토리에서 부모→최상위 대분류
// 매핑을 1회 Map으로 만들어 insights 반복문의 태그당 O(tags) find를 없앤다.

import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent,
  StudioScheduleEvent,
  TagKind
} from "@/lib/domain/schedule-types";
import { patternOf } from "@/lib/tags/color-gen";
import { getEventTagColors, getExtraCategoryColors } from "@/lib/calendar/month";

export type TagVisual = {
  // 최상위 대분류 id(세부면 부모, 대분류면 자기). insights 롤업·dedup 기준.
  rootTagId: string;
  kind: TagKind; // 최상위 대분류의 kind(content=칸 색, modifier=점)
  colorKey: string | null; // 최상위 대분류 색 key(레거시 팔레트 참조 + 무늬 CSS data-color)
  bg: string | null;
  border: string | null;
  legacyTextColor: string | null; // 팔레트가 정의한 기본 글자색(eventInkStyle의 1순위 후보)
  patternKey: string; // 무늬 종류(plain/diag/dots/grid/cross/dash) — colorKey에서 파생
  missing: boolean; // colorKey가 팔레트에 없음(고아). 현재 렌더는 이 태그 색을 탈락시킨다.
};

type RootInfo = { rootTagId: string; colorKey: string; kind: TagKind };

// #RRGGBB → [r,g,b]. 실패 시 null.
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
// 커스텀 배경에서 테두리색 파생 — 살짝 어둡게(각 채널 ×0.72).
function deriveBorder(rgb: [number, number, number]): string {
  return toHex([rgb[0] * 0.72, rgb[1] * 0.72, rgb[2] * 0.72]);
}
// 커스텀 배경 위 기본 글자색 — 상대휘도로 흑/백 중 대비 높은 쪽(eventInkStyle이 최종 AA 보정).
function relLuma([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function deriveInk(rgb: [number, number, number]): string {
  return relLuma(rgb) > 0.4 ? "#0a0a0a" : "#ffffff";
}

// 실효 팔레트: 대분류가 bg_hex를 직접 고르면 그 colorKey의 팔레트 엔트리를 커스텀 색으로 덮어쓴다
// (colorKey는 top-level 태그당 유일 — usedByOther가 보장). 이러면 색 lookup(getEventTagColors·
// visualOf)이 전부 이 실효 팔레트를 통해 bg_hex를 자동 반영한다. bg_hex 없으면 원 팔레트 그대로 →
// 렌더 불변. 텍스트/보더는 bg에서 파생(글자색은 eventInkStyle이 최종 AA 보정).
function buildEffectivePalette(
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): ColorPaletteEntry[] {
  const overrides = new Map<string, ColorPaletteEntry>();
  for (const t of tags) {
    if ((t.parentId ?? null) !== null) continue; // 자식은 색을 못 가짐(상속)
    const hex = t.bgHex;
    if (!hex) continue;
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const base = palette.find((p) => p.key === t.colorKey);
    overrides.set(t.colorKey, {
      key: t.colorKey,
      name: base?.name ?? t.displayName,
      bgColor: hex,
      textColor: deriveInk(rgb),
      borderColor: deriveBorder(rgb),
      sortOrder: base?.sortOrder ?? t.sortOrder
    });
  }
  if (overrides.size === 0) return palette;
  const merged = palette.map((p) => overrides.get(p.key) ?? p);
  // 팔레트에 없던 colorKey(커스텀 색이 새 key를 쓸 때)도 추가.
  for (const [key, entry] of overrides) {
    if (!merged.some((p) => p.key === key)) merged.push(entry);
  }
  return merged;
}

// 태그 → 최상위 대분류(부모 체인 끝). categoryColorKey/categoryKind(month.ts)와 동일 규칙이되,
// 팩토리에서 1회만 계산해 캐시한다.
function computeRoot(tag: BroadcastTag, byId: Map<string, BroadcastTag>): RootInfo {
  let cur: BroadcastTag = tag;
  const guard = new Set<string>();
  while (cur.parentId && !guard.has(cur.id)) {
    guard.add(cur.id);
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    cur = parent;
  }
  return { rootTagId: cur.id, colorKey: cur.colorKey, kind: cur.kind };
}

export type TagVisualResolver = {
  visualOf: (tagId: string) => TagVisual;
  // 이벤트 칸에 칠할 색(콘텐츠 대분류 ≤2, dedup) — 기존 getEventTagColors와 동일.
  eventFills: (event: PublicScheduleEvent | StudioScheduleEvent) => ColorPaletteEntry[];
  // 칸에 못 담은 색(넘친 콘텐츠 + 모든 수식어) — 점 줄. 기존 getExtraCategoryColors와 동일.
  eventExtras: (event: PublicScheduleEvent | StudioScheduleEvent) => ColorPaletteEntry[];
};

export function createTagVisualResolver(
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): TagVisualResolver {
  const byId = new Map(tags.map((t) => [t.id, t] as const));
  const rootCache = new Map<string, RootInfo>();
  // bg_hex를 반영한 실효 팔레트로 모든 색을 푼다(없으면 원 팔레트 그대로 → 렌더 불변).
  const effPalette = buildEffectivePalette(tags, palette);
  const palByKey = new Map(effPalette.map((p) => [p.key, p] as const));

  const rootOf = (tagId: string): RootInfo | null => {
    const cached = rootCache.get(tagId);
    if (cached) return cached;
    const tag = byId.get(tagId);
    if (!tag) return null;
    const info = computeRoot(tag, byId);
    rootCache.set(tagId, info);
    return info;
  };

  const visualOf = (tagId: string): TagVisual => {
    const root = rootOf(tagId);
    if (!root) {
      // 태그 자체가 목록에 없음 — 색 없음(고아 취급).
      return {
        rootTagId: tagId,
        kind: "content",
        colorKey: null,
        bg: null,
        border: null,
        legacyTextColor: null,
        patternKey: "plain",
        missing: true
      };
    }
    const entry = palByKey.get(root.colorKey);
    return {
      rootTagId: root.rootTagId,
      kind: root.kind,
      colorKey: root.colorKey,
      bg: entry?.bgColor ?? null,
      border: entry?.borderColor ?? null,
      legacyTextColor: entry?.textColor ?? null,
      patternKey: patternOf(root.colorKey),
      missing: !entry
    };
  };

  return {
    visualOf,
    // 이벤트 단위 분배는 기존 함수에 위임(dedup·순서 동일). 단 실효 팔레트를 넘겨 bg_hex를 반영한다
    // (bg_hex 없으면 원 팔레트라 결과 동일 = 렌더 불변).
    eventFills: (event) => getEventTagColors(event, tags, effPalette),
    eventExtras: (event) => getExtraCategoryColors(event, tags, effPalette)
  };
}
