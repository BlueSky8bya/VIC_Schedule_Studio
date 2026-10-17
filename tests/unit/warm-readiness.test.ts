import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicScheduleReadiness } from "@/lib/schedules/public-loader";

const probe = vi.hoisted(() => vi.fn<(signal: AbortSignal) => Promise<PublicScheduleReadiness>>());
vi.mock("@/lib/schedules/public-loader", () => ({ probePublicScheduleRead: probe }));

beforeEach(() => { vi.resetModules(); probe.mockReset(); vi.useFakeTimers(); vi.spyOn(console, "info").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("bounded public readiness replaces the unbounded calendar cache warm", () => {
  it("shares concurrent probes and reuses success for60seconds, with no identity response fields", async () => {
    let release!: (value: PublicScheduleReadiness) => void;
    probe.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const { GET, maxDuration } = await import("@/app/api/warm/route");
    expect(maxDuration).toBe(15);
    const responses = Array.from({ length: 100 }, () => GET()); expect(probe).toHaveBeenCalledTimes(1);
    release({ ok: true }); const results = await Promise.all(responses);
    expect(results.every(response => response.status === 204)).toBe(true);
    expect(results[0].headers.get("x-warm-reuse")).toBe("miss");
    expect(results.slice(1).every(response => response.headers.get("x-warm-reuse") === "shared")).toBe(true);
    const warm = await GET(); expect(warm.status).toBe(204); expect(warm.headers.get("x-warm-reuse")).toBe("hit");
    expect(warm.headers.get("x-warm-mode")).toBe("public-readiness"); expect(warm.headers.get("x-warm-stage")).toBe("ready");
    expect(warm.headers.get("cache-control")).toBe("private, no-store"); expect(warm.headers.has("set-cookie")).toBe(false);
    expect(await warm.text()).toBe(""); expect(probe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_001); probe.mockResolvedValue({ ok: true });
    expect((await GET()).status).toBe(204); expect(probe).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  for (const reason of ["unconfigured", "unavailable", "missing"] as const) {
    it(`${reason} returns503 and only briefly backs off before a healthy retry`, async () => {
      probe.mockResolvedValueOnce({ ok: false, reason }).mockResolvedValue({ ok: true });
      const { GET } = await import("@/app/api/warm/route");
      const failed = await GET(); expect(failed.status).toBe(503); expect(failed.headers.get("x-warm-stage")).toBe(reason);
      expect((await GET()).status).toBe(503); expect(probe).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1001);
      expect((await GET()).status).toBe(204); expect(probe).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
    });
  }

  it("aborts the shared underlying probe at5seconds and reports504, then recovers", async () => {
    let active = 0; let stopped = 0;
    probe.mockImplementation(signal => new Promise(resolve => {
      active++;
      signal.addEventListener("abort", () => { active--; stopped++; resolve({ ok: false, reason: "timeout" }); }, { once: true });
    }));
    const { GET } = await import("@/app/api/warm/route");
    const first = GET(), shared = GET(); expect(active).toBe(1);
    await vi.advanceTimersByTimeAsync(4999); expect(stopped).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    for (const response of await Promise.all([first, shared])) { expect(response.status).toBe(504); expect(response.headers.get("x-warm-stage")).toBe("timeout"); }
    expect(active).toBe(0); expect(stopped).toBe(1); expect(probe).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1001); probe.mockResolvedValue({ ok: true });
    expect((await GET()).status).toBe(204);
  });
});
