"use server";

import { revalidatePath } from "next/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";

export type MemoResult = { ok: true } | { ok: false; error: string };

const SLUG = "vic";

// 시청자 화면 공개 메모를 소유자/개발자가 수정. (RLS "owners can manage calendars")
export async function updateMemoAction(memo: string): Promise<MemoResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 메모를 수정할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { error } = await supabase
    .from("calendars")
    .update({ public_memo: memo, updated_at: new Date().toISOString() })
    .eq("slug", SLUG);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  return { ok: true };
}
