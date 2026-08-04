"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { recordActivity } from "@/lib/activity/record";
import type { BroadcastTag, ColorKey, ColorPaletteEntry, TagKind } from "@/lib/domain/schedule-types";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";
import { safeActionError } from "@/lib/utils/safe-action-error";

export type TagUpdateResult = { ok: true } | { ok: false; error: string };

// 새 태그(드래프트) 1건 — 색은 클라이언트에서 미리 생성해 함께 보낸다(저장 전엔 팝업에만 보임).
export type TagCreateInput = {
  tempId: string;
  displayName: string;
  colorKey: ColorKey;
  bgColor: string;
  textColor: string;
  borderColor: string;
  // 커스텀 색 hex(#RRGGBB). 대분류만 의미 있고, 있으면 렌더가 이 색을 쓴다(color_key 폴백 대신).
  bgHex?: string | null;
  sortOrder: number;
  // 2계층: null = 대분류(색 보유), 값 = 세부(부모 대분류 id, 색은 부모 상속). 임시 부모는 tempId일 수 있다.
  parentId?: string | null;
  // content(콘텐츠) | modifier(수식어). 생략 시 content.
  kind?: TagKind;
};

// 커스텀 색 hex 검증 — #RRGGBB만. null/빈값은 '색 없음'(팔레트 폴백).
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function validBgHex(v: string | null | undefined): string | null {
  if (!v) return null;
  return HEX_RE.test(v) ? v : null;
}
// "전체 저장": 기존 태그 수정 + 새 태그 생성을 한 번에. 생성분은 진짜 id를 돌려줘 화면을 갱신한다.
export type SaveTagsResult =
  | { ok: true; created: { tempId: string; tag: BroadcastTag; color: ColorPaletteEntry }[] }
  | { ok: false; error: string };

const SLUG = "vic";

// (updateTagAction 삭제 — 태그 하나만 고치던 옛 액션. 지금은 아래 saveTagsAction이 수정·생성을
//  한 번에 처리하고 호출부도 그것만 쓴다. 호출자 0으로 확인.)

