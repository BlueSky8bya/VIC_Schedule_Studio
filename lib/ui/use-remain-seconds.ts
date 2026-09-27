"use client";

import { useEffect, useState } from "react";

// 남은 초 — 카드와 팝오버가 '같은 숫자를 같은 순간에' 보여주기 위한 공용 시계.
// 예전엔 두 곳이 각자 setInterval(1000)을 돌려서, 시작 시각이 다르면 최대 1초까지 서로 다른
// 숫자를 보여줬다(사용자 지적: 살짝 어긋난다). interval은 시작 시점 기준으로 세기 때문에
// 아무리 정확해도 위상이 안 맞는다 → 매번 '다음 초 경계'를 직접 계산해 그때 깨어난다.
// 그러면 어느 컴포넌트가 언제 마운트됐든 넘어가는 순간이 같다(+8ms는 경계를 확실히 넘기려는 여유).
export function useRemainSeconds(targetMs: number | null): number | null {
  const [s, setS] = useState<number | null>(null);
  useEffect(() => {
    if (targetMs === null || !Number.isFinite(targetMs)) {
      setS(null);
      return;
    }
    let timer = 0;
    const tick = () => {
      const diff = targetMs - Date.now();
      // ceil — 남은 시간이 0.2초여도 '1'이다. round면 0.5초 남았을 때 0을 띄워 반 박자 빠르다.
      setS(Math.max(0, Math.ceil(diff / 1000)));
      timer = window.setTimeout(tick, (((diff % 1000) + 1000) % 1000) + 8);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [targetMs]);
  return s;
}
