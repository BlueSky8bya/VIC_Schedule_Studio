import { describe, expect, it } from "vitest";
import { companionSyntheticRead157 } from "../visual/helpers/companion-synthetic-reads-157";

const now = 1_792_540_000_000, origin = "http://127.0.0.1:3217";
const read = (path: string, method = "GET", at = now) => companionSyntheticRead157(method, new URL(path, origin), at);
const premiere = `/api/visual-fixture/premiere?startedAt=${now}&offsets=12,20&scenario=normal`;
describe("157 exact synthetic companion reads without API execution", () => {
  it("supplies only local no-live state, ordinary empty teaser data and the current response clock", () => {
    expect(read("/api/soop-live")).toEqual({ path: "/api/soop-live", status: 200, json: { isLive: false } });
    expect(read("/api/public/clock")).toEqual({ path: "/api/public/clock", status: 200, json: { serverMs: now } });
    expect(read("/api/public/vic/teaser-state")?.json).toEqual({ ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] });
    expect(read(premiere)?.json).toEqual({ ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] });
    expect(read(`/api/visual-fixture/premiere?startedAt=${now}&offsets=&scenario=empty`)?.json)
      .toEqual({ ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] });
  });
  it.each(["localhost", "127.0.0.1", "127.0.0.2", "[::1]"])("allows exact HTTP loopback %s", host => {
    expect(companionSyntheticRead157("GET", new URL(`http://${host}:3217/api/public/clock`), now)?.json.serverMs).toBe(now);
  });
  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "get"])("never labels %s as a synthetic allowed read", method => {
    for (const path of ["/api/public/clock", "/api/soop-live", "/api/public/vic/teaser-state", premiere]) expect(read(path, method)).toBeUndefined();
  });
  it.each(["/api/studio-write", "/api/public/other/teaser-state", "/api/public/vic/teaser-state/00000000-0000-4000-8000-000000000001",
    "/api/public/vic/teaser-state/", "/api/public/clock/", "/api/soop-live/private", "/api/private", "/api/public/vic/teaser-state?private=1",
    "/api/public/clock?serverMs=0", "/api/soop-live?redirect=https://other.invalid", "/api/soop-live#x"])("leaves unknown or modified path %s to the rejecting guard", path => {
    expect(read(path)).toBeUndefined();
  });
  it.each(["https://127.0.0.1:3217/api/public/clock", "http://127.0.0.1.evil.invalid/api/public/clock", "http://example.invalid/api/public/clock",
    "http://localhosT.example.invalid/api/public/clock", "http://user:pass@localhost:3217/api/public/clock"])("rejects foreign/credentialed origin %s", url => {
    expect(companionSyntheticRead157("GET", new URL(url), now)).toBeUndefined();
  });
  it.each([NaN, Infinity, -Infinity])("rejects invalid response time %s", at => expect(read("/api/public/clock", "GET", at)).toBeUndefined());
  it.each(["offsets=12&scenario=normal", `startedAt=${now}&scenario=normal`, `startedAt=${now}&offsets=12`,
    `startedAt=${now}&offsets=12&scenario=normal&private=1`, `startedAt=${now}&offsets=12&scenario=normal&scenario=normal`,
    `startedAt=${now}&offsets=12&scenario=normal&eventId=00000000-0000-4000-8000-000000000001`,
    `startedAt=${now}&offsets=12&scenario=failure`, `startedAt=${now}&offsets=12&scenario=tagged`,
    `startedAt=${now}&offsets=12&scenario=empty`, `startedAt=${now}&offsets=0&scenario=empty`,
    `startedAt=${now}&offsets=&scenario=empty&eventId=`, `startedAt=${now}&offsets=&scenario=empty&extra=1`,
    `startedAt=${now}&offsets=&scenario=empty&offsets=`, `startedAt=${now}&offsets=&scenario=empty&scenario=empty`,
    `startedAt=${now+3_600_001}&offsets=12&scenario=normal`, `startedAt=${now-3_600_001}&offsets=12&scenario=normal`,
    "startedAt=NaN&offsets=12&scenario=normal", "startedAt=Infinity&offsets=12&scenario=normal",
    `startedAt=${now}&offsets=601&scenario=normal`, `startedAt=${now}&offsets=-601&scenario=normal`,
    `startedAt=${now}&offsets=1,2,3,4,5,6,7,8,9&scenario=normal`, `startedAt=${now}&offsets=1,,2&scenario=normal`,
    `startedAt=${now}&offsets=Infinity&scenario=normal`, `startedAt=${now}&offsets=NaN&scenario=normal`,
    `startedAt=${now}&offsets=1e2&scenario=normal`, `startedAt=${now}&offsets=12&scenario=normal#x`])("rejects altered premiere query %s", query => {
    expect(read("/api/visual-fixture/premiere?"+query)).toBeUndefined();
  });
  it.each(["", "0", "-600,600", "1.5,-2.25", "1,2,3,4,5,6,7,8"])("accepts bounded ordinary fixture offsets %s without forwarding it", offsets => {
    expect(read(`/api/visual-fixture/premiere?startedAt=${now}&offsets=${offsets}&scenario=normal`)?.json.entries).toEqual([]);
  });
});
