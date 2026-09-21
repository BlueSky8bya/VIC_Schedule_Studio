import { describe, expect, it, vi } from "vitest";
import { sanitizeNextPath } from "@/lib/auth/next-path";

vi.mock("@/lib/auth/server", () => ({ createSupabaseServerClient: vi.fn() }));

describe("OAuth next path", () => {
  it.each(["/", "/studio", "/studio?panel=tags#top", "/replay/2026-09-18?t=20"])("keeps local path %s", (path) => {
    expect(sanitizeNextPath(path)).toBe(path);
  });
  it.each(["//example.invalid", "/\\example.invalid", "/\t/example.invalid", "/\n/example.invalid", "https://example.invalid", "studio", " /studio"])("rejects ambiguous/external path %s", (path) => {
    expect(sanitizeNextPath(path)).toBe("/");
  });
  it("callback decodes query next once and refuses external redirect", async () => {
    const { GET } = await import("@/app/(auth)/auth/callback/route");
    const response = await GET(new Request("https://fixture.invalid/auth/callback?next=/%5Cexample.invalid"));
    expect(response.headers.get("location")).toBe("https://fixture.invalid/");
  });
});
