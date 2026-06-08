"use client";

import { useEffect } from "react";

// 오프라인 열람용 서비스워커(public/sw.js)를 등록한다. 공개 포스터만 캐시하므로 모두에게 깔아도
// 안전(스튜디오·비공개·쓰기는 SW가 손대지 않음). 미지원 브라우저·실패는 조용히 무시.
//
// identity = 현재 사용자 식별(이메일 또는 "anon"). 직전과 달라지면(로그인/로그아웃/계정변경) 캐시를
// 비운다 — 공유 기기에서 이전 사용자의 마지막 화면(이메일 등)이 오프라인에 남지 않게.
export function ServiceWorkerRegister({ identity }: { identity: string }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      try {
        const KEY = "vic:swIdentity";
        const last = window.localStorage.getItem(KEY);
        if (last !== null && last !== identity) {
          navigator.serviceWorker.ready
            .then((reg) => reg.active?.postMessage({ type: "vic-clear-cache" }))
            .catch(() => {});
        }
        window.localStorage.setItem(KEY, identity);
      } catch {
        /* localStorage 불가 환경 무시 */
      }
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, [identity]);
  return null;
}
