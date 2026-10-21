/** Exact, credential-free local fixture responses. This helper never fetches,
 * forwards or executes an API. Unknown reads remain the guard's failures. */
export type CompanionSyntheticRead157 = {
  path: string; status: 200; json: Record<string, unknown>;
};

export function companionSyntheticRead157(method: string, url: URL, now: number): CompanionSyntheticRead157 | undefined {
  if (method !== "GET" || url.protocol !== "http:" || !["localhost", "127.0.0.1", "127.0.0.2", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.hash || !Number.isFinite(now)) return;
  if (["/api/soop-live", "/api/public/clock", "/api/public/vic/teaser-state"].includes(url.pathname)) {
    if (url.search) return;
    if (url.pathname === "/api/soop-live") return { path: url.pathname, status: 200, json: { isLive: false } };
    if (url.pathname === "/api/public/clock") return { path: url.pathname, status: 200, json: { serverMs: now } };
    return { path: url.pathname, status: 200, json: { ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] } };
  }
  if (url.pathname !== "/api/visual-fixture/premiere") return;
  const query = url.searchParams, keys = [...query.keys()];
  if (!keys.includes("startedAt") || !keys.includes("offsets") || !keys.includes("scenario")
    || new Set(keys).size !== keys.length || keys.some(key => !["startedAt", "offsets", "scenario", "eventId"].includes(key))) return;
  const startedText = query.get("startedAt")!, offsetsText = query.get("offsets")!;
  if (!/^\d{10,16}$/.test(startedText)) return;
  const started = Number(startedText), offsets = offsetsText ? offsetsText.split(",") : [];
  if (!Number.isFinite(started) || Math.abs(started-now) > 3_600_000 || offsets.length > 8
    || offsets.some(text => !/^-?\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text)) || Math.abs(Number(text)) > 600)) return;
  // These two ordinary fixtures share the same empty DTO. The no-premiere
  // fixture must have literally empty offsets; it never admits an identity.
  // Other scenario/identity tests own their separate explicit response guard.
  const scenario = query.get("scenario");
  if (query.has("eventId") || !(scenario === "normal" || scenario === "empty" && offsetsText === "")) return;
  return { path: url.pathname, status: 200, json: { ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] } };
}
