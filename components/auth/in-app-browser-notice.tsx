"use client";

import { useEffect, useState } from "react";

// 카카오톡·인스타·숲 등 "앱 안의 브라우저(웹뷰)"에서는 구글이 OAuth를 막는다
// (403 disallowed_useragent). 이 경우 기본 브라우저(Chrome/Safari)로 열도록 안내한다.
const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|Snapchat|Discord|everytime|afreeca|SOOP|musical_ly|TikTok|; ?wv\)/i;

export function InAppBrowserNotice() {
  const [state, setState] = useState<{ show: boolean; android: boolean }>({
    show: false,
    android: false
  });

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setState({ show: IN_APP.test(ua), android: /Android/i.test(ua) });
  }, []);

  if (!state.show) {
    return null;
  }

  function openInChrome() {
    // 안드로이드: 인텐트로 크롬에서 다시 연다.
    const bare = window.location.href.replace(/^https?:\/\//, "");
    window.location.href = `intent://${bare}#Intent;scheme=https;package=com.android.chrome;end`;
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
      <strong>앱 안의 브라우저에서는 Google 로그인이 막혀요 🙏</strong>
      <p>
        카카오톡·인스타·숲 같은 앱에서 바로 열면 Google 보안정책(disallowed_useragent)으로
        로그인이 차단돼요. <b>Chrome·Safari</b> 같은 기본 브라우저로 열어 주세요.
      </p>
      <ul className="inapp-steps">
        {state.android ? (
          <li>안드로이드: 아래 “Chrome으로 열기” 또는 오른쪽 위 ⋮ → “다른 브라우저로 열기”</li>
        ) : (
          <li>아이폰: 화면의 공유/메뉴 버튼 → “Safari로 열기”</li>
        )}
        <li>또는 아래 “링크 복사” 후 브라우저 주소창에 붙여넣기</li>
      </ul>
      <div className="inapp-actions">
        {state.android ? (
          <button className="button primary" onClick={openInChrome} type="button">
            Chrome으로 열기
          </button>
        ) : null}
        <button className="button" onClick={copyLink} type="button">
          링크 복사
        </button>
      </div>
    </div>
  );
}
