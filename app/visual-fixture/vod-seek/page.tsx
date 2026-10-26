import { notFound } from "next/navigation";
import { VodSeekFixture } from "./client";
export const dynamic = "force-dynamic";
export default async function VodSeekFixturePage({ searchParams }: { searchParams: Promise<{ access?: string; parts?: string; variant?: string }> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const params = await searchParams;
  const parts = Math.min(12, Math.max(1, Number.parseInt(params.parts ?? "2", 10) || 2));
  return <VodSeekFixture access={params.access === "public" ? "public" : params.access === "plus" ? "plus" : params.access === "mixed" ? "mixed" : "sub"} parts={parts} variant={params.variant === "modal" ? "modal" : "page"} />;
}
