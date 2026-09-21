import { createHash } from "node:crypto";

// Stable keyed pseudonym: linkable across visits and therefore protected personal data.
// Preserve existing secret fallback for continuity; never use a public/default salt.
// Missing secret disables identification without breaking analytics or user actions.
export function accountHashOf(email: string): string | null {
  const salt = process.env.VISIT_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${email}`).digest("hex").slice(0, 32);
}
