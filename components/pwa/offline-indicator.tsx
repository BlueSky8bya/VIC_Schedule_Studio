"use client";

import { useEffect, useRef, useState } from "react";

// 오프라인/온라인 상태를 인앱으로 알린다. 오프라인이면 하단 pill 배지("오프라인 · 마지막 동기화 N분 전"
// — 지금 보는 건 공개 일정 스냅샷이라는 신호), 온라인 복귀 시 잠깐 초록 토스트("다시 온라인").
// 마지막 동기화 시각은 서비스워커가 공개 스냅샷을 갱신할 때 postMessage로 보내준다.
const LAST_SYNC_KEY = "vic:lastSync";

function readLastSync(): number | null {
  try {
    const v = window.localStorage.getItem(LAST_SYNC_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function agoLabel(at: number | null): string {
  if (!at) return "";
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return "방금 동기화";
  if (mins < 60) return `마지막 동기화 ${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `마지막 동기화 ${hrs}시간 전`;
  return `마지막 동기화 ${Math.floor(hrs / 24)}일 전`;
}

export function OfflineIndicator() {
  // 초기엔 항상 online으로 가정(SSR/첫 페인트 안정) → 마운트 후 실제값 반영.
  const [online, setOnline] = useState(true);
  const [showBackToast, setShowBackToast] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [, setTick] = useState(0); // "N분 전" 라벨 주기적 갱신용
  const wasOffline = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    setLastSync(readLastSync());

    const goOffline = () => {
      wasOffline.current = true;
      setOnline(false);
    };
    const goOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        setShowBackToast(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setShowBackToast(false), 2600);
      }
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // 서비스워커가 스냅샷 갱신 시각을 보내면 저장.
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "vic-snapshot" && typeof e.data.at === "number") {
        setLastSync(e.data.at);
        try {
          window.localStorage.setItem(LAST_SYNC_KEY, String(e.data.at));
        } catch {
          /* 무시 */
        }
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onMsg);

    // 배지가 떠 있는 동안 "N분 전"이 흐르게 30초마다 리렌더.
    const iv = setInterval(() => setTick((t) => t + 1), 30000);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      navigator.serviceWorker?.removeEventListener?.("message", onMsg);
      clearInterval(iv);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div className="netstat" aria-live="polite">
      {!online && (
        <div className="netstat-badge" role="status">
          <span className="netstat-dot" aria-hidden />
          <span className="netstat-txt">
            오프라인
            <span className="netstat-sub">
              {lastSync ? ` · ${agoLabel(lastSync)}` : " · 공개 일정만 표시"}
            </span>
          </span>
        </div>
      )}
      {online && showBackToast && (
        <div className="netstat-toast" role="status">
          <span className="netstat-check" aria-hidden>
            ✓
          </span>
          다시 온라인
        </div>
      )}
    </div>
  );
}
