import { buildPremiereFixture } from "@/lib/schedules/premiere-fixture";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const started = Number(query.get("startedAt"));
  const offsets = query.get("offsets") ? query.get("offsets")!.split(",").map(Number) : [];
  if (!Number.isFinite(started) || Math.abs(started - Date.now()) > 3600_000 || offsets.length > 8 || offsets.some(offset => !Number.isFinite(offset) || Math.abs(offset) > 600)) return new Response(null, { status: 400 });
  if (query.get("scenario") === "failure") return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(buildPremiereFixture(started, offsets, Date.now(), query.get("scenario") ?? "normal", query.get("eventId") ?? undefined), { headers: { "Cache-Control": "no-store" } });
}
