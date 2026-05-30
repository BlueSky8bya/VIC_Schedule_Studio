import { NextResponse } from "next/server";
import {
  deleteStickerAction,
  deleteStickerBatchAction,
  saveStickerAction,
  saveStickerBatchAction,
  type SaveStickerInput
} from "@/lib/schedules/sticker-actions";

// 꾸미기 스티커 쓰기(저장/삭제/일괄)를 keepalive fetch로 받는 단일 창구.
// keepalive: true 로 보내면 페이지를 떠나거나(달 이동·창 전환·닫기·새로고침) 전송이 끝까지 보장된다
// → "스티커 옮기고/추가하고 바로 나가면 저장 안 됨"을 구조적으로 없앤다. 권한은 각 액션 내부의
// canDecorate 검사가 그대로 적용된다(이 라우트는 새 권한면을 만들지 않는다).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.op !== "string") {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  const p = body.payload ?? {};
  try {
    switch (body.op) {
      case "save":
        return json(await saveStickerAction(p as SaveStickerInput));
      case "delete":
        return json(await deleteStickerAction(String(p.id)));
      case "saveBatch":
        return json(await saveStickerBatchAction((p.inputs ?? []) as SaveStickerInput[]));
      case "deleteBatch":
        return json(await deleteStickerBatchAction((p.ids ?? []) as string[]));
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
