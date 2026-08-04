"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails } from "@/lib/auth/config";
import { accountHashOf } from "@/lib/insights/account-hash";
import { ACTIVITY_RETENTION_DAYS, DIAG_RETENTION_DAYS, KIND_LABEL } from "@/lib/activity/kinds";

// 행동 타임라인 조회(0062) — 개발자 전용. 한 날의 이벤트를 방문(visit_key) 단위로 묶어 돌려준다.
//
// 경계:
//  - 개발자만 호출할 수 있다(운영 지표). 공개 API는 이 테이블을 절대 건드리지 않는다.
//  - 일정 제목은 저장돼 있지 않다 → 여기서 events를 조인해 붙이되, **공개 일정 제목만** 붙인다.
//    비공개(work/owner_private)는 제목 대신 범위 라벨만 준다. 이 테이블이 owner_private 우회
//    경로가 되면 본문 암호화(AES-256-GCM)가 무의미해진다.
//  - viewer·비로그인은 애초에 account_hash가 null로 저장돼 있어(record.ts) 개인 타임라인이
//    만들어질 수 없다. 그들의 이벤트는 계정 없는 익명 방문 줄로만 보인다.

const SLUG = "vic";

// ⚠ PostgREST는 응답 행 수를 서버 설정(기본 1000)으로 자른다 — `.limit(5000)`을 줘도 1000행만
// 온다. 이 프로젝트가 전에 한 번 당한 함정이고(0051 주변, visit_session 광역 조회), 여기서
// 또 났다: 하루 기록이 1000행을 넘자 **그 뒤에 생긴 방문이 통째로 사라졌다**(실측 — 화면이
// 15:29에서 멈췄고 그 뒤 관리자 방문이 안 보였다. 조용히 잘리므로 오류도 안 난다).
// 그래서 range()로 끝까지 넘겨 받는다. 상한(hardCap)은 폭주 방지용일 뿐 정상 범위를 안 자른다.
const PAGE = 1000;
async function fetchAllRows<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  hardCap = 50_000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < hardCap; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}


export type ActivityItem = {
  t: number;
  kind: string;
  label: string;
  source: "server" | "client";
  target: string | null;
  targetLabel: string | null; // 공개 일정 제목 또는 범위 라벨. 없으면 null
  meta: Record<string, unknown> | null;
  durMs: number | null;
};
export type ActivityVisit = {
  key: string; // visit_key 또는 "no-key:<n>"
  account: string; // 이메일(알려진 계정) / "계정 #n" / "익명"
  role: string;
  device: string;
  startMs: number;
  endMs: number;
  items: ActivityItem[];
};
export type ActivityDayResult =
  | { ok: true; visits: ActivityVisit[]; total: number }
  | { ok: false; error: string };

type Row = {
  occurred_at: string;
  visit_key: string | null;
  account_hash: string | null;
  role: string;
  device: string;
  source: string;
  kind: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  dur_ms: number | null;
};

const SCOPE_LABEL: Record<string, string> = {
  work: "(작업자 전용 일정)",
  owner_private: "(엠바고 일정)",
  embargo: "(엠바고 일정)"
};

