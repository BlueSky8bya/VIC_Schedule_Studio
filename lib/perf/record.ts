import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 서버 구간 표본 1행을 '응답 이후'(after)에 fire-and-forget로 남긴다 → 응답 지연 0(측정이 앱을
// 느리게 만들면 안 된다). after 컨텍스트가 아니면(빌드·일부 런타임) 조용히 스킵. 기록 실패도 무시.
export function recordPerfSample(label: string, durMs: number): void {
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
