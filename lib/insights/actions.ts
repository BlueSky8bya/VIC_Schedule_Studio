"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails, normalizeEmail } from "@/lib/auth/config";
import { canEditSchedule } from "@/lib/permissions/roles";
import { accountHashOf } from "@/lib/insights/account-hash";
import { fetchAllRows } from "@/lib/db/paginate";
import { kstDayKey } from "@/lib/calendar/month";
import {
  durMs,
  foldVisits,
  sEnd,
  sStart,
  visitSpans,
  type SessionRow
} from "@/lib/insights/visit-fold";

// 개발자 전용 "월별 인사이트" — 보고 있는 달(year/month) 기준 집계.
// 모든 값은 합계/개수만 — 비공개·owner_private 일정의 내용은 절대 내보내지 않는다.
// "나만"(owner_private)은 카운트 제외. "휴뱅"(방송을 안 한 표시) 태그가 붙은 일정은
// 콘텐츠/방송 집계에서 제외한다.

const SLUG = "vic";
const REST_TAG = "휴뱅";
// '기타'는 더는 실제 태그가 아니다 — 태그를 하나도 안 단 공개 일정(휴뱅 제외)을 인사이트에서만
// 묶는 합성 버킷. 실제 태그 id와 겹치지 않게 예약 키를 쓰고, 색은 흰 카드에 맞춘 중립 회색.
const ETC_KEY = "__etc__";
const ETC_LABEL = "기타";
const ETC_COLOR = "#d4d4d8";

// 2계층 태그 통계 롤업: 태그 id → 최상위 대분류 {id, name, colorKey}. 세부는 부모 대분류로 합산되어
// 통계가 잘게 쪼개지지 않는다(예: 게임>롤·명조·실크송 → '게임' 하나로). 휴뱅 등 대분류는 자기 자신.
async function loadTagCategoryMap(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  calendarId: string
): Promise<Map<string, { id: string; name: string; colorKey: string; bgHex: string | null; kind: string }>> {
  const { data } = await supabase
    .from("broadcast_tags")
    .select("id, parent_id, display_name, color_key, bg_hex, kind")
    .eq("calendar_id", calendarId);
  const rows = (data ?? []) as {
    id: string;
    parent_id: string | null;
    display_name: string;
    color_key: string;
    bg_hex: string | null;
    kind: string | null;
  }[];
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const cat = new Map<string, { id: string; name: string; colorKey: string; bgHex: string | null; kind: string }>();
  for (const r of rows) {
    let top = r;
    const guard = new Set<string>();
    while (top.parent_id && byId.has(top.parent_id) && !guard.has(top.id)) {
      guard.add(top.id);
      top = byId.get(top.parent_id)!;
    }
    // 최상위 대분류 기준 — kind는 대분류의 kind(content/modifier). bg_hex(커스텀 색)도 대분류 것.
    cat.set(r.id, {
      id: top.id,
      name: top.display_name,
      colorKey: top.color_key,
      bgHex: top.bg_hex ?? null,
      kind: top.kind === "modifier" ? "modifier" : "content"
    });
  }
  return cat;
}

export type InsightsData = {
  month: { year: number; month: number };
  content: {
    nextBroadcast: { dateKey: string; titles: string[] } | null; // 다음 방송(휴뱅 제외, 같은 날 여러 개)
    thisMonthContent: number; // 이번 달 컨텐츠 수(공개·휴뱅 제외)
    lastMonthContent: number; // 지난 달(추세 비교)
    daysWithContent: number; // 컨텐츠 있는 날 수
    restDays: number; // 휴뱅(방송 안 함) 날 수
    busiestWeekday: number | null; // 0=일..6=토
    quietestWeekday: number | null;
    tags: { name: string; count: number; bgColor: string; borderColor: string }[]; // 컨텐츠 순위
  };
  engagement: {
    monthHearts: number; // 이 달 일정이 받은 하트
    totalHearts: number; // 전체 공개 일정 누적 하트
    monthly: { ym: string; count: number }[]; // 6개월(타깃 월로 끝남)
    topEvents: { title: string; count: number }[]; // 이 달 인기 일정 TOP
  };
  security: {
    passcodeVersion: number | null;
    passcodeUpdatedAt: string | null;
    unlockDurationMinutes: number | null;
    activeUnlocks: { email: string; expiresAt: string }[];
    // (members 목록은 멤버 관리 철수(2026-09-04, ADR-0018)로 제거.)
    // 비공개를 열 수 있는 사람을 역할별로. 활성 세션이면 expiresAt·userId가
    // 채워지고(개별 만료용), 없으면 둘 다 null("세션 없음").
    access: {
      owners: AccessPerson[];
      developers: AccessPerson[];
    };
  };
  system: {
    ownerEmails: string[];
    developerEmails: string[];
    dbOwnerEmail: string | null;
    bindingOk: boolean;
    commit: string | null;
    deployedAt: string; // 빌드(배포) 시각
  };
};

export type InsightsResult = { ok: true; data: InsightsData } | { ok: false; error: string };

// 비공개 접근 자격자 한 명 — 활성 잠금 세션이 있으면 expiresAt(만료시간)·userId가 채워진다.
export type AccessPerson = { email: string; expiresAt: string | null; userId: string | null };

// '오늘(KST)' 키는 단일 출처(kstDayKey)를 쓴다 — 적재(day 컬럼)와 조회가 어긋나지 않게.
const todayKstKey = (): string => kstDayKey();
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function weekdayOf(dateKey: string): number {
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
}
// 제목은 첫 줄(첫 엔터 직전)까지만 — 일정 추가 시 엔터로 세부를 다음 줄에 적는 경우 대비.
function firstLine(s: string): string {
  return (s ?? "").split("\n")[0].trim();
}
// 계정 해시는 lib/insights/account-hash.ts 한 곳에서 정의한다 — 방문 기록과 행동 기록(0062)이
// 같은 스킴을 써야 두 테이블을 한 타임라인으로 이을 수 있다.

const ROLE_ORDER = ["anon", "viewer", "worker", "manager", "owner", "developer"] as const;
const DEVICE_SET = new Set(["desktop", "android", "ios", "mobile"]);
// 트렌드 누적 막대용 역할/기기 카테고리(라벨·색) — 클라이언트 ROLE_META/DEVICE_META와 동일.
const ROLE_TREND_META = [
  { key: "anon", label: "비로그인", color: "#c2c7d2" },
  { key: "viewer", label: "시청자", color: "#9aa0ab" },
  { key: "worker", label: "작업자", color: "#f59e0b" },
  { key: "manager", label: "매니저", color: "#7c6cf0" },
  { key: "owner", label: "관리자", color: "#34d399" },
  { key: "developer", label: "개발자", color: "#60a5fa" }
];
const DEVICE_TREND_META = [
  { key: "desktop", label: "웹", color: "#6b8cef" },
  { key: "android", label: "안드로이드", color: "#3ddc84" },
  { key: "ios", label: "iOS", color: "#a1a1aa" },
  { key: "mobile", label: "기타", color: "#f59e0b" }
];

// ── 방문/체류 통합 '세션 이벤트' 기록 ──
// 화면이 보이기 시작할 때 한 줄 생성(start) → 하트비트로 last_seen 갱신(touch) → 나갈 때 ended_at
// 확정(end). 재진입하면 또 한 줄(여러 번 기록). 역할/계정은 서버에서 실제 actor로 확인(위조 방지),
// 원문 이메일·user_id는 저장하지 않고 익명 해시만. id는 서버 생성 uuid(추측 불가)라 touch/end는 id로만.
export async function startVisitSession(
  device: string,
  anonId?: string,
  visitKey?: string
): Promise<{ ok: boolean; id?: string }> {
  const actor = await resolveCurrentActor(SLUG);
  // 비로그인 방문자도 집계한다 — role="anon"(비로그인). 로그인은 실제 역할 + 이메일 해시(하루 1인),
  // 비로그인은 기기 토큰(localStorage) 해시로 고유 방문자를 센다(없으면 null=세션 단위로만).
  const isAuthed = actor.isAuthenticated;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  const safeDevice = DEVICE_SET.has(device) ? device : "desktop";
  const anonHash = !isAuthed && anonId && anonId.length >= 8 ? accountHashOf(`anon:${anonId}`) : null;
  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("visit_session")
      .insert({
        day: todayKstKey(),
        account_hash: isAuthed && actor.email ? accountHashOf(actor.email) : anonHash,
        role: isAuthed ? actor.role : "anon",
        device: safeDevice,
        // 탭 수명 그룹 키(0061). 클라 값이라 위조 가능하지만 '구간을 잇는 키'일 뿐 — 역할·계정은
        // 위에서 서버 actor로 확정한다. 길이만 방어적으로 자른다.
        visit_key: visitKey && visitKey.length >= 8 ? visitKey.slice(0, 64) : null,
        started_at: nowIso,
        last_seen_at: nowIso
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false };
    return { ok: true, id: data.id as string };
  } catch {
    return { ok: false };
  }
}

