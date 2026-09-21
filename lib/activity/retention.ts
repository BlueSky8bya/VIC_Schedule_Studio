import type { SupabaseClient } from "@supabase/supabase-js";
import { kstDayKey } from "@/lib/calendar/month";
import { ACTIVITY_RETENTION_DAYS, DIAG_RETENTION_DAYS } from "./kinds";

// Historical cleanup is destructive. Enable only after a restricted recovery backup
// and explicit operational authorization. Default off; never pretend deletion occurred.
export async function pruneActivity(db: SupabaseClient): Promise<"disabled" | "complete" | "failed"> {
  if (process.env.PRIVACY_RETENTION_CLEANUP_ENABLED !== "1") return "disabled";
  const cutoff = kstDayKey(new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 86400_000));
  const diagCutoff = kstDayKey(new Date(Date.now() - DIAG_RETENTION_DAYS * 86400_000));
  try {
    const results = await Promise.all([
      db.from("activity_event").delete().lt("day", cutoff).eq("diag", false),
      db.from("activity_daily_count").delete().lt("day", cutoff),
      db.from("activity_event").delete().lt("day", diagCutoff).eq("diag", true)
    ]);
    return results.some((result) => result.error) ? "failed" : "complete";
  } catch {
    return "failed";
  }
}
