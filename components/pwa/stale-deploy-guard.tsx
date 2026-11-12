"use client";

import { useEffect, useState } from "react";
import { STALE_DEPLOY_EVENT, announceIfStaleDeployment } from "@/lib/net/stale-deploy";

// 새 배포 뒤 옛 탭에서 Server Action이 **실제로 실패했을 때만** 새로고침 안내를 띄운다(규칙: lib/net/stale-deploy.ts).
// 새 버전이 나왔다는 사실만으로는 띄우지 않는다 — 필요 없는 새로고침 요청은 과하다(2026-11-13 소유자).
// 새로고침은 버튼을 누를 때만 — 쓰던 글·그림을 정리할 틈을 준다. 오프라인 배지(.netstat)와 같은 자리·모양.
export function StaleDeployGuard() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = () => setVisible(true);
    const onRejection = (event: PromiseRejectionEvent) => {
      announceIfStaleDeployment(event.reason);
    };
    const onError = (event: ErrorEvent) => {
      announceIfStaleDeployment(event.error);
    };
    window.addEventListener(STALE_DEPLOY_EVENT, show);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener(STALE_DEPLOY_EVENT, show);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);
  if (!visible) return null;
  return (
    <div className="netstat" aria-live="polite">
      <div className="netstat-toast netstat-update" role="status">
        <span>새로고침이 필요해요</span>
        <button className="netstat-action" data-act="stale-deploy-reload" onClick={() => window.location.reload()} type="button">
          새로고침
        </button>
        <button aria-label="닫기" className="netstat-action netstat-dismiss" data-act="stale-deploy-dismiss" onClick={() => setVisible(false)} type="button">
          ×
        </button>
      </div>
    </div>
  );
}
