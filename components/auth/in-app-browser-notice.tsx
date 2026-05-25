"use client";

import { useEffect, useState } from "react";

// 카카오톡·인스타·숲 등 "앱 안의 브라우저(웹뷰)"에서는 구글이 OAuth를 막는다
// (403 disallowed_useragent). 이 경우 기본 브라우저(Chrome/Safari)로 열도록 한다.
const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|Snapchat|Discord|everytime|afreeca|SOOP|musical_ly|TikTok|; ?wv\)/i;

// 현재 주소를 안드로이드 크롬으로 다시 여는 인텐트 URL.
function chromeIntentUrl() {
  const bare = window.location.href.replace(/^https?:\/\//, "");
  return `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function InAppBrowserNotice() {
  const [state, setState] = useState<{ show: boolean; android: boolean }>({
    show: false,
    android: false
  });

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const inApp = IN_APP.test(ua);
    const android = /Android/i.test(ua);
    setState({ show: inApp, android });

    // 안드로이드 웹뷰면 크롬으로 한 번 자동 전환 시도(실패하면 배너로 수동 안내).
    if (inApp && android && !sessionStorage.getItem("vic-chrome-try")) {
      sessionStorage.setItem("vic-chrome-try", "1");
      setTimeout(() => {
        window.location.href = chromeIntentUrl();
      }, 400);
    }
  }, []);

  if (!state.show) {
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
      <strong>앱 안에서는 Google 로그인이 막혀요 🙏 기본 브라우저로 열어주세요</strong>
      <p>
        카카오톡·인스타·숲 같은 앱에서 바로 열면 Google 보안정책으로 로그인이 차단돼요.
        <b> Chrome·Safari</b>로 열면 정상 작동합니다.
      </p>
      {state.android ? (
        <>
          <div className="inapp-actions">
            <button className="button primary" onClick={openInChrome} type="button">
              📲 Chrome으로 열기
            </button>
            <button className="button" onClick={copyLink} type="button">
              링크 복사
            </button>
          </div>
          <p className="inapp-hint">
            자동으로 안 열리면 위 버튼을 누르거나, 오른쪽 위 ⋮ → “다른 브라우저로 열기”를 눌러요.
          </p>
        </>
      ) : (
        <>
          <ul className="inapp-steps">
            <li>
              화면의 <b>공유/메뉴 버튼</b> → <b>“Safari로 열기”</b>를 눌러주세요.
            </li>
            <li>또는 아래 “링크 복사” 후 Safari 주소창에 붙여넣기.</li>
          </ul>
          <div className="inapp-actions">
            <button className="button primary" onClick={copyLink} type="button">
              링크 복사
            </button>
          </div>
        </>
      )}
    </div>
  );
}
