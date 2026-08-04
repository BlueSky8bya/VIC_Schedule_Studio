"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { recordActivity } from "@/lib/activity/record";
import type {
  EventCategory,
  EventStatus,
  EventVisibilityScope
} from "@/lib/domain/schedule-types";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { canEditEventTags, canEditSchedule, canEditSupport } from "@/lib/permissions/roles";
import {
  PRIVATE_PLACEHOLDER_TITLE,
  encryptSecret,
  type SecretPayload
} from "@/lib/private-layer/secret-crypto";
import { getUnlockState } from "@/lib/private-layer/unlock";
import { safeActionError } from "@/lib/utils/safe-action-error";
import {
  validateDateKey,
  validateSupportUrl,
  validateTagAssignment
} from "@/lib/schedules/event-validation";

export type SaveEventInput = {
  id?: string;
  dateKey: string;
  endDateKey?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  isTentative?: boolean;
  publicTitle: string;
  publicDescription: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
  isSupport?: boolean;
  supportUrl?: string;
  privateTitle?: string;
  privateMemo?: string;
  editorNote?: string;
  teaser?: boolean; // 떡밥(가림) 일정
  teaserRevealAt?: string | null; // 공개 시각(ISO). teaser일 때만 의미.
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const SLUG = "vic";
// (태그 상한 상수는 event-validation.ts로 이동 — 서버 검증과 한 곳에서 관리)

// 태그를 강제하지 않는다: 콘텐츠 대분류가 하나도 없어도(또는 방식만 있어도) 그대로 저장한다.
// 태그 없는 일정 = 색 없는 흰 카드. 예전엔 '기타' 태그를 자동 부착해 "이벤트당 콘텐츠 ≥1" 불변식을
// 지켰는데, 그 로직이 display_name==="기타" 리터럴에 묶여 있어 운영자가 그 태그를 지우면 조용히
// 죽었다. 이제 불변식 자체를 버린다 — '기타'는 태그가 아니라 인사이트의 합성 버킷(태그 0개인 공개
// 일정 카운트)으로만 존재한다.

// (diffDaysKey/addDaysKey 삭제 — 날짜 이동의 종료일 폭 계산은 0055 reorder_events_atomic가
//  DB 트랜잭션 안에서 date 연산으로 처리한다.)

// (moveEventAction 삭제 — 날짜만 옮기던 옛 액션. 지금은 아래 reorderEventsAction이 movedId로
//  '날짜 이동 + 같은 날 순서'를 한 번에 처리하고 편집실도 그것만 부른다. 호출자 0으로 확인.)

// 같은 날 안에서 일정 카드 순서 바꾸기(드래그). 다른 날에서 끌어온 경우 그 일정의 날짜도 함께
// 옮긴다. orderedIds 순서대로 sort_order를 0,1,2…로 부여한다(같은 날 표시 순서를 결정).
export async function reorderEventsAction(input: {
  dateKey: string;
  orderedIds: string[];
  movedId?: string; // 다른 날에서 이 날로 옮겨온 일정(있으면 date_key도 갱신)
}): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 옮길 수 있습니다." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) {
    return { ok: false, error: "날짜 형식이 올바르지 않습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  // P0-DATA-2: 날짜 이동 + 정렬을 DB 함수 한 트랜잭션으로(0055). 중간 실패 = 전체 롤백 —
  // "날짜는 옮겨졌는데 순서는 옛것" 같은 반쪽 상태가 생기지 않는다.
  const { error: reorderErr } = await supabase.rpc("reorder_events_atomic", {
    p_date_key: input.dateKey,
    p_ordered_ids: input.orderedIds,
    p_moved_id: input.movedId ?? null
  });
  if (reorderErr) {
    return { ok: false, error: safeActionError("일정 이동/순서 저장", reorderErr) };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  // 다른 날에서 끌어온 것(movedId)과 같은 날 안 순서 바꾸기는 의미가 달라 kind를 나눈다.
  await recordActivity({
    kind: input.movedId ? "event.move" : "event.reorder",
    target: input.movedId ?? input.dateKey,
    actor,
    meta: { date: input.dateKey, count: input.orderedIds.length }
  });
  return { ok: true, id: input.movedId ?? input.orderedIds[0] ?? "" };
}

export async function saveEventAction(input: SaveEventInput): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 편집할 수 있습니다." };
  }

  // "엠바고"(owner_private, 옛 embargo 포함)는 소유자 전용 — 개발자도 만들 수 없다.
  if (
    (input.visibilityScope === "owner_private" || input.visibilityScope === "embargo") &&
    actor.role !== "owner"
  ) {
    return { ok: false, error: "엠바고 일정은 소유자만 만들 수 있습니다." };
  }
  // P0-SEC-1(fail-closed, 서버 2차 방어): 비공개 범위 저장은 유효한 비공개 잠금 해제 세션이
  // 있어야 한다(CLAUDE 규칙 5 — 비공개 접근 = 로그인 + 패스코드). 클라이언트 게이트가
  // 우회돼도(직접 API 호출 등) 여기서 막힌다. 소유자·개발자도 예외 없음.
  if (input.visibilityScope !== "public") {
    const unlock = await getUnlockState(SLUG);
    if (!unlock.hasUnlockSession) {
      return {
        ok: false,
        error: "비공개 범위 일정은 비공개 레이어 잠금 해제 후에만 저장할 수 있습니다."
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();

  if (!calendar) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }

  // P0-AUTH-1: 입력 검증 — 날짜 형식·업 도움 링크(https만)·태그 payload(개수/중복/소속).
  for (const [key, label] of [
    [input.dateKey, "시작"],
    [input.endDateKey, "종료"]
  ] as const) {
    const v = validateDateKey(key, label);
    if (!v.ok) return { ok: false, error: v.error };
  }
  if (!input.dateKey) {
    return { ok: false, error: "시작 날짜가 필요합니다." };
  }
  if (input.isSupport) {
    const v = validateSupportUrl(input.supportUrl);
    if (!v.ok) return { ok: false, error: v.error };
  }
  const tagCheck = await validateTagAssignment(
    supabase,
    calendar.id,
    input.tagIds,
    input.primaryTagIds
  );
  if (!tagCheck.ok) return { ok: false, error: tagCheck.error };

  // 종료일이 시작일보다 뒤일 때만 멀티데이로 저장
  const endDateKey =
    input.endDateKey && input.endDateKey > input.dateKey ? input.endDateKey : null;

  const isPublic = input.visibilityScope === "public";

  // 비공개 이벤트는 제목/설명/private_meta를 암호화해 secret_cipher에 넣고, 평문 컬럼엔
  // 중립 플레이스홀더만 남긴다(raw DB 접근으로는 본문이 안 보이게). 공개는 평문 유지.
  // 키 미설정이면 encryptSecret가 throw → 절대 평문으로 저장되지 않도록 깔끔한 에러로 변환.
  const publicTitleTrim = input.publicTitle.trim() || "새 일정";
  const publicDescTrim = input.publicDescription.trim() || null;
  let secretCipher: string | null = null;
  if (!isPublic) {
    const payload: SecretPayload = {
      publicTitle: publicTitleTrim,
      publicDescription: publicDescTrim ?? undefined,
      privateTitle: input.privateTitle?.trim() || undefined,
      privateMemo: input.privateMemo?.trim() || undefined,
      editorNote: input.editorNote?.trim() || undefined
    };
    try {
      secretCipher = encryptSecret(payload, calendar.id);
    } catch {
      return { ok: false, error: "암호화 키 미설정으로 비공개 일정을 저장할 수 없습니다." };
    }
  }

  const row = {
    calendar_id: calendar.id,
    date_key: input.dateKey,
    end_date_key: endDateKey,
    start_time: input.isAllDay ? null : input.startTime || null,
    end_time: input.isAllDay ? null : input.endTime || null,
    is_all_day: input.isAllDay,
    is_tentative: input.isTentative ?? false,
    is_support: input.isSupport ?? false,
    support_url: input.isSupport ? input.supportUrl?.trim() || null : null,
    // 비공개는 평문 자리에 플레이스홀더, 공개는 실제 평문.
    public_title: isPublic ? publicTitleTrim : PRIVATE_PLACEHOLDER_TITLE,
    public_description: isPublic ? publicDescTrim : null,
    secret_cipher: secretCipher, // 공개면 null(비공개→공개 전환 시 블롭 제거)
    visibility_scope: input.visibilityScope,
    status: input.status,
    category: input.category,
    // 떡밥: 공개 일정만 의미(비공개는 어차피 안 보임). 공개 시각 없으면 떡밥 해제로 본다.
    teaser: Boolean(input.teaser) && Boolean(input.teaserRevealAt),
    teaser_reveal_at: input.teaser && input.teaserRevealAt ? input.teaserRevealAt : null,
    updated_at: new Date().toISOString()
  };

  // P0-DATA-2: 본문 + 태그 + 평문 메타를 DB 함수 한 트랜잭션으로(0055). 어느 단계가 실패해도
  // 전체 롤백 — "본문은 바뀌었는데 태그는 옛것" 같은 부분 커밋이 생기지 않는다.
  // 비공개 이벤트의 private_meta는 secret_cipher(블롭)에 이미 들어갔다 → 평문 메타는 null로
  // 보내 행을 남기지 않는다(기존 계약 유지).
  const hasPrivate =
    isPublic &&
    (Boolean(input.privateTitle?.trim()) ||
      Boolean(input.privateMemo?.trim()) ||
      Boolean(input.editorNote?.trim()));
  const { data: rpcId, error: rpcError } = await supabase.rpc("save_event_atomic", {
    p_event_id: input.id ?? null,
    p_row: row,
    p_tags: input.tagIds.map((tagId, index) => ({
      tag_id: tagId,
      is_primary: input.primaryTagIds.includes(tagId),
      sort_order: index
    })),
    p_meta: hasPrivate
      ? {
          private_title: input.privateTitle?.trim() || "",
          private_memo: input.privateMemo?.trim() || "",
          editor_note: input.editorNote?.trim() || ""
        }
      : null
  });
  if (rpcError || !rpcId) {
    return { ok: false, error: safeActionError("일정 저장", rpcError) };
  }
  const eventId = rpcId as string;

  // 행동 기록(0062) — 제목·본문은 절대 넣지 않는다(target=uuid, meta=구조 정보만).
  await recordActivity({
    kind: input.id ? "event.update" : "event.create",
    target: eventId,
    actor,
    meta: {
      scope: input.visibilityScope,
      date: input.dateKey,
      multiday: Boolean(endDateKey),
      tags: input.tagIds.length,
      teaser: Boolean(input.teaser),
      support: Boolean(input.isSupport)
    }
  });

  return { ok: true, id: eventId };
}

// 삭제 복구 보존 시간(ADR-0011 L5) — 이 시간 안에는 같은 id로 완전 복구 가능, 지나면 물리 삭제.
const TOMBSTONE_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 삭제할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  // P0-DATA-1: hard delete 대신 tombstone — 태그/연결/하트/비공개 메타가 FK 그대로 보존돼
  // '실행 취소'가 같은 id로 완전 복구된다. 24시간 지난 tombstone은 지나가며 물리 삭제(purge —
  // FK cascade로 관계 행도 함께). 낮은 트래픽이라 크론 없이 충분.
  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) {
    return { ok: false, error: safeActionError("일정 삭제", error) };
  }
  await supabase
    .from("events")
    .delete()
    .lt("deleted_at", new Date(Date.now() - TOMBSTONE_RETENTION_MS).toISOString());

  await recordActivity({ kind: "event.delete", target: eventId, actor });

  return { ok: true, id: eventId };
}

