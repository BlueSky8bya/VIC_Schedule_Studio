import { NextResponse } from "next/server";
import {
  deleteEventAction,
  reorderEventsAction,
  restoreEventAction,
  saveEventAction,
  updateEventTagsAction,
  updateSupportSettingsAction,
  type SaveEventInput
} from "@/lib/schedules/event-actions";
import { linkChainAction, unlinkPairAction } from "@/lib/schedules/link-actions";

// 편집실의 '중대한 쓰기'(일정 저장/삭제/이동/태그/업도움/잇기)를 keepalive fetch로 받는 단일 창구.
// 클라이언트가 keepalive: true 로 보내면 브라우저가 페이지를 떠나거나(달 이동·창 전환·닫기·새로고침)
// 새로고침해도 전송을 끝까지 보장한다 → "바꾸고 바로 나가면 저장 안 됨"을 구조적으로 없앤다.
// 권한은 각 액션 내부의 canEditSchedule/canEditEventTags/canEditSupport 검사가 그대로 적용된다
// (이 라우트는 새 권한면을 만들지 않는다 — 기존 서버 액션을 그대로 호출만 한다).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.op !== "string") {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const p = body.payload ?? {};
  try {
    switch (body.op) {
      case "save":
        return json(await saveEventAction(p as SaveEventInput));
      case "delete":
        return json(await deleteEventAction(String(p.eventId)));
      case "restore":
        // P0-DATA-1: 삭제 취소 — tombstone을 걷어 같은 id로 복구(태그/연결/하트 보존).
        return json(await restoreEventAction(String(p.eventId)));
      case "reorder":
        return json(
          await reorderEventsAction({
            dateKey: String(p.dateKey),
            orderedIds: (p.orderedIds ?? []) as string[],
            movedId: typeof p.movedId === "string" ? p.movedId : undefined
          })
        );
      case "tags":
        return json(
          await updateEventTagsAction(
            String(p.eventId),
            (p.tagIds ?? []) as string[],
            (p.primaryTagIds ?? []) as string[]
          )
        );
      case "support":
        return json(
          await updateSupportSettingsAction(String(p.eventId), {
            endDateKey: typeof p.endDateKey === "string" ? p.endDateKey : undefined,
            supportUrl: typeof p.supportUrl === "string" ? p.supportUrl : undefined
          })
        );
      case "linkChain":
        return json(await linkChainAction((p.orderedIds ?? []) as string[]));
      case "unlinkPair":
        return json(await unlinkPairAction(String(p.earlierId)));
      default:
        return NextResponse.json({ ok: false, error: "알 수 없는 작업입니다." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "저장 중 오류가 발생했어요." }, { status: 500 });
  }
}

function json(result: { ok: boolean }) {
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
