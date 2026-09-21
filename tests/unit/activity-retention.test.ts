import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pruneActivity } from "@/lib/activity/retention";
afterEach(() => vi.unstubAllEnvs());
it("does not delete production records until cleanup is explicitly enabled", async () => {
  vi.stubEnv("PRIVACY_RETENTION_CLEANUP_ENABLED", "");
  const from = vi.fn();
  expect(await pruneActivity({ from } as unknown as SupabaseClient)).toBe("disabled");
  expect(from).not.toHaveBeenCalled();
});
it.each([null, { code: "42501" }])("executes lazy requests and reports failures truthfully", async (error) => {
  vi.stubEnv("PRIVACY_RETENTION_CLEANUP_ENABLED", "1");
  let executed = 0;
  const scopes: unknown[][] = [];
  const from = (table: string) => {
    const chain = { delete: () => chain, lt: (key: string, value: string) => { scopes.push([table,key,value]); return chain; }, eq: () => chain,
      then: (resolve: (v: unknown) => void) => { executed++; resolve({ error }); } };
    return chain;
  };
  expect(await pruneActivity({ from } as unknown as SupabaseClient)).toBe(error ? "failed" : "complete");
  expect(executed).toBe(3);
  expect(scopes).toHaveLength(3);
  expect(scopes.every((s) => s[1] === "day" && /^\d{4}-\d{2}-\d{2}$/.test(String(s[2])))).toBe(true);
});