export async function touchVisitSession(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };
  // id는 서버 생성 uuid(추측 불가)라 인증 없이 자기 세션만 갱신 가능 — 비로그인 방문도 체류 갱신.
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  try {
    const { error } = await supabase
      .from("visit_session")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function endVisitSession(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };
  // id 기반(추측 불가)이라 인증 없이 종료 가능 — 비로그인 방문도 체류 종료가 끝까지 보장된다.
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("visit_session")
      .update({ ended_at: nowIso, last_seen_at: nowIso })
      .eq("id", id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

// ── 세션 이벤트 집계 헬퍼(visit_session 기반, JS에서 계산) ──
// 규모가 작아(스트리머 1명) 행을 받아 JS로 집계한다 — 별도 RPC 불필요. 체류는 초 단위로 정확.
// 구간→방문 접기와 시간 헬퍼는 lib/insights/visit-fold.ts(순수 모듈, 단위 테스트 대상).
const KST_MS = 9 * 3600 * 1000;
function sAcct(r: SessionRow): string {
  return r.account_hash ?? "anon";
}
// 일반 관객(시청자 쪽) = 로그인 시청자 + 비로그인. 운영진(operator)은 작업자·매니저·관리자·개발자.
// 비로그인은 관객이지 운영진이 아니므로, '시청자/운영진' 2분할에선 관객 쪽으로 센다.
function isAudience(role: string): boolean {
  return role === "viewer" || role === "anon";
}
// R1: 이 시간 미만 체류는 '스쳐감'으로 보고 방문 수에서 제외(실수 진입·즉시 이탈). 동접/세션 목록엔 남긴다.
const MIN_MEANINGFUL_VISIT_MS = 3000;
// (바운스(<10초 비율) 지표는 2026-09-04 사용자 결정으로 철수 — "별 의미 없어 보임". 재도입 금지.)
function isMeaningful(r: SessionRow): boolean {
  return durMs(r) >= MIN_MEANINGFUL_VISIT_MS;
}
// 체류 표기(서버 — 자동 문장용). 60초 미만 '초', 이상 '분'. (클라 fmtDur과 동일 규칙)
function fmtDurSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}초` : `${Math.round(s / 60)}분`;
}
// 방문 품질 요약(개발자 전용). 주어진 세션들에서 의미 방문 기준으로 지표를 뽑는다.
export type VisitSummary = {
  visitors: number; // 의미 방문 순방문자((날짜|계정) 고유)
  sessions: number; // 의미 세션 수(재진입 포함)
  glances: number; // 스쳐감(<3초) 세션 수
  avgSeconds: number; // 의미 세션 평균 체류(초)
  totalSeconds: number; // 의미 세션 총 체류(초)
  peakConcurrent: number; // 범위 내 최고 동시 세션 수
};
function summarize(rows: SessionRow[]): VisitSummary {
  const meaningful = rows.filter(isMeaningful);
  const visitors = new Set(meaningful.map((r) => `${r.day}|${sAcct(r)}`)).size;
  const sessions = meaningful.length;
  const glances = rows.length - sessions;
  const totalSeconds = Math.round(meaningful.reduce((s, r) => s + durMs(r), 0) / 1000);
  const avgSeconds = sessions > 0 ? Math.round(totalSeconds / sessions) : 0;
  // 최고 동접 — 방문 span이 아니라 '실제 가시 구간'을 스윕한다(span에는 자리비움이 섞인다).
  const ev: { t: number; d: number }[] = [];
  for (const r of meaningful) {
    for (const sp of visitSpans(r)) {
      ev.push({ t: sp.s, d: 1 });
      ev.push({ t: sp.e, d: -1 });
    }
  }
  ev.sort((a, b) => a.t - b.t || a.d - b.d);
  let cnt = 0;
  let peak = 0;
  for (const e of ev) {
    cnt += e.d;
    if (cnt > peak) peak = cnt;
  }
  return { visitors, sessions, glances, avgSeconds, totalSeconds, peakConcurrent: peak };
}
function emptySummary(): VisitSummary {
  return {
    visitors: 0,
    sessions: 0,
    glances: 0,
    avgSeconds: 0,
    totalSeconds: 0,
    peakConcurrent: 0
  };
}
// 시청자 / 운영진(viewer 아님) / 전체 3분할 요약 — UI 3단 토글이 하나를 고른다(R2/R4/R5/R13).
function summarizeSplit(rows: SessionRow[]): {
  viewer: VisitSummary;
  operator: VisitSummary;
  all: VisitSummary;
} {
  return {
    viewer: summarize(rows.filter((r) => isAudience(r.role))),
    operator: summarize(rows.filter((r) => !isAudience(r.role))),
    all: summarize(rows)
  };
}
// 세션 로그 라벨 — owner만 이메일 매칭, 그 외는 역할 라벨(원문 PII 없음).
const SESSION_ROLE_LABEL: Record<string, string> = {
  anon: "비로그인",
  viewer: "시청자",
  worker: "작업자",
  manager: "매니저",
  owner: "관리자",
  developer: "개발자"
};
// 세션 로그(개발자 디버깅) — 최근 순 전체(상한 없음). 월별/일일 상세 공용.
// dualHashes: 매니저·작업자 겸업 멤버의 계정 해시 집합 → 그 매니저 세션엔 '겸' 표식(dual=true).
function buildSessionLog(
  rows: SessionRow[],
  hashToOwnerEmail: Map<string, string>,
  dualHashes: ReadonlySet<string>
): RecentSession[] {
  return [...rows]
    .sort((a, b) => sStart(b) - sStart(a))
    .map((r) => {
      const startMs = sStart(r);
      const seconds = Math.max(0, Math.round(durMs(r) / 1000)); // 실측 체류(가시 구간 합집합)
      const label =
        r.role === "owner" && r.account_hash && hashToOwnerEmail.has(r.account_hash)
          ? hashToOwnerEmail.get(r.account_hash)!
          : (SESSION_ROLE_LABEL[r.role] ?? r.role);
      return {
        t: startMs,
        role: r.role,
        device: DEVICE_SET.has(r.device) ? r.device : "desktop",
        seconds,
        meaningful: isMeaningful(r),
        label,
        // 겸업 표식 — 역할은 매니저(겸업은 매니저로 기록)지만 작업자도 겸한 멤버.
        dual: r.role === "manager" && Boolean(r.account_hash) && dualHashes.has(r.account_hash!),
        // 문서 이동으로 쪼개졌던 조각 수(0061). 1이면 한 화면에만 머문 방문.
        segments: r.segments ?? 1
      };
    });
}
// (겸업 멤버 해시(loadDualMemberHashes)는 멤버 관리 철수(2026-09-04, ADR-0018)로 삭제 — 항상 빈 집합.)
const NO_DUAL: ReadonlySet<string> = new Set<string>();
function emptyVisitSlot(): VisitSlot {
  return {
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    total: 0
  };
}
function emptyOccSlot(): OccSlot {
  return {
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    avg: 0,
    peak: 0
  };
}
// PostgREST는 한 번에 최대 1000행만 돌려준다(기본 cap). visit_session은 한 달에 수천 행이라(예: 6월
// 3500+) 그냥 select하면 1000행에서 잘려 뒷날짜(특히 운영진/owner 세션)가 통째로 사라진다 →
// .range로 끝까지 페이지네이션. make()는 매번 같은 필터의 '새' 쿼리를 만들어야 한다(빌더는 1회용).
// 정렬을 id(uuid, 유일·안정)로 고정해 페이지 경계가 어긋나지 않게 한다.
type Pageable = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};
/** 이 파일 호출부는 `() => 쿼리빌더` 형태다 — range 인자를 직접 받는 공용 헬퍼에 맞춰 주는 어댑터.
 *  페이지네이션 규칙 자체는 lib/db/paginate.ts 하나로만 존재한다(두 번 당한 1000행 cap). */
function fetchAllRowsPaged<T>(make: () => Pageable): Promise<T[]> {
  return fetchAllRows<T>(
    (from, to) => make().range(from, to) as PromiseLike<{ data: T[] | null; error: unknown }>
  );
}

// user_id → 이메일. 예전엔 사람 수만큼 auth.admin.getUserById()를 불러(한 곳은 for+await 직렬)
// GoTrue를 N번 왕복했다. 계정 목록을 **한 번** 받아 채워두고, 그래도 없는 id만 개별로 묻는다.
// (호출 단위 캐시 — 액션 하나가 끝나면 사라진다. 인사이트는 개발자·오너만 여는 화면이라 충분.)
function makeEmailResolver(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
): (id: string | null | undefined) => Promise<string | null> {
  const cache = new Map<string, string | null>();
  let primed: Promise<void> | null = null;
  const prime = () => {
    if (!primed) {
      primed = (async () => {
        try {
          // 이 앱의 계정은 오너·개발자·신뢰 멤버뿐이라 한 페이지면 충분하다(넘치면 아래 개별 조회).
          const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          for (const u of data?.users ?? []) {
            if (u.id) cache.set(u.id, normalizeEmail(u.email));
          }
        } catch {
          /* 목록 조회 실패 → 개별 조회로 물러난다 */
        }
      })();
    }
    return primed;
  };
  return async (id) => {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id) ?? null;
    await prime();
    if (cache.has(id)) return cache.get(id) ?? null;
    let email: string | null = null;
    try {
      const { data } = await supabase.auth.admin.getUserById(id);
      email = normalizeEmail(data?.user?.email);
    } catch {
      email = null;
    }
    cache.set(id, email);
    return email;
  };
}

// '이 달 이전에 본 적 있는 계정' 집합. 필요한 건 구분된 해시 목록뿐인데, 예전엔 그걸 알아내려고
// visit_session의 **전체 이력**을 1000행씩 끊어 받아왔다(한 달 3500행 기준 1년이면 40회+ 순차 왕복
// → 받은 수만 행을 결국 Set 하나로 접었다). DB에서 DISTINCT로 접어 한 번에 받는다(0051 RPC).
// RPC가 아직 없는 환경(마이그레이션 미적용)에서도 화면이 죽지 않게 옛 경로로 조용히 물러난다.
async function loadKnownAccounts(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  beforeDay: string
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_known_account_hashes", { p_before: beforeDay });
  if (!error && Array.isArray(data)) {
    return new Set(
      (data as { account_hash: string | null }[])
        .map((r) => r.account_hash)
        .filter((h): h is string => Boolean(h))
    );
  }
  const rows = await fetchAllRowsPaged<{ account_hash: string | null }>(() =>
    supabase
      .from("visit_session")
      .select("account_hash")
      .lt("day", beforeDay)
      .order("id", { ascending: true })
  );
  return new Set(rows.map((r) => r.account_hash).filter((h): h is string => Boolean(h)));
}

const SESSION_COLS =
  "day, role, device, account_hash, started_at, last_seen_at, ended_at, visit_key";

async function loadSessions(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  startDay: string,
  endDayExclusive: string
): Promise<SessionRow[]> {
  const raw = await fetchAllRowsPaged<SessionRow>(() =>
    supabase
      .from("visit_session")
      .select(SESSION_COLS)
      .gte("day", startDay)
      .lt("day", endDayExclusive)
      .order("id", { ascending: true })
  );
  // 적재 즉시 '구간 → 방문'으로 접는다(0061). 이 아래 모든 집계는 방문 단위를 본다.
  return foldVisits(raw);
}
// reach 슬롯: 방문자=(날짜|계정) 고유, 역할별=(날짜|계정) 고유/역할, 기기별=(날짜|계정|기기) 고유.
// 재진입(같은 날 같은 계정 여러 세션)은 reach에선 1로 합친다(순방문자 의미 유지).
function reachSlot(rows: SessionRow[]): VisitSlot {
  const slot = emptyVisitSlot();
  const seenAll = new Set<string>();
  const seenRole = new Map<string, Set<string>>();
  const seenDev = new Set<string>();
  for (const r of rows) {
    if (!isMeaningful(r)) continue; // R1: 스쳐감(<3초)은 방문 수에서 제외
    const id = `${r.day}|${sAcct(r)}`;
    if (!seenAll.has(id)) {
      seenAll.add(id);
      slot.total += 1;
    }
    if (r.role in slot.roles) {
      let s = seenRole.get(r.role);
      if (!s) {
        s = new Set();
        seenRole.set(r.role, s);
      }
      if (!s.has(id)) {
        s.add(id);
        slot.roles[r.role] += 1;
      }
    }
    const dk = `${id}|${r.device}`;
    if (r.device in slot.devices && !seenDev.has(dk)) {
      seenDev.add(dk);
      slot.devices[r.device] += 1;
    }
  }
  return slot;
}
// 관측된 일수(세션이 하나라도 있는 KST 날 수) — 월 점유 정규화용.
function observedDayCount(rows: SessionRow[]): number {
  return new Set(rows.map((r) => r.day)).size;
}
// 시간대별(KST 0..23) 평균 동접(=구간 초/3600/관측일수)과 최고 동접(스윕). 세션을 시간 경계로 쪼갠다.
// partial: '아직 진행 중인 시간'(오늘 현재 시각이 걸친 칸). 그 칸만 분모를 경과 초로 바꾼다 —
// 3600으로 나누면 22:13에 본 22시 막대가 실제 동접의 5분의 1로 찍혀 "갑자기 빠졌다"로 읽힌다.
function computeOccupancy(
  rows: SessionRow[],
  observedDays: number,
  partial?: { hour: number; elapsedSec: number }
): OccSlot[] {
  const sec = Array.from({ length: 24 }, () => ({
    role: {} as Record<string, number>,
    device: {} as Record<string, number>,
    total: 0
  }));
  const evs = Array.from({ length: 24 }, () => [] as { t: number; d: number }[]);
  for (const r of rows) {
    // 방문 span이 아니라 가시 구간별로 쪼갠다 — 자리비움이 점유로 잡히면 안 된다.
    for (const sp of visitSpans(r)) {
    let cur = sp.s;
    const end = sp.e;
    while (cur < end) {
      const kst = cur + KST_MS;
      const hourEndUtc = (Math.floor(kst / 3600000) + 1) * 3600000 - KST_MS;
      const segEnd = Math.min(end, hourEndUtc);
      const h = Math.floor(kst / 3600000) % 24;
      const s = (segEnd - cur) / 1000;
      const b = sec[h];
      b.total += s;
      b.role[r.role] = (b.role[r.role] ?? 0) + s;
      b.device[r.device] = (b.device[r.device] ?? 0) + s;
      evs[h].push({ t: cur, d: 1 });
      evs[h].push({ t: segEnd, d: -1 });
      cur = segEnd;
    }
    }
  }
  const full = 3600 * Math.max(1, observedDays);
  return sec.map((b, h) => {
    // 진행 중인 칸은 지나간 만큼으로만 나눈다(최소 60초 — 정각 직후 1~2초를 나누면 발산한다).
    // 아직 오지 않은 칸은 오늘 몫을 분모에서 뺀다 — 안 그러면 '오늘'이 0인 관측일로 끼어
    // 저녁 시간대가 실제보다 낮게 찍힌다(월별 차트에서만 의미 있다).
    const denom =
      partial && partial.hour === h
        ? Math.max(60, Math.min(3600, partial.elapsedSec))
        : partial && h > partial.hour
          ? 3600 * Math.max(1, observedDays - 1)
          : full;
    const occ = emptyOccSlot();
    occ.avg = b.total / denom;
    for (const role of ROLE_ORDER) occ.roles[role] = (b.role[role] ?? 0) / denom;
    for (const dev of DEVICE_SET) occ.devices[dev] = (b.device[dev] ?? 0) / denom;
    const ev = evs[h].sort((a, b2) => a.t - b2.t || a.d - b2.d);
    let cnt = 0;
    let mx = 0;
    for (const x of ev) {
      cnt += x.d;
      if (cnt > mx) mx = cnt;
    }
    occ.peak = mx;
    return occ;
  });
}
// 관리자(owner) 세션 목록 — 최근 순. 체류는 초 단위(짧으면 UI가 '초'로 표시).
function ownerSessionsFrom(rows: SessionRow[]): OwnerSession[] {
  return rows
    .filter((r) => r.role === "owner")
    .map((r) => {
      const startMs = sStart(r);
      const endMs = sEnd(r);
      // 체류는 span(자리비움 포함)이 아니라 실측(가시 구간 합집합)으로 표시한다.
      const seconds = Math.max(0, Math.round(durMs(r) / 1000));
      return {
        device: DEVICE_SET.has(r.device) ? r.device : "desktop",
        startMs,
        endMs,
        minutes: Math.round(seconds / 60),
        seconds,
        // 페이지 이동으로 몇 조각이었나 — 1이면 이동 없이 한 화면에 머문 방문.
        segments: r.segments ?? 1,
        // 비콘 end가 아직 안 왔고 최근까지 하트비트가 있으면 '지금 떠 있는' 방문으로 본다.
        // (5분은 하트비트 60초의 넉넉한 배수 — 네트워크가 한두 번 끊겨도 살아 있다고 본다.)
        live: !r.ended_at && Date.now() - endMs < 5 * 60_000
      };
    })
    .filter((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs))
    .sort((a, b) => b.startMs - a.startMs);
}

export async function getInsightsAction(year: number, month: number): Promise<InsightsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase
    .from("calendars")
    .select("id, owner_id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const y = year;
  const m = month;
  const monthStart = `${y}-${pad(m)}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const lastMonthStart = ymd(new Date(Date.UTC(y, m - 2, 1)));
  const todayKey = todayKstKey();
  const curYm = `${y}-${pad(m)}`;

  const [eventsRangeRes, tagsRangeRes, nextRes, paletteRes, heartCountsRes, unlockRes, passcodeRes] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date_key, is_public")
        .is("deleted_at", null) // tombstone 제외(P0-DATA-1)
        .eq("calendar_id", calendarId)
        .gte("date_key", lastMonthStart)
        .lt("date_key", nextMonthStart),
      supabase
        .from("event_tags")
        .select("event_id, broadcast_tags(id, display_name, color_key), events!inner(calendar_id, date_key)")
        .eq("events.calendar_id", calendarId)
        .gte("events.date_key", monthStart)
        .lt("events.date_key", nextMonthStart),
      supabase
        .from("events")
        .select("date_key, public_title, event_tags(broadcast_tags(display_name))")
        .is("deleted_at", null)
        .eq("calendar_id", calendarId)
        .eq("is_public", true)
        .gte("date_key", todayKey)
        .order("date_key", { ascending: true })
        .limit(40),
      supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
      supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
      // P0-PRIV-2: 잠금해제는 auth-세션 결속 grants가 정본(legacy unlock_sessions는 미사용).
      supabase
        .from("private_unlock_grants")
        .select("user_id, expires_at")
        .eq("calendar_id", calendarId)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true }),
      supabase
        .from("private_layer_settings")
        .select("passcode_version, passcode_updated_at, unlock_duration_minutes")
        .eq("calendar_id", calendarId)
        .maybeSingle()
    ]);

  // 휴뱅(방송 안 함) 일정 id 집합 — 콘텐츠/방송 집계에서 제외.
  const catMap = await loadTagCategoryMap(supabase, calendarId); // 세부→대분류 롤업
  const tagsRange = (tagsRangeRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restEventIds = new Set<string>();
  for (const row of tagsRange) {
    if (row.broadcast_tags?.display_name === REST_TAG) restEventIds.add(row.event_id);
  }

  const eventsRange = (eventsRangeRes.data ?? []) as {
    id: string;
    date_key: string;
    is_public: boolean;
  }[];
  const isContent = (e: { id: string; is_public: boolean }) =>
    e.is_public && !restEventIds.has(e.id);
  const thisMonthEvents = eventsRange.filter(
    (e) => e.date_key >= monthStart && e.date_key < nextMonthStart && isContent(e)
  );
  const lastMonthEvents = eventsRange.filter(
    (e) => e.date_key >= lastMonthStart && e.date_key < monthStart && isContent(e)
  );
  const thisMonthContent = thisMonthEvents.length;
  const lastMonthContent = lastMonthEvents.length;
  const daysWithContent = new Set(thisMonthEvents.map((e) => e.date_key)).size;
  const restDays = new Set(
    eventsRange
      .filter((e) => e.date_key >= monthStart && e.date_key < nextMonthStart && restEventIds.has(e.id))
      .map((e) => e.date_key)
  ).size;

  const wd = Array(7).fill(0) as number[];
  for (const e of thisMonthEvents) wd[weekdayOf(e.date_key)] += 1;
  const maxWd = Math.max(...wd);
  const minWd = Math.min(...wd);
  const busiestWeekday = thisMonthContent > 0 ? wd.indexOf(maxWd) : null;
  const quietestWeekday =
    thisMonthContent > 0 && maxWd !== minWd ? wd.indexOf(minWd) : null;

  // 이번 달 컨텐츠 순위(태그) — 휴뱅 태그 자체는 제외, 실제 색 입힘.
  const colorMap = new Map<string, { bg: string; border: string }>();
  for (const c of paletteRes.data ?? []) {
    colorMap.set((c as { key: string }).key, {
      bg: (c as { bg_color: string }).bg_color,
      border: (c as { border_color: string }).border_color
    });
  }
  const thisMonthContentIds = new Set(thisMonthEvents.map((e) => e.id));
  // 2계층: 세부는 대분류로 합산(게임>롤·명조 → '게임'). 휴뱅은 제외.
  const tagMap = new Map<string, { name: string; count: number; bgColor: string; borderColor: string }>();
  for (const row of tagsRange) {
    const rawName = row.broadcast_tags?.display_name;
    if (!rawName || rawName === REST_TAG) continue;
    if (!thisMonthContentIds.has(row.event_id)) continue;
    const id = row.broadcast_tags?.id;
    const cat = (id && catMap.get(id)) || {
      id: id ?? rawName,
      name: rawName,
      colorKey: row.broadcast_tags?.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.name === REST_TAG) continue;
    if (cat.kind === "modifier") continue; // 수식어(합방·시참 등)는 컨텐츠 순위서 제외
    const cur = tagMap.get(cat.id);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(cat.colorKey);
      tagMap.set(cat.id, {
        name: cat.name,
        count: 1,
        bgColor: cat.bgHex ?? col?.bg ?? "#cdc6ec",
        borderColor: col?.border ?? "#b3a9dd"
      });
    }
  }
  const tags = [...tagMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // 다음 방송(휴뱅 제외) — 가장 이른 날, 그 날의 일정 제목들.
  const upcoming = (nextRes.data ?? []) as {
    date_key: string;
    public_title: string;
    event_tags?: { broadcast_tags?: { display_name?: string } }[];
  }[];
  const byDate = new Map<string, string[]>();
  for (const ev of upcoming) {
    const isRest = (ev.event_tags ?? []).some(
      (t) => t.broadcast_tags?.display_name === REST_TAG
    );
    if (isRest) continue;
    const list = byDate.get(ev.date_key) ?? [];
    list.push(firstLine(ev.public_title));
    byDate.set(ev.date_key, list);
  }
  const firstDate = [...byDate.keys()].sort()[0];
  const nextBroadcast = firstDate ? { dateKey: firstDate, titles: byDate.get(firstDate)! } : null;

  // 참여(하트) — 이 달 일정 기준. 하트가 달린 일정의 날짜를 받아 월별로 묶는다.
  const heartCounts = (heartCountsRes.data ?? []) as { event_id: string; count: number }[];
  const totalHearts = heartCounts.reduce((s, r) => s + Number(r.count), 0);
  const infoMap = new Map<string, { dateKey: string; title: string }>();
  if (heartCounts.length > 0) {
    const { data: rows } = await supabase
      .from("events")
      .select("id, date_key, public_title, is_public")
      .is("deleted_at", null)
      .in("id", heartCounts.map((h) => h.event_id));
    for (const e of rows ?? []) {
      if ((e as { is_public?: boolean }).is_public) {
        infoMap.set((e as { id: string }).id, {
          dateKey: (e as { date_key: string }).date_key,
          title: (e as { public_title: string }).public_title
        });
      }
    }
  }
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const monthlyMap = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  let monthHearts = 0;
  const topThisMonth: { title: string; count: number }[] = [];
  for (const h of heartCounts) {
    const info = infoMap.get(h.event_id);
    if (!info) continue;
    const ym = info.dateKey.slice(0, 7);
    if (monthlyMap.has(ym)) monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + Number(h.count));
    if (ym === curYm) {
      monthHearts += Number(h.count);
      topThisMonth.push({ title: firstLine(info.title), count: Number(h.count) });
    }
  }
  const monthly = monthKeys.map((k) => ({ ym: k, count: monthlyMap.get(k) ?? 0 }));
  const topEvents = topThisMonth.sort((a, b) => b.count - a.count).slice(0, 5);

  // 이메일 해석 — 계정 목록을 한 번 받아 채우고 필요한 것만 개별 조회(위 makeEmailResolver).
  const emailFor = makeEmailResolver(supabase!);

  const unlockRows = (unlockRes.data ?? []) as { user_id: string; expires_at: string }[];
  // 활성 세션을 한 번만 이메일 해석 → activeUnlocks(목록)와 access(역할별 매핑)에서 함께 쓴다.
  const unlockResolved = await Promise.all(
    unlockRows.map(async (u) => ({
      userId: u.user_id,
      email: (await emailFor(u.user_id)) ?? "(알 수 없음)",
      expiresAt: u.expires_at
    }))
  );
  const activeUnlocks = unlockResolved.map((u) => ({ email: u.email, expiresAt: u.expiresAt }));
  const unlockByEmail = new Map(
    unlockResolved.map((u) => [u.email, { userId: u.userId, expiresAt: u.expiresAt }])
  );
  const toAccess = (email: string): AccessPerson => {
    const s = unlockByEmail.get(email);
    return { email, expiresAt: s?.expiresAt ?? null, userId: s?.userId ?? null };
  };
  const passcode = passcodeRes.data as {
    passcode_version?: number;
    passcode_updated_at?: string;
    unlock_duration_minutes?: number;
  } | null;

  const ownerEmails = getOwnerEmails();
  const dbOwnerEmail = await emailFor(cal.owner_id as string | undefined);
  const bindingOk = Boolean(ownerEmails[0] && dbOwnerEmail && ownerEmails[0] === dbOwnerEmail);

  // 비공개 접근 자격자(매니저 제외) — 소유자(env)·개발자(platform_admins). (작업자 철수 2026-08-27)
  const { data: adminRows } = await supabase.from("platform_admins").select("email");
  const developerEmails = [
    ...new Set(
      ((adminRows ?? []) as { email?: string }[])
        .map((a) => normalizeEmail(a.email))
        .filter((e): e is string => Boolean(e))
    )
  ];
  const access = {
    owners: ownerEmails.map(toAccess),
    developers: developerEmails.map(toAccess)
  };

  return {
    ok: true,
    data: {
      month: { year: y, month: m },
      content: {
        nextBroadcast,
        thisMonthContent,
        lastMonthContent,
        daysWithContent,
        restDays,
        busiestWeekday,
        quietestWeekday,
        tags
      },
      engagement: { monthHearts, totalHearts, monthly, topEvents },
      security: {
        passcodeVersion: passcode?.passcode_version ?? null,
        passcodeUpdatedAt: passcode?.passcode_updated_at ?? null,
        unlockDurationMinutes: passcode?.unlock_duration_minutes ?? null,
        activeUnlocks,
        access
      },
      system: {
        ownerEmails,
        developerEmails,
        dbOwnerEmail,
        bindingOk,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        // 빌드(배포) 시각 — next.config의 BUILD_TIME(빌드 시점 UTC). 로컬은 현재 시각으로 폴백.
        deployedAt: process.env.BUILD_TIME ?? new Date().toISOString()
      }
    }
  };
}

