"use client";

import { useEffect } from "react";
import type { MembershipRole } from "@/lib/domain/schedule-types";
import { startPresence } from "@/lib/presence/presence-client";

// 모든 로그인 사용자 화면에 1개 깔리는 보이지 않는 컴포넌트 — 실시간 프레즌스에 자기 역할만 등록.
// (개발자 창의 "접속자 현황" 합산용. 개인정보는 싣지 않는다.)
export function PresenceBeacon({ role }: { role: MembershipRole }) {
  useEffect(() => {
    startPresence(role);
  }, [role]);
  return null;
}
