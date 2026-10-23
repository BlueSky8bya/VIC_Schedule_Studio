"use client";
import { DayVodWindow } from "@/components/poster/day-vod-window";
export function VodSeekFixture({ access }: { access: "sub" | "plus" }) {
  return <DayVodWindow dateKey="2020-01-01" slug="fixture" side="left" variant="page" initialPart={1} initialSec={125} onClose={() => {}} vods={[
    { titleNo: 42, title: "합성 첫 영상", access, durationMs: 600000, chapters: 2 },
    { titleNo: 43, title: "합성 다른 영상", access, durationMs: 600000, chapters: 2 }
  ]} />;
}
