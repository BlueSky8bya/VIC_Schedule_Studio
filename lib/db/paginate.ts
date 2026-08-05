// PostgREST 페이지네이션 — 이 저장소가 **두 번** 당한 함정의 단일 해법.
//
// Supabase(PostgREST)는 응답 행 수를 서버 설정(기본 1000)으로 자른다. `.limit(100000)`을 줘도
// 1000행만 오고, **오류도 안 난다**. 그래서 하루 기록이 1000행을 넘는 순간 그 뒤가 통째로
// 사라지는데 화면은 멀쩡해 보인다(실측: 방문 목록이 15:29에서 멈춤 / 월별 패널 뒷날짜 증발).
//
// 규칙: 전체를 받아야 하는 조회는 반드시 이 함수를 쓴다. `.limit(네 자리)`는 금지
// (tests/unit/activity-row-cap.test.ts가 소스에서 막는다).

export const PAGE_SIZE = 1000;

/** 안전장치 — 잘못된 조건으로 무한 루프에 빠지지 않게 하는 상한(행 수). */
export const DEFAULT_HARD_CAP = 50_000;

/**
 * `range(from, to)`로 끝까지 받아 한 배열로 잇는다.
 *
 * - 마지막 페이지 판정은 **길이가 PAGE_SIZE 미만**일 때. 빈 배열만 보고 끝내면 정확히 배수로
 *   떨어지는 경우 한 번 더 왕복하지만 결과는 같다.
 * - 오류가 나면 **그때까지 받은 것만** 돌려준다. 부분 데이터가 무(無)보다 낫고, 호출부는
 *   대부분 화면 표시용이다(조용한 실패가 아니라 조용한 축소 — 로그는 호출부 책임).
 */
export async function fetchAllRows<T>(
  make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  hardCap: number = DEFAULT_HARD_CAP
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < hardCap; from += PAGE_SIZE) {
    const { data, error } = await make(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}
