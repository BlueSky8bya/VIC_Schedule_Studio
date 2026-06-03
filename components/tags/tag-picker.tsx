"use client";

import { useMemo, useState } from "react";
import type { BroadcastTag, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import { categoryColorKey } from "@/lib/calendar/month";
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
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const colorOf = (tag: BroadcastTag) => {
    const ck = categoryColorKey(tag.id, tags) ?? tag.colorKey;
    return palette.find((p) => p.key === ck);
  };

  // 대분류(기타는 맨 끝) + 각 대분류의 세부. 콘텐츠(content)와 수식어(modifier)를 따로 묶는다 —
  // 수식어(합방·시참 등)는 "어떻게/누구"라 콘텐츠와 칸을 나눠 고른다. 수식어는 세부가 없다.
  const { contentGroups, modifierTags } = useMemo(() => {
    const tops = [...tags]
      .filter((t) => (t.parentId ?? null) === null)
      .sort((a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타"));
    const contentGroups = tops
      .filter((t) => t.kind !== "modifier")
      .map((top) => ({
        top,
        kids: tags
          .filter((t) => (t.parentId ?? null) === top.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      }));
    const modifierTags = tops.filter((t) => t.kind === "modifier");
    return { contentGroups, modifierTags };
  }, [tags]);

  const full = selectedIds.length >= max;
  const orderOf = (id: string) => selectedIds.indexOf(id);

  const chip = (tag: BroadcastTag, isSub: boolean) => {
    const color = colorOf(tag);
    if (!color) return null;
    const selected = selectedIds.includes(tag.id);
    const blocked = !selected && full;
    return (
      <button
        className={`tp-chip${isSub ? " sub" : ""}${selected ? " selected" : ""}`}
        data-color={color.key}
        disabled={disabled || blocked}
        key={tag.id}
        onClick={() => {
          hapticTick();
          onToggle(tag.id);
        }}
        style={{ backgroundColor: color.bgColor, borderColor: color.borderColor, color: color.textColor }}
        title={blocked ? `태그는 최대 ${max}개까지 고를 수 있어요` : tag.displayName}
        type="button"
      >
        {selected ? <b className="tp-order">{orderOf(tag.id) + 1}</b> : null}
        {tag.displayName}
      </button>
    );
  };

  return (
    <div className="tag-picker2">
      <div className="tp-head">
        <input
          className="tp-search"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="태그 검색…"
          type="text"
          value={query}
        />
        <span className="tp-count">
          {selectedIds.length}/{max}
        </span>
      </div>
      <div className="tp-groups">
        {contentGroups.map(({ top, kids }) => {
          // 검색: 대분류/세부 이름 매칭만. 매칭 없으면 그룹 숨김.
          const topHit = !q || top.displayName.toLowerCase().includes(q);
          const shownKids = q ? kids.filter((k) => k.displayName.toLowerCase().includes(q)) : kids;
          if (q && !topHit && shownKids.length === 0) return null;
          return (
            <div className="tp-group" key={top.id}>
              {chip(top, false)}
              {shownKids.length > 0 ? (
                <div className="tp-subs">{shownKids.map((k) => chip(k, true))}</div>
              ) : null}
            </div>
          );
        })}
      </div>
      {(() => {
        const shownMods = q
          ? modifierTags.filter((t) => t.displayName.toLowerCase().includes(q))
          : modifierTags;
        if (shownMods.length === 0) return null;
        return (
          <div className="tp-mod-section">
            <div className="tp-section-label">수식어 <span>어떻게 · 누구 · 얼마나</span></div>
            <div className="tp-mods">{shownMods.map((t) => chip(t, false))}</div>
          </div>
        );
      })()}
    </div>
  );
}
