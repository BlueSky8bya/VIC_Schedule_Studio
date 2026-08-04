import { headers } from "next/headers";
import { after } from "next/server";
import type { CurrentActor } from "@/lib/auth/actor";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { accountHashOf } from "@/lib/insights/account-hash";
import {
  accountHashForRole,
  deviceFromUserAgent,
  isClientKind,
  isServerKind,
  sanitizeMeta,
  sanitizeTarget,
  type ActivityKind,
  type ActivitySource
} from "@/lib/activity/kinds";

// KST 날짜(방문 기록과 같은 규칙 +9h) — 범위 조회·보존 청소의 기준.
function kstDayString(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 행동 기록 쓰기(0062). 서버 이벤트 = 권한을 통과한 실제 변경(진실). 실패해도 앱 동작을 막지 않는다.
//
// ⚠ 호출 위치: 서버 액션 / 라우트 핸들러에서만. **페이지 렌더 중에는 부르지 말 것** —
//    렌더 중 after() 예약이 이후 cookies() 호출을 "inside after"로 오검출시켜 dev에서 RSC refresh가
//    간헐적으로 터진 전례가 있다(a0b22a9, perf 표본에서 실측).
//
// ⚠ meta에 일정 제목·본문을 절대 넣지 말 것. sanitizeMeta가 이름·형태로 한 번 더 막지만,
//    호출부에서 안 넣는 게 1차 방어다. target에는 uuid만 둔다.

export type ActivityInput = {
  kind: ActivityKind;
  target?: string | null;
  meta?: Record<string, unknown> | null;
  durMs?: number | null;
  visitKey?: string | null;
  /** 이미 구한 actor가 있으면 넘긴다(resolveCurrentActor는 요청 단위 캐시라 없어도 싸다). */
  actor?: CurrentActor;
  /** 클라 배치(/api/activity)가 넘겨준 값. 없으면 서버 이벤트로 본다. */
  source?: ActivitySource;
  device?: string;
};

async function buildRow(input: ActivityInput) {
  const source: ActivitySource = input.source ?? "server";
  // 클라는 server kind를 사칭할 수 없다 — 진실 로그가 오염되면 "고쳤다"를 못 믿는다.
  if (source === "client" ? !isClientKind(input.kind) : !isServerKind(input.kind)) return null;

  const actor = input.actor ?? (await resolveCurrentActor("vic"));
  const role = actor.isAuthenticated ? actor.role : "anon";
  const rawHash = actor.isAuthenticated && actor.email ? accountHashOf(actor.email) : null;

  let device = input.device;
  if (!device) {
    try {
      device = deviceFromUserAgent((await headers()).get("user-agent"));
    } catch {
      device = "desktop"; // headers() 불가 컨텍스트
    }
  }

  return {
    day: kstDayString(),
    visit_key: input.visitKey ? input.visitKey.slice(0, 64) : null,
    // 내부자만 식별. viewer·비로그인은 여기서 null이 된다(읽는 쪽이 아니라 쓰는 쪽에서 막는다).
    account_hash: accountHashForRole(role, rawHash),
    role,
    device,
    source,
    kind: input.kind,
    target: sanitizeTarget(input.target),
    meta: sanitizeMeta(input.meta),
    dur_ms:
      typeof input.durMs === "number" && Number.isFinite(input.durMs)
        ? Math.max(0, Math.round(input.durMs))
        : null
  };
}

async function insertRows(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const sb = createSupabaseAdminClient();
    if (!sb) return;
    await sb.from("activity_event").insert(rows);
  } catch {
    /* 보조 기능 — 기록 실패는 무시한다(앱 동작을 막지 않는다) */
  }
}

/** 서버 이벤트 1건. 응답 이후(after)에 남겨 응답 지연 0. after가 불가하면 그 자리에서 기다린다. */
export async function recordActivity(input: ActivityInput): Promise<void> {
  const row = await buildRow(input);
  if (!row) return;
  try {
    after(async () => {
      await insertRows([row]);
    });
  } catch {
    await insertRows([row]); // after() 불가 컨텍스트(테스트·일부 런타임)
  }
}

/** 클라 배치(/api/activity) 전용 — 한 번에 여러 건. actor·device를 한 번만 구해 재사용한다. */
export async function recordActivityBatch(
  events: Omit<ActivityInput, "actor" | "source" | "device">[],
  ctx: { device?: string } = {}
): Promise<number> {
  if (events.length === 0) return 0;
  const actor = await resolveCurrentActor("vic");
  const device =
    ctx.device ??
    (await (async () => {
      try {
        return deviceFromUserAgent((await headers()).get("user-agent"));
      } catch {
        return "desktop";
      }
    })());
  const rows = [];
  for (const e of events) {
    const row = await buildRow({ ...e, actor, device, source: "client" });
    if (row) rows.push(row);
  }
  await insertRows(rows);
  return rows.length;
}
