import { NextResponse } from "next/server";
import { probePublicScheduleRead, type PublicScheduleReadiness } from "@/lib/schedules/public-loader";

// Readiness replaces the old full-schedule Data Cache warm. An anonymous,
// abortable id-only probe avoids revalidating the whole calendar/heart bundle.
// It does not guarantee that another request uses this same Fluid instance.
export const dynamic = "force-dynamic";
// The actual query is aborted at 5s. 15s leaves platform/response overhead; this
// is a route limit, not evidence of the previous production timeout duration.
export const maxDuration = 15;
const QUERY_BUDGET_MS = 5000;
const SUCCESS_COOLDOWN_MS = 60_000;
const FAILURE_COOLDOWN_MS = 1000;
let cached: { at: number; result: PublicScheduleReadiness } | undefined;
let inFlight: Promise<PublicScheduleReadiness> | undefined;

function startProbe(): Promise<PublicScheduleReadiness> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), QUERY_BUDGET_MS);
  const pending = probePublicScheduleRead(abort.signal).then(result => {
    cached = { at: Date.now(), result };
    return result;
  }).finally(() => {
    clearTimeout(timer);
    if (inFlight === pending) inFlight = undefined;
  });
  inFlight = pending;
  return pending;
}

export async function GET() {
  const began = Date.now();
  const prior = cached;
  const fresh = prior && began - prior.at < (prior.result.ok ? SUCCESS_COOLDOWN_MS : FAILURE_COOLDOWN_MS);
  const reuse = fresh ? "hit" : inFlight ? "shared" : "miss";
  const result = fresh ? prior.result : await (inFlight ?? startProbe());
  const stage = result.ok ? "ready" : result.reason;
  const elapsedMs = Date.now() - began;
  // Fixed fields only: no query, calendar id, account, DB error or credential.
  console.info("[warm] readiness", { stage, reuse, elapsedMs });
  return new NextResponse(null, {
    status: result.ok ? 204 : result.reason === "timeout" ? 504 : 503,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Warm-Mode": "public-readiness",
      "X-Warm-Stage": stage,
      "X-Warm-Reuse": reuse,
      "X-Warm-Ms": String(elapsedMs),
    }
  });
}
