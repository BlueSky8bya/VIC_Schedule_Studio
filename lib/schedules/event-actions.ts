"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import type {
  EventCategory,
  EventStatus,
  EventVisibilityScope
} from "@/lib/domain/schedule-types";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { canEditEventTags, canEditSchedule, canEditSupport } from "@/lib/permissions/roles";

export type SaveEventInput = {
  id?: string;
  dateKey: string;
  endDateKey?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
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
};

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const SLUG = "vic";

// 이벤트당 콘텐츠 태그 상한(피커와 동일). 방식(modifier)은 별도로 더 붙을 수 있다.
const MAX_EVENT_TAGS = 6;

// 모든 이벤트는 콘텐츠 대분류를 최소 1개 가진다 — 방식(합방·시참 등)만 있거나 태그가 없으면
// 자동으로 '기타'를 붙인다. 캘린더 태그 rows(kind 포함)를 받아, 붙일 '기타' id를 돌려준다
// (콘텐츠가 이미 있으면 null). client 어떤 저장 경로로 와도 서버 funnel에서 불변식 보장.
type TagKindRow = { id: string; display_name: string; kind: string | null; is_active: boolean };
function restTagIfNoContent(rows: TagKindRow[], tagIds: string[]): string | null {
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  // kind가 modifier가 아니면 콘텐츠로 본다(미지정/null도 콘텐츠 취급 — 안전).
  const hasContent = tagIds.some((id) => (byId.get(id)?.kind ?? "content") !== "modifier");
  if (hasContent) return null;
  const rest = rows.find(
    (r) => r.display_name === "기타" && r.is_active && (r.kind ?? "content") !== "modifier"
  );
  return rest?.id ?? null;
}

