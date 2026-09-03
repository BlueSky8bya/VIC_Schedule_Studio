"use client";

import { foldDigits, isClientKind, type ClientKind } from "@/lib/activity/kinds";
import { skipAnalyticsClient } from "@/lib/analytics/guard";

// 클라 행동 기록(0062) — 열람·시선처럼 서버 왕복이 없어 지금까지 전혀 안 보이던 것들을 남긴다.
//
// 클릭마다 요청을 보내지 않는다. 버퍼에 쌓아 배치로 flush:
//   20개 쌓임 · 5초 유휴 · visibilitychange→hidden · pagehide(keepalive)
// keepalive라 떠나면서 보낸 마지막 배치도 끝까지 간다(기존 studio-write/sticker-write 관례와 동일).
//
// 보조 기능이다 — 실패는 조용히 버린다. 로그가 앱 동작을 막으면 안 된다.

const FLUSH_AT = 20;
const IDLE_MS = 5000;
// 유휴 타이머는 이벤트마다 초기화된다 → 계속 조작하면 20개가 찰 때까지 안 나간다.
// 그래서 '첫 이벤트로부터' 이 시간이 지나면 활동 중이어도 무조건 내보낸다. 안 그러면 기록이
// 한참 뒤에야 나타나 "왜 안 쌓이지?"가 된다(2026-08-04 실측).
const MAX_AGE_MS = 15000;
const MAX_BUFFER = 200; // 오프라인·연속 실패로 무한히 쌓이지 않게

type Pending = {
  kind: ClientKind;
  target?: string | null;
  meta?: Record<string, unknown> | null;
  durMs?: number | null;
  visitKey?: string | null;
};

let buffer: Pending[] = [];
let firstAt = 0; // 버퍼의 첫 이벤트 시각 — MAX_AGE 판정용
let idleTimer: number | null = null;
let ageTimer: number | null = null;
let wired = false;
let clickWired = false;

// 방문(탭) 식별자 — 비콘이 sessionStorage에 넣어둔 값과 같은 키를 읽는다(같은 탭 = 같은 방문).
// 여기서 만들지는 않는다. 비콘이 아직 안 돌았으면 null로 두고, 다음 이벤트에서 다시 시도한다.
const VISIT_KEY_STORE = "vic:visitKey";
function currentVisitKey(): string | null {
  try {
    const raw = window.sessionStorage.getItem(VISIT_KEY_STORE) ?? "";
    const sep = raw.indexOf("|");
    return sep > 0 ? raw.slice(sep + 1) : null;
  } catch {
    return null;
  }
}

function send(batch: Pending[], keepalive: boolean): void {
  if (batch.length === 0) return;
  // 자동화 브라우저·로컬 호스트의 행동은 기록하지 않는다(lib/analytics/guard.ts).
  if (skipAnalyticsClient()) return;
  // 방문 키는 **보낼 때** 다시 찍는다. 쌓을 때만 읽으면, 페이지가 열린 직후의 기록
  // (route.enter 등)이 비콘보다 먼저 나가 visit_key 없이 저장된다 → 같은 탭인데도 방문이
  // 둘로 갈려 "60분 방문에 항목 1건"이 됐다(2026-08-05 실측). flush는 최소 몇 초 뒤라
  // 그때는 키가 있다. 그래도 없으면(사생활 모드 등) null 그대로 — 서버가 계정·시간으로 붙인다.
  const stamped = batch.map((e) => (e.visitKey ? e : { ...e, visitKey: currentVisitKey() }));
  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive,
      body: JSON.stringify({ events: stamped })
    }).catch(() => {});
  } catch {
    /* 무시 */
  }
}

function flush(keepalive = false): void {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (ageTimer !== null) {
    window.clearTimeout(ageTimer);
    ageTimer = null;
  }
  const batch = buffer;
  buffer = [];
  firstAt = 0;
  send(batch, keepalive);
}

