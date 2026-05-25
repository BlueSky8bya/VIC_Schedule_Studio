"use client";

import { Trash2 } from "lucide-react";
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
  // #6: 태그 추가(있을 때만 "추가" 버튼 노출). 새 태그엔 기존과 구별되는 연한 색이 자동 배정된다.
  addTagAction?: () => Promise<TagUpdateResult>;
  // #6: 태그 삭제(있을 때만 행마다 삭제 버튼 노출).
  removeTagAction?: (tagId: string) => Promise<TagUpdateResult>;
};

type Draft = { name: string; colorKey: ColorKey | "" };

export function TagLegendEditor({
  tags,
  palette,
  canEdit,
  updateTagsAction,
  addTagAction,
  removeTagAction
}: TagLegendEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 추가/삭제는 저장과 별도의 진행 상태로 둬, "전체 저장" 버튼이 "저장 중…"으로 잘못 바뀌지 않게 한다.
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addTag() {
    if (!addTagAction) return;
    setError(null);
    startBusy(async () => {
      const result = await addTagAction();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function removeTag(tagId: string, name: string) {
    if (!removeTagAction) return;
    if (!window.confirm(`'${name}' 태그를 삭제할까요? 이 태그가 달린 일정에서도 태그가 빠집니다.`)) {
      return;
    }
    setError(null);
    startBusy(async () => {
      const result = await removeTagAction(tagId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }
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
            {removeTagAction ? (
              <button
                aria-label={`${d.name} 삭제`}
                className="tag-editor-remove"
                disabled={busy}
                onClick={() => removeTag(tag.id, d.name)}
                title="이 태그 삭제"
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            ) : null}
          </div>
        );
      })}

      {error ? <div className="auth-warning">{error}</div> : null}
      {anyEmpty ? <p className="tag-editor-hint warn">색상이 비어 있는 태그가 있습니다.</p> : null}
      <div className="tag-editor-actions">
        {addTagAction ? (
          <button className="button" disabled={busy} onClick={addTag} type="button">
            {busy ? "처리 중…" : "+ 태그 추가"}
          </button>
        ) : null}
        <button
          className="button primary"
          disabled={pending || busy || anyEmpty || !dirty}
          onClick={saveAll}
          type="button"
        >
          {pending ? "저장 중…" : "전체 저장"}
        </button>
      </div>
    </div>
  );
}