// 날짜키(YYYY-MM-DD) 사이의 일수 차 / 일수 더하기 — 드래그 이동 시 종료일을 같은 폭으로 옮긴다.
function diffDaysKey(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}
function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 일정 카드를 다른 날짜로 끌어 옮기기 — 시작일을 새 날짜로, 멀티데이면 종료일도 같은 폭으로.
// (전체 폼 저장과 별개의 가벼운 액션 — 드래그 한 번에 빠르게 반영.)
export async function moveEventAction(eventId: string, newDateKey: string): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 옮길 수 있습니다." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateKey)) {
    return { ok: false, error: "날짜 형식이 올바르지 않습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: ev } = await supabase
    .from("events")
    .select("id, date_key, end_date_key")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) {
    return { ok: false, error: "일정을 찾을 수 없습니다." };
  }
  if (ev.date_key === newDateKey) {
    return { ok: true, id: eventId };
  }

  const delta = diffDaysKey(ev.date_key as string, newDateKey);
  const newEnd =
    typeof ev.end_date_key === "string" ? addDaysKey(ev.end_date_key, delta) : null;

  const { error } = await supabase
    .from("events")
    .update({ date_key: newDateKey, end_date_key: newEnd, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true, id: eventId };
}

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

  // 다른 날에서 끌어온 일정이면 먼저 날짜를 옮긴다(단일일 카드만 드래그 가능 → 종료일 그대로).
  if (input.movedId) {
    const { data: ev } = await supabase
      .from("events")
      .select("date_key, end_date_key")
      .eq("id", input.movedId)
      .maybeSingle();
    if (ev && ev.date_key !== input.dateKey) {
      const delta = diffDaysKey(ev.date_key as string, input.dateKey);
      const newEnd =
        typeof ev.end_date_key === "string" ? addDaysKey(ev.end_date_key, delta) : null;
      const { error: moveErr } = await supabase
        .from("events")
        .update({ date_key: input.dateKey, end_date_key: newEnd })
        .eq("id", input.movedId);
      if (moveErr) {
        return { ok: false, error: moveErr.message };
      }
    }
  }

  // 새 순서대로 sort_order 부여(병렬).
  const now = new Date().toISOString();
  const results = await Promise.all(
    input.orderedIds.map((id, index) =>
      supabase.from("events").update({ sort_order: index, updated_at: now }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: failed.error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true, id: input.movedId ?? input.orderedIds[0] ?? "" };
}

export async function saveEventAction(input: SaveEventInput): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 편집할 수 있습니다." };
  }

  // owner_private("나만")는 소유자 전용 — 개발자도 만들 수 없다.
  if (input.visibilityScope === "owner_private" && actor.role !== "owner") {
    return { ok: false, error: "'나만' 일정은 소유자만 만들 수 있습니다." };
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

  // 종료일이 시작일보다 뒤일 때만 멀티데이로 저장
  const endDateKey =
    input.endDateKey && input.endDateKey > input.dateKey ? input.endDateKey : null;

  const row = {
    calendar_id: calendar.id,
    date_key: input.dateKey,
    end_date_key: endDateKey,
    start_time: input.isAllDay ? null : input.startTime || null,
    end_time: input.isAllDay ? null : input.endTime || null,
    is_all_day: input.isAllDay,
    is_support: input.isSupport ?? false,
    support_url: input.isSupport ? input.supportUrl?.trim() || null : null,
    public_title: input.publicTitle.trim() || "새 일정",
    public_description: input.publicDescription.trim() || null,
    visibility_scope: input.visibilityScope,
    status: input.status,
    category: input.category,
    updated_at: new Date().toISOString()
  };

  let eventId = input.id;

  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "일정 생성 실패" };
    }
    eventId = data.id;
  }

  if (!eventId) {
    return { ok: false, error: "이벤트 ID를 확정할 수 없습니다." };
  }

  // 태그 재설정: 기존 삭제 후 재삽입. 콘텐츠 대분류 0개면 '기타' 자동 부착(무조건 1개 보장).
  await supabase.from("event_tags").delete().eq("event_id", eventId);

  const { data: kindRows } = await supabase
    .from("broadcast_tags")
    .select("id, display_name, kind, is_active")
    .eq("calendar_id", calendar.id);
  const restId = restTagIfNoContent((kindRows ?? []) as TagKindRow[], input.tagIds);
  const finalTagIds = restId ? [...input.tagIds, restId] : input.tagIds;
  if (finalTagIds.length > 0) {
    const tagRows = finalTagIds.map((tagId, index) => ({
      event_id: eventId,
      tag_id: tagId,
      is_primary: input.primaryTagIds.includes(tagId),
      sort_order: index
    }));
    const { error: tagError } = await supabase.from("event_tags").insert(tagRows);
    if (tagError) {
      return { ok: false, error: tagError.message };
    }
  }

  // 비공개 메타: 내용이 있으면 upsert, 없으면 정리
  const hasPrivate =
    Boolean(input.privateTitle?.trim()) ||
    Boolean(input.privateMemo?.trim()) ||
    Boolean(input.editorNote?.trim());

  if (hasPrivate) {
    const { error: metaError } = await supabase.from("event_private_meta").upsert(
      {
        event_id: eventId,
        private_title: input.privateTitle?.trim() || null,
        private_memo: input.privateMemo?.trim() || null,
        editor_note: input.editorNote?.trim() || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "event_id" }
    );
    if (metaError) {
      return { ok: false, error: metaError.message };
    }
  } else {
    await supabase.from("event_private_meta").delete().eq("event_id", eventId);
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();

  return { ok: true, id: eventId };
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 삭제할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  // event_tags / event_private_meta는 FK on delete cascade로 함께 삭제됨
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) {
    return { ok: false, error: error.message };
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
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.calendar_id !== calendar.id || !ev.is_support) {
    return { ok: false, error: "업 도움 일정이 아닙니다." };
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
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();

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
    .select("id, calendar_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.calendar_id !== calendar.id) {
    return { ok: false, error: "일정을 찾을 수 없습니다." };
  }

  // 콘텐츠 태그는 피커와 동일하게 최대 6개. 콘텐츠 대분류 0개면 '기타' 자동 부착(무조건 1개 보장).
  const { data: kindRows } = await admin
    .from("broadcast_tags")
    .select("id, display_name, kind, is_active")
    .eq("calendar_id", calendar.id);
  const restId = restTagIfNoContent((kindRows ?? []) as TagKindRow[], tagIds);
  const limited = restId ? [...tagIds.slice(0, MAX_EVENT_TAGS - 1), restId] : tagIds.slice(0, MAX_EVENT_TAGS);
  await admin.from("event_tags").delete().eq("event_id", eventId);
  if (limited.length > 0) {
    const rows = limited.map((tagId, index) => ({
      event_id: eventId,
      tag_id: tagId,
      is_primary: primaryTagIds.includes(tagId),
      sort_order: index
    }));
    const { error } = await admin.from("event_tags").insert(rows);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();

  return { ok: true, id: eventId };
}