// #6/#4: "전체 저장" — 기존 태그 수정 + 새로 추가한 드래프트 태그 생성을 한 번에 처리한다.
// (새 태그는 저장 누르기 전까지 팝업 안에서만 보이고, 이 액션을 누를 때만 DB·달력에 반영된다.)
export async function saveTagsAction(input: {
  updates: { id: string; displayName: string; colorKey: ColorKey; bgHex?: string | null; sortOrder?: number; parentId?: string | null; kind?: TagKind }[];
  creates: TagCreateInput[];
}): Promise<SaveTagsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 태그를 저장할 수 있습니다." };
  }

  const { updates, creates } = input;
  const isTop = (x: { parentId?: string | null }) => (x.parentId ?? null) === null;

  // 이름 검증 — 수정·생성 모두.
  if ([...updates, ...creates].some((u) => !u.displayName.trim())) {
    return { ok: false, error: "모든 태그 이름을 입력하세요." };
  }
  // 커스텀 색 형식 검증(대분류만). 값이 왔는데 #RRGGBB가 아니면 거부(조용히 폴백시키지 않는다).
  const badHex = [...updates, ...creates].some(
    (u) => isTop(u) && u.bgHex != null && u.bgHex !== "" && !HEX_RE.test(u.bgHex)
  );
  if (badHex) {
    return { ok: false, error: "색상 형식이 올바르지 않습니다(#RRGGBB)." };
  }
  // 색·색중복 검증은 '대분류'만 — 세부는 부모 색을 상속하므로 색이 겹쳐도 정상.
  const tops = [...updates, ...creates].filter(isTop);
  if (tops.some((u) => !u.colorKey)) {
    return { ok: false, error: "대분류 태그에 색상을 지정하세요." };
  }
  // 색 중복은 같은 kind끼리만 — 콘텐츠끼리/방식끼리 색이 달라야 한다(콘텐츠=카드 색, 방식=점이라
  // 서로 다른 종류면 같은 색을 써도 헷갈리지 않는다).
  const byKind = new Map<string, string[]>();
  for (const u of tops) {
    const k = u.kind === "modifier" ? "modifier" : "content";
    const arr = byKind.get(k) ?? [];
    arr.push(u.colorKey);
    byKind.set(k, arr);
  }
  for (const arr of byKind.values()) {
    if (new Set(arr).size !== arr.length) {
      return { ok: false, error: "같은 종류(콘텐츠/형식) 안에서 같은 색을 두 태그에 쓸 수 없습니다." };
    }
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

  // 새 태그가 있으면: 총 개수(최대 120 — 2계층 세부 포함) 확인 + 새 색 팔레트 등록.
  const created: { tempId: string; tag: BroadcastTag; color: ColorPaletteEntry }[] = [];
  if (creates.length > 0) {
    const { count: tagCount } = await supabase
      .from("broadcast_tags")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendar.id);
    if ((tagCount ?? 0) + creates.length > 120) {
      return { ok: false, error: "태그는 최대 120개까지만 만들 수 있습니다." };
    }

    // 새로 만든(gen-) 색 중 아직 팔레트에 없는 것만 등록한다.
    const { data: palette } = await supabase
      .from("color_palette")
      .select("key, sort_order")
      .eq("calendar_id", calendar.id);
    const existingKeys = new Set((palette ?? []).map((p) => p.key));
    let paletteSort = Math.max(0, ...(palette ?? []).map((p) => p.sort_order ?? 0));
    const paletteRows = creates
      .filter((c) => isTop(c) && c.colorKey.startsWith("gen-") && !existingKeys.has(c.colorKey))
      .map((c) => ({
        calendar_id: calendar.id,
        key: c.colorKey,
        name: "새 색",
        bg_color: c.bgColor,
        text_color: c.textColor,
        border_color: c.borderColor,
        sort_order: ++paletteSort
      }));
    if (paletteRows.length > 0) {
      const { error: palErr } = await supabase.from("color_palette").insert(paletteRows);
      if (palErr) {
        return { ok: false, error: safeActionError("태그 저장", palErr) };
      }
    }

    // 새 태그 행 삽입(요청 순서를 보존하려고 하나씩). 대분류 먼저 — 세부의 부모(tempId)가 진짜
    // id로 잡힌 뒤 삽입되게. tempToReal로 같은 저장 안에서 만든 부모를 연결한다.
    const orderedCreates = [...creates].sort((a, b) => Number(!isTop(a)) - Number(!isTop(b)));
    const tempToReal = new Map<string, string>();
    for (const c of orderedCreates) {
      const tagKey = `tag-${Math.random().toString(36).slice(2, 8)}`;
      const rawParent = c.parentId ?? null;
      const parentId = rawParent ? (tempToReal.get(rawParent) ?? rawParent) : null;
      const { data: inserted, error: tagErr } = await supabase
        .from("broadcast_tags")
        .insert({
          calendar_id: calendar.id,
          tag_key: tagKey,
          display_name: c.displayName.trim(),
          color_key: c.colorKey,
          // 커스텀 색은 대분류만(세부는 부모 상속 → NULL). DB CHECK도 동일 보장.
          bg_hex: parentId ? null : validBgHex(c.bgHex),
          sort_order: c.sortOrder,
          is_default: false,
          is_active: true,
          parent_id: parentId,
          kind: c.kind ?? "content"
        })
        .select("id")
        .single();
      if (tagErr || !inserted) {
        return { ok: false, error: safeActionError("태그 저장", tagErr) };
      }
      tempToReal.set(c.tempId, inserted.id as string);
      created.push({
        tempId: c.tempId,
        tag: {
          id: inserted.id,
          tagKey,
          displayName: c.displayName.trim(),
          colorKey: c.colorKey,
          bgHex: parentId ? null : validBgHex(c.bgHex),
          sortOrder: c.sortOrder,
          isDefault: false,
          isActive: true,
          parentId,
          kind: c.kind ?? "content"
        },
        color: {
          key: c.colorKey,
          name: "새 색",
          bgColor: c.bgColor,
          textColor: c.textColor,
          borderColor: c.borderColor,
          sortOrder: paletteSort
        }
      });
    }
  }

  // 기존 태그 수정 — 독립적이라 병렬로(왕복 1회 수준).
  if (updates.length > 0) {
    // 휴뱅(dayoff)은 이름·색 변경 금지 — 수정 목록에 섞여 와도 잠근다(순서만 반영).
    const lockedIds = new Set<string>();
    const { data: lockedRows } = await supabase
      .from("broadcast_tags")
      .select("id")
      .eq("calendar_id", calendar.id)
      .eq("tag_key", "dayoff")
      .in(
        "id",
        updates.map((u) => u.id)
      );
    for (const r of lockedRows ?? []) lockedIds.add(r.id);

    const now = new Date().toISOString();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("broadcast_tags")
          .update(
            lockedIds.has(u.id)
              ? { ...(u.sortOrder === undefined ? {} : { sort_order: u.sortOrder }), updated_at: now }
              : {
                  display_name: u.displayName.trim(),
                  color_key: u.colorKey,
                  ...(u.sortOrder === undefined ? {} : { sort_order: u.sortOrder }),
                  ...(u.parentId === undefined ? {} : { parent_id: u.parentId }),
                  ...(u.kind === undefined ? {} : { kind: u.kind }),
                  // 커스텀 색: 세부로 바뀌면(parent_id 지정) bg_hex를 NULL로 비운다(상속·CHECK 준수).
                  // 대분류면 보낸 값(검증)으로. 색을 안 보냈고 재부모도 아니면 건드리지 않는다.
                  ...(u.parentId != null
                    ? { bg_hex: null }
                    : u.bgHex === undefined
                      ? {}
                      : { bg_hex: validBgHex(u.bgHex) }),
                  updated_at: now
                }
          )
          .eq("id", u.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      return { ok: false, error: safeActionError("태그 저장", failed.error) };
    }
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  // 태그 이름은 남기지 않는다(사용자 자유 서술) — 몇 개를 만들고 고쳤는지만.
  await recordActivity({
    kind: created.length > 0 ? "tag.create" : "tag.update",
    actor,
    meta: { created: created.length, updated: updates.length }
  });
  return { ok: true, created };
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
    .select("id, calendar_id, color_key, tag_key")
    .eq("id", tagId)
    .maybeSingle();
  if (!tag) {
    return { ok: false, error: "태그를 찾을 수 없습니다." };
  }
  // 휴뱅(dayoff)은 시스템 기본 태그 — 삭제 금지(클라 잠금 우회 대비 서버 차단).
  if (tag.tag_key === "dayoff") {
    return { ok: false, error: "휴뱅은 삭제할 수 없는 기본 태그입니다." };
  }

  const { error } = await supabase.from("broadcast_tags").delete().eq("id", tagId);
  if (error) {
    return { ok: false, error: safeActionError("태그 삭제", error) };
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
  await recordActivity({ kind: "tag.delete", target: tagId, actor });
  return { ok: true };
}

// (updateTagsAction 삭제 — 여러 태그를 한 번에 고치던 옛 액션. saveTagsAction이 수정·생성을 함께
//  처리하면서 대체됐고 호출자가 0이다. 문서(docs/tags/*)에만 이름이 남아 있었다.)
