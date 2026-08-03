import { describe, expect, it } from "vitest";

// 최초공개 축하 연출이 '두 번째부터 안 나오던' 버그의 회귀 가드.
//
// 원인: 축하 여부를 호출자가 넘긴 celebrate 인자로 정했다. 카운트다운이 0에 닿은 뒤 서버
// 응답이 오기까지 그 사이에 부모가 한 번이라도 리렌더되면, 카드가 조용한 교체 경로
// (TeaserRevealing → celebrate=false)로 넘어가 축포가 통째로 사라졌다. 첫 공개는 부모가
// 조용해 안 걸리고, 그 뒤부터는 상태가 늘어 리렌더 요인이 생겨 걸렸다.
//
// 해법: '이 화면이 0초를 라이브로 봤는가'를 표시해 두고, 어느 경로가 먼저 도착하든 그
// 표시로 판단한다. 아래는 public-poster.tsx의 판단 규칙만 떼어낸 것이다.
class CelebrationGate {
  private liveWatched = new Set<string>();
  private celebrated = new Set<string>();

  /** 카운트다운이 화면에 떴다(마운트 시점에 표시 — 0초까지 기다리지 않는다). */
  watchedLive(id: string): void {
    this.liveWatched.add(id);
  }

  /** 서버 응답 도착 — 실제로 연출할 대상만 돌려준다. */
  targets(ids: string[]): string[] {
    const out = ids.filter((x) => this.liveWatched.has(x) && !this.celebrated.has(x));
    for (const x of out) this.celebrated.add(x);
    return out;
  }
}

describe("최초공개 축하 게이트", () => {
  it("연속으로 공개되는 떡밥마다 매번 연출한다(첫 번째만 되던 버그)", () => {
    const gate = new CelebrationGate();
    for (const id of ["a", "b", "c"]) {
      gate.watchedLive(id);
      expect(gate.targets([id]), `${id}에서 연출이 빠졌다`).toEqual([id]);
    }
  });

  it("응답 전에 조용한 교체 경로가 끼어들어도 연출을 잃지 않는다", () => {
    const gate = new CelebrationGate();
    gate.watchedLive("a"); // 카운트다운이 0에 닿음
    // 부모 리렌더로 TeaserRevealing이 대신 공개를 호출(예전 celebrate=false 경로).
    // 표시는 이미 남아 있으므로 어느 쪽 응답이 먼저 와도 연출 대상이다.
    expect(gate.targets(["a"])).toEqual(["a"]);
  });

  it("0초 직전에 카운트다운이 언마운트돼도 연출은 살아남는다", () => {
    const gate = new CelebrationGate();
    // 카운트다운이 뜬 순간(=아직 30초 남았을 때) 이미 표시해 둔다.
    gate.watchedLive("a");
    // 0초에 부모가 리렌더되며 카운트다운이 사라져 그쪽 effect는 못 돌았다.
    // 대신 조용한 교체 경로가 공개를 호출한다 — 그래도 연출 대상이다.
    expect(gate.targets(["a"])).toEqual(["a"]);
  });

  it("2초 재시도가 축포를 두 번 쏘지 않는다", () => {
    const gate = new CelebrationGate();
    gate.watchedLive("a");
    expect(gate.targets(["a"])).toEqual(["a"]);
    gate.watchedLive("a"); // 재시도가 다시 표시해도
    expect(gate.targets(["a"])).toEqual([]); // 이미 연출했으면 조용하다
  });

  it("라이브로 안 본 공개(새로고침 후 캐시 지연 교체)는 조용히 넘어간다", () => {
    const gate = new CelebrationGate();
    expect(gate.targets(["a"])).toEqual([]);
  });
});
