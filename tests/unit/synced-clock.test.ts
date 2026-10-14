import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/clock/route";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("the clock endpoint is DB-free and never cache-aged", async () => {
  const response = GET();
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(Object.keys(body)).toEqual(["serverMs"]);
  expect(Math.abs(body.serverMs - Date.now())).toBeLessThan(100);
});
it("calibration fixes five minutes of wall-clock skew and later OS jumps do not move it", async () => {
  vi.useFakeTimers({ toFake: ["Date", "performance", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-10-14T12:05:00+09:00"));
  const server = Date.parse("2026-10-14T12:00:00+09:00");
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ serverMs: server }) }));
  vi.stubGlobal("fetch", fetch);
  const clock = await import("@/lib/ui/synced-clock");
  await clock.synchronizeClock();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(clock.syncedNow()).toBe(server);
  vi.setSystemTime(new Date("2028-01-01T00:00:00+09:00"));
  expect(clock.syncedNow()).toBe(server);
  vi.advanceTimersByTime(1000);
  expect(clock.syncedNow()).toBe(server + 1000);
  clock.applyDatabaseClock(-100, 20);
  const before = clock.syncedNow();
  vi.advanceTimersByTime(500);
  expect(clock.syncedNow()).toBeGreaterThan(before);
  expect(clock.syncedNow()).toBe(server + 1450);
  vi.advanceTimersByTime(500);
  expect(clock.syncedNow()).toBe(server + 1900);
});
