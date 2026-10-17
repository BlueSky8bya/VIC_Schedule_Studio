/** Single-calendar public API contract. Reject irrelevant/ambiguous cache keys
 * before any loader runs; never reflect the rejected query or slug in errors. */
export function publicRequestError(status: 400 | 404 | 503, message: string): Response {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

export function validatePublicRequest(request: Request, calendarSlug: string, allowedKeys: readonly string[]):
  { ok: true; query: URLSearchParams } | { ok: false; response: Response } {
  if (calendarSlug !== "vic") return { ok: false, response: publicRequestError(404, "Not found") };
  const url = new URL(request.url);
  if (allowedKeys.length === 0 && url.search) return { ok: false, response: publicRequestError(400, "Invalid query") };
  const query = url.searchParams;
  const seen = new Set<string>();
  for (const key of query.keys()) {
    if (!allowedKeys.includes(key) || seen.has(key)) {
      return { ok: false, response: publicRequestError(400, "Invalid query") };
    }
    seen.add(key);
  }
  return { ok: true, query };
}