// 카테고리(태그/역할/기기)별 6개월 누적 막대 트렌드. months[i].counts[catKey] = 그 달 그 카테고리 값.
export type TrendStack = {
  cats: { key: string; label: string; color: string }[];
  months: { ym: string; counts: Record<string, number>; total: number }[];
};
export type TrendData = {
  months: string[]; // 6개월(YYYY-MM, 오래된→최신, 타깃 월로 끝남)
  visits: number[];
  content: number[]; // 휴뱅 제외 공개 일정
  broadcastHours: number[]; // 6개월 월별 총 방송시간(시간, 소수 1자리) — start_day(시작일) 귀속
  broadcastDaily: number[]; // 보는 달 1..말일 일별 방송시간(시간) — 시작일 귀속, 자정 넘겨도 시작일에 통째
  broadcastDays: number; // 보는 달에 방송한 날 수(방송시간>0)
  contentByTag: TrendStack; // 콘텐츠 대분류별 6개월(휴뱅 포함)
  modifierByTag: TrendStack; // 방식(합방·시참 등)별 6개월
  heartsByTag: TrendStack; // 하트 받은 태그 6개월 — 일정당 평균 하트(비율, 방영월 기준)
  visitsByRole: TrendStack; // 방문 역할별 6개월(개발자 전용)
  visitsByDevice: TrendStack; // 방문 기기별 6개월(개발자 전용)
};

