import { createHash } from "node:crypto";

// 익명 계정 해시 — 같은 계정을 하루 단위로 셀 수 있게만 한다. 단방향(salt+이메일 → sha256)이라
// 원문 이메일/user_id는 저장되지 않는다. salt는 서버 전용 비밀.
//
// 결정적이라 '아는 이메일을 정방향 해싱해 대조'하면 알려진 계정(owner·신뢰 멤버)은 식별되고,
// 모르는 계정은 끝까지 익명으로 남는다 — 방문 기록과 행동 기록(0062)이 같은 스킴을 써야
// 두 테이블을 한 타임라인으로 이을 수 있으므로 여기 한 곳에서만 정의한다.
// (actions.ts는 "use server"라 동기 함수를 export할 수 없어 모듈을 분리했다.)
export function accountHashOf(email: string): string {
  const salt =
    process.env.VISIT_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "vic-visit-salt";
  return createHash("sha256").update(`${salt}:${email}`).digest("hex").slice(0, 32);
}
