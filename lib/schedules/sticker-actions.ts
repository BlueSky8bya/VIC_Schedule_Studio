"use server";

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

// SaveStickerInput → sticker_instances 행. 단건/배치 저장이 동일 규칙을 쓰도록 한 곳에 모은다.
function toStickerRow(input: SaveStickerInput, calendarId: string) {
  const emoji = (input.emoji ?? "").trim();
  const assetId = input.assetId ?? null;
  const text = (input.text ?? "").trim();
  return {
    calendar_id: calendarId,
    asset_id: text ? null : assetId,
    emoji: assetId || text ? null : emoji,
    text_content: text || null,
    text_color: text ? (input.textColor ?? "#1f2937") : null,
    font_weight: text ? (input.fontWeight ?? 700) : null,
    font_family: text ? (input.fontFamily ?? "sans") : null,
    text_align: text ? (input.textAlign ?? "left") : null,
    text_bg: text ? input.textBg || null : null,
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

  const row = toStickerRow(input, calendar.id);

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

  // 공개 데이터 캐시만 무효화한다(시청자는 다음 로드 때 최신 반영). 소유자 현재 화면은
  // 낙관적 로컬 상태로 이미 최신이라, revalidatePath로 라우트를 즉시 새로고침하지 않는다 —
  // 그 새로고침이 "편집실로 가기" 같은 이동과 경합해 한 번에 안 넘어가던 문제를 없앤다.
  revalidatePublicSchedule();

  return { ok: true, id: stickerId };
}

// 여러 스티커를 한 번에 저장/수정한다. 다중 동작(undo/redo 등)에서 매 스티커마다
// 권한확인·캘린더조회·캐시무효화를 반복하던 걸 1회로 묶는다. DB 왕복은 입력 수만큼이지만
// (insert는 새 id가 필요), 권한·조회·revalidate가 1회라 라이브 꾸미기 중 부하가 크게 준다.
// 반환 ids[i]는 inputs[i]에 대응하는 확정 id(기존 수정은 그대로, 신규 insert는 발급된 id) —
// 호출부가 임시 id를 새 id로 remap할 수 있게 한다.
export async function saveStickerBatchAction(
  inputs: SaveStickerInput[]
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  if (inputs.length === 0) {
    return { ok: true, ids: [] };
  }

  const actor = await resolveCurrentActor(SLUG);
  if (!canDecorate(actor.role)) {
    return { ok: false, error: "꾸미기 권한이 없습니다 (소유자·개발자·신뢰 멤버만 가능)." };
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

  const friendly = (error: { code?: string; message: string }) =>
    error.code === "23503" || /asset_id_fkey/.test(error.message)
      ? "삭제된 커스텀 이모지라 추가/되살릴 수 없어요. 새로고침 후 다시 시도해 주세요."
      : error.message;

  const ids: string[] = [];
  for (const input of inputs) {
    const row = toStickerRow(input, calendar.id);
    if (input.id) {
      const { error } = await supabase
        .from("sticker_instances")
        .update(row)
        .eq("id", input.id);
      if (error) {
        return { ok: false, error: friendly(error) };
      }
      ids.push(input.id);
    } else {
      const { data, error } = await supabase
        .from("sticker_instances")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) {
        return { ok: false, error: error ? friendly(error) : "스티커 생성 실패" };
      }
      ids.push(data.id);
    }
  }

  // 공개 데이터 캐시만 무효화한다(시청자는 다음 로드 때 최신 반영). 소유자 현재 화면은
  // 낙관적 로컬 상태로 이미 최신이라, revalidatePath로 라우트를 즉시 새로고침하지 않는다 —
  // 그 새로고침이 "편집실로 가기" 같은 이동과 경합해 한 번에 안 넘어가던 문제를 없앤다.
  revalidatePublicSchedule();

  return { ok: true, ids };
}

// 여러 스티커를 한 번에 삭제한다(다중 선택 삭제 등). .in()으로 단일 쿼리 + 무효화 1회.
export async function deleteStickerBatchAction(
  ids: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const realIds = ids.filter((id) => id && !id.startsWith("temp-"));
  if (realIds.length === 0) {
    return { ok: true };
  }

  const actor = await resolveCurrentActor(SLUG);
  if (!canDecorate(actor.role)) {
    return { ok: false, error: "꾸미기 권한이 없습니다 (소유자·개발자·신뢰 멤버만 가능)." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data, error } = await supabase
    .from("sticker_instances")
    .delete()
    .in("id", realIds)
    .select("id");
  if (error) {
    return { ok: false, error: error.message };
  }
  // RLS로 대상이 0행이면 에러 없이 "성공"하며 아무것도 안 지워진다(조용한 실패) → 명시적으로 잡는다.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "스티커가 삭제되지 않았습니다(권한 또는 대상 확인). 새로고침 후 다시 시도해 주세요."
    };
  }

  // 공개 데이터 캐시만 무효화한다(시청자는 다음 로드 때 최신 반영). 소유자 현재 화면은
  // 낙관적 로컬 상태로 이미 최신이라, revalidatePath로 라우트를 즉시 새로고침하지 않는다 —
  // 그 새로고침이 "편집실로 가기" 같은 이동과 경합해 한 번에 안 넘어가던 문제를 없앤다.
  revalidatePublicSchedule();

  return { ok: true };
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

  const { data, error } = await supabase
    .from("sticker_instances")
    .delete()
    .eq("id", stickerId)
    .select("id");
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "스티커가 삭제되지 않았습니다(권한 또는 대상 확인). 새로고침 후 다시 시도해 주세요."
    };
  }

  // 공개 데이터 캐시만 무효화한다(시청자는 다음 로드 때 최신 반영). 소유자 현재 화면은
  // 낙관적 로컬 상태로 이미 최신이라, revalidatePath로 라우트를 즉시 새로고침하지 않는다 —
  // 그 새로고침이 "편집실로 가기" 같은 이동과 경합해 한 번에 안 넘어가던 문제를 없앤다.
  revalidatePublicSchedule();

  return { ok: true, id: stickerId };
}
