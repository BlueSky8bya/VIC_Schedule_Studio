import { notFound } from "next/navigation";
import { LegalLoading } from "@/components/legal/legal-loading";
import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { ToriHopLoading } from "@/components/shared/tori-hop";
import { LEGAL_TITLES } from "@/lib/ui/request-path";

// 기다림 화면(뛰는 토리) 실물 확인용. 라우트 로딩은 순간이라 그대로는 찍기 어려워 같은 부품을 고정으로 세운다.
// 운영 배포에서는 열리지 않는다(VISUAL_TEST_FIXTURE).
export const dynamic = "force-dynamic";

export default async function LoadingFixture({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const { kind } = await searchParams;
  if (kind === "privacy") return <LegalLoading label={LEGAL_TITLES["/privacy"]} />;
  if (kind === "terms") return <LegalLoading label={LEGAL_TITLES["/terms"]} />;
  if (kind === "studio") return <CalendarSkeleton label="편집실" variant="studio" />;
  if (kind === "poster") return <CalendarSkeleton label="일정표" variant="poster" />;
  if (kind === "board") return <ToriHopLoading label="일정 그림판" variant="overlay" />;
  notFound();
}
