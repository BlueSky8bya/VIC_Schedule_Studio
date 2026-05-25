"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import type { BroadcastTag, ColorKey, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";

export type TagUpdateResult = { ok: true } | { ok: false; error: string };
// 추가는 생성된 태그/색을 돌려줘, 화면을 새로고침 없이 낙관적으로 갱신하게 한다.
export type AddTagResult =
  | { ok: true; tag: BroadcastTag; color: ColorPaletteEntry }
  | { ok: false; error: string };

const SLUG = "vic";

// ── #6: 태그 추가용 색 생성(기존 색과 충분히 다른 연한 파스텔) ──────────────
// hex(#rrggbb) → HSL hue(0~360). 파싱 실패 시 null.
function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return (h + 360) % 360;
}

type Pat = "plain" | "diag" | "dots" | "grid";
// 색 key로 무늬 종류를 추정한다(생성색 gen-* 접두사 + 기본색 중 무늬 있는 것).
function patternOf(key: string): Pat {
  if (key.startsWith("gen-diag-")) return "diag";
  if (key.startsWith("gen-dots-")) return "dots";
  if (key.startsWith("gen-grid-")) return "grid";
  if (key === "indigo" || key === "mint") return "diag";
  if (key === "sky") return "dots";
  return "plain";
}
// 두 hue의 원형 거리(0~180).
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

// 새 색의 (hue, 무늬) 조합을 고른다. 핵심: "같은 무늬를 쓰는 기존 색"과 hue가 최대한 멀어지게 한다.
// → 색조가 비슷해도 무늬가 다르면 구분되고, 무늬가 같으면 색조를 멀리 띄운다(둘 다 비슷한 경우 회피).
// 아직 안 쓴 무늬(또는 그 무늬에서 hue가 텅 빈 쪽)를 우선 잡고, 동점이면 전체 색과도 멀게.
function pickColorSlot(existing: { hue: number; pat: Pat }[]): { hue: number; pat: Pat } {
  const pats: Pat[] = ["plain", "diag", "dots", "grid"];
  let best = { hue: Math.floor(Math.random() * 360), pat: "diag" as Pat, score: -1 };
  for (let h = 0; h < 360; h += 5) {
    for (const pat of pats) {
      let sameMin = Infinity; // 같은 무늬 색들과의 최소 hue 거리
      let allMin = Infinity; // 모든 색과의 최소 hue 거리(미적 분산용)
      for (const e of existing) {
        const hd = hueDist(h, e.hue);
        allMin = Math.min(allMin, hd);
        if (e.pat === pat) {
          sameMin = Math.min(sameMin, hd);
        }
      }
      // 같은 무늬와의 거리(주)를 크게, 전체 분산(부)을 작게 가중. 같은 무늬가 없으면 360으로 친다.
      const score =
        (sameMin === Infinity ? 360 : sameMin) * 2 + (allMin === Infinity ? 360 : allMin);
      if (score > best.score) {
        best = { hue: h, pat, score };
      }
    }
  }
  return { hue: best.hue, pat: best.pat };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

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
  revalidatePublicSchedule();
  return { ok: true };
}

// #6: 태그 추가 — 기존 색들과 hue가 가장 먼 연한 파스텔 색을 새로 만들어 함께 등록한다.
// (연한 톤 + 어두운 글씨라 색 위에 글자가 잘 보인다. 세로무늬 없이 색으로 구분.)
export async function addTagAction(): Promise<AddTagResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 태그를 추가할 수 있습니다." };
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

  const [{ data: palette }, { data: tags }] = await Promise.all([
    supabase
      .from("color_palette")
      .select("key, bg_color, sort_order")
      .eq("calendar_id", calendar.id),
    supabase.from("broadcast_tags").select("sort_order").eq("calendar_id", calendar.id)
  ]);

  // 기존 색을 (hue, 무늬)로 정리해, 같은 무늬와 색조가 겹치지 않는 슬롯을 고른다.
  const existing = (palette ?? [])
    .map((p) => ({ hue: hexToHue(p.bg_color), pat: patternOf(p.key ?? "") }))
    .filter((e): e is { hue: number; pat: Pat } => e.hue !== null);
  const { hue, pat: pattern } = pickColorSlot(existing);
  const bgColor = hslToHex(hue, 62, 86); // 연한 배경
  const borderColor = hslToHex(hue, 52, 68);
  const textColor = hslToHex(hue, 55, 28); // 같은 hue의 어두운 글씨

  // (key 접두사로 globals.css 무늬 규칙과 매칭. gen-plain-은 규칙이 없어 민무늬가 된다.)
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `gen-${pattern}-${rand}`;
  const paletteSort = Math.max(0, ...(palette ?? []).map((p) => p.sort_order ?? 0)) + 1;
  const tagSort = Math.max(0, ...(tags ?? []).map((t) => t.sort_order ?? 0)) + 1;

  const { error: palErr } = await supabase.from("color_palette").insert({
    calendar_id: calendar.id,
    key,
    name: "새 색",
    bg_color: bgColor,
    text_color: textColor,
    border_color: borderColor,
    sort_order: paletteSort
  });
  if (palErr) {
    return { ok: false, error: palErr.message };
  }

  const tagKey = `tag-${rand}`;
  const { data: inserted, error: tagErr } = await supabase
    .from("broadcast_tags")
    .insert({
      calendar_id: calendar.id,
      tag_key: tagKey,
      display_name: "새 태그",
      color_key: key,
      sort_order: tagSort,
      is_default: false,
      is_active: true
    })
    .select("id")
    .single();
  if (tagErr || !inserted) {
    return { ok: false, error: tagErr?.message ?? "태그 생성 실패" };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return {
    ok: true,
    tag: {
      id: inserted.id,
      tagKey,
      displayName: "새 태그",
      colorKey: key,
      sortOrder: tagSort,
      isDefault: false,
      isActive: true
    },
    color: {
      key,
      name: "새 색",
      bgColor,
      textColor,
      borderColor,
      sortOrder: paletteSort
    }
  };
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
    .select("id, calendar_id, color_key")
    .eq("id", tagId)
    .maybeSingle();
  if (!tag) {
    return { ok: false, error: "태그를 찾을 수 없습니다." };
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

  // 태그를 하나씩 순차 update하면 왕복 지연이 누적돼 느리다(10개면 5초+).
  // 서로 독립적이라 한꺼번에 병렬로 보낸다 → 사실상 1회 왕복 시간으로 끝난다.
  const now = new Date().toISOString();
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("broadcast_tags")
        .update({ display_name: u.displayName.trim(), color_key: u.colorKey, updated_at: now })
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
