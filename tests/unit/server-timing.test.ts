import { describe, expect, it } from "vitest";
import { ServerTiming } from "@/lib/perf/perf";

// 배경: 이 헤더 값에 한글 desc("공개 스케줄 로드")가 그대로 들어가는 바람에
// /api/public/[calendarSlug]/events가 매 요청 500이었다 —
// "Cannot convert argument to a ByteString ... value of 44277".
// HTTP 헤더는 ByteString(0~255)만 담는다. 다시는 우리말 라벨 하나로 공개 API가 죽지 않게 고정한다.
describe("ServerTiming.header()", () => {
  const isByteString = (s: string) => [...s].every((ch) => ch.charCodeAt(0) <= 255);

  it("우리말 desc가 있어도 헤더에 담을 수 있는 값만 남긴다", () => {
    const st = new ServerTiming();
    st.add("publicSchedule", 12.34, "공개 스케줄 로드");
    const header = st.header();
    expect(isByteString(header)).toBe(true);
    expect(header).toContain("publicSchedule;dur=12.3");
  });

  it("실제 Response 헤더로 넣어도 안 터진다(500의 원인이던 그 경로)", () => {
    const st = new ServerTiming();
    st.add("publicSchedule", 8, "공개 스케줄 로드");
    expect(() => new Response(null, { headers: { "Server-Timing": st.header() } })).not.toThrow();
  });

  it("담을 수 있는 desc는 그대로 둔다", () => {
    const st = new ServerTiming();
    st.add("db", 5.5, "8 parallel queries");
    expect(st.header()).toBe('db;dur=5.5;desc="8 parallel queries"');
  });

  it("여러 구간은 쉼표로 잇는다", () => {
    const st = new ServerTiming();
    st.add("a", 1, "하나");
    st.add("b", 2);
    expect(st.header()).toBe("a;dur=1.0, b;dur=2.0");
  });
});
