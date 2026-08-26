import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPoster } from "@/components/poster/public-poster";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getPublicSchedule } from "@/lib/schedules/public-loader";

// 뱅송 미리보기(/onair) — 방송 화면(OBS 브라우저 소스 1920×1080)에 그대로 올리거나, 관리자가
// "뱅온 때 시청자에게 이렇게 보인다"를 브라우저에서 확인하는 테스트용 주소.
//   /onair            아바타 자리 왼쪽(기본)
//   /onair?side=right 아바타 자리 오른쪽
//   /onair?y=2026&m=9 특정 달로 열기(생략하면 이번 달)
// 로그인 없이 열린다(OBS 브라우저 소스는 쿠키가 없다). 공개 로더만 쓰므로 `/`와 같은 공개 데이터
// 경계 — 비공개·엠바고·작업자 일정은 애초에 실리지 않는다. 아바타 scene은 순수 레이아웃(빈 자리)이라
// 권한과 무관. 관리자 토글(켜기/끄기·좌우)은 안 그린다 — 화면에 붙잡을 크롬을 남기지 않는다.
export const metadata: Metadata = {
  title: "빅토리 일정표 — 뱅송 미리보기",
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function OnAirPage({
  searchParams
}: {
  searchParams?: Promise<{ side?: string; y?: string; m?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    notFound();
  }
  const sp = await searchParams;
  const side = sp?.side === "right" ? "right" : "left";
  const y = Number(sp?.y);
  const m = Number(sp?.m);
  const initialYear = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : undefined;
  const initialMonth = Number.isInteger(m) && m >= 1 && m <= 12 ? m : undefined;
  const schedule = await getPublicSchedule("vic");
  return (
    <PublicPoster
      anonymous
      accountSwitch={false}
      avatarFixed={side}
      initialNarrow={false}
      initialYear={initialYear}
      initialMonth={initialMonth}
      schedule={schedule}
    />
  );
}
