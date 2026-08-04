"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails } from "@/lib/auth/config";
import { accountHashOf } from "@/lib/insights/account-hash";
import { ACTIVITY_RETENTION_DAYS, KIND_LABEL } from "@/lib/activity/kinds";

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

export async function getActivityDayAction(day: string): Promise<ActivityDayResult> {
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
  void supabase.from("activity_event").delete().lt("day", cutoff);

  const { data, error } = await supabase
    .from("activity_event")
    .select("occurred_at, visit_key, account_hash, role, device, source, kind, target, meta, dur_ms")
    .eq("day", day)
    .order("occurred_at", { ascending: true })
    .limit(5000);
  if (error) {
    return { ok: false, error: "행동 기록을 불러오지 못했어요." };
  }
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { ok: true, visits: [], total: 0 };

  // 일정 제목 — 공개 일정만 붙인다. 비공개는 범위 라벨로 대체(제목을 절대 내보내지 않는다).
  const eventIds = [...new Set(rows.map((r) => r.target).filter((t): t is string => Boolean(t)))];
  const titleById = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: evs } = await supabase
      .from("events")
      .select("id, public_title, visibility_scope")
      .in("id", eventIds.slice(0, 500));
    for (const e of (evs ?? []) as {
      id: string;
      public_title: string | null;
      visibility_scope: string;
    }[]) {
      titleById.set(
        e.id,
        e.visibility_scope === "public"
          ? (e.public_title ?? "(제목 없음)")
          : (SCOPE_LABEL[e.visibility_scope] ?? "(비공개 일정)")
      );
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
      noKey += 1;
      key = `no-key:${noKey}`;
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
