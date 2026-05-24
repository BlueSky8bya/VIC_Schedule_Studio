import { revalidateTag } from "next/cache";

// 익명 공개 일정 묶음(public-loader의 unstable_cache)에 붙는 태그.
export const PUBLIC_SCHEDULE_CACHE_TAG = "public-schedule";

// 공개 일정 캐시를 즉시 무효화한다 — 소유자가 스튜디오에서 한 편집을
// 30초 TTL을 기다리지 않고 시청자 화면에 바로 반영하기 위함.
// 주의: 하트 토글처럼 빈번한 변경에는 호출하지 않는다(캐시 효과가 사라짐).
export function revalidatePublicSchedule() {
  revalidateTag(PUBLIC_SCHEDULE_CACHE_TAG);
}
