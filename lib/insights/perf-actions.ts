"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";

const SLUG = "vic";

// 라벨별 서버 구간 통계(개발자 인사이트 "서버 성능" 패널). 느린 순(p95)으로 온다.
export type PerfStatRow = {
  label: string;
  n: number; // 표본 수
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};
export type PerfStatsResult =
  | { ok: true; rows: PerfStatRow[]; hours: number }
  | { ok: false; error: string };

export async function getPerfStatsAction(hours: number): Promise<PerfStatsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const safeHours = Math.max(1, Math.min(720, Math.round(hours))); // 1시간~30일
  const since = new Date(Date.now() - safeHours * 3600 * 1000).toISOString();
  const { data, error } = await supabase.rpc("get_perf_stats", { p_since: since });
  if (error) {
    return { ok: false, error: error.message };
  }
  const rows: PerfStatRow[] = (
    (data as
      | { label: string; n: number; avg_ms: number; p50_ms: number; p95_ms: number; max_ms: number }[]
      | null) ?? []
  ).map((r) => ({
    label: r.label,
    n: Number(r.n),
    avgMs: Number(r.avg_ms),
    p50Ms: Number(r.p50_ms),
    p95Ms: Number(r.p95_ms),
    maxMs: Number(r.max_ms)
  }));
  return { ok: true, rows, hours: safeHours };
}
