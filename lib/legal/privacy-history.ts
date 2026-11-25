"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";

export type PrivacyHistoryRow = { effective: string; kind: string; detail: string };
/** Operational history is returned only after checking actual authority, not
 * the read-only role preview. It is never imported into the static public page. */
export async function getPrivacyHistoryAction(): Promise<{ ok: true; rows: PrivacyHistoryRow[] } | { ok: false }> {
  const actor = await resolveCurrentActor("vic");
  if (!actor.isAuthenticated || actor.role !== "developer" || actor.roleUncertain) return { ok: false };
  return { ok: true, rows: [
    { effective: "2026. 11. 13.", kind: "제정", detail: "개인정보처리방침 제정" },
    { effective: "2026. 11. 16.", kind: "정정", detail: "고른 글꼴을 받는 외부 서비스(jsDelivr·네이버) 안내 추가" },
    { effective: "2026. 11. 23.", kind: "사이트 제보", detail: "처리 전 제보도 받은 날부터 180일 뒤 삭제. 이 날부터 받는 제보는 방송인도 함께 확인(그 전에 받은 제보는 개발자만)" },
    { effective: "2026. 11. 25.", kind: "사이트 제보", detail: "다시 개발자만 확인(방송인은 보지 않음)" },
    { effective: "2026. 11. 26.", kind: "빅타민", detail: "기기 내 교감 습관·기질 지속성과 기존 학습 제어 설명 보완. 전송·계정 연결·동의창 추가 없음. 공개 변경 안내 간소화" },
  ] };
}
