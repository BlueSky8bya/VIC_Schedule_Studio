import { PublicPoster } from "@/components/poster/public-poster";
import { StudioShell } from "@/components/studio/studio-shell";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { toggleEventHeartAction } from "@/lib/schedules/heart-actions";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { getStudioSchedule } from "@/lib/schedules/studio-loader";
import { getUnlockState } from "@/lib/private-layer/unlock";

export default async function HomePage() {
  const actor = await resolveCurrentActor("vic");

  if (!actor.isAuthenticated) {
    return <AuthFirstPage configured={isSupabaseConfigured()} />;
  }

  // 시청자가 아닌 모든 인증 사용자(owner/developer/manager/worker)는 스튜디오로.
  // 스튜디오 내부에서 역할별 편집/열람 권한을 다시 제어한다.
  if (actor.role !== "viewer") {
    const [schedule, unlock] = await Promise.all([
      getStudioSchedule("vic"),
      getUnlockState("vic")
    ]);

    return (
      <StudioShell
        actor={actor}
        hasUnlockSession={unlock.hasUnlockSession}
        schedule={schedule}
      />
    );
  }

  const schedule = await getPublicSchedule("vic");

  return <PublicPoster schedule={schedule} toggleHeartAction={toggleEventHeartAction} />;
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" height="22" viewBox="0 0 48 48" width="22">
      <path
        d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 36.9 26.9 38 24 38c-6 0-10.7-3.9-12.5-9.3l-6.9 5.3C7.9 41.6 15.3 46 24 46z"
        fill="#4CAF50"
      />
      <path
        d="M44.5 20H24v8.5h11.8c-1 2.8-2.9 5.1-5.3 6.6l6.5 5.5C40.9 44.4 46 38 46 24c0-1.3-.2-2.7-.5-4z"
        fill="#1976D2"
      />
    </svg>
  );
}

function AuthFirstPage({ configured }: { configured: boolean }) {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-minimal">
        <form action="/api/auth/login" method="post">
          <input name="next" type="hidden" value="/" />
          <button className="button google-login" disabled={!configured} type="submit">
            <GoogleLogo />
            Google로 로그인
          </button>
        </form>
      </section>
    </main>
  );
}
