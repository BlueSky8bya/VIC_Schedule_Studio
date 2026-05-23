"use server";

import { revalidatePath } from "next/cache";
import type { ColorKey } from "@/lib/domain/schedule-types";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";

export type TagUpdateResult = { ok: true } | { ok: false; error: string };

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

  const { error } = await supabase
    .from("broadcast_tags")
    .update({ display_name: name, color_key: colorKey, updated_at: new Date().toISOString() })
    .eq("id", tagId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  return { ok: true };
}

// 여러 태그를 한 번에 저장. 색상 중복을 서버에서도 막는다.
export async function updateTagsAction(
  updates: { id: string; displayName: string; colorKey: ColorKey }[]
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

  for (const u of updates) {
    const { error } = await supabase
      .from("broadcast_tags")
      .update({
        display_name: u.displayName.trim(),
        color_key: u.colorKey,
        updated_at: new Date().toISOString()
      })
      .eq("id", u.id);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/studio");
  return { ok: true };
}
