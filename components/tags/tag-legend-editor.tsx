"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BroadcastTag, ColorKey, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import type { TagUpdateResult } from "@/lib/schedules/tag-actions";

type TagLegendEditorProps = {
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  canEdit: boolean;
  updateTagsAction: (
    updates: { id: string; displayName: string; colorKey: ColorKey }[]
  ) => Promise<TagUpdateResult>;
};

type Draft = { name: string; colorKey: ColorKey | "" };

export function TagLegendEditor({
  tags,
  palette,
  canEdit,
  updateTagsAction
}: TagLegendEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(tags.map((t) => [t.id, { name: t.displayName, colorKey: t.colorKey }]))
  );

  const colorOf = (key: ColorKey) => palette.find((p) => p.key === key);
  // #3: "기타"는 항상 맨 끝(나머지 순서 유지).
  const orderedTags = [...tags].sort(
    (a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타")
  );

  // 읽기 전용(좌측 패널): 색상 안내만
  if (!canEdit) {
    return (
      <div className="studio-tag-legend">
        {orderedTags.map((tag) => {
          const color = colorOf(tag.colorKey);
          return color ? (
            <span key={tag.id}>
              <i data-color={color.key} style={{ backgroundColor: color.bgColor, borderColor: color.borderColor }} />
              {tag.displayName}
            </span>
          ) : null;
        })}
      </div>
    );
  }

  // 다른 태그가 이미 쓰는 색인지
  function usedByOther(tagId: string, key: ColorKey) {
    return Object.entries(draft).some(([id, d]) => id !== tagId && d.colorKey === key);
  }

  function pick(tagId: string, key: ColorKey) {
    setDraft((cur) => {
      const d = cur[tagId];
      // 이미 선택된 색을 다시 누르면 해제(빈 색) → 다른 태그가 그 색을 가져갈 수 있게
      const nextKey = d.colorKey === key ? "" : key;
      return { ...cur, [tagId]: { ...d, colorKey: nextKey } };
    });
  }

  const anyEmpty = Object.values(draft).some((d) => d.colorKey === "");
  const dirty = tags.some(
    (t) => draft[t.id].name !== t.displayName || draft[t.id].colorKey !== t.colorKey
  );

  function saveAll() {
    setError(null);
    startTransition(async () => {
      const updates = tags.map((t) => ({
        id: t.id,
        displayName: draft[t.id].name,
        colorKey: draft[t.id].colorKey as ColorKey
      }));
      const result = await updateTagsAction(updates);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="tag-editor">
      <p className="tag-editor-hint">
        색을 바꾸려면 먼저 같은 색을 쓰는 태그의 색을 한 번 더 눌러 해제한 뒤 다시 고르세요.
        한 색은 한 태그만 쓸 수 있습니다.
      </p>
      {orderedTags.map((tag) => {
        const d = draft[tag.id];
        return (
          <div className="tag-editor-row" key={tag.id}>
            <input
              aria-label="태그 이름"
              onChange={(e) =>
                setDraft((cur) => ({ ...cur, [tag.id]: { ...d, name: e.target.value } }))
              }
              value={d.name}
            />
            <div className="tag-editor-swatches">
              {palette.map((c) => {
                const selected = d.colorKey === c.key;
                const blocked = usedByOther(tag.id, c.key);
                return (
                  <button
                    aria-label={c.name}
                    className={selected ? "selected" : ""}
                    data-color={c.key}
                    disabled={blocked && !selected}
                    key={c.key}
                    onClick={() => pick(tag.id, c.key)}
                    style={{ backgroundColor: c.bgColor, borderColor: c.borderColor }}
                    title={blocked && !selected ? `${c.name} (다른 태그가 사용 중)` : c.name}
                    type="button"
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {error ? <div className="auth-warning">{error}</div> : null}
      {anyEmpty ? <p className="tag-editor-hint warn">색상이 비어 있는 태그가 있습니다.</p> : null}
      <button
        className="button primary"
        disabled={pending || anyEmpty || !dirty}
        onClick={saveAll}
        type="button"
      >
        {pending ? "저장 중…" : "전체 저장"}
      </button>
    </div>
  );
}
