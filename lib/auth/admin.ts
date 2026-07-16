import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseServiceConfigured } from "@/lib/auth/config";

// service-role 클라이언트는 '요청과 무관'하다 — 쿠키를 안 읽고(persistSession:false) 세션도 안 든다.
// 그런데 호출마다 새로 만들면서 GoTrue/Postgrest/Realtime/Functions 클라이언트를 매번 새로 조립했다
// (표본 기록·방문 세션·인사이트 액션이 각각 호출한다). 한 번 만들어 재사용한다.
//   ※ 반대로 createSupabaseServerClient(lib/auth/server.ts)는 cookies()를 닫아 잡으므로 반드시
//     요청마다 새로 만들어야 한다 — 그건 건드리지 않는다.
let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient() {
  if (!isSupabaseServiceConfigured()) {
    return null;
  }
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );
  }
  return cached;
}
