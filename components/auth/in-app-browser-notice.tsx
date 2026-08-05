"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectInAppBrowser } from "@/lib/auth/in-app-browser";
import { hapticTick } from "@/lib/ui/haptics";

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
  // true이면 인앱이 아님이 확정될 때 children 안의 폼을 자동 제출한다(흰 화면+버튼 한 번 더
  // 누르지 않고 바로 구글 계정 선택 화면으로). 인앱/미설정 환경에선 동작하지 않는다.
  autoSubmit?: boolean;
};

export function InAppBrowserNotice({
  initialInApp = false,
  initialAndroid = false,
  children,
  autoSubmit = false
}: Props) {
  // 안드로이드 웹뷰는 크롬 자동전환을 먼저 시도하므로 "trying"(여는 중)으로 시작 — 카드는
  // 전환이 실패했을 때만 보여준다. iOS 등 자동전환 불가 환경은 바로 카드.
  const [phase, setPhase] = useState<Phase>(
    !initialInApp ? "children" : initialAndroid ? "trying" : "card"
  );
  const [android, setAndroid] = useState(initialAndroid);
  const [copied, setCopied] = useState(false);
  const formWrapRef = useRef<HTMLDivElement>(null);
  const autoTried = useRef(false);
  // 크롬 자동전환 상태 공유(여러 효과에서). opened=크롬이 떠 웹뷰가 가려짐, returned=복귀 처리 1회만.
  const openedRef = useRef(false);
  const returnedRef = useRef(false);
  // autoSubmit이면 첫 렌더부터 "로딩"으로 시작해 로그인 버튼이 잠깐 보였다 사라지는 깜빡임을 없앤다.
  // (이미 시도했던 세션이면 아래 효과에서 false로 바꿔 버튼을 노출 → 취소/뒤로가기 탈출구.)
  const [autoStarting, setAutoStarting] = useState(autoSubmit);
  // 강제 뒤로가기로 빠져나가는 짧은 순간엔 아무것도 안 그린다 — "기본 브라우저로 열어주세요"
  // 카드(또는 스피너)가 0.x초 깜빡이는 걸 없애기 위함.
  const [leaving, setLeaving] = useState(false);

  // 크롬으로 보낸 뒤 이 redirect 화면으로 돌아온 경우, 사용자가 "한 번 더 누르는 뒤로가기"를
  // 자동으로 대신한다. ① 웹 히스토리가 있으면 history.back(). ② 숲·카카오처럼 웹 히스토리가
  // 1개뿐인(뒤로 갈 웹 페이지가 없는) 단일 웹뷰면 시스템 뒤로가기 대용으로 window.close()를 시도.
  // 둘 다 못 빠져나가면 잠깐 뒤 안내 카드(수동 탈출구)를 보여준다. 무한 바운스는 1.5초 가드로 방지.
  const forceBack = useCallback(() => {
    if (returnedRef.current) return;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem("vic-skip-ts") || "0");
    } catch {
      last = 0;
    }
    const now = Date.now();
    if (now - last < 1500) {
      // 방금 빠져나가려 했는데 또 이 화면 = 더는 못 빠져나감 → 카드로.
      setLeaving(false);
      setAutoStarting(false);
      setPhase("card");
      return;
    }
    returnedRef.current = true;
    try {
      sessionStorage.setItem("vic-skip-ts", String(now));
    } catch {
      // 무시
    }
    // 빠져나가는 순간 화면을 비워(빈 화면) 카드 깜빡임 제거 → 곧바로 뒤로/닫기.
    setLeaving(true);
    if (window.history.length > 1) {
      window.history.back();
    } else {
      try {
        window.open("", "_self");
        window.close();
      } catch {
        // 닫기 불가
      }
    }
    // 위 시도가 안 먹히는 환경이면(여전히 이 화면) 잠깐 뒤 카드로 — 무한 빈 화면 방지.
    window.setTimeout(() => {
      returnedRef.current = false;
      setLeaving(false);
      setAutoStarting(false);
      setPhase("card");
    }, 800);
  }, []);

  // 인앱이 아님이 확정되면(phase=children) 로그인 폼을 한 번 자동 제출한다.
  // 단, 이 브라우저 세션에서 이미 한 번 시도했으면 자동 제출하지 않고 버튼만 보여준다 —
  // 구글에서 로그인을 취소하거나 뒤로가기로 돌아왔을 때 다시 구글로 튕겨 무한 루프가 되는 걸 막는다.
  useEffect(() => {
    if (phase !== "children" || !autoSubmit || autoTried.current) {
      return;
    }
    autoTried.current = true;
    let alreadyTried = false;
    try {
      alreadyTried = Boolean(sessionStorage.getItem("vic-autologin"));
      if (!alreadyTried) {
        sessionStorage.setItem("vic-autologin", "1");
      }
    } catch {
      // sessionStorage 불가(사생활 모드 등)면 자동 제출은 건너뛰고 버튼을 보여준다.
      alreadyTried = true;
    }
    if (alreadyTried) {
      setAutoStarting(false); // 이미 시도함 → 로딩 대신 버튼 노출(수동 진입 가능)
      return;
    }
    formWrapRef.current?.querySelector("form")?.requestSubmit();
  }, [phase, autoSubmit]);

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
    // 안드로이드 웹뷰: 이미 크롬 전환을 시도한 세션에서 이 redirect 페이지를 "다시" 보고 있다
    // = 사실상 뒤로가기로 들어온 것. 머무르지 말고 "한 번 더 뒤로"를 자동으로 대신한다.
    if (sessionStorage.getItem("vic-chrome-try")) {
      forceBack();
      return;
    }
    // 크롬으로 자동 전환 시도. 성공하면 화면이 백그라운드로 가(visibilitychange) 카드를 안 띄운다.
    sessionStorage.setItem("vic-chrome-try", "1");
    setPhase("trying");
    const onVis = () => {
      if (document.hidden) {
        openedRef.current = true; // 크롬이 열려 이 웹뷰가 가려짐
      } else if (openedRef.current) {
        // 크롬에서 이 웹뷰로 돌아옴 → "한 번 더 뒤로"를 자동으로 대신해 원래 화면으로.
        forceBack();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    // 전환 자체가 실패(크롬 안 열림)했을 땐 안내 카드로(무한 "여는 중" 방지). 크롬이 열렸으면
    // document.hidden=true라 여기선 건드리지 않고, 복귀는 위 visibilitychange가 처리한다.
    const timer = window.setTimeout(() => {
      if (!openedRef.current && !document.hidden) setPhase("card");
    }, 1500);
    // replace로 보내 intent:// 주소가 히스토리에 안 남게 한다.
    window.location.replace(chromeIntentUrl());
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(timer);
    };
  }, [forceBack]);

  // bfcache로 redirect 화면이 복원되는 경우(웹뷰가 visibilitychange 대신 pageshow를 쏠 때)도
  // 동일하게 "한 번 더 뒤로"로 원래 화면으로. 크롬 전환을 시도했던 세션에서만 동작.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (!e.persisted || returnedRef.current) return;
      let tried = false;
      try {
        tried = Boolean(sessionStorage.getItem("vic-chrome-try"));
      } catch {
        tried = false;
      }
      if (tried) forceBack();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [forceBack]);

  // 강제 뒤로가기로 빠져나가는 짧은 순간: 카드도 스피너도 그리지 않아 깜빡임이 없다.
  if (leaving) {
    return null;
  }

  if (phase === "children") {
    // 자동 로그인 중에는 버튼을 그리지 않고 로딩만 보여준다(폼은 숨겨둔 채 자동 제출).
    // → 링크 진입 후 구글 계정창이 뜨기 전 "로그인 버튼이 깜빡" 하는 현상 제거.
    if (autoStarting) {
      return (
        <div className="inapp-trying" role="status" aria-live="polite">
          <span className="inapp-spinner" aria-hidden="true" />
          <span>Google 계정으로 이동 중…</span>
          <div ref={formWrapRef} style={{ display: "none" }}>
            {children}
          </div>
        </div>
      );
    }
    // display:contents로 레이아웃엔 영향 없이, 자동 제출용으로 폼을 감싸는 ref만 둔다.
    return (
      <div ref={formWrapRef} style={{ display: "contents" }}>
        {children}
      </div>
    );
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
    // replace로 보내 뒤로가기 시 intent:// 주소로 되돌아가 다시 크롬이 열리는 루프를 막는다.
    window.location.replace(chromeIntentUrl());
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      hapticTick();
      window.setTimeout(() => setCopied(false), 1500);
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
          <button className="button primary" data-act="open-in-chrome" onClick={openInChrome} type="button">
            📲 Chrome으로 열기
          </button>
        ) : null}
        <button className={android ? "button" : "button primary"} data-act="copy-app-link" onClick={copyLink} type="button">
          {copied ? "복사됨" : "링크 복사"}
        </button>
      </div>
    </div>
  );
}
