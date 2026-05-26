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
