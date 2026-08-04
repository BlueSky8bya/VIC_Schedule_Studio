"use client";

import { useMemo, type CSSProperties } from "react";
import type { BroadcastTag, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { hapticTick } from "@/lib/ui/haptics";

// 2계층 이벤트 태그 피커(편집실/모바일 공용). 대분류별로 묶고, 세부는 그 아래 칩으로. 검색으로
// 많은 태그도 빠르게 찾는다. 세부 칩은 부모 대분류 색을 따라 보여 그룹이 한눈에 보인다.
// 색은 카드에서 '대분류'로 합쳐지므로(중복 색 OK) 피커도 대분류 색으로 칠한다.
export function TagPicker({
  tags,
  palette,
  selectedIds,
  onToggle,
  max,
  disabled = false
}: {
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  max: number;
  disabled?: boolean;
}) {
  // 0A: 색은 단일 resolver로. 대분류(세부면 부모) 색을 따라간다(기존 categoryColorKey와 동일).
  const tagVisual = useMemo(() => createTagVisualResolver(tags, palette), [tags, palette]);

  // flat 태그를 콘텐츠(content)와 방식(modifier)으로 나눈다. 방식(합방·시참 등)은 "어떻게/누구"라
  // 콘텐츠와 칸을 나눠 고른다. (세부 계층은 폐기 — 게임 이름 등 인스턴스는 제목으로.)
  const { contentTags, modifierTags } = useMemo(() => {
    const tops = [...tags]
      .filter((t) => (t.parentId ?? null) === null)
      .sort((a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타"));
    return {
      contentTags: tops.filter((t) => t.kind !== "modifier"),
      modifierTags: tops.filter((t) => t.kind === "modifier")
    };
  }, [tags]);

  const full = selectedIds.length >= max;
  const orderOf = (id: string) => selectedIds.indexOf(id);

  const chip = (tag: BroadcastTag, isSub: boolean) => {
    const v = tagVisual.visualOf(tag.id);
    if (v.missing || !v.bg) return null;
    const selected = selectedIds.includes(tag.id);
    const blocked = !selected && full;
    return (
      <button
        className={`tp-chip${isSub ? " sub" : ""}${selected ? " selected" : ""}`}
        data-color={v.colorKey ?? undefined}
        disabled={disabled || blocked}
        key={tag.id}
        onClick={() => {
          hapticTick();
          onToggle(tag.id);
        }}
        style={
          {
            // 색은 CSS 변수로 전달 — 기본 렌더는 이전과 동일하고, 편집 팝오버처럼
            // 스코프별로 '색 점 + 선택 시 채움' 등으로 재해석할 수 있게 한다.
            "--tp-bg": v.bg,
            "--tp-border": v.border ?? undefined,
            "--tp-ink": v.legacyTextColor ?? undefined
          } as CSSProperties
        }
        title={blocked ? `태그는 최대 ${max}개까지 고를 수 있어요` : tag.displayName}
        type="button"
       data-act="tp-chip">
        {selected ? <b className="tp-order">{orderOf(tag.id) + 1}</b> : null}
        {tag.displayName}
      </button>
    );
  };

  return (
    <div className="tag-picker2">
      <div className="tp-head">
        <span className="tp-section-label">콘텐츠</span>
        <span className="tp-count">
          {selectedIds.length}/{max}
        </span>
      </div>
      <div className="tp-content">{contentTags.map((t) => chip(t, false))}</div>
      {modifierTags.length > 0 ? (
        <div className="tp-mod-section">
          <div className="tp-section-label">형식</div>
          <div className="tp-mods">{modifierTags.map((t) => chip(t, false))}</div>
        </div>
      ) : null}
    </div>
  );
}
