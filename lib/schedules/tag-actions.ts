"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import type { BroadcastTag, ColorKey, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";

export type TagUpdateResult = { ok: true } | { ok: false; error: string };

// 새 태그(드래프트) 1건 — 색은 클라이언트에서 미리 생성해 함께 보낸다(저장 전엔 팝업에만 보임).
export type TagCreateInput = {
  tempId: string;
  displayName: string;
  colorKey: ColorKey;
  bgColor: string;
  textColor: string;
  borderColor: string;
  sortOrder: number;
};
// "전체 저장": 기존 태그 수정 + 새 태그 생성을 한 번에. 생성분은 진짜 id를 돌려줘 화면을 갱신한다.
export type SaveTagsResult =
  | { ok: true; created: { tempId: string; tag: BroadcastTag; color: ColorPaletteEntry }[] }
  | { ok: false; error: string };

const SLUG = "vic";

// owner/developer가 태그 이름·색상을 수정한다. (RLS "owners can manage tags"로 이중 보호)
export async function updateTagAction(
  tagId: string,
  displayName: string,
  colorKey: ColorKey
): Promise<TagUpdateResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 태그를 수정할 수 있습니다." };
  }

  const name = displayName.trim();
  if (!name) {
    return { ok: false, error: "태그 이름을 입력하세요." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  // 휴뱅(dayoff)은 시스템 기본 태그 — 이름·색 변경 금지.
  const { data: existing } = await supabase
    .from("broadcast_tags")
    .select("tag_key")
    .eq("id", tagId)
    .maybeSingle();
  if (existing?.tag_key === "dayoff") {
    return { ok: false, error: "휴뱅은 수정할 수 없는 기본 태그입니다." };
  }

  const { error } = await supabase
    .from("broadcast_tags")
    .update({ display_name: name, color_key: colorKey, updated_at: new Date().toISOString() })
    .eq("id", tagId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}

// #6/#4: "전체 저장" — 기존 태그 수정 + 새로 추가한 드래프트 태그 생성을 한 번에 처리한다.
// (새 태그는 저장 누르기 전까지 팝업 안에서만 보이고, 이 액션을 누를 때만 DB·달력에 반영된다.)
export async function saveTagsAction(input: {
  updates: { id: string; displayName: string; colorKey: ColorKey; sortOrder?: number }[];
  creates: TagCreateInput[];
}): Promise<SaveTagsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 태그를 저장할 수 있습니다." };
  }

  const { updates, creates } = input;

  // 이름·색 검증 — 수정·생성 모두.
  if ([...updates, ...creates].some((u) => !u.displayName.trim())) {
    return { ok: false, error: "모든 태그 이름을 입력하세요." };
  }
  if ([...updates, ...creates].some((u) => !u.colorKey)) {
    return { ok: false, error: "모든 태그에 색상을 지정하세요." };
  }
  // 색상 중복(한 색 = 한 태그) — 수정분 + 생성분을 합쳐서 본다.
  const allColors = [...updates.map((u) => u.colorKey), ...creates.map((c) => c.colorKey)];
  if (new Set(allColors).size !== allColors.length) {
    return { ok: false, error: "같은 색상을 두 태그에 쓸 수 없습니다." };
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

  // 새 태그가 있으면: 총 개수(최대 120 — 2계층 세부 포함) 확인 + 새 색 팔레트 등록.
  const created: { tempId: string; tag: BroadcastTag; color: ColorPaletteEntry }[] = [];
  if (creates.length > 0) {
    const { count: tagCount } = await supabase
      .from("broadcast_tags")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendar.id);
    if ((tagCount ?? 0) + creates.length > 120) {
      return { ok: false, error: "태그는 최대 120개까지만 만들 수 있습니다." };
    }

    // 새로 만든(gen-) 색 중 아직 팔레트에 없는 것만 등록한다.
    const { data: palette } = await supabase
      .from("color_palette")
      .select("key, sort_order")
      .eq("calendar_id", calendar.id);
    const existingKeys = new Set((palette ?? []).map((p) => p.key));
    let paletteSort = Math.max(0, ...(palette ?? []).map((p) => p.sort_order ?? 0));
    const paletteRows = creates
      .filter((c) => c.colorKey.startsWith("gen-") && !existingKeys.has(c.colorKey))
      .map((c) => ({
        calendar_id: calendar.id,
        key: c.colorKey,
        name: "새 색",
        bg_color: c.bgColor,
        text_color: c.textColor,
        border_color: c.borderColor,
        sort_order: ++paletteSort
      }));
    if (paletteRows.length > 0) {
      const { error: palErr } = await supabase.from("color_palette").insert(paletteRows);
      if (palErr) {
        return { ok: false, error: palErr.message };
      }
    }

    // 새 태그 행 삽입(요청 순서를 보존하려고 하나씩 — 보통 1~2개라 부담 없음).
    for (const c of creates) {
      const tagKey = `tag-${Math.random().toString(36).slice(2, 8)}`;
      const { data: inserted, error: tagErr } = await supabase
        .from("broadcast_tags")
        .insert({
          calendar_id: calendar.id,
          tag_key: tagKey,
          display_name: c.displayName.trim(),
          color_key: c.colorKey,
          sort_order: c.sortOrder,
          is_default: false,
          is_active: true
        })
        .select("id")
        .single();
      if (tagErr || !inserted) {
        return { ok: false, error: tagErr?.message ?? "태그 생성 실패" };
      }
      created.push({
        tempId: c.tempId,
        tag: {
          id: inserted.id,
          tagKey,
          displayName: c.displayName.trim(),
          colorKey: c.colorKey,
          sortOrder: c.sortOrder,
          isDefault: false,
          isActive: true,
          parentId: null
        },
        color: {
          key: c.colorKey,
          name: "새 색",
          bgColor: c.bgColor,
          textColor: c.textColor,
          borderColor: c.borderColor,
          sortOrder: paletteSort
        }
      });
    }
  }

  // 기존 태그 수정 — 독립적이라 병렬로(왕복 1회 수준).
  if (updates.length > 0) {
    // 휴뱅(dayoff)은 이름·색 변경 금지 — 수정 목록에 섞여 와도 잠근다(순서만 반영).
    const lockedIds = new Set<string>();
    const { data: lockedRows } = await supabase
      .from("broadcast_tags")
      .select("id")
      .eq("calendar_id", calendar.id)
      .eq("tag_key", "dayoff")
      .in(
        "id",
        updates.map((u) => u.id)
      );
    for (const r of lockedRows ?? []) lockedIds.add(r.id);

    const now = new Date().toISOString();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("broadcast_tags")
          .update(
            lockedIds.has(u.id)
              ? { ...(u.sortOrder === undefined ? {} : { sort_order: u.sortOrder }), updated_at: now }
              : {
                  display_name: u.displayName.trim(),
                  color_key: u.colorKey,
                  ...(u.sortOrder === undefined ? {} : { sort_order: u.sortOrder }),
                  updated_at: now
                }
          )
          .eq("id", u.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { ok: false, error: failed.error.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true, created };
}

// #6: 태그 삭제. 이 태그가 쓰던 생성 색(gen-)을 아무도 안 쓰면 팔레트에서도 정리한다.
// (event_tags는 FK on delete cascade로 함께 정리되어 일정은 태그만 빠진다.)
export async function removeTagAction(tagId: string): Promise<TagUpdateResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 태그를 삭제할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: tag } = await supabase
    .from("broadcast_tags")
    .select("id, calendar_id, color_key, tag_key")
    .eq("id", tagId)
    .maybeSingle();
  if (!tag) {
    return { ok: false, error: "태그를 찾을 수 없습니다." };
  }
  // 휴뱅(dayoff)은 시스템 기본 태그 — 삭제 금지(클라 잠금 우회 대비 서버 차단).
  if (tag.tag_key === "dayoff") {
    return { ok: false, error: "휴뱅은 삭제할 수 없는 기본 태그입니다." };
  }

  const { error } = await supabase.from("broadcast_tags").delete().eq("id", tagId);
  if (error) {
    return { ok: false, error: error.message };
  }

  // 생성 색이고 더 이상 쓰는 태그가 없으면 팔레트 항목도 삭제(스와치 정리).
  if (typeof tag.color_key === "string" && tag.color_key.startsWith("gen-")) {
    const { count } = await supabase
      .from("broadcast_tags")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", tag.calendar_id)
      .eq("color_key", tag.color_key);
    if (!count) {
      await supabase
        .from("color_palette")
        .delete()
        .eq("calendar_id", tag.calendar_id)
        .eq("key", tag.color_key);
    }
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}

// 여러 태그를 한 번에 저장. 색상 중복을 서버에서도 막는다.
export async function updateTagsAction(
  updates: { id: string; displayName: string; colorKey: ColorKey; sortOrder?: number }[]
): Promise<TagUpdateResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 태그를 수정할 수 있습니다." };
  }

  if (updates.some((u) => !u.displayName.trim())) {
    return { ok: false, error: "모든 태그 이름을 입력하세요." };
  }
  if (updates.some((u) => !u.colorKey)) {
    return { ok: false, error: "모든 태그에 색상을 지정하세요." };
  }
  const colors = updates.map((u) => u.colorKey);
  if (new Set(colors).size !== colors.length) {
    return { ok: false, error: "같은 색상을 두 태그에 쓸 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  // 휴뱅(dayoff)은 이름·색 변경 금지 — 수정 목록에 섞여 와도 잠근다(순서만 반영).
  const lockedIds = new Set<string>();
  const { data: lockedRows } = await supabase
    .from("broadcast_tags")
    .select("id")
    .eq("tag_key", "dayoff")
    .in(
      "id",
      updates.map((u) => u.id)
    );
  for (const r of lockedRows ?? []) lockedIds.add(r.id);

  // 태그를 하나씩 순차 update하면 왕복 지연이 누적돼 느리다(10개면 5초+).
  // 서로 독립적이라 한꺼번에 병렬로 보낸다 → 사실상 1회 왕복 시간으로 끝난다.
  const now = new Date().toISOString();
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("broadcast_tags")
        .update(
          lockedIds.has(u.id)
            ? { ...(u.sortOrder === undefined ? {} : { sort_order: u.sortOrder }), updated_at: now }
            : {
                display_name: u.displayName.trim(),
                color_key: u.colorKey,
                ...(u.sortOrder === undefined ? {} : { sort_order: u.sortOrder }),
                updated_at: now
              }
        )
        .eq("id", u.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: failed.error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}
