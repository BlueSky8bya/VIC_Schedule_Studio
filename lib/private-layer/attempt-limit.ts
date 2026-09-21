import type { SupabaseClient } from "@supabase/supabase-js";

// Service-only RPC reserves before password verification, atomically across all
// instances and both entry points. Missing DB/security state must never allow a guess.
export async function reservePasscodeAttempt(db: SupabaseClient, userId: string): Promise<"allowed" | "limited" | "unavailable"> {
  try {
    const { data, error } = await db.rpc("reserve_private_unlock_attempt", { p_user_id: userId });
    if (error || typeof data !== "boolean") return "unavailable";
    return data ? "allowed" : "limited";
  } catch {
    return "unavailable";
  }
}