// 카테고리별 6개월 누적 트렌드를 만든다. rows: {ym, key, n}. cats: 표시 순서/이름/색.
function buildTrendStack(
  monthKeys: string[],
  cats: { key: string; label: string; color: string }[],
  rows: { ym: string; key: string; n: number }[]
): TrendStack {
  const months = monthKeys.map((ym) => ({
    ym,
    counts: Object.fromEntries(cats.map((c) => [c.key, 0])) as Record<string, number>,
    total: 0
  }));
  const idx = new Map(monthKeys.map((k, i) => [k, i]));
  for (const r of rows) {
    const i = idx.get(r.ym);
    if (i === undefined || !(r.key in months[i].counts)) continue;
    months[i].counts[r.key] += r.n;
    months[i].total += r.n;
  }
  return { cats, months };
}
export type TrendResult = { ok: true; data: TrendData } | { ok: false; error: string };

type BcastRow = {
  start_day: string;
  started_at: string;
  last_live_at: string;
  ended_at: string | null;
};
// 방송시간 집계(트렌드·멤버 인사이트 공용) — 시작일(start_day) 귀속. 유효시간 = coalesce(ended_at,
// last_live_at) - started_at. 진행 중(ended_at null)은 last_live_at까지 잠정 집계.
function computeBroadcast(
  bcastRows: BcastRow[],
  monthKeys: string[],
  year: number,
  month: number
): { broadcastHours: number[]; broadcastDaily: number[]; broadcastDays: number } {
  const bMonthSec = new Map(monthKeys.map((k) => [k, 0]));
  const bDaySec = new Map<number, number>(); // 보는 달 일별(일=1..말일)
  for (const r of bcastRows) {
    const start = new Date(r.started_at).getTime();
    const end = new Date(r.ended_at ?? r.last_live_at).getTime();
    const sec =
      Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 1000 : 0;
    if (sec <= 0) continue;
    const ym = r.start_day.slice(0, 7);
    if (bMonthSec.has(ym)) bMonthSec.set(ym, (bMonthSec.get(ym) ?? 0) + sec);
    if (ym === `${year}-${pad(month)}`) {
      const d = Number(r.start_day.slice(8, 10));
      bDaySec.set(d, (bDaySec.get(d) ?? 0) + sec);
    }
  }
  // 반올림 자릿수는 시청자 '이 달 기록'의 공개 RPC(0049 월별 1자리 / 0050 일별 2자리)와 같게 —
  // 예전엔 일별도 1자리라 같은 날이 편집실 13.1h(13시간 6분), 시청자 13.13h(13시간 8분)로 달랐다.
  const round1 = (h: number) => Math.round(h * 10) / 10;
  const round2 = (h: number) => Math.round(h * 100) / 100;
  const daysInViewMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const broadcastHours = monthKeys.map((k) => round1((bMonthSec.get(k) ?? 0) / 3600));
  const broadcastDaily = Array.from({ length: daysInViewMonth }, (_, i) =>
    round2((bDaySec.get(i + 1) ?? 0) / 3600)
  );
  // 방송일수도 시청자 화면과 같은 정의(일별 값 > 0)로 — 원본 초 단위로 세면 반올림 후
  // 0.00h인 몇 초짜리 세션이 하루로 잡혀 일평균 분모가 어긋난다.
  const broadcastDays = broadcastDaily.filter((h) => h > 0).length;
  return { broadcastHours, broadcastDaily, broadcastDays };
}

type VodFallbackRow = { broadcast_day: string; duration_ms: number; reg_date: string | null };
// 세션 기록이 없는 날의 방송시간을 다시보기(VOD) 길이로 채운다(0070 공개 RPC와 동일 규칙).
// broadcast_session은 2026-06 도입이라 그 이전 시대는 통째로 비어 있었다 — vod_archive(0068)의
// 길이·등록시각으로 유사 세션 행을 만들어 잇는다. **세션이 있는 날은 세션이 정답**(이중 집계 금지).
function mergeVodFallback(sess: BcastRow[], vods: VodFallbackRow[]): BcastRow[] {
  const sessDays = new Set(sess.map((r) => r.start_day.slice(0, 10)));
  const out = [...sess];
  for (const v of vods) {
    const day = String(v.broadcast_day).slice(0, 10);
    if (v.reg_date === null || sessDays.has(day)) continue;
    const endMs = Date.parse(v.reg_date);
    if (!Number.isFinite(endMs) || !(v.duration_ms > 0)) continue;
    out.push({
      start_day: day,
      started_at: new Date(endMs - v.duration_ms).toISOString(),
      last_live_at: v.reg_date,
      ended_at: v.reg_date
    });
  }
  return out;
}

