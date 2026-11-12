import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: () => null }));
import { chatJobOutcome, MAX_GAP_RETRIES } from "@/lib/broadcast/vod-chat";

// 빠진 조각이 영영 안 받아지는 다시보기가 누적 상태를 끝없이 들고 있던 문제(2026-11-13, 0161).
describe("chatJobOutcome", () => {
  it("다 받으면 완료, 재시도 0", () => {
    expect(chatJobOutcome(true, 0, 7)).toEqual({ complete: true, retries: 0, gaveUp: false });
  });
  it("아직 훑는 중이면 미완료, 재시도 그대로 0", () => {
    expect(chatJobOutcome(false, 3, 0)).toEqual({ complete: false, retries: 0, gaveUp: false });
  });
  it("빠진 조각이 있으면 재시도를 센다", () => {
    expect(chatJobOutcome(true, 2, 4)).toEqual({ complete: false, retries: 5, gaveUp: false });
  });
  it("한도에 닿으면 받은 만큼으로 마무리(상태 비움 = complete)", () => {
    expect(chatJobOutcome(true, 2, MAX_GAP_RETRIES - 1)).toEqual({ complete: true, retries: 0, gaveUp: true });
    expect(chatJobOutcome(true, 1, 52)).toEqual({ complete: true, retries: 0, gaveUp: true });
  });
});
