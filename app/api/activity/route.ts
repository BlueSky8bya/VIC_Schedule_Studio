import { NextResponse } from "next/server";
import { recordActivityBatch } from "@/lib/activity/record";
import { skipAnalyticsRequest } from "@/lib/analytics/guard";

// 클라 행동 기록 배치 창구(0062) — 클릭마다가 아니라 묶어서 온다(20개/5초 유휴/hidden/pagehide).
// 권한·역할·계정은 recordActivityBatch 안에서 서버 actor로 재확인한다. 이 라우트는 새 권한면을
// 만들지 않는다: 클라가 보낼 수 있는 건 열람·시선 이벤트뿐이고, server kind(실제 변경)는
// isClientKind 검사에서 버려진다 — 진실 로그를 클라가 오염시킬 수 없다.
const MAX_EVENTS = 50;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // 로컬 호스트·헤드리스 브라우저의 행동은 기록하지 않는다(lib/analytics/guard.ts).
  if (skipAnalyticsRequest(request.headers)) {
    return NextResponse.json({ ok: true, saved: 0, skipped: true });
  }
  const events = body.events.slice(0, MAX_EVENTS).flatMap((e: unknown) => {
    if (!e || typeof e !== "object") return [];
    const ev = e as Record<string, unknown>;
    if (typeof ev.kind !== "string") return [];
    return [
      {
        kind: ev.kind as never, // 유효성은 record 쪽 isClientKind가 판정한다
        target: typeof ev.target === "string" ? ev.target : null,
        meta: ev.meta && typeof ev.meta === "object" ? (ev.meta as Record<string, unknown>) : null,
        durMs: typeof ev.durMs === "number" ? ev.durMs : null,
        visitKey: typeof ev.visitKey === "string" ? ev.visitKey : null
      }
    ];
  });
  const saved = await recordActivityBatch(events);
  return NextResponse.json({ ok: true, saved });
}
