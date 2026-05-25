"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";
import type { MemoLine } from "@/lib/domain/schedule-types";

export type MemoResult = { ok: true } | { ok: false; error: string };

const SLUG = "vic";

// B: 들어온 줄 데이터를 안전한 형태로 정리(텍스트 길이·정렬·들여쓰기 범위 제한).
function sanitizeMemoLines(lines: MemoLine[]): MemoLine[] {
  return lines.slice(0, 40).map((line) => ({
    text: String(line.text ?? "").slice(0, 200),
    align:
      line.align === "center" || line.align === "right" ? line.align : "left",
    indent: Math.min(4, Math.max(0, Math.round(Number(line.indent) || 0)))
  }));
}

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
  revalidatePublicSchedule();
  return { ok: true };
}

// B: 메모를 줄별(텍스트·가로 정렬·들여쓰기)로 저장. public_memo도 합친 텍스트로 함께 갱신해
//    폴백/스튜디오 미리보기와 어긋나지 않게 한다.
export async function updateMemoLinesAction(lines: MemoLine[]): Promise<MemoResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 메모를 수정할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const clean = sanitizeMemoLines(lines);
  const { error } = await supabase
    .from("calendars")
    .update({
      public_memo_lines: clean,
      public_memo: clean.map((line) => line.text).join("\n"),
      updated_at: new Date().toISOString()
    })
    .eq("slug", SLUG);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}

// #5: 메모 정렬(가로)·위치(세로)를 저장.
export async function setMemoLayoutAction(
  align: "left" | "center" | "right",
  valign: "top" | "center" | "bottom"
): Promise<MemoResult> {
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
    .update({
      public_memo_align: align,
      public_memo_valign: valign,
      updated_at: new Date().toISOString()
    })
    .eq("slug", SLUG);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}
