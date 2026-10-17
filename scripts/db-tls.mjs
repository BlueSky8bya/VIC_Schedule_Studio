import { existsSync, readFileSync } from "node:fs";

// Shared by operational tools. A missing/invalid configured CA fails closed;
// callers must never recover by disabling certificate or hostname validation.
export function verifiedDatabaseTls(env = process.env) {
  let caPath = env.SUPABASE_DB_CA_PATH;
  if (!caPath) {
    const file = new URL("../.env.local", import.meta.url);
    if (existsSync(file)) {
      caPath = readFileSync(file, "utf8").match(/^SUPABASE_DB_CA_PATH\s*=\s*(.+)$/m)?.[1]?.trim();
      if (caPath?.startsWith('"') && caPath.endsWith('"')) caPath = caPath.slice(1, -1);
      else if (caPath?.startsWith("'") && caPath.endsWith("'")) caPath = caPath.slice(1, -1);
    }
  }
  return { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}) };
}
