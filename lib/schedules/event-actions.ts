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
import { canEditSchedule } from "@/lib/permissions/roles";

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

  // 태그 재설정: 기존 삭제 후 재삽입
  await supabase.from("event_tags").delete().eq("event_id", eventId);

  if (input.tagIds.length > 0) {
    const tagRows = input.tagIds.map((tagId, index) => ({
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
