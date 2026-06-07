import { NextResponse } from "next/server";
import {
  endVisitSession,
  startVisitSession,
  touchVisitSession
} from "@/lib/insights/actions";

// 방문/체류 세션 비콘 창구 — 클라이언트가 keepalive fetch로 보낸다(나갈 때 end가 끝까지 전송되게).
// start=진입(세션 생성, id 반환), touch=하트비트(last_seen 갱신), end=이탈(ended_at 확정).
// 권한/역할/계정은 각 액션 내부에서 actor로 재확인 — 이 라우트는 새 권한면을 만들지 않는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.op !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const device = typeof body.device === "string" ? body.device : "desktop";
  const id = typeof body.id === "string" ? body.id : "";
  // 비로그인 방문자 기기 식별자(localStorage) — 고유 방문자 dedup용(서버에서 해시해 account_hash로).
  const anonId = typeof body.anonId === "string" ? body.anonId : undefined;
  switch (body.op) {
    case "start":
      return NextResponse.json(await startVisitSession(device, anonId));
    case "touch":
      return NextResponse.json(await touchVisitSession(id));
    case "end":
      return NextResponse.json(await endVisitSession(id));
    default:
      return NextResponse.json({ ok: false }, { status: 400 });
  }
}
