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
  const palByKey = new Map(palette.map((p) => [p.key, p] as const));

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
    // 이벤트 단위 분배는 기존 함수에 위임(정의상 동일 결과 → 0A 픽셀 불변 보장).
    eventFills: (event) => getEventTagColors(event, tags, palette),
    eventExtras: (event) => getExtraCategoryColors(event, tags, palette)
  };
}
