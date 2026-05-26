"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canDecorate } from "@/lib/permissions/roles";

export type SaveStickerInput = {
  id?: string;
  year: number;
  month: number;
  emoji?: string; // 기본 이모지(텍스트). assetId/text가 있으면 비운다.
  assetId?: string; // 업로드한 커스텀 이모지(이미지) 참조
  text?: string; // C6: 텍스트 스티커 문구
  textColor?: string; // C6: 텍스트 스티커 글자색
  fontWeight?: number; // #7: 글꼴 굵기
  fontFamily?: string; // #7: 글꼴 종류 키
  textAlign?: "left" | "center" | "right"; // 텍스트 정렬
  textBg?: string; // 글자 배경(하이라이트) 색
  italic?: boolean; // 기울임
  outline?: boolean; // C7: 흰 외곽선
  shadow?: boolean; // C7: 진한 그림자
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  rotationDeg: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  zIndex: number;
};

export type StickerResult = { ok: true; id: string } | { ok: false; error: string };

const SLUG = "vic";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function saveStickerAction(input: SaveStickerInput): Promise<StickerResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canDecorate(actor.role)) {
    return { ok: false, error: "꾸미기 권한이 없습니다 (소유자·개발자·신뢰 멤버만 가능)." };
  }

  const emoji = (input.emoji ?? "").trim();
  const assetId = input.assetId ?? null;
  const text = (input.text ?? "").trim();
  // 이모지 / 커스텀 이모지(asset) / 텍스트 스티커 중 하나는 있어야 한다.
  if (!emoji && !assetId && !text) {
    return { ok: false, error: "이모지나 문구를 입력하세요." };
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

  const row = {
    calendar_id: calendar.id,
    asset_id: text ? null : assetId,
    emoji: assetId || text ? null : emoji,
    text_content: text || null,
    text_color: text ? (input.textColor ?? "#1f2937") : null,
    font_weight: text ? (input.fontWeight ?? 700) : null,
    font_family: text ? (input.fontFamily ?? "sans") : null,
    text_align: text ? (input.textAlign ?? "left") : null,
    text_bg: text ? (input.textBg || null) : null,
    italic: text ? (input.italic ?? false) : false,
    outline: input.outline ?? false,
    shadow: input.shadow ?? false,
    page_scope: "monthly",
    year: input.year,
    month: input.month,
    x_ratio: clamp(input.xRatio, 0, 1),
    y_ratio: clamp(input.yRatio, 0, 1),
    width_ratio: clamp(input.widthRatio, 0.008, 0.6),
    rotation_deg: input.rotationDeg,
    flip_x: input.flipX,
    flip_y: input.flipY,
    opacity: clamp(input.opacity, 0.1, 1),
    z_index: input.zIndex,
    is_visible: true,
    updated_at: new Date().toISOString()
  };

  // 삭제된 커스텀 이모지(에셋)를 가리키는 이미지 스티커를 저장하려 하면 FK 위반이 난다.
  // 날 Postgres 오류 대신 사용자가 이해할 수 있는 메시지로 바꾼다.
  const friendly = (error: { code?: string; message: string }) =>
    error.code === "23503" || /asset_id_fkey/.test(error.message)
      ? "삭제된 커스텀 이모지라 추가/되살릴 수 없어요. 새로고침 후 다시 시도해 주세요."
      : error.message;

  let stickerId = input.id;

  if (stickerId) {
    const { error } = await supabase
      .from("sticker_instances")
      .update(row)
      .eq("id", stickerId);
    if (error) {
      return { ok: false, error: friendly(error) };
    }
  } else {
    const { data, error } = await supabase
      .from("sticker_instances")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error ? friendly(error) : "스티커 생성 실패" };
    }
    stickerId = data.id;
  }

  if (!stickerId) {
    return { ok: false, error: "스티커 ID를 확정할 수 없습니다." };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();

  return { ok: true, id: stickerId };
}

export async function deleteStickerAction(stickerId: string): Promise<StickerResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canDecorate(actor.role)) {
    return { ok: false, error: "꾸미기 권한이 없습니다 (소유자·개발자·신뢰 멤버만 가능)." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { error } = await supabase.from("sticker_instances").delete().eq("id", stickerId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();

  return { ok: true, id: stickerId };
}
