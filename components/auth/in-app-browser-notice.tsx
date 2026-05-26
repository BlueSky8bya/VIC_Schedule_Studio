"use client";

import { useEffect, useState } from "react";
import { detectInAppBrowser } from "@/lib/auth/in-app-browser";

// 현재 주소를 안드로이드 크롬으로 여는 인텐트 URL.
function chromeIntentUrl() {
  const bare = window.location.href.replace(/^https?:\/\//, "");
  return `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
}

type Phase = "children" | "trying" | "card";

type Props = {
  // 서버에서 요청 UA로 미리 감지한 값(첫 페인트부터 올바르게 → 깜빡임 없음).
  initialInApp?: boolean;
  initialAndroid?: boolean;
  // 인앱이 아닐 때만 보여줄 내용(보통 Google 로그인 버튼). 인앱이면 숨긴다(어차피 로그인 불가).
  children?: React.ReactNode;
};

export function InAppBrowserNotice({
  initialInApp = false,
  initialAndroid = false,
  children
}: Props) {
  // 안드로이드 웹뷰는 크롬 자동전환을 먼저 시도하므로 "trying"(여는 중)으로 시작 — 카드는
  // 전환이 실패했을 때만 보여준다. iOS 등 자동전환 불가 환경은 바로 카드.
  const [phase, setPhase] = useState<Phase>(
    !initialInApp ? "children" : initialAndroid ? "trying" : "card"
  );
  const [android, setAndroid] = useState(initialAndroid);

  useEffect(() => {
    const det = detectInAppBrowser(navigator.userAgent || "");
    setAndroid(det.android);

    if (!det.inApp) {
      setPhase("children");
      return;
    }
    if (!det.android) {
      setPhase("card"); // 자동전환 불가(iOS 등) → 안내 바로
      return;
    }
    // 안드로이드 웹뷰: 같은 세션에서 이미 시도했으면(크롬에서 돌아옴 등) 바로 카드.
    if (sessionStorage.getItem("vic-chrome-try")) {
      setPhase("card");
      return;
    }
    // 크롬으로 자동 전환 시도. 성공하면 화면이 백그라운드로 가(visibilitychange) 카드를 안 띄운다.
    sessionStorage.setItem("vic-chrome-try", "1");
    setPhase("trying");
    let opened = false;
    const onVis = () => {
      if (document.hidden) opened = true; // 크롬이 열려 이 웹뷰가 가려짐
    };
    document.addEventListener("visibilitychange", onVis);
    const timer = window.setTimeout(() => {
      if (!opened && !document.hidden) setPhase("card"); // 전환 실패 → 그제서야 안내
    }, 1200);
    window.location.href = chromeIntentUrl();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(timer);
    };
  }, []);

  if (phase === "children") {
    return <>{children}</>;
  }

  if (phase === "trying") {
    // 크롬으로 넘어가는 짧은 순간의 표시(빈 화면 방지). 전환되면 곧 사라진다.
    return (
      <div className="inapp-trying" role="status" aria-live="polite">
        <span className="inapp-spinner" aria-hidden="true" />
        <span>Chrome으로 여는 중…</span>
      </div>
    );
  }

  function openInChrome() {
    window.location.href = chromeIntentUrl();
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // 클립보드 권한 없으면 무시(주소창 직접 복사 가능).
    }
  }

  return (
    <div className="auth-warning inapp-notice">
      <strong>기본 브라우저로 열어주세요</strong>
      <p>Google 보안정책으로 로그인이 차단됩니다.</p>
      <p>Chrome이나 Safari로 열어주세요.</p>
      <div className="inapp-actions">
        {android ? (
          <button className="button primary" onClick={openInChrome} type="button">
            📲 Chrome으로 열기
          </button>
        ) : null}
        <button className={android ? "button" : "button primary"} onClick={copyLink} type="button">
          링크 복사
        </button>
      </div>
    </div>
  );
}
