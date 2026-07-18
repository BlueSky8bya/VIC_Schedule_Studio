"use client";

import { AlertTriangle, GripVertical, Lock, Palette, Plus, Save, Trash2 } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import type { BroadcastTag, ColorKey, ColorPaletteEntry, TagKind } from "@/lib/domain/schedule-types";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만 존중
import type { SaveTagsResult, TagCreateInput } from "@/lib/schedules/tag-actions";
import { generateTagColor, isPatternColor } from "@/lib/tags/color-gen";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { ColorPickerPopover } from "@/components/tags/color-picker-popover";
import { hapticTick } from "@/lib/ui/haptics";

type TagUpdate = {
  id: string;
  displayName: string;
  colorKey: ColorKey;
  bgHex?: string | null;
  sortOrder?: number;
  parentId?: string | null;
  kind?: TagKind;
};

// 태그는 최대 20개까지. (서버 saveTagsAction에서도 동일하게 막는다.)
// 2계층 태그: 대분류는 소수(색)지만 세부는 무제한급으로 늘 수 있어 총 상한을 크게.
const MAX_TAGS = 120;
// 저장 전 새 태그(드래프트)의 임시 id 접두사.
const NEW_PREFIX = "new:";
// id가 null/undefined로 새어들어와도 터지지 않게 방어(드물게 서버가 빈 id를 돌려줄 때 등).
const isNew = (id: string | null | undefined): boolean =>
  typeof id === "string" && id.startsWith(NEW_PREFIX);

