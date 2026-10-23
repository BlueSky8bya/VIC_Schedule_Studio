import { notFound } from "next/navigation";
import { ToyMotionFixture } from "@/components/poster/viewer-companion/toy-motion-fixture";

export const dynamic = "force-dynamic";
export default async function ToyMotionPage({ searchParams }: { searchParams?: Promise<{ reduced?: string }> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  return <ToyMotionFixture reduced={(await searchParams)?.reduced === "1"} />;
}
