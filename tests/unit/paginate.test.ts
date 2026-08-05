import { describe, expect, it } from "vitest";
import { DEFAULT_HARD_CAP, PAGE_SIZE, fetchAllRows } from "@/lib/db/paginate";

// 이 저장소가 두 번 당한 함정(PostgREST 1000행 cap)의 단일 해법을 못박는다.
// 실측 사고 ①: 방문 목록이 15:29에서 멈추고 그 뒤 관리자 방문이 통째로 사라짐.
// 실측 사고 ②: 월별 패널의 뒷날짜 세션이 사라짐.
// 둘 다 오류 없이 조용히 잘렸다 — 그래서 "몇 행 받았나"가 아니라 **끝까지 받았나**를 테스트한다.

/** from..to 범위를 흉내 내는 가짜 테이블. 호출 이력도 남긴다. */
function fakeTable(total: number, opts: { errorAtPage?: number } = {}) {
  const calls: Array<[number, number]> = [];
  const rows = Array.from({ length: total }, (_, i) => ({ i }));
  const make = (from: number, to: number) => {
    calls.push([from, to]);
    if (opts.errorAtPage !== undefined && calls.length - 1 === opts.errorAtPage) {
      return Promise.resolve({ data: null, error: { message: "boom" } });
    }
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { make, calls };
}

describe("fetchAllRows — 1000행에서 잘리지 않는다", () => {
  it("한 페이지보다 적으면 한 번만 왕복한다", async () => {
    const t = fakeTable(10);
    const out = await fetchAllRows(t.make);
    expect(out).toHaveLength(10);
    expect(t.calls).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it("cap을 넘는 데이터도 전부 받는다(2500행 = 3회)", async () => {
    const t = fakeTable(2500);
    const out = await fetchAllRows<{ i: number }>(t.make);
    expect(out).toHaveLength(2500);
    expect(out[0].i).toBe(0);
    expect(out[2499].i).toBe(2499);
    expect(t.calls).toHaveLength(3);
    expect(t.calls[1]).toEqual([PAGE_SIZE, PAGE_SIZE * 2 - 1]);
  });

  it("정확히 배수면 빈 페이지를 한 번 더 확인하고 끝낸다(경계에서 안 놓친다)", async () => {
    const t = fakeTable(PAGE_SIZE);
    const out = await fetchAllRows(t.make);
    expect(out).toHaveLength(PAGE_SIZE);
    expect(t.calls).toHaveLength(2); // 두 번째는 빈 페이지
  });

  it("중간에 오류가 나면 그때까지 받은 것만 돌려준다(무너지지 않는다)", async () => {
    const t = fakeTable(2500, { errorAtPage: 1 });
    const out = await fetchAllRows(t.make);
    expect(out).toHaveLength(PAGE_SIZE);
  });

  it("hardCap이 무한 루프를 막는다", async () => {
    // 항상 꽉 찬 페이지를 주는(=끝이 없는) 소스.
    const calls: number[] = [];
    const endless = (from: number) => {
      calls.push(from);
      return Promise.resolve({
        data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ i })),
        error: null
      });
    };
    const out = await fetchAllRows(endless, 3000);
    expect(calls).toHaveLength(3);
    expect(out).toHaveLength(3 * PAGE_SIZE);
    expect(DEFAULT_HARD_CAP).toBeGreaterThan(10_000);
  });

  it("data가 null이면 멈춘다(권한·RLS 거부)", async () => {
    const out = await fetchAllRows(() => Promise.resolve({ data: null, error: null }));
    expect(out).toEqual([]);
  });
});

describe("호출부는 페이지네이션 규칙을 재구현하지 않는다", () => {
  it("공용 헬퍼 한 곳만 PAGE 루프를 갖는다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = ["lib/activity/query.ts", "lib/insights/actions.ts"];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(src).toContain('from "@/lib/db/paginate"');
      // 로컬 재구현(자체 PAGE 상수 + range 루프)이 다시 생기면 잡는다.
      expect(src).not.toMatch(/const PAGE = 1000;/);
    }
  });
});
