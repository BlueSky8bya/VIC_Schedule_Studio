import { NextResponse } from "next/server";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { kstDayKey } from "@/lib/calendar/month";
import { LIVE_DEVICES, LIVE_ROLES, LIVE_WINDOW_SECONDS, type LivePresence } from "@/lib/presence/live-types";

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
    const since = new Date(Date.parse(observedAt) - LIVE_WINDOW_SECONDS * 1000).toISOString();
    const count = async (column: "role" | "device", value: string) => {
      const { count: n, error } = await db.from("visit_session")
        .select("id", { count: "exact", head: true })
        // Beacon splits at KST midnight; retain the window's previous day too.
        .gte("day", kstDayKey(new Date(since)))
        .is("ended_at", null).gte("last_seen_at", since).lte("last_seen_at", observedAt)
        .in("role", [...LIVE_ROLES]).eq(column, value);
      if (error || n === null || n === undefined) throw new Error("unavailable");
      return n;
    };
    const [roles, devices] = await Promise.all([
      Promise.all(LIVE_ROLES.map((role) => count("role", role))),
      Promise.all(LIVE_DEVICES.map((device) => count("device", device)))
    ]);
    const data: LivePresence = {
      observedAt, windowSeconds: LIVE_WINDOW_SECONDS,
      total: roles.reduce((sum, n) => sum + n, 0),
      roles: { owner: roles[0], viewer: roles[1], anon: roles[2], developer: roles[3] },
      devices: { desktop: devices[0], android: devices[1], ios: devices[2], mobile: devices[3] }
    };
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