// 트렌드 패널용 — 방문·컨텐츠의 최근 6개월 월별 추이. (하트 6개월은 getInsightsAction이 이미 줌.)
export async function getTrendAction(year: number, month: number): Promise<TrendResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const fromStart = `${monthKeys[0]}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(year, month, 1)));

  const [visitRows, eventsRes, tagsRes, paletteRes, heartsRes, bcastRes, vodRes] = await Promise.all([
    fetchAllRowsPaged<SessionRow>(() =>
      supabase
        .from("visit_session")
        .select(SESSION_COLS)
        .gte("day", fromStart)
        .lt("day", nextMonthStart)
        .order("id", { ascending: true })
    ).then(foldVisits), // 구간 → 방문(0061)

    supabase
      .from("events")
      .select("id, date_key")
      .is("deleted_at", null)
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", fromStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("event_tags")
      .select("event_id, broadcast_tags(id, display_name, color_key), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", fromStart)
      .lt("events.date_key", nextMonthStart),
    supabase.from("color_palette").select("key, bg_color").eq("calendar_id", calendarId),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    supabase
      .from("broadcast_session")
      .select("start_day, started_at, last_live_at, ended_at")
      .gte("start_day", fromStart)
      .lt("start_day", nextMonthStart),
    // 세션 이전 시대(≤2026-05) 방송시간 폴백용 다시보기 길이(0068) — mergeVodFallback가 합친다.
    supabase
      .from("vod_archive")
      .select("broadcast_day, duration_ms, reg_date")
      .gte("broadcast_day", fromStart)
      .lt("broadcast_day", nextMonthStart)
  ]);

  const catMap = await loadTagCategoryMap(supabase, calendarId); // 세부→대분류 롤업
  const tagRows2 = (tagsRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restIds = new Set<string>();
  for (const row of tagRows2) {
    if (row.broadcast_tags?.display_name === REST_TAG) restIds.add(row.event_id);
  }
  // 월별 방문 = (날짜, 계정) 고유 쌍 수(계정당 하루 1 — 순방문자). 재진입 세션은 1로 합친다.
  // visitRows는 fetchAllRows로 끝까지 받은 전체(1000행 cap 우회).
  const vMap = new Map(monthKeys.map((k) => [k, 0]));
  const vSeen = new Set<string>();
  for (const row of visitRows) {
    const ym = row.day.slice(0, 7);
    const k = `${row.day}|${sAcct(row)}`;
    if (vSeen.has(k)) continue;
    vSeen.add(k);
    if (vMap.has(ym)) vMap.set(ym, (vMap.get(ym) ?? 0) + 1);
  }
  const eventMonth = new Map<string, string>();
  const cMap = new Map(monthKeys.map((k) => [k, 0]));
  for (const e of eventsRes.data ?? []) {
    const id = (e as { id: string }).id;
    const ym = (e as { date_key: string }).date_key.slice(0, 7);
    eventMonth.set(id, ym);
    if (restIds.has(id)) continue;
    if (cMap.has(ym)) cMap.set(ym, (cMap.get(ym) ?? 0) + 1);
  }

  // 태그별 컨텐츠 6개월(휴뱅 포함) — 태그 id 기준 집계(rename은 현재 이름으로 자동 반영).
  const palette = new Map<string, string>();
  for (const c of paletteRes.data ?? []) {
    palette.set((c as { key: string }).key, (c as { bg_color: string }).bg_color);
  }
  const tagInfo = new Map<string, { name: string; color: string; total: number }>();
  const contentTagRows: { ym: string; key: string; n: number }[] = [];
  const contentEventIds = new Set<string>(); // 콘텐츠 대분류를 1개 이상 단 공개 일정
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id); // 공개 일정만(비공개는 매핑 없음 → 제외)
    if (!bt?.id || !ym) continue;
    const cat = catMap.get(bt.id) ?? {
      id: bt.id,
      name: bt.display_name ?? "?",
      colorKey: bt.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.kind === "modifier") continue; // 수식어는 컨텐츠 트렌드서 제외
    contentEventIds.add(row.event_id);
    contentTagRows.push({ ym, key: cat.id, n: 1 });
    const cur = tagInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      tagInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? palette.get(cat.colorKey) ?? "#cdc6ec",
        total: 1
      });
  }
  const contentCats = [...tagInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));
  // 콘텐츠 태그 0개인 공개 일정(휴뱅 제외) = 합성 '기타'. 항상 맨 끝에 붙인다.
  let etcTotal = 0;
  for (const [id, ym] of eventMonth) {
    if (restIds.has(id) || contentEventIds.has(id)) continue;
    contentTagRows.push({ ym, key: ETC_KEY, n: 1 });
    etcTotal += 1;
  }
  if (etcTotal > 0) contentCats.push({ key: ETC_KEY, label: ETC_LABEL, color: ETC_COLOR });

  // 방식(modifier)별 6개월 — 콘텐츠와 별개 축(합방·시참·연습 등 얼마나 자주 했나).
  const modInfo = new Map<string, { name: string; color: string; total: number }>();
  const modTagRows: { ym: string; key: string; n: number }[] = [];
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catMap.get(bt.id) ?? {
      id: bt.id,
      name: bt.display_name ?? "?",
      colorKey: bt.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.kind !== "modifier") continue;
    modTagRows.push({ ym, key: cat.id, n: 1 });
    const cur = modInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      modInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? palette.get(cat.colorKey) ?? "#cdc6ec",
        total: 1
      });
  }
  const modCats = [...modInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));

  // 하트 받은 태그 6개월 — '일정당 평균 하트'(비율). 하트 총합이면 일정 수가 많은 태그가
  // 구조적으로 항상 1등이라, 그 달 그 태그 일정 수로 나눈다(하트 0 일정도 분모에 포함).
  const heartByEvent = new Map<string, number>();
  for (const r of (heartsRes.data ?? []) as { event_id: string; count: number }[]) {
    heartByEvent.set(r.event_id, Number(r.count));
  }
  const heartTagInfo = new Map<string, { name: string; color: string; h: number; e: number }>();
  const heartAgg = new Map<string, { h: number; e: number }>(); // `${ym}|${catId}`
  const heartSeen = new Set<string>(); // `${eventId}|${catId}` — 세부 태그 2개가 같은 대분류면 1번만
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catMap.get(bt.id) ?? {
      id: bt.id,
      name: bt.display_name ?? "?",
      colorKey: bt.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.kind === "modifier") continue; // 수식어는 태그별 하트 트렌드서 제외
    const dedup = `${row.event_id}|${cat.id}`;
    if (heartSeen.has(dedup)) continue;
    heartSeen.add(dedup);
    const h = heartByEvent.get(row.event_id) ?? 0;
    const aggKey = `${ym}|${cat.id}`;
    const agg = heartAgg.get(aggKey) ?? { h: 0, e: 0 };
    agg.h += h;
    agg.e += 1;
    heartAgg.set(aggKey, agg);
    const cur = heartTagInfo.get(cat.id);
    if (cur) {
      cur.h += h;
      cur.e += 1;
    } else
      heartTagInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? palette.get(cat.colorKey) ?? "#f7a8c0",
        h,
        e: 1
      });
  }
  const heartTagRows: { ym: string; key: string; n: number }[] = [...heartAgg.entries()].map(
    ([k, v]) => ({
      ym: k.slice(0, 7),
      key: k.slice(8),
      n: Math.round((v.h / Math.max(1, v.e)) * 10) / 10
    })
  );
  const heartCats = [...heartTagInfo.entries()]
    .filter(([, v]) => v.h > 0) // 6개월 내 하트 0인 태그는 기존처럼 차트에서 제외
    .sort((a, b) => b[1].h / b[1].e - a[1].h / a[1].e)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));

  // 방문 역할별/기기별 6개월(개발자 전용). 둘 다 순방문자 기준: 역할별=(날짜,계정) 1회,
  // 기기별=(날짜,계정,기기) 1회(한 계정이 웹·iOS면 둘 다 1). 재진입 세션은 합친다.
  const roleRows: { ym: string; key: string; n: number }[] = [];
  const devRows: { ym: string; key: string; n: number }[] = [];
  const roleSeen = new Set<string>();
  const devSeen = new Set<string>();
  for (const row of visitRows) {
    const ym = row.day.slice(0, 7);
    const id = `${row.day}|${sAcct(row)}`;
    const dk = `${id}|${row.device}`;
    if (!devSeen.has(dk)) {
      devSeen.add(dk);
      devRows.push({ ym, key: row.device, n: 1 });
    }
    if (roleSeen.has(id)) continue;
    roleSeen.add(id);
    roleRows.push({ ym, key: row.role, n: 1 });
  }

  const { broadcastHours, broadcastDaily, broadcastDays } = computeBroadcast(
    mergeVodFallback(
      (bcastRes.data ?? []) as BcastRow[],
      (vodRes.data ?? []) as VodFallbackRow[]
    ),
    monthKeys,
    year,
    month
  );

  return {
    ok: true,
    data: {
      months: monthKeys,
      visits: monthKeys.map((k) => vMap.get(k) ?? 0),
      content: monthKeys.map((k) => cMap.get(k) ?? 0),
      broadcastHours,
      broadcastDaily,
      broadcastDays,
      contentByTag: buildTrendStack(monthKeys, contentCats, contentTagRows),
      modifierByTag: buildTrendStack(monthKeys, modCats, modTagRows),
      heartsByTag: buildTrendStack(monthKeys, heartCats, heartTagRows),
      visitsByRole: buildTrendStack(monthKeys, ROLE_TREND_META, roleRows),
      visitsByDevice: buildTrendStack(monthKeys, DEVICE_TREND_META, devRows)
    }
  };
}

type VisitSlot = {
  roles: Record<string, number>;
  devices: Record<string, number>;
  total: number;
};
// 시간대 동시 접속(체류) — roles/devices/avg는 평균 동시 접속(소수 가능, =핑/60), peak는 최고 동시 접속.
export type OccSlot = {
  roles: Record<string, number>;
  devices: Record<string, number>;
  avg: number;
  peak: number;
};
// 관리자(owner) 접속 세션 한 건 — 기기, 시작/종료(epoch ms, KST는 클라에서 +9h), 머문 분(핑 수).
export type OwnerSession = {
  device: string;
  startMs: number;
  endMs: number;
  minutes: number;
  seconds: number; // 실측 체류(가시 구간 합집합). 짧은 방문은 UI가 '초'로 표시
  segments: number; // 이 방문이 몇 조각이었나(문서 이동 횟수 = segments-1). 1이면 이동 없음
  // 아직 안 끝난 방문(ended_at 없음 = 지금 떠 있음). 끝난 방문과 같은 모양으로 그리면
  // 켜져 있는 세션이 이미 끝난 것처럼 읽힌다.
  live: boolean;
};
// 토글(시청자/운영진 포함)로 즉시 바뀌는 그래프 묶음 — 같은 코드로 시청자만/전체 두 벌을 만든다.
export type VisitGraphs = {
  days: ({ day: number; stay: number } & VisitSlot)[]; // 이 달 1..말일 (stay=의미 세션 총 체류초)
  weeks: ({ label: string } & VisitSlot)[]; // 1주차..
  hours: VisitSlot[]; // 24칸(KST) — 첫 진입 시각 분포
  occupancy: OccSlot[]; // 24칸(KST) — 시간대별 평균/최고 동시 접속(체류)
  hasOccupancy: boolean;
  heatmap: number[][]; // [요일0~6][시0~23] 의미 세션 수
  total: number; // 방문 총합(순방문자)
};
export type VisitTrends = {
  ready: boolean; // visit_session 접근 가능 여부
  hasData: boolean; // 이 달 방문 기록이 있는지
  viewer: VisitGraphs; // 시청자 그래프 묶음
  operator: VisitGraphs; // 운영진(viewer 아님) 그래프 묶음
  all: VisitGraphs; // 전체 그래프 묶음
  ownerSessions: OwnerSession[]; // 관리자(owner) 접속 세션(이 달, 최근 순)
  summaryViewer: VisitSummary; // 시청자 기준 품질 요약(R4/R5/R13)
  summaryOperator: VisitSummary; // 운영진 기준
  summaryAll: VisitSummary; // 전체 기준
  operators: number; // 이 달 의미 방문 운영진(viewer 아님) 순방문자 수
  newVisitors: number; // R12: 이 달 처음 본 시청자(의미 방문)
  returningVisitors: number; // R12: 재방문 시청자
  insights: string[]; // R6: 한 문장 자동 인사이트(시청자 기준)
  recent: RecentSession[]; // 세션 로그(전체, 최근 순 — 개발자 디버깅)
  dailySessions: number[]; // 일별 의미 세션 수(전 역할) 1..말일 — 월간 추이
  health: { todaySessions: number; openRate: number; avgStaySec: number }; // 수집 상태
};
// R10 최근 세션 한 줄 — 원문 이메일 미저장/미표시. owner만 매칭 라벨, 그 외는 역할 라벨.
export type RecentSession = {
  t: number;
  role: string;
  device: string;
  seconds: number;
  meaningful: boolean;
  label: string;
  dual: boolean; // 매니저·작업자 겸업 멤버의 매니저 세션(개발자 디버깅 표식)
  segments: number; // 이 방문이 몇 조각이었나(문서 이동 횟수 = segments-1)
};
export type VisitTrendsResult = { ok: true; data: VisitTrends } | { ok: false; error: string };

export async function getVisitTrendsAction(
  year: number,
  month: number
): Promise<VisitTrendsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }

  const y = year;
  const m = month;
  const monthStart = `${y}-${pad(m)}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // 그 달 1일의 요일(0=일). 주차를 단순 7일 묶음이 아니라 달력 주(일요일 시작)로 끊기 위함.
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  // 이번 달을 보고 있으면 마지막 시간대는 아직 진행 중이다 — 3600초로 나누면 지금 시간대가
  // 늘 실제의 몇 분의 일로 찍힌다(일별 모달에서 22시가 1/5로 나온 것과 같은 원인).
  const nowKstMs = Date.now() + KST_MS;
  const monthPartial =
    new Date(nowKstMs).toISOString().slice(0, 7) === `${y}-${pad(m)}`
      ? { hour: Math.floor((nowKstMs % 86400000) / 3600000), elapsedSec: (nowKstMs % 3600000) / 1000 }
      : undefined;
  const emptySlot = (): VisitSlot => ({
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    total: 0
  });
  // 그래프 묶음 한 벌을 만든다 — 같은 코드로 시청자만/전체 두 벌(토글이 즉시 전환).
  const buildGraphs = (subset: SessionRow[]): VisitGraphs => {
    const byDay = new Map<number, SessionRow[]>();
    const byWeek = new Map<number, SessionRow[]>();
    for (const row of subset) {
      const d = Number(row.day.slice(8, 10));
      if (d >= 1 && d <= daysInMonth) {
        const a = byDay.get(d);
        if (a) a.push(row);
        else byDay.set(d, [row]);
      }
      const wi = Math.floor((d - 1 + firstWeekday) / 7);
      const w = byWeek.get(wi);
      if (w) w.push(row);
      else byWeek.set(wi, [row]);
    }
    // 하루 총 체류초 = 그날 의미 세션들의 체류 합(미니달력 색 농도용 — 방문 수가 아니라 체류 시간).
    const dayStay = (rows: SessionRow[]) =>
      Math.round(rows.reduce((s, r) => s + (isMeaningful(r) ? durMs(r) : 0), 0) / 1000);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const rows = byDay.get(i + 1) ?? [];
      return { day: i + 1, stay: dayStay(rows), ...reachSlot(rows) };
    });
    const weekCount = Math.ceil((daysInMonth + firstWeekday) / 7);
    const weeks = Array.from({ length: weekCount }, (_, i) => ({
      label: `${i + 1}주`,
      ...reachSlot(byWeek.get(i) ?? [])
    }));
    // 시간대(KST): 역할/방문=그 (날짜,계정) 첫 진입에 1회, 기기=(날짜,계정,기기) 첫 진입에 1회.
    const hours = Array.from({ length: 24 }, emptySlot);
    const fe = new Map<string, { hour: number; role: string; t: number }>();
    const df = new Map<string, { hour: number; device: string; t: number }>();
    for (const row of subset) {
      if (!isMeaningful(row)) continue; // R1
      const t = sStart(row);
      if (!Number.isFinite(t)) continue;
      const hour = Math.floor((t + KST_MS) / 3600000) % 24;
      const id = `${row.day}|${sAcct(row)}`;
      const p = fe.get(id);
      if (!p || t < p.t) fe.set(id, { hour, role: row.role, t });
      const dk = `${id}|${row.device}`;
      const dp = df.get(dk);
      if (!dp || t < dp.t) df.set(dk, { hour, device: row.device, t });
    }
    for (const v of fe.values()) {
      const slot = hours[v.hour];
      if (v.role in slot.roles) slot.roles[v.role] += 1;
      slot.total += 1;
    }
    for (const v of df.values()) {
      const slot = hours[v.hour];
      if (v.device in slot.devices) slot.devices[v.device] += 1;
    }
    const occupancy = computeOccupancy(subset, observedDayCount(subset), monthPartial);
    const hasOccupancy = subset.length > 0 && occupancy.some((o) => o.avg > 0);
    const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const r of subset) {
      if (!isMeaningful(r)) continue;
      const k = new Date(sStart(r) + KST_MS);
      heatmap[k.getUTCDay()][k.getUTCHours()] += 1;
    }
    return { days, weeks, hours, occupancy, hasOccupancy, heatmap, total: reachSlot(subset).total };
  };
  const emptyGraphs = (): VisitGraphs => buildGraphs([]);

  // 접근 가능 여부(ready)만 가볍게 확인 — 권한/RLS 문제면 여기서 잡힌다. 본 조회는 fetchAllRows로
  // 끝까지 페이지네이션(1000행 cap 우회 — 한 달 수천 행이라 안 그러면 뒷날짜 세션이 잘려 사라진다).
  const { error } = await supabase.from("visit_session").select("id").limit(1);

  if (error) {
    return {
      ok: true,
      data: {
        ready: false,
        hasData: false,
        viewer: emptyGraphs(),
        operator: emptyGraphs(),
        all: emptyGraphs(),
        ownerSessions: [],
        summaryViewer: emptySummary(),
        summaryOperator: emptySummary(),
        summaryAll: emptySummary(),
        operators: 0,
        newVisitors: 0,
        returningVisitors: 0,
        insights: [],
        recent: [],
        dailySessions: [],
        health: { todaySessions: 0, openRate: 0, avgStaySec: 0 }
      }
    };
  }
  // 이 달 세션과 '이전에 본 계정 집합'은 서로 독립이다 → 같이 출발시킨다(예전엔 줄 세워 왕복 2배).
  const [rows, knownAccounts] = await Promise.all([
    fetchAllRowsPaged<SessionRow>(() =>
      supabase
        .from("visit_session")
        .select(SESSION_COLS)
        .gte("day", monthStart)
        .lt("day", nextMonthStart)
        .order("id", { ascending: true })
    ).then(foldVisits), // 구간 → 방문(0061)
    loadKnownAccounts(supabase, monthStart)
  ]);

  const all = buildGraphs(rows);
  const viewer = buildGraphs(rows.filter((r) => isAudience(r.role)));
  const operator = buildGraphs(rows.filter((r) => !isAudience(r.role)));
  // 관리자 접속 세션(최근 순) — 세션 행에서 직접(role=owner). 토글과 무관(운영진 데이터).
  const ownerSessions = ownerSessionsFrom(rows);
  const { viewer: summaryViewer, operator: summaryOperator, all: summaryAll } = summarizeSplit(rows);
  const operators = summaryOperator.visitors;

  // R12: 새/재방문 — 이 달 이전에 본 적 있는 계정 집합(위 Promise.all에서 함께 받아둔 것)과 대조.
  const viewerMeaningful = rows.filter((r) => isAudience(r.role) && isMeaningful(r));
  const viewerAccounts = new Set(viewerMeaningful.map((r) => sAcct(r)));
  let newVisitors = 0;
  let returningVisitors = 0;
  for (const acc of viewerAccounts) {
    if (knownAccounts.has(acc)) returningVisitors += 1;
    else newVisitors += 1;
  }

  // (요일×시간 히트맵은 buildGraphs가 viewer/all 각각 만든다 — 토글로 즉시 전환.)

  // 세션 로그(개발자 디버깅) — 전체 세션, 최근 순. owner만 이메일 매칭 라벨, 겸업자엔 '겸' 표식.
  const hashToOwnerEmail = new Map(getOwnerEmails().map((e) => [accountHashOf(e), e] as const));
  const dualHashes = NO_DUAL;
  const recent = buildSessionLog(rows, hashToOwnerEmail, dualHashes);

  // 일별 세션 수(의미 세션, 전 역할) — 하루 단위 기록을 모은 월간 추이. 1..말일.
  const dailySessions = Array.from({ length: daysInMonth }, () => 0);
  for (const r of rows) {
    if (!isMeaningful(r)) continue;
    const d = Number(r.day.slice(8, 10));
    if (d >= 1 && d <= daysInMonth) dailySessions[d - 1] += 1;
  }

  // 수집 상태 — 오늘 세션 수 / 미종료 비율 / 평균 체류초(전체). 비콘(end) 유실 점검용.
  const todayKey = todayKstKey();
  const todaySessions = rows.filter((r) => r.day === todayKey).length;
  const openRate = rows.length > 0 ? rows.filter((r) => !r.ended_at).length / rows.length : 0;
  const avgStaySec =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + durMs(r) / 1000, 0) / rows.length)
      : 0;
  const health = { todaySessions, openRate, avgStaySec };

  // R6: 한 문장 자동 인사이트(시청자 기준). 최고 시간대·평균 체류·새/재방문에서 1~2개(바운스 문장은 철수).
  const insights: string[] = [];
  const peakHour = viewer.hours.reduce((mx, h, i) => (h.total > viewer.hours[mx].total ? i : mx), 0);
  if (summaryViewer.visitors > 0) {
    if (viewer.hours[peakHour].total > 0) {
      insights.push(`시청자는 주로 ${peakHour}시에 방문했고, 평균 체류는 ${fmtDurSec(summaryViewer.avgSeconds)}예요.`);
    }
    if (newVisitors + returningVisitors > 0) {
      insights.push(`이 달 새 시청자 ${newVisitors}명 · 재방문 ${returningVisitors}명이에요.`);
    }
  } else {
    insights.push("이 달 시청자 방문이 아직 없어요.");
  }
  // R9: 방문 ↔ 일정 연결(공개 일정 유무만 — private 필드는 절대 안 씀). 방문 최다일에 공개 일정이
  // 있었는지 한 문장. 경계: is_public 카운트만 조회.
  const topDay = viewer.days.reduce<{ day: number; total: number } | null>(
    (mx, d) => (d.total > (mx?.total ?? 0) ? d : mx),
    null
  );
  if (topDay && topDay.total > 0) {
    const { data: cal } = await supabase
      .from("calendars")
      .select("id")
      .eq("slug", SLUG)
      .maybeSingle();
    if (cal) {
      const dk = `${monthStart.slice(0, 8)}${pad(topDay.day)}`;
      const { data: ev } = await supabase
        .from("events")
        .select("id")
        .is("deleted_at", null)
        .eq("calendar_id", cal.id as string)
        .eq("is_public", true)
        .eq("date_key", dk)
        .limit(1);
      insights.push(
        ev && ev.length > 0
          ? `방문 최다일(${topDay.day}일)엔 공개 일정이 있었어요.`
          : `방문 최다일(${topDay.day}일)엔 공개 일정이 없었는데도 방문이 몰렸어요.`
      );
    }
  }

  return {
    ok: true,
    data: {
      ready: true,
      hasData: rows.length > 0,
      viewer,
      operator,
      all,
      ownerSessions,
      summaryViewer,
      summaryOperator,
      summaryAll,
      operators,
      newVisitors,
      returningVisitors,
      insights,
      recent,
      dailySessions,
      health
    }
  };
}