// diag=true면 진단 층까지 함께 본다(버그 추적용). 기본은 제외 — 끼면 "무엇을 했나"가 안 보인다.
export async function getActivityDayAction(
  day: string,
  includeDiag = false
): Promise<ActivityDayResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, error: "날짜 형식이 올바르지 않습니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase service role 키가 필요합니다." };
  }

  // 보존 90일 — 조회할 때 지나가며 정리한다(크론 불필요, private_unlock_attempts와 같은 패턴).
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);
  void supabase.from("activity_event").delete().lt("day", cutoff).eq("diag", false);
  void supabase.from("activity_daily_count").delete().lt("day", cutoff);
  // 진단 층은 3일만 — 촘촘한 만큼 빨리 쌓이고, 버그를 쫓을 때만 쓴다.
  const diagCutoff = new Date(Date.now() - DIAG_RETENTION_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);
  void supabase.from("activity_event").delete().lt("day", diagCutoff).eq("diag", true);

  const rows = await fetchAllRows<Row>((from, to) => {
    let q = supabase
      .from("activity_event")
      .select(
        "occurred_at, visit_key, account_hash, role, device, source, kind, target, meta, dur_ms"
      )
      .eq("day", day);
    if (!includeDiag) q = q.eq("diag", false);
    return q.order("occurred_at", { ascending: true }).range(from, to);
  });
  if (rows.length === 0) return { ok: true, visits: [], total: 0 };

  // 일정 제목 — 공개 일정만 붙인다. 비공개는 범위 라벨로 대체(제목을 절대 내보내지 않는다).
  //
  // ⚠ target에는 일정 uuid 말고 버튼 id('calendar-cell' 등)도 섞여 있다. 그대로 .in()에 넘기면
  //    uuid 컬럼 비교에서 형 변환 오류가 나 **조인 전체가 실패**하고, 모든 일정이 제목 없이
  //    '(지워진 일정)'으로 보인다(실측: 멀쩡히 살아 있는 일정이 전부 그렇게 떴다).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const eventIds = [
    ...new Set(rows.map((r) => r.target).filter((t): t is string => Boolean(t) && UUID_RE.test(t!)))
  ];
  const titleById = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: evs } = await supabase
      .from("events")
      .select("id, public_title, visibility_scope, teaser, teaser_reveal_at")
      .in("id", eventIds.slice(0, 500));
    const nowMs = Date.now();
    for (const e of (evs ?? []) as {
      id: string;
      public_title: string | null;
      visibility_scope: string;
      teaser: boolean | null;
      teaser_reveal_at: string | null;
    }[]) {
      if (e.visibility_scope !== "public") {
        titleById.set(e.id, SCOPE_LABEL[e.visibility_scope] ?? "(비공개 일정)");
        continue;
      }
      // 공개 전 떡밥은 제목을 가린다. 이 창은 편집실에서 열리고 편집실은 방송에 비칠 수 있다 —
      // 공개 시각 전 제목이 화면에 뜨면 시청자에게 새는 것과 같다(공개 로더의 가림과 같은 기준).
      const revealMs = e.teaser && e.teaser_reveal_at ? Date.parse(e.teaser_reveal_at) : 0;
      if (revealMs && nowMs < revealMs) {
        titleById.set(e.id, "(공개 전 최초공개 일정)");
        continue;
      }
      titleById.set(e.id, e.public_title ?? "(제목 없음)");
    }
  }

  // 태그 이름 — filter.tag의 target은 태그 uuid다. 이름을 안 붙이면 '(알 수 없는 항목)'으로 떠
  // "시청자가 어떤 태그를 찾는가"라는 이 이벤트의 유일한 쓸모가 사라진다(실측).
  // 태그 이름은 공개 포스터에 그대로 노출되는 값이라 여기 붙여도 새는 것이 없다.
  if (eventIds.length > 0) {
    const { data: tags } = await supabase
      .from("broadcast_tags")
      .select("id, display_name")
      .in("id", eventIds.slice(0, 500));
    for (const t of (tags ?? []) as { id: string; display_name: string | null }[]) {
      if (!titleById.has(t.id) && t.display_name) titleById.set(t.id, `#${t.display_name}`);
    }
  }

  // 알려진 계정만 이메일로 푼다 — 모르는 계정은 끝까지 익명(#n).
  const hashToEmail = new Map(getOwnerEmails().map((e) => [accountHashOf(e), e] as const));
  const { data: members } = await supabase.from("trusted_members").select("email");
  for (const m of (members ?? []) as { email: string }[]) {
    if (m.email) hashToEmail.set(accountHashOf(m.email), m.email);
  }
  const anonTag = new Map<string, number>();

  // 방문 단위로 묶는다. visit_key가 없는 건(서버 이벤트) 계정 기준으로 같은 방문에 얹는다 —
  // 서버 액션은 sessionStorage를 볼 수 없어 visit_key가 비어 있다.
  const byKey = new Map<string, ActivityVisit>();
  let noKey = 0;
  for (const r of rows) {
    const t = new Date(r.occurred_at).getTime();
    const item: ActivityItem = {
      t,
      kind: r.kind,
      label: KIND_LABEL[r.kind] ?? r.kind,
      source: r.source === "server" ? "server" : "client",
      target: r.target,
      targetLabel: r.target ? (titleById.get(r.target) ?? null) : null,
      meta: r.meta,
      durMs: r.dur_ms
    };
    let key = r.visit_key;
    if (!key) {
      // 계정이 있으면 그 계정의 '진행 중인' 방문에 붙인다(시각이 가장 가까운 것).
      const mine = r.account_hash
        ? [...byKey.values()].filter((v) => v.account !== "익명" && v.role === r.role)
        : [];
      const host = mine.length > 0 ? mine[mine.length - 1] : null;
      if (host) {
        host.items.push(item);
        host.endMs = Math.max(host.endMs, t);
        continue;
      }
      // ⚠ 키는 **안정적**이어야 한다. 예전엔 등장 순서 번호(no-key:1,2,…)를 붙였는데,
      // 리포트 복사가 진단 층까지 포함해 다시 받으면 행 수가 달라져 번호가 밀린다 →
      // 같은 번호가 **다른 방문**을 가리켜, 관리자 방문 리포트에 비로그인 항목이 담겼다(실측).
      // 계정·역할로 만들면 몇 번을 다시 받아도 같은 방문을 가리킨다.
      noKey += 1;
      key = `nk:${r.account_hash ?? `anon-${noKey}`}:${r.role}`;
    }
    const existing = byKey.get(key);
    if (existing) {
      existing.items.push(item);
      existing.endMs = Math.max(existing.endMs, t);
      continue;
    }
    let account = "익명";
    if (r.account_hash) {
      const email = hashToEmail.get(r.account_hash);
      if (email) account = email;
      else {
        if (!anonTag.has(r.account_hash)) anonTag.set(r.account_hash, anonTag.size + 1);
        account = `계정 #${anonTag.get(r.account_hash)}`;
      }
    }
    byKey.set(key, {
      key,
      account,
      role: r.role,
      device: r.device,
      startMs: t,
      endMs: t,
      items: [item]
    });
  }

  const visits = [...byKey.values()].sort((a, b) => b.startMs - a.startMs);
  return { ok: true, visits, total: rows.length };
}

