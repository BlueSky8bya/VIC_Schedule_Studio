// 앱 안의 브라우저(웹뷰) 감지. 카카오톡·인스타·숲 등에서 링크를 바로 열면 Google이
// OAuth를 막으므로(403 disallowed_useragent), 감지해서 기본 브라우저로 유도한다.
// 서버(요청 UA)·클라이언트(navigator.userAgent) 양쪽에서 같은 규칙을 쓴다.

const IN_APP =
  /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|Snapchat|Discord|everytime|afreeca|SOOP|musical_ly|TikTok|; ?wv\)/i;

export type InAppBrowserInfo = {
  inApp: boolean;
  android: boolean;
  ios: boolean;
};

// 휴대폰 여부(UA 휴리스틱). 모바일 레이아웃을 서버에서 처음부터 그리게 해, 데스크톱 레이아웃이
// 잠깐 비쳤다 모바일로 바뀌는 깜빡임을 없앤다. 정확한 폭 판정은 클라의 matchMedia가 마운트 후 보정.
// (iPad는 데스크톱 UA를 쓰는 경우가 많아 일부러 제외 — 태블릿은 넓은 레이아웃이 자연스럽다.)
export function isMobileUserAgent(ua: string): boolean {
  return /Mobi|Android|iPhone|iPod/i.test(ua);
}

export function detectInAppBrowser(ua: string): InAppBrowserInfo {
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  // iOS 인앱(WKWebView)은 UA에 "Safari" 토큰이 없다. 정식 Safari·Chrome(CriOS)·
  // Firefox(FxiOS)는 모두 "Safari"를 포함하므로, iOS면서 Safari가 없으면 웹뷰로 본다.
  const iosInApp = isIOS && !/Safari/i.test(ua);
  return {
    inApp: IN_APP.test(ua) || iosInApp,
    android: /Android/i.test(ua),
    ios: isIOS
  };
}
