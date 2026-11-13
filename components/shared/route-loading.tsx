"use client";

import { usePathname } from "next/navigation";
import { LegalLoading } from "@/components/legal/legal-loading";
import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { LEGAL_TITLES } from "@/lib/ui/request-path";

// 루트 로딩(app/loading.tsx)의 화면. 서버는 요청 때의 경로로 목적지를 고르지만, 루트 로딩 화면은 처음 연 화면의 것이
// 화면 이동 내내 재사용된다 — 일정표·편집실에서 문서 링크를 누르면 "편집실 불러오는 중…"이 뜰 수 있었다(2026-11-13·14 소유자).
// 이동이 시작되면 주소는 이미 목적지라, 문서 주소면 여기서 문서 로딩으로 바꾼다. (편집실/일정표 톤은 쿠키 힌트를 아는 서버 값을 그대로 쓴다.)
export function RouteLoading({ variant, label }: { variant: "studio" | "poster"; label: string }) {
  const legal = LEGAL_TITLES[usePathname() ?? ""];
  if (legal) return <LegalLoading label={legal} />;
  return <CalendarSkeleton label={label} variant={variant} />;
}
