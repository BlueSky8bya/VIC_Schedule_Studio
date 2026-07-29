// P0-SEC-3: 서버 액션/API의 실패를 사용자에게 알릴 때, DB 드라이버·Supabase의 원문 메시지
// (영문, 테이블/컬럼명, 제약 이름 등 내부 구조)를 그대로 내보내지 않는다. 원문은 서버 로그로만
// 남기고, 클라이언트에는 '무슨 작업이 실패했는지'만 한국어로 알려준다.
//
// 사용: return { ok: false, error: safeActionError("일정 저장", error) };
export function safeActionError(taskLabel: string, error: unknown): string {
  // 서버 로그에는 원문 전체 — 운영 진단용(클라이언트로는 절대 안 나감).
  console.error(`[action-fail] ${taskLabel}:`, error);
  return `${taskLabel}에 실패했어요. 잠시 후 다시 시도해 주세요.`;
}
