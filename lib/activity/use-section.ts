"use client";

import { useEffect } from "react";
import { logActivity } from "@/lib/activity/client";

// 라우트가 아닌 화면(모달·전체화면 패널)의 진입/이탈을 남긴다 — 그림판·꾸미기·태그·멤버·
// 인사이트처럼 URL이 안 바뀌는 화면은 route.enter로는 절대 안 잡힌다.
//
// name이 null이면 아무 섹션도 안 열린 상태. 값이 바뀌면 이전 섹션을 dur_ms와 함께 닫고 새로 연다.
// (모달 상태 하나로 여러 화면을 표현하는 곳이 많아, 상태값을 그대로 넘기면 전환도 자동으로 잡힌다.)
export function useSectionActivity(name: string | null): void {
  useEffect(() => {
    if (!name) return;
    const at = Date.now();
    logActivity("section.enter", { target: name });
    return () => {
      logActivity("section.leave", { target: name, durMs: Date.now() - at });
    };
  }, [name]);
}
