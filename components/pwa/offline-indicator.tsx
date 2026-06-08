"use client";

import { useEffect, useRef, useState } from "react";

// 오프라인/온라인 상태를 인앱으로 알린다. 오프라인이면 하단 pill 배지("오프라인 · 마지막 동기화 N분 전"
// — 지금 보는 건 공개 일정 스냅샷이라는 신호), 온라인 복귀 시 잠깐 초록 토스트("다시 온라인").
// 마지막 동기화 시각은 서비스워커가 공개 스냅샷을 갱신할 때 postMessage로 보내준다.
const LAST_SYNC_KEY = "vic:lastSync";
const SNAPSHOT_KEY = "/__offline_snapshot"; // SW의 공개 스냅샷 캐시 키와 일치해야 함

// 공개 포스터 스냅샷이 캐시에 실제로 있는지(= 오프라인에서 보여줄 화면이 있는지) 확인.
async function snapshotExists(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    const keys = await caches.keys();
    for (const k of keys) {
      if (!k.startsWith("vic-offline")) continue;
      const c = await caches.open(k);
      if (await c.match(SNAPSHOT_KEY)) return true;
    }
  } catch {
    /* 무시 */
  }
  return false;
}

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
      // 스튜디오(편집실)는 오프라인에서 쓸 수 없다(비공개·저장·언락이 서버 필요). 오프라인으로 바뀌는
      // 순간 공개 포스터 스냅샷으로 자동 전환 → 수동 새로고침 2단계 제거. location.replace("/")는 SW
      // navHandler가 공개 스냅샷을 돌려주고 URL도 "/"로 맞춘다. 쓰기는 keepalive라 떠나도 저장돼 안전.
      // ★ 단, 스냅샷이 실제로 있을 때만 전환한다 — 없으면 navHandler가 '오프라인이에요' 화면을 줘서
      //   오히려 더 나쁘므로, 그 경우엔 보던 편집실을 그대로 둔다. 이미 오프라인으로 로드된 경우엔 이
      //   이벤트가 안 와(전환 시점만) 무한 reload 루프도 없다.
      if (!window.location.pathname.startsWith("/studio")) return;
      void snapshotExists().then((has) => {
        if (has) {
          try {
            window.location.replace("/");
          } catch {
            /* 무시 */
          }
        }
      });
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
