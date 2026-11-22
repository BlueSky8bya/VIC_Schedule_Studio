import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { gmailConfigured, sendGmail } from "@/lib/reports/gmail";

// 고장 알림(2026-11-23 소유자) — 개발자가 사이트를 들여다보지 않아도, 고장 났을 때만 개발자 메일로 한 통 간다.
// 평소에는 아무것도 보내지 않고, 같은 고장은 일주일에 한 번만 알린다(site_alert_state, 0173).
// 부르는 곳 둘: Workers 예약 작업(매시, app/api/cron/insights-archive)과 DB의 pg_cron(6시간마다, app/api/cron/health).
// 한쪽 예약 작업이 멈춰도 다른 쪽이 점검을 이어 간다. 사이트·도메인이 통째로 내려가면 여기서는 알릴 수 없다
// (메일을 보내는 것이 이 사이트이므로) — 그 경우는 Cloudflare의 결제·도메인 메일이 알린다.

export const DB_LIMIT_BYTES = 500 * 1024 * 1024; // Supabase 무료 DB 한도
export const DB_WARN_RATIO = 0.8;
export const ALERT_REPEAT_MS = 7 * 86400_000;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type HealthSnapshot = {
  now?: string | null;
  db_bytes?: number | null;
  last_live_at?: string | null;
  last_vod_sync_at?: string | null;
  last_session_started_at?: string | null;
  search_graph_at?: string | null;
  cron_failed?: Record<string, number> | null;
  http_total?: number | null;
  http_bad?: number | null;
};

export type HealthAlert = { kind: string; title: string; detail: string };

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN);
const ago = (now: number, at: number) => {
  const h = Math.floor((now - at) / HOUR);
  return h >= 48 ? `${Math.floor(h / 24)}일` : `${h}시간`;
};
const kst = (at: number) =>
  new Date(at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 지금 고장으로 볼 것들 — 순수 판정(DB·메일 없이 검사할 수 있게). */
export function evaluateHealth(s: HealthSnapshot, now: number = Date.now()): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  // 1) 방송 감지(매분 도는 예약 작업). 방송 중엔 '마지막으로 방송 중이던 시각'이, 방송이 없을 땐 다시보기 수집 시각이
  //    계속 새로 찍힌다. 둘 다 하루 넘게 그대로면 예약 작업이 멈춘 것(며칠짜리 방송 중에는 수집이 쉬므로 둘 중 늦은 쪽을 본다).
  const beat = Math.max(ms(s.last_live_at) || 0, ms(s.last_vod_sync_at) || 0);
  if (beat > 0 && now - beat > DAY) {
    alerts.push({
      kind: "poll-stopped",
      title: "방송 감지·다시보기 수집이 멈췄어요",
      detail: `마지막으로 움직인 때: ${kst(beat)} (${ago(now, beat)} 전). 매분 도는 예약 작업이 돌지 않는 것으로 보여요.\n` +
        "확인할 곳: Cloudflare → Workers → vic-schedule-studio → 설정의 Cron Triggers와 비밀값 CRON_SECRET, 그리고 최근 배포가 실패하지 않았는지."
    });
  }

  // 2) 방송 기록이 3주째 없다 — 긴 휴방이 아니면 숲(SOOP) 쪽 주소·응답이 바뀌어 방송을 못 알아보는 것일 수 있다.
  const lastStart = ms(s.last_session_started_at);
  const lastLive = ms(s.last_live_at);
  const lastBroadcast = Math.max(lastStart || 0, lastLive || 0);
  if (lastBroadcast > 0 && now - lastBroadcast > 21 * DAY && !(beat > 0 && now - beat > DAY)) {
    alerts.push({
      kind: "no-broadcast",
      title: "3주째 방송 기록이 없어요",
      detail: `마지막 방송 기록: ${kst(lastBroadcast)}. 긴 휴방이면 그냥 두면 됩니다.\n` +
        "방송을 하고 있는데 이 메일이 왔다면 숲(SOOP)이 방송 상태를 알려 주는 방식이 바뀐 것일 수 있어요(lib/broadcast/soop.ts)."
    });
  }

  // 3) DB 예약 작업 실패(최근 24시간 3건 이상).
  const failed = Object.entries(s.cron_failed ?? {});
  const failedTotal = failed.reduce((sum, [, n]) => sum + Number(n), 0);
  if (failedTotal >= 3) {
    alerts.push({
      kind: "db-jobs-failing",
      title: "DB 예약 작업이 실패하고 있어요",
      detail: `최근 24시간 실패 ${failedTotal}건: ${failed.map(([name, n]) => `${name} ${n}건`).join(", ")}.\n` +
        "확인할 곳: Supabase → Integrations → Cron → 실행 기록(또는 SQL: select * from cron.job_run_details where status = 'failed' order by start_time desc)."
    });
  }

  // 4) DB가 사이트를 부르는 호출(다시보기 채팅 수집, 5분마다)이 대부분 실패.
  const total = Number(s.http_total ?? 0);
  const bad = Number(s.http_bad ?? 0);
  if (total >= 20 && bad / total >= 0.8) {
    alerts.push({
      kind: "db-calls-failing",
      title: "다시보기 채팅 수집 호출이 실패하고 있어요",
      detail: `DB가 사이트를 부른 최근 ${total}번 중 ${bad}번이 실패했어요.\n` +
        "도메인이 바뀌었거나 인증(Vault의 vic_cron_token)이 맞지 않을 때 생깁니다. 확인: select status_code, error_msg, created from net._http_response order by created desc limit 20."
    });
  }

  // 5) 검색 연관어 밤 작업이 사흘 넘게 끝나지 못함.
  const graph = ms(s.search_graph_at);
  if (Number.isFinite(graph) && now - graph > 3 * DAY) {
    alerts.push({
      kind: "search-graph-stale",
      title: "검색 연관어 갱신이 멈췄어요",
      detail: `마지막으로 끝난 때: ${kst(graph)} (${ago(now, graph)} 전). 매일 새벽 3시 20분에 도는 작업이 끝까지 못 가고 있어요.\n` +
        "검색은 되지만 '화제'와 연관어가 옛 것으로 남습니다. 데이터가 늘어 시간 제한(20분)에 걸렸을 수 있어요(select public.search_graph_nightly();로 직접 돌려 경고를 확인)."
    });
  }

  // 6) DB 용량.
  const bytes = Number(s.db_bytes ?? 0);
  if (bytes >= DB_LIMIT_BYTES * DB_WARN_RATIO) {
    const mb = Math.round(bytes / 1024 / 1024);
    alerts.push({
      kind: "db-nearly-full",
      title: `DB가 거의 찼어요 (${mb}MB / 500MB)`,
      detail: `무료 한도 500MB의 ${Math.round((bytes / DB_LIMIT_BYTES) * 100)}%입니다. 한도를 넘으면 DB가 읽기 전용이 되어 일정 저장이 전부 막혀요.\n` +
        "할 수 있는 것: 오래된 다시보기 채팅 단어(vod_chat_terms)를 지우거나, Supabase를 유료(월 25달러, 8GB)로 올립니다. 큰 표 보기: Supabase → Database → Tables의 크기 순."
    });
  }

  return alerts;
}