function wire(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // 화면을 숨기거나 떠날 때는 즉시 내보낸다 — 여기서 못 보내면 그 방문의 꼬리가 통째로 사라진다.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
  // 창 두 개를 나란히 띄우면 **어느 쪽도 hidden이 되지 않는다** — visibilitychange가 안 온다.
  // 포커스가 떠날 때도 내보내야 다른 창에서 한 일이 제때 쌓인다(2026-08-04 실측).
  window.addEventListener("blur", () => flush(true));
}

// ── 버튼 전수 수집 ──
// 버튼마다 개별 kind를 만들지 않는다. 레지스트리를 고쳐야 계측되는 구조면 결국 일부만 계측되고,
// 목적("안 쓰이는 버튼 찾기")이 무너진다 — 안 쓰인 버튼과 계측 안 한 버튼이 구분되지 않는다.
// 그래서 문서 하나에 위임 리스너를 걸고 target에 버튼 id를 담는다.
//
// id 우선순위:
//   1) data-act="..."  — 손으로 붙인 안정적 id. 라벨을 바꿔도 지표가 안 끊긴다.
//   2) auto:<힌트>     — 없으면 클래스/aria-label/텍스트로 유추. 편하지만 마크업이 바뀌면 갈라진다.
// 처음엔 2)로 전수 커버리지를 얻고, 중요한 버튼부터 1)로 굳히면 된다. `auto:` 접두사가
// "이 값은 깨질 수 있다"는 표시다.
const MAX_ID = 48;

// ⚠ aria-label·textContent는 **id로 쓰지 않는다.** 사용자·외부 내용이 들어오는 자리다:
//   `${s.publicTitle} 도와주러 가기` (일정 공개 제목) · `지금 방송 중: ${live.title}` (외부 방송)
//   `${asset.name} 삭제` (사용자가 만든 스티커 이름) · `${l.name} 삭제` (판서 레이어 이름)
//   카드의 textContent = 일정 제목 그 자체.
// 그대로 쓰면 제목이 activity_event.target에 저장된다 — 이 설계의 최우선 제약 위반이다.
// 사람이 읽을 이름이 필요하면 **소스에 data-act를 박는다**(정적이라 검토 가능).
//
// 상태 클래스(is-*/active/open/selected…)와 공통 클래스(button/primary/danger…)는 뺀다.
// 공통 클래스를 고르면 서로 다른 버튼이 전부 한 항목으로 뭉친다 — 예전엔 첫 토큰을 골라
// `className="button io-accent io-preview"`가 `.button`이 됐다(실측: '일반 버튼(합계)').
const GENERIC_CLASS =
  /^(button|primary|danger|secondary|icon-only|link|active|open|selected|on|is-|has-|m-io$|io-accent|tappable|pill|chip)/;
function autoId(el: HTMLElement): string {
  const tokens = (el.className || "")
    .toString()
    .split(/\s+/)
    .filter(Boolean);
  // 구체적인 토큰 우선 — 없으면 남은 것 중 아무거나, 그것도 없으면 태그 이름.
  const specific = tokens.find((c) => !GENERIC_CLASS.test(c)) ?? tokens[0];
  if (specific) return `auto:.${foldDigits(specific).slice(0, MAX_ID)}`;
  return `auto:${el.tagName.toLowerCase()}`;
}

function wireClicks(): void {
  if (typeof document === "undefined") return;
  // capture 단계 — 핸들러가 stopPropagation을 해도 놓치지 않는다(드래그·오버레이가 흔히 쓴다).
  document.addEventListener(
    "click",
    (e) => {
      const start = e.target as HTMLElement | null;
      if (!start || typeof start.closest !== "function") return;
      const el = start.closest<HTMLElement>("[data-act], button, a, [role='button']");
      if (!el) return;
      // 비활성 컨트롤은 '눌렀다'가 아니다.
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
      const explicit = el.getAttribute("data-act");
      logActivity("ui.click", { target: explicit || autoId(el) });
      // 로그아웃은 **누르는 즉시** 내보낸다. 안 그러면 버퍼에 남아 있던 이벤트가 세션이 끊긴
      // 뒤에 올라가고, 서버는 그때의 신원(=비로그인)으로 역할을 매긴다 → "편집실을 비로그인이
      // 눌렀다"는 거짓 기록이 남는다(실측). 쿠키가 아직 살아 있는 이 시점에 보내야 맞게 붙는다.
      if (explicit === "logout") flush(true);
    },
    true
  );
}

