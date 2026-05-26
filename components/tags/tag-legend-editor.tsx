"use client";

import { GripVertical, Trash2 } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";
import type { BroadcastTag, ColorKey, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import type { AddTagResult, TagUpdateResult } from "@/lib/schedules/tag-actions";

type TagUpdate = { id: string; displayName: string; colorKey: ColorKey; sortOrder?: number };

// 태그는 최대 20개까지. (서버 addTagAction에서도 동일하게 막는다.)
const MAX_TAGS = 20;

type TagLegendEditorProps = {
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  canEdit: boolean;
  updateTagsAction: (updates: TagUpdate[]) => Promise<TagUpdateResult>;
  // #6: 태그 추가(있을 때만 "추가" 버튼). 새 태그엔 기존과 구별되는 연한 색이 자동 배정된다.
  addTagAction?: () => Promise<AddTagResult>;
  // #6: 태그 삭제(있을 때만 행마다 삭제 버튼).
  removeTagAction?: (tagId: string) => Promise<TagUpdateResult>;
  // #4: 새로고침 없이 부모(달력) 상태를 낙관적으로 갱신하기 위한 콜백.
  onTagAdded?: (tag: BroadcastTag, color: ColorPaletteEntry) => void;
  onTagRemoved?: (tagId: string) => void;
  onTagsUpdated?: (updates: TagUpdate[]) => void;
  // 읽기 전용 색상 안내를 "필터"로도 쓸 때(편집실/시청자). 누르면 그 태그만 골라본다.
  filterIds?: string[];
  onToggleFilter?: (tagId: string) => void;
};

type Draft = { name: string; colorKey: ColorKey | "" };

export function TagLegendEditor({
  tags,
  palette,
  canEdit,
  updateTagsAction,
  addTagAction,
  removeTagAction,
  onTagAdded,
  onTagRemoved,
  onTagsUpdated,
  filterIds,
  onToggleFilter
}: TagLegendEditorProps) {
  const [pending, startTransition] = useTransition();
  // 추가/삭제는 저장과 별도 진행 상태 — "전체 저장" 버튼이 "저장 중…"으로 잘못 바뀌지 않게.
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(tags.map((t) => [t.id, { name: t.displayName, colorKey: t.colorKey }]))
  );

  // 부모 태그 목록이 바뀌면(추가/삭제) 드래프트도 맞춘다. 기존 편집값은 유지.
  useEffect(() => {
    setDraft((cur) => {
      const next: Record<string, Draft> = {};
      for (const t of tags) {
        next[t.id] = cur[t.id] ?? { name: t.displayName, colorKey: t.colorKey };
      }
      return next;
    });
  }, [tags]);

  const colorOf = (key: ColorKey) => palette.find((p) => p.key === key);

  // 드래그로 바꾸는 표시 순서(태그 id 배열). 저장 시 sort_order로 반영된다.
  const [orderIds, setOrderIds] = useState<string[]>(() => tags.map((t) => t.id));
  useEffect(() => {
    setOrderIds((cur) => {
      const ids = tags.map((t) => t.id);
      const kept = cur.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [tags]);
  const orderedTags = orderIds
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is BroadcastTag => Boolean(t));

  // 순서 변경 — 포인터(마우스+터치) 통합. 손잡이를 누르면 행을 그대로 복제한 "유령(ghost)"이
  // 손가락/커서를 따라 들려 움직이고(웹·모바일 동일), 화면 가장자리에선 자동 스크롤된다.
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scrollerRef = useRef<HTMLElement | Window | null>(null);
  const scrollDirRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  // 드래그 중 언마운트되면 떠다니던 ghost·리스너·애니메이션을 정리한다.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ghostRef.current?.remove();
      if (moveHandlerRef.current) {
        window.removeEventListener("pointermove", moveHandlerRef.current);
      }
    };
  }, []);

  function moveBefore(list: string[], from: string, before: string) {
    if (from === before) return list;
    const next = list.filter((id) => id !== from);
    const idx = next.indexOf(before);
    next.splice(idx, 0, from);
    return next;
  }
  // 가장 가까운 스크롤 가능한 조상(모달 내부 스크롤 vs 페이지)을 찾는다.
  function findScroller(el: HTMLElement | null): HTMLElement | Window {
    let n = el?.parentElement ?? null;
    while (n) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 4) {
        return n;
      }
      n = n.parentElement;
    }
    return window;
  }
  function autoScrollLoop() {
    const dir = scrollDirRef.current;
    const sc = scrollerRef.current;
    if (dir !== 0 && sc) {
      if (sc === window) window.scrollBy(0, 11 * dir);
      else (sc as HTMLElement).scrollTop += 11 * dir;
    }
    rafRef.current = requestAnimationFrame(autoScrollLoop);
  }
  function onPointerMove(e: PointerEvent) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.left = `${e.clientX - offsetRef.current.x}px`;
    ghost.style.top = `${e.clientY - offsetRef.current.y}px`;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const overId = el?.closest("[data-tagid]")?.getAttribute("data-tagid");
    if (overId && dragId.current && overId !== dragId.current) {
      setOrderIds((cur) => moveBefore(cur, dragId.current as string, overId));
    }
    const margin = 90;
    scrollDirRef.current =
      e.clientY < margin ? -1 : e.clientY > window.innerHeight - margin ? 1 : 0;
  }
  function endDrag() {
    if (moveHandlerRef.current) {
      window.removeEventListener("pointermove", moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    scrollDirRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ghostRef.current?.remove();
    ghostRef.current = null;
    dragId.current = null;
    setDraggingId(null);
  }
  function onHandlePointerDown(e: ReactPointerEvent, id: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const row = (e.currentTarget as HTMLElement).closest(".tag-editor-row") as HTMLElement | null;
    if (!row) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true) as HTMLElement;
    ghost.classList.add("tag-drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    scrollerRef.current = findScroller(row);
    dragId.current = id;
    setDraggingId(id);
    scrollDirRef.current = 0;
    rafRef.current = requestAnimationFrame(autoScrollLoop);
    moveHandlerRef.current = onPointerMove;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag, { once: true });
    window.addEventListener("pointercancel", endDrag, { once: true });
  }

  // 읽기 전용(좌측 패널): 색상 안내. onToggleFilter가 있으면 필터 버튼으로 동작한다.
  if (!canEdit) {
    const filtering = (filterIds?.length ?? 0) > 0;
    return (
      <div className="studio-tag-legend">
        {orderedTags.map((tag) => {
          const color = colorOf(tag.colorKey);
          if (!color) return null;
          if (!onToggleFilter) {
            return (
              <span key={tag.id}>
                <i
                  data-color={color.key}
                  style={{ backgroundColor: color.bgColor, borderColor: color.borderColor }}
                />
                {tag.displayName}
              </span>
            );
          }
          const on = filterIds?.includes(tag.id) ?? false;
          return (
            <button
              aria-pressed={on}
              className={`tag-legend-filter ${on ? "on" : ""} ${filtering && !on ? "dim" : ""}`}
              key={tag.id}
              onClick={() => onToggleFilter(tag.id)}
              type="button"
            >
              <i
                data-color={color.key}
                style={{ backgroundColor: color.bgColor, borderColor: color.borderColor }}
              />
              {tag.displayName}
            </button>
          );
        })}
        {filtering ? (
          <button
            className="tag-legend-clear"
            onClick={() => filterIds?.forEach((id) => onToggleFilter?.(id))}
            type="button"
          >
            필터 해제
          </button>
        ) : null}
      </div>
    );
  }

  function flashSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function addTag() {
    if (!addTagAction) return;
    setError(null);
    startBusy(async () => {
      const result = await addTagAction();
      if (result.ok) {
        onTagAdded?.(result.tag, result.color); // 부모 상태에 즉시 반영(새로고침 X)
      } else {
        setError(result.error);
      }
    });
  }

  function removeTag(tagId: string) {
    if (!removeTagAction) return;
    const tag = tags.find((t) => t.id === tagId);
    const color = tag ? palette.find((c) => c.key === tag.colorKey) : undefined;
    setError(null);
    onTagRemoved?.(tagId); // 낙관적 제거
    startBusy(async () => {
      const result = await removeTagAction(tagId);
      if (!result.ok) {
        setError(result.error);
        if (tag && color) onTagAdded?.(tag, color); // 실패 → 되돌림
      }
    });
  }

  // 다른 태그가 이미 쓰는 색인지
  function usedByOther(tagId: string, key: ColorKey) {
    return Object.entries(draft).some(([id, d]) => id !== tagId && d.colorKey === key);
  }

  function pick(tagId: string, key: ColorKey) {
    setDraft((cur) => {
      const d = cur[tagId];
      const nextKey = d.colorKey === key ? "" : key;
      return { ...cur, [tagId]: { ...d, colorKey: nextKey } };
    });
  }

  const anyEmpty = Object.values(draft).some((d) => d.colorKey === "");
  const orderChanged = orderIds.some((id, i) => tags[i]?.id !== id);
  const contentChanged = tags.some(
    (t) => draft[t.id]?.name !== t.displayName || draft[t.id]?.colorKey !== t.colorKey
  );
  const dirty = orderChanged || contentChanged;
  // 순서만 바뀌었으면 "변경된 순서 저장", 이름·색 등도 같이 바뀌었으면 "전체 저장".
  const saveLabel = orderChanged && !contentChanged ? "변경된 순서 저장" : "전체 저장";

  function saveAll() {
    setError(null);
    // 드래그 순서대로 sort_order를 0,1,2…로 부여해 저장.
    const updates: TagUpdate[] = orderedTags.map((t, index) => ({
      id: t.id,
      displayName: draft[t.id].name,
      colorKey: draft[t.id].colorKey as ColorKey,
      sortOrder: index
    }));
    const prev: TagUpdate[] = tags.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      colorKey: t.colorKey,
      sortOrder: t.sortOrder
    }));
    onTagsUpdated?.(updates); // 낙관적 반영(달력 색 즉시 갱신)
    startTransition(async () => {
      const result = await updateTagsAction(updates);
      if (result.ok) {
        flashSaved(); // 성공 시점에 "저장됨" 표시(저장 중 타이밍과 어긋나지 않게)
      } else {
        setError(result.error);
        onTagsUpdated?.(prev); // 실패 → 되돌림
      }
    });
  }

  return (
    <div className="tag-editor">
      <p className="tag-editor-hint">
        왼쪽 손잡이(⋮⋮)를 끌어 순서를 바꿀 수 있어요. 색을 바꾸려면 먼저 같은 색을 쓰는 태그의 색을
        한 번 더 눌러 해제한 뒤 다시 고르세요. 한 색은 한 태그만 쓸 수 있습니다.
      </p>
      {orderedTags.map((tag) => {
        const d = draft[tag.id];
        if (!d) return null;
        return (
          <div
            className={`tag-editor-row ${draggingId === tag.id ? "dragging" : ""}`}
            data-tagid={tag.id}
            key={tag.id}
          >
            <button
              aria-label="순서 변경"
              className="tag-drag-handle"
              onPointerDown={(e) => onHandlePointerDown(e, tag.id)}
              title="끌어서 순서 변경"
              type="button"
            >
              <GripVertical aria-hidden="true" size={16} />
            </button>
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
                onClick={() => removeTag(tag.id)}
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
          <span className="tag-editor-add">
            <button
              className="button"
              disabled={busy || tags.length >= MAX_TAGS}
              onClick={addTag}
              type="button"
            >
              {busy ? "처리 중…" : "+ 태그 추가"}
            </button>
            <span className="tag-editor-add-note">최대 {MAX_TAGS}개</span>
          </span>
        ) : null}
        <button
          className={`button primary ${saved && !dirty ? "saved" : ""}`}
          disabled={pending || busy || anyEmpty || (!dirty && !saved)}
          onClick={saveAll}
          type="button"
        >
          {pending ? "저장 중…" : saved && !dirty ? "✓ 저장됨" : saveLabel}
        </button>
      </div>
    </div>
  );
}
