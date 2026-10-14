import { loadPublicTeaserState } from "@/lib/schedules/public-loader";

export async function GET(request: Request, { params }: { params: Promise<{ calendarSlug: string }> }) {
  const { calendarSlug } = await params;
  if (new URL(request.url).search) return new Response(null, { status: 400 });
  if (calendarSlug !== "vic") return new Response(null, { status: 404 });
  const state = await loadPublicTeaserState(calendarSlug);
  const near = state.entries.some(entry => {
    const remain = Date.parse(entry.revealAt ?? "") - state.sampledAtDbMs;
    return Number.isFinite(remain) && remain <= 300_000 && remain >= -30_000;
  });
  return Response.json(state, { status: state.ok ? 200 : 503, headers: {
    "Cache-Control": state.ok ? `public, max-age=0, s-maxage=${near ? 1 : 15}` : "no-store",
    "Retry-After": "2"
  } });
}
