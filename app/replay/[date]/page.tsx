import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReplayPage } from "@/components/poster/replay-page";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { timed } from "@/lib/perf/perf";

// 날짜 다시보기 페이지(2026-09-17 소유자: 창 → 페이지 승격). 공개 데이터만(public-loader) — 비로그인도 본다.
// 껍데기만 페이지고 속(무대·부 탭·띠·챕터 레일·키보드)은 편집실 미리보기의 창과 같은 DayVodWindow 하나(G-18).
// ?part=N 으로 N번째 방송을 처음부터 고른다.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Props = { params: Promise<{ date: string }>; searchParams: Promise<{ part?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return { title: `${date} 다시보기 · 빅토리 일정표` };
}

export default async function ReplayDatePage({ params, searchParams }: Props) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();
  const { part } = await searchParams;
  const schedule = await timed("page:/replay publicSchedule", () => getPublicSchedule("vic"));
  const vods = (schedule.vods ?? [])
    .filter((v) => v.dateKey === date)
    .sort((a, b) => a.titleNo - b.titleNo);
  if (vods.length === 0) notFound();
  const partNo = Number(part);
  return (
    <ReplayPage
      dateKey={date}
      initialPart={Number.isInteger(partNo) && partNo >= 1 ? partNo : undefined}
      slug={schedule.calendar.slug}
      vods={vods}
    />
  );
}
