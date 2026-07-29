"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import type { PublicSchedule } from "@/lib/domain/schedule-types";

// P0-SEC-2: '시청자 화면 보여주기' 미리보기의 데이터 소스.
//
// 미리보기는 편집실의 낙관적(unlocked) 이벤트를 클라이언트에서 공개 모양으로 재가공하지 않고,
// **서버 공개 로더의 스냅샷**만 쓴다(ADR-0001/0010과 같은 원칙). 재가공 경로는 공개 로더의
// 떡밥(teaser) 가림을 우회해서, 공개 시각 전의 실제 제목이 방송 화면(같이보기)으로 노출될 수
// 있었다. 대신 '방금 저장한 일정'이 미리보기에 바로 보이도록, 미리보기를 열 때마다 이 액션으로
// 신선한 공개 스냅샷을 다시 받는다(저장 액션들이 revalidatePublicSchedule을 부르므로 저장분은
// 캐시 무효화로 즉시 반영된다. 아직 저장 중(큐 비행 중)인 변경만 잠깐 안 보인다).
export async function getPublicPreviewAction(): Promise<PublicSchedule | null> {
  const actor = await resolveCurrentActor("vic");
  // 편집실 스태프만 — 익명/시청자는 이 액션을 부를 이유가 없다(공개 페이지가 이미 있음).
  if (!actor.isAuthenticated || actor.role === "viewer") {
    return null;
  }
  return getPublicSchedule("vic");
}
