"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";
import { safeActionError } from "@/lib/utils/safe-action-error";

export type LinkResult = { ok: true } | { ok: false; error: string };

const SLUG = "vic";

type ServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type Guard = { ok: true; supabase: ServerClient } | { ok: false; error: string };

async function guard(): Promise<Guard> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 일정을 이을 수 있습니다." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }
  return { ok: true, supabase };
}

// 날짜순 일정 id 체인을 이음(각 일정의 link_next = 다음 일정).
export async function linkChainAction(orderedIds: string[]): Promise<LinkResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (orderedIds.length < 2) return { ok: false, error: "이을 일정이 부족합니다." };

  // P0-DATA-2: 체인 전체를 DB 함수 한 트랜잭션으로(0055) — 중간 실패 시 반쪽 체인이 남지 않는다.
  const { error } = await g.supabase.rpc("link_chain_atomic", { p_ordered_ids: orderedIds });
  if (error) {
    return { ok: false, error: safeActionError("일정 연결", error) };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}

// 인접 두 일정의 이음새 하나만 끊음(earlier.link_next 제거).
export async function unlinkPairAction(earlierId: string): Promise<LinkResult> {
  const g = await guard();
  if (!g.ok) return g;

  const { error } = await g.supabase
    .from("events")
    .update({ link_next: null, updated_at: new Date().toISOString() })
    .eq("id", earlierId);
  if (error) return { ok: false, error: safeActionError("일정 연결 해제", error) };

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}

// (unlinkEventAction 삭제 — 한 일정을 양쪽 이음새에서 떼던 액션인데 부르는 곳이 없다. 편집실은
//  이음새 하나씩 끊는 위 액션만 쓴다. 다시 필요해지면 git 이력에 있다.)
