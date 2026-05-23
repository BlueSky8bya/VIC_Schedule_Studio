import { isSupabaseConfigured } from "@/lib/auth/config";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const next = sanitizeNextPath(params.next ?? "/");

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">VIC Studio</p>
        <h1>Google 로그인</h1>
        <p>
          소유자와 trusted member 권한은 Google OAuth로 인증된 이메일에만
          부여됩니다. 이메일 주소를 아는 것만으로는 권한을 받을 수 없습니다.
        </p>

        {!configured ? (
          <div className="auth-warning">
            Supabase 환경 변수가 아직 비어 있어 Google 로그인이 비활성화되어
            있습니다. `.env.local`에 Supabase URL과 anon key를 넣어 주세요.
          </div>
        ) : null}

        {params.error ? <div className="auth-warning">{params.error}</div> : null}

        <form action="/api/auth/login" method="post">
          <input name="next" type="hidden" value={next} />
          <button className="button primary" disabled={!configured} type="submit">
            Google로 로그인
          </button>
        </form>
      </section>
    </main>
  );
}

function sanitizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
