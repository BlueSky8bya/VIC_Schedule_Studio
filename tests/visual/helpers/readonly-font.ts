import type { Route } from "@playwright/test";

export type ReadOnlyFontRoute = Pick<Route, "request" | "fetch" | "fulfill" | "abort">;

/** Font requests are handled first. Every other request must stay inside the
 * exact owned fixture origins; an alias never grants other ports or hosts.
 */
export async function abortUnknownFixtureOrigin(route: ReadOnlyFontRoute, approvedOrigins: ReadonlySet<string>, rejected: string[]): Promise<boolean> {
  let approved = false;
  try { approved = approvedOrigins.has(new URL(route.request().url()).origin); } catch { /* Malformed origins fail closed. */ }
  if (approved) return false;
  rejected.push("unapproved-foreign-origin"); await route.abort(); return true;
}

/** Fetch only an exact declared HTTPS font, without following any redirect.
 * Playwright does not rerun route handlers for a redirect destination.
 * Callers retain their own local-static, mutation and public-fixture guards.
 */
export async function fulfillReadOnlyFont(route: ReadOnlyFontRoute, approved: ReadonlySet<string>, rejected: string[]): Promise<void> {
  const request = route.request();
  let url: URL;
  try { url = new URL(request.url()); }
  catch { rejected.push("unapproved-font-request"); await route.abort(); return; }
  if (request.method() !== "GET" || request.resourceType() !== "font" || url.protocol !== "https:" || url.username || url.password || !approved.has(url.href)) {
    rejected.push("unapproved-font-request"); await route.abort(); return;
  }
  let response: Awaited<ReturnType<Route["fetch"]>>;
  try { response = await route.fetch({ maxRedirects: 0 }); }
  catch { rejected.push("approved-font-fetch-failed"); await route.abort(); return; }
  if (response.status() !== 200 || Object.keys(response.headers()).some(key => key.toLowerCase() === "location")) {
    rejected.push("unapproved-font-response-or-redirect"); await route.abort(); return;
  }
  try { await route.fulfill({ response }); }
  catch { rejected.push("approved-font-fulfill-failed"); await route.abort(); }
}
