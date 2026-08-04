// 방문 = '탭 수명'(0061) — 순수 계산만. actions.ts는 "use server"라 동기 함수를 export할 수 없어
// 여기로 뺐다(테스트도 여기에 붙는다: tests/unit/visit-fold.test.ts).
//
// visit_session 1행은 '화면이 보인 한 구간'이다. 문서 네비게이션(pagehide)마다 구간이 끊기므로
// 사이트 안에서 페이지를 옮기기만 해도 행이 늘어난다. 그대로 세면
//   1) 많이 돌아다니는 역할일수록 방문수가 부풀어 역할 간 비교가 오염되고
//      (스튜디오는 / ↔ /studio layout이 달라 이동마다 끊기고, 잠금해제는 하드 리로드까지 한다)
//   2) 평균 체류가 조각난다.
// 실측(2026-08-04 04:11~04:20, owner 단독): 공백 0의 연속 9분 1회 방문이 4행(4초/5분/7초/4분)으로
// 찍혔다. 4초·7초는 이탈이 아니라 문서 이동 자리였다.
//
// 그래서 집계 전에 두 단계로 접는다:
//   1) 같은 탭(visit_key)의 구간들 → 한 탭 방문
//   2) 같은 계정의 탭 방문들이 시간상 겹치면 → 한 사람 방문(창 2개를 나란히 띄운 경우)
// account_hash가 없는 행(비로그인·visit_key 도입 전 옛 행)은 서로 다른 사람일 수 있으므로
// 2단계에서 절대 합치지 않는다.
//
// 체류는 구간의 '합집합'으로 잰다 — 단순 합은 창 2개가 동시에 떠 있는 시간을 두 번 센다.

export type Span = { s: number; e: number };

export type SessionRow = {
  day: string;
  role: string;
  device: string;
  account_hash: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  visit_key: string | null;
  // ↓ foldVisits가 채우는 파생값(DB 컬럼 아님). 원본 구간에는 없다.
  active_ms?: number; // 화면에 떠 있던 시간의 합집합 = 실측 체류
  spans?: Span[]; // 이 방문을 이루는 실제 가시 구간들(시간대 분포·동접 스윕용)
  segments?: number; // 몇 조각으로 쪼개져 있었나(문서 이동 횟수 = segments-1)
};

export function sStart(r: SessionRow): number {
  return new Date(r.started_at).getTime();
}

// 유효 종료 = ended_at(없으면 last_seen_at). 최소 1초(0초 방문도 한 조각 잡히게).
export function sEnd(r: SessionRow): number {
  const start = sStart(r);
  const raw = new Date(r.ended_at ?? r.last_seen_at).getTime();
  return Number.isFinite(raw) && raw > start ? raw : start + 1000;
}

// 세션 체류(ms). 의미 방문 컷·바운스·KPI 공용.
// 접힌 행은 active_ms(가시 구간 합집합)를 쓴다 — 방문 span에는 자리비움이 섞여 있어 end-start로
// 재면 "탭만 열어둔 시간"까지 체류로 잡힌다.
export function durMs(r: SessionRow): number {
  if (typeof r.active_ms === "number") return Math.max(0, r.active_ms);
  return Math.max(0, sEnd(r) - sStart(r));
}

// 이 행이 실제로 화면에 떠 있던 구간들. 접히지 않은 원본은 자기 자신 하나.
export function visitSpans(r: SessionRow): Span[] {
  return r.spans ?? [{ s: sStart(r), e: sEnd(r) }];
}

export function unionSpans(spans: Span[]): Span[] {
  if (spans.length <= 1) return spans.map((sp) => ({ ...sp }));
  const sorted = [...spans].sort((a, b) => a.s - b.s);
  const out: Span[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = out[out.length - 1];
    const next = sorted[i];
    if (next.s > cur.e) out.push({ ...next });
    else if (next.e > cur.e) cur.e = next.e;
  }
  return out;
}

// 구간 묶음 → 방문 한 줄. 역할·기기는 가장 오래 머문 조각 기준(같은 탭이라도 로그인 전후로 바뀔 수 있다).
function foldOne(rows: SessionRow[]): SessionRow {
  const spans = unionSpans(rows.flatMap(visitSpans));
  const main = [...rows].sort((a, b) => durMs(b) - durMs(a))[0];
  const segments = rows.reduce((n, r) => n + (r.segments ?? 1), 0);
  const endIso = new Date(spans[spans.length - 1].e).toISOString();
  // '미종료'는 마지막 조각에서 승계한다 — 무조건 채우면 비콘 end 유실 점검(openRate)이 항상 0이 된다.
  const lastRow = rows.reduce((a, b) => (sEnd(b) > sEnd(a) ? b : a));
  return {
    ...main,
    account_hash: rows.find((r) => r.account_hash)?.account_hash ?? null,
    started_at: new Date(spans[0].s).toISOString(),
    ended_at: lastRow.ended_at ? endIso : null,
    last_seen_at: endIso,
    active_ms: spans.reduce((sum, sp) => sum + (sp.e - sp.s), 0),
    spans,
    segments
  };
}

export function foldVisits(rows: SessionRow[]): SessionRow[] {
  // 1) 탭 단위. visit_key는 uuid라 그 자체로 탭을 특정한다. 없으면(옛 행) 한 행이 곧 한 탭.
  const tabs = new Map<string, SessionRow[]>();
  rows.forEach((r, i) => {
    const key = r.visit_key ? `${r.day}|k:${r.visit_key}` : `${r.day}|r:${i}`;
    const bucket = tabs.get(key);
    if (bucket) bucket.push(r);
    else tabs.set(key, [r]);
  });
  // 2) 같은 계정의 겹치는 탭 방문을 합친다. 계정 미상은 그대로 둔다.
  const out: SessionRow[] = [];
  const byAccount = new Map<string, SessionRow[]>();
  for (const segs of tabs.values()) {
    const visit = foldOne(segs);
    if (!visit.account_hash) {
      out.push(visit);
      continue;
    }
    const key = `${visit.day}|${visit.account_hash}`;
    const bucket = byAccount.get(key);
    if (bucket) bucket.push(visit);
    else byAccount.set(key, [visit]);
  }
  for (const group of byAccount.values()) {
    group.sort((a, b) => sStart(a) - sStart(b));
    let cur: SessionRow | null = null;
    for (const v of group) {
      if (cur && sStart(v) <= sEnd(cur)) cur = foldOne([cur, v]);
      else {
        if (cur) out.push(cur);
        cur = v;
      }
    }
    if (cur) out.push(cur);
  }
  return out.sort((a, b) => sStart(a) - sStart(b));
}
