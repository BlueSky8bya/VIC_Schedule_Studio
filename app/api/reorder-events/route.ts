import { NextResponse } from "next/server";
import { reorderEventsAction } from "@/lib/schedules/event-actions";

// 일정 이동/순서변경을 'keepalive fetch'로도 받을 수 있는 엔드포인트.
// 클라이언트가 keepalive: true 로 보내면 브라우저가 페이지를 떠나거나(달 이동·창 전환·닫기)
// 새로고침해도 이 요청 전송을 끝까지 보장한다 → "옮기고 바로 나가면 저장 안 됨" 문제를 구조적으로 없앤다.
// 권한은 reorderEventsAction 안의 canEditSchedule 검사가 그대로 적용되므로 새 권한면이 생기지 않는다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.dateKey !== "string" ||
    !Array.isArray(body.orderedIds) ||
    body.orderedIds.some((id: unknown) => typeof id !== "string")
  ) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const result = await reorderEventsAction({
    dateKey: body.dateKey,
    orderedIds: body.orderedIds as string[],
    movedId: typeof body.movedId === "string" ? body.movedId : undefined
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
