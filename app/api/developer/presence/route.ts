import { NextResponse } from "next/server";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { LIVE_WINDOW_SECONDS, type LivePresence } from "@/lib/presence/live-types";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

// No raw rows are loaded, cached or returned. This is an operational, developer-only API.
export async function GET() {
  try {
    const actor = await resolveCurrentActor("vic");
    if (!actor.isAuthenticated) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    if (actor.role !== "developer" || actor.roleUncertain) {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    }
    const db = createSupabaseAdminClient();
    if (!db) throw new Error("unavailable");
    const observedAt = new Date().toISOString();
    const result = await db.rpc("developer_live_presence_counts", { p_observed_at: observedAt })
      .abortSignal(AbortSignal.timeout(5000));
    if (result.error || !result.data) throw new Error("unavailable");
    const counts = result.data as { total?: unknown; roles?: Record<string, unknown>; devices?: Record<string, unknown> };
    const number = (value: unknown): number => {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("unavailable");
      return value;
    };
    // Explicit DTO: neither an unexpected RPC field nor a diagnostic can reach this route.
    const data: LivePresence = {
      observedAt, windowSeconds: LIVE_WINDOW_SECONDS, total: number(counts.total),
      roles: { owner: number(counts.roles?.owner), viewer: number(counts.roles?.viewer),
        anon: number(counts.roles?.anon), developer: number(counts.roles?.developer) },
      devices: { desktop: number(counts.devices?.desktop), android: number(counts.devices?.android),
        ios: number(counts.devices?.ios), mobile: number(counts.devices?.mobile) }
    };
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
