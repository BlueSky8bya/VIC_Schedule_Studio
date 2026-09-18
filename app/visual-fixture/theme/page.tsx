import { notFound } from "next/navigation";
import { ReplayPage } from "@/components/poster/replay-page";
import { SearchDictionaryBoard } from "@/components/studio/search-dictionary-board";

// Same UI as the guarded production pages, with synthetic data only. This route
// cannot be opened on a normal deployment and never loads operational records.
export const dynamic = "force-dynamic";

export default async function ThemeFixture({ searchParams }: {
  searchParams: Promise<{ surface?: string }>;
}) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const { surface } = await searchParams;
  if (surface === "dictionary") {
    return <SearchDictionaryBoard error={null} rows={[
      { term: "샘플말", vods: 3, total: 12, firstDay: "2026-06-01", lastDay: "2026-06-20", samples: ["샘플 게임 방송"], note: null },
      { term: "샘플인사", vods: 4, total: 20, firstDay: "2026-06-02", lastDay: "2026-06-21", samples: ["함께하는 저녁"], note: null }
    ]} />;
  }
  if (surface !== "replay") notFound();
  return <ReplayPage dateKey="2026-06-15" slug="vic" vods={[
    { titleNo: 900000001, title: "샘플 방송 · 함께하는 여름 저녁", durationMs: 7200000, chapters: 6, timelineBy: "샘플 팬", startedAt: "2026-06-15T18:00:00+09:00" },
    { titleNo: 900000002, title: "샘플 방송 · 두 번째 이야기", durationMs: 3600000, chapters: 6, timelineBy: "샘플 팬", startedAt: "2026-06-15T20:00:00+09:00" }
  ]} />;
}
