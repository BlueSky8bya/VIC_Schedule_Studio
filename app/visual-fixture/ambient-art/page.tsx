import { notFound } from "next/navigation";
import { AmbientArtBoard } from "@/components/studio/ambient-art-board";
import { readPresentArt } from "@/lib/ambient/art-files";
import { artSlot } from "@/components/shared/ambient/art/manifest";
import { AmbientArtSlotView } from "@/components/studio/ambient-art-slot";

// 아트 보드 fixture(2026-09-04) — 인증 없이 보드 UI를 실측하기 위한 페이지. `VISUAL_TEST_FIXTURE=1`일 때만 열린다(프로덕션 404).
// 실제 라우트(/studio/ambient-art)는 개발자 가드가 붙는다 — 여기서는 UI만.
export const dynamic = "force-dynamic";

export default async function AmbientArtFixture({ searchParams }: { searchParams?: Promise<{ slot?: string }> }) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const id = (await searchParams)?.slot;
  if (id && !artSlot(id)) notFound();
  const { present, stamp } = readPresentArt();
  if (id) return <AmbientArtSlotView slotId={id} files={present[id] ?? []} stamp={stamp} />;
  return <AmbientArtBoard present={present} stamp={stamp} />;
}
