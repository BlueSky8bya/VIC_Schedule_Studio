import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ATTACH_GRACE_MS, chooseHostVisit, type HostVisit } from "@/lib/activity/visit-attach";

// 2026-08-05 실측: 관리자 방문(16:33~17:44, 60분)의 타임라인이 '항목 1건'이었다. DB에는 같은
// 탭의 기록이 10건 있었는데, 로드 직후 2건만 visit_key가 null이라(비콘이 키를 넣기 전) 방문이
// 둘로 갈렸다. 붙이기 규칙을 여기서 고정한다.
const T = (hhmm: string) => Date.parse(`2026-08-05T${hhmm}:00+09:00`);
const visit = (over: Partial<HostVisit> = {}): HostVisit => ({
  key: "v1",
  accountHash: "acct-a",
  role: "owner",
  startMs: T("16:53"),
  endMs: T("17:44"),
  ...over
});

describe("chooseHostVisit — 키 없는 기록을 제 방문에 붙인다", () => {
  it("같은 계정·역할의 방문 구간 안이면 붙인다", () => {
    const got = chooseHostVisit({ t: T("17:00"), accountHash: "acct-a", role: "owner" }, [visit()]);
    expect(got?.key).toBe("v1");
  });

  it("방문 시작 '직전'도 붙인다 — 로드 직후 기록이 비콘보다 먼저 나가는 경합이 원인이다", () => {
    // 16:33 route.enter → 방문의 첫 키 기록은 16:53. 20분 차이는 유예(5분) 밖이라 안 붙는다.
    expect(
      chooseHostVisit({ t: T("16:33"), accountHash: "acct-a", role: "owner" }, [visit()])
    ).toBeNull();
    // 유예 안(예: 16:50)이면 같은 방문으로 본다.
    expect(
      chooseHostVisit({ t: T("16:50"), accountHash: "acct-a", role: "owner" }, [visit()])?.key
    ).toBe("v1");
  });

  it("유예는 5분", () => {
    expect(ATTACH_GRACE_MS).toBe(5 * 60_000);
    const v = visit();
    const justIn = v.startMs - ATTACH_GRACE_MS + 1_000;
    const justOut = v.startMs - ATTACH_GRACE_MS - 1_000;
    expect(chooseHostVisit({ t: justIn, accountHash: "acct-a", role: "owner" }, [v])).not.toBeNull();
    expect(chooseHostVisit({ t: justOut, accountHash: "acct-a", role: "owner" }, [v])).toBeNull();
  });

  it("계정이 없으면(비로그인) 절대 안 붙인다 — 익명끼리 뭉치면 남의 행동이 섞인다", () => {
    expect(
      chooseHostVisit({ t: T("17:00"), accountHash: null, role: "anon" }, [
        visit({ accountHash: null, role: "anon" })
      ])
    ).toBeNull();
  });

  it("다른 계정·다른 역할에는 안 붙는다", () => {
    expect(
      chooseHostVisit({ t: T("17:00"), accountHash: "acct-b", role: "owner" }, [visit()])
    ).toBeNull();
    expect(
      chooseHostVisit({ t: T("17:00"), accountHash: "acct-a", role: "developer" }, [visit()])
    ).toBeNull();
  });

  it("겹치는 후보가 여럿이면 시간상 가장 가까운 방문", () => {
    const early = visit({ key: "early", startMs: T("10:00"), endMs: T("16:40") });
    const late = visit({ key: "late", startMs: T("16:53"), endMs: T("17:44") });
    expect(
      chooseHostVisit({ t: T("16:50"), accountHash: "acct-a", role: "owner" }, [early, late])?.key
    ).toBe("late");
    expect(
      chooseHostVisit({ t: T("16:42"), accountHash: "acct-a", role: "owner" }, [early, late])?.key
    ).toBe("early");
  });
});

const QUERY = fs.readFileSync(path.join(process.cwd(), "lib/activity/query.ts"), "utf8");
const CLIENT = fs.readFileSync(path.join(process.cwd(), "lib/activity/client.ts"), "utf8");

describe("묶기 순서 — 키 있는 행으로 뼈대를 먼저 세운다", () => {
  it("한 번에 훑으며 '그때까지 만들어진 방문'에 얹지 않는다", () => {
    // 예전 구현의 흔적: 키 없는 행을 처리하며 그 자리에서 mine/host를 찾던 코드.
    expect(QUERY).not.toContain("const mine = r.account_hash");
    expect(QUERY).toContain("chooseHostVisit(");
    // 뼈대 → 붙이기 두 번의 루프.
    expect(QUERY).toContain("if (!r.visit_key) continue;");
    expect(QUERY).toContain("if (r.visit_key) continue;");
  });
  it("두 번에 나눠 담았으니 방문 안 시간 순서를 다시 맞춘다", () => {
    expect(QUERY).toContain("v.items.sort((a, b) => a.t - b.t)");
  });
  it("방문의 진짜 구간(visit_session)을 먼저 근거로 쓴다", () => {
    // 행동 기록만 보면 '첫 키 있는 기록' 이후만 알 수 있다 — 세션 행은 시작 시각을 안다.
    expect(QUERY).toContain('.from("visit_session")');
    expect(QUERY).toContain("chooseHostVisit(ev, spanHosts, 60_000)");
  });
});

describe("클라이언트는 보낼 때 방문 키를 다시 찍는다", () => {
  it("쌓을 때만 읽으면 로드 직후 기록이 키 없이 저장된다", () => {
    const send = CLIENT.slice(CLIENT.indexOf("function send("), CLIENT.indexOf("function flush("));
    expect(send).toContain("e.visitKey ? e : { ...e, visitKey: currentVisitKey() }");
    expect(send).toContain("JSON.stringify({ events: stamped })");
  });
});
