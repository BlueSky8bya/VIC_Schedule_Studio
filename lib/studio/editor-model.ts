// P2-ARCH-1 1단계: studio-shell.tsx의 '모듈 레벨 순수 코드'를 그대로 옮긴 파일(동작 변화 0).
// 편집 폼 모델·복사/실행취소 타입·날짜/드래프트/떡밥 헬퍼·라벨 상수·studio-write 클라이언트.
// 컴포넌트 상태에 묶인 로직(큐·히스토리 실행기)은 여기 두지 않는다(후속 단계에서 훅으로).

import { logActivity } from "@/lib/activity/client";
import type {
  EventCategory,
  EventStatus,
  EventVisibilityScope,
  MembershipRole,
  StudioScheduleEvent
} from "@/lib/domain/schedule-types";

export type EventForm = {
  id?: string;
  publicTitle: string;
  endDateKey: string;
  isSupport: boolean;
  supportKind: "up" | "period"; // 'period' = 단순 기간 안내(CTA 없음, 링크 선택)
  isTentative: boolean;
  supportUrl: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
  teaser: boolean; // 떡밥(가림)
  teaserRevealAt: string; // datetime-local 입력값(빈 문자열=미설정)
};

// #2: Ctrl+C로 복사해 둔 일정 내용(날짜·id 제외). 기간은 일수로 저장해 붙여넣는 날짜 기준으로 재계산.
export type CopiedEvent = {
  publicTitle: string;
  spanDays: number;
  isSupport: boolean;
  supportKind: "up" | "period";
  isTentative: boolean;
  supportUrl: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
  // 떡밥(최초공개) 가림도 복사에 따라간다 — 안 따라가면 붙여넣는 순간 가림이 벗겨져
  // 편집실 화면(방송 공유 중일 수 있음)에 내용이 노출된다.
  teaser: boolean;
  teaserRevealAt: string; // ISO(UTC). 빈 문자열=미설정. (저장 페이로드도 ISO를 받는다)
};

// 통합 실행취소(Ctrl+Z): 일반 편집기처럼 '액션 단위' LIFO 스택. 각 항목이 자기 역연산을 안다.
// - recreate: 삭제를 되돌림 → 보관한 내용으로 다시 만든다.
// - remove: 생성/붙여넣기를 되돌림 → 그때 만든 카드를 지운다. holder.id는 서버가 임시 id를 실제
//   id로 바꿔줄 때 함께 갱신돼, 되돌릴 때 항상 '그 카드'를 정확히 가리킨다.
// - move: 드래그로 옮긴 것을 되돌림 → 원래 날짜·원래 순서로 다시 옮긴다.
export type UndoAction =
  | { type: "recreate"; event: StudioScheduleEvent }
  | { type: "remove"; holder: { id: string } }
  | {
      type: "move";
      holder: { id: string };
      fromDate: string;
      toDate: string;
      /** 옮기기 전, 원래 날짜의 카드 순서(그 카드 포함) — 순서까지 그대로 되돌린다. */
      fromOrderedIds: string[];
    }
  // group: 한 번의 손동작이 여러 카드를 옮긴 것(띠·이어진 일정 묶음 드래그) — Ctrl+Z 한 번에 전부 되돌린다.
  | { type: "group"; actions: UndoAction[] };

// 실행취소 스택에서 '그 항목'을 뺀다 — 묶음(group) 안에 든 항목도 찾아 그 묶음에서 빼고(묶음 객체는 그대로 둬 다른 곳의 참조가
// 살아 있다), 빈 묶음은 스택에서 지운다. 맨 위(pop)가 아니라 항목을 찾아 빼는 이유는 그 사이 다른 작업이 쌓였을 수 있어서.
export function dropHistoryEntry(stack: UndoAction[], target: UndoAction): UndoAction[] {
  const idx = stack.lastIndexOf(target);
  if (idx >= 0) return [...stack.slice(0, idx), ...stack.slice(idx + 1)];
  for (const a of stack) {
    if (a.type !== "group") continue;
    const before = a.actions.length;
    a.actions = dropHistoryEntry(a.actions, target);
    if (a.actions.length !== before) return a.actions.length ? stack : stack.filter((x) => x !== a);
  }
  return stack;
}

