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

    // dev에서는 SW를 절대 쓰지 않는다 + 남아있는 등록/캐시를 적극 청소한다.
    // 이유: sw.js는 /_next/static을 cache-first로 캐시하는데, dev 청크 URL은 내용이 바뀌어도
    // 주소가 그대로라 옛 앱 코드가 영원히 서빙됐다(수정을 배포해도 브라우저가 옛 동작을
    // 유지하던 실사고). prod는 청크가 내용 해시라 cache-first가 안전하다.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((ks) => ks.forEach((k) => void caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

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
