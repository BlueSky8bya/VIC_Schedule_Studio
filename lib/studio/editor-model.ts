// P2-ARCH-1 1단계: studio-shell.tsx의 '모듈 레벨 순수 코드'를 그대로 옮긴 파일(동작 변화 0).
// 편집 폼 모델·복사/실행취소 타입·날짜/드래프트/떡밥 헬퍼·라벨 상수·studio-write 클라이언트.
// 컴포넌트 상태에 묶인 로직(큐·히스토리 실행기)은 여기 두지 않는다(후속 단계에서 훅으로).

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
    };

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
export type StudioWriteResult = { ok: true; id?: string } | { ok: false; error: string };
export async function postStudioWrite(op: string, payload: unknown): Promise<StudioWriteResult> {
  try {
    const res = await fetch("/api/studio-write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ op, payload })
    });
    const data = (await res.json().catch(() => null)) as StudioWriteResult | null;
    if (data && typeof (data as { ok?: unknown }).ok === "boolean") return data;
    return { ok: false, error: "저장에 실패했어요." };
  } catch {
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
  manager: "매니저",
  viewer: "시청자"
};

// 비-owner(매니저·작업자) 읽기전용 상세에서 쓰는 평이한 공개 범위 라벨.
// "엠바고"(DB owner_private, 옛 '나만'·'엠바고' 통합)는 소유자 전용. work는 "작업자".
export const VISIBILITY_LABEL: Record<EventVisibilityScope, string> = {
  public: "모두",
  embargo: "엠바고",
  work: "작업자",
  owner_private: "엠바고"
};

// A3: 역할 배지의 "?"를 누르면 뜨는 한 줄 책임 + 할 수 있는 것/없는 것. 빈 버튼으로 권한을
// 추론하게 두지 않고, 특히 매니저·작업자가 자기 역할을 바로 이해하게 한다.
export const ROLE_DESC: Record<MembershipRole, { summary: string; can: string[] }> = {
  owner: {
    summary: "일정 발행과 전체 관리를 맡아요.",
    can: ["일정·태그·멤버·비밀번호 관리", "최초공개(떡밥) 일정 관리"]
  },
  developer: {
    summary: "시스템을 유지보수해요.",
    can: ["일정·태그·멤버 유지보수", "월별 인사이트·이용 기록"]
  },
  manager: {
    summary: "방송 운영을 도와요.",
    can: ["업 도움 기간·링크 수정", "이미 생성된 일정의 태그 수정"]
  },
  viewer: {
    summary: "공개 일정을 봐요.",
    can: ["일정 보기 · 하트 · 업 도움 링크"]
  }
};

export const SCOPE_LABEL: Record<EventVisibilityScope, string> = {
  public: "모두",
  embargo: "엠바고",
  work: "작업자",
  owner_private: "엠바고"
};

// 색상 필터에 섞어 쓰는 특수 필터 id — 태그가 아니라 "비공개(공개 아님) 일정"을 골라본다.
export const PRIVATE_FILTER = "__private__";

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