// 두 YYYY-MM-DD 사이의 일수 차이(later - earlier).
export function daysBetweenIso(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86400000);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0")
  ].join("-");
}

// 묶음(이어진 일정·여러 날 한 장) 끌기의 기준 날짜 — **잡은 그 날**(2026-11-20 소유자: 20~22를 22일에서 잡아 23일에 놓으면
// 21~23이어야 한다. 예전엔 늘 첫날 기준이라 23~25가 됐다). 누른 칸이 묶음 범위 밖이면(테두리 걸침) 가까운 끝으로 붙인다.
// 이동 폭 = 놓은 날 − 이 날, 묶음 전체에 같은 폭.
export function spanDragAnchor(pressIso: string | null, start: string, end: string): string {
  if (!pressIso) return start;
  if (pressIso < start) return start;
  if (pressIso > end) return end;
  return pressIso;
}

// 묶음 끌기에서 손에 든 칩의 '어디를 쥐는가' — 칩 왼쪽 끝에서 잰 px.
// 칩은 제목 길이만큼만 길어서(짧으면 90px, 길어도 340px) 12일짜리 띠를 날짜 비율 그대로 옮기면 둘째 날을 잡아도 칩의 왼쪽
// 끝을 쥔 것처럼 보인다 — 그러면 "첫날을 들었다"고 읽히는데 옮겨지는 폭은 잡은 날(둘째 날) 기준이라, 보이는 것과 놓이는 자리가
// 어긋난다(2026-11-24 소유자). 그래서 칩을 세 구역으로 나눠 **보이는 자리가 곧 뜻**이 되게 한다:
//   왼쪽 끝 구역   = 첫날을 잡았을 때만   → 놓는 칸이 새 시작일
//   오른쪽 끝 구역 = 끝날을 잡았을 때만   → 놓는 칸이 새 종료일
//   가운데 구역    = 그 사이 날들, 순서대로 → 안쪽 어딘가를 잡았다(옮겨지는 폭은 꼬리표와 달력 표시가 말한다)
// 구역 폭은 비율이 아니라 **칩 폭에 맞춘 px**이다(소유자: 20~30% 사이에서 상황별 최적으로):
//   끝 구역 = 칩 폭의 22%, 단 16~28px — 긴 칩에서 22%(75px)까지 '끝'이라 하면 끝으로 안 보이고, 짧은 칩에서 너무 좁으면
//             첫날 칸 안에서 손을 옮겨도 칩이 안 따라온다. 맨 가장자리 6px은 비운다(커서가 칩 밖에 걸친 것처럼 보이지 않게).
//   틈      = 칩 폭의 10%, 단 14~24px — 끝 구역과 가운데 구역 사이. 이만큼 떨어져야 '끝을 쥠'과 '안쪽을 쥠'이 눈으로 갈린다.
//   가운데  = 남은 폭. 칩이 아주 짧아 남는 폭이 없으면 한가운데 한 점.
// 옮겨지는 폭의 규칙(놓은 날 − 잡은 날, spanDragAnchor)은 그대로다 — 바뀌는 것은 칩이 손에 붙는 자리뿐이라 집는 순간 날짜가 튀지 않는다.
// dayIndex = 잡은 날이 묶음에서 몇째 날인가(0부터), inCell = 그 칸 안에서의 가로 위치(0~1), chipWidth = 칩 폭(px).
const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const SPAN_GRAB_INSET = 6;
export function spanGrabZones(chipWidth: number) {
  const edge = Math.min(clampNum(chipWidth * 0.22, 16, 28), chipWidth / 2);
  const inner = Math.min(edge + clampNum(chipWidth * 0.1, 14, 24), chipWidth / 2);
  return { edge, inner };
}
export function spanGrabOffset(dayIndex: number, totalDays: number, inCell: number, chipWidth: number): number {
  const t = clampNum(inCell, 0, 1);
  if (totalDays <= 1) return t * chipWidth; // 하루짜리 — 잡은 그 자리
  const { edge, inner } = spanGrabZones(chipWidth);
  const inset = Math.min(SPAN_GRAB_INSET, edge);
  if (dayIndex <= 0) return inset + t * (edge - inset);
  if (dayIndex >= totalDays - 1) return chipWidth - inset - (1 - t) * (edge - inset);
  return inner + ((dayIndex - 1 + t) / (totalDays - 2)) * (chipWidth - 2 * inner);
}