// ── 사용량 집계 — "어떤 버튼·화면이 안 쓰이나" ──
// 내부자는 activity_event(행), 시청자·비로그인은 activity_daily_count(개수)에 있으므로 둘을 합친다.
// 적은 순으로 보여주는 게 요점이다: 많이 쓰이는 건 이미 알고 있고, 판단이 필요한 건 바닥 쪽이다.

export type UsageRow = {
  kind: string;
  label: string;
  target: string;
  // 역할별 횟수. 나중에 "이 기능은 매니저만 쓴다" 같은 판단을 하려면 뭉쳐두면 안 된다.
  // 비로그인은 시청자로 합친다(둘을 가르는 게 지금 판단에 보태는 게 없다).
  roles: Record<string, number>;
  total: number;
  auto: boolean; // target이 auto: 접두사 = 마크업에서 유추한 id(마크업이 바뀌면 갈라진다)
};
export type UsageResult =
  | { ok: true; rows: UsageRow[]; days: number; since: string; until: string }
  | { ok: false; error: string };

// anchor: 기준일(KST, YYYY-MM-DD). 이 날을 **끝으로** 거슬러 days일을 센다.
// 날짜 모달 안에 있는 패널이라 기준이 '오늘'이면 보고 있는 날과 어긋난다 — 8/4를 열었는데
// 오늘까지의 통계가 나오면 무엇을 보고 있는지 알 수 없다. anchor를 안 주면 오늘 기준.
export async function getActivityUsageAction(days = 30, anchor?: string): Promise<UsageResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Supabase service role 키가 필요합니다." };

  const span = Math.min(Math.max(1, Math.round(days)), ACTIVITY_RETENTION_DAYS);
  const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const until = anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : todayKst;
  const since = new Date(Date.parse(`${until}T00:00:00Z`) - (span - 1) * 86400_000)
    .toISOString()
    .slice(0, 10);

  // 여기도 같은 상한에 걸린다 — 30일치 클릭은 쉽게 1000행을 넘고, 넘는 순간 '적게 쓰인 기능'이
  // 앞쪽 1000행만 보고 순위를 매겨 조용히 틀린 답을 낸다.
  const [eventRows, countRows] = await Promise.all([
    fetchAllRows<{ kind: string; target: string | null; role: string }>((from, to) =>
      supabase
        .from("activity_event")
        .select("kind, target, role")
        .gte("day", since)
        .lte("day", until)
        .in("kind", ["ui.click", "section.enter", "route.enter"])
        .eq("diag", false)
        .range(from, to)
    ),
    fetchAllRows<{ kind: string; target: string | null; role: string; count: number }>((from, to) =>
      supabase
        .from("activity_daily_count")
        .select("kind, target, role, count")
        .gte("day", since)
        .lte("day", until)
        .in("kind", ["ui.click", "section.enter", "route.enter"])
        .range(from, to)
    )
  ]);

  const acc = new Map<string, UsageRow>();
  const bump = (kind: string, target: string | null, role: string, n: number) => {
    const t = target ?? "";
    const key = `${kind}|${t}`;
    let row = acc.get(key);
    if (!row) {
      row = {
        kind,
        label: KIND_LABEL[kind] ?? kind,
        target: t,
        roles: {},
        total: 0,
        auto: t.startsWith("auto:")
      };
      acc.set(key, row);
    }
    // 비로그인은 시청자와 **가른다**. 합쳤더니 "편집실에 시청자"처럼 설명 안 되는 줄이 생겼다
    // (로그아웃 직후 남은 배치가 세션 없이 올라가 anon으로 기록된 것). 갈라두면 그 자리에서 읽힌다.
    row.roles[role] = (row.roles[role] ?? 0) + n;
    row.total += n;
  };

  for (const r of eventRows) {
    bump(r.kind, r.target, r.role, 1); // activity_event에는 내부자만 들어간다(0063)
  }
  for (const r of countRows) {
    bump(r.kind, r.target, r.role, r.count ?? 0);
  }

  // 적은 순 — 판단이 필요한 건 바닥 쪽이다.
  const rows = [...acc.values()].sort((a, b) => a.total - b.total || a.target.localeCompare(b.target));
  return { ok: true, rows, days: span, since, until };
}
