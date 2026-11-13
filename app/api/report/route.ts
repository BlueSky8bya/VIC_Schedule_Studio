import { NextResponse } from "next/server";
import { skipAnalyticsRequest } from "@/lib/analytics/guard";
import { submitReport } from "@/lib/reports/report";

// 사이트 제보 받기(0167) — 문서 페이지의 제보 창이 multipart로 보낸다. 로그인 없이 누구나 보낼 수 있으므로
// 검증·한도는 lib/reports/report.ts가 쥔다(말머리·글자 수·이미지 형식/크기/개수·시간당 상한·숨은 칸).
// 로컬·자동화 브라우저의 요청은 운영 DB에 남기지 않고 성공처럼만 답한다(lib/analytics/guard — 검증 트래픽 오염 방지).
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 21 * 1024 * 1024; // 캡처 10장 × 2MB + 글

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "보내는 내용이 너무 커요." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "보낸 내용을 읽지 못했어요." }, { status: 400 });
  }
  if (skipAnalyticsRequest(request.headers)) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const result = await submitReport(form);
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: result.error }, { status: result.status });
}
