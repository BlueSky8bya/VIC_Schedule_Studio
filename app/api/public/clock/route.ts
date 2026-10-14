export const dynamic = "force-dynamic";

// No cookies, authentication, database, identifiers or cache-aged timestamps.
export function GET() {
  return Response.json({ serverMs: Date.now() }, { headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store" } });
}
