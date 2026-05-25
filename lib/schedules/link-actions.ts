"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { canEditSchedule } from "@/lib/permissions/roles";

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

  const now = new Date().toISOString();
  // 각 이음을 병렬로 보낸다(순차 왕복 누적 방지).
  const results = await Promise.all(
    orderedIds.slice(0, -1).map((curId, i) =>
      g.supabase
        .from("events")
        .update({ link_next: orderedIds[i + 1], updated_at: now })
        .eq("id", curId)
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

// 인접 두 일정의 이음새 하나만 끊음(earlier.link_next 제거).
export async function unlinkPairAction(earlierId: string): Promise<LinkResult> {
  const g = await guard();
  if (!g.ok) return g;

  const { error } = await g.supabase
    .from("events")
    .update({ link_next: null, updated_at: new Date().toISOString() })
    .eq("id", earlierId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}

// 한 일정을 양쪽 이음새에서 완전히 분리.
export async function unlinkEventAction(id: string): Promise<LinkResult> {
  const g = await guard();
  if (!g.ok) return g;

  const now = new Date().toISOString();
  const r1 = await g.supabase
    .from("events")
    .update({ link_next: null, updated_at: now })
    .eq("id", id);
  if (r1.error) return { ok: false, error: r1.error.message };

  const r2 = await g.supabase
    .from("events")
    .update({ link_next: null, updated_at: now })
    .eq("link_next", id);
  if (r2.error) return { ok: false, error: r2.error.message };

  revalidatePath("/");
  revalidatePath("/studio");
  revalidatePublicSchedule();
  return { ok: true };
}