// 하루치 방문 상세 — 개발자가 달력에서 날짜를 클릭하면 그날 통계를 드릴다운으로 본다.
// 월별(getVisitTrends)과 같은 지표를 '그 하루'로 좁힌 것: 방문 수(역할/기기), 24h 동시 접속, 관리자 세션.
// 기존 RPC에 하루 범위(p_start=그날, p_end=다음날)를 넘겨 재사용 — 새 DB 작업 없음. 개발자 전용.
// 일일 상세에서 토글(시청자/운영진/전체)로 즉시 바뀌는 묶음 — 역할/기기 분해 + 시간대 동접.
export type DayScopeGraphs = {
  visits: VisitSlot; // 방문 수 + 역할/기기 분해
  occupancy: OccSlot[]; // 24칸(KST) 평균/최고 동시 접속
  hasOccupancy: boolean;
};
export type DayVisitDetail = {
  dateKey: string;
  viewer: DayScopeGraphs; // 시청자만
  operator: DayScopeGraphs; // 운영진(viewer 아님)
  all: DayScopeGraphs; // 전체
  ownerSessions: OwnerSession[]; // 그날 관리자 접속 세션
  // 그날 '관리자(owner)' 방문 기록 — 세션별. 언제(started_at)·기기·체류(초)·계정(설정된 owner
  // 이메일과 해시 매칭되면 이메일, 아니면 익명 태그). 일반 방문자는 절대 식별되지 않는다.
  ownerVisits: {
    t: number;
    device: string;
    account: string;
    seconds: number;
    segments: number;
  }[];
  // 그날 관리자(owner) 총 체류 초. 세션 합. 매우 짧으면(예: 0~1초) 화면을 사실상 안 본 것.
  ownerSeconds: number;
  summaryViewer: VisitSummary; // 그날 시청자 기준 품질 요약(R4/R5/R13)
  summaryOperator: VisitSummary; // 그날 운영진 기준
  summaryAll: VisitSummary; // 그날 전체 기준
  operators: number; // 그날 의미 방문 운영진 순방문자 수
  newVisitors: number; // R12: 그날 처음 본 시청자
  returningVisitors: number; // R12: 그날 재방문 시청자
  sessions: RecentSession[]; // 그날 전체 세션 로그(최근 순 — 개발자 디버깅)
  // 오늘이면 '지금'의 KST 소수 시각(0~24), 다른 날이면 null. 시간대 차트가 아직 안 지난 칸을
  // 흐리게 두고 현재 위치에 마커를 그리는 데 쓴다 — '데이터 없음'과 '아직 안 옴'은 다르다.
  nowMark: number | null;
};
export type DayVisitDetailResult = { ok: true; data: DayVisitDetail } | { ok: false; error: string };

export async function getDayVisitDetailAction(dateKey: string): Promise<DayVisitDetailResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: "잘못된 날짜입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  const nextDay = ymd(new Date(Date.UTC(yy, mm - 1, dd + 1))); // 다음 날(day 컬럼은 KST 날짜)

  const rows = await loadSessions(supabase, dateKey, nextDay);

  // 오늘을 보고 있나 — 그러면 마지막 칸은 '아직 진행 중'이다(분모·마커·흐림에 모두 쓴다).
  const nowKst = Date.now() + KST_MS;
  const isToday = new Date(nowKst).toISOString().slice(0, 10) === dateKey;
  const nowMark = isToday ? (nowKst % 86400000) / 3600000 : null;
  const partial =
    nowMark === null
      ? undefined
      : { hour: Math.floor(nowMark), elapsedSec: (nowKst % 3600000) / 1000 };

  // 토글별 묶음(역할/기기 분해 + 시간대 동접). 동일 로직으로 시청자/운영진/전체 세 벌.
  const buildDay = (subset: SessionRow[]): DayScopeGraphs => {
    const occupancy = computeOccupancy(subset, 1, partial);
    return {
      visits: reachSlot(subset),
      occupancy,
      hasOccupancy: subset.length > 0 && occupancy.some((o) => o.avg > 0)
    };
  };
  const viewerG = buildDay(rows.filter((r) => isAudience(r.role)));
  const operatorG = buildDay(rows.filter((r) => !isAudience(r.role)));
  const allG = buildDay(rows);
  const ownerSessions = ownerSessionsFrom(rows);

  // 관리자(owner) 방문 기록 — 세션별(여러 번 들어오면 여러 줄). 설정된 owner 이메일과 해시가 맞으면
  // 이메일로, 아니면 익명 #N(일반 방문자는 매칭 집합에 없어 절대 이메일로 안 풀림). 체류는 초 단위.
  const hashToOwnerEmail = new Map(getOwnerEmails().map((e) => [accountHashOf(e), e] as const));
  const acctTag = new Map<string, number>();
  const ownerVisits = rows
    .filter((r) => r.role === "owner")
    .map((r) => {
      const h = r.account_hash ?? "";
      if (!acctTag.has(h)) acctTag.set(h, acctTag.size + 1);
      const startMs = sStart(r);
      return {
        t: startMs,
        device: DEVICE_SET.has(r.device) ? r.device : "desktop",
        account: hashToOwnerEmail.get(h) ?? `계정 #${acctTag.get(h)}`,
        seconds: Math.max(0, Math.round(durMs(r) / 1000)), // 실측 체류(가시 구간 합집합)
        segments: r.segments ?? 1
      };
    })
    .sort((a, b) => a.t - b.t);
  const ownerSeconds = ownerVisits.reduce((sum, v) => sum + v.seconds, 0);
  const dualHashes = NO_DUAL;
  const sessions = buildSessionLog(rows, hashToOwnerEmail, dualHashes); // 그날 전체 세션 로그(최근 순)
  const { viewer: summaryViewer, operator: summaryOperator, all: summaryAll } = summarizeSplit(rows);
  const operators = summaryOperator.visitors;

  // R12: 그날 시청자(의미 방문) 중 그 전에 본 적 없는 계정=새, 있으면 재방문.
  const knownAccounts = await loadKnownAccounts(supabase, dateKey);
  const viewerAccounts = new Set(
    rows.filter((r) => isAudience(r.role) && isMeaningful(r)).map((r) => sAcct(r))
  );
  let newVisitors = 0;
  let returningVisitors = 0;
  for (const acc of viewerAccounts) {
    if (knownAccounts.has(acc)) returningVisitors += 1;
    else newVisitors += 1;
  }

  return {
    ok: true,
    data: {
      dateKey,
      viewer: viewerG,
      operator: operatorG,
      all: allG,
      ownerSessions,
      ownerVisits,
      ownerSeconds,
      summaryViewer,
      summaryOperator,
      summaryAll,
      operators,
      newVisitors,
      returningVisitors,
      sessions,
      nowMark
    }
  };
}

