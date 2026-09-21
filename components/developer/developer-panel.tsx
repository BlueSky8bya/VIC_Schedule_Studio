"use client";

import React from "react";

export function DeveloperPanel() {
  return (
    <div className="developer-panel">
      <p className="developer-panel-hint" role="status">
        개인정보 보호를 위해 실시간 접속 현황 제공을 중단했습니다.
      </p>
      <p className="developer-panel-hint">
        방문·체류 통계는 인사이트의 기간별 기록에서 확인할 수 있습니다.
      </p>
    </div>
  );
}
