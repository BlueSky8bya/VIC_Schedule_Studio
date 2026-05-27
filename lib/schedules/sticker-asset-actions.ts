"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canDecorate } from "@/lib/permissions/roles";

import type { StickerAsset } from "@/lib/domain/schedule-types";

// 업로드는 만들어진 에셋 전체(id·이름·URL·타입)를 돌려준다 — 새로고침 없이 "내 이모지"에 즉시 그릴 수 있게.
export type StickerAssetResult =
  | { ok: true; id: string; asset?: StickerAsset }
  | { ok: false; error: string };

const SLUG = "vic";
const BUCKET = "sticker-assets";
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"]
]);

// 커스텀 이모지(이미지) 업로드 — 소유자·개발자·매니저·작업자.
export async function uploadStickerAssetAction(formData: FormData): Promise<StickerAssetResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canDecorate(actor.role)) {
    return { ok: false, error: "꾸미기 권한이 없습니다 (소유자·개발자·신뢰 멤버만 가능)." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "이미지 파일을 선택하세요." };
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return { ok: false, error: "PNG·WebP·GIF·JPG 이미지만 올릴 수 있습니다." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "이미지는 2MB 이하만 올릴 수 있습니다." };
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

  const path = `${SLUG}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { ok: false, error: `업로드 실패: ${uploadError.message}` };
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const rawName = typeof file.name === "string" ? file.name.replace(/\.[^.]+$/, "") : "";
  const name = rawName.slice(0, 60) || "커스텀 이모지";

  const { data, error } = await supabase
    .from("sticker_assets")
    .insert({
      calendar_id: calendar.id,
      name,
      file_url: publicUrl,
      file_type: file.type
    })
    .select("id")
    .single();

  if (error || !data) {
    // 행 생성 실패 시 업로드된 파일은 정리한다.
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error?.message ?? "에셋 생성 실패" };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();
  return {
    ok: true,
    id: data.id,
    asset: { id: data.id, name, fileUrl: publicUrl, fileType: file.type }
  };
}

// 커스텀 이모지 삭제 — 업로드 가능한 사람 모두. 행을 지우면 이를 쓰는 스티커도 함께 삭제(on delete cascade).
export async function deleteStickerAssetAction(assetId: string): Promise<StickerAssetResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canDecorate(actor.role)) {
    return { ok: false, error: "꾸미기 권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: asset } = await supabase
    .from("sticker_assets")
    .select("file_url")
    .eq("id", assetId)
    .maybeSingle();

  const { error } = await supabase.from("sticker_assets").delete().eq("id", assetId);
  if (error) {
    return { ok: false, error: error.message };
  }

  // 스토리지 객체도 정리 (public URL에서 버킷 뒤 경로를 추출).
  const marker = `/${BUCKET}/`;
  const url = asset?.file_url ?? "";
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const path = url.slice(idx + marker.length);
    await supabase.storage.from(BUCKET).remove([path]);
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();
  return { ok: true, id: assetId };
}
