"use client";

import { useEffect, useState } from "react";
import { detectInAppBrowser } from "@/lib/auth/in-app-browser";

// 현재 주소를 안드로이드 크롬으로 여는 인텐트 URL.
function chromeIntentUrl() {
  const bare = window.location.href.replace(/^https?:\/\//, "");
  return `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
}

type Props = {
  // 서버에서 요청 UA로 미리 감지한 값(첫 페인트부터 올바르게 → 빈 화면/깜빡임 없음).
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
  const [inApp, setInApp] = useState(initialInApp);
  const [android, setAndroid] = useState(initialAndroid);

  // 클라이언트에서 실제 UA로 다시 확인(서버 감지가 빗나간 경우 보정).
  useEffect(() => {
    const det = detectInAppBrowser(navigator.userAgent || "");
    setInApp(det.inApp);
    setAndroid(det.android);
  }, []);

  // 인앱이 아니면 평소대로 로그인 버튼을 보여준다.
  if (!inApp) {
    return <>{children}</>;
  }

  // 인앱이면 자동 전환(빈 화면/깜빡임 유발)을 하지 않고, 곧바로 안내를 보여준다.
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
