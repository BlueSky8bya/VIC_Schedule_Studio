"use client";

import { useEffect, useState } from "react";
import { detectInAppBrowser } from "@/lib/auth/in-app-browser";

// 현재 주소를 안드로이드 크롬으로 다시 여는 인텐트 URL.
function chromeIntentUrl() {
  const bare = window.location.href.replace(/^https?:\/\//, "");
  return `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
}

type Phase = "children" | "checking" | "notice";

type Props = {
  // 서버에서 요청 UA로 미리 감지한 값(첫 페인트 깜빡임 방지).
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
  // 안드로이드 인앱은 크롬 자동 전환을 먼저 시도하므로 배너를 바로 띄우지 않고 "checking"으로 숨긴다.
  const [phase, setPhase] = useState<Phase>(
    !initialInApp ? "children" : initialAndroid ? "checking" : "notice"
  );
  const [android, setAndroid] = useState(initialAndroid);

  useEffect(() => {
    const det = detectInAppBrowser(navigator.userAgent || "");
    setAndroid(det.android);

    if (!det.inApp) {
      setPhase("children");
      return;
    }

    if (det.android) {
      // 크롬으로 자동 전환을 먼저 시도하고, 전환이 안 됐을 때만(여전히 이 화면이면) 배너를 띄운다.
      if (!sessionStorage.getItem("vic-chrome-try")) {
        sessionStorage.setItem("vic-chrome-try", "1");
        setPhase("checking");
        window.location.href = chromeIntentUrl();
        const timer = window.setTimeout(() => {
          if (!document.hidden) setPhase("notice");
        }, 1600);
        return () => window.clearTimeout(timer);
      }
      // 이미 시도한 세션(크롬에서 돌아옴 등) → 바로 배너.
      setPhase("notice");
      return;
    }

    // iOS 등 → 바로 배너.
    setPhase("notice");
  }, []);

  if (phase === "children") {
    return <>{children}</>;
  }
  if (phase === "checking") {
    return null;
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
