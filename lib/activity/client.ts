"use client";

import { isClientKind, type ClientKind } from "@/lib/activity/kinds";

// 클라 행동 기록(0062) — 열람·시선처럼 서버 왕복이 없어 지금까지 전혀 안 보이던 것들을 남긴다.
//
// 클릭마다 요청을 보내지 않는다. 버퍼에 쌓아 배치로 flush:
//   20개 쌓임 · 5초 유휴 · visibilitychange→hidden · pagehide(keepalive)
// keepalive라 떠나면서 보낸 마지막 배치도 끝까지 간다(기존 studio-write/sticker-write 관례와 동일).
//
// 보조 기능이다 — 실패는 조용히 버린다. 로그가 앱 동작을 막으면 안 된다.

const FLUSH_AT = 20;
const IDLE_MS = 5000;
const MAX_BUFFER = 200; // 오프라인·연속 실패로 무한히 쌓이지 않게

type Pending = {
  kind: ClientKind;
  target?: string | null;
  meta?: Record<string, unknown> | null;
  durMs?: number | null;
  visitKey?: string | null;
};

let buffer: Pending[] = [];
let idleTimer: number | null = null;
let wired = false;

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
  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive,
      body: JSON.stringify({ events: batch })
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
  const batch = buffer;
  buffer = [];
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
  if (buffer.length >= FLUSH_AT) {
    flush();
    return;
  }
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    idleTimer = null;
    flush();
  }, IDLE_MS);
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
