import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { accountHashOf } from "@/lib/insights/account-hash";

afterEach(() => vi.unstubAllEnvs());
describe("account pseudonym", () => {
  it("disables identification when no server secret is configured", () => {
    vi.stubEnv("VISIT_HASH_SALT", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(accountHashOf("someone@example.test")).toBeNull();
  });
  it("preserves existing keyed identifiers and uses explicit salt first", () => {
    vi.stubEnv("VISIT_HASH_SALT", "test-salt");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-secret");
    expect(accountHashOf("someone@example.test")).toBe(createHash("sha256").update("test-salt:someone@example.test").digest("hex").slice(0, 32));
    vi.stubEnv("VISIT_HASH_SALT", "");
    expect(accountHashOf("someone@example.test")).toBe(createHash("sha256").update("test-service-secret:someone@example.test").digest("hex").slice(0, 32));
  });
});
