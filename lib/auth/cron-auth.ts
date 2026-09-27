import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 크론 라우트 인증 — 두 열쇠 중 하나면 통과한다.
//  1) CRON_SECRET(Vercel env): GitHub Actions·cron-job.org 등 바깥에서 부르는 길.
//  2) DB Vault의 `vic_cron_token`(0128): pg_cron + pg_net이 DB 안에서 부르는 길. 토큰은 DB가 만들고 DB에만 있어
//     Vercel env를 손대지 않아도 되고, 비교는 서비스 롤 RPC(cron_token_matches)가 DB 안에서 한다.
// 두 길 다 Bearer 헤더 하나로 통일 — 라우트마다 인증 코드를 따로 쓰지 않는다.
export async function isCronAuthorized(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && token === secret) return true;
  // 길이·문자 제한 — DB에 아무 문자열이나 넘기지 않는다(토큰은 hex 48자).
  if (!/^[0-9a-f]{32,64}$/.test(token)) return false;
  const db = createSupabaseAdminClient();
  if (!db) return false;
  try {
    const { data, error } = await db
      .rpc("cron_token_matches", { p_token: token })
      .abortSignal(AbortSignal.timeout(4000));
    return !error && data === true;
  } catch {
    return false;
  }
}
