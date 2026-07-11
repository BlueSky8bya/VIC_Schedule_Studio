import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PublicPoster } from "@/components/poster/public-poster";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { detectInAppBrowser, isMobileUserAgent } from "@/lib/auth/in-app-browser";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { toggleEventHeartAction } from "@/lib/schedules/heart-actions";
import { getPublicBroadcastStats, getPublicSchedule } from "@/lib/schedules/public-loader";
import { timed } from "@/lib/perf/perf";

export default async function HomePage() {
  const actor = await timed("page:/ actor", () => resolveCurrentActor("vic"));

  // 새로고침 복원: 쿠키에서 직전 화면 상태를 읽어 서버 렌더 초기값으로 넘긴다(깜빡임 없음).
  const mem = parseViewCookie((await cookies()).get(VIEW_COOKIE)?.value);
  // 휴대폰이면 모바일 레이아웃을 서버에서 처음부터 그려 데스크톱 레이아웃 깜빡임을 없앤다.
  const narrow = isMobileUserAgent((await headers()).get("user-agent") ?? "");

  // 비로그인(익명) 진입 — 공개 포스터만 보여준다. 비공개/엠바고/작업자 레이어는 그대로
  // 로그인+패스코드가 필요(권한·RLS·언락 게이트는 손대지 않음). Supabase 미설정 환경에서는
  // 공개 데이터(익명 읽기 클라)도 못 불러오므로 기존 로그인 안내 화면을 그대로 띄운다.
  if (!actor.isAuthenticated) {
    if (!isSupabaseConfigured()) {
      const ua = (await headers()).get("user-agent") ?? "";
      const inApp = detectInAppBrowser(ua);
      return (
        <AuthFirstPage
          configured={false}
          initialInApp={inApp.inApp}
          initialAndroid={inApp.android}
        />
      );
    }
    const [schedule, broadcastStats] = await Promise.all([
      timed("page:/ publicSchedule(anon)", () => getPublicSchedule("vic")),
      timed("page:/ broadcastStats(anon)", () => getPublicBroadcastStats(6))
    ]);
    return (
      <PublicPoster
        accountSwitch
        anonymous
        initialYear={typeof mem.sy === "number" ? mem.sy : undefined}
        initialMonth={typeof mem.sm === "number" ? mem.sm : undefined}
        broadcastStats={broadcastStats}
        initialNarrow={narrow}
        schedule={schedule}
        toggleHeartAction={toggleEventHeartAction}
      />
    );
  }

  // 시청자가 아닌 모든 인증 사용자(owner/developer/manager/worker)는 스튜디오(/studio)로 보낸다.
  // /studio가 동일한 StudioShell을 같은 쿠키 복원으로 렌더한다(렌더 결과 동일, URL만 명확히 분리).
  // 이로써 공개 `/` 페이지는 StudioShell을 모듈 그래프에서 참조하지 않아, 비로그인/시청자가
  // 스튜디오 JS·CSS(220KB) 청크를 받지 않는다(LCP·FCP 개선의 핵심).
  if (actor.role !== "viewer") {
    redirect("/studio");
  }

  const [schedule, viewerBroadcastStats] = await Promise.all([
    timed("page:/ publicSchedule(viewer)", () => getPublicSchedule("vic")),
    timed("page:/ broadcastStats(viewer)", () => getPublicBroadcastStats(6))
  ]);

  // 일반 시청자도 보던 달(py/pm)을 새로고침 때 복원한다.
  return (
    <PublicPoster
      accountSwitch
      accountEmail={actor.email}
      initialYear={typeof mem.sy === "number" ? mem.sy : undefined}
      initialMonth={typeof mem.sm === "number" ? mem.sm : undefined}
      broadcastStats={viewerBroadcastStats}
      initialNarrow={narrow}
      schedule={schedule}
      toggleHeartAction={toggleEventHeartAction}
    />
  );
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

function AuthFirstPage({
  configured,
  initialInApp,
  initialAndroid
}: {
  configured: boolean;
  initialInApp: boolean;
  initialAndroid: boolean;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-minimal">
        {/* 숲·카톡 등 앱 안 브라우저(웹뷰)에서는 Google이 OAuth를 막으므로, 감지되면
            기본 브라우저(Chrome/Safari)로 열도록 안내·전환한다(공지 링크 접속의 핵심).
            인앱이면 로그인 버튼은 어차피 안 되므로 숨기고 안내만 보여준다. */}
        <InAppBrowserNotice
          autoSubmit={configured}
          initialAndroid={initialAndroid}
          initialInApp={initialInApp}
        >
          <form action="/api/auth/login" method="post">
            <input name="next" type="hidden" value="/" />
            <button className="button google-login" disabled={!configured} type="submit">
              <GoogleLogo />
              Google로 로그인
            </button>
          </form>
        </InAppBrowserNotice>
      </section>
    </main>
  );
}