// P0-DATA-1: 삭제 복구 — tombstone을 걷어 같은 id로 되살린다(관계 전부 보존).
// 보존 시간(24h)이 지나 purge된 일정은 복구 불가(그때는 실패를 정직하게 알린다).
export async function restoreEventAction(eventId: string): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 복구할 수 있습니다." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }
  const { data, error } = await supabase
    .from("events")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: safeActionError("일정 복구", error) };
  }
  if (!data) {
    return { ok: false, error: "복구 기간(24시간)이 지났거나 이미 복구된 일정입니다." };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true, id: eventId };
}

// 최초 업 도움 "생성"은 소유자(owner)만 가능하지만, 이미 만들어진 업 도움의 "설정 수정"
// (기간·링크)은 신뢰 멤버(매니저·작업자)도 할 수 있게 한다.
// 보안: 대상이 실제 '업 도움(is_support)' 일정이고 vic 캘린더 소속일 때만, end_date_key·
// support_url 두 필드만 admin 클라이언트로 갱신한다(다른 일정/필드는 절대 못 건드림).
export async function updateSupportSettingsAction(
  eventId: string,
  input: { endDateKey?: string; supportUrl?: string }
): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);
  // 매니저(방송 운영)는 업 도움 기간/링크를 손볼 수 있지만, 작업자(worker)는 읽기 전용.
  if (!canEditSupport(actor.role)) {
    return { ok: false, error: "업 도움 정보를 수정할 권한이 없습니다." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: calendar } = await admin
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!calendar) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }

  const { data: ev } = await admin
    .from("events")
    .select("id, is_support, calendar_id")
    .is("deleted_at", null) // tombstone 제외(P0-DATA-1)
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.calendar_id !== calendar.id || !ev.is_support) {
    return { ok: false, error: "업 도움 일정이 아닙니다." };
  }

  // P0-AUTH-1: 날짜 형식 + 링크 스킴(https만) 검증 — 공개 포스터에서 시청자가 클릭하는 값.
  {
    const v = validateDateKey(input.endDateKey, "종료");
    if (!v.ok) return { ok: false, error: v.error };
    const u = validateSupportUrl(input.supportUrl);
    if (!u.ok) return { ok: false, error: u.error };
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.endDateKey !== undefined) {
    patch.end_date_key = input.endDateKey || null;
  }
  if (input.supportUrl !== undefined) {
    patch.support_url = input.supportUrl.trim() || null;
  }

  const { error } = await admin.from("events").update(patch).eq("id", eventId);
  if (error) {
    return { ok: false, error: safeActionError("업 도움 설정 저장", error) };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();

  // 어떤 필드를 건드렸는지만 남긴다 — 링크 원문(support_url)은 저장하지 않는다.
  await recordActivity({
    kind: "support.update",
    target: eventId,
    actor,
    meta: {
      period: input.endDateKey !== undefined,
      link: input.supportUrl !== undefined
    }
  });

  return { ok: true, id: eventId };
}