type TagLegendEditorProps = {
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  canEdit: boolean;
  // #4: "전체 저장" — 기존 태그 수정 + 새 태그 생성을 한 번에. (편집 모드에서만 필요.)
  saveTagsAction?: (input: {
    updates: TagUpdate[];
    creates: TagCreateInput[];
  }) => Promise<SaveTagsResult>;
  // #6: 태그 삭제(있을 때만 행마다 삭제 버튼).
  removeTagAction?: (tagId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  // #4: 새로고침 없이 부모(달력) 상태를 낙관적으로 갱신하기 위한 콜백.
  onTagAdded?: (tag: BroadcastTag, color: ColorPaletteEntry) => void;
  onTagRemoved?: (tagId: string) => void;
  onTagsUpdated?: (updates: TagUpdate[]) => void;
  // 읽기 전용 색상 안내를 "필터"로도 쓸 때(편집실/시청자). 누르면 그 태그만 골라본다.
  filterIds?: string[];
  onToggleFilter?: (tagId: string) => void;
};

type Draft = {
  name: string;
  colorKey: ColorKey | "";
  bgHex: string | null; // 커스텀 색(대분류만). null이면 팔레트 색(colorKey) 사용.
  parentId: string | null;
  kind: TagKind;
};

export function TagLegendEditor({
  tags,
  palette,
  canEdit,
  saveTagsAction,
  removeTagAction,
  onTagAdded,
  onTagRemoved,
  onTagsUpdated,
  filterIds,
  onToggleFilter
}: TagLegendEditorProps) {
  const [pending, startTransition] = useTransition();
  // 삭제는 저장과 별도 진행 상태 — "전체 저장" 버튼이 "저장 중…"으로 잘못 바뀌지 않게.
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // 삭제 직후 잠깐(380ms) 모든 삭제 버튼을 잠근다. 삭제하면 행이 즉시 사라져 아래 행이 위로
  // 올라오는데, 빠른 더블탭의 두 번째 탭이 그 자리(특히 맨 끝 행)를 잘못 누르는 걸 막는다.
  const deleteLockRef = useRef(false);
  const [deleteLock, setDeleteLock] = useState(false);
  function lockDeletes() {
    deleteLockRef.current = true;
    setDeleteLock(true);
    window.setTimeout(() => {
      deleteLockRef.current = false;
      setDeleteLock(false);
    }, 380);
  }

  // 색 피커 팝오버가 열린 태그 id(한 번에 하나) + 트리거 스와치 화면 좌표(포털 위치용).
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  // 팝오버를 '열었을 때'의 bgHex — 바깥 클릭/Esc(취소)로 닫으면 여기로 되돌린다('완료' 전엔 확정 안 함).
  const pickerInitialRef = useRef<string | null>(null);
  // #4: 새로 추가한 태그/색은 "저장" 전까지 팝업 안에서만 존재한다(달력·다른 패널엔 반영 안 함).
  const [newTags, setNewTags] = useState<BroadcastTag[]>([]);
  const [newColors, setNewColors] = useState<ColorPaletteEntry[]>([]);

  // 편집 대상 = 기존 태그 + 드래프트 태그. 스와치 팔레트도 드래프트 색을 포함한다.
  const allTags = useMemo(() => [...tags, ...newTags], [tags, newTags]);
  const effectivePalette = useMemo(() => [...palette, ...newColors], [palette, newColors]);
  // 0A: 읽기 전용 색상 안내(범례)의 색을 단일 resolver로 푼다. 편집 중 드래프트 색까지 반영하려고
  // allTags/effectivePalette 기준으로 만든다(대분류는 자기 색이라 결과는 기존 colorOf와 동일).
  const legendVisual = useMemo(
    () => createTagVisualResolver(allTags, effectivePalette),
    [allTags, effectivePalette]
  );

  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      tags.map((t) => [
        t.id,
        { name: t.displayName, colorKey: t.colorKey, bgHex: t.bgHex ?? null, parentId: t.parentId, kind: t.kind }
      ])
    )
  );

  // 부모 태그 목록이 바뀌면(저장 반영) 드래프트도 맞춘다. 기존 편집값·드래프트 항목은 유지.
  useEffect(() => {
    setDraft((cur) => {
      const next: Record<string, Draft> = {};
      for (const t of tags) {
        next[t.id] = cur[t.id] ?? {
          name: t.displayName,
          colorKey: t.colorKey,
          bgHex: t.bgHex ?? null,
          parentId: t.parentId,
          kind: t.kind
        };
      }
      // 아직 저장 안 한 드래프트(new:) 항목은 그대로 보존.
      for (const id of Object.keys(cur)) {
        if (!next[id] && isNew(id)) next[id] = cur[id];
      }
      return next;
    });
  }, [tags]);

  // 드래프트(저장 전) 색 정리 — 어떤 태그도 더는 안 쓰는 새 색은 버린다. 방식↔콘텐츠 토글을
  // 오갈 때마다 새 색을 만들어 newColors가 누적되던(팔레트 풀이 하나씩 늘던) 문제를 막는다.
  useEffect(() => {
    setNewColors((cols) => {
      const used = new Set(Object.values(draft).map((d) => d.colorKey));
      const next = cols.filter((c) => used.has(c.key));
      return next.length === cols.length ? cols : next;
    });
  }, [draft]);

  const colorOf = (key: ColorKey) => effectivePalette.find((p) => p.key === key);

  // 2계층: 드래그 순서는 '대분류'에만 적용(세부는 부모 밑에 sortOrder 순으로 따라붙음).
  const isTopTag = (t: BroadcastTag) => (t.parentId ?? null) === null;
  // 드래그로 바꾸는 대분류 표시 순서(대분류 id 배열). 저장 시 sort_order로 반영된다.
  const [orderIds, setOrderIds] = useState<string[]>(() =>
    tags.filter(isTopTag).map((t) => t.id)
  );
  useEffect(() => {
    setOrderIds((cur) => {
      const ids = [...tags, ...newTags]
        .filter(isTopTag)
        .map((t) => t.id)
        .filter((id): id is string => Boolean(id));
      const kept = cur.filter((id) => Boolean(id) && ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [tags, newTags]);
  // 대분류(드래그 순서대로) + 각 대분류의 세부(sortOrder 순).
  const orderedTops = orderIds
    .map((id) => allTags.find((t) => t.id === id))
    .filter((t): t is BroadcastTag => Boolean(t));
  const childrenOf = (topId: string) =>
    allTags
      .filter((t) => (t.parentId ?? null) === topId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  // 휴뱅(dayoff)은 시스템 기본 태그 — 순서 변경·이름 변경·색 변경·삭제를 모두 막는다.
  // (식별은 표시 이름이 아니라 tag_key로 — 이름을 바꿔도 안 깨지게.)
  const isLocked = (id: string) => allTags.find((t) => t.id === id)?.tagKey === "dayoff";

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
  // 들었을 때의 "물리감"용 — 유령이 커서를 관성 있게 뒤따르고(지연), 움직임 방향으로 기울며(모멘텀),
  // 살짝 랜덤하게 흔들린다. target=커서 따라갈 목표 좌표, pos=현재 좌표(보간), rot=현재 기울기.
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const dragPosRef = useRef({ x: 0, y: 0 });
  const dragRotRef = useRef(0);
  const dragRotVelRef = useRef(0); // 회전 속도(스프링) — 매달린 듯 swing
  const dragGravityRef = useRef(0); // 잡은 지점이 중심에서 벗어난 만큼의 "매달림" 기울기
  const dragWobbleRef = useRef(0); // 랜덤 흔들림 위상(매 프레임 조금씩 흐른다)
  const dragReducedRef = useRef(false); // 모션 최소화 환경이면 흔들림·관성을 끈다
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
    // 휴뱅은 자기 자신을 옮기지도, 다른 태그를 그 앞으로 보내지도 못한다(항상 최상단 고정).
    if (isLocked(from) || isLocked(before)) return list;
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
  // 자동 스크롤 + 유령 물리(관성·모멘텀 기울기·랜덤 흔들림)를 한 프레임 루프에서 처리한다.
  function dragLoop() {
    const dir = scrollDirRef.current;
    const sc = scrollerRef.current;
    if (dir !== 0 && sc) {
      if (sc === window) window.scrollBy(0, 11 * dir);
      else (sc as HTMLElement).scrollTop += 11 * dir;
    }
    const ghost = ghostRef.current;
    if (ghost && dragReducedRef.current) {
      // 모션 최소화: 흔들림·관성 없이 그대로 따라가게.
      const target = dragTargetRef.current;
      ghost.style.left = `${target.x}px`;
      ghost.style.top = `${target.y}px`;
    } else if (ghost) {
      const pos = dragPosRef.current;
      const target = dragTargetRef.current;
      const prevX = pos.x;
      // 관성: 목표(커서)로 천천히 보간돼 살짝 뒤따른다.
      pos.x += (target.x - pos.x) * 0.22;
      pos.y += (target.y - pos.y) * 0.22;
      const vx = pos.x - prevX; // 가로 속도 → 움직이는 방향으로 기운다(모멘텀)
      const momentum = Math.max(-11, Math.min(11, vx * 0.5));
      // 매달림(중력) 각도 + 모멘텀을 목표로 스프링 swing. (얇은 바라 모멘텀도 약하게.)
      const targetAngle = dragGravityRef.current + momentum;
      dragRotVelRef.current += (targetAngle - dragRotRef.current) * 0.1;
      dragRotVelRef.current *= 0.8;
      dragRotRef.current += dragRotVelRef.current;
      // 랜덤 흔들림 — 얇은 바라 기존의 약 1/3 세기로만.
      dragWobbleRef.current += 0.12;
      const w = dragWobbleRef.current;
      const wobble =
        Math.sin(w) * 0.47 + Math.sin(w * 1.7 + 0.6) * 0.3 + (Math.random() - 0.5) * 0.27;
      ghost.style.left = `${pos.x}px`;
      ghost.style.top = `${pos.y}px`;
      ghost.style.transform = `rotate(${dragRotRef.current + wobble}deg) scale(1.05)`;
    }
    rafRef.current = requestAnimationFrame(dragLoop);
  }
  function onPointerMove(e: PointerEvent) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    // 직접 위치를 박지 않고 "목표"만 갱신 → dragLoop이 관성 있게 따라간다.
    dragTargetRef.current = {
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y
    };
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
    if (isLocked(id)) return; // 휴뱅은 드래그 불가
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
    // 물리 초기화: 현재 위치=목표=잡은 자리, 기울기·흔들림 0에서 시작.
    dragPosRef.current = { x: rect.left, y: rect.top };
    dragTargetRef.current = { x: rect.left, y: rect.top };
    dragRotRef.current = 0;
    dragRotVelRef.current = 0;
    dragWobbleRef.current = 0;
    // 태그 순서 변경은 잡은 위치 축·중력을 쓰지 않는다(중앙 축, 가벼운 흔들림만).
    ghost.style.transformOrigin = "center";
    dragGravityRef.current = 0;
    dragReducedRef.current = reduceMotionEnabled(); // OS reduce-motion 무시 — 앱 토글만
    scrollerRef.current = findScroller(row);
    dragId.current = id;
    setDraggingId(id);
    scrollDirRef.current = 0;
    rafRef.current = requestAnimationFrame(dragLoop);
    moveHandlerRef.current = onPointerMove;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag, { once: true });
    window.addEventListener("pointercancel", endDrag, { once: true });
  }

  // 읽기 전용(좌측 패널): 색상 안내. onToggleFilter가 있으면 필터 버튼으로 동작한다.
  // 2계층: 색상 안내/필터는 '대분류'만(한 색=한 칩). 대분류 필터가 하위 세부 일정까지 매칭한다.
  if (!canEdit) {
    const filtering = (filterIds?.length ?? 0) > 0;
    const legendItem = (tag: BroadcastTag) => {
      const v = legendVisual.visualOf(tag.id);
      if (v.missing || !v.bg) return null;
      if (!onToggleFilter) {
        return (
          <span key={tag.id}>
            <i
              data-color={v.colorKey ?? undefined}
              style={{ backgroundColor: v.bg, borderColor: v.border ?? undefined }}
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
            data-color={v.colorKey ?? undefined}
            style={{ backgroundColor: v.bg, borderColor: v.border ?? undefined }}
          />
          {tag.displayName}
        </button>
      );
    };
    // 콘텐츠끼리 / 방식끼리 한 눈에 보이게 두 묶음으로 나눠 wrap 배치(가로 스크롤 없음).
    // 읽기 전용(색상 안내/필터)은 드래그를 안 하므로 내부 orderIds가 아니라 'tags prop 순서'를
    // 그대로 따른다. (orderIds 동기화는 기존 순서를 보존해서, 편집실에서 순서를 저장해도 색상바가
    // 옛 순서로 굳고 새로고침해야 바뀌던 버그가 있었다. prop 순서를 직접 쓰면 즉시 반영된다.)
    const topsInOrder = tags.filter((t) => (t.parentId ?? null) === null);
    const contentTops = topsInOrder.filter((t) => t.kind !== "modifier");
    const modifierTops = topsInOrder.filter((t) => t.kind === "modifier");
    return (
      <div className="studio-tag-legend">
        <div className="tlg-group">{contentTops.map(legendItem)}</div>
        {modifierTops.length > 0 ? (
          <div className="tlg-group tlg-mod">
            <div className="tlg-chips">{modifierTops.map(legendItem)}</div>
          </div>
        ) : null}
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

  // #4: 태그 추가는 "팝업 안에서만" — 서버 호출도, 달력/다른 패널 반영도 없이 즉시 드래프트로 뜬다.
  // 색은 클라이언트에서 기존 색과 구분되게 '랜덤'으로 만들고("전체 저장" 때 DB 반영). kind에 따라
  // 콘텐츠(무늬 카드 색) / 방식(단색 점) 풀에서 뽑는다.
  function addTag(kind: TagKind) {
    if (allTags.length >= MAX_TAGS) return;
    hapticTick();
    setError(null);
    const gen = generateTagColor(
      effectivePalette.map((c) => ({ key: c.key, bgColor: c.bgColor })),
      kind === "modifier" ? { plain: true, random: true } : { preferPattern: true, random: true }
    );
    const color: ColorPaletteEntry = { ...gen, sortOrder: 0 };
    const tempId = `${NEW_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tag: BroadcastTag = {
      id: tempId,
      tagKey: tempId,
      displayName: kind === "modifier" ? "새 형식" : "새 태그",
      colorKey: gen.key,
      sortOrder: 9999,
      isDefault: false,
      isActive: true,
      parentId: null,
      kind
    };
    setNewColors((prev) => [...prev, color]);
    setNewTags((prev) => [...prev, tag]);
    setDraft((cur) => ({
      ...cur,
      [tempId]: { name: tag.displayName, colorKey: gen.key, bgHex: null, parentId: null, kind }
    }));
    setOrderIds((cur) => [...cur, tempId]);
  }

  function removeTag(tagId: string) {
    // 더블탭 보호: 직전 삭제 직후의 두 번째 탭(레이아웃이 위로 밀려 엉뚱한 행을 누르는)을 막는다.
    if (deleteLockRef.current) return;
    // 드래프트(저장 전) 태그는 로컬에서만 지운다 — 서버 호출 없음(확인 불필요).
    if (isNew(tagId)) {
      lockDeletes();
      setNewTags((prev) => prev.filter((t) => t.id !== tagId));
      setDraft((cur) => {
        const next = { ...cur };
        delete next[tagId];
        // 더 이상 아무 행도 안 쓰는 드래프트 색은 스와치에서도 정리.
        const usedKeys = new Set(Object.values(next).map((d) => d.colorKey));
        setNewColors((cols) => cols.filter((c) => usedKeys.has(c.key)));
        return next;
      });
      setOrderIds((cur) => cur.filter((id) => id !== tagId));
      return;
    }
    if (!removeTagAction) return;
    const tag = tags.find((t) => t.id === tagId);
    // 오클릭 방지: 저장된 태그는 삭제 전 한 번 확인한다(삭제하면 과거 연결까지 사라짐).
    const tagName = tag?.displayName ?? "이";
    if (typeof window !== "undefined" && !window.confirm(`'${tagName}' 태그를 삭제하시겠습니까?`)) {
      return;
    }
    lockDeletes();
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


  // 콘텐츠↔방식 토글 — kind를 바꾸면 색도 그 kind의 풀(콘텐츠=무늬, 방식=단색)로 자동 전환한다.
  // 현재 색이 새 풀에 맞고 같은 kind에서 안 겹치면 유지, 아니면 빈 색을 찾고, 없으면 새로 생성.
  function toggleKind(tagId: string) {
    hapticTick();
    const d = draft[tagId];
    if (!d) return;
    const newKind: TagKind = d.kind === "modifier" ? "content" : "modifier";
    const wantPattern = newKind !== "modifier";
    const usedSame = new Set(
      Object.entries(draft)
        .filter(([id, dd]) => id !== tagId && dd.parentId === null && dd.kind === newKind)
        .map(([, dd]) => dd.colorKey)
    );
    let nextKey: ColorKey | "" = d.colorKey;
    const keepOk =
      nextKey !== "" && isPatternColor(nextKey) === wantPattern && !usedSame.has(nextKey);
    if (!keepOk) {
      const free = effectivePalette.find(
        (c) => isPatternColor(c.key) === wantPattern && !usedSame.has(c.key)
      );
      if (free) {
        nextKey = free.key as ColorKey;
      } else {
        const gen = generateTagColor(
          effectivePalette.map((c) => ({ key: c.key, bgColor: c.bgColor })),
          wantPattern ? { preferPattern: true } : { plain: true }
        );
        nextKey = gen.key as ColorKey;
        setNewColors((prev) => [...prev, { ...gen, sortOrder: 0 }]);
      }
    }
    setDraft((cur) => ({ ...cur, [tagId]: { ...cur[tagId], kind: newKind, colorKey: nextKey } }));
  }

  // 색 비어있음 경고는 '대분류'만(세부는 부모 색 상속).
  const anyEmpty = Object.entries(draft).some(
    ([, d]) => d.parentId === null && d.colorKey === ""
  );
  const existingTops = tags.filter(isTopTag);
  const existingOrder = orderIds.filter((id): id is string => Boolean(id) && !isNew(id));
  const orderChanged = existingOrder.some((id, i) => existingTops[i]?.id !== id);
  const contentChanged = tags.some(
    (t) =>
      draft[t.id]?.name !== t.displayName ||
      draft[t.id]?.colorKey !== t.colorKey ||
      (draft[t.id]?.bgHex ?? null) !== (t.bgHex ?? null) ||
      draft[t.id]?.kind !== t.kind
  );
  const hasNew = newTags.length > 0;
  const dirty = orderChanged || contentChanged || hasNew;
  // 순서만 바뀌었으면 "변경된 순서 저장", 그 외(이름·색·새 태그)는 "전체 저장".
  const saveLabel =
    orderChanged && !contentChanged && !hasNew ? "변경된 순서 저장" : "전체 저장";

  function saveAll() {
    if (!saveTagsAction) return;
    hapticTick();
    setError(null);
    const updates: TagUpdate[] = [];
    const creates: TagCreateInput[] = [];
    // 대분류는 드래그 순서대로 sort_order 0..n. 각 대분류의 세부는 부모 밑에서 0..m + parentId.
    const pushTag = (t: BroadcastTag, sortOrder: number, parentId: string | null) => {
      const d = draft[t.id];
      if (!d) return;
      if (isNew(t.id)) {
        const c = newColors.find((x) => x.key === d.colorKey);
        creates.push({
          tempId: t.id,
          displayName: d.name,
          colorKey: d.colorKey as ColorKey,
          bgColor: c?.bgColor ?? "#eeeeee",
          textColor: c?.textColor ?? "#333333",
          borderColor: c?.borderColor ?? "#cccccc",
          bgHex: parentId ? null : d.bgHex,
          sortOrder,
          parentId,
          // 세부(자식)는 항상 content, 대분류는 토글 값.
          kind: parentId ? "content" : d.kind
        });
      } else {
        updates.push({
          id: t.id,
          displayName: d.name,
          colorKey: d.colorKey as ColorKey,
          bgHex: parentId ? null : d.bgHex,
          sortOrder,
          parentId,
          kind: parentId ? "content" : d.kind
        });
      }
    };
    orderedTops.forEach((top, ti) => {
      pushTag(top, ti, null);
      childrenOf(top.id).forEach((child, ci) => pushTag(child, ci, top.id));
    });
    const prev: TagUpdate[] = tags.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      colorKey: t.colorKey,
      sortOrder: t.sortOrder
    }));
    onTagsUpdated?.(updates); // 기존 태그 변경은 낙관적 반영(달력 색 즉시 갱신)
    startTransition(async () => {
      const result = await saveTagsAction({ updates, creates });
      if (result.ok) {
        // 새 태그는 진짜 id가 생긴 뒤 부모(달력)에 반영.
        for (const c of result.created) {
          onTagAdded?.(c.tag, c.color);
        }
        // 드래프트 정리 + 임시 id → 진짜 id로 치환(순서·드래프트맵 동기화).
        if (result.created.length > 0) {
          setOrderIds((cur) =>
            cur.map((id) => result.created.find((c) => c.tempId === id)?.tag.id ?? id)
          );
          setDraft((cur) => {
            const next = { ...cur };
            for (const c of result.created) {
              delete next[c.tempId];
              next[c.tag.id] = {
                name: c.tag.displayName,
                colorKey: c.tag.colorKey,
                bgHex: c.tag.bgHex ?? null,
                parentId: c.tag.parentId,
                kind: c.tag.kind
              };
            }
            return next;
          });
        }
        setNewTags([]);
        setNewColors([]);
        flashSaved();
      } else {
        setError(result.error);
        onTagsUpdated?.(prev); // 실패 → 되돌림
      }
    });
  }

  // 한 태그 행(대분류=드래그+스와치, 세부=들여쓰기+상속색칩). 휴뱅은 잠금.
  function renderTagRow(tag: BroadcastTag, isSub: boolean) {
    const d = draft[tag.id];
    if (!d) return null;
    const locked = isLocked(tag.id);
    const parentColor = isSub
      ? colorOf((draft[d.parentId ?? ""]?.colorKey || "gray") as ColorKey)
      : null;
    return (
      <div
        className={`tag-editor-row ${draggingId === tag.id ? "dragging" : ""} ${
          isNew(tag.id) ? "is-new" : ""
        } ${locked ? "locked" : ""} ${isSub ? "is-sub" : ""} ${
          d.kind === "modifier" ? "is-mod-row" : ""
        }`}
        data-tagid={tag.id}
        key={tag.id}
      >
        {isSub ? (
          <span className="tag-sub-indent" aria-hidden="true" />
        ) : (
          <button
            aria-label={locked ? "휴뱅은 순서를 바꿀 수 없어요" : "순서 변경"}
            className="tag-drag-handle"
            disabled={locked}
            onPointerDown={locked ? undefined : (e) => onHandlePointerDown(e, tag.id)}
            title={locked ? "휴뱅은 순서를 바꿀 수 없는 기본 태그예요" : "끌어서 순서 변경"}
            type="button"
          >
            {locked ? (
              <Lock aria-hidden="true" size={15} />
            ) : (
              <GripVertical aria-hidden="true" size={16} />
            )}
          </button>
        )}
        <input
          aria-label={isSub ? "세부 이름" : "대분류 이름"}
          className={locked ? "locked" : undefined}
          onChange={
            locked
              ? undefined
              : (e) => setDraft((cur) => ({ ...cur, [tag.id]: { ...d, name: e.target.value } }))
          }
          readOnly={locked}
          title={locked ? "휴뱅은 이름을 바꿀 수 없어요" : undefined}
          value={d.name}
        />
        {isSub ? (
          // 세부는 부모 대분류 색을 상속 — 색 선택 없이 상속 색만 표시.
          <span
            className="tag-sub-color"
            style={{ background: parentColor?.bgColor, borderColor: parentColor?.borderColor }}
            title="부모 대분류 색을 따라가요"
          />
        ) : (
          <>
            {/* 콘텐츠/형식 라벨은 뺐다 — 섹션 제목이 이미 구분하므로 중복. 그 폭을 색 스와치에
                줘 좁은 2열 칸에서도 안 넘친다. kind 전환(콘텐츠↔형식)은 색 팝오버 안으로 옮겼다.
                색은 스와치 하나 — 누르면 팝오버 피커(영역+색조 슬라이더+프리셋+톤). */}
            {(() => {
              const curColor = d.bgHex ?? (d.colorKey ? colorOf(d.colorKey)?.bgColor ?? "#cccccc" : "#cccccc");
              return (
                <div className="tag-editor-color">
                  <button
                    aria-label="태그 색 바꾸기"
                    className={`tag-color-swatch${openPickerId === tag.id ? " open" : ""}`}
                    disabled={locked}
                    onClick={(e) => {
                      hapticTick();
                      setPickerAnchor(e.currentTarget.getBoundingClientRect());
                      setOpenPickerId((cur) => {
                        const opening = cur !== tag.id;
                        // 열 때의 bgHex를 기억 — 취소(바깥 클릭/Esc) 시 여기로 되돌린다.
                        if (opening) pickerInitialRef.current = d.bgHex ?? null;
                        return opening ? tag.id : null;
                      });
                    }}
                    style={{ background: curColor }}
                    title="색 바꾸기"
                    type="button"
                  />
                  {openPickerId === tag.id && !locked && pickerAnchor ? (
                    <ColorPickerPopover
                      anchor={pickerAnchor}
                      canClear={d.bgHex != null}
                      kind={d.kind}
                      onToggleKind={() => {
                        toggleKind(tag.id);
                        setOpenPickerId(null); // kind 바뀌면 다른 섹션으로 이동 → 팝오버 닫는다
                      }}
                      onChange={(hex) =>
                        setDraft((cur) => ({ ...cur, [tag.id]: { ...cur[tag.id], bgHex: hex } }))
                      }
                      onClear={() => {
                        setDraft((cur) => ({ ...cur, [tag.id]: { ...cur[tag.id], bgHex: null } }));
                        setOpenPickerId(null);
                      }}
                      onClose={() => setOpenPickerId(null)}
                      onCancel={() => {
                        // '완료' 안 누르고 닫음 → 열었을 때 색으로 되돌린다(미리보기 변경 폐기).
                        const init = pickerInitialRef.current;
                        setDraft((cur) => ({ ...cur, [tag.id]: { ...cur[tag.id], bgHex: init } }));
                        setOpenPickerId(null);
                      }}
                      value={curColor}
                    />
                  ) : null}
                </div>
              );
            })()}
          </>
        )}
        <button
          aria-label={locked ? "휴뱅은 삭제할 수 없어요" : `${d.name} 삭제`}
          className="tag-editor-remove"
          // 게이트는 좁게 — busy는 에디터 전체가 공유하는 transition이라, 어느 한 줄을 저장 중이면
          // 모든 행의 삭제가 죽었다(게다가 tooltip은 "이 태그 삭제"라고 계속 말했다).
          // 이중 삭제 방지는 deleteLock이 이미 한다.
          disabled={locked || deleteLock}
          onClick={() => removeTag(tag.id)}
          title={locked ? "휴뱅은 삭제할 수 없는 기본 태그예요" : "이 태그 삭제"}
          type="button"
        >
          {locked ? <Lock aria-hidden="true" size={15} /> : <Trash2 aria-hidden="true" size={15} />}
        </button>
      </div>
    );
  }

  return (
    <div className="tag-editor">
      <div className="tag-tips">
        <span className="tag-tip">
          <Palette aria-hidden="true" size={13} />
          <b>콘텐츠</b>는 칸을 채우는 색<span className="tip-web">·무늬(무슨 방송)</span>,{" "}
          <b>형식</b>은 그 위 작은 점<span className="tip-web">(어떻게)</span>
        </span>
        <span className="tag-tip">
          <GripVertical aria-hidden="true" size={13} />
          손잡이를 끌어 순서 변경 · 한 색은 한 태그만
        </span>
        <span className="tag-tip">
          <Save aria-hidden="true" size={13} />새 태그는 ‘전체 저장’을 눌러야 반영돼요
        </span>
        <span className="tag-tip warn">
          <AlertTriangle aria-hidden="true" size={13} />
          태그를 지우면 쌓인 통계가 흐트러져요<span className="tip-web">. 삭제보다 추가·이름 바꾸기를
          권해요</span>.
        </span>
      </div>
      {/* 콘텐츠끼리 / 방식끼리 묶어 한 눈에. 드래그 순서는 묶음 안에서 유지된다. */}
      {(() => {
        const contentTops = orderedTops.filter((t) => (draft[t.id]?.kind ?? t.kind) !== "modifier");
        const modifierTops = orderedTops.filter((t) => (draft[t.id]?.kind ?? t.kind) === "modifier");
        const section = (rows: BroadcastTag[]) =>
          rows.map((top) => (
            <div className="tag-cat-group" key={top.id}>
              {renderTagRow(top, false)}
            </div>
          ));
        return (
          <>
            <div className="tag-editor-section">
              <div className="tag-editor-section-head">
                <span className="tag-editor-section-name">콘텐츠</span>
                <span className="tag-editor-section-sub">셀 색·통계를 차지</span>
              </div>
              {section(contentTops)}
              <button
                className="tag-add-in-section"
                disabled={allTags.length >= MAX_TAGS}
                onClick={() => addTag("content")}
                type="button"
              >
                <Plus aria-hidden="true" size={15} /> 콘텐츠 추가
              </button>
            </div>
            <div className="tag-editor-section is-mod">
              <div className="tag-editor-section-head">
                <span className="tag-editor-section-name">형식</span>
                <span className="tag-editor-section-sub">콘텐츠에 얹는 표식 (합방·시참 등)</span>
              </div>
              {modifierTops.length > 0 ? (
                section(modifierTops)
              ) : (
                <p className="tag-editor-section-empty">아직 없어요. 아래에서 추가하세요.</p>
              )}
              <button
                className="tag-add-in-section mod"
                disabled={allTags.length >= MAX_TAGS}
                onClick={() => addTag("modifier")}
                type="button"
              >
                <Plus aria-hidden="true" size={15} /> 형식 추가
              </button>
            </div>
          </>
        );
      })()}

      {error ? <div className="auth-warning">{error}</div> : null}
      {anyEmpty ? <p className="tag-editor-hint warn">색상이 비어 있는 태그가 있습니다.</p> : null}
      <div className="tag-editor-actions">
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