// 시작~종료 포함 일수(같은 날=1).
export function spanDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}

// 업 도움 기간 표시 — "M월 D일 ~ M월 D일". 스텝퍼/슬라이더 공용.
// 예전엔 종료일 + 일수("8월 8일 · 6일간")만 보여줬는데, 정작 조절하는 대상이 '기간'이라
// 시작일이 안 보이면 지금 무엇을 늘리고 줄이는지 읽히지 않았다(사용자 지적).
export function formatSupportEnd(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return `${sm}월 ${sd}일 ~ ${em}월 ${ed}일`;
}

// YYYY-MM-DD → "M.D" (업 도움 기간 표시용 — 시청자 화면과 동일 형식)
export function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${Number(day)}`;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// YYYY-MM-DD → "M월 D일 (요일)" — 편집 팝오버 헤더용. 날짜 성분만 쓰므로 타임존 무관.
export function formatEditorDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}
// 2계층 태그: 일정 카드 하나에 달 수 있는 콘텐츠 태그 최대 수(카드 색은 대분류로 합쳐 ≤2 표시).
export const MAX_EVENT_TAGS = 6;

// 중대한 쓰기(일정 저장/삭제/이동/태그/업도움/잇기)를 keepalive로 보내는 단일 창구.
// keepalive: true 면 페이지를 떠나거나(달 이동·창 전환·닫기·새로고침) 전송이 끝까지 보장된다
// → "바꾸고 바로 나가면 저장 안 됨"을 구조적으로 없앤다. 결과는 기존 서버 액션과 같은 모양
// ({ok,id} / {ok,error})이라 호출부(임시 id 교체·롤백)를 그대로 쓸 수 있다.
/** A studio snapshot whose reads began before the latest committed write
 * cannot contain it: applying it would drop a just-created card or revert an
 * edit (2026-11-20 owner report). Snapshots without a stamp are trusted. */
export function isStaleStudioSnapshot(loadedAt: number | undefined, lastWriteAt: number): boolean {
  return typeof loadedAt === "number" && lastWriteAt > 0 && loadedAt <= lastWriteAt;
}

/** serverAt: server clock (ms) after the write finished; absent on network failure. */
export type StudioWriteResult = ({ ok: true; id?: string } | { ok: false; error: string }) & { serverAt?: number };
export async function postStudioWrite(op: string, payload: unknown): Promise<StudioWriteResult> {
  try {
    const res = await fetch("/api/studio-write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ op, payload })
    });
    const data = (await res.json().catch(() => null)) as StudioWriteResult | null;
    if (data && typeof (data as { ok?: unknown }).ok === "boolean") {
      if (!data.ok) logActivity("diag.savefail", { meta: { op, status: res.status } });
      return data;
    }
    logActivity("diag.savefail", { meta: { op, status: res.status } });
    return { ok: false, error: "저장에 실패했어요." };
  } catch {
    // status 0 = 요청이 서버에 닿지 못함(오프라인·취소)
    logActivity("diag.savefail", { meta: { op, status: 0 } });
    return { ok: false, error: "저장에 실패했어요." };
  }
}

// #3: 업 도움 기간 빠른 선택(종료일 = 시작일 + days)
export const SUPPORT_DURATIONS = [
  { days: 1, label: "2일" },
  { days: 2, label: "3일" },
  { days: 4, label: "5일" },
  { days: 6, label: "1주" },
  { days: 13, label: "2주" }
];

export const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "관리자",
  developer: "개발자",
  viewer: "시청자"
};

// A3: 역할 배지의 "?"를 누르면 뜨는 한 줄 책임 + 할 수 있는 것/없는 것. 빈 버튼으로 권한을
// 추론하게 두지 않는다. (매니저 철수 2026-09-04 ADR-0018 — '멤버' 항목도 뺐다.)
export const ROLE_DESC: Record<MembershipRole, { summary: string; can: string[] }> = {
  owner: {
    summary: "일정 발행과 전체 관리를 맡아요.",
    can: ["일정·태그·비밀번호 관리", "최초공개(떡밥) 일정 관리"]
  },
  developer: {
    summary: "시스템을 유지보수해요.",
    can: ["일정·태그 유지보수", "월별 인사이트·이용 기록"]
  },
  viewer: {
    summary: "공개 일정을 봐요.",
    can: ["일정 보기 · 하트 · 업 도움 링크"]
  }
};

// 색상 필터에 섞어 쓰는 특수 필터 id — '미정' 필터(2026-10-05 소유자) — 아직 확정 안 된(빗금) 일정만 골라본다.
export const TENTATIVE_FILTER = "__tentative__";

export function createEmptyForm(): EventForm {
  return {
    publicTitle: "",
    endDateKey: "",
    isSupport: false,
    supportKind: "up",
    isTentative: false,
    supportUrl: "",
    category: "stream",
    status: "scheduled",
    visibilityScope: "public",
    tagIds: [],
    primaryTagIds: [],
    teaser: false,
    teaserRevealAt: ""
  };
}

// ── 편집 카드 임시 보관(드래프트) ──────────────────────────────────────────
// 저장 버튼을 안 누른 채 카드가 닫혀도(실수로 바깥 클릭·슬라이드 아웃) 쓰던 내용을
// 잠깐 보관했다가, 같은 일정(또는 같은 날짜의 새 카드)을 다시 열면 되살린다(메모리 전용, P0-PRIV-1).
export const DRAFT_TTL_MS = 10 * 60 * 1000; // 10분 — "잠시" 자리 비운 사이만 복원, 그 뒤엔 폐기
export const DRAFT_LS_KEY = "vic-edit-draft-v1"; // 과거 버전 localStorage 잔재 물리 삭제용으로만 사용
export type EditDraft = { form: EventForm; ts: number };

// 폼의 '내용 지문' — id·날짜를 뺀 편집 가능한 필드만 모아 비교한다(원본 대비 변경 여부 판단).
export function draftFingerprint(f: EventForm): string {
  return [
    f.publicTitle,
    f.endDateKey,
    f.isSupport,
    f.supportKind,
    f.isTentative,
    f.supportUrl,
    f.category,
    f.status,
    f.visibilityScope,
    f.tagIds.join("|"),
    f.primaryTagIds.join("|"),
    f.teaser,
    f.teaserRevealAt
  ].join("");
}

// 기존 일정 → 폼 초깃값. selectEvent와 드래프트 폐기('새로 쓰기')가 공유한다.
export function eventToForm(event: StudioScheduleEvent): EventForm {
  return {
    id: event.id,
    publicTitle: event.publicTitle,
    endDateKey: event.endDateKey ?? "",
    isSupport: event.isSupport ?? false,
    supportKind: event.supportKind ?? "up",
    isTentative: event.isTentative ?? false,
    supportUrl: event.supportUrl ?? "",
    category: event.category,
    status: event.status,
    visibilityScope: event.visibilityScope,
    tagIds: event.tagIds,
    primaryTagIds: event.primaryTagIds,
    // 공개 시각이 지난 떡밥은 일반 일정 취급(토글 내림).
    teaser: teaserStillHidden(event),
    teaserRevealAt: teaserStillHidden(event) ? isoToKstLocalInput(event.teaserRevealAt) : ""
  };
}

// 떡밥 공개 시각 변환: DB(ISO UTC) ↔ datetime-local(KST 벽시계).
// datetime-local은 타임존이 없으니 입력값을 KST(+09:00)로 해석해 저장, 표시할 땐 +9h 한 벽시계로.
export function isoToKstLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const k = new Date(t + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}T${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
export function kstLocalInputToIso(local: string): string | null {
  if (!local) return null;
  const t = Date.parse(`${local}:00+09:00`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

// 아직 안 풀린(공개 시각이 미래인) 떡밥인가 — 지나면 일반 일정과 동일 취급.
export function teaserStillHidden(e: { teaser?: boolean; teaserRevealAt?: string }): boolean {
  return Boolean(e.teaser && e.teaserRevealAt && Date.parse(e.teaserRevealAt) > Date.now());
}

// 편집실 떡밥 배지 호버 문구 — 공개 예정/완료를 KST로 알려준다.
export function teaserBadgeTitle(iso: string | undefined): string {
  if (!iso) return "최초공개 일정 — 공개 시각 미설정";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "최초공개 일정";
  const k = new Date(t + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const when = `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
  return Date.now() >= t ? `🔮 최초공개 — 이미 공개됨 (${when})` : `🔮 최초공개 — ${when}에 공개 예정`;
}
