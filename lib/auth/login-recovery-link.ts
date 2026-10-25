import { sanitizeNextPath } from "./next-path";

/** A fresh login entry, never the current OAuth/error URL or its transient data. */
export function loginRecoveryHref(current: URL): string {
  const login = new URL("/login", current.origin);
  const values = current.searchParams.getAll("next");
  const next = new URL(sanitizeNextPath(values.length === 1 ? values[0] : "/"), current.origin).pathname;
  // Only known entry destinations; discard query/fragment and arbitrary paths.
  if (next === "/studio" || /^\/replay\/\d{4}-\d{2}-\d{2}$/.test(next)) login.searchParams.set("next", next);
  return login.href;
}
