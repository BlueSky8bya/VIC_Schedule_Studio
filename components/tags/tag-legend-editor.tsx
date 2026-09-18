"use client";

import { AlertTriangle, GripVertical, HelpCircle, Lock, Palette, Plus, Save, Trash2 } from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import type { BroadcastTag, ColorKey, ColorPaletteEntry, TagKind } from "@/lib/domain/schedule-types";
import { reduceMotionEnabled } from "@/lib/ui/motion"; // OS reduce-motion 무시, 앱 토글만 존중
import type { SaveTagsResult, TagCreateInput } from "@/lib/schedules/tag-actions";
import { generateTagColor, isPatternColor } from "@/lib/tags/color-gen";
import {
  hexToHue,
  hueDist,
  inkContrast,
  spectrumColors,
  SPECTRUM_HUES
} from "@/lib/tags/color-tone";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { ColorPickerPopover } from "@/components/tags/color-picker-popover";
import { hapticTick } from "@/lib/ui/haptics";
import { edgeForPointer, reorderAtEdge, type ReorderEdge } from "@/lib/tags/reorder";

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
  // 저장 전 변경 여부를 부모(모달 소유자)에게 알림 — 닫기 경고 게이트용.
  onDirtyChange?: (dirty: boolean) => void;
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
  onDirtyChange,
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

  // 2026-09-18 대개편(소유자: "스크롤 올렸다 내렸다가 불편"): 콘텐츠/형식을 **세그먼트로 갈라** 한 번에 한 묶음만 보여 주고,
  // '추가'는 목록 위 고정 줄에 둔다(스크롤 없이 늘 손 닿는 자리). 도움말 4줄은 접어 두고 필요할 때만 편다.
  const [activeKind, setActiveKind] = useState<TagKind>("content");
  const [helpOpen, setHelpOpen] = useState(false);
  // 방금 추가한 행 — 잠깐 강조 링 + 이름칸 포커스(내가 무엇을 만들었는지 눈이 따라가게).
  const [flashId, setFlashId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  const draftOf = (t: BroadcastTag): Draft => ({
    name: t.displayName,
    colorKey: t.colorKey,
    bgHex: t.bgHex ?? null,
    parentId: t.parentId,
    kind: t.kind
  });
  const sameDraft = (a: Draft | undefined, b: Draft | undefined) =>
    !!a &&
    !!b &&
    a.name === b.name &&
    a.colorKey === b.colorKey &&
    (a.bgHex ?? null) === (b.bgHex ?? null) &&
    (a.parentId ?? null) === (b.parentId ?? null) &&
    a.kind === b.kind;

  // 최신 props를 비동기 콜백(저장 완료 후 재동기화)에서 읽기 위한 거울. (useState 업데이터가
  // 렌더 중 실행되므로 그보다 먼저 갱신해 둔다.)
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(tags.map((t) => [t.id, draftOf(t)]))
  );
  // 사용자가 '직접 손댄' 행 id. 손대지 않은 행은 부모 props(다른 사용자의 저장·router.refresh·
  // 내 다른 행 저장)가 바뀔 때마다 서버값으로 다시 맞춘다 — 예전엔 한 번 만든 드래프트를 끝까지
  // 들고 있어서 낡은 값이 다음 '전체 저장' 때 서버를 덮어썼다. 저장 성공 시 그 배치의 id는 해제.
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const markDirty = (id: string) => dirtyIdsRef.current.add(id);

  // 손대지 않은 행만 props로 재동기화. 편집 중(dirty)·저장 전 드래프트(new:) 항목은 유지.
  function syncDraftFromProps(cur: Record<string, Draft>, src: BroadcastTag[]) {
    const next: Record<string, Draft> = {};
    for (const t of src) {
      const mine = cur[t.id];
      next[t.id] = mine && dirtyIdsRef.current.has(t.id) ? mine : draftOf(t);
    }
    for (const id of Object.keys(cur)) {
      if (!next[id] && isNew(id)) next[id] = cur[id];
    }
    return next;
  }
  useEffect(() => {
    setDraft((cur) => syncDraftFromProps(cur, tags));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 드래그로 순서를 손댔는지. 손대지 않았으면 props 순서를 그대로 따른다(다른 사용자의 순서
  // 저장·refresh 반영). 손댔으면 기존 순서를 보존하고 새로 온 id만 뒤에 붙인다.
  const orderDirtyRef = useRef(false);
  function syncOrderFromProps(cur: string[], src: BroadcastTag[], drafts: BroadcastTag[]) {
    const ids = [...src, ...drafts]
      .filter(isTopTag)
      .map((t) => t.id)
      .filter((id): id is string => Boolean(id));
    if (!orderDirtyRef.current) return ids;
    const kept = cur.filter((id) => Boolean(id) && ids.includes(id));
    const added = ids.filter((id) => !kept.includes(id));
    return [...kept, ...added];
  }
  useEffect(() => {
    setOrderIds((cur) => syncOrderFromProps(cur, tags, newTags));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, newTags]);
  // 드래그 pointermove 핸들러는 pointerdown 시점에 등록돼 그 렌더의 allTags를 닫아 두므로,
  // 잠금 판정(휴뱅)은 항상 최신 목록을 보는 ref로 한다.
  const allTagsRef = useRef(allTags);
  allTagsRef.current = allTags;
  const lastDirtySentRef = useRef<boolean | null>(null);
  // 드래그 핸들러(등록 시점 클로저)용 최신값 미러 — 스냅샷·종류 판정이 항상 현재를 본다.
  const orderIdsRef = useRef<string[]>([]);
  orderIdsRef.current = orderIds;
  const draftRef = useRef<Record<string, Draft>>({});
  draftRef.current = draft;
  // 드래그 중 종류(콘텐츠/형식) 판정 — 저장 전 kind 토글(드래프트)까지 반영해 화면 분리와 일치.
  const kindOfNow = (id: string) => {
    const d = draftRef.current[id];
    if (d) return d.parentId ? "content" : d.kind;
    return allTagsRef.current.find((t) => t.id === id)?.kind ?? "content";
  };
  // 삭제·저장 서버 호출을 한 줄로 직렬화 — 저장이 삭제 중인 태그 행을 다시 써 넣거나, 삭제 응답이
  // 저장 뒤 도착해 순서가 꼬이지 않게. (UI 게이팅은 그대로 좁게 유지.)
  const opChainRef = useRef<Promise<void>>(Promise.resolve());
  function enqueueOp(fn: () => Promise<void>): Promise<void> {
    const p = opChainRef.current.then(fn, fn);
    opChainRef.current = p.catch(() => undefined);
    return p;
  }
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
  // 드래그 핸들러(등록 시점 클로저)용 — 최신 목록 기준 잠금 판정.
  const isLockedNow = (id: string) =>
    allTagsRef.current.find((t) => t.id === id)?.tagKey === "dayoff";

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
  // 유령은 포인터와 1:1로 붙는다 — 관성·회전·랜덤 흔들림은 정밀 조작(정렬)의 판정 지점과
  // 시각 객체를 갈라놓아 "내 손보다 목록이 먼저 튄다"는 감각을 만들었다(감사 P0). 제거.
  const lastPointerRef = useRef({ x: 0, y: 0 }); // 자동 스크롤 중 재판정용 마지막 포인터
  const lastDropRef = useRef<{ overId: string; edge: ReorderEdge } | null>(null);
  const dragStartOrderRef = useRef<{ order: string[]; dirty: boolean } | null>(null);
  const dragEndHandlersRef = useRef<{
    commit: () => void;
    cancel: () => void;
    key: (ev: KeyboardEvent) => void;
  } | null>(null);
  // 드래그 중 언마운트되면 떠다니던 ghost·리스너·애니메이션을 정리한다.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ghostRef.current?.remove();
      if (moveHandlerRef.current) {
        window.removeEventListener("pointermove", moveHandlerRef.current);
      }
      const h = dragEndHandlersRef.current;
      if (h) {
        window.removeEventListener("pointerup", h.commit);
        window.removeEventListener("pointercancel", h.cancel);
        window.removeEventListener("blur", h.cancel);
        document.removeEventListener("keydown", h.key, true);
      }
    };
  }, []);

  // edge(행의 위/아래 절반) 기반 재배열 — 기존 '앞에 넣기'만 있던 단방향 모델은 항목을
  // 맨 끝으로 못 내렸다(감사 P0). 휴뱅은 머리 고정: 그 앞 목적지는 고정 구간 뒤로 클램프.
  function applyDrop(cur: string[], from: string, overId: string, edge: ReorderEdge) {
    if (isLockedNow(from)) return cur;
    let leading = 0;
    for (const id of cur) {
      if (id === from) continue;
      if (isLockedNow(id)) leading += 1;
      else break;
    }
    const next = reorderAtEdge(cur, from, overId, edge, leading);
    if (next !== cur) orderDirtyRef.current = true;
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
  // 자동 스크롤 전용 프레임 루프. 스크롤로 포인터 아래 내용이 밀리므로 판정도 함께 갱신
  // — 마지막 행 아래(목록 끝)로도 스크롤하며 내릴 수 있다.
  function dragLoop() {
    const dir = scrollDirRef.current;
    const sc = scrollerRef.current;
    if (dir !== 0 && sc) {
      if (sc === window) window.scrollBy(0, 11 * dir);
      else (sc as HTMLElement).scrollTop += 11 * dir;
      updateDropTarget(lastPointerRef.current.x, lastPointerRef.current.y);
    }
    rafRef.current = requestAnimationFrame(dragLoop);
  }
  // 포인터 아래 행을 찾아 목적지(행+edge)를 갱신한다. 같은 목적지면 아무 일도 하지 않는다
  // (pointermove마다 렌더가 돌던 P1 해소 — reorderAtEdge의 같은-참조 반환과 이중 방어).
  function updateDropTarget(x: number, y: number) {
    const from = dragId.current;
    if (!from) return;
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const row = el?.closest("[data-tagid]") as HTMLElement | null;
    const overId = row?.getAttribute("data-tagid");
    if (!row || !overId || overId === from) return;
    // 콘텐츠↔형식 경계는 드래그로 못 넘는다 — 화면은 종류별로 갈라 그리므로 넘어가면
    // 아무 변화도 안 보이면서 전역 순서만 뒤틀렸다(감사 P1). 종류 변경은 색 팝오버의 토글로.
    if (kindOfNow(overId) !== kindOfNow(from)) return;
    const r = row.getBoundingClientRect();
    const prev = lastDropRef.current;
    const edge = edgeForPointer(y, r.top, r.height, prev?.overId === overId ? prev.edge : null);
    if (prev && prev.overId === overId && prev.edge === edge) return;
    lastDropRef.current = { overId, edge };
    setOrderIds((cur) => applyDrop(cur, from, overId, edge));
  }
  function onPointerMove(e: PointerEvent) {
    const ghost = ghostRef.current;
    if (!ghost) return;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    // 유령 = 포인터 1:1(들어올린 지점 오프셋 유지) — 판정 지점과 시각 객체가 일치한다.
    ghost.style.left = `${e.clientX - offsetRef.current.x}px`;
    ghost.style.top = `${e.clientY - offsetRef.current.y}px`;
    updateDropTarget(e.clientX, e.clientY);
    // 자동 스크롤 판정은 '스크롤러' 가장자리 기준 — 창 기준이면 모달이 화면 중앙에 떠 있을 때
    // 모달 바닥까지 끌어도 스크롤이 안 내려갔다(사용자 지적).
    const sc = scrollerRef.current;
    const edge =
      sc && sc !== window
        ? (sc as HTMLElement).getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };
    const margin = 72;
    scrollDirRef.current =
      e.clientY < edge.top + margin ? -1 : e.clientY > edge.bottom - margin ? 1 : 0;
  }
  // FLIP 활주(그림판 레이어 문법): 드래그 중 orderIds가 바뀌면 행들이 순간이동하는 대신
  // 이전 위치에서 새 위치로 미끄러진다. 매 렌더 후 각 행의 top을 기록해 두고, 순서가 바뀐
  // 렌더에서 (이전 top - 새 top)만큼 역변환을 걸었다가 다음 프레임에 풀어 전환시킨다.
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const rowTopsRef = useRef<Map<string, { x: number; y: number; h: number }>>(new Map());
  useLayoutEffect(() => {
    const root = editorRootRef.current;
    if (!root) return;
    const prev = rowTopsRef.current;
    const next = new Map<string, { x: number; y: number; h: number }>();
    const reduce = reduceMotionEnabled();
    root.querySelectorAll<HTMLElement>("[data-tagid]").forEach((el) => {
      const id = el.dataset.tagid;
      if (!id) return;
      const r = el.getBoundingClientRect();
      next.set(id, { x: r.left, y: r.top, h: r.height });
      if (!draggingId || reduce || id === draggingId) return;
      const old = prev.get(id);
      if (old === undefined) return;
      const dx = old.x - r.left;
      const dy = old.y - r.top;
      // 다열 그리드에서 열을 건너뛰거나(가로 이동) 멀리 감긴 행까지 활주시키면 온 화면이
      // 날아다닌다(사용자 지적) — 같은 열의 한두 칸(행 높이 2.5배 이내) 세로 이동만
      // 미끄러지고 나머지는 즉시 스냅.
      if (Math.abs(dx) > 1 || Math.abs(dy) < 1 || Math.abs(dy) > old.h * 2.5) {
        el.style.transition = "";
        el.style.transform = "";
        return;
      }
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.22s var(--ease, ease)";
        el.style.transform = "";
      });
    });
    rowTopsRef.current = next;
  });

  // 드롭(commit) 또는 취소 — 취소면 드래그 시작 시점 순서로 복구한다(Esc·pointercancel·
  // 창 포커스 상실). 등록한 리스너 4종을 어느 경로로 끝나든 전부 대칭 해제한다(감사 P2).
  function finishDrag(cancelled: boolean) {
    const h = dragEndHandlersRef.current;
    if (h) {
      window.removeEventListener("pointerup", h.commit);
      window.removeEventListener("pointercancel", h.cancel);
      window.removeEventListener("blur", h.cancel);
      document.removeEventListener("keydown", h.key, true);
      dragEndHandlersRef.current = null;
    }
    if (moveHandlerRef.current) {
      window.removeEventListener("pointermove", moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    scrollDirRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ghostRef.current?.remove();
    ghostRef.current = null;
    lastDropRef.current = null;
    if (cancelled) {
      const snap = dragStartOrderRef.current;
      if (snap) {
        setOrderIds(snap.order);
        orderDirtyRef.current = snap.dirty;
      }
    }
    dragStartOrderRef.current = null;
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
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    ghost.style.transformOrigin = "center";
    scrollerRef.current = findScroller(row);
    dragId.current = id;
    setDraggingId(id);
    scrollDirRef.current = 0;
    // 취소 복구용 스냅샷 — 드롭 전 미리보기 순서는 아직 진실이 아니다.
    dragStartOrderRef.current = { order: orderIdsRef.current.slice(), dirty: orderDirtyRef.current };
    lastDropRef.current = null;
    rafRef.current = requestAnimationFrame(dragLoop);
    moveHandlerRef.current = onPointerMove;
    const commit = () => finishDrag(false);
    const cancel = () => finishDrag(true);
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      // 모달 Esc-닫기(document 버블 단계)보다 먼저(capture) 먹는다 — 드래그 취소가 우선.
      ev.preventDefault();
      ev.stopPropagation();
      finishDrag(true);
    };
    dragEndHandlersRef.current = { commit, cancel, key };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", commit, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    window.addEventListener("blur", cancel, { once: true });
    document.addEventListener("keydown", key, true);
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
         data-act="tag-legend-filter">
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
           data-act="tag-legend-clear">
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
    // 새 태그 기본색 = 색 팝오버와 '같은 18색' 중 기존 태그와 색조 안 겹치는 것 하나(랜덤).
    // colorKey(gen.*) 배관은 그대로 두되, 그 팔레트 색만 스펙트럼 색으로 덮어써 '18색 중 하나'가
    // 되게 한다(bgHex=null이라 '커스텀' 아님 — '기본 색으로'와도 일관). 색조가 다 차면 그냥 랜덤.
    const spectrum = spectrumColors(kind === "modifier");
    const usedHues = allTags
      .filter((t) => (t.parentId ?? null) === null && (draft[t.id]?.kind ?? t.kind) === kind)
      .map((t) => {
        const d = draft[t.id];
        const hex = d?.bgHex ?? colorOf((d?.colorKey ?? t.colorKey) as ColorKey)?.bgColor;
        return hex ? hexToHue(hex) : null;
      })
      .filter((h): h is number => h != null);
    const idxs = SPECTRUM_HUES.map((_, i) => i);
    const freeIdxs = idxs.filter((i) => usedHues.every((u) => hueDist(SPECTRUM_HUES[i], u) >= 19));
    const pool = freeIdxs.length ? freeIdxs : idxs;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const bgHex = spectrum[pick];
    const color: ColorPaletteEntry = {
      ...gen,
      bgColor: bgHex,
      textColor: inkContrast(bgHex).ink,
      sortOrder: 0
    };
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
    // 추가한 종류의 묶음으로 옮겨 보여 주고, 새 행을 강조·포커스한다(추가했는데 안 보이면 '눌렸나?'가 된다).
    setActiveKind(kind);
    setFlashId(tempId);
    window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-tagid="${tempId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      el?.querySelector<HTMLInputElement>("input")?.select();
    }, 60);
    window.setTimeout(() => setFlashId((cur) => (cur === tempId ? null : cur)), 1400);
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
    // 되돌림용 색 — 팔레트에 없는 커스텀(bgHex) 태그도 항상 엔트리를 만들어 롤백이 빠지지 않게.
    // (예전엔 팔레트에 없으면 onTagAdded를 건너뛰어 서버엔 남고 화면에서만 사라진 채로 굳었다.)
    const color: ColorPaletteEntry | undefined = tag
      ? palette.find((c) => c.key === tag.colorKey) ??
        (() => {
          const hex = tag.bgHex ?? "#eeeeee";
          const entry: ColorPaletteEntry = {
            key: tag.colorKey,
            name: tag.displayName,
            bgColor: hex,
            textColor: inkContrast(hex).ink,
            borderColor: hex,
            sortOrder: 0
          };
          return entry;
        })()
      : undefined;
    setError(null);
    onTagRemoved?.(tagId); // 낙관적 제거
    startBusy(async () => {
      await enqueueOp(async () => {
        const result = await removeTagAction(tagId);
        if (result.ok) {
          dirtyIdsRef.current.delete(tagId);
        } else {
          setError(result.error);
          if (tag && color) onTagAdded?.(tag, color); // 실패 → 되돌림
        }
      });
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
    markDirty(tagId);
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
  // 부모(모달 닫기 게이트)에 dirty 통지 — 이 지점은 canEdit 조기 return 뒤라 훅을 못 쓴다.
  // 렌더 단계 직접 호출 + 변화 감지 ref: 콜백 계약은 'ref 대입만'(setState 금지)이라 안전.
  if (onDirtyChange && lastDirtySentRef.current !== dirty) {
    lastDirtySentRef.current = dirty;
    onDirtyChange(dirty);
  }
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
    // 되돌림 스냅샷 — updates와 같은 필드 집합(bgHex·parentId·kind 포함). 일부만 담으면 실패 후
    // 부모에 낙관적 값(색·부모·종류)이 그대로 남았다.
    const prev: TagUpdate[] = tags.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      colorKey: t.colorKey,
      bgHex: t.bgHex ?? null,
      sortOrder: t.sortOrder,
      parentId: t.parentId ?? null,
      kind: t.kind
    }));
    // 이번 배치에 실은 드래프트값·순서 스냅샷 — 저장 중 사용자가 더 손댄 행은 응답이 와도 덮지 않고
    // dirty로 남긴다(다음 저장에 실림). 손대지 않은 행만 서버값으로 재동기화한다.
    const submitted: Record<string, Draft> = {};
    for (const u of updates) if (draft[u.id]) submitted[u.id] = draft[u.id];
    for (const c of creates) if (draft[c.tempId]) submitted[c.tempId] = draft[c.tempId];
    const submittedOrder = orderIds.slice();
    onTagsUpdated?.(updates); // 기존 태그 변경은 낙관적 반영(달력 색 즉시 갱신)
    startTransition(async () => {
      await enqueueOp(async () => {
        const result = await saveTagsAction({ updates, creates });
        if (result.ok) {
          // 새 태그는 진짜 id가 생긴 뒤 부모(달력)에 반영.
          for (const c of result.created) {
            onTagAdded?.(c.tag, c.color);
          }
          const createdTempIds = new Set(result.created.map((c) => c.tempId));
          // 임시 id → 진짜 id 치환(순서·드래프트맵). 저장 중 편집된 드래프트는 새 id 밑으로 옮겨
          // 보존하고 dirty 표시, 그대로인 것만 서버값으로.
          setOrderIds((cur) => {
            const mapped = cur.map(
              (id) => result.created.find((c) => c.tempId === id)?.tag.id ?? id
            );
            const untouched = cur.every((id, i) => submittedOrder[i] === id);
            if (untouched) orderDirtyRef.current = false;
            return mapped;
          });
          setDraft((cur) => {
            const next = { ...cur };
            for (const c of result.created) {
              const mine = cur[c.tempId];
              delete next[c.tempId];
              const untouched = sameDraft(mine, submitted[c.tempId]);
              if (untouched || !mine) {
                next[c.tag.id] = draftOf(c.tag);
                dirtyIdsRef.current.delete(c.tag.id);
              } else {
                next[c.tag.id] = mine;
                dirtyIdsRef.current.add(c.tag.id);
              }
            }
            // 저장 중 더 손대지 않은 행은 dirty 해제 + 최신 props(있으면)로 재동기화. 아직 props에
            // 안 실린 행은 [tags] 효과가 도착 시점에 맞춘다.
            for (const u of updates) {
              if (!sameDraft(cur[u.id], submitted[u.id])) continue;
              dirtyIdsRef.current.delete(u.id);
              const latest = tagsRef.current.find((t) => t.id === u.id);
              if (latest) next[u.id] = draftOf(latest);
            }
            return next;
          });
          // 이번 배치에 실린 드래프트 태그만 정리 — 저장 중 추가된 드래프트는 남긴다(예전엔 전부
          // 비워 '✓ 저장됨' 뜨는 사이 방금 만든 행이 소리 없이 사라졌다). 색은 draft 정리 효과가 치운다.
          setNewTags((cur) => cur.filter((t) => !createdTempIds.has(t.id)));
          flashSaved();
        } else {
          setError(result.error);
          onTagsUpdated?.(prev); // 실패 → 되돌림
        }
      });
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
           data-act="tag-drag-handle">
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
              : (e) => {
                  markDirty(tag.id);
                  const name = e.target.value;
                  // 최신 cur 기준으로 병합 — 렌더 시점 d를 통째로 쓰면 저장 응답 등으로 그 사이 바뀐
                  // 다른 필드(색·종류)를 옛값으로 되돌린다.
                  setDraft((cur) => ({ ...cur, [tag.id]: { ...(cur[tag.id] ?? d), name } }));
                }
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
                   data-act="태그 색 바꾸기" />
                  {openPickerId === tag.id && !locked && pickerAnchor ? (
                    <ColorPickerPopover
                      anchor={pickerAnchor}
                      canClear={d.bgHex != null}
                      kind={d.kind}
                      onToggleKind={() => {
                        toggleKind(tag.id);
                        setOpenPickerId(null); // kind 바뀌면 다른 섹션으로 이동 → 팝오버 닫는다
                      }}
                      onChange={(hex) => {
                        markDirty(tag.id);
                        setDraft((cur) => ({ ...cur, [tag.id]: { ...cur[tag.id], bgHex: hex } }));
                      }}
                      onClear={() => {
                        markDirty(tag.id);
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
         data-act="tag-editor-remove">
          {locked ? <Lock aria-hidden="true" size={15} /> : <Trash2 aria-hidden="true" size={15} />}
        </button>
      </div>
    );
  }

  const contentTops = orderedTops.filter((t) => (draft[t.id]?.kind ?? t.kind) !== "modifier");
  const modifierTops = orderedTops.filter((t) => (draft[t.id]?.kind ?? t.kind) === "modifier");
  const shown = activeKind === "modifier" ? modifierTops : contentTops;

  return (
    <div className="tag-editor tge" data-kind={activeKind} ref={editorRootRef}>
      {/* 고정 머리줄 — 세그먼트(콘텐츠/형식 + 개수) · 추가 · 도움말. 목록이 아무리 길어도 이 줄은 안 움직인다. */}
      <div className="tge-top">
        <div aria-label="태그 종류" className="tge-seg" role="tablist">
          <span aria-hidden="true" className="tge-seg-thumb" />
          {(["content", "modifier"] as const).map((k) => (
            <button
              aria-selected={activeKind === k}
              className={`tge-seg-btn${activeKind === k ? " is-on" : ""}`}
              data-act={k === "content" ? "tag-seg-content" : "tag-seg-modifier"}
              key={k}
              onClick={() => {
                if (activeKind === k) return;
                hapticTick();
                setActiveKind(k);
                setOpenPickerId(null);
              }}
              role="tab"
              type="button"
            >
              {k === "content" ? "콘텐츠" : "형식"}
              <em className="tge-seg-n">{k === "content" ? contentTops.length : modifierTops.length}</em>
            </button>
          ))}
        </div>
        <div className="tge-top-right">
          <button
            className="tge-add"
            data-act="tag-add-in-section"
            disabled={allTags.length >= MAX_TAGS}
            onClick={() => addTag(activeKind)}
            title={activeKind === "content" ? "콘텐츠 태그 추가" : "형식 태그 추가"}
            type="button"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={2.6} />
            추가
          </button>
          <button
            aria-expanded={helpOpen}
            aria-label="도움말"
            className={`tge-help${helpOpen ? " is-on" : ""}`}
            data-act="tag-help-toggle"
            onClick={() => {
              hapticTick();
              setHelpOpen((v) => !v);
            }}
            type="button"
          >
            <HelpCircle aria-hidden="true" size={16} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* 한 줄 설명 — 지금 보고 있는 묶음이 화면에서 무엇이 되는지. */}
      <p className="tge-lede">
        {activeKind === "content"
          ? "칸을 채우는 색 — 무슨 방송인지"
          : "콘텐츠 위에 얹는 작은 점 — 합방·시참처럼 '어떻게'"}
      </p>

      {helpOpen ? (
        <div className="tge-help-panel" role="note">
          <span className="tag-tip">
            <Palette aria-hidden="true" size={13} />
            <span className="tag-tip-text">
              <b>콘텐츠</b>는 칸을 채우는 색, <b>형식</b>은 그 위 작은 점
            </span>
          </span>
          <span className="tag-tip">
            <GripVertical aria-hidden="true" size={13} />
            <span className="tag-tip-text">손잡이를 끌어 순서 변경 · 한 색은 한 태그만</span>
          </span>
          <span className="tag-tip">
            <Save aria-hidden="true" size={13} />
            <span className="tag-tip-text">새 태그는 ‘전체 저장’을 눌러야 반영돼요</span>
          </span>
          <span className="tag-tip warn">
            <AlertTriangle aria-hidden="true" size={13} />
            <span className="tag-tip-text">태그를 지우면 쌓인 통계가 흐트러져요 — 삭제보다 이름 바꾸기</span>
          </span>
        </div>
      ) : null}

      <div className="tag-editor-scroll">
        <div className="tge-list" key={activeKind} ref={listRef}>
          {shown.length > 0 ? (
            shown.map((top, i) => (
              <div
                className={`tag-cat-group${flashId === top.id ? " is-flash" : ""}`}
                key={top.id}
                style={{ "--i": Math.min(i, 14) } as CSSProperties}
              >
                {renderTagRow(top, false)}
              </div>
            ))
          ) : (
            <p className="tge-empty">
              {activeKind === "content" ? "콘텐츠 태그가 없어요." : "형식 태그가 없어요."} 위 <b>추가</b>를 눌러 만드세요.
            </p>
          )}
        </div>

        {error ? <div className="auth-warning">{error}</div> : null}
        {anyEmpty ? <p className="tag-editor-hint warn">색상이 비어 있는 태그가 있습니다.</p> : null}
      </div>
      <div className="tag-editor-actions">
        <button
          className={`button primary ${saved && !dirty ? "saved" : ""}`}
          data-act="tag-editor-save"
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
