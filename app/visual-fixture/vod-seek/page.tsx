import { notFound } from "next/navigation";
import { VodSeekFixture } from "./client";
export const dynamic = "force-dynamic";
export default async function VodSeekFixturePage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const params = await searchParams;
  return <VodSeekFixture access={params.access === "public" ? "public" : params.access === "plus" ? "plus" : "sub"} />;
}
