import { loadPublicTeaserState } from "@/lib/schedules/public-loader";

export async function GET(request: Request, { params }: { params: Promise<{ calendarSlug: string; eventId: string }> }) {
  const { calendarSlug, eventId } = await params;
  if (new URL(request.url).search) return new Response(null, { status: 400 });
  if (calendarSlug !== "vic" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) return new Response(null, { status: 404 });
  const state = await loadPublicTeaserState(calendarSlug, eventId);
  return Response.json(state, { status: state.ok ? 200 : 503, headers: {
    "Cache-Control": state.ok ? "public, max-age=0, s-maxage=1" : "no-store", "Retry-After": "2"
  } });
}