// 일정별 태그 "할당"만 바꾼다(매니저 허용). 일정 본문/태그 자체는 안 건드린다.
// 관리 클라이언트(서비스 롤)로 RLS를 우회하되, 앱 권한(canEditEventTags)과 캘린더 소속을
// 직접 검증해 매니저가 남의 캘린더/엉뚱한 이벤트를 못 건드리게 한다.
export async function updateEventTagsAction(
  eventId: string,
  tagIds: string[],
  primaryTagIds: string[]
): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditEventTags(actor.role)) {
    return { ok: false, error: "일정 태그를 편집할 권한이 없습니다." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: calendar } = await admin
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!calendar) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }

  const { data: ev } = await admin
    .from("events")
    .select("id, calendar_id, visibility_scope")
    .is("deleted_at", null)
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.calendar_id !== calendar.id) {
    return { ok: false, error: "일정을 찾을 수 없습니다." };
  }
  // P0-AUTH-1: 매니저는 비공개 접근이 0이므로 비공개 일정의 태그도 못 건드린다(ADR-0012).
  // 존재 여부를 구분해 알려주지 않는다 — 비공개 일정의 존재 자체가 정보다.
  if (actor.role === "manager" && ev.visibility_scope !== "public") {
    return { ok: false, error: "일정을 찾을 수 없습니다." };
  }
  // P0-AUTH-1: payload 검증(개수/중복/대표 부분집합/이 캘린더의 활성 태그) — 조용한 slice 대신 거부.
  const tagCheck = await validateTagAssignment(admin, calendar.id, tagIds, primaryTagIds);
  if (!tagCheck.ok) return { ok: false, error: tagCheck.error };

  // 태그 0개면 그대로 둔다(색 없는 흰 카드 — 강제 부착 없음).
  await admin.from("event_tags").delete().eq("event_id", eventId);
  if (tagIds.length > 0) {
    const rows = tagIds.map((tagId, index) => ({
      event_id: eventId,
      tag_id: tagId,
      is_primary: primaryTagIds.includes(tagId),
      sort_order: index
    }));
    const { error } = await admin.from("event_tags").insert(rows);
    if (error) {
      return { ok: false, error: safeActionError("태그 저장", error) };
    }
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();

  return { ok: true, id: eventId };
}
