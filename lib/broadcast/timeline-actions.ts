"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { canEditSchedule } from "@/lib/permissions/roles";
import { sanitizeTimelineEntries } from "./timeline-public";
import type { TimelineManagementRow } from "./timeline-management-types";
import { revalidatePath } from "next/cache";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";

async function gate() {
  const actor = await resolveCurrentActor("vic");
  if (!actor.isAuthenticated || !canEditSchedule(actor.role)) return null;
  return createSupabaseAdminClient();
}

export async function getTimelineManagement(titleNo?: number): Promise<{ ok: true; rows: TimelineManagementRow[] } | { ok: false; error: string }> {
  const db = await gate();
  if (!db) return { ok: false, error: "타임라인 관리 권한이 없습니다." };
  let query = db.from("vod_archive").select("title_no,title,broadcast_day").eq("auth_no", 101).order("reg_date", { ascending: false }).limit(40);
  if (titleNo !== undefined) {
    if (!Number.isSafeInteger(titleNo) || titleNo <= 0) return { ok: false, error: "영상 번호를 확인해 주세요." };
    query = query.eq("title_no", titleNo);
  }
  const vods = await query;
  if (vods.error) return { ok: false, error: "다시보기를 불러오지 못했어요." };
  const ids = (vods.data ?? []).map((v) => Number(v.title_no));
  if (!ids.length) return { ok: true, rows: [] };
  const candidates: Record<string, unknown>[] = [];
  for (let off = 0; ; off += 500) {
    const r = await db.from("vod_timeline_candidate").select("title_no,candidate_key,author_nick,entries,reason,eligible,present,visibility,source_comment_nos")
      .in("title_no", ids).order("title_no").order("candidate_key").range(off, off + 499);
    if (r.error) return { ok: false, error: "타임라인을 불러오지 못했어요. 데이터 준비 상태를 확인해 주세요." };
    candidates.push(...(r.data ?? []));
    if ((r.data?.length ?? 0) < 500) break;
  }
  const [choices, projections] = await Promise.all([
    db.from("vod_timeline_choice").select("title_no,pinned_key").in("title_no", ids),
    db.from("vod_timeline").select("title_no,variants").in("title_no", ids)
  ]);
  if (choices.error || projections.error) return { ok: false, error: "타임라인 설정을 불러오지 못했어요." };
  return { ok: true, rows: (vods.data ?? []).map((v) => ({
    titleNo: Number(v.title_no), title: String(v.title ?? ""), day: String(v.broadcast_day ?? ""),
    pinnedKey: choices.data?.find((c) => Number(c.title_no) === Number(v.title_no))?.pinned_key ?? null,
    representativeKey: projections.data?.find((c) => Number(c.title_no) === Number(v.title_no))?.variants?.[0]?.id ?? null,
    candidates: candidates.filter((c) => Number(c.title_no) === Number(v.title_no)).map((c) => ({
      key: String(c.candidate_key), authorNick: String(c.author_nick ?? ""), entries: sanitizeTimelineEntries(c.entries),
      reason: String(c.reason), eligible: c.eligible === true, present: c.present === true,
      visibility: c.visibility === "show" ? "show" : c.visibility === "hide" ? "hide" : "auto",
      sourceCount: Array.isArray(c.source_comment_nos) ? c.source_comment_nos.length : 1
    }))
  })) };
}

export async function moderateTimelineAction(input: { titleNo?: unknown; key?: unknown; action?: unknown }) {
  const db = await gate();
  if (!db) return { ok: false as const, error: "타임라인 관리 권한이 없습니다." };
  const titleNo = Number(input.titleNo);
  if (!Number.isSafeInteger(titleNo) || titleNo <= 0 || !["pin", "automatic", "show", "hide", "auto"].includes(String(input.action)) ||
      (input.action !== "automatic" && (typeof input.key !== "string" || !/^(root:\d+|reply:\d+:[a-f0-9]+)$/.test(input.key)))) {
    return { ok: false as const, error: "타임라인 설정을 확인해 주세요." };
  }
  const { error } = await db.rpc("vod_timeline_moderate", { p_title_no: titleNo, p_key: input.key ?? null, p_action: input.action });
  if (error) return { ok: false as const, error: "저장하지 못했어요. 다시 시도해 주세요." };
  revalidatePublicSchedule();
  revalidatePath("/", "layout");
  return { ok: true as const };
}
