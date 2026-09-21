import { notFound } from "next/navigation";
import { TimelineFixture } from "@/components/studio/timeline-fixture";
import "@/components/poster/public-poster.css";
export const dynamic = "force-dynamic";
export default function TimelineFixturePage() {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  return <TimelineFixture />;
}
