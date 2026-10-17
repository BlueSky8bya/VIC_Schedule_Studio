import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ after: vi.fn(), admin: vi.fn() }));
vi.mock("next/server", () => ({ after: mock.after }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mock.admin }));
import { recordPerfSample } from "@/lib/perf/record";
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PERF_SAMPLE_RATE", "");
  mock.after.mockReset(); mock.admin.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("uniform performance sampling", () => {
  it("drops unsampled observations before scheduling lifecycle/DB work", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    recordPerfSample("synthetic-fixed-label", 200);
    expect(mock.after).not.toHaveBeenCalled(); expect(mock.admin).not.toHaveBeenCalled();
  });
  it("records a sampled observation with the original label and precision", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const insert = vi.fn().mockResolvedValue({ error: null });
    mock.admin.mockReturnValue({ from: () => ({ insert }) });
    recordPerfSample("synthetic-fixed-label", 123.456);
    await mock.after.mock.calls[0][0]();
    expect(insert).toHaveBeenCalledWith({ label: "synthetic-fixed-label", dur_ms: 123.5 });
  });
  it("supports disabling or fully sampling and fails invalid rates to the default", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.stubEnv("PERF_SAMPLE_RATE", "0"); recordPerfSample("label", 1);
    vi.stubEnv("PERF_SAMPLE_RATE", "invalid"); recordPerfSample("label", 1);
    expect(mock.after).not.toHaveBeenCalled();
    vi.stubEnv("PERF_SAMPLE_RATE", "1"); recordPerfSample("label", 1);
    expect(mock.after).toHaveBeenCalledOnce();
  });
  it("never persists invalid durations or development observations", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    for (const value of [-1, NaN, Infinity]) recordPerfSample("label", value);
    vi.stubEnv("NODE_ENV", "development"); recordPerfSample("label", 1);
    expect(mock.after).not.toHaveBeenCalled();
  });
});
