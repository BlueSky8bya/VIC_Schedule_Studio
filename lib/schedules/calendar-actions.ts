"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { recordActivity } from "@/lib/activity/record";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { isPosterThemeKey } from "@/lib/domain/schedule-types";

// 캘린더 단위 쓰기(2026-09-03) — 지금은 포스터 테마 하나. 꾸미기 화면 철수(ADR-0015)로 테마 입구가
// 사라졌던 것을 역할 배지 팝오버의 셀렉트로 복원(물빛 테마 추가와 함께). 시청자 화면 배경이라
// **소유자만**: 클라이언트 가드는 표시용이고 여기서 다시 검사한다. 저장 후 공개 캐시 3줄 재검증 —
// 빠뜨리면 시청자 화면이 최대 5분 늦는다(memory: cache-revalidate-on-writes).
const SLUG = "vic";

export type CalendarActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function updatePosterThemeAction(theme: string): Promise<CalendarActionResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "owner") {
    return { ok: false, error: "포스터 테마는 관리자만 바꿀 수 있어요." };
  }
  if (!isPosterThemeKey(theme)) {
    return { ok: false, error: "없는 테마예요." };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }
  const { data: calendar, error } = await admin
    .from("calendars")
    .update({ poster_theme: theme })
    .eq("slug", SLUG)
    .select("id")
    .maybeSingle();
  if (error || !calendar) {
    return { ok: false, error: "포스터 테마를 저장하지 못했어요." };
  }
  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  await recordActivity({ kind: "theme.change", target: theme, actor });
  return { ok: true, id: String(calendar.id) };
}
