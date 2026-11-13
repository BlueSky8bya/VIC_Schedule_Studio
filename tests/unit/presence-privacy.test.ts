import { describe, expect, it, vi } from "vitest";
import { detectDevice } from "@/lib/presence/presence-client";

// 실시간 접속 현황(동접)·방문 세션은 2026-11-13 철수했다. 남은 것은 기기 분류(설정·행동 기록용)뿐이다.
describe("local device classification", () => {
  it("retains local device classification without starting a connection", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone)" });
    try { expect(detectDevice()).toBe("ios"); }
    finally { vi.unstubAllGlobals(); }
  });
});
