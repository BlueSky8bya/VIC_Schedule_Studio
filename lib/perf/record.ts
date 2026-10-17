import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";

// Uniform sampling before scheduling after() cuts observation writes without
// favoring slow/failed spans and biasing the latency distribution. Logs remain
// independent. Sample counts are observations, not total requests.
function sampleRate(): number {
  const configured = process.env.PERF_SAMPLE_RATE;
  if (configured === undefined || configured.trim() === "") return 0.1;
  const value = Number(configured);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.1;
}

// after() removes the DB write from the response path, but still uses runtime
// resources. Build/non-request contexts and recording failures are skipped.
export function recordPerfSample(label: string, durMs: number): void {
  // dev에서는 기록하지 않는다. 두 가지 이유: ① 로컬 표본이 운영 지표를 오염 ② dev에서
  // 렌더 중 after() 예약이 이후 cookies() 호출을 "inside after"로 오검출시켜
  // RSC refresh 렌더가 간헐적으로 터졌다(잠금해제 후 화면 미반영의 근본 원인으로 실측).
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (!Number.isFinite(durMs) || durMs < 0 || Math.random() >= sampleRate()) return;
  try {
    after(async () => {
      try {
        const sb = createSupabaseAdminClient();
        if (!sb) return;
        await sb.from("perf_samples").insert({ label, dur_ms: Math.round(durMs * 10) / 10 });
      } catch {
        /* 기록 실패는 무시 */
      }
    });
  } catch {
    /* after() 불가 컨텍스트 → 스킵 */
  }
}