// 관리자(소유자) 전용 보안 데이터 — 개발자 인사이트 보안 패널과 같되 '개발자' 섹션은 뺀다.
// owner/developer만(서버 검증) — 매니저·작업자에겐 절대 내려가지 않는다(민감: 이메일·세션).
export type OwnerSecurityData = {
  activeUnlockCount: number;
  passcodeVersion: number | null;
  passcodeUpdatedAt: string | null;
  unlockDurationMinutes: number | null;
  access: { owners: AccessPerson[]; developers: AccessPerson[] };
};
export type OwnerSecurityResult =
  | { ok: true; data: OwnerSecurityData }
  | { ok: false; error: string };

export async function getOwnerSecurityAction(): Promise<OwnerSecurityResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "관리자만 볼 수 있어요." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }

  const { data: cal } = await supabase.from("calendars").select("id").eq("slug", SLUG).maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const [unlockRes, passcodeRes, adminRes] = await Promise.all([
    // P0-PRIV-2: 잠금해제는 auth-세션 결속 grants가 정본(legacy unlock_sessions는 미사용).
    supabase
      .from("private_unlock_grants")
      .select("user_id, expires_at")
      .eq("calendar_id", calendarId)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true }),
    supabase
      .from("private_layer_settings")
      .select("passcode_version, passcode_updated_at, unlock_duration_minutes")
      .eq("calendar_id", calendarId)
      .maybeSingle(),
    // 개발자(platform_admins) 이메일 — 관리자 화면엔 표시하지 않고, "지금 연 계정" 수에서 제외할 때만 쓴다.
    supabase.from("platform_admins").select("email")
  ]);

  const emailFor = makeEmailResolver(supabase);

  // 관리자 화면은 개발자가 없는 듯 다룬다 → 개발자 세션은 "지금 연 계정" 수에서 처음부터 뺀다.
  const developerEmailSet = new Set(
    ((adminRes.data ?? []) as { email?: string }[])
      .map((a) => normalizeEmail(a.email))
      .filter((e): e is string => Boolean(e))
  );
  const unlockRows = (unlockRes.data ?? []) as { user_id: string; expires_at: string }[];
  // 예전엔 for + await로 한 사람씩 줄 세워 물었다(N × 왕복). 이제 목록 한 번이면 다 채워지므로
  // 병렬로 해석해도 왕복이 늘지 않는다.
  const unlockResolved = await Promise.all(
    unlockRows.map(async (u) => ({
      userId: u.user_id,
      email: (await emailFor(u.user_id)) ?? "(알 수 없음)",
      expiresAt: u.expires_at
    }))
  );
  const unlockByEmail = new Map<string, { userId: string; expiresAt: string }>();
  let activeNonDevCount = 0;
  for (const u of unlockResolved) {
    unlockByEmail.set(u.email, { userId: u.userId, expiresAt: u.expiresAt });
    if (!developerEmailSet.has(u.email)) activeNonDevCount += 1;
  }
  const toAccess = (email: string): AccessPerson => {
    const s = unlockByEmail.get(email);
    return { email, expiresAt: s?.expiresAt ?? null, userId: s?.userId ?? null };
  };

  const passcode = passcodeRes.data as {
    passcode_version?: number;
    passcode_updated_at?: string;
    unlock_duration_minutes?: number;
  } | null;

  return {
    ok: true,
    data: {
      activeUnlockCount: activeNonDevCount,
      passcodeVersion: passcode?.passcode_version ?? null,
      passcodeUpdatedAt: passcode?.passcode_updated_at ?? null,
      unlockDurationMinutes: passcode?.unlock_duration_minutes ?? null,
      access: {
        owners: getOwnerEmails().map(toAccess),
        developers: []
      }
    }
  };
}

// ── 멤버용(관리자·매니저·작업자) 월별 인사이트 — 수치 없는 4패널(일정·참여·트렌드·하이라이트) ──
// 보안 경계: 보안/시스템/방문 원시 데이터는 이 타입에 아예 없다. 바 크기는 0~1 비율만 보내(원시 수치
// 미노출), 허용된 하트 합계(이 달/누적)만 숫자로 준다. 하이라이트의 방문 최다일·시간대는 "날짜·시"만.
export type MemberInsightsData = {
  month: { year: number; month: number };
  content: {
    nextBroadcast: { dateKey: string; titles: string[] } | null;
    // 집계 수치는 줄세우기와 무관 → 노출 OK.
    thisMonthContent: number;
    lastMonthContent: number;
    daysWithContent: number;
    restDays: number;
    busiestWeekday: number | null;
    quietestWeekday: number | null;
    // 태그 순위의 "정확한 개수"는 줄세우기가 될 수 있어 비율(막대 길이)만.
    tags: { name: string; ratio: number; bgColor: string; borderColor: string }[];
  };
  engagement: {
    monthHearts: number;
    totalHearts: number;
    monthly: { ym: string; count: number }[]; // 월별 하트 합계(집계) — 노출 OK
    topTitles: string[]; // 인기 컨텐츠는 제목만(개별 하트 수는 줄세우기라 숨김)
  };
  trend: {
    months: string[];
    content: number[]; // 월별 컨텐츠 수(집계)
    hearts: number[]; // 월별 하트 합계(집계)
    broadcastHours: number[]; // 6개월 월별 총 방송시간(시간) — 관리자·매니저·작업자도 공유
    broadcastDaily: number[]; // 보는 달 일별 방송시간(시간)
    broadcastDays: number; // 보는 달 방송한 날 수
    contentByTag: TrendStack; // 콘텐츠 대분류별 6개월(수치 노출 OK)
    modifierByTag: TrendStack; // 방식별 6개월
    heartsByTag: TrendStack; // 하트 받은 태그 6개월 — 비율만(정규화, 정확 수 숨김)
  };
  highlight: {
    peakDay: string | null; // 방문 최다일(YYYY-MM-DD) — 인원수 없음(방문 수는 민감)
    peakHour: number | null; // 최고 시간대(0~23)
    topTitle: string | null; // 인기 컨텐츠 제목
    busiestWeekday: number | null;
  };
};
export type MemberInsightsResult =
  | { ok: true; data: MemberInsightsData }
  | { ok: false; error: string };

