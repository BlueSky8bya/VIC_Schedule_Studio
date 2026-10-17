import { afterEach, describe, expect, it, vi } from "vitest";
import { skipAnalyticsRequest } from "@/lib/analytics/guard";
import { readBoundedJson } from "@/lib/net/bounded-json";

afterEach(() => vi.restoreAllMocks());
describe("analytics request guard", () => {
  it.each(["[::1]", "[::1]:3000", "::1", "LOCALHOST:3000", "127.0.0.1:3000"])("excludes local %s", host => {
    expect(skipAnalyticsRequest(new Headers({ host }))).toBe(true);
  });
  it("retains deployed traffic and honors the first forwarded host", () => {
    expect(skipAnalyticsRequest(new Headers({ host: "example.test:443" }))).toBe(false);
    expect(skipAnalyticsRequest(new Headers({ host: "example.test", "x-forwarded-host": "[::1]:3000, proxy.test" }))).toBe(true);
    expect(skipAnalyticsRequest(new Headers({ host: "example.test", "user-agent": "Playwright" }))).toBe(true);
  });
});
describe("bounded JSON reader", () => {
  it("reads UTF-8 across chunk boundaries", async () => {
    const bytes = new TextEncoder().encode('{"value":"한글"}');
    const stream = new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 11)); c.enqueue(bytes.slice(11)); c.close(); } });
    const request = new Request("https://fixture.test", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readBoundedJson(request, bytes.length)).toEqual({ ok: true, value: { value: "한글" } });
  });
  it("rejects a dishonest or missing length at the stream byte limit", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(20)); }, cancel });
    const request = new Request("https://fixture.test", { method: "POST", headers: { "content-length": "1" }, body: stream, duplex: "half" } as RequestInit);
    expect(await readBoundedJson(request, 10)).toEqual({ ok: false, status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects an advertised oversized request before parsing and malformed JSON safely", async () => {
    expect(await readBoundedJson(new Request("https://fixture.test", { method: "POST", body: "{}", headers: { "content-length": "999" } }), 10)).toEqual({ ok: false, status: 413 });
    expect(await readBoundedJson(new Request("https://fixture.test", { method: "POST", body: "{" }), 10)).toEqual({ ok: false, status: 400 });
  });
});
