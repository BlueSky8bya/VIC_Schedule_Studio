"use server";

import { revalidatePath } from "next/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";
import { isPosterThemeKey } from "@/lib/domain/schedule-types";

export type ThemeResult = { ok: true } | { ok: false; error: string };

const SLUG = "vic";

// C9/C10: 포스터 테마 변경. 캘린더 설정이므로 소유자·개발자만 가능(신뢰 멤버는 꾸미기만).
export async function setPosterThemeAction(theme: string): Promise<ThemeResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "테마 변경 권한이 없습니다 (소유자·개발자만 가능)." };
  }
  if (!isPosterThemeKey(theme)) {
    return { ok: false, error: "알 수 없는 테마입니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { error } = await supabase
    .from("calendars")
    .update({ poster_theme: theme })
    .eq("slug", SLUG);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");

  return { ok: true };
}