export async function getMemberInsightsAction(
  year: number,
  month: number
): Promise<MemberInsightsResult> {
  const actor = await resolveCurrentActor(SLUG);
  // 시청자/비로그인 제외 — 관리자·매니저·작업자·개발자만(개발자는 보통 전체 버전을 쓴다).
  if (!actor.isAuthenticated || actor.role === "viewer") {
    return { ok: false, error: "권한이 없습니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const y = year;
  const m = month;
  const monthStart = `${y}-${pad(m)}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const todayKey = todayKstKey();
  const curYm = `${y}-${pad(m)}`;
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const sixStart = `${monthKeys[0]}-01`;

  const [eventsRes, tagsRes, nextRes, paletteRes, heartsRes, visitRows, bcastRes, vodRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, date_key, is_public")
      .is("deleted_at", null)
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", sixStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("event_tags")
      .select("event_id, broadcast_tags(id, display_name, color_key), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", sixStart)
      .lt("events.date_key", nextMonthStart),
    supabase
      .from("events")
      .select("date_key, public_title, event_tags(broadcast_tags(display_name))")
      .is("deleted_at", null)
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", todayKey)
      .order("date_key", { ascending: true })
      .limit(40),
    supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    fetchAllRowsPaged<{ day: string; account_hash: string | null; started_at: string }>(() =>
      supabase
        .from("visit_session")
        .select("day, account_hash, started_at")
        .gte("day", monthStart)
        .lt("day", nextMonthStart)
        .order("id", { ascending: true })
    ),
    // 방송시간 6개월 — 관리자·매니저·작업자도 트렌드에서 볼 수 있게(공개 API엔 여전히 미노출).
    supabase
      .from("broadcast_session")
      .select("start_day, started_at, last_live_at, ended_at")
      .gte("start_day", sixStart)
      .lt("start_day", nextMonthStart),
    // 세션 이전 시대 방송시간 폴백(0068 다시보기 길이) — 세션 없는 날만 채운다.
    supabase
      .from("vod_archive")
      .select("broadcast_day, duration_ms, reg_date")
      .gte("broadcast_day", sixStart)
      .lt("broadcast_day", nextMonthStart)
  ]);
  const broadcast = computeBroadcast(
    mergeVodFallback((bcastRes.data ?? []) as BcastRow[], (vodRes.data ?? []) as VodFallbackRow[]),
    monthKeys,
    y,
    m
  );

  // 휴뱅 일정 id + 태그(6개월) 집계. 세부는 대분류로 롤업.
  const catMap = await loadTagCategoryMap(supabase, calendarId);
  const catOf = (bt?: { id?: string; display_name?: string; color_key?: string }) =>
    (bt?.id && catMap.get(bt.id)) || {
      id: bt?.id ?? bt?.display_name ?? "?",
      name: bt?.display_name ?? "?",
      colorKey: bt?.color_key ?? "",
      bgHex: null as string | null,
      kind: "content" as const
    };
  const tagRows = (tagsRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restIds = new Set<string>();
  for (const row of tagRows) {
    if (row.broadcast_tags?.display_name === REST_TAG) restIds.add(row.event_id);
  }
  const allEvents = (eventsRes.data ?? []) as { id: string; date_key: string }[];
  const isContent = (e: { id: string }) => !restIds.has(e.id);
  const thisMonth = allEvents.filter(
    (e) => e.date_key >= monthStart && e.date_key < nextMonthStart && isContent(e)
  );
  const thisMonthIds = new Set(thisMonth.map((e) => e.id));

  // 요일 분포.
  const wd = Array(7).fill(0) as number[];
  for (const e of thisMonth) wd[weekdayOf(e.date_key)] += 1;
  const maxWd = Math.max(...wd, 0);
  const minWd = Math.min(...wd);
  const busiestWeekday = thisMonth.length > 0 ? wd.indexOf(maxWd) : null;
  const quietestWeekday = thisMonth.length > 0 && maxWd !== minWd ? wd.indexOf(minWd) : null;

  // 집계 수치(줄세우기 무관) — 노출 OK.
  const thisMonthContent = thisMonth.length;
  const daysWithContent = new Set(thisMonth.map((e) => e.date_key)).size;
  const restDays = new Set(
    allEvents
      .filter((e) => e.date_key >= monthStart && e.date_key < nextMonthStart && restIds.has(e.id))
      .map((e) => e.date_key)
  ).size;
  const lastYm = monthKeys[monthKeys.length - 2]; // 직전 달(추세 비교용)
  const lastMonthContent = allEvents.filter(
    (e) => e.date_key.slice(0, 7) === lastYm && !restIds.has(e.id)
  ).length;

  // 태그 순위(이 달) → 비율만.
  const colorMap = new Map<string, { bg: string; border: string }>();
  for (const c of paletteRes.data ?? []) {
    colorMap.set((c as { key: string }).key, {
      bg: (c as { bg_color: string }).bg_color,
      border: (c as { border_color: string }).border_color
    });
  }
  // 태그별 컨텐츠 6개월(휴뱅 포함) — 태그 id 기준 집계(rename 자동 반영). 컨텐츠 수치는 노출 OK.
  const eventMonth = new Map<string, string>(
    allEvents.map((e) => [e.id, e.date_key.slice(0, 7)])
  );
  const ctTagInfo = new Map<string, { name: string; color: string; total: number }>();
  const ctRows: { ym: string; key: string; n: number }[] = [];
  const ctContentEventIds = new Set<string>(); // 콘텐츠 태그 1개 이상 단 공개 일정
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catOf(bt);
    if (cat.kind === "modifier") continue; // 수식어는 컨텐츠 트렌드서 제외
    ctContentEventIds.add(row.event_id);
    ctRows.push({ ym, key: cat.id, n: 1 });
    const cur = ctTagInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      ctTagInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? colorMap.get(cat.colorKey)?.bg ?? "#cdc6ec",
        total: 1
      });
  }
  const ctCats = [...ctTagInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));
  // 콘텐츠 태그 0개인 공개 일정(휴뱅 제외) = 합성 '기타'. 항상 맨 끝.
  let ctEtc = 0;
  for (const [id, ym] of eventMonth) {
    if (restIds.has(id) || ctContentEventIds.has(id)) continue;
    ctRows.push({ ym, key: ETC_KEY, n: 1 });
    ctEtc += 1;
  }
  if (ctEtc > 0) ctCats.push({ key: ETC_KEY, label: ETC_LABEL, color: ETC_COLOR });
  const contentByTag = buildTrendStack(monthKeys, ctCats, ctRows);

  // 방식(modifier)별 6개월 — 콘텐츠와 별개 축.
  const mtInfo = new Map<string, { name: string; color: string; total: number }>();
  const mtRows: { ym: string; key: string; n: number }[] = [];
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catOf(bt);
    if (cat.kind !== "modifier") continue;
    mtRows.push({ ym, key: cat.id, n: 1 });
    const cur = mtInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      mtInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? colorMap.get(cat.colorKey)?.bg ?? "#cdc6ec",
        total: 1
      });
  }
  const modifierByTag = buildTrendStack(
    monthKeys,
    [...mtInfo.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([key, v]) => ({ key, label: v.name, color: v.color })),
    mtRows
  );

  const tagCount = new Map<string, { name: string; count: number; bgColor: string; borderColor: string }>();
  const tmContentIds = new Set<string>(); // 이 달 콘텐츠 태그를 단 일정
  for (const row of tagRows) {
    const rawName = row.broadcast_tags?.display_name;
    if (!rawName || rawName === REST_TAG || !thisMonthIds.has(row.event_id)) continue;
    const cat = catOf(row.broadcast_tags);
    if (cat.name === REST_TAG) continue;
    if (cat.kind === "modifier") continue; // 수식어(합방·시참 등)는 컨텐츠 순위서 제외
    tmContentIds.add(row.event_id);
    const cur = tagCount.get(cat.id);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(cat.colorKey);
      tagCount.set(cat.id, {
        name: cat.name,
        count: 1,
        bgColor: cat.bgHex ?? col?.bg ?? "#cdc6ec",
        borderColor: col?.border ?? "#b3a9dd"
      });
    }
  }
  // 이 달 콘텐츠 태그 0개 일정 = '기타'(휴뱅은 thisMonthIds에서 이미 빠짐).
  const tmEtc = [...thisMonthIds].filter((id) => !tmContentIds.has(id)).length;
  if (tmEtc > 0) {
    tagCount.set(ETC_KEY, { name: ETC_LABEL, count: tmEtc, bgColor: ETC_COLOR, borderColor: "#a1a1aa" });
  }
  const tagArr = [...tagCount.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const tagMax = Math.max(1, ...tagArr.map((t) => t.count));
  const tags = tagArr.map((t) => ({
    name: t.name,
    ratio: t.count / tagMax,
    bgColor: t.bgColor,
    borderColor: t.borderColor
  }));

  // 다음 방송(휴뱅 제외).
  const upcoming = (nextRes.data ?? []) as {
    date_key: string;
    public_title: string;
    event_tags?: { broadcast_tags?: { display_name?: string } }[];
  }[];
  const byDate = new Map<string, string[]>();
  for (const ev of upcoming) {
    if ((ev.event_tags ?? []).some((t) => t.broadcast_tags?.display_name === REST_TAG)) continue;
    const list = byDate.get(ev.date_key) ?? [];
    list.push(firstLine(ev.public_title));
    byDate.set(ev.date_key, list);
  }
  const firstDate = [...byDate.keys()].sort()[0];
  const nextBroadcast = firstDate ? { dateKey: firstDate, titles: byDate.get(firstDate)! } : null;

  // 하트: 이 달/누적 합계(허용) + 월별 비율 + 인기 제목.
  const heartCounts = (heartsRes.data ?? []) as { event_id: string; count: number }[];
  const totalHearts = heartCounts.reduce((s, r) => s + Number(r.count), 0);
  const infoMap = new Map<string, { dateKey: string; title: string }>();
  if (heartCounts.length > 0) {
    const { data: rows } = await supabase
      .from("events")
      .select("id, date_key, public_title, is_public")
      .is("deleted_at", null)
      .in("id", heartCounts.map((h) => h.event_id));
    for (const e of rows ?? []) {
      if ((e as { is_public?: boolean }).is_public) {
        infoMap.set((e as { id: string }).id, {
          dateKey: (e as { date_key: string }).date_key,
          title: (e as { public_title: string }).public_title
        });
      }
    }
  }
  const monthlyMap = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  let monthHearts = 0;
  const topThisMonth: { title: string; count: number }[] = [];
  for (const h of heartCounts) {
    const info = infoMap.get(h.event_id);
    if (!info) continue;
    const ym = info.dateKey.slice(0, 7);
    if (monthlyMap.has(ym)) monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + Number(h.count));
    if (ym === curYm) {
      monthHearts += Number(h.count);
      topThisMonth.push({ title: firstLine(info.title), count: Number(h.count) });
    }
  }
  const monthlyCounts = monthKeys.map((k) => monthlyMap.get(k) ?? 0);
  const monthly = monthKeys.map((k, i) => ({ ym: k, count: monthlyCounts[i] }));
  const topSorted = topThisMonth.sort((a, b) => b.count - a.count);
  const topTitles = topSorted.slice(0, 5).map((t) => t.title);
  const topTitle = topSorted[0]?.title ?? null;

  // 하트 받은 태그 6개월 — '일정당 평균 하트'(비율. 일정 수 많은 태그가 자동 1등이 되지 않게)
  // + 정규화로 정확 수 숨김(막대 비율·높이만 유지). showNumbers=false.
  const memHeartByEvent = new Map<string, number>(
    heartCounts.map((h) => [h.event_id, Number(h.count)])
  );
  const hbtInfo = new Map<string, { name: string; color: string; h: number; e: number }>();
  const hbtAgg = new Map<string, { h: number; e: number }>(); // `${ym}|${catId}`
  const hbtSeen = new Set<string>(); // `${eventId}|${catId}` — 같은 대분류 세부 태그 중복 방지
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catOf(bt);
    if (cat.kind === "modifier") continue; // 수식어는 태그별 하트 트렌드서 제외
    const dedup = `${row.event_id}|${cat.id}`;
    if (hbtSeen.has(dedup)) continue;
    hbtSeen.add(dedup);
    const h = memHeartByEvent.get(row.event_id) ?? 0;
    const aggKey = `${ym}|${cat.id}`;
    const agg = hbtAgg.get(aggKey) ?? { h: 0, e: 0 };
    agg.h += h;
    agg.e += 1;
    hbtAgg.set(aggKey, agg);
    const cur = hbtInfo.get(cat.id);
    if (cur) {
      cur.h += h;
      cur.e += 1;
    } else
      hbtInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? colorMap.get(cat.colorKey)?.bg ?? "#f7a8c0",
        h,
        e: 1
      });
  }
  const hbtRows: { ym: string; key: string; n: number }[] = [...hbtAgg.entries()].map(
    ([k, v]) => ({
      ym: k.slice(0, 7),
      key: k.slice(8),
      n: Math.round((v.h / Math.max(1, v.e)) * 10) / 10
    })
  );
  const hbtRaw = buildTrendStack(
    monthKeys,
    [...hbtInfo.entries()]
      .filter(([, v]) => v.h > 0)
      .sort((a, b) => b[1].h / b[1].e - a[1].h / a[1].e)
      .map(([key, v]) => ({ key, label: v.name, color: v.color })),
    hbtRows
  );
  const hbtGmax = Math.max(1, ...hbtRaw.months.map((m) => m.total));
  const heartsByTag: TrendStack = {
    cats: hbtRaw.cats,
    months: hbtRaw.months.map((m) => ({
      ym: m.ym,
      total: Math.round((m.total / hbtGmax) * 100),
      counts: Object.fromEntries(
        Object.entries(m.counts).map(([k, v]) => [k, Math.round((v / hbtGmax) * 100)])
      )
    }))
  };

  // 트렌드(6개월) — 컨텐츠·하트 월별 집계 수치(노출 OK). 방문은 개발자 전용이라 여기 없음.
  const contentByMonth = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  for (const e of allEvents) {
    if (restIds.has(e.id)) continue;
    const ym = e.date_key.slice(0, 7);
    if (contentByMonth.has(ym)) contentByMonth.set(ym, (contentByMonth.get(ym) ?? 0) + 1);
  }
  const contentCounts = monthKeys.map((k) => contentByMonth.get(k) ?? 0);

  // 하이라이트: 방문 최다일·최고 시간대(날짜·시만, 수치 없음). 방문은 계정 단위라 (날짜,계정)당 1회만
  // 세고(최다일=계정 수), 시간대는 그 (날짜,계정)의 '첫 진입 시각'으로 센다.
  const dayTally = new Map<string, number>();
  const hourTally = Array(24).fill(0) as number[];
  const hlFirst = new Map<string, { hour: number; t: number }>();
  const hlDaySeen = new Set<string>();
  for (const row of visitRows) {
    const id = `${row.day}|${row.account_hash ?? "anon"}`;
    if (!hlDaySeen.has(id)) {
      hlDaySeen.add(id);
      dayTally.set(row.day, (dayTally.get(row.day) ?? 0) + 1);
    }
    const t = new Date(row.started_at).getTime();
    if (Number.isNaN(t)) continue;
    const h = Math.floor((t + KST_MS) / 3600000) % 24;
    const prev = hlFirst.get(id);
    if (!prev || t < prev.t) hlFirst.set(id, { hour: h, t });
  }
  for (const v of hlFirst.values()) hourTally[v.hour] += 1;
  let peakDay: string | null = null;
  let peakDayCount = 0;
  for (const [day, c] of dayTally) {
    if (c > peakDayCount) {
      peakDayCount = c;
      peakDay = day;
    }
  }
  const peakHourCount = Math.max(0, ...hourTally);
  const peakHour = peakHourCount > 0 ? hourTally.indexOf(peakHourCount) : null;

  return {
    ok: true,
    data: {
      month: { year: y, month: m },
      content: {
        nextBroadcast,
        thisMonthContent,
        lastMonthContent,
        daysWithContent,
        restDays,
        busiestWeekday,
        quietestWeekday,
        tags
      },
      engagement: { monthHearts, totalHearts, monthly, topTitles },
      trend: {
        months: monthKeys,
        content: contentCounts,
        hearts: monthlyCounts,
        broadcastHours: broadcast.broadcastHours,
        broadcastDaily: broadcast.broadcastDaily,
        broadcastDays: broadcast.broadcastDays,
        contentByTag,
        modifierByTag,
        heartsByTag
      },
      highlight: { peakDay, peakHour, topTitle, busiestWeekday }
    }
  };
}
