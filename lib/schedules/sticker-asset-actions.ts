"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canManageStickerAssets } from "@/lib/permissions/roles";
import { safeActionError } from "@/lib/utils/safe-action-error";

import type { StickerAsset, StickerAssetKind } from "@/lib/domain/schedule-types";
import { isStickerAssetKind } from "@/lib/domain/schedule-types";

// 업로드는 만들어진 에셋 전체(id·이름·URL·타입)를 돌려준다 — 새로고침 없이 "내 이모지"에 즉시 그릴 수 있게.
export type StickerAssetResult =
  | { ok: true; id: string; asset?: StickerAsset }
  | { ok: false; error: string };

// 정렬·분류처럼 특정 에셋 하나를 가리키지 않는(또는 돌려줄 게 없는) 작업의 결과.
export type StickerAssetOpResult = { ok: true } | { ok: false; error: string };

const SLUG = "vic";
const BUCKET = "sticker-assets";
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"]
]);

// 커스텀 이모지(이미지) 업로드 — 소유자·개발자·작업자(겸직 포함). 매니저는 꾸미기만(에셋 관리 불가).
export async function uploadStickerAssetAction(formData: FormData): Promise<StickerAssetResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canManageStickerAssets(actor.role, actor.isWorker === true)) {
    return { ok: false, error: "이모지 업로드 권한이 없습니다 (소유자·개발자·작업자만 가능)." };
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
    return { ok: false, error: safeActionError("이모지 업로드", uploadError) };
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const rawName = typeof file.name === "string" ? file.name.replace(/\.[^.]+$/, "") : "";
  const name = rawName.slice(0, 60) || "커스텀 이모지";
  // GIF만 확실히 '움직이는 이모티콘'. 애니메이션 WebP는 MIME이 정적 WebP와 같아 구분할 수 없으므로
  // 정적으로 넣고, 사용자가 팔레트에서 탭 위로 끌어다 옮긴다.
  const kind: StickerAssetKind = file.type === "image/gif" ? "anim" : "static";
  // 새 이모지는 항상 맨 앞(가장 작은 sort_order - 1). 0은 백필 마커라 쓰지 않는다.
  const { data: head } = await supabase
    .from("sticker_assets")
    .select("sort_order")
    .eq("calendar_id", calendar.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  const sortOrder = Math.min(Number(head?.sort_order ?? 1) - 1, -1);

  const { data, error } = await supabase
    .from("sticker_assets")
    .insert({
      calendar_id: calendar.id,
      name,
      file_url: publicUrl,
      file_type: file.type,
      kind,
      sort_order: sortOrder
    })
    .select("id")
    .single();

  if (error || !data) {
    // 행 생성 실패 시 업로드된 파일은 정리한다.
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: safeActionError("이모지 업로드", error) };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();
  return {
    ok: true,
    id: data.id,
    asset: {
      id: data.id,
      name,
      fileUrl: publicUrl,
      fileType: file.type,
      kind,
      sortOrder
    }
  };
}

// 팔레트 정렬 저장 — ids는 사용자가 드래그로 만든 전체 순서(앞이 0). 이 캘린더의 에셋만 갱신한다.
export async function reorderStickerAssetsAction(ids: string[]): Promise<StickerAssetOpResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canManageStickerAssets(actor.role, actor.isWorker === true)) {
    return { ok: false, error: "이모지 정렬 권한이 없습니다 (소유자·개발자·작업자만 가능)." };
  }
  const clean = ids.filter((id) => typeof id === "string" && id.length > 0).slice(0, 500);
  if (clean.length === 0) {
    return { ok: true };
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

  const results = await Promise.all(
    clean.map((id, index) =>
      supabase
        .from("sticker_assets")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("calendar_id", calendar.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: safeActionError("이모지 정렬 저장", failed.error) };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();
  return { ok: true };
}

// 분류 변경 — 아바타 / 이모티콘(정적) / 움직이는 이모티콘(동적).
export async function setStickerAssetKindAction(
  assetId: string,
  kind: StickerAssetKind
): Promise<StickerAssetOpResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canManageStickerAssets(actor.role, actor.isWorker === true)) {
    return { ok: false, error: "이모지 분류 권한이 없습니다 (소유자·개발자·작업자만 가능)." };
  }
  if (!isStickerAssetKind(kind)) {
    return { ok: false, error: "알 수 없는 분류입니다." };
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

  const { error } = await supabase
    .from("sticker_assets")
    .update({ kind })
    .eq("id", assetId)
    .eq("calendar_id", calendar.id);
  if (error) {
    return { ok: false, error: safeActionError("이모지 분류 저장", error) };
  }

  revalidatePath("/");
  revalidatePath("/studio/decorate", "layout");
  revalidatePublicSchedule();
  return { ok: true };
}

// 커스텀 이모지 삭제 — 소유자·개발자·작업자(겸직 포함)만(매니저 제외, 파괴적). 행을 지우면 이를 쓰는
// 스티커도 함께 삭제(on delete cascade)되므로 매니저에겐 막는다.
export async function deleteStickerAssetAction(assetId: string): Promise<StickerAssetResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canManageStickerAssets(actor.role, actor.isWorker === true)) {
    return { ok: false, error: "이모지 삭제 권한이 없습니다 (소유자·개발자·작업자만 가능)." };
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
    return { ok: false, error: safeActionError("이모지 삭제", error) };
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
