// Supabase HTTP 호출의 안전장치 — 시간 상한 + 읽기 재시도(2026-09-28).
//
// 사고: 포스터 SSR의 27%(7일 2,542건 중 797건)가 305·600·906초에 끝났다(perf_samples). 정확히
// undici 기본 headersTimeout(300초)의 배수 — 살아 있다고 믿은 keep-alive 소켓이 응답을 영영 안 주고,
// 300초 뒤 오류가 나면 클라이언트가 다시 시도해 600·900초까지 갔다. 시청자는 그동안 빈 화면, Vercel은
// 그동안 함수 시간을 계속 태웠다(Hobby 한도 초과의 큰 몫). SOOP 쪽 fetch는 이미 AbortSignal.timeout(8s)이
// 있었는데 Supabase 클라이언트만 상한이 없었다.
//
// 규칙:
//   · 모든 요청에 10초 상한(호출자가 준 signal이 있으면 둘 중 먼저 오는 쪽).
//   · GET/HEAD(PostgREST 읽기)만 한 번 재시도 — 새 소켓으로 붙는다. POST(RPC·쓰기)는 서버에 닿았을 수도
//     있어 재시도하지 않는다(중복 삽입 위험). 읽기 RPC도 POST라 재시도 없음 — 대신 10초 안에 실패한다.
//   · 재시도 전 짧게 쉰다(150ms) — 같은 순간 같은 소켓을 다시 잡지 않게.
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 150;

function withTimeout(init: RequestInit | undefined, ms: number): RequestInit {
  const timeout = AbortSignal.timeout(ms);
  const outer = init?.signal;
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  const signal = outer && anyFn ? anyFn([outer, timeout]) : outer ?? timeout;
  return { ...init, signal };
}

function isRetryableRead(input: RequestInfo | URL, init: RequestInit | undefined, err: unknown): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  if (init?.signal?.aborted) return false; // 호출자가 스스로 취소한 건 그대로 둔다
  const name = (err as { name?: string } | null)?.name ?? "";
  // TimeoutError = 우리 상한, AbortError = 상한(구형 런타임 이름), TypeError = 소켓/네트워크 오류.
  return name === "TimeoutError" || name === "AbortError" || name === "TypeError";
}

export const guardedFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, withTimeout(init, TIMEOUT_MS));
  } catch (err) {
    if (!isRetryableRead(input, init, err)) throw err;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fetch(input, withTimeout(init, TIMEOUT_MS));
  }
};
