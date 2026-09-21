import { getTimelineManagement } from "@/lib/broadcast/timeline-actions";
import { TimelineBoard } from "@/components/studio/timeline-board";
export const dynamic = "force-dynamic";
export default async function TimelinesPage({ searchParams }: { searchParams: Promise<{ titleNo?: string }> }) {
  const { titleNo } = await searchParams;
  const result = await getTimelineManagement(titleNo ? Number(titleNo) : undefined);
  return <TimelineBoard rows={result.ok ? result.rows : []} error={result.ok ? null : result.error} />;
}
