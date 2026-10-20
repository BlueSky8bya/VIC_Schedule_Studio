import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NATIVE_SUITES, PURE_SUITES } from "../../scripts/companion-qa/catalog.mjs";
import { abortUnknownFixtureOrigin, fulfillReadOnlyFont, type ReadOnlyFontRoute } from "../visual/helpers/readonly-font";

const font = "https://fonts.example.invalid/public.woff2", approved = new Set([font]);
function fixture(options: { url?: string; method?: string; resourceType?: string; status?: number; headers?: Record<string, string>; failure?: "fetch" | "fulfill" } = {}) {
  const response = { status: () => options.status ?? 200, headers: () => options.headers ?? {} };
  const route = {
    request: () => ({ url: () => options.url ?? font, method: () => options.method ?? "GET", resourceType: () => options.resourceType ?? "font" }),
    fetch: options.failure === "fetch" ? vi.fn().mockRejectedValue(Error("synthetic network failure")) : vi.fn().mockResolvedValue(response),
    fulfill: options.failure === "fulfill" ? vi.fn().mockRejectedValue(Error("synthetic fulfill failure")) : vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  return { route, response, rejected: [] as string[], input: route as unknown as ReadOnlyFontRoute };
}

describe("142 shared read-only native font guard", () => {
  it("locally fulfills an exact approved HTTPS font only after a200 response with redirects disabled", async () => {
    const f = fixture(); await fulfillReadOnlyFont(f.input, approved, f.rejected);
    expect(f.route.fetch).toHaveBeenCalledExactlyOnceWith({ maxRedirects: 0 });
    expect(f.route.fulfill).toHaveBeenCalledExactlyOnceWith({ response: f.response });
    expect(f.route.abort).not.toHaveBeenCalled(); expect(f.rejected).toEqual([]);
  });
  it.each([301, 302, 303, 307, 308])("rejects redirect status%s without fetching or fulfilling its destination", async status => {
    const f = fixture({ status, headers: { location: "https://blocked.example.invalid/private" } });
    await fulfillReadOnlyFont(f.input, approved, f.rejected);
    expect(f.route.fetch).toHaveBeenCalledExactlyOnceWith({ maxRedirects: 0 });
    expect(f.route.fulfill).not.toHaveBeenCalled(); expect(f.route.abort).toHaveBeenCalledOnce();
    expect(f.rejected).toEqual(["unapproved-font-response-or-redirect"]);
  });
  it.each([204, 304, 400, 404, 500])("rejects non200 status%s", async status => {
    const f = fixture({ status }); await fulfillReadOnlyFont(f.input, approved, f.rejected);
    expect(f.route.fulfill).not.toHaveBeenCalled(); expect(f.route.abort).toHaveBeenCalledOnce();
    expect(f.rejected).toEqual(["unapproved-font-response-or-redirect"]);
  });
  it.each([{ location: "https://blocked.example.invalid/" }, { Location: "" }] as Record<string, string>[])("rejects even a200 response with any Location header%j", async headers => {
    const f = fixture({ headers }); await fulfillReadOnlyFont(f.input, approved, f.rejected);
    expect(f.route.fulfill).not.toHaveBeenCalled(); expect(f.route.abort).toHaveBeenCalledOnce();
    expect(f.rejected).toEqual(["unapproved-font-response-or-redirect"]);
  });
  it.each(["fetch", "fulfill"] as const)("records a%s failure and aborts instead of continuing", async failure => {
    const f = fixture({ failure }); await fulfillReadOnlyFont(f.input, approved, f.rejected);
    expect(f.route.abort).toHaveBeenCalledOnce(); expect(f.rejected).toEqual([`approved-font-${failure}-failed`]);
    if (failure === "fetch") expect(f.route.fulfill).not.toHaveBeenCalled();
  });
  it.each([
    { url: "https://unknown.example.invalid/font.woff2" }, { url: font + "?extra=1" }, { url: "not a URL" },
    { method: "HEAD" }, { method: "POST" }, { resourceType: "script" },
  ])("rejects an unknown URL, method or resource before any network request%j", async options => {
    const f = fixture(options); await fulfillReadOnlyFont(f.input, approved, f.rejected);
    expect(f.route.fetch).not.toHaveBeenCalled(); expect(f.route.fulfill).not.toHaveBeenCalled();
    expect(f.route.abort).toHaveBeenCalledOnce(); expect(f.rejected).toEqual(["unapproved-font-request"]);
  });
  it.each(["http://fonts.example.invalid/public.woff2", "https://user:secret@fonts.example.invalid/public.woff2"])("rejects unsafe URL authority/protocol even if present in a caller list%s", async url => {
    const f = fixture({ url }); await fulfillReadOnlyFont(f.input, new Set([url]), f.rejected);
    expect(f.route.fetch).not.toHaveBeenCalled(); expect(f.route.fulfill).not.toHaveBeenCalled();
    expect(f.route.abort).toHaveBeenCalledOnce(); expect(f.rejected).toEqual(["unapproved-font-request"]);
  });
  const fixtureOrigins = new Set(["http://127.0.0.2:3100", "http://127.0.0.1:3100"]);
  it.each([
    { url: "https://unknown.example.invalid/script.js", resourceType: "script", method: "GET" },
    { url: "https://unknown.example.invalid/image.png", resourceType: "image", method: "GET" },
    { url: "https://unknown.example.invalid/status", resourceType: "fetch", method: "HEAD" },
    { url: "http://127.0.0.1:9999/api/activity", resourceType: "xhr", method: "POST" },
    { url: "not a URL", resourceType: "image", method: "GET" },
  ])("aborts foreign non-font requests before any fetch, fulfill or ordinary continuation%j", async options => {
    const f = fixture(options);
    expect(await abortUnknownFixtureOrigin(f.input, fixtureOrigins, f.rejected)).toBe(true);
    expect(f.route.abort).toHaveBeenCalledOnce(); expect(f.route.fetch).not.toHaveBeenCalled(); expect(f.route.fulfill).not.toHaveBeenCalled();
    expect(f.rejected).toEqual(["unapproved-foreign-origin"]);
  });
  it.each([...fixtureOrigins])("preserves the exact owned loopback alias for existing API/static handling%s", async origin => {
    const f = fixture({ url: `${origin}/api/activity`, resourceType: "xhr", method: "POST" });
    expect(await abortUnknownFixtureOrigin(f.input, fixtureOrigins, f.rejected)).toBe(false);
    expect(f.route.abort).not.toHaveBeenCalled(); expect(f.route.fetch).not.toHaveBeenCalled(); expect(f.route.fulfill).not.toHaveBeenCalled(); expect(f.rejected).toEqual([]);
  });
  it("registers this security suite and delegates external fonts in every selected native guard", () => {
    expect(PURE_SUITES).toContain("tests/unit/companion-readonly-font-142.test.ts");
    for (const suite of NATIVE_SUITES) {
      const entry = readFileSync(resolve("tests/visual", suite), "utf8");
      // Shared guards own the font route for daily and146 runtime tests;
      // inline guards still have to call the same no-redirect helper.
      const sharedGuard = /import\s*\{[^}]*\bguardCompanionQa\b[^}]*\}\s*from\s*["']\.\/helpers\/companion-qa["']/.test(entry);
      if (sharedGuard) expect(entry).toMatch(/\bawait guardCompanionQa\(/);
      const path = sharedGuard ? "helpers/companion-qa.ts" : suite;
      const source = readFileSync(resolve("tests/visual", path), "utf8");
      expect(source).toContain("return fulfillReadOnlyFont(route, fonts,");
      expect(source).not.toMatch(/fonts\.has\([^\n]+return route\.continue/);
    }
    expect(readFileSync(resolve("tests/visual/companion-activity.spec.ts"), "utf8")).toContain("if (await abortUnknownFixtureOrigin(");
  });
});