export type HealthRun = {
  ok: boolean;
  alerts: string[];
  sent: string[];
  mail: "sent" | "nothing-due" | "not-configured" | "no-recipient" | "failed";
  error?: string;
};

function mailBody(alerts: HealthAlert[]): string {
  const parts = alerts.map((a, i) => `${i + 1}. ${a.title}\n${a.detail}`);
  return [
    "빅토리 방송 일정표(victory-broadcast.com)가 스스로 점검하다 문제를 찾아 보내는 메일입니다.",
    "",
    ...parts.flatMap((p) => [p, ""]),
    "같은 문제는 고쳐질 때까지 일주일에 한 번만 다시 알립니다. 문제가 없으면 메일을 보내지 않습니다."
  ].join("\n");
}

/** 점검하고, 새로 알릴 것이 있으면 개발자(platform_admins)에게 메일 한 통. test=true면 시험 메일을 무조건 보낸다. */
export async function runHealthCheck(options: { test?: boolean; now?: number } = {}): Promise<HealthRun> {
  const now = options.now ?? Date.now();
  const db = createSupabaseAdminClient();
  if (!db) return { ok: false, alerts: [], sent: [], mail: "failed", error: "no-db" };

  const { data: snapshot, error } = await db.rpc("site_health_snapshot");
  if (error || !snapshot) return { ok: false, alerts: [], sent: [], mail: "failed", error: "snapshot" };
  const alerts = evaluateHealth(snapshot as HealthSnapshot, now);

  const { data: state } = await db.from("site_alert_state").select("kind, last_sent_at");
  const lastSent = new Map(((state ?? []) as { kind: string; last_sent_at: string }[]).map((r) => [r.kind, Date.parse(r.last_sent_at)]));
  const due = alerts.filter((a) => !(now - (lastSent.get(a.kind) ?? 0) < ALERT_REPEAT_MS));
  const kinds = alerts.map((a) => a.kind);

  if (!options.test && due.length === 0) return { ok: true, alerts: kinds, sent: [], mail: "nothing-due" };
  if (!gmailConfigured()) return { ok: true, alerts: kinds, sent: [], mail: "not-configured" };

  const { data: admins } = await db.from("platform_admins").select("email");
  const to = ((admins ?? []) as { email: string | null }[])
    .map((r) => (r.email ?? "").trim())
    .filter((email) => /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email));
  if (to.length === 0) return { ok: true, alerts: kinds, sent: [], mail: "no-recipient" };

  const subject = options.test
    ? "[빅토리 방송 일정표] 고장 알림 시험 메일"
    : `[빅토리 방송 일정표] 점검 알림: ${due.map((a) => a.title).join(" / ")}`.slice(0, 180);
  const body = options.test
    ? ["고장 알림 메일이 제대로 가는지 확인하는 시험 메일입니다. 따로 할 일은 없어요.", "",
        alerts.length ? `지금 점검에 걸린 것: ${alerts.map((a) => a.title).join(" / ")}` : "지금 점검에 걸린 문제는 없습니다.",
        `DB 크기: ${Math.round(Number((snapshot as HealthSnapshot).db_bytes ?? 0) / 1024 / 1024)}MB / 500MB`].join("\n")
    : mailBody(due);
  const sent = await sendGmail(to.join(", "), subject, body);
  if (!sent.ok) return { ok: false, alerts: kinds, sent: [], mail: sent.reason === "not-configured" ? "not-configured" : "failed", error: sent.reason };

  // 보낸 것만 기억한다 — 못 보냈으면 다음 점검에서 다시 시도한다. 시험 메일은 기억하지 않는다.
  if (!options.test && due.length) {
    const at = new Date(now).toISOString();
    await db.from("site_alert_state").upsert(due.map((a) => ({ kind: a.kind, last_sent_at: at, detail: a.title })), { onConflict: "kind" });
  }
  return { ok: true, alerts: kinds, sent: options.test ? ["test"] : due.map((a) => a.kind), mail: "sent" };
}