/** 행동 1건 기록. 부수효과만 있고 아무것도 기다리지 않는다. */
export function logActivity(
  kind: ClientKind,
  opts: { target?: string | null; meta?: Record<string, unknown> | null; durMs?: number } = {}
): void {
  if (typeof window === "undefined") return;
  if (!isClientKind(kind)) return; // 서버 kind 사칭 차단(진실 로그 오염 방지)
  wire();
  if (buffer.length >= MAX_BUFFER) buffer.shift(); // 가장 오래된 것부터 버린다
  buffer.push({
    kind,
    target: opts.target ?? null,
    meta: opts.meta ?? null,
    durMs: typeof opts.durMs === "number" ? opts.durMs : null,
    visitKey: currentVisitKey()
  });
  if (firstAt === 0) firstAt = Date.now();
  if (buffer.length >= FLUSH_AT || Date.now() - firstAt >= MAX_AGE_MS) {
    flush();
    return;
  }
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    flush();
  }, IDLE_MS);
  // 활동이 끊기지 않아도 첫 이벤트로부터 MAX_AGE가 지나면 나가도록 별도 타이머를 건다
  // (유휴 타이머는 계속 초기화되므로 이것만이 상한을 보장한다).
  if (ageTimer === null) {
    ageTimer = window.setTimeout(() => {
      ageTimer = null;
      flush();
    }, MAX_AGE_MS);
  }
}

// ── 체류형(열고 닫기) 도우미 ──
// event.open → event.close(dur_ms)처럼 짝이 있는 이벤트를 위해 열린 시각을 들고 있는다.
// 닫힘 신호가 유실될 수 있으므로(라우팅으로 사라짐 등) 짝이 안 맞아도 앱은 아무 영향이 없다.
const openedAt = new Map<string, number>();

export function logOpen(kind: ClientKind, target: string): void {
  openedAt.set(`${kind}|${target}`, Date.now());
  logActivity(kind, { target });
}

export function logClose(openKind: ClientKind, closeKind: ClientKind, target: string): void {
  const key = `${openKind}|${target}`;
  const started = openedAt.get(key);
  openedAt.delete(key);
  logActivity(closeKind, { target, durMs: started ? Date.now() - started : undefined });
}

// ── 정착 로깅(연타 압축) ──
// 달을 12번 넘겨 3월로 갔으면 그건 행동 12개가 아니라 의도 1개("3월 보러 가자")다. 경유지를
// 다 남기면 정작 중요한 줄(수정·잠금해제)이 반복 줄에 덮인다 — 실측에서 한 방문 52건 중
// 대부분이 `월 이동 offset=-1`이었다.
// 그래서 조용해질 때까지 기다렸다가 **도착지 1건**만 남기고, 몇 번 눌렀는지는 meta.hops로 둔다.
// (신호 = 어느 달을 보려 했나. 경유 = 배경.)
const SETTLE_MS = 700;
type Settling = { kind: ClientKind; target: string | null; hops: number; timer: number };
const settling = new Map<string, Settling>();

export function logSettled(kind: ClientKind, key: string, target: string | null): void {
  if (typeof window === "undefined") return;
  const cur = settling.get(key);
  if (cur) window.clearTimeout(cur.timer);
  const hops = (cur?.hops ?? 0) + 1;
  const timer = window.setTimeout(() => {
    const done = settling.get(key);
    settling.delete(key);
    if (!done) return;
    logActivity(done.kind, {
      target: done.target,
      meta: done.hops > 1 ? { hops: done.hops } : null
    });
  }, SETTLE_MS);
  settling.set(key, { kind, target, hops, timer });
}

/** 클릭 위임을 한 번 건다. 루트에서 1회 호출(RouteBeacon이 부른다). */
export function startClickTracking(): void {
  if (clickWired || typeof window === "undefined") return;
  clickWired = true;
  wire();
  wireClicks();
}
